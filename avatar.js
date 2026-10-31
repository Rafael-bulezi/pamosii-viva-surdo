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
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, global.devicePixelRatio || 1));
    renderer.setSize(el.clientWidth || 640, el.clientHeight || 360);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    cena = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(o.fov || 30, (el.clientWidth || 16) / (el.clientHeight || 9), 0.05, 30);

    /* Estúdio claro: a luz de recorte (rim) é o que separa o cabelo e os ombros
       do fundo branco; o contraluz quente anterior era fraco demais para isso. */
    cena.add(new THREE.HemisphereLight(0xffffff, 0xc4d0bd, 0.42));
    const sol = new THREE.DirectionalLight(0xfff8ee, 1.35);
    sol.position.set(-1.7, 2.9, 2.5);
    cena.add(sol);
    const recorte = new THREE.DirectionalLight(0xeaf4ff, 0.85);
    recorte.position.set(1.3, 2.4, -2.3);
    cena.add(recorte);
    /* Segundo recorte, mais fraco, do outro lado: com um só, o lado esquerdo do
       cabelo e do ombro perdia a aresta e colava ao fundo claro. */
    const recorteB = new THREE.DirectionalLight(0xeaf4ff, 0.45);
    recorteB.position.set(-1.4, 2.1, -2.3);
    cena.add(recorteB);
    const enchimento = new THREE.DirectionalLight(0xdfeaff, 0.38);
    enchimento.position.set(2.1, 1.1, 1.9);
    cena.add(enchimento);
    const rosto = new THREE.DirectionalLight(0xfff4e6, 0.34);
    rosto.position.set(0.6, 1.70, 2.2);
    rosto.target.position.set(0, 1.6, 0);
    cena.add(rosto, rosto.target);

    if (global.ResizeObserver) { observador = new ResizeObserver(redim); observador.observe(el); }
    global.addEventListener('resize', redim);

    carregando = new Promise((ok, falha) => {
      new THREE.GLTFLoader().load('assets/agatha-mpfb-rig.glb', (g) => {
        montarModelo(g.scene);
        requestAnimationFrame(quadro);
        ok(API);
      }, undefined, falha);
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
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.encoding = THREE.sRGBEncoding; });
      }
    });
    sobras.forEach((o) => o.parent.remove(o));
    modelo.updateMatrixWorld(true);
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
        if (b1) {
          /* leque: o bind já está a 42°, e 1° de Z local é 1° de leque */
          b1.quaternion.multiply(eixo(AZ, (abertura - POLEGAR_BIND) * -1));
          /* oposição: o metacarpo fecha para o indicador dentro do plano da palma.
             Fora do plano vai pouco — medido na sonda, 0.45 de flexão aqui punha a
             ponta do polegar 42 mm à frente da palma em B e 50 mm em E; o polegar
             saía como um espeto em vez de deitar sobre os dedos. */
          b1.quaternion.multiply(eixo(AZ, flexao * 0.30));
          b1.quaternion.multiply(eixo(AX, flexao * 0.16));
        }
        if (b2) b2.quaternion.multiply(eixo(AX, flexao * 0.45 + enrolar * 0.10));
        if (b3) b3.quaternion.multiply(eixo(AX, flexao * 0.30 + enrolar * 0.55));
      } else if (ang) {
        for (let j = 0; j < 3; j++) {
          const b = ossos['J_Bip_' + L + '_' + nome + (j + 1)];
          if (!b) continue;
          const a = j === 0 ? Math.min(ang[0] * GANHO_MCP, MCP_MAX) : ang[j];
          b.quaternion.multiply(eixo(AX, a));
        }
      }
      if (f.esp && iEsp < 4) {
        const b = ossos['J_Bip_' + L + '_' + nome + '1'];
        if (b) b.quaternion.multiply(eixo(AZ, -f.esp[iEsp]));
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

    /* a pronação é do antebraço: roda o osso de torção (que leva a pele) e a mão
       juntos. Rodar o LowerArm inteiro torcia também a pele do cotovelo. */
    const qPron = new THREE.Quaternion().setFromAxisAngle(eixoF, phi);
    if (torcao) rodarMundo(torcao, qPron);
    rodarMundo(mao, qPron);
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
  function poseParaQuats(p) {
    repor();
    const D = p.D || {}, E = p.E || {};
    aplicarMao('D', D.forma || 'curva');
    aplicarMao('E', E.forma || 'curva');
    const alvoD = V(...(D.mao || REP.D.mao)), alvoE = V(...(E.mao || REP.E.mao));
    ajudOmbro('D', alvoD);
    ikBraco('D', alvoD, V(-0.55, -1.6, D.polar || 0.25));
    /* Com alvo de palma, orientarPalma repõe a mão e resolve-a toda a partir
       do alvo: rodarMao antes disso era trabalho perdido (e lia-se como se o
       pulso da notação fosse aplicado, quando nunca era). Sem palma, vale. */
    if (D.palma) orientarPalma('D', D.palma);
    else rodarMao('D', D.pulso);
    if (p.sim) {
      espelharBraco();
    } else {
      ajudOmbro('E', alvoE);
      ikBraco('E', alvoE, V(0.55, -1.6, E.polar || 0.25));
      if (E.palma) orientarPalma('E', E.palma);
      else rodarMao('E', E.pulso);
    }
    if (p.cabeca) {
      const c = ossos['J_Bip_C_Head'];
      rodarMundo(c, eixo(AY, p.cabeca[1] || 0));
      rodarMundo(c, eixo(AX, p.cabeca[0] || 0));
      rodarMundo(c, eixo(AZ, p.cabeca[2] || 0));
    }
    if (p.corpo) {
      const c = ossos['J_Bip_C_Spine'];
      rodarMundo(c, eixo(AY, p.corpo[1] || 0));
      rodarMundo(c, eixo(AX, p.corpo[0] || 0));
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
    return passos.map((p) => {
      const alvo = poseParaQuats(p.pose);
      return {
        quats: alvo.quats, expr: alvo.expr || 'neutro',
        dur: Math.max(0.05, p.dur || 0.3), mistura: p.mistura || 0.16,
      };
    });
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
      if (base && base[nome]) b.quaternion.copy(base[nome]).slerp(alvo[nome], k);
      else b.quaternion.copy(alvo[nome]);
    });
    modelo.updateMatrixWorld(true);
  }

  function avancar(dt) {
    if (!FILA.ativo) return;
    FILA.t += dt;
    FILA.mix = lim(FILA.mix + dt / FILA.mixDur, 0, 1);
    misturarQuats(FILA.base, FILA.alvo.quats, suave(FILA.mix));
    const p = FILA.passos[FILA.i];
    if (FILA.t >= p.dur) {
      FILA.t -= p.dur;
      FILA.i++;
      if (FILA.i >= FILA.passos.length) {
        FILA.ativo = false;
        if (FILA.aoFim) FILA.aoFim();
        return;
      }
      FILA.base = capturar();
      FILA.alvo = poseParaQuats(FILA.passos[FILA.i].pose);
      FILA.mix = 0;
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
