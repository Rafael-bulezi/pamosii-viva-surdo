/* ============================================================================
   MAOS — o rig anatómico de mãos da sinalizadora Agatha (SVG puro, sem bibliotecas)
   ----------------------------------------------------------------------------
   Modelo 3D articulado projectado em 2D SVG com:
   - Arco metacárpico transversal e oblíquo, eminências tenar e hipotenar,
     pregas palmares, vales interdigitais (web valleys) e nós dorsais (MCP);
   - Quatro dedos de três falanges (proximal, média, distal) com convergência
     axial para o escafóide, pregas PIP/DIP e leitos ungueais dorsais;
   - Polegar oponível com articulação em sela (CMC trapézio-metacárpica),
     1.º metacarpo integrado na membrana tenar e duas falanges (proximal/distal);
   - Estreitamento anatómico do pulso (processos estilóides) e antebraço com
     cinemática inversa analítica (2-bone IK) e transição suave para a manga;
   - Iluminação direccional única (topo-esquerda-frente: pele quente ao sol,
     sombra fria) + oclusão de contacto entre dedos adjacentes e sobre a palma.

   CONTRATO PÚBLICO (compatível com app.js):
   FORMAS_MAO, LOCAIS, MOVIMENTOS, SINAIS, sinalNotacao(chave),
   maoFigura(forma), maoCena(poses, rotulo), maoMisturar(a, b, t),
   formaMisturar(a, b, t), MAO_CORPO, MAO_VISTA.
   ============================================================================ */
'use strict';

const MAO_G = Math.PI / 180;
const v3 = (x, y, z) => ({ x, y, z });
const soma3 = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub3 = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mult3 = (a, k) => v3(a.x * k, a.y * k, a.z * k);
const dot3 = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross3 = (a, b) => v3(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x
);
const len3 = a => Math.hypot(a.x, a.y, a.z) || 1e-6;
const norm3 = a => { const L = len3(a); return v3(a.x / L, a.y / L, a.z / L); };
const mixNum = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => v3(mixNum(a.x, b.x, t), mixNum(a.y, b.y, t), mixNum(a.z, b.z, t));

const I3 = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
const mat3 = (a, b) => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
];
const matV = (m, p) => v3(
  m[0] * p.x + m[1] * p.y + m[2] * p.z,
  m[3] * p.x + m[4] * p.y + m[5] * p.z,
  m[6] * p.x + m[7] * p.y + m[8] * p.z
);
const rotX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const rotY = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rotZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };

/* ---------------- geometria anatómica da mão ---------------- */
/* Espaço local da mão direita ('D'):
   - Origem (0, 0, 0) no centro do carpo/pulso;
   - +Y aponta ao longo do 3.º metacarpo (dedo médio);
   - -X é o bordo radial (polegar), +X é o bordo ulnar (mindinho);
   - +Z é a face palmar (volar), -Z é a face dorsal (costas da mão).
   Os quatro dedos assentam num arco metacárpico transversal (z curvo) e
   convergem axialmente para o tubérculo do escafóide ao flectir. */
const DEDOS_MAO = [
  { id: 'i', x: -0.295, y: 0.855, z: 0.028, len: [0.42, 0.255, 0.175], r: 0.082, conv: -4.5, archY: 5.0 },
  { id: 'm', x: -0.095, y: 0.905, z: 0.040, len: [0.465, 0.285, 0.185], r: 0.086, conv: -1.0, archY: 0.0 },
  { id: 'r', x:  0.105, y: 0.870, z: 0.022, len: [0.425, 0.265, 0.175], r: 0.080, conv:  3.5, archY: -5.0 },
  { id: 'p', x:  0.285, y: 0.785, z: -0.006, len: [0.335, 0.205, 0.155], r: 0.069, conv:  8.0, archY: -10.5 },
];

/* Contorno anatómico da palma (16 pontos com estreitamento no carpo, saliência
   tenar radial, cabeças metacárpicas, vales interdigitais e bordo hipotenar) */
const PALMA_PTS = [
  [-0.225, -0.02],  /* 0: estilóide radial / pulso radial */
  [ 0.215, -0.02],  /* 1: estilóide ulnar / pulso ulnar */
  [ 0.305,  0.16],  /* 2: base hipotenar (pisiforme) */
  [ 0.385,  0.44],  /* 3: ventre muscular hipotenar */
  [ 0.395,  0.70],  /* 4: prega palmar distal ulnar */
  [ 0.350,  0.83],  /* 5: bordo externo da 5.ª cabeça metacárpica */
  [ 0.205,  0.825], /* 6: vale interdigital anelar-mindinho (4.ª comissura) */
  [ 0.105,  0.915], /* 7: coroa da 4.ª cabeça metacárpica (anelar) */
  [ 0.005,  0.875], /* 8: vale interdigital médio-anelar (3.ª comissura) */
  [-0.095,  0.945], /* 9: coroa da 3.ª cabeça metacárpica (médio) */
  [-0.200,  0.865], /* 10: vale interdigital indicador-médio (2.ª comissura) */
  [-0.310,  0.895], /* 11: coroa da 2.ª cabeça metacárpica (indicador) */
  [-0.395,  0.79],  /* 12: bordo radial do 2.º metacarpo */
  [-0.445,  0.54],  /* 13: prega da 1.ª comissura (membrana do polegar) */
  [-0.425,  0.28],  /* 14: eminência tenar (base do polegar) */
  [-0.315,  0.10],  /* 15: tubérculo do escafóide */
];
const PALMA_ESP = 0.088;

/* Limites articulares fisiológicos (em graus) para evitar hiper-extensões irreais */
const LIMITES_DEDO = [
  [-12, 96],  /* MCP: ligeira hiper-extensão até flexão completa */
  [  0, 108], /* PIP: dobradiça pura sem hiper-extensão */
  [ -6, 82],  /* DIP: flexão distal acoplada */
];
const LIMITES_POLEGAR = [
  [  6, 90],  /* t[0]: abdução radial/palmar na sela CMC */
  [ -6, 65],  /* t[1]: oposição / flexão CMC+MCP através da palma */
  [ -8, 80],  /* t[2]: flexão da falange distal (IP) e enrolar */
];

/* i/m/r/p: [mcp, pip, dip] em graus · t: [abertura, flexão, enrolar] · esp: abdução */
const FORMAS_MAO = {
  A: { i: [84, 98, 66], m: [86, 100, 68], r: [88, 100, 66], p: [90, 100, 64], t: [26, 14, 12], esp: [-4, -2, 1, 5] },
  B: { i: [2, 3, 2], m: [1, 2, 1], r: [2, 3, 2], p: [4, 4, 3], t: [14, 46, 36], esp: [-3, -1, 1, 3] },
  C: { i: [42, 48, 32], m: [46, 52, 34], r: [48, 52, 34], p: [50, 54, 32], t: [42, 34, 38], esp: [-7, -2, 2, 7] },
  D: { i: [0, 2, 1], m: [72, 90, 56], r: [78, 92, 60], p: [82, 94, 60], t: [28, 46, 48], esp: [-2, -3, 0, 4] },
  E: { i: [68, 96, 72], m: [72, 98, 74], r: [74, 98, 72], p: [76, 98, 70], t: [14, 56, 66], esp: [-5, -2, 2, 5] },
  F: { i: [54, 64, 44], m: [3, 4, 2], r: [2, 3, 2], p: [1, 2, 1], t: [32, 46, 48], esp: [-4, 3, 8, 13] },
  G: { i: [2, 3, 1], m: [84, 96, 64], r: [86, 98, 64], p: [88, 98, 62], t: [46, 16, 12], esp: [-1, -4, 0, 4] },
  H: { i: [1, 2, 1], m: [2, 3, 1], r: [84, 96, 62], p: [88, 98, 60], t: [24, 38, 42], esp: [-2, 2, -2, 3] },
  I: { i: [84, 98, 66], m: [86, 98, 66], r: [88, 98, 64], p: [0, 2, 1], t: [20, 38, 40], esp: [-5, -3, 0, 4] },
  J: { i: [82, 96, 64], m: [84, 98, 64], r: [86, 98, 62], p: [2, 4, 2], t: [22, 36, 38], esp: [-5, -3, 0, 6] },
  K: { i: [0, 2, 0], m: [22, 8, 4], r: [82, 96, 60], p: [86, 96, 58], t: [42, 26, 14], esp: [-8, 5, -2, 3] },
  L: { i: [0, 1, 0], m: [84, 98, 64], r: [86, 100, 64], p: [88, 100, 62], t: [82, 2, 2], esp: [-2, -4, 0, 4] },
  M: { i: [68, 90, 62], m: [70, 92, 64], r: [72, 92, 64], p: [84, 96, 62], t: [14, 52, 56], esp: [-5, -2, 2, 6] },
  N: { i: [68, 90, 62], m: [70, 92, 64], r: [82, 96, 62], p: [86, 96, 62], t: [16, 48, 52], esp: [-5, -1, 2, 6] },
  O: { i: [54, 62, 42], m: [58, 64, 42], r: [60, 64, 42], p: [62, 64, 40], t: [36, 42, 50], esp: [-8, -2, 2, 8] },
  P: { i: [4, 2, 0], m: [28, 10, 4], r: [82, 96, 60], p: [86, 96, 58], t: [40, 28, 16], esp: [-8, 6, -2, 3] },
  Q: { i: [16, 10, 4], m: [84, 96, 62], r: [86, 98, 62], p: [88, 98, 60], t: [48, 18, 14], esp: [-1, -4, 0, 4] },
  R: { i: [4, 4, 2], m: [10, 6, 4], r: [84, 96, 62], p: [88, 98, 60], t: [24, 38, 42], esp: [5, -7, -2, 3] },
  S: { i: [84, 98, 66], m: [86, 100, 66], r: [88, 100, 64], p: [90, 100, 62], t: [18, 48, 54], esp: [-4, -2, 1, 4] },
  T: { i: [74, 92, 62], m: [82, 96, 62], r: [84, 96, 60], p: [86, 96, 58], t: [22, 38, 36], esp: [-5, -1, 1, 5] },
  U: { i: [0, 1, 0], m: [0, 1, 0], r: [84, 96, 62], p: [88, 98, 60], t: [24, 38, 40], esp: [-2, 2, -2, 3] },
  V: { i: [0, 1, 0], m: [0, 1, 0], r: [84, 96, 62], p: [88, 98, 60], t: [24, 38, 40], esp: [-12, 12, -2, 3] },
  W: { i: [0, 1, 0], m: [0, 1, 0], r: [0, 2, 1], p: [86, 98, 60], t: [22, 42, 44], esp: [-12, 0, 12, 4] },
  X: { i: [26, 92, 48], m: [84, 96, 62], r: [86, 98, 60], p: [88, 98, 58], t: [24, 34, 36], esp: [-4, -3, 0, 4] },
  Y: { i: [84, 96, 62], m: [86, 98, 62], r: [88, 98, 60], p: [0, 2, 1], t: [82, 4, 4], esp: [-5, -3, 0, 12] },
  Z: { i: [0, 2, 1], m: [84, 96, 62], r: [86, 98, 62], p: [88, 98, 60], t: [24, 36, 38], esp: [-1, -4, 0, 4] },
  abre: { i: [0, 1, 0], m: [0, 1, 0], r: [0, 1, 0], p: [0, 1, 0], t: [66, 2, 2], esp: [-14, -4, 5, 15] },
  plano: { i: [1, 2, 1], m: [0, 1, 0], r: [1, 2, 1], p: [2, 3, 1], t: [24, 6, 4], esp: [-2, -1, 1, 2] },
  punho: { i: [84, 98, 66], m: [86, 100, 66], r: [88, 100, 64], p: [90, 100, 62], t: [18, 46, 52], esp: [-4, -2, 1, 4] },
  aponta: { i: [0, 1, 0], m: [84, 96, 62], r: [86, 98, 62], p: [88, 98, 60], t: [24, 36, 40], esp: [-1, -4, 0, 4] },
  curva: { i: [34, 46, 28], m: [38, 50, 30], r: [40, 50, 30], p: [42, 52, 30], t: [36, 28, 34], esp: [-8, -2, 3, 8] },
  /* mão em repouso: o dedo mindinho fecha mais do que o indicador, como numa
     mão largada ao lado do corpo; o polegar fica junto do indicador e um pouco
     à frente, não espetado para o lado */
  relax: { i: [10, 14, 6], m: [16, 22, 10], r: [22, 28, 12], p: [28, 34, 14], t: [6, 16, 10], esp: [-2, 0, 1, 3] },
  garra: { i: [32, 68, 46], m: [34, 70, 48], r: [36, 70, 48], p: [38, 72, 46], t: [46, 28, 42], esp: [-11, -2, 6, 13] },
  joinha: { i: [84, 98, 66], m: [86, 100, 66], r: [88, 100, 64], p: [90, 100, 62], t: [82, 4, 4], esp: [-4, -2, 1, 4] },
  tres: { i: [0, 1, 0], m: [0, 1, 0], r: [86, 100, 64], p: [88, 100, 62], t: [82, 2, 2], esp: [-10, 8, 0, 4] },
};

