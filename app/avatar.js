/* ============================================================================
   AVATAR — a sinalizadora em 3D (three.js + GLB com 55 ossos).
   Traduz a notação da casa (forma da mão + local no espaço) em poses de ossos:
   os braços vão por IK de dois segmentos, os dedos por ângulos de flexão.
   ============================================================================ */
(function (global) {
  'use strict';

  const G = Math.PI / 180;
  /* lado do palco → prefixo dos ossos VRM (a sinalizadora está de frente para nós) */
  const BRACO = { D: 'R', E: 'L' };

  let renderer, cena, cam, modelo;
  let ossos = {}, malhas = [], pronto = false;
  /* quem estiver à espera do GLB no ecrã recebe o progresso (o ficheiro tem 13 MB) */
  let aoProgresso = null;
  let relogio = 0, ultimo = performance.now();
  let repousoOssos = null, poseBase = null;
  let piscar = 0, proximoPiscar = 2.4;

  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const eixo = (ax, ang) => new THREE.Quaternion().setFromAxisAngle(ax, ang * G);
  const suave = t => t * t * (3 - 2 * t);
  const lim = (v, a, b) => Math.min(b, Math.max(a, v));

  const AX = V(1, 0, 0), AY = V(0, 1, 0), AZ = V(0, 0, 1);

  /* Scratch do caminho quente: rodarMundo corre dezenas de vezes por pose e
     duas por fotograma; alocar aqui enchia a pilha de lixo do GC. */
  const _qA = new THREE.Quaternion(), _qL = new THREE.Quaternion();

  function rodarMundo(osso, delta) {
    /* q_mundo = q_pai · q_local; premultiplicar (q_pai⁻¹ δ q_pai) dá
       q_mundo_novo = δ · q_mundo, ou seja o giro pedido no referencial do mundo. */
    if (!osso.parent) {
      osso.quaternion.premultiply(delta);
    } else {
      osso.parent.getWorldQuaternion(_qA);
      _qL.copy(_qA).invert().multiply(delta).multiply(_qA);
      osso.quaternion.premultiply(_qL);
    }
    osso.updateMatrixWorld(true);
  }

  const posMundo = o => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

  /* ===================== cena ===================== */
  let observador = null, carregando = null, alvo = null;
  let ambienteRT = null;

  /* Estúdio em HDR: uma sala escura com três softboxes. O GLB não traz luz
     ambiente nem especular próprios — sem isto a pele e o cabelo são cor
     chapada, porque só recebem as direcionais. O PMREM filtra a sala e dá ao
     material um reflexo suave, que é o que faz a pele ler como pele e o tecido
     como tecido. */
  function montarAmbiente() {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const est = new THREE.Scene();
    const sala = new THREE.Mesh(
      new THREE.SphereGeometry(9, 32, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.045, 0.075, 0.068), side: THREE.BackSide })
    );
    est.add(sala);
    const painel = (r, g, b, x, y, z, w, h) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide })
      );
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      est.add(m);
    };
    /* Mesa chave, alta e à esquerda (a mesma direção do `sol`). */
    painel(5.2, 5.0, 4.7, -3.4, 3.6, 3.2, 4.0, 2.6);
    /* Enchimento frio à direita, largo e fraco. */
    painel(0.85, 0.95, 1.05, 3.6, 2.2, 2.4, 3.2, 3.2);
    /* Duas tiras de recorte atrás: são elas que desenham a auréola dos ombros. */
    painel(3.4, 3.7, 4.0, 2.9, 2.6, -3.6, 1.0, 3.4);
    painel(1.9, 2.1, 2.3, -2.9, 2.4, -3.4, 1.0, 3.0);
    /* Teto, para o cabelo não ficar preto no alto da cabeça. */
    painel(1.6, 1.55, 1.5, 0, 5.0, 0, 5.0, 5.0);
    ambienteRT = pmrem.fromScene(est, 0.04);
    cena.environment = ambienteRT.texture;
    pmrem.dispose();
    est.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  function redim() {
    if (!alvo || !renderer) return;
    const w = alvo.clientWidth, h = alvo.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  }

  function init(el, opcoes) {
    alvo = el;
    if (renderer) {
      /* já há um renderizador: mudar de página não volta a carregar o GLB */
      el.appendChild(renderer.domElement);
      if (observador) observador.disconnect();
      if (global.ResizeObserver) { observador = new ResizeObserver(redim); observador.observe(el); }
      redim();
      return pronto ? Promise.resolve(API) : carregando;
    }

    const o = opcoes || {};
    if (o.progresso) aoProgresso = o.progresso;
    /* O modo-folha lê o canvas com drawImage; sem preservar o buffer, a
       composição limpa o desenho e a cópia saía preta. Na app fica desligado:
       só custa uma cópia por frame. */
    const laboratorio = /[?&]folha3d=1/.test(global.location.search);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: laboratorio });
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    renderer.setSize(el.clientWidth || 640, el.clientHeight || 360);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    /* A sombra própria do queixo, do cabelo na testa e dos braços no tronco é o
       que dá volume a uma figura sob uma luz só. Um mapa de 1024 chega: a
       câmara de sombra cobre 2,4 m em volta do tronco. */
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    cena = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(o.fov || 30, (el.clientWidth || 16) / (el.clientHeight || 9), 0.05, 30);

    /* Palco escuro: o recorte frio separa o cabelo e os ombros do fundo, e é a
       luz que revela o brilho da pele e do tecido através do ambiente IBL. */
    cena.add(new THREE.HemisphereLight(0xcfe4dd, 0x2b1e17, 0.24));
    const sol = new THREE.DirectionalLight(0xfff6ea, 1.25);
    sol.position.set(-1.7, 2.9, 2.5);
    sol.target.position.set(0, 1.25, 0);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);
    sol.shadow.camera.left = -1.2;
    sol.shadow.camera.right = 1.2;
    sol.shadow.camera.top = 1.3;
    sol.shadow.camera.bottom = -1.3;
    sol.shadow.camera.near = 0.5;
    sol.shadow.camera.far = 9;
    sol.shadow.bias = -0.0004;
    sol.shadow.normalBias = 0.02;
    cena.add(sol, sol.target);
    const recorte = new THREE.DirectionalLight(0xe6f6ff, 1.15);
    recorte.position.set(1.3, 2.4, -2.3);
    cena.add(recorte);
    /* Segundo recorte, mais fraco, do outro lado: com um só, o lado esquerdo do
       cabelo e do ombro perdia a aresta e colava ao fundo. */
    const recorteB = new THREE.DirectionalLight(0xe6f6ff, 0.62);
    recorteB.position.set(-1.4, 2.1, -2.3);
    cena.add(recorteB);
    const enchimento = new THREE.DirectionalLight(0xdfeaff, 0.22);
    enchimento.position.set(2.1, 1.1, 1.9);
    cena.add(enchimento);
    const rosto = new THREE.DirectionalLight(0xfff4e6, 0.28);
    rosto.position.set(0.6, 1.70, 2.2);
    rosto.target.position.set(0, 1.6, 0);
    cena.add(rosto, rosto.target);
    /* Luz de baixo, quente e fraca: sem ela a pele escura fica com as órbitas
       e o queixo a preto chapado. */
    const baixo = new THREE.DirectionalLight(0xffd8b8, 0.18);
    baixo.position.set(0, -0.6, 1.6);
    cena.add(baixo);

    montarAmbiente();

    if (global.ResizeObserver) { observador = new ResizeObserver(redim); observador.observe(el); }
    global.addEventListener('resize', redim);

    carregando = new Promise((ok, falha) => {
      new THREE.GLTFLoader().load('assets/agatha-mpfb-rig.glb', (g) => {
        montarModelo(g.scene);
        requestAnimationFrame(quadro);
        ok(API);
      }, (e) => { if (aoProgresso) aoProgresso(e.loaded, e.total); }, falha);
    });
    return carregando;
  }

  function montarModelo(raiz) {
    modelo = raiz;
    cena.add(modelo);
    /* O export deixou um Icosphere de raio 1 sem material em volta dos pés.
       Não aparece, mas esticava a caixa do modelo de 1,80 m para 2,78 m e a
       câmara enquadrava pela caixa — daí a figura pequena no palco. */
    const sobras = [];
    modelo.traverse((o) => {
      if (o.isBone) ossos[o.name] = o;
      if (o.isMesh || o.isSkinnedMesh) {
        if (/^Icosphere/i.test(o.name) && o.geometry.attributes.position.count < 100) {
          sobras.push(o);
          return;
        }
        malhas.push(o);
        o.frustumCulled = false;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.encoding = THREE.sRGBEncoding; });
      }
    });
    sobras.forEach((o) => o.parent.remove(o));
    modelo.updateMatrixWorld(true);
    afinarMateriais();
    const bb = new THREE.Box3().setFromObject(modelo);
    modelo.userData.altura = bb.max.y - bb.min.y;
    modelo.userData.topo = bb.max.y;

    guardarRepouso();
    calibrarMaos();
    pousar();
    poseBase = capturar();
    aplicarExpressao('neutro');
    pronto = true;
  }

  /* ===================== materiais ===================== */
  /* O GLB é um corpo MakeHuman: tudo é MeshStandardMaterial liso. O que está
     em primeiro plano passa a MeshPhysicalMaterial para ter clearcoat nos
     olhos e sheen no tecido e no cabelo — é o que separa «modelo de jogo» de
     «estúdio». O resto fica standard com pouco ambiente, para não brilhar. */
  function afinarMateriais() {
    malhas.forEach((malha) => {
      const proprio = Array.isArray(malha.material);
      const lista = proprio ? malha.material : [malha.material];
      const novos = lista.map(afinarMaterial);
      malha.material = proprio ? novos : novos[0];
    });
  }

  function afinarMaterial(mat) {
    const nome = mat.name || '';
    const corpo = /Human\.body/.test(nome);
    const roupa = /casualsuit/.test(nome);
    const cabelo = /^Cabelo/.test(nome);
    const olhos = /^Olhos/.test(nome);
    const sapatos = /shoes/.test(nome);
    if (!(corpo || roupa || cabelo || olhos || sapatos)) {
      mat.envMapIntensity = 0.35;
      return mat;
    }
    /* `new MeshPhysicalMaterial().copy(mat)` rebenta no r147: o copy físico lê
       clearcoatNormalScale do material de origem, que um standard não tem.
       Copia-se com o copy do standard (os campos são os mesmos) e acrescentam-
       se só os campos físicos. */
    const fis = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(fis, mat);
    fis.envMapIntensity = corpo ? 0.32 : (olhos ? 0.75 : 0.38);
    if (corpo) {
      fis.roughness = 0.58;
      /* o sebo natural da pele: um brilho largo, não um verniz */
      fis.clearcoat = 0.04;
      fis.clearcoatRoughness = 0.5;
    } else if (cabelo) {
      fis.roughness = 0.7;
      fis.sheen = 0.34;
      fis.sheenRoughness = 0.72;
      fis.sheenColor = new THREE.Color(0.12, 0.10, 0.09);
    } else if (roupa) {
      fis.roughness = 0.9;
      fis.specularIntensity = 0.5;
      fis.sheen = 0.16;
      fis.sheenRoughness = 0.9;
      fis.sheenColor = new THREE.Color(0.18, 0.34, 0.31);
      const nova = recolorirRoupa(fis.map);
      if (nova) fis.map = nova;
    } else if (olhos) {
      fis.roughness = 0.12;
      fis.clearcoat = 1;
      fis.clearcoatRoughness = 0.08;
    } else if (sapatos) {
      fis.roughness = 0.4;
      fis.clearcoat = 0.2;
      fis.clearcoatRoughness = 0.4;
    }
    fis.needsUpdate = true;
    return fis;
  }

  /* A camisola e as calças partilham uma folha de textura: verde de um lado,
     ganga do outro. Recolore-se por faixa de matiz — o verde vira o verde-
     azulado profundo do guarda-roupa de referência e a ganga vira calça
     escura — mantendo as dobras, as costuras e a risca branca. */
  function recolorirRoupa(mapa) {
    const img = mapa && mapa.image;
    if (!img || !img.width) return null;
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    let dados;
    try { dados = g.getImageData(0, 0, cv.width, cv.height); } catch (e) { return null; }
    const d = dados.data;
    /* A ganga ocupa a metade de baixo da folha. O desgaste branco fica branco
       depois de escurecer o azul e lia-se como pingos de tinta; só nessa
       metade, os claros sem matiz passam a um tom de ganga escura. */
    const linhaGanga = Math.round(cv.height * 0.45);
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const r = d[i] / 255, v = d[i + 1] / 255, b = d[i + 2] / 255;
      const max = Math.max(r, v, b), min = Math.min(r, v, b);
      const dd = max - min;
      const l = (max + min) / 2;
      const y = (i / 4 / cv.width) | 0;
      if (y >= linhaGanga && l > 0.66) {
        d[i] = 58; d[i + 1] = 64; d[i + 2] = 66;
        continue;
      }
      if (dd < 0.03) continue;
      let h;
      if (max === r) h = ((v - b) / dd + (v < b ? 6 : 0)) / 6;
      else if (max === v) h = ((b - r) / dd + 2) / 6;
      else h = ((r - v) / dd + 4) / 6;
      const graus = h * 360;
      const s = dd / ((1 - Math.abs(2 * l - 1)) || 1);
      let H, S, L;
      if (graus >= 85 && graus <= 185) {
        H = 176 / 360; S = Math.min(1, s) * 0.72; L = l * 0.82;
      } else if (graus > 185 && graus <= 268) {
        H = 205 / 360; S = s * 0.22; L = l * 0.30;
      } else continue;
      const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
      const p = 2 * L - q;
      const tom = (t) => {
        t = (t + 1) % 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      d[i] = Math.round(tom(H + 1 / 3) * 255);
      d[i + 1] = Math.round(tom(H) * 255);
      d[i + 2] = Math.round(tom(H - 1 / 3) * 255);
    }
    g.putImageData(dados, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.flipY = mapa.flipY;
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = mapa.wrapS;
    tex.wrapT = mapa.wrapT;
    tex.anisotropy = mapa.anisotropy;
    tex.needsUpdate = true;
    return tex;
  }

  /* ===================== pose ===================== */
  function guardarRepouso() {
    repousoOssos = {};
    Object.keys(ossos).forEach((k) => { repousoOssos[k] = ossos[k].quaternion.clone(); });
  }

  function repor() {
    Object.keys(ossos).forEach((k) => { ossos[k].quaternion.copy(repousoOssos[k]); });
    modelo.updateMatrixWorld(true);
  }

  function capturar() {
    const o = {};
    Object.keys(ossos).forEach((k) => { o[k] = ossos[k].quaternion.clone(); });
    return o;
  }

  /* braços caídos: a palma virada para a coxa é o repouso real; os braços
     param de aparecer pronados com as costas da mão à frente */
  const REP = {
    D: { mao: [-0.285, 0.962, 0.17], forma: 'relax', palma: [0.95, 0, -0.3] },
    E: { mao: [0.285, 0.962, 0.17], forma: 'relax', palma: [-0.95, 0, -0.3] },
  };

  function pousar() {
    EXTERNO = null;
    repor();
    aplicarMao('D', REP.D.forma);
    aplicarMao('E', REP.E.forma);
    ikBraco('D', V(...REP.D.mao), V(-0.38, -1.6, 0.16));
    ikBraco('E', V(...REP.E.mao), V(0.38, -1.6, 0.16));
    if (MAO.D) orientarPalma('D', REP.D.palma);
    if (MAO.E) orientarPalma('E', REP.E.palma);
  }

  function ikBraco(lado, alvo, polegar) {
    const L = BRACO[lado];
    const ombro = ossos['J_Bip_' + L + '_UpperArm'];
    const antebraco = ossos['J_Bip_' + L + '_LowerArm'];
    const mao = ossos['J_Bip_' + L + '_Hand'];
    if (!ombro || !antebraco || !mao) return;

    const S = posMundo(ombro), E = posMundo(antebraco), M = posMundo(mao);
    const L1 = Math.max(0.02, S.distanceTo(E)), L2 = Math.max(0.02, E.distanceTo(M));
    const paraAlvo = alvo.clone().sub(S);
    const d = lim(paraAlvo.length(), Math.abs(L1 - L2) + 0.02, (L1 + L2) * 0.995);
    const dir = paraAlvo.normalize();

    const cos = lim((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const ang = Math.acos(cos);

    let pol = polegar.clone().sub(dir.clone().multiplyScalar(polegar.dot(dir)));
    if (pol.lengthSq() < 1e-6) pol.set(0, -1, 0);
    pol.normalize();

    const cotovelo = S.clone()
      .add(dir.clone().multiplyScalar(Math.cos(ang) * L1))
      .add(pol.clone().multiplyScalar(Math.sin(ang) * L1));

    rodarMundo(ombro, qEntre(E.clone().sub(S), cotovelo.clone().sub(S)));
    const E2 = posMundo(antebraco), M2 = posMundo(mao);
    const alvoMao = S.clone().add(dir.clone().multiplyScalar(d));
    rodarMundo(antebraco, qEntre(M2.clone().sub(E2), alvoMao.clone().sub(E2)));
  }

  /* Braços acima do ombro rasgam a manga: a clavícula acompanha parte do arco. */
  function ajudOmbro(lado, alvo) {
    const L = BRACO[lado];
    const clav = ossos['J_Bip_' + L + '_Shoulder'];
    const ombro = ossos['J_Bip_' + L + '_UpperArm'];
    const antebraco = ossos['J_Bip_' + L + '_LowerArm'];
    if (!clav || !ombro || !antebraco) return;
    const S = posMundo(ombro);
    const atual = posMundo(antebraco).sub(S);
    const quer = alvo.clone().sub(S);
    const ang = atual.angleTo(quer);
    if (ang < 0.6) return;
    const eixoR = new THREE.Vector3().crossVectors(atual, quer);
    if (eixoR.lengthSq() < 1e-6) return;
    eixoR.normalize();
    rodarMundo(clav, new THREE.Quaternion().setFromAxisAngle(eixoR, Math.min(0.42, (ang - 0.6) * 0.32)));
  }

  const _vA = V(0, 0, 0), _vB = V(0, 0, 0), _vC = V(0, 0, 0);

  /* Perpendicular estável: cruzar com o eixo de menor componente dá sempre o
     maior produto vectorial (≥ 0,816) — nunca normaliza um vector quase nulo. */
  function perpendicular(v) {
    const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
    const alt = (ax <= ay && ax <= az) ? AX : (ay <= az ? AY : AZ);
    return _vC.crossVectors(v, alt).normalize();
  }

  function qEntre(a, b) {
    const na = _vA.copy(a).normalize(), nb = _vB.copy(b).normalize();
    if (na.dot(nb) < -0.99999) {
      return new THREE.Quaternion().setFromAxisAngle(perpendicular(na), Math.PI);
    }
    return new THREE.Quaternion().setFromUnitVectors(na, nb);
  }

  /* ===================== dedos ===================== */
  const DEDOS = [['Index', 'i', 0], ['Middle', 'm', 1], ['Ring', 'r', 2], ['Little', 'p', 3], ['Thumb', 't', 4]];

  /* Medido no rig reconstruído (tools/melhorar-rig.py e sonda em Blender):
     · o Z local de todos os ossos da mão é a normal da palma, nos dois lados;
     · +X local dobra para a palma, nos dois lados — sem sinal de lado;
     · −Z local abre o leque e +Z fecha, nos dois lados;
     · o bind já traz o polegar aberto a 42° no plano da palma. */
  const POLEGAR_BIND = 42; /* t[0] é o leque absoluto: 42 = bind, 82 = forma L */
  /* O desenho SVG exagera o MCP (angEfetivo = mcp * 1.42) para se ler em 2D.
     No rig vale o ângulo real, e os dedos do MPFB são longos: sem este ganho
     o punho fecha a 68° e as pontas ficam ~14 mm acima da palma. */
  const GANHO_MCP = 1.2;
  const MCP_MAX = 95;

  function aplicarMao(lado, forma) {
    const L = BRACO[lado];
    const f = (global.FORMAS_MAO && global.FORMAS_MAO[forma]) || (global.FORMAS_MAO && global.FORMAS_MAO.abre);
    if (!f) return;
    DEDOS.forEach(([nome, chave, iEsp]) => {
      /* repõe só os três ossos deste dedo antes de os rodar: assim aplicarMao
         é idempotente e chamá-la duas vezes (API pública, fora da pipeline)
         não enrola os dedos. */
      for (let j = 1; j <= 3; j++) {
        const bn = 'J_Bip_' + L + '_' + nome + j;
        if (ossos[bn] && repousoOssos[bn]) ossos[bn].quaternion.copy(repousoOssos[bn]);
      }
      const ang = f[chave];
      if (nome === 'Thumb') {
        const abertura = ang ? ang[0] : POLEGAR_BIND;
        const flexao = ang ? ang[1] : 0;
        const enrolar = ang ? ang[2] : 0;
        const b1 = ossos['J_Bip_' + L + '_Thumb1'];
        const b2 = ossos['J_Bip_' + L + '_Thumb2'];
        const b3 = ossos['J_Bip_' + L + '_Thumb3'];

        /* 3-DOF da articulação em sela CMC do polegar:
           - Leque radial / adução palmar em AZ: abre para L/Y ou aduz para B/E
           - Pronação axial de oposição em AY: roda a polpa para encarar os dedos
           - Flexão palmar em AX: varre ligeiramente para dentro da palma */
        const oppRatio = lim(flexao / 48, 0, 1);
        const sinalLado = lado === 'D' ? -1 : 1;
        const pronacao = oppRatio * 42 * sinalLado;

        if (b1) {
          b1.quaternion.multiply(eixo(AZ, (abertura - POLEGAR_BIND) * -1 + flexao * 0.28));
          b1.quaternion.multiply(eixo(AY, pronacao));
          b1.quaternion.multiply(eixo(AX, flexao * 0.12));
        }
        if (b2) b2.quaternion.multiply(eixo(AX, flexao * 0.38 + enrolar * 0.12));
        if (b3) b3.quaternion.multiply(eixo(AX, flexao * 0.25 + enrolar * 0.50));
      } else if (ang) {
        for (let j = 0; j < 3; j++) {
          const b = ossos['J_Bip_' + L + '_' + nome + (j + 1)];
          if (!b) continue;
          let a;
          if (j === 0) {
            a = Math.min(Math.max(2.5, ang[0] * GANHO_MCP), MCP_MAX);
          } else if (j === 1) {
            a = Math.max(2.0, ang[1]);
          } else {
            const dipCoupled = ang[1] > 20 ? Math.max(ang[2], ang[1] * 0.65) : ang[2];
            a = Math.max(2.0, dipCoupled);
          }
          b.quaternion.multiply(eixo(AX, a));
        }
      }
      if (f.esp && iEsp < 4) {
        const b = ossos['J_Bip_' + L + '_' + nome + '1'];
        if (b) {
          const mcpAng = ang ? ang[0] : 0;
          const flexFactor = lim(mcpAng / 80, 0, 1);
          const atten = 1.0 - 0.85 * flexFactor;
          b.quaternion.multiply(eixo(AZ, -f.esp[iEsp] * atten));
        }
      }
    });
    modelo.updateMatrixWorld(true);
  }

  function rodarMao(lado, rot) {
    const mao = ossos['J_Bip_' + BRACO[lado] + '_Hand'];
    if (!mao || !rot) return;
    rodarMundo(mao, eixo(AX, rot[0] || 0));
    rodarMundo(mao, eixo(AY, (rot[1] || 0) * (lado === 'D' ? 1 : -1)));
    rodarMundo(mao, eixo(AZ, (rot[2] || 0) * (lado === 'D' ? 1 : -1)));
  }

  /* Calibrado no repouso: o rig reconstruído tem o Z local do Hand igual à
     normal da palma e um osso de torção entre o cotovelo e o pulso. */
  const MAO = {};

  function calibrarMaos() {
    repor();
    ['D', 'E'].forEach((lado) => {
      const L = BRACO[lado];
      const mao = ossos['J_Bip_' + L + '_Hand'];
      const ant = ossos['J_Bip_' + L + '_LowerArm'];
      if (!mao || !ant) return;
      const qf = ant.getWorldQuaternion(new THREE.Quaternion());
      MAO[lado] = {
        palma: V(0, 0, 1),
        /* eixo do antebraço (cotovelo→pulso) no referencial do antebraço */
        eixo: posMundo(mao).sub(posMundo(ant)).applyQuaternion(qf.clone().invert()).normalize(),
        /* repouso da mão relativo ao antebraço */
        repouso: repousoOssos['J_Bip_' + L + '_Hand'].clone(),
      };
    });
  }

  /* A mão tem dois gestos próprios: flexão/extensão do punho, que muda o ângulo
     entre a palma e o antebraço, e pronação, que gira o antebraço no seu eixo
     (não desloca o pulso) e roda a palma em torno dele sem mudar esse ângulo.
     Por isso resolve-se primeiro a flexão até à inclinação do alvo e só depois
     a pronação até ao azimute. A flexão passa-se no eixo perpendicular ao
     antebraço e à palma — o eixo em que uma mão dobra mesmo. */
  function orientarPalma(lado, alvo) {
    const L = BRACO[lado];
    const mao = ossos['J_Bip_' + L + '_Hand'];
    const antebraco = ossos['J_Bip_' + L + '_LowerArm'];
    const torcao = ossos['J_Bip_' + L + '_LowerArm_twist'];
    const cal = MAO[lado];
    if (!mao || !antebraco || !alvo || !cal) return;

    const quer = V(alvo[0], alvo[1], alvo[2]).normalize();

    /* o alvo da palma manda: repõe a mão no repouso relativo ao antebraço */
    mao.quaternion.copy(cal.repouso);
    modelo.updateMatrixWorld(true);

    const qf = antebraco.getWorldQuaternion(new THREE.Quaternion());
    const eixoF = cal.eixo.clone().applyQuaternion(qf).normalize();
    const P0 = cal.palma.clone().applyQuaternion(mao.getWorldQuaternion(new THREE.Quaternion())).normalize();

    const alfa0 = Math.acos(lim(P0.dot(eixoF), -1, 1));
    const beta = Math.acos(lim(quer.dot(eixoF), -1, 1));
    let theta = alfa0 - beta;
    const PUNHO = 1.13; /* ~65° de flexão; mais do que isso não é um punho */
    if (Math.abs(theta) > PUNHO) theta = Math.sign(theta) * PUNHO;

    const eixoFlex = new THREE.Vector3().crossVectors(P0, eixoF);
    if (eixoFlex.lengthSq() < 1e-8) return;
    eixoFlex.normalize();
    if (Math.abs(theta) > 1e-4) rodarMundo(mao, new THREE.Quaternion().setFromAxisAngle(eixoFlex, theta));

    /* palma já no ângulo do alvo: roda o antebraço no seu eixo até ao azimute */
    const qh = mao.getWorldQuaternion(new THREE.Quaternion());
    const P1 = cal.palma.clone().applyQuaternion(qh).normalize();
    const p1 = P1.clone().addScaledVector(eixoF, -P1.dot(eixoF));
    const t1 = quer.clone().addScaledVector(eixoF, -quer.dot(eixoF));
    if (p1.lengthSq() < 1e-6 || t1.lengthSq() < 1e-6) return;
    p1.normalize(); t1.normalize();
    let phi = Math.atan2(new THREE.Vector3().crossVectors(p1, t1).dot(eixoF), p1.dot(t1));
    /* o repouso do modelo já tem as palmas viradas para trás; o antebraço roda
       ~150° no total, por isso o limite é largo */
    phi = lim(phi, -2.4, 2.4);

    /* Distribuição anatómica da pronação do antebraço:
       75% da torção no osso de torção intermediário (LowerArm_twist) que deforma
       a massa muscular do antebraço, e a rotação total (100%) no Hand / pulso.
       Isto evita o colapso tipo "candy-wrapper" da malha do pulso e do cotovelo. */
    if (torcao) rodarMundo(torcao, new THREE.Quaternion().setFromAxisAngle(eixoF, phi * 0.75));
    rodarMundo(mao, new THREE.Quaternion().setFromAxisAngle(eixoF, phi));
  }

  /* ===================== expressão ===================== */
  const MORFOS = ['olho_fecha_L', 'olho_fecha_R', 'sobrancelha_sobe_L', 'sobrancelha_sobe_R', 'boca_abre'];
  const EXPR = {
    neutro: {},
    /* sorriso curto: sobrancelhas sobem e a boca entreabre de leve */
    alegre: { sobrancelha_sobe_L: 0.35, sobrancelha_sobe_R: 0.35, boca_abre: 0.12 },
    serio: { boca_abre: 0 },
    surpresa: { boca_abre: 0.55, sobrancelha_sobe_L: 0.8, sobrancelha_sobe_R: 0.8 },
    pensa: { sobrancelha_sobe_L: 0.25 },
  };

  function aplicarExpressao(nome) {
    const alvo = EXPR[nome] || EXPR.neutro;
    malhas.forEach((m) => {
      const d = m.morphTargetDictionary;
      if (!d) return;
      MORFOS.forEach((k) => {
        if (d[k] !== undefined) m.morphTargetInfluences[d[k]] = alvo[k] || 0;
      });
    });
  }

  /* Sinais de duas mãos: copiar a cadeia direita espelhada no plano YZ evita
     acertar à mão os eixos locais da mão esquerda, que são invertidos. */
  const CADEIA = [];
  ['Shoulder', 'UpperArm', 'LowerArm', 'Hand'].forEach((n) => CADEIA.push(n));
  DEDOS.forEach(([nome]) => { for (let j = 1; j <= 3; j++) CADEIA.push(nome + j); });

  function espelharBraco() {
    const qw = new THREE.Quaternion(), qp = new THREE.Quaternion();
    CADEIA.forEach((n) => {
      const d = ossos['J_Bip_R_' + n], e = ossos['J_Bip_L_' + n];
      if (!d || !e || !e.parent) return;
      d.getWorldQuaternion(qw);
      qp.set(qw.x, -qw.y, -qw.z, qw.w).normalize();
      e.parent.getWorldQuaternion(qw);
      e.quaternion.copy(qw.invert().multiply(qp));
      e.updateMatrixWorld(true);
    });
    modelo.updateMatrixWorld(true);
  }

  /* ===================== pose de sinal ===================== */
  /* orientarPalma resolve flexão e pronação — dois graus de liberdade. Falta o
     terceiro: rodar a mão em torno da própria normal da palma, que é o que
     decide para onde apontam os dedos com a palma já assente. Sem isto a mão
     saía sempre de cutelo, com os dedos em pé. */
  function girarPalma(lado, ang) {
    const mao = ossos['J_Bip_' + BRACO[lado] + '_Hand'];
    if (!mao || !ang) return;
    const n = new THREE.Vector3(0, 0, 1).transformDirection(mao.matrixWorld);
    rodarMundo(mao, new THREE.Quaternion().setFromAxisAngle(n, ang * G));
  }

  function poseParaQuats(p) {
    repor();
    const D = p.D || {}, E = p.E || {};
    /* O tronco inclina-se ANTES de resolver os braços: o alvo está em
       coordenadas do mundo, por isso inclinar primeiro só aproxima o ombro
       do alvo — inclinar depois seria só rodar a pose já resolvida. */
    if (p.corpo) {
      const c = ossos['J_Bip_C_Spine'];
      rodarMundo(c, eixo(AX, p.corpo[0] || 0));
      rodarMundo(c, eixo(AY, p.corpo[1] || 0));
    }
    aplicarMao('D', D.forma || 'curva');
    aplicarMao('E', E.forma || 'curva');
    const alvoD = V(...(D.mao || REP.D.mao)), alvoE = V(...(E.mao || REP.E.mao));
    ajudOmbro('D', alvoD);
    ikBraco('D', alvoD, V(-0.55, -1.6, D.polar || 0.25));
    /* Com alvo de palma, orientarPalma repõe a mão e resolve-a toda a partir
       do alvo: rodarMao antes disso era trabalho perdido (e lia-se como se o
       pulso da notação fosse aplicado, quando nunca era). Sem palma, vale.
       O `rolar` roda a mão em torno da PRÓPRIA normal da palma: rodá-la em Z
       do mundo, como antes, desfazia a palma que se tinha acabado de assentar
       — era isso que punha a mão da parceira de cutelo. */
    if (D.palma) { orientarPalma('D', D.palma); if (D.rolar) girarPalma('D', D.rolar); }
    else rodarMao('D', D.pulso);
    if (p.sim) {
      espelharBraco();
    } else {
      ajudOmbro('E', alvoE);
      ikBraco('E', alvoE, V(0.55, -1.6, E.polar || 0.25));
      if (E.palma) { orientarPalma('E', E.palma); if (E.rolar) girarPalma('E', E.rolar); }
      else rodarMao('E', E.pulso);
    }
    if (p.cabeca) {
      const c = ossos['J_Bip_C_Head'];
      rodarMundo(c, eixo(AY, p.cabeca[1] || 0));
      rodarMundo(c, eixo(AX, p.cabeca[0] || 0));
      rodarMundo(c, eixo(AZ, p.cabeca[2] || 0));
    }
    return { quats: capturar(), expr: p.expr || 'neutro' };
  }

  /* ===================== sequência ===================== */
  const FILA = { passos: null, i: 0, t: 0, ativo: false, aoFim: null, base: null, alvo: null, mix: 0, mixDur: 0.18 };

  function tocarSequencia(passos, aoFim) {
    if (!pronto || !passos || !passos.length) return;
    EXTERNO = null;
    FILA.passos = passos;
    FILA.i = 0;
    FILA.t = 0;
    FILA.ativo = true;
    FILA.aoFim = aoFim || null;
    FILA.base = capturar();
    FILA.alvo = poseParaQuats(passos[0].pose);
    if (FILA.base && FILA.alvo.quats) {
      Object.keys(FILA.alvo.quats).forEach((bn) => {
        if (FILA.base[bn] && FILA.alvo.quats[bn].dot(FILA.base[bn]) < 0) {
          FILA.alvo.quats[bn].negate();
        }
      });
    }
    FILA.mix = 0;
    FILA.mixDur = passos[0].mistura === 0 ? 0.001 : (passos[0].mistura || 0.18);
    aplicarExpressao(FILA.alvo.expr);
  }

  function pararSequencia() {
    FILA.ativo = false;
    FILA.passos = null;
  }

  /* congela a pose no ecrã (o repouso passa a ser esta) */
  function congelar() {
    FILA.ativo = false;
    FILA.passos = null;
    EXTERNO = null;
    poseBase = capturar();
  }

  /* ---------- poses pré-calculadas, conduzidas pelo relógio da app ---------- */
  let EXTERNO = null;

  function prepararPoses(passos) {
    const preparadas = passos.map((p) => {
      const alvo = poseParaQuats(p.pose);
      return {
        quats: alvo.quats, expr: alvo.expr || 'neutro',
        dur: Math.max(0.05, p.dur || 0.3), mistura: p.mistura || 0.16,
      };
    });
    /* Verificação de caminho mais curto na hiperesfera S³ (anti-flip 180°):
       Garante que poses consecutivas partilham o mesmo hemisfério de quaterniões */
    for (let k = 1; k < preparadas.length; k++) {
      const prevQ = preparadas[k - 1].quats;
      const currQ = preparadas[k].quats;
      if (prevQ && currQ) {
        Object.keys(currQ).forEach((bn) => {
          if (prevQ[bn] && currQ[bn].dot(prevQ[bn]) < 0) {
            currQ[bn].negate();
          }
        });
      }
    }
    return preparadas;
  }

  function mostrar(poses, tempo) {
    if (!pronto || !poses || !poses.length) return 0;
    FILA.ativo = false;
    EXTERNO = { poses, tempo };
    let i = 0, t = Math.max(0, tempo || 0);
    while (i < poses.length - 1 && t >= poses[i].dur) { t -= poses[i].dur; i++; }
    const p = poses[i];
    const prev = i > 0 ? poses[i - 1].quats : poseBase;
    misturarQuats(prev, p.quats, suave(lim(t / p.mistura, 0, 1)));
    if (i !== ULTIMO_PASSO || p.expr !== ULTIMA_EXPR) {
      ULTIMO_PASSO = i; ULTIMA_EXPR = p.expr;
      aplicarExpressao(p.expr);
    }
    /* vida por cima da pose */
    rodarMundo(ossos['J_Bip_C_Chest'], eixo(AX, Math.sin(relogio * 1.4) * 0.9));
    rodarMundo(ossos['J_Bip_C_Head'], eixo(AY, Math.sin(relogio * 0.55) * 1.2));
    return i;
  }
  let ULTIMO_PASSO = -1, ULTIMA_EXPR = '';

  function misturarQuats(base, alvo, k) {
    Object.keys(alvo).forEach((nome) => {
      const b = ossos[nome];
      if (!b) return;
      if (base && base[nome]) {
        const targetQ = alvo[nome];
        if (base[nome].dot(targetQ) < 0) targetQ.negate();
        b.quaternion.copy(base[nome]).slerp(targetQ, k);
      } else {
        b.quaternion.copy(alvo[nome]);
      }
    });
    modelo.updateMatrixWorld(true);
  }

  function avancar(dt) {
    if (!FILA.ativo) return;
    FILA.t += dt;
    const p = FILA.passos[FILA.i];
    /* Interpolação suave contínua: amortecimento exponencial (dampQuaternion)
       com taxa proporcional à mistura pedida pelo passo, eliminando o congelamento
       abrupto e descontinuidades de aceleração entre passos. */
    const lambda = 3.2 / Math.max(0.04, FILA.mixDur);
    const factor = 1.0 - Math.exp(-lambda * dt);
    Object.keys(FILA.alvo.quats).forEach((nome) => {
      const b = ossos[nome];
      if (!b) return;
      const targetQ = FILA.alvo.quats[nome];
      if (b.quaternion.dot(targetQ) < 0) targetQ.negate();
      b.quaternion.slerp(targetQ, factor);
    });
    modelo.updateMatrixWorld(true);

    if (FILA.t >= p.dur) {
      FILA.t -= p.dur;
      FILA.i++;
      if (FILA.i >= FILA.passos.length) {
        FILA.ativo = false;
        if (FILA.aoFim) FILA.aoFim();
        return;
      }
      FILA.alvo = poseParaQuats(FILA.passos[FILA.i].pose);
      if (FILA.alvo && FILA.alvo.quats) {
        Object.keys(FILA.alvo.quats).forEach((bn) => {
          const b = ossos[bn];
          if (b && FILA.alvo.quats[bn].dot(b.quaternion) < 0) {
            FILA.alvo.quats[bn].negate();
          }
        });
      }
      const prox = FILA.passos[FILA.i];
      FILA.mixDur = prox.mistura === 0 ? 0.001 : (prox.mistura || 0.16);
      aplicarExpressao(FILA.alvo.expr);
    }
  }

  /* ===================== enquadramento ===================== */
  /* `folga` > 1 afasta a câmara do alvo: o painel 4:5 é mais estreito do que o
     palco da página e os braços abertos ficavam fora do quadro. */
  function enquadrar(tipo, folga) {
    if (!modelo) return;
    const h = modelo.userData.altura || 1.75;
    const f = folga || 1;
    const alvo = new THREE.Vector3();
    if (tipo === 'corpo') {
      cam.fov = 30;
      cam.position.set(0.7, h * 0.55, h * 2.0);
      alvo.set(0, h * 0.5, 0);
    } else if (tipo === 'joelhos') {
      /* painel de 100dvh: nesta malha o joelho fica a 0,515 m e o cabelo acaba
         a ~1,79 m. O quadro cobre 2,03 m (até 1,98 m) e põe o joelho a 72% da
         altura do palco. A faixa de chips e botões tem 126 px fixos, por isso o
         palco baixo perde uma fatia maior dela: 13% a 1080p, 21% a 720p — o
         joelho fica acima da faixa nos dois. */
      cam.fov = 34;
      cam.position.set(0.26, h * 0.536, h * 1.853);
      alvo.set(0, h * 0.536, 0);
    } else {
      /* plano de sinalização: das mãos em repouso (~0,80 m) a acima da cabeça
         (~1,96 m); enquadrar só a cabeça aos ombros cortava os dedos caídos.
         Com fov 34 e 1,93 m de distância o quadro cobre 1,18 m: centro em
         0,749h = 1,31 m num corpo de 1,75 m, ou seja 0,72 a 1,90 m. */
      cam.fov = 34;
      cam.position.set(0.30, h * 0.749, h * 1.114);
      alvo.set(0, h * 0.749, 0);
    }
    if (f !== 1) cam.position.sub(alvo).multiplyScalar(f).add(alvo);
    cam.lookAt(alvo);
    cam.updateProjectionMatrix();
  }

  /* ===================== quadro ===================== */
  function quadro(agora) {
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    relogio += dt;
    if (pronto) {
      if (FILA.ativo) avancar(dt);
      else if (EXTERNO) mostrar(EXTERNO.poses, EXTERNO.tempo);
      else if (poseBase) {
        misturarQuats(null, poseBase, 1);
        const peito = ossos['J_Bip_C_Chest'];
        rodarMundo(peito, eixo(AX, Math.sin(relogio * 1.4) * 0.9));
        rodarMundo(ossos['J_Bip_C_Head'], eixo(AY, Math.sin(relogio * 0.55) * 2.4));
      }
      proximoPiscar -= dt;
      if (proximoPiscar <= 0) { piscar = 0.15; proximoPiscar = 2.6 + Math.random() * 3.4; }
      if (piscar > 0) {
        piscar -= dt;
        const v = piscar > 0.07 ? 1 : piscar / 0.07;
        malhas.forEach((m) => {
          const d = m.morphTargetDictionary;
          if (!d) return;
          if (d.olho_fecha_L !== undefined) m.morphTargetInfluences[d.olho_fecha_L] = v;
          if (d.olho_fecha_R !== undefined) m.morphTargetInfluences[d.olho_fecha_R] = v;
        });
      }
      renderer.render(cena, cam);
    }
    requestAnimationFrame(quadro);
  }

  const API = {
    init, enquadrar, tocarSequencia, pararSequencia, congelar, poseParaQuats,
    prepararPoses, mostrar,
    aplicarExpressao, aplicarMao, ikBraco, rodarMao, orientarPalma, repor, capturar, pousar,
    get ossos() { return ossos; },
    get pronto() { return pronto; },
    get cena() { return cena; },
    get cam() { return cam; },
    get modelo() { return modelo; },
    THREE,
  };

  global.AVATAR = API;
})(window);
