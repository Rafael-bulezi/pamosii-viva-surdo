/* ============================================================================
   AVATAR — a sinalizadora em 3D (three.js + GLB com 124 ossos).
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

  function rodarMundo(osso, delta) {
    const qp = new THREE.Quaternion();
    osso.parent.getWorldQuaternion(qp);
    osso.quaternion.premultiply(qp.clone().invert().multiply(delta).multiply(qp));
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
    renderer.toneMappingExposure = 1.08;
    renderer.domElement.style.display = 'block';
    el.appendChild(renderer.domElement);

    cena = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(o.fov || 30, (el.clientWidth || 16) / (el.clientHeight || 9), 0.05, 30);

    cena.add(new THREE.HemisphereLight(0xffffff, 0xb9c6b4, 1.0));
    const sol = new THREE.DirectionalLight(0xffffff, 1.25);
    sol.position.set(-1.4, 2.8, 2.6);
    cena.add(sol);
    const contraluz = new THREE.DirectionalLight(0xfff2dc, 0.35);
    contraluz.position.set(1.8, 1.4, -1.6);
    cena.add(contraluz);
    const rosto = new THREE.DirectionalLight(0xfff4e6, 0.55);
    rosto.position.set(0.6, 1.70, 2.2);
    rosto.target.position.set(0, 1.6, 0);
    cena.add(rosto, rosto.target);

    if (global.ResizeObserver) { observador = new ResizeObserver(redim); observador.observe(el); }
    global.addEventListener('resize', redim);

    carregando = new Promise((ok, falha) => {
      new THREE.GLTFLoader().load('assets/agatha-mpfb.glb', (g) => {
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
    modelo.traverse((o) => {
      if (o.isBone) ossos[o.name] = o;
      if (o.isMesh || o.isSkinnedMesh) {
        malhas.push(o);
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.encoding = THREE.sRGBEncoding; });
      }
    });
    modelo.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(modelo);
    modelo.userData.altura = bb.max.y - bb.min.y;
    modelo.userData.topo = bb.max.y;

    guardarRepouso();
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

  const REP = {
    D: { mao: [-0.315, 0.97, 0.20], forma: 'curva' },
    E: { mao: [0.315, 0.97, 0.20], forma: 'curva' },
  };

  function pousar() {
    EXTERNO = null;
    repor();
    aplicarMao('D', REP.D.forma);
    aplicarMao('E', REP.E.forma);
    ikBraco('D', V(...REP.D.mao), V(-0.55, -1.6, 0.25));
    ikBraco('E', V(...REP.E.mao), V(0.55, -1.6, 0.25));
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

  function qEntre(a, b) {
    const na = a.clone().normalize(), nb = b.clone().normalize();
    if (na.dot(nb) < -0.9999) {
      const alt = Math.abs(na.x) < 0.9 ? V(1, 0, 0) : V(0, 1, 0);
      return new THREE.Quaternion().setFromAxisAngle(alt.cross(na).normalize(), Math.PI);
    }
    return new THREE.Quaternion().setFromUnitVectors(na, nb);
  }

  /* ===================== dedos ===================== */
  const DEDOS = [['Index', 'i', 0], ['Middle', 'm', 1], ['Ring', 'r', 2], ['Little', 'p', 3], ['Thumb', 't', 4]];

  function aplicarMao(lado, forma) {
    const L = BRACO[lado];
    const f = (global.FORMAS_MAO && global.FORMAS_MAO[forma]) || (global.FORMAS_MAO && global.FORMAS_MAO.abre);
    if (!f) return;
    const sinal = lado === 'D' ? 1 : -1;
    DEDOS.forEach(([nome, chave, iEsp]) => {
      const ang = f[chave];
      const polegar = nome === 'Thumb';
      if (ang) {
        for (let j = 0; j < 3; j++) {
          const b = ossos['J_Bip_' + L + '_' + nome + (j + 1)];
          if (!b) continue;
          /* medido no modelo: os quatro dedos dobram em +X local nos dois lados, o polegar em Z espelhado */
          b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(
            polegar ? AZ : AX, ang[j] * G * (polegar ? sinal : 1)));
        }
      }
      if (f.esp && iEsp < 4) {
        const b = ossos['J_Bip_' + L + '_' + nome + '1'];
        if (b) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(AZ, f.esp[iEsp] * G * sinal));
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

  /* Medido no modelo: no osso do dedo médio, +Y é o dedo e +Z a palma. */
  function orientarPalma(lado, alvo) {
    const mao = ossos['J_Bip_' + BRACO[lado] + '_Hand'];
    const dedoOsso = ossos['J_Bip_' + BRACO[lado] + '_Middle1'];
    if (!mao || !dedoOsso || !alvo) return;
    const q = dedoOsso.getWorldQuaternion(new THREE.Quaternion());
    const dedo = V(0, 1, 0).applyQuaternion(q).normalize();
    const palma = V(0, 0, 1).applyQuaternion(q).normalize();
    const quer = new THREE.Vector3(alvo[0], alvo[1], alvo[2]).normalize();
    const p = palma.clone().addScaledVector(dedo, -palma.dot(dedo));
    const a = quer.clone().addScaledVector(dedo, -quer.dot(dedo));
    if (p.lengthSq() < 1e-6 || a.lengthSq() < 1e-6) return;
    p.normalize(); a.normalize();
    let ang = Math.atan2(new THREE.Vector3().crossVectors(p, a).dot(dedo), p.dot(a));
    ang = lim(ang, -1.9, 1.9); /* limite do antebraço/punho */
    rodarMundo(mao, new THREE.Quaternion().setFromAxisAngle(dedo, ang));
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
    rodarMao('D', D.pulso);
    if (D.palma) orientarPalma('D', D.palma);
    if (p.sim) {
      espelharBraco();
    } else {
      ajudOmbro('E', alvoE);
      ikBraco('E', alvoE, V(0.55, -1.6, E.polar || 0.25));
      rodarMao('E', E.pulso);
      if (E.palma) orientarPalma('E', E.palma);
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
  function enquadrar(tipo) {
    if (!modelo) return;
    const h = modelo.userData.altura || 1.75;
    if (tipo === 'corpo') {
      cam.fov = 30;
      cam.position.set(0.7, h * 0.55, h * 2.0);
      cam.lookAt(0, h * 0.5, 0);
    } else {
      /* plano de sinalização: da bacia (0,90 m) a acima da cabeça (2,00 m) */
      cam.fov = 31;
      cam.position.set(0.32, h * 0.810, h * 1.085);
      cam.lookAt(0, h * 0.805, 0);
    }
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