const lim = (n, a, b) => Math.max(a, Math.min(b, n));
const n1 = n => Math.round(n * 10) / 10;

/* Aceita chave de forma ('B') ou estrutura {i, m, r, p, t, esp} */
function formaDe(f) {
  const base = typeof f === 'string' ? (FORMAS_MAO[f] || FORMAS_MAO.B) : (f || FORMAS_MAO.B);
  return {
    i: base.i || [0, 0, 0],
    m: base.m || [0, 0, 0],
    r: base.r || [0, 0, 0],
    p: base.p || [0, 0, 0],
    t: base.t || [26, 6, 4],
    esp: base.esp || [-2, -1, 1, 2],
  };
}

/* Constrói as 3 falanges de um dedo com convergência axial ao flectir,
   knuckle dorsal no MCP, pregas PIP/DIP e leito ungueal na falange distal */
function maoDedo(origem, ang, abducao, cfg) {
  const ossos = [];
  const mcp = lim(ang[0], LIMITES_DEDO[0][0], LIMITES_DEDO[0][1]);
  const pip = lim(ang[1], LIMITES_DEDO[1][0], LIMITES_DEDO[1][1]);
  const dip = lim(ang[2], LIMITES_DEDO[2][0], LIMITES_DEDO[2][1]);
  const flexRatio = lim((mcp + pip * 0.7) / 155, 0, 1);

  /* Em flexão palmar (mcp > 60°), a falange proximal inclina-se para baixo (-Y)
     sobre a face anterior da palma (+Z), evitando que os dedos fiquem espetados
     para cima por efeito de perspectiva */
  const angEfetivo = [
    mcp * 1.42,
    pip * 0.68,
    dip * 0.64,
  ];

  const abdEfetiva = abducao * (1 - flexRatio * 0.75) + cfg.conv * flexRatio;
  let p = v3(
    origem.x,
    origem.y - flexRatio * 0.04,
    origem.z + (cfg.z || 0) + flexRatio * 0.06
  );
  let R = mat3(rotZ(abdEfetiva * MAO_G), rotY((cfg.archY || 0) * flexRatio * MAO_G));

  /* Nó dorsal (MCP knuckle) na coroa metacárpica */
  const nDorsal = matV(R, v3(0, 0.12, -1));
  ossos.push({
    kind: 'knuckle',
    c: soma3(v3(origem.x, origem.y + 0.02, origem.z), mult3(nDorsal, cfg.r * (0.42 + flexRatio * 0.25))),
    r: cfg.r * (0.86 + flexRatio * 0.12),
    flex: flexRatio,
    fingerId: cfg.id,
  });

  const tapers = [
    [1.00, 0.87], /* falange proximal */
    [0.86, 0.74], /* falange média */
    [0.73, 0.56], /* falange distal (ponta afilada) */
  ];

  for (let i = 0; i < 3; i++) {
    R = mat3(R, rotX(angEfetivo[i] * MAO_G));
    const eixoY = matV(R, v3(0, 1, 0));
    const eixoZ = matV(R, v3(0, 0, 1));
    /* Mantém todas as falanges flectidas claramente à frente da palma (z > PALMA_ESP) */
    const passo = v3(eixoY.x * cfg.len[i], eixoY.y * cfg.len[i], eixoY.z * cfg.len[i] * 0.46);
    const fim = soma3(p, passo);
    const r1 = cfg.r * tapers[i][0];
    const r2 = cfg.r * tapers[i][1];

    ossos.push({
      kind: 'falange',
      fingerId: cfg.id,
      seg: i,
      a: p,
      b: fim,
      r1,
      r2,
      nPalmar: eixoZ,
      flexJoint: ang[i],
      totalFlex: flexRatio,
      unha: i === 2 ? {
        base: soma3(mix3(p, fim, 0.34), mult3(eixoZ, -r1 * 0.72)),
        ponta: soma3(mix3(p, fim, 0.90), mult3(eixoZ, -r2 * 0.74)),
        nDorsal: mult3(eixoZ, -1),
        larg: r2 * 1.26,
      } : null,
    });
    p = fim;
  }

  /* Sombra de oclusão palmar quando o dedo dobra sobre a palma */
  if (flexRatio > 0.38) {
    ossos.push({
      kind: 'oclusaoPalma',
      a: v3(origem.x * 0.90, origem.y - 0.10, PALMA_ESP + 0.022),
      b: v3(p.x, lim(p.y - 0.04, 0.18, 0.80), PALMA_ESP + 0.025),
      r1: cfg.r * 0.94,
      r2: cfg.r * 0.78,
      alpha: lim((flexRatio - 0.35) * 0.46, 0.06, 0.28),
    });
  }

  return ossos;
}

/* Constrói o polegar oponível:
   - Articulação em sela CMC (trapézio-metacárpica) em (-0.285, 0.18, 0.11);
   - 1.º Metacarpo + membrana tenar;
   - 2 Falanges (proximal e distal) rodadas em pronação positiva (+58°..+88°)
     para que a flexão varra o polegar através da palma (+X) sobre os dedos. */
function maoPolegar(tBruto) {
  const t0 = lim(tBruto[0], LIMITES_POLEGAR[0][0], LIMITES_POLEGAR[0][1]);
  const t1 = lim(tBruto[1], LIMITES_POLEGAR[1][0], LIMITES_POLEGAR[1][1]);
  const t2 = lim(tBruto[2], LIMITES_POLEGAR[2][0], LIMITES_POLEGAR[2][1]);

  const oppRatio = lim(t1 / 46, 0, 1);
  const abdRatio = lim((t0 - 15) / 68, 0, 1);

  /* Sela CMC no trapézio: bem adiante da face palmar (+Z) */
  const cmc = v3(-0.285, 0.175, 0.115 + oppRatio * 0.085);

  /* Orientação na sela CMC:
     - Quando t0 é alto (L, Y, abre), o 1.º metacarpo abre radialmente para -X;
     - Quando t1 é alto (B, E, S, M, N, O), o 1.º metacarpo sobe e as 2 falanges
       flectem em pronação positiva (+rotY) varrendo para +X sobre a palma. */
  const angRadial = (t0 * (1 - oppRatio * 0.72) + 8 * (1 - oppRatio) - oppRatio * 14) * MAO_G;
  const angPalmar = (16 + oppRatio * 18 + abdRatio * 6) * MAO_G;
  const angPronacao = (58 + oppRatio * 30) * MAO_G;

  let R = mat3(mat3(rotZ(angRadial), rotX(angPalmar)), rotY(angPronacao));

  const pecas = [];
  const comprimentos = [0.28, 0.235, 0.19]; /* [1.º metacarpo, falange proximal, falange distal] */
  const raios = [
    [0.112, 0.092], /* 1.º metacarpo (envolvido pela massa tenar) */
    [0.090, 0.076], /* falange proximal */
    [0.075, 0.058], /* falange distal */
  ];
  const flexSeg = [0, (t1 * 0.95 + t2 * 0.35), t2 * 0.85];

  let p = cmc;
  let mcpPos = cmc;
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      R = mat3(R, rotX(flexSeg[i] * MAO_G));
    }
    const eixoY = matV(R, v3(0, 1, 0));
    const eixoZ = matV(R, v3(0, 0, 1));
    const passo = v3(eixoY.x * comprimentos[i], eixoY.y * comprimentos[i], eixoY.z * comprimentos[i] * 0.55);
    const fim = soma3(p, passo);
    if (i === 0) mcpPos = fim;

    pecas.push({
      kind: 'falange',
      fingerId: 't',
      seg: i,
      a: p,
      b: fim,
      r1: raios[i][0],
      r2: raios[i][1],
      nPalmar: eixoZ,
      flexJoint: flexSeg[i],
      totalFlex: oppRatio,
      unha: i === 2 ? {
        base: soma3(mix3(p, fim, 0.36), mult3(eixoZ, -raios[i][0] * 0.72)),
        ponta: soma3(mix3(p, fim, 0.88), mult3(eixoZ, -raios[i][1] * 0.74)),
        nDorsal: mult3(eixoZ, -1),
        larg: raios[i][1] * 1.32,
      } : null,
    });
    p = fim;
  }

  /* Membrana interdigital tenar (1.ª comissura entre 1.º metacarpo e base do indicador) */
  pecas.unshift({
    kind: 'membranaTenar',
    pts: [
      v3(-0.30, 0.20, 0.048),
      mix3(cmc, mcpPos, 0.85),
      v3(-0.36, 0.62, 0.036),
      v3(-0.20, 0.52, 0.052),
    ],
  });

  return pecas;
}

