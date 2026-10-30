/* ============================================================================
   PALCO 3D — o apresentador desenhado a três dimensões (three.js/WebGL).
   Reproduz o enquadramento do palco 960×540 e a linguagem do rig de maos.js:
   1 unidade ≈ 81,3 px, câmara em z = 4,6, olhar à altura y = 2,4.
   ============================================================================ */
(function (global) {
  'use strict';

  THREE.ColorManagement.legacyMode = false;

  const LARG = 960, ALT = 540;
  const CAM_Y = 2.4, CAM_Z = 4.6;
  const FOV = 2 * Math.atan(ALT / 2 / 374) * 180 / Math.PI;
  /* O rig SVG foi afinado para um corpo sem espessura; no palco 3D as mãos
     têm de avançar para a frente do peito. */
  const F_MAOS = 0.35;

  function texturaAmbiente() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#9fd8c8');
    grad.addColorStop(0.45, '#3f7a70');
    grad.addColorStop(0.55, '#1b3a36');
    grad.addColorStop(1, '#08110f');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
    /* clarão da luz principal, alto à esquerda */
    const sol = g.createRadialGradient(150, 70, 10, 150, 70, 150);
    sol.addColorStop(0, 'rgba(255,250,240,.95)');
    sol.addColorStop(1, 'rgba(255,250,240,0)');
    g.fillStyle = sol; g.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function texturaFundo() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = '#0d2321';
    g.fillRect(0, 0, 512, 512);
    const halo = g.createRadialGradient(200, 150, 20, 200, 150, 330);
    halo.addColorStop(0, 'rgba(94,196,170,.55)');
    halo.addColorStop(0.45, 'rgba(46,120,106,.30)');
    halo.addColorStop(1, 'rgba(6,20,20,0)');
    g.fillStyle = halo; g.fillRect(0, 0, 512, 512);
    const vin = g.createRadialGradient(256, 256, 150, 256, 256, 380);
    vin.addColorStop(0, 'rgba(0,0,0,0)');
    vin.addColorStop(1, 'rgba(0,0,0,.65)');
    g.fillStyle = vin; g.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  function materiais() {
    return {
      pele: new THREE.MeshPhysicalMaterial({
        color: 0xa9744f, roughness: 0.55, clearcoat: 0.20, clearcoatRoughness: 0.6,
        sheen: 0.30, sheenColor: new THREE.Color(0xdfa982), sheenRoughness: 0.7,
      }),
      casaco: new THREE.MeshPhysicalMaterial({
        color: 0x1d443d, roughness: 0.88, sheen: 0.6,
        sheenColor: new THREE.Color(0x5f9c8c), sheenRoughness: 0.55,
      }),
      camisa: new THREE.MeshPhysicalMaterial({ color: 0xe8dcc6, roughness: 0.82 }),
      cabelo: new THREE.MeshPhysicalMaterial({ color: 0x241812, roughness: 0.92, clearcoat: 0.03 }),
      olho: new THREE.MeshPhysicalMaterial({ color: 0xf6efe4, roughness: 0.22, clearcoat: 0.6 }),
      iris: new THREE.MeshPhysicalMaterial({ color: 0x4a2c1c, roughness: 0.18, clearcoat: 0.8 }),
      pupila: new THREE.MeshPhysicalMaterial({ color: 0x0b0705, roughness: 0.12, clearcoat: 0.9 }),
      branco: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1 }),
      labio: new THREE.MeshPhysicalMaterial({ color: 0x7a4335, roughness: 0.42, clearcoat: 0.3 }),
      labioClaro: new THREE.MeshPhysicalMaterial({ color: 0x9a5a48, roughness: 0.38, clearcoat: 0.35 }),
      sobrancelha: new THREE.MeshPhysicalMaterial({ color: 0x241a15, roughness: 0.75 }),
      pestana: new THREE.MeshPhysicalMaterial({ color: 0x120c09, roughness: 0.55 }),
      peleSombra: new THREE.MeshPhysicalMaterial({
        color: 0x6e452e, roughness: 0.62, clearcoat: 0.15,
        sheen: 0.25, sheenColor: new THREE.Color(0xb07a58), sheenRoughness: 0.8,
      }),
    };
  }

  function malha(geo, mat, pai, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    if (pai) pai.add(m);
    return m;
  }

  const Y_UP = new THREE.Vector3(0, 1, 0);

  function vec(p) { return new THREE.Vector3(p.x, p.y, p.z); }

  function pecaCilindro(a, b, r1, r2, mat, pai, lados) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const comp = dir.length();
    if (comp < 1e-4) return null;
    const geo = new THREE.CylinderGeometry(r2, r1, comp, lados || 12, 1, false);
    const m = malha(geo, mat, pai);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(Y_UP, dir.normalize());
    return m;
  }

  function pecaEsfera(c, r, mat, pai, sx, sy, sz) {
    const geo = new THREE.SphereGeometry(r, 16, 12);
    const m = malha(geo, mat, pai, c.x, c.y, c.z);
    if (sx) m.scale.set(sx, sy, sz);
    return m;
  }

  /* Palma: contorno real do rig (16 pontos) extrudido na espessura da mão */
  function pecaPalma(o, mat, pai) {
    const n = o.pontos.length / 2;
    const frente = o.pontos.slice(0, n).map(vec);
    const centro = new THREE.Vector3();
    frente.forEach(p => centro.add(p));
    centro.multiplyScalar(1 / n);

    const nrm = vec(o.nPalmar).normalize();
    const u = new THREE.Vector3().subVectors(frente[1], frente[0]).normalize();
    const v = new THREE.Vector3().crossVectors(nrm, u).normalize();
    const pts2 = frente.map(p => {
      const d = new THREE.Vector3().subVectors(p, centro);
      return new THREE.Vector2(d.dot(u), d.dot(v));
    });
    let area = 0;
    for (let i = 0; i < pts2.length; i++) {
      const a = pts2[i], b = pts2[(i + 1) % pts2.length];
      area += a.x * b.y - b.x * a.y;
    }
    if (area < 0) pts2.reverse();

    const esp = 0.085;
    const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts2), {
      depth: esp, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.016,
      bevelSegments: 2, curveSegments: 1,
    });
    geo.translate(0, 0, -esp / 2);
    geo.applyMatrix4(new THREE.Matrix4().makeBasis(u, v, nrm).setPosition(centro));
    return malha(geo, mat, pai);
  }

  /* Braço 3D: cinemática inversa de 2 ossos com comprimentos anatómicos.
     O rig SVG usa braços com metade do comprimento real; em 3D isso deixaria
     as mãos fora de alcance, por isso o solver é próprio do palco. */
  function braco3D(pose, lado, M, g) {
    const s = lado === 'E' ? 1 : -1;
    const ombro = new THREE.Vector3(1.62 * s, 2.02, -0.05);
    const pulso = new THREE.Vector3(pose.pos[0], pose.pos[1], pose.pos[2] + F_MAOS);
    const L1 = 2.35, L2 = 2.10;

    const d = new THREE.Vector3().subVectors(pulso, ombro);
    const dist = Math.max(0.4, d.length());
    const dir = d.normalize();
    const cosA = THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -0.999, 0.999);
    const sinA = Math.sqrt(1 - cosA * cosA);

    const e1 = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y);
    if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
    e1.normalize();
    const e2 = new THREE.Vector3().crossVectors(dir, e1).normalize();

    let melhor = null;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const c = ombro.clone()
        .addScaledVector(dir, L1 * cosA)
        .addScaledVector(e1, L1 * sinA * Math.cos(a))
        .addScaledVector(e2, L1 * sinA * Math.sin(a));
      const noTronco = Math.abs(c.x) < 1.5 && c.y > 0.9 && c.y < 3.2 && c.z < 0.55;
      const nota = c.y + (noTronco ? 4 : 0) - 0.15 * c.z + 0.05 * Math.abs(c.x);
      if (!melhor || nota < melhor.nota) melhor = { nota, c };
    }
    const cotovelo = melhor.c;

    const dirU = new THREE.Vector3().subVectors(cotovelo, ombro).normalize();
    const punhoManga = new THREE.Vector3().lerpVectors(cotovelo, pulso, 0.86);
    const dirM = new THREE.Vector3().subVectors(punhoManga, cotovelo).normalize();

    pecaCilindro(ombro, cotovelo.clone().addScaledVector(dirU, 0.12), 0.37, 0.30, M.casaco, g, 18);
    pecaEsfera(cotovelo, 0.30, M.casaco, g);
    pecaCilindro(cotovelo.clone().addScaledVector(dirM, -0.10), punhoManga, 0.285, 0.205, M.casaco, g, 18);
    pecaCilindro(punhoManga, pulso, 0.175, 0.155, M.pele, g, 14);
    pecaEsfera(ombro, 0.37, M.casaco, g);
  }

  /* Constrói mãos e braços a partir das peças do rig SVG (já em coordenadas
     do palco: 1 unidade = 81,3 px, eixo Y para cima, câmara em +Z). */
  function membros(poses, M) {
    const g = new THREE.Group();
    for (const lado of ['D', 'E']) {
      const pose = lado === 'D' ? poses.dir : poses.esq;
      if (!pose) continue;

      braco3D(pose, lado, M, g);

      const deslocada = { ...pose, pos: [pose.pos[0], pose.pos[1], pose.pos[2] + F_MAOS] };
      const pecas = global.maoTransformar(global.maoPecas(pose.forma), deslocada, lado);
      for (const o of pecas) {
        if (o.kind === 'palma') {
          pecaPalma(o, M.pele, g);
        } else if (o.kind === 'falange') {
          pecaCilindro(vec(o.a), vec(o.b), o.r1, o.r2, M.pele, g, 10);
          pecaEsfera(vec(o.b), o.r2 * 0.98, M.pele, g);
        } else if (o.kind === 'knuckle') {
          pecaEsfera(vec(o.c), o.r * 0.92, M.pele, g);
        }
      }
      pecaEsfera(new THREE.Vector3(deslocada.pos[0], deslocada.pos[1], deslocada.pos[2]),
        0.16, M.pele, g);
    }
    return g;
  }

  function cranioGeometria() {
    const geo = new THREE.SphereGeometry(1, 96, 72);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      x *= 0.98; y *= 1.14; z *= 1.00;
      /* maxilar arredondado em direcção ao queixo */
      if (y < 0) {
        const t = Math.min(1, -y / 1.14);
        x *= 1 - 0.20 * Math.pow(t, 2.0);
        z *= 1 - 0.08 * Math.pow(t, 1.4);
      }
      /* queixo mais curto: sobe progressivamente a partir de y = -0,55 */
      if (y < -0.55) {
        const t = Math.min(1, (-y - 0.55) / 0.59);
        y += 0.22 * t * t;
      }
      /* queixo para a frente */
      if (y < -0.55 && y > -1.0) {
        const t = Math.min(1, (-y - 0.55) / 0.40);
        const centro = Math.max(0, 1 - Math.abs(x) / 0.38);
        z += 0.05 * t * centro;
      }
      /* testa ligeiramente mais direita, nuca achatada */
      if (z < 0) z *= 0.95;
      /* órbitas dos olhos */
      for (const s of [-1, 1]) {
        const dx = x - s * 0.335, dy = (y + 0.15) * 1.5, dz = (z - 0.80) * 1.7;
        z -= 0.05 * Math.exp(-(dx * dx + dy * dy + dz * dz) * 24);
      }
      /* maçãs do rosto */
      for (const s of [-1, 1]) {
        const dx = x - s * 0.38, dy = (y + 0.45) * 1.7, dz = (z - 0.72) * 1.5;
        z += 0.03 * Math.exp(-(dx * dx + dy * dy + dz * dz) * 20);
      }
      p.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function ruido(x, y, z) {
    return Math.sin(x * 9.3 + y * 4.7 + z * 7.9) * 0.55 +
      Math.sin(x * 17.9 - y * 12.3 + z * 15.1) * 0.28 +
      Math.sin(x * 31.7 + y * 27.1 - z * 23.9) * 0.17;
  }

  function cabeloGeometria() {
    const geo = cranioGeometria();
    const p = geo.attributes.position, n = geo.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      /* linha de cabelo: alta na testa, desce às têmporas e à nuca */
      const linha = 0.55 - 0.85 * Math.pow(Math.abs(x), 1.2) - 0.9 * Math.max(0, -z);
      let d = 0.014 * ruido(x * 1.3, y * 1.3, z * 1.3);
      const t = Math.min(1, Math.max(0, (linha - y) / 0.10));
      d -= 0.10 * t; /* abaixo da linha o cabelo afunda para dentro do crânio */
      p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function corpo(M) {
    const g = new THREE.Group();

    /* tronco: perfil rodado (ombros largos, cintura estreita), achatado em Z */
    const perfil = [
      [0.001, -1.40], [1.34, -1.40], [1.46, -1.10], [1.53, -0.70],
      [1.56, -0.20], [1.58, 0.40], [1.60, 0.95], [1.58, 1.45],
      [1.56, 1.80], [1.50, 2.05], [1.25, 2.28], [0.82, 2.46],
      [0.42, 2.58], [0.001, 2.62],
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const tronco = new THREE.LatheGeometry(perfil, 72);
    tronco.scale(1, 1, 0.45);
    malha(tronco, M.casaco, g, 0, 0, 0);

    /* gola canelada do casaco */
    const gola = new THREE.TorusGeometry(0.52, 0.09, 16, 44);
    gola.rotateX(Math.PI / 2);
    gola.scale(1, 1, 0.82);
    malha(gola, M.casaco, g, 0, 2.60, 0);

    /* pescoço */
    const pescoco = new THREE.CylinderGeometry(0.42, 0.50, 0.85, 32);
    malha(pescoco, M.pele, g, 0, 2.80, -0.04);

    /* camisa: dois bicos abaixo do queixo */
    const bico = new THREE.BoxGeometry(0.32, 0.28, 0.05);
    malha(bico, M.camisa, g, -0.15, 2.56, 0.30).rotation.set(0.16, 0.12, 0.40);
    malha(bico, M.camisa, g, 0.15, 2.56, 0.30).rotation.set(0.16, -0.12, -0.40);

    /* cabeça */
    const cabeca = new THREE.Group();
    cabeca.position.set(0, 3.95, 0.02);
    g.add(cabeca);

    malha(cranioGeometria(), M.pele, cabeca);

    /* orelhas */
    for (const s of [-1, 1]) {
      const orelha = new THREE.SphereGeometry(1, 28, 22);
      orelha.scale(0.085, 0.235, 0.155);
      malha(orelha, M.pele, cabeca, s * 0.965, -0.15, -0.01);
      const concha = new THREE.SphereGeometry(1, 18, 14);
      concha.scale(0.028, 0.120, 0.080);
      malha(concha, M.peleSombra, cabeca, s * 0.995, -0.15, 0.045);
    }

    /* olhos: globo, pálpebras em calote, íris, pupila, brilho e pestanas */
    const OLHO = { x: 0.335, y: -0.15, z: 0.860, rx: 0.185, ry: 0.118, rz: 0.095 };
    for (const s of [-1, 1]) {
      const cx = s * OLHO.x;
      const branco = new THREE.SphereGeometry(1, 40, 28);
      branco.scale(OLHO.rx, OLHO.ry, OLHO.rz);
      malha(branco, M.olho, cabeca, cx, OLHO.y, OLHO.z);
      const iris = new THREE.SphereGeometry(1, 32, 24);
      iris.scale(0.104, 0.104, 0.034);
      malha(iris, M.iris, cabeca, cx, OLHO.y - 0.004, OLHO.z + 0.070);
      const pupila = new THREE.SphereGeometry(1, 24, 18);
      pupila.scale(0.046, 0.046, 0.016);
      malha(pupila, M.pupila, cabeca, cx, OLHO.y - 0.004, OLHO.z + 0.094);
      malha(new THREE.SphereGeometry(0.024, 16, 12), M.branco, cabeca,
        cx + 0.036, OLHO.y + 0.034, OLHO.z + 0.100);
      /* pálpebras: calotes do mesmo globo, por cima e por baixo */
      const cima = new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, 1.02);
      cima.scale(OLHO.rx * 1.07, OLHO.ry * 1.12, OLHO.rz * 1.12);
      malha(cima, M.pele, cabeca, cx, OLHO.y, OLHO.z);
      const baixoGeo = new THREE.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 2.40, Math.PI - 2.40);
      baixoGeo.scale(OLHO.rx * 1.07, OLHO.ry * 1.12, OLHO.rz * 1.12);
      malha(baixoGeo, M.pele, cabeca, cx, OLHO.y, OLHO.z);
      /* pestana: arame escuro sobre a borda da pálpebra superior */
      const th = 1.02, pts = [];
      for (let k = 0; k <= 20; k++) {
        const phi = (k / 20) * Math.PI;
        pts.push(new THREE.Vector3(
          -OLHO.rx * 1.075 * Math.cos(phi) * Math.sin(th),
          OLHO.ry * 1.125 * Math.cos(th),
          OLHO.rz * 1.075 * Math.sin(phi) * Math.sin(th)
        ));
      }
      malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.012, 8, false),
        M.pestana, cabeca, cx, OLHO.y, OLHO.z);
      /* sombra ténue da pálpebra inferior */
      const th2 = 2.40, pts2 = [];
      for (let k = 0; k <= 16; k++) {
        const phi = (k / 16) * Math.PI;
        pts2.push(new THREE.Vector3(
          -OLHO.rx * 1.06 * Math.cos(phi) * Math.sin(th2),
          OLHO.ry * 1.11 * Math.cos(th2),
          OLHO.rz * 1.06 * Math.sin(phi) * Math.sin(th2)
        ));
      }
      malha(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 24, 0.007, 8, false),
        M.peleSombra, cabeca, cx, OLHO.y, OLHO.z);
    }

    /* sobrancelhas: arco colado à testa */
    for (const s of [-1, 1]) {
      const sob = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * 0.150, 0.055, 0.960),
        new THREE.Vector3(s * 0.260, 0.100, 0.945),
        new THREE.Vector3(s * 0.380, 0.108, 0.905),
        new THREE.Vector3(s * 0.500, 0.070, 0.845),
      ]);
      malha(new THREE.TubeGeometry(sob, 24, 0.030, 10, false), M.sobrancelha, cabeca);
    }

    /* nariz: dorso longo, ponta, asas e narinas */
    const dorso = new THREE.CapsuleGeometry(0.058, 0.34, 10, 16);
    const dn = malha(dorso, M.pele, cabeca, 0, -0.17, 0.945);
    dn.rotation.set(-0.10, 0, 0);
    const ponta = new THREE.SphereGeometry(1, 28, 20);
    ponta.scale(0.108, 0.095, 0.105);
    malha(ponta, M.pele, cabeca, 0, -0.42, 0.965);
    for (const s of [-1, 1]) {
      const asa = new THREE.SphereGeometry(1, 18, 14);
      asa.scale(0.066, 0.050, 0.055);
      malha(asa, M.pele, cabeca, s * 0.108, -0.462, 0.945);
      const narina = new THREE.SphereGeometry(1, 14, 10);
      narina.scale(0.022, 0.015, 0.017);
      malha(narina, M.peleSombra, cabeca, s * 0.064, -0.492, 0.972);
    }

    /* boca: risco do sorriso e lábio inferior */
    const sorriso = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.215, -0.565, 0.822),
      new THREE.Vector3(0, -0.600, 0.842),
      new THREE.Vector3(0.215, -0.565, 0.822)
    );
    malha(new THREE.TubeGeometry(sorriso, 30, 0.013, 10, false), M.labio, cabeca);
    const labioInf = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.175, -0.625, 0.828),
      new THREE.Vector3(0, -0.650, 0.848),
      new THREE.Vector3(0.175, -0.625, 0.828)
    );
    malha(new THREE.TubeGeometry(labioInf, 26, 0.030, 12, false), M.labioClaro, cabeca);
    for (const s of [-1, 1]) {
      const canto = new THREE.SphereGeometry(1, 12, 10);
      canto.scale(0.018, 0.014, 0.014);
      malha(canto, M.peleSombra, cabeca, s * 0.220, -0.562, 0.812);
    }

    /* cabelo: casca colada ao crânio; a linha de cabelo é esculpida na própria
       malha (vértices abaixo da linha afundam para dentro do crânio). */
    const cabelo = cabeloGeometria();
    cabelo.scale(1.012, 1.014, 1.016);
    const c = malha(cabelo, M.cabelo, cabeca);
    c.castShadow = false;

    return g;
  }

  function montar(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.setSize(LARG, ALT, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x061413);
    const camera = new THREE.PerspectiveCamera(FOV, LARG / ALT, 0.1, 60);
    camera.position.set(0, CAM_Y, CAM_Z);
    camera.lookAt(0, CAM_Y, 0);

    /* ambiente: reflexos suaves */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = texturaAmbiente();
    scene.environment = pmrem.fromEquirectangular(envTex).texture;

    /* fundo de estúdio */
    const fundo = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 22),
      new THREE.MeshBasicMaterial({ map: texturaFundo(), depthWrite: false })
    );
    fundo.position.set(0, 2.2, -6);
    scene.add(fundo);

    /* luzes */
    scene.add(new THREE.HemisphereLight(0x9fd8c8, 0x0a1412, 0.50));

    const chave = new THREE.DirectionalLight(0xfff2e2, 2.4);
    chave.position.set(2.6, 5.2, 4.2);
    chave.castShadow = true;
    chave.shadow.mapSize.set(1024, 1024);
    chave.shadow.camera.left = -3; chave.shadow.camera.right = 3;
    chave.shadow.camera.top = 5.5; chave.shadow.camera.bottom = -1;
    chave.shadow.camera.near = 1; chave.shadow.camera.far = 14;
    chave.shadow.bias = -0.0015;
    chave.shadow.radius = 4;
    scene.add(chave);

    const contra = new THREE.DirectionalLight(0x9ce0ff, 0.9);
    contra.position.set(-3.4, 3.4, -2.6);
    scene.add(contra);

    const preench = new THREE.DirectionalLight(0xffd9b8, 0.45);
    preench.position.set(-2.4, 1.6, 3.0);
    scene.add(preench);

    const M = materiais();
    const apresentador = corpo(M);
    scene.add(apresentador);

    let rotuloActual = '';
    let maos = null;

    function construirMaos(poses) {
      if (maos) {
        scene.remove(maos);
        maos.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      maos = membros(poses || {}, M);
      scene.add(maos);
    }

    function desenhar() { renderer.render(scene, camera); }

    return {
      scene, camera, renderer, apresentador, materiais: M,
      actualizar(poses, rotulo) {
        rotuloActual = rotulo || '';
        construirMaos(poses);
        desenhar();
      },
      desenhando: desenhar,
      desenhar,
      rotulo: () => rotuloActual,
    };
  }

  global.Palco3D = { montar };
})(window);