/* Peças locais de uma mão na forma pedida */
function maoPecas(forma, comBraco) {
  const f = formaDe(forma);
  const esp = f.esp || [-2, -1, 1, 2];
  const mediaFlex = (
    (f.i[0] + f.i[1]) +
    (f.m[0] + f.m[1]) +
    (f.r[0] + f.r[1]) +
    (f.p[0] + f.p[1])
  ) / (4 * 175);
  const oppRatio = lim(f.t[1] / 52, 0, 1);

  const pecas = [{
    kind: 'palma',
    cup: lim(mediaFlex, 0, 1),
    opp: oppRatio,
    esp,
  }];

  /* Dedos: indicador, médio, anelar, mindinho */
  ['i', 'm', 'r', 'p'].forEach((k, idx) => {
    const cfg = DEDOS_MAO[idx];
    pecas.push(...maoDedo(v3(cfg.x, cfg.y, cfg.z), f[k], esp[idx], cfg));
  });

  /* Contacto de sombra entre dedos adjacentes quando estão juntos */
  for (let idx = 0; idx < 3; idx++) {
    const cA = DEDOS_MAO[idx], cB = DEDOS_MAO[idx + 1];
    const kA = ['i', 'm', 'r', 'p'][idx], kB = ['i', 'm', 'r', 'p'][idx + 1];
    const diffAng = Math.abs(f[kA][0] - f[kB][0]) + Math.abs(f[kA][1] - f[kB][1]) * 0.5;
    const spread = esp[idx + 1] - esp[idx];
    if (spread < 7.5 && diffAng < 26) {
      const flexMed = ((f[kA][0] + f[kB][0]) * 0.5) * MAO_G;
      const dir = matV(rotX(flexMed), v3(0, 0.36, 0));
      const baseMid = v3((cA.x + cB.x) * 0.5, (cA.y + cB.y) * 0.5 - 0.03, (cA.z + cB.z) * 0.5 + 0.015);
      pecas.push({
        kind: 'contactoDedos',
        a: baseMid,
        b: soma3(baseMid, dir),
      });
    }
  }

  /* Polegar oponível */
  pecas.push(...maoPolegar(f.t));
  return pecas;
}

/* Braço anatómico com cinemática inversa analítica (2-bone IK) + punho estreitado:
   - Mantém comprimentos reais de braço e antebraço (sem esticar como borracha);
   - Garante cotovelo natural abaixo do ombro nas poses baixas/médias e elevação
     fisiológica suave apenas quando o pulso sobe acima da cabeça;
   - Estreita o pulso na transição antebraço → carpo sem degrau visível. */
function maoBraco(pose, lado) {
  const s = lado === 'E' ? 1 : -1;
  const ombro = v3(1.66 * s, 2.08, -0.06);
  const pulso = v3(pose.pos[0], pose.pos[1], pose.pos[2]);

  /* Comprimentos anatómicos de referência em unidades do corpo */
  const L1 = 1.22; /* úmero (ombro → cotovelo) */
  const L2 = 1.16; /* rádio/ulna (cotovelo → pulso) */
  const dVec = sub3(pulso, ombro);
  const dist = len3(dVec);

  /* Vector de pólo (direcção preferencial do cotovelo: para baixo, ligeiramente
     afastado do tronco e recuado em Z) */
  const elevacao = lim((pulso.y - ombro.y) / 1.8, 0, 1);
  const poleDir = norm3(v3(
    0.52 * s,
    -0.84 + elevacao * 0.28,
    -0.24
  ));

  let cotovelo;
  if (dist >= L1 + L2 - 0.01) {
    /* Braço totalmente estendido na direcção do pulso */
    const dir = norm3(dVec);
    cotovelo = soma3(ombro, mult3(dir, dVec ? dist * (L1 / (L1 + L2)) : L1));
  } else {
    /* Lei dos cossenos para 2-bone IK exacto (preserva L1 e L2 constantes) */
    const dClamped = Math.max(0.30, dist);
    const cosAlpha = lim((L1 * L1 + dClamped * dClamped - L2 * L2) / (2 * L1 * dClamped), -0.99, 0.99);
    const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
    const dir = norm3(dVec);
    /* Base ortonormal do círculo de cotovelos possíveis */
    let eixo1 = sub3(v3(0, 1, 0), mult3(dir, dir.y));
    if (len3(eixo1) < 1e-4) eixo1 = v3(1, 0, 0);
    eixo1 = norm3(eixo1);
    const eixo2 = norm3(cross3(dir, eixo1));
    /* O cotovelo desce: escolhe-se o ponto do círculo mais baixo que não entre
       no tronco (|x| pequeno com y a meio do corpo) nem vá para trás da câmara */
    let melhor = null;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const t = soma3(mult3(eixo1, Math.cos(a)), mult3(eixo2, Math.sin(a)));
      const c = soma3(ombro, soma3(mult3(dir, L1 * cosAlpha), mult3(t, L1 * sinAlpha)));
      const noTronco = Math.abs(c.x) < 1.35 && c.y > 1.2 && c.y < 3.1 && c.z < 0.35;
      const nota = c.y + (noTronco ? 2.2 : 0) - 0.12 * c.z + 0.04 * Math.abs(c.x);
      if (!melhor || nota < melhor.nota) melhor = { nota, c };
    }
    cotovelo = melhor.c;
  }

  /* Ponto de transição da manga para o punho de pele nua (83% do antebraço) */
  const punhoManga = mix3(cotovelo, pulso, 0.83);
  /* Uma manga entra por baixo da outra no cotovelo: sem costura em tubo */
  const dirU = norm3(sub3(cotovelo, ombro));
  const dirM = norm3(sub3(punhoManga, cotovelo));
  const junta = 0.11;

  return [
    { kind: 'braco', sub: 'umero', a: ombro, b: soma3(cotovelo, mult3(dirU, junta)), r1: 0.30, r2: 0.255 },
    { kind: 'braco', sub: 'manga', a: sub3(cotovelo, mult3(dirM, junta)), b: punhoManga, r1: 0.255, r2: 0.175 },
    { kind: 'braco', sub: 'pulsoPele', a: punhoManga, b: pulso, r1: 0.165, r2: 0.150 },
  ];
}

/* ---------------- câmara e projecção ---------------- */
const MAO_CAM = 4.6, MAO_FOC = 2.2;
const MAO_VB = '0 0 960 540';
const MAO_VB_FIG = '0 0 320 320';
/* Direcção única de luz partilhada com o corpo: topo-esquerda-frente */
const MAO_LUZ = { x: -0.55, y: -0.68, z: 0.48 };
let MAO_VISTA = { cx: 480, cy: 465, esc: 170 };
const MAO_ESCALA_MAO = 0.58;

function maoProj(p, vista) {
  const v = vista || MAO_VISTA;
  const d = Math.max(0.35, MAO_CAM - p.z);
  const s = MAO_FOC / d;
  return {
    x: v.cx + p.x * s * v.esc,
    y: v.cy - p.y * s * v.esc,
    z: p.z,
    s: s * v.esc,
  };
}

/* Paleta de pele com transição térmica:
   - Luz directa (l > 0.55): pele dourada/quente (hue 31°–35°);
   - Meia-luz (l ~ 0.45): pêssego/ocre suave (hue 27°–30°);
   - Sombra própria/oclusão (l < 0.38): sombra fria rosada/terra-sombra (hue 18°–23°). */
function tomPele(l) {
  const t = lim(l, 0, 1.35);
  const h = Math.round(mixNum(18, 27, lim(t / 1.1, 0, 1)));
  const sat = Math.round(mixNum(30, 42, lim(t, 0, 1)));
  const lum = n1(lim(22 + t * 31, 18, 60));
  return `hsl(${h} ${sat}% ${lum}%)`;
}

/* Silhueta orgânica de um segmento (falange ou antebraço) numa única curva
   fechada (sem círculos internos sobrepostos nas articulações) */
function maoSegmentoSVG(p1, p2, r1, r2, fill, stroke, brilho, prega) {
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const L = Math.hypot(dx, dy);
  if (L < 0.4) {
    const r = Math.max(r1, r2);
    return `<circle cx="${n1(p1.x)}" cy="${n1(p1.y)}" r="${n1(r)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.95"` : ''}/>`;
  }
  const ux = dx / L, uy = dy / L;
  let nx = -uy, ny = ux;
  /* Orienta a normal 2D para o lado iluminado (topo-esquerda) */
  if (nx * MAO_LUZ.x + ny * MAO_LUZ.y < 0) { nx = -nx; ny = -ny; }

  /* Pontos laterais na base (p1) e na ponta (p2) com ligeira barriga orgânica a meio */
  const midX = (p1.x + p2.x) * 0.5, midY = (p1.y + p2.y) * 0.5;
  const rMid = (r1 + r2) * 0.52;
  const A = [p1.x + nx * r1, p1.y + ny * r1];
  const B = [p2.x + nx * r2, p2.y + ny * r2];
  const C = [p2.x - nx * r2, p2.y - ny * r2];
  const D = [p1.x - nx * r1, p1.y - ny * r1];
  const M1 = [midX + nx * rMid, midY + ny * rMid];
  const M2 = [midX - nx * rMid, midY - ny * rMid];

  /* Calotes arredondadas nas extremidades usando curvas de Bézier cúbicas */
  const cap1 = r1 * 1.28, cap2 = r2 * 1.28;
  const d = [
    `M${n1(A[0])} ${n1(A[1])}`,
    `Q${n1(M1[0])} ${n1(M1[1])} ${n1(B[0])} ${n1(B[1])}`,
    `C${n1(B[0] + ux * cap2)} ${n1(B[1] + uy * cap2)} ${n1(C[0] + ux * cap2)} ${n1(C[1] + uy * cap2)} ${n1(C[0])} ${n1(C[1])}`,
    `Q${n1(M2[0])} ${n1(M2[1])} ${n1(D[0])} ${n1(D[1])}`,
    `C${n1(D[0] - ux * cap1)} ${n1(D[1] - uy * cap1)} ${n1(A[0] - ux * cap1)} ${n1(A[1] - uy * cap1)} ${n1(A[0])} ${n1(A[1])}Z`,
  ].join('');

  let out = `<path d="${d}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.95" stroke-linejoin="round"` : ''}/>`;

  /* Brilho especular suave do lado da luz e sombra de contorno do lado oposto */
  if (brilho > 0) {
    const hx1 = p1.x + nx * r1 * 0.42 + ux * r1 * 0.15;
    const hy1 = p1.y + ny * r1 * 0.42 + uy * r1 * 0.15;
    const hx2 = p2.x + nx * r2 * 0.42 - ux * r2 * 0.15;
    const hy2 = p2.y + ny * r2 * 0.42 - uy * r2 * 0.15;
    out += `<path d="M${n1(hx1)} ${n1(hy1)}L${n1(hx2)} ${n1(hy2)}" stroke="rgba(255,248,238,${n1(brilho)})" stroke-width="${n1(Math.min(r1, r2) * 0.52)}" stroke-linecap="round" fill="none"/>`;
  }

  /* Prega articular (PIP / DIP) na base da falange média ou distal */
  if (prega) {
    const cx1 = p1.x + nx * r1 * 0.68, cy1 = p1.y + ny * r1 * 0.68;
    const cx2 = p1.x - nx * r1 * 0.68, cy2 = p1.y - ny * r1 * 0.68;
    const cmx = p1.x + ux * r1 * 0.18, cmy = p1.y + uy * r1 * 0.18;
    out += `<path d="M${n1(cx1)} ${n1(cy1)}Q${n1(cmx)} ${n1(cmy)} ${n1(cx2)} ${n1(cy2)}" stroke="${prega}" stroke-width="0.85" stroke-linecap="round" fill="none"/>`;
  }

  return out;
}

/* Mantém maoCapsula disponível caso código externo a invoque */
function maoCapsula(p1, p2, r1, r2, fill, brilho) {
  return maoSegmentoSVG(p1, p2, r1, r2, fill, null, brilho, null);
}

function maoCurva(pts) {
  const n = pts.length, m = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = m(pts[(i - 1 + n) % n], pts[i]), p1 = m(pts[i], pts[(i + 1) % n]);
    d += (i ? 'L' : 'M') + n1(p0.x) + ' ' + n1(p0.y) + `Q${n1(pts[i].x)} ${n1(pts[i].y)} ${n1(p1.x)} ${n1(p1.y)}`;
  }
  return d + 'Z';
}

/* Transforma as peças locais da mão para coordenadas do corpo:
   CORRECÇÃO DE SIMETRIA (lado === 'E'):
   Reflectir uma mão no plano sagital (X → -X) exige reflectir primeiro no espaço
   da mão direita (ou inverter os pseudo-vectores ry e rz). Assim, uma rotação
   como telhado (rz = -40°) ou onda (rz = +26°) inclina ambas as mãos de forma
   simétrica em relação ao eixo central do corpo. */
function maoTransformar(pecas, pose, lado) {
  const r = pose.rot || [0, 0, 0];
  const sinal = lado === 'E' ? -1 : 1;
  /* Para a mão esquerda, ry e rz invertem o sentido para manter simetria especular */
  const rx = r[0] * MAO_G;
  const ry = (r[1] * sinal) * MAO_G;
  const rz = (r[2] * sinal) * MAO_G;
  const M = mat3(mat3(rotZ(rz), rotY(ry)), rotX(rx));
  const pos = pose.pos || [0, 0, 0];
  /* A mão local foi modelada para um boneco de 320 px; no palco 960×540 o corpo
     cresceu e a mão tem de encolher em torno do pulso para manter a proporção
     anatómica (mão ≈ 0,8 da altura da cabeça). */
  const K = MAO_ESCALA_MAO;

  const px = p => {
    const l = matV(M, v3(p.x * sinal, p.y, p.z));
    return v3(l.x * K + pos[0], l.y * K + pos[1], l.z * K + pos[2]);
  };
  const nrm = v => norm3(matV(M, v3(v.x * sinal, v.y, v.z)));

  return pecas.map(o => {
    if (o.kind === 'palma') {
      const cup = o.cup || 0;
      const opp = o.opp || 0;
      /* Deformação 3D do arco metacárpico: os bordos radial e ulnar curvam para +Z */
      const mapAnat = ([x, y], faceZ) => {
        const archZ = -0.18 * (x * x) * (1 + cup * 0.85) + (y > 0.7 ? cup * 0.035 : 0);
        const thenarBump = (faceZ > 0 && x < -0.12 && y < 0.62) ? (0.038 + opp * 0.028) : 0;
        const hypoBump = (faceZ > 0 && x > 0.14 && y < 0.76) ? (0.030 + cup * 0.020) : 0;
        return px(v3(x, y, faceZ + archZ + thenarBump + hypoBump));
      };

      const frente = PALMA_PTS.map(pt => mapAnat(pt, PALMA_ESP));
      const tras = PALMA_PTS.map(pt => mapAnat(pt, -PALMA_ESP));

      /* Almofadas musculares (eminência tenar e eminência hipotenar) + pregas palmares */
      const thenarPts = [
        [-0.24, 0.05], [-0.42, 0.26], [-0.43, 0.55],
        [-0.28, 0.62], [-0.10, 0.44], [-0.12, 0.16],
      ].map(([x, y]) => px(v3(x, y, PALMA_ESP + 0.034 + opp * 0.025)));

      const hypoPts = [
        [0.18, 0.05], [0.35, 0.22], [0.38, 0.56],
        [0.33, 0.78], [0.16, 0.70], [0.12, 0.34],
      ].map(([x, y]) => px(v3(x, y, PALMA_ESP + 0.026 + cup * 0.018)));

      const pregas = [
        /* Prega tenar (linha da vida) */
        [v3(-0.34, 0.64, PALMA_ESP + 0.022), v3(-0.11, 0.42, PALMA_ESP + 0.025), v3(-0.16, 0.12, PALMA_ESP + 0.020)],
        /* Prega palmar transversal distal (sob os nós MCP) */
        [v3(0.35, 0.76, PALMA_ESP + 0.022), v3(0.06, 0.79, PALMA_ESP + 0.025), v3(-0.18, 0.76, PALMA_ESP + 0.020)],
        /* Prega palmar transversal proximal */
        [v3(-0.32, 0.66, PALMA_ESP + 0.022), v3(-0.04, 0.62, PALMA_ESP + 0.025), v3(0.28, 0.54, PALMA_ESP + 0.020)],
      ].map(c => c.map(px));

      /* Tendões extensores no dorso da mão */
      const tendoes = DEDOS_MAO.map(d => [
        px(v3(d.x * 0.32, 0.14, -PALMA_ESP - 0.012)),
        px(v3(d.x * 0.94, d.y - 0.06, -PALMA_ESP - 0.018)),
      ]);

      /* Pulso estreitado (processos estilóides e túnel cárpico) */
      const pulsoPts = [
        [-0.21, -0.14, 0.0], [0.20, -0.14, 0.0],
        [0.23, 0.06, 0.02], [-0.24, 0.06, 0.02],
      ].map(([x, y, z]) => px(v3(x, y, z)));

      return {
        kind: 'palma',
        pontos: frente.concat(tras),
        thenarPts,
        hypoPts,
        pregas,
        tendoes,
        pulsoPts,
        nPalmar: nrm(v3(0, 0, 1)),
      };
    }
    if (o.kind === 'membranaTenar') {
      return { kind: 'membranaTenar', pts: o.pts.map(px) };
    }
    if (o.kind === 'knuckle') {
      return { ...o, c: px(o.c) };
    }
    if (o.kind === 'oclusaoPalma' || o.kind === 'contactoDedos') {
      return { ...o, a: px(o.a), b: px(o.b) };
    }
    if (o.kind === 'falange') {
      return {
        ...o,
        a: px(o.a),
        b: px(o.b),
        nPalmar: nrm(o.nPalmar),
        unha: o.unha ? {
          base: px(o.unha.base),
          ponta: px(o.unha.ponta),
          nDorsal: nrm(o.unha.nDorsal),
          larg: o.unha.larg,
        } : null,
      };
    }
    return { ...o, a: px(o.a), b: px(o.b) };
  });
}

function maoDesenhar(pecas, vista) {
  const partes = [], sombra = [];
  for (const o of pecas) {
    if (o.kind === 'palma') {
      const n = PALMA_PTS.length, p = o.pontos;
      const frente = p.slice(0, n).map(pt => maoProj(pt, vista));
      const tras = p.slice(n).map(pt => maoProj(pt, vista));
      const zf = p.slice(0, n).reduce((t, q) => t + q.z, 0) / n;
      const zt = p.slice(n).reduce((t, q) => t + q.z, 0) / n;
      const nPalmar = o.nPalmar || v3(0, 0, 1);

      /* Iluminação 3D real da face palmar vs face dorsal */
      const luzPalmar = 0.56 + 0.38 * (
        -nPalmar.x * MAO_LUZ.x - nPalmar.y * MAO_LUZ.y + nPalmar.z * MAO_LUZ.z
      );
      const luzDorsal = 0.54 + 0.38 * (
        nPalmar.x * MAO_LUZ.x + nPalmar.y * MAO_LUZ.y - nPalmar.z * MAO_LUZ.z
      );

      /* Estreitamento do pulso sob a base da palma */
      if (o.pulsoPts) {
        const pPulso = o.pulsoPts.map(pt => maoProj(pt, vista));
        const zPulso = o.pulsoPts.reduce((t, q) => t + q.z, 0) / o.pulsoPts.length;
        partes.push({
          z: zPulso - 0.03,
          d: `<path d="${maoCurva(pPulso)}" fill="${tomPele(0.58)}" stroke="${tomPele(0.30)}" stroke-width="0.9"/>`,
        });
      }

      sombra.push(`<path d="${maoCurva(frente)}" fill="rgba(96,52,18,.16)"/>`);

      /* Ordenação exacta por profundidade real (zf vs zt), sem assumir que frente > tras */
      const dCostas = (() => {
        let svg = `<path d="${maoCurva(tras)}" fill="${tomPele(luzDorsal)}" stroke="${tomPele(0.28)}" stroke-width="1.05" stroke-linejoin="round"/>`;
        if (nPalmar.z < 0.15 && o.tendoes) {
          for (const [t0, t1] of o.tendoes) {
            const p0 = maoProj(t0, vista), p1 = maoProj(t1, vista);
            svg += `<path d="M${n1(p0.x)} ${n1(p0.y)}L${n1(p1.x)} ${n1(p1.y)}" stroke="${tomPele(luzDorsal + 0.12)}" stroke-width="${n1(p0.s * 0.026)}" stroke-linecap="round" opacity="0.55"/>`;
          }
        }
        return svg;
      })();

      const dFrente = (() => {
        let svg = `<path d="${maoCurva(frente)}" fill="${tomPele(luzPalmar)}" stroke="${tomPele(0.28)}" stroke-width="1.05" stroke-linejoin="round"/>`;
        if (nPalmar.z > -0.15) {
          if (o.thenarPts) {
            const th = o.thenarPts.map(pt => maoProj(pt, vista));
            svg += `<path d="${maoCurva(th)}" fill="${tomPele(luzPalmar + 0.09)}" opacity="0.78"/>`;
          }
          if (o.hypoPts) {
            const hy = o.hypoPts.map(pt => maoProj(pt, vista));
            svg += `<path d="${maoCurva(hy)}" fill="${tomPele(luzPalmar + 0.06)}" opacity="0.72"/>`;
          }
          if (o.pregas && nPalmar.z > 0.05) {
            for (const c of o.pregas) {
              const cp = c.map(pt => maoProj(pt, vista));
              svg += `<path d="M${n1(cp[0].x)} ${n1(cp[0].y)}Q${n1(cp[1].x)} ${n1(cp[1].y)} ${n1(cp[2].x)} ${n1(cp[2].y)}" stroke="rgba(128,68,42,0.34)" stroke-width="0.95" stroke-linecap="round" fill="none"/>`;
            }
          }
        }
        return svg;
      })();

      partes.push({ z: zt, d: dCostas });
      partes.push({ z: zf, d: dFrente });
      continue;
    }

    if (o.kind === 'membranaTenar') {
      const pts = o.pts.map(pt => maoProj(pt, vista));
      const zm = o.pts.reduce((t, q) => t + q.z, 0) / o.pts.length;
      partes.push({
        z: zm - 0.01,
        d: `<path d="${maoCurva(pts)}" fill="${tomPele(0.66)}" stroke="${tomPele(0.32)}" stroke-width="0.75"/>`,
      });
      continue;
    }

    if (o.kind === 'knuckle') {
      const c = maoProj(o.c, vista);
      const r = o.r * c.s;
      partes.push({
        z: o.c.z,
        d: `<circle cx="${n1(c.x)}" cy="${n1(c.y)}" r="${n1(r)}" fill="${tomPele(0.74 + o.flex * 0.12)}" stroke="${tomPele(0.34)}" stroke-width="0.65"/>`,
      });
      continue;
    }

    if (o.kind === 'oclusaoPalma') {
      const a = maoProj(o.a, vista), b = maoProj(o.b, vista);
      const r1 = o.r1 * a.s, r2 = o.r2 * b.s;
      partes.push({
        z: (a.z + b.z) * 0.5 - 0.015,
        d: maoSegmentoSVG(a, b, r1, r2, `rgba(92,42,20,${n1(o.alpha)})`, null, 0, null),
      });
      continue;
    }

    if (o.kind === 'contactoDedos') {
      const a = maoProj(o.a, vista), b = maoProj(o.b, vista);
      partes.push({
        z: (a.z + b.z) * 0.5 + 0.012,
        d: `<path d="M${n1(a.x)} ${n1(a.y)}L${n1(b.x)} ${n1(b.y)}" stroke="rgba(98,46,24,0.38)" stroke-width="1.25" stroke-linecap="round"/>`,
      });
      continue;
    }

    const a = maoProj(o.a, vista), b = maoProj(o.b, vista);
    /* Escala em perspectiva exacta por extremidade (corrige distorção em escorço) */
    const r1 = o.r1 * a.s, r2 = o.r2 * b.s;
    const zm = (a.z + b.z) / 2;

    if (o.kind === 'braco') {
      if (o.sub === 'pulsoPele') {
        partes.push({
          z: zm - 0.04,
          d: maoSegmentoSVG(a, b, r1, r2, tomPele(0.68), tomPele(0.30), 0.24, null),
        });
      } else {
        sombra.push(maoSegmentoSVG(
          { x: a.x + 2.5, y: a.y + 3.5, z: a.z },
          { x: b.x + 2.5, y: b.y + 3.5, z: b.z },
          r1, r2, 'rgba(90,52,20,.12)', null, 0, null
        ));
        const corManga = '#1D413A';
        partes.push({
          z: zm - 0.18,
          d: maoSegmentoSVG(a, b, r1, r2, corManga, null, 0, null),
        });
      }
      continue;
    }

    /* Falanges dos dedos e do polegar */
    sombra.push(maoSegmentoSVG(
      { x: a.x + 2.2, y: a.y + 3.2, z: a.z },
      { x: b.x + 2.2, y: b.y + 3.2, z: b.z },
      r1, r2, 'rgba(96,50,16,.16)', null, 0, null
    ));

    const dx = b.x - a.x, dy = b.y - a.y, L2d = Math.hypot(dx, dy) || 1;
    const dirLuz = (-dx * MAO_LUZ.x - dy * MAO_LUZ.y) / L2d;
    const l = 0.56 + 0.28 * dirLuz + zm * 0.08 - (o.seg || 0) * 0.025;
    const corPrega = o.seg > 0 ? 'rgba(124,62,36,0.34)' : null;

    let segSVG = maoSegmentoSVG(a, b, r1, r2, tomPele(l), tomPele(0.28), 0.34, corPrega);

    /* Leito ungueal (unha) no lado dorsal da falange distal */
    if (o.unha && o.unha.nDorsal.z > -0.15) {
      const u1 = maoProj(o.unha.base, vista);
      const u2 = maoProj(o.unha.ponta, vista);
      const udx = u2.x - u1.x, udy = u2.y - u1.y, uL = Math.hypot(udx, udy) || 1;
      const unx = -udy / uL, uny = udx / uL;
      const vis = lim(o.unha.nDorsal.z + 0.25, 0.25, 1);
      const w = o.unha.larg * ((u1.s + u2.s) * 0.5) * 0.46 * vis;
      const A = [u1.x + unx * w, u1.y + uny * w];
      const B = [u2.x + unx * w * 0.92, u2.y + uny * w * 0.92];
      const C = [u2.x - unx * w * 0.92, u2.y - uny * w * 0.92];
      const D = [u1.x - unx * w, u1.y - uny * w];
      const tipX = u2.x + (udx / uL) * w * 0.55;
      const tipY = u2.y + (udy / uL) * w * 0.55;
      const baseX = u1.x - (udx / uL) * w * 0.30;
      const baseY = u1.y - (udy / uL) * w * 0.30;
      const dUnha = `M${n1(A[0])} ${n1(A[1])}L${n1(B[0])} ${n1(B[1])}Q${n1(tipX)} ${n1(tipY)} ${n1(C[0])} ${n1(C[1])}L${n1(D[0])} ${n1(D[1])}Q${n1(baseX)} ${n1(baseY)} ${n1(A[0])} ${n1(A[1])}Z`;
      segSVG += `<path d="${dUnha}" fill="hsl(22 52% 84%)" stroke="${tomPele(0.36)}" stroke-width="0.6" opacity="${n1(0.55 + vis * 0.38)}"/>`;
    }

    partes.push({ z: zm, d: segSVG });
  }
  partes.sort((x, y) => x.z - y.z);
  return { sombra: sombra.join(''), d: partes.map(p => p.d).join('') };
}

const escXml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- palco: estúdio + apresentadora ---------------- */
const PALCO = {
  cx: 480,
  cimo: 78, queixo: 222,
  ombroY: 286, ombroX: 136,
};

const PALCO_DEFS = `<defs>
  <linearGradient id="pc-parede" x1="0" y1="0" x2=".75" y2="1">
    <stop offset="0" stop-color="#1A4741"/><stop offset=".55" stop-color="#113230"/><stop offset="1" stop-color="#08191A"/>
  </linearGradient>
  <radialGradient id="pc-halo" cx=".30" cy=".10" r=".72">
    <stop offset="0" stop-color="#7FD6C2" stop-opacity=".26"/><stop offset=".55" stop-color="#2C7E70" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="pc-vinheta" cx=".5" cy=".44" r=".78">
    <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/>
  </radialGradient>
  <linearGradient id="pc-casaco" x1="0" y1="0" x2="1" y2=".35">
    <stop offset="0" stop-color="#24524A"/><stop offset=".42" stop-color="#173C36"/><stop offset="1" stop-color="#0B221F"/>
  </linearGradient>
  <linearGradient id="pc-camisa" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#F2EADA"/><stop offset="1" stop-color="#CDBFA6"/>
  </linearGradient>
  <linearGradient id="pc-cara" x1="0" y1="0" x2="1" y2=".2">
    <stop offset="0" stop-color="#BD8A63"/><stop offset=".42" stop-color="#A26F4C"/><stop offset="1" stop-color="#7A5036"/>
  </linearGradient>
  <linearGradient id="pc-pescoco" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#A5704B"/><stop offset="1" stop-color="#6B432C"/>
  </linearGradient>
  <linearGradient id="pc-faixa" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#061415" stop-opacity="0"/><stop offset=".35" stop-color="#051213" stop-opacity=".72"/><stop offset="1" stop-color="#04100F" stop-opacity=".94"/>
  </linearGradient>
  <radialGradient id="pc-luz">
    <stop offset="0" stop-color="#F0C89E" stop-opacity=".32"/><stop offset=".5" stop-color="#EEC49A" stop-opacity=".11"/><stop offset="1" stop-color="#EEC49A" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="pc-sombra">
    <stop offset="0" stop-color="#3B2012" stop-opacity=".42"/><stop offset=".55" stop-color="#3B2012" stop-opacity=".17"/><stop offset="1" stop-color="#3B2012" stop-opacity="0"/>
  </radialGradient>
  <clipPath id="pc-cara-clip">
    <path d="M480 76C446 76 422 97 417 129c-3 20-2 36 1 50 4 26 25 45 62 47 37-2 58-21 62-47 3-14 4-30 1-50-5-32-29-53-63-53Z"/>
  </clipPath>
</defs>`;

function palcoPresente(rotulo) {
  const texto = (rotulo || 'Em repouso').slice(0, 26);
  const n = texto.length;
  const corpo = `<g class="apresentadora">
    <path d="M446 194h68v60c0 11-15 16-34 16s-34-5-34-16Z" fill="url(#pc-pescoco)"/>
    <ellipse cx="480" cy="228" rx="46" ry="18" fill="url(#pc-sombra)"/>
    <path d="M480 230c-36 0-68 6-98 18-26 10-46 28-56 52-7 17-11 41-13 68l-10 102-8 70h370l-8-70-10-102c-2-27-6-51-13-68-10-24-30-42-56-52-30-12-62-18-98-18Z" fill="url(#pc-casaco)"/>
    <path d="M480 236c-34 0-66 6-96 17-22 8-40 20-52 36 24-9 48-16 74-20 24-4 49-6 74-6s50 2 74 6c26 4 50 11 74 20-12-16-30-28-52-36-30-11-62-17-96-17Z" fill="#2B5F55" opacity=".18"/>
    <path d="M448 234c9 13 55 13 64 0 4 7 4 14 0 21-10 12-54 12-64 0-4-7-4-14 0-21Z" fill="url(#pc-camisa)"/>
    <path d="M451 247l15 4-9 21-11-11Z" fill="#F4EDDD"/>
    <path d="M509 247l-15 4 9 21 11-11Z" fill="#E3D5BC"/>
    <path d="M448 234c9 13 55 13 64 0" stroke="#C9BBA2" stroke-width="1.2" fill="none" opacity=".5"/>
    <path d="M480 248 466 274 442 250 424 258 456 302 480 326Z" fill="#14322D"/>
    <path d="M480 248 494 274 518 250 536 258 504 302 480 326Z" fill="#0E2723"/>
    <path d="M424 258 456 302 480 326" stroke="#071713" stroke-width="1.6" fill="none" opacity=".4"/>
    <path d="M536 258 504 302 480 326" stroke="#071713" stroke-width="1.4" fill="none" opacity=".45"/>
    <path d="M480 76C446 76 422 97 417 129c-3 20-2 36 1 50 4 26 25 45 62 47 37-2 58-21 62-47 3-14 4-30 1-50-5-32-29-53-63-53Z" fill="url(#pc-cara)"/>
    <g clip-path="url(#pc-cara-clip)">
      <ellipse cx="450" cy="162" rx="38" ry="46" fill="url(#pc-luz)"/>
      <ellipse cx="524" cy="198" rx="44" ry="52" fill="url(#pc-sombra)" opacity=".8"/>
      <ellipse cx="480" cy="112" rx="48" ry="22" fill="url(#pc-sombra)" opacity=".45"/>
      <ellipse cx="480" cy="198" rx="24" ry="11" fill="url(#pc-luz)" opacity=".45"/>
      <ellipse cx="480" cy="166" rx="13" ry="21" fill="url(#pc-luz)" opacity=".5"/>
    </g>
    <path d="M409 136c-3-46 22-82 71-82s74 36 71 82c-11-18-31-28-71-28s-60 10-71 28Z" fill="#171310"/>
    <path d="M430 100c7-21 25-35 50-35" stroke="#4B3A2E" stroke-width="6" fill="none" opacity=".3" stroke-linecap="round"/>
    <path d="M444 84c10-7 23-10 36-10M466 72c12-2 24-1 34 4" stroke="#3A2B22" stroke-width="2.4" fill="none" opacity=".45" stroke-linecap="round"/>
    <path d="M410 132c4 1 8 3 11 6-1 13-2 25-2 36l-9 2c-1-15-1-30 0-44Z" fill="#171310"/>
    <path d="M550 132c-4 1-8 3-11 6 1 13 2 25 2 36l9 2c1-15 1-30 0-44Z" fill="#171310"/>
    <path d="M417 152c-9 1-13 19-7 32 3 8 8 10 11 6 2-3 2-8 1-13-1-8-1-18-5-25Z" fill="#8F5F41"/>
    <path d="M543 152c9 1 13 19 7 32-3 8-8 10-11 6-2-3-2-8-1-13 1-8 1-18 5-25Z" fill="#6B432C"/>
    <path d="M414 165c-3 5-4 12-2 17M546 165c3 5 4 12 2 17" stroke="#4A2A1A" stroke-width="1.6" fill="none" opacity=".45" stroke-linecap="round"/>
    <path d="M437 144c11-7 24-7 34-2" stroke="#2B1D16" stroke-width="4.6" fill="none" stroke-linecap="round"/>
    <path d="M489 142c10-5 23-5 34 2" stroke="#2B1D16" stroke-width="4.6" fill="none" stroke-linecap="round"/>
    <path d="M440 157q16-11 32 0-16 10-32 0Z" fill="#F2E8DA"/>
    <path d="M488 157q16-11 32 0-16 10-32 0Z" fill="#F2E8DA"/>
    <circle cx="456" cy="156.5" r="7" fill="#4A2C1C"/>
    <circle cx="504" cy="156.5" r="7" fill="#4A2C1C"/>
    <circle cx="456" cy="156.5" r="3" fill="#120B06"/>
    <circle cx="504" cy="156.5" r="3" fill="#120B06"/>
    <circle cx="458.4" cy="154" r="1.7" fill="#FFF" opacity=".8"/>
    <circle cx="506.4" cy="154" r="1.7" fill="#FFF" opacity=".8"/>
    <path d="M440 157q16-11 32 0" stroke="#1E140E" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M488 157q16-11 32 0" stroke="#1E140E" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M443 166q13 5 26 1" stroke="#5B3522" stroke-width="1.6" fill="none" opacity=".25" stroke-linecap="round"/>
    <path d="M491 167q13 4 26-1" stroke="#5B3522" stroke-width="1.6" fill="none" opacity=".25" stroke-linecap="round"/>
    <path d="M470 150c-4 14-6 26-4 32" stroke="#E9BE94" stroke-width="6" fill="none" opacity=".14" stroke-linecap="round"/>
    <path d="M487 152c4 14 5 26 2 32" stroke="#5B3522" stroke-width="5" fill="none" opacity=".2" stroke-linecap="round"/>
    <path d="M474 190q6-4 12 0" stroke="#4A2A1A" stroke-width="2.6" fill="none" opacity=".4" stroke-linecap="round"/>
    <path d="M466 190q-5 1-6 5" stroke="#4A2A1A" stroke-width="2.6" fill="none" opacity=".45" stroke-linecap="round"/>
    <path d="M490 190q5 1 6 5" stroke="#4A2A1A" stroke-width="2.6" fill="none" opacity=".45" stroke-linecap="round"/>
    <path d="M472 196q8 4 16 0" stroke="#3F2317" stroke-width="2.4" fill="none" opacity=".2" stroke-linecap="round"/>
    <path d="M458 200c10-4 34-4 44 0-10 4-34 4-44 0Z" fill="#7C4133"/>
    <path d="M458 200c10 4 34 4 44 0" stroke="#3B1C16" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M460 202c10 12 34 12 40 0-12 7-30 7-40 0Z" fill="#8E5241" opacity=".85"/>
    <path d="M471 215q9 3 18 0" stroke="#4A2A1A" stroke-width="2" fill="none" opacity=".15" stroke-linecap="round"/>
    <ellipse cx="480" cy="211" rx="10" ry="4" fill="url(#pc-luz)"/>
  </g>`;

  const terco = `<g class="terco">
    <path d="M0 540V470h648l-14 70Z" fill="url(#pc-faixa)"/>
    <rect x="56" y="484" width="5" height="38" rx="2.5" fill="#F7C948"/>
    <text x="78" y="507" font-family="'Baloo 2', system-ui, sans-serif" font-size="${n > 11 ? 26 : 32}" font-weight="600" fill="#FAF6EE">${escXml(texto)}</text>
    <text x="78" y="523" font-family="'Inter', system-ui, sans-serif" font-size="10.5" letter-spacing="2.6" fill="#8FB3AB">LÍNGUA GESTUAL ANGOLANA · POR VALIDAR</text>
  </g>`;

  const selo = `<g class="selo">
    <rect x="852" y="26" width="82" height="26" rx="13" fill="#04100F" opacity=".55"/>
    <circle cx="867" cy="39" r="4" fill="#F7C948"/>
    <text x="878" y="43.5" font-family="'Inter', system-ui, sans-serif" font-size="11" letter-spacing="1.8" fill="#DCE9E4">LGA</text>
  </g>`;

  return `<rect width="960" height="540" fill="url(#pc-parede)"/>
    <rect width="960" height="540" fill="url(#pc-halo)"/>
    <g stroke="#8FE3D0" stroke-width="1" opacity=".07">
      <path d="M196 0v540"/><path d="M764 0v540"/>
    </g>
    ${corpo}
    <rect width="960" height="540" fill="url(#pc-vinheta)"/>
    ${terco}${selo}`;
}

function maoCena(poses, rotulo) {
  const normalizarEsq = p => {
    if (!p || !p.pos) return p;
    /* Se a mão esquerda vier com X negativo (não espelhado), espelha para +X */
    return p.pos[0] < 0
      ? { ...p, pos: [-p.pos[0], p.pos[1], p.pos[2]] }
      : p;
  };
  const poseDir = poses && poses.dir ? poses.dir : null;
  const poseEsq = poses && poses.esq ? normalizarEsq(poses.esq) : null;

  const mao = (pose, lado) => {
    if (!pose) return '';
    const pecas = [...maoBraco(pose, lado), ...maoTransformar(maoPecas(pose.forma, false), pose, lado)];
    const { sombra, d } = maoDesenhar(pecas, MAO_VISTA);
    return `<g>${sombra}${d}</g>`;
  };
  const zd = poseDir ? poseDir.pos[2] : -9, ze = poseEsq ? poseEsq.pos[2] : -9;
  const maos = zd > ze ? mao(poseEsq, 'E') + mao(poseDir, 'D') : mao(poseDir, 'D') + mao(poseEsq, 'E');
  const texto = rotulo || 'Sinalizador a fazer um sinal';
  return `<svg class="signer-cena" viewBox="${MAO_VB}" role="img" aria-label="${escXml(texto)}">${PALCO_DEFS}${palcoPresente(rotulo)}${maos}</svg>`;
}

const MAO_CORPO = PALCO_DEFS + palcoPresente('Em repouso');

/* Miniatura de uma só mão (dicionário) — usa vista local sem corromper MAO_VISTA global */
function maoFigura(forma) {
  const vistaFig = { cx: 160, cy: 262, esc: 360 };
  const pecas = maoTransformar(maoPecas(forma, false), { forma, pos: [0, 0, 0], rot: [0, 0, 0] }, 'D');
  const { sombra, d } = maoDesenhar(pecas, vistaFig);
  const fundo = `<rect width="320" height="320" rx="26" fill="#F7F2E7"/>`;
  return `<svg class="mao-fig" viewBox="${MAO_VB_FIG}" aria-hidden="true" focusable="false">${fundo}${sombra}${d}</svg>`;
}

/* ---------------- notação corrigida: forma + lugar + movimento ---------------- */
/* Geometria de referência do MAO_CORPO em unidades de câmara (cy=306, esc=88):
   - Topo da cabeça (y_px=28): y ≈ 5.65 | Testa (y_px=58): y ≈ 5.05
   - Olhos (y_px=94): y ≈ 4.30        | Boca (y_px=117): y ≈ 3.82
   - Queixo (y_px=148): y ≈ 3.18      | Pescoço (y_px=172): y ≈ 2.70
   - Ombros (y_px=212): y ≈ 1.90      | Peito (y_px=245): y ≈ 1.25
   - Barriga (y_px=292): y ≈ 0.30     | Limite inferior viewBox (y_px=340): y ≈ -0.68
   Como os dedos estendidos sobem ~1.45 unidades acima do pulso, os lugares da
   cabeça posicionam o pulso ~1.35 unidades abaixo do alvo anatómico e ligeiramente
   inclinado para o centro, evitando atravessar a cara ou sair do viewBox. */
const LOCAIS = {
  alto:    { p: [-1.26, 2.62, 0.50], rot: [0, 0, -6] },
  testa:   { p: [-0.89, 2.62, 0.62], rot: [10, 16, -26] },
  olho:    { p: [-0.86, 2.30, 0.64], rot: [12, 16, -24] },
  queixo:  { p: [-0.74, 1.70, 0.68], rot: [18, 18, -22] },
  boca:    { p: [-0.80, 1.86, 0.66], rot: [16, 18, -24] },
  orelha:  { p: [-1.12, 2.28, 0.38], rot: [0, -16, 10] },
  pescoco: { p: [-0.62, 1.92, 0.62], rot: [12, 14, -18] },
  peito:   { p: [-0.92, 1.34, 0.62], rot: [14, 16, -16] },
  barriga: { p: [-0.72, 0.50, 0.66], rot: [16, 0, -20] },
  ombro:   [-1.52, 1.86, 0.50],
  frente:  [-0.82, 1.52, 0.92],
  neutro:  [-1.10, 0.88, 0.42],
  lado:    [-1.66, 1.28, 0.44],
  baixo:   { p: [-0.74, 0.24, 0.72], rot: [26, 0, -12] },
  mao:     [-0.50, 1.34, 0.86],
  /* telhado: pulsos ao lado das têmporas, dedos inclinados para o centro (/ ) */
  telhado: { p: [-1.16, 3.56, 0.54], rot: [8, 10, -40] },
};

/* Deslocamento (dx, dy, dz) e rodagem da mão no fim do movimento */
const MOVIMENTOS = {
  parado:  [[0, 0, 0], [0, 0, 0]],
  frente:  [[0, -0.04, 0.36], [8, 0, 0]],
  tras:    [[0, 0.04, -0.24], [-6, 0, 0]],
  cima:    [[0, 0.28, 0.04], [-12, 0, 0]],
  baixo:   [[0, -0.18, 0.03], [16, 0, 0]],
  onda:    [[0.06, 0.02, 0], [0, 0, 24]],
  arco:    [[-0.22, 0.14, 0.14], [0, 20, -12]],
  circulo: [[0.06, 0.10, 0.10], [8, 34, 12]],
  toque:   [[0.08, -0.04, -0.04], [6, 0, -6]],
  abre:    [[-0.14, 0.02, 0.12], [0, -18, 8]],
  torce:   [[0, 0.04, 0.04], [0, 42, 10]],
  varre:   [[0.34, 0, 0.06], [0, -16, -10]],
  bate:    [[0, -0.14, 0.06], [10, 0, 0]],
  repete:  [[0, -0.12, 0.08], [8, 0, 0]],
};

/* Ajustes por sinal que os três campos não exprimem. A chave é a palavra; os
   valores são opcionais:
     palma  — vector da palma próprio (sobrepõe-se ao do lugar);
     esq    — 'forma local movimento' da mão esquerda, quando o sinal é
              assimétrico (sem 2:, que significa espelho);
     amp    — intensidade em metros por unidade de palco, fora do padrão.
   Vazio por agora: o mecanismo nasce aqui para a autoria sinal a sinal. */
const AJUSTES = {
  /* `nunca`: no vídeo IS é uma mão plana, palma para baixo, que desce da cara
     ao peito. O lugar `testa` põe o punho à altura da cara, mas a descida do
     `baixo` é amortecida para metade (lugares da cabeça); `amp` 1.6 repõe os
     ~16 cm medidos entre o punho de partida e o de chegada. */
  'nunca': { palma: [0, -1, 0.25], amp: 1.6 },
};

/* 'forma local movimento' — uma linha por palavra, com dois-pontos para a mão esquerda */
const SINAIS = {
  'olá': 'abre alto onda', 'bom dia': '2:plano frente bate', 'boa tarde': '2:plano peito baixo',
  'boa noite': 'curva queixo baixo', 'tchau': 'abre alto onda', 'obrigado': 'plano queixo frente',
  'obrigada': 'plano queixo frente', 'como está?': 'abre frente torce', 'bom': 'plano peito frente',
  'mau': 'plano peito baixo', 'por favor': 'plano peito circulo', 'desculpa': 'punho peito circulo',
  'sim': 'L frente bate', 'não': 'aponta frente torce',
  'conversa': '2:aponta frente circulo', 'perguntar': '2:abre frente cima', 'responder': 'aponta queixo frente',
  'falar em lga': '2:abre peito onda',
  'escola': '2:plano peito bate', 'professor': '2:plano frente frente', 'aluno': '2:plano peito frente',
  'caderno': '2:plano frente abre', 'caneta': 'aponta mao frente', 'lápis': 'aponta mao frente',
  'borracha': 'plano mao varre', 'mochila': 'curva ombro bate', 'livro': '2:plano frente abre',
  'carteira': '2:plano frente parado', 'recreio': 'abre frente arco', 'lição': '2:plano mao frente',
  'vermelho': 'aponta boca baixo', 'azul': 'B frente cima', 'verde': 'aponta frente torce',
  'amarelo': 'Y ombro torce', 'preto': 'aponta testa varre', 'branco': 'abre peito toque',
  'laranja': 'curva boca torce', 'roxo': 'aponta frente torce', 'rosa': 'aponta boca baixo',
  'castanho': 'B testa baixo', 'cinza': 'plano peito parado', 'cores': 'abre boca circulo',
  'comer': 'curva boca repete', 'beber': 'C boca cima', 'dormir': '2:plano olho baixo', 'acordar': '2:punho olho abre',
  'andar': '2:aponta frente frente', 'correr': '2:punho frente frente', 'ver': 'V olho frente',
  'escrever': 'aponta mao toque', 'ler': 'aponta mao varre', 'trabalhar': '2:punho frente bate',
  'estudar': 'plano mao cima', 'gostar': 'curva peito frente', 'querer': 'garra frente tras',
  'ter': 'curva peito toque', 'dar': 'plano peito frente', 'fazer': '2:punho frente torce',
  'ajudar': 'punho mao cima', 'brincar': '2:Y frente torce', 'ir': 'aponta frente frente', 'vir': 'aponta frente tras',
  'água': 'abre boca toque', 'pão': 'curva mao varre', 'arroz': 'curva mao frente', 'feijão': 'aponta mao frente',
  'peixe': 'plano frente onda', 'carne': 'F mao frente', 'fruta': 'curva boca torce', 'legumes': 'curva mao frente',
  'leite': 'punho frente repete', 'café': '2:punho peito bate', 'açúcar': 'curva queixo toque', 'sal': 'H mao bate',
  'óleo': 'Y mao baixo', 'comida': 'curva boca repete', 'bebida': 'C boca cima', 'faminta': 'curva barriga baixo',
  'sede': 'aponta pescoco baixo',
  'grande': '2:plano frente abre', 'pequeno': 'F queixo parado', 'bonito': 'abre boca circulo', 'novo': 'plano mao abre',
  'velho': 'aponta mao cima', 'rápido': 'H mao frente', 'lento': '2:plano frente repete',
  'quente': 'plano boca cima', 'frio': '2:punho peito repete', 'feliz': 'plano peito cima', 'triste': 'curva boca baixo',
  'cansado': '2:curva peito baixo', 'doente': 'aponta testa baixo', 'saudável': '2:curva peito frente',
  'como te chamas': '2:H frente bate', 'chamo-me': 'plano peito toque', 'onde fica': '2:abre frente torce',
  'quanto custa': 'F frente torce', 'não entendo': 'aponta testa torce', 'repete por favor': 'curva mao repete',
  'muito bem': '2:punho frente cima', 'até amanhã': 'aponta testa frente',
  'casa': '2:plano frente cima', 'porta': '2:B frente abre', 'janela': '2:B frente bate',
  'cama': 'plano orelha parado', 'mesa': '2:plano frente varre', 'cadeira': '2:H frente baixo',
  'cozinha': '2:plano mao torce', 'quarto': '2:plano frente parado', 'sala': '2:curva frente circulo',
  'casa de banho': 'O peito bate', 'teto': '2:plano telhado varre', 'chão': '2:plano barriga varre',
  'família': '2:F frente circulo', 'mãe': 'abre queixo toque', 'pai': 'abre testa toque',
  'filho': 'plano peito baixo', 'filha': 'plano peito baixo', 'avó': 'punho queixo frente', 'avô': 'punho testa frente',
  'irmão': '2:aponta frente bate', 'irmã': '2:aponta frente bate',
  'hoje': 'aponta baixo bate', 'amanhã': 'A peito frente', 'ontem': 'A peito tras',
  'agora': '2:plano frente baixo', 'depois': 'L mao frente', 'semana': 'aponta mao circulo',
  'mês': 'aponta mao baixo', 'ano': '2:punho frente circulo', 'dia': 'plano frente arco', 'hora': 'aponta mao circulo',
  'janeiro': 'J frente torce', 'fevereiro': 'F frente torce', 'março': 'M frente parado', 'abril': 'A frente parado',
  'maio': 'M frente torce', 'junho': 'J frente parado', 'julho': 'J mao circulo', 'agosto': 'A peito circulo',
  'setembro': 'S frente parado', 'outubro': 'O frente circulo', 'novembro': 'N frente parado', 'dezembro': 'D frente parado',
  'cabeça': 'curva testa toque', 'olho': 'aponta olho toque', 'mão': 'plano mao toque', 'dedo': 'aponta mao toque',
  'boca': 'aponta boca toque', 'nariz': 'aponta olho toque', 'orelha': 'aponta orelha toque', 'ombro': 'curva ombro toque',
  'braço': 'plano ombro baixo', 'perna': 'aponta barriga baixo', 'pé': '2:plano baixo bate', 'barriga': 'plano barriga toque',
  'dente': 'X boca toque', 'cabelo': 'F orelha toque',
  'mercado': '2:plano frente baixo', 'autocarro': '2:C frente onda', 'dinheiro': 'O mao bate',
  'telefone': 'Y orelha parado', 'amigo': '2:X mao bate', 'amiga': '2:X mao bate',
  'computador': 'H mao toque', 'hospital': 'plano mao toque', 'médico': 'B mao toque',
  'igreja': '2:plano telhado parado', 'futebol': 'punho mao frente', 'música': '2:plano frente onda', 'dança': 'V mao onda',
  'roupa': '2:garra peito baixo', 'sapato': '2:punho frente bate', 'cartão': '2:L frente abre',
  'comprar': 'curva mao toque', 'vender': 'plano mao frente', 'pagar': 'aponta mao frente', 'esperar': '2:abre frente onda',
  'chegar': 'plano mao bate', 'precisar': 'X frente baixo', 'poder': '2:punho lado cima', 'dever': 'aponta queixo frente',
  'cedo': 'curva mao cima', 'tarde': 'plano frente baixo', 'sempre': '2:plano frente circulo', 'nunca': 'B testa baixo',
  'muito': '2:abre lado cima', 'pouco': 'F queixo toque', 'aqui': 'aponta baixo baixo', 'ali': 'aponta frente frente',
  'devagar': '2:plano frente repete',
};

/* 'forma local movimento' → {forma, inicio, fim, duas} */
function sinalNotacao(chave) {
  const bruto = SINAIS[chave];
  if (!bruto) return null;
  return sinalDeNotacao(bruto, AJUSTES[chave] || {});
}

/* 'forma local movimento' → geometria do beat; serve quem traz a notação de fora
   da tabela SINAIS (as poses da LGA) sem inventar uma entrada no glossário */
function sinalDeNotacao(bruto, aj) {
  let texto = String(bruto || '');
  let duas = false;
  if (texto.startsWith('2:')) { duas = true; texto = texto.slice(2); }
  const [forma, local, mov] = texto.split(/\s+/);
  if (!FORMAS_MAO[forma] || !LOCAIS[local]) return null;
  const [delta, giro] = MOVIMENTOS[mov] || MOVIMENTOS.parado;
  const L = LOCAIS[local];
  const p = Array.isArray(L) ? L : L.p;
  const base = Array.isArray(L) ? [0, 0, 0] : L.rot;
  const ajuste = aj || {};
  return {
    forma, duas, movimento: mov, local, reps: mov === 'repete' ? 2 : 1,
    inicio: { forma, pos: p.slice(), rot: base.slice() },
    fim: {
      forma,
      pos: [p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]],
      rot: [base[0] + giro[0], base[1] + giro[1], base[2] + giro[2]],
    },
    palma: ajuste.palma || null,
    esq: ajuste.esq ? notacaoParcial(ajuste.esq) : null,
    amp: ajuste.amp || null,
  };
}

/* 'forma local movimento' da mão esquerda de um sinal assimétrico */
function notacaoParcial(texto) {
  const [forma, local, mov] = String(texto).split(/\s+/);
  if (!FORMAS_MAO[forma] || !LOCAIS[local]) return null;
  return { forma, local, movimento: mov || 'parado' };
}

/* Interpola duas formas de mão osso a osso com limites articulares e arco de
   desimpedimento do polegar (evita que o polegar atravesse o indicador a meio) */
function formaMisturar(fa, fb, e) {
  const A = formaDe(fa), B = formaDe(fb);
  const t = lim(e, 0, 1);
  const mix = (x, y) => x + (y - x) * t;
  const out = { esp: A.esp.map((v, idx) => lim(mix(v, B.esp[idx]), -18, 18)) };
  ['i', 'm', 'r', 'p'].forEach(k => {
    out[k] = A[k].map((v, idx) => lim(mix(v, B[k][idx]), LIMITES_DEDO[idx][0], LIMITES_DEDO[idx][1]));
  });
  /* Se os dedos mudam entre aberto e fechado enquanto o polegar cruza, adiciona
     um pequeno arco de abertura em sin(pi * t) para não colidir com o indicador */
  const arcoPolegar = Math.sin(Math.PI * t) * (Math.abs(A.i[0] - B.i[0]) > 45 ? 10 : 0);
  out.t = [
    lim(mix(A.t[0], B.t[0]) + arcoPolegar, LIMITES_POLEGAR[0][0], LIMITES_POLEGAR[0][1]),
    lim(mix(A.t[1], B.t[1]), LIMITES_POLEGAR[1][0], LIMITES_POLEGAR[1][1]),
    lim(mix(A.t[2], B.t[2]), LIMITES_POLEGAR[2][0], LIMITES_POLEGAR[2][1]),
  ];
  return out;
}

/* Interpola duas poses de mão (posição, rotação pelo caminho angular mais curto e ângulos dos dedos) */
function maoMisturar(a, b, t) {
  const u = lim(t, 0, 1);
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const mix = (x, y) => x + (y - x) * e;
  const mixAng = (x, y) => {
    const d = ((y - x + 540) % 360) - 180;
    return x + d * e;
  };
  const ra = a.rot || [0, 0, 0], rb = b.rot || [0, 0, 0];
  return {
    forma: formaMisturar(formaDe(a.forma), formaDe(b.forma), e),
    pos: [mix(a.pos[0], b.pos[0]), mix(a.pos[1], b.pos[1]), mix(a.pos[2], b.pos[2])],
    rot: [mixAng(ra[0], rb[0]), mixAng(ra[1], rb[1]), mixAng(ra[2], rb[2])],
  };
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    FORMAS_MAO, LOCAIS, MOVIMENTOS, SINAIS, AJUSTES,
    sinalNotacao, sinalDeNotacao, maoFigura, maoCena, maoMisturar, formaMisturar,
    MAO_CORPO, MAO_VISTA,
  });
}
if (typeof globalThis !== 'undefined') {
  Object.assign(globalThis, {
    FORMAS_MAO, LOCAIS, MOVIMENTOS, SINAIS,
    sinalNotacao, sinalDeNotacao, maoFigura, maoCena, maoMisturar, formaMisturar,
    MAO_CORPO, MAO_VISTA,
  });
}
