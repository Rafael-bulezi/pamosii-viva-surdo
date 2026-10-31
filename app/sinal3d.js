/* ============================================================================
   SINAL 3D — converte a notação da casa (forma · local · movimento) em passos
   de osso para o avatar.
   As unidades do palco servem para o desenho em SVG, não para um corpo real:
   por isso cada lugar (queixo, peito, alto…) é ancorado nos ossos do avatar e
   só o deslocamento do movimento é convertido por uma escala.
   ============================================================================ */
(function (global) {
  'use strict';

  const ESC_MOV = 0.37; /* unidade de palco → metro, apenas para deslocamentos */
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------- lugares em metros, tirados da anatomia ---------------- */
  let ANC = null;

  function ancoras() {
    if (ANC) return ANC;
    const o = (global.AVATAR && global.AVATAR.ossos) || {};
    const T = global.THREE;
    const alt = (nome, padrao) => {
      const b = o[nome];
      return (b && T) ? b.getWorldPosition(new T.Vector3()).y : padrao;
    };
    const topo = (global.AVATAR && global.AVATAR.modelo && global.AVATAR.modelo.userData.topo) || 1.78;
    const ombro = alt('J_Bip_R_UpperArm', 1.41);
    const cintura = alt('J_Bip_C_Hips', 1.01);

    /* marcas medidas na malha do modelo, não nos pivôs dos ossos:
       olhos 1,598 · boca 1,525 · queixo 1,480 · esterno 1,27 (o osso Chest
       assenta no tronco, a 1,066) · punho→ponta do dedo médio 0,17 m */
    ANC = {
      /* punho calibrado no modelo MPFB: a mão segue o antebraço, por isso os
         lugares à frente do corpo levam uma extensão de punho (~50°) para os
         dedos apontarem para cima, e a altura é a do PUNHO — a ponta dos dedos
         fica ~0,17 m acima. */
      alto:    { mao: [-0.42, topo - 0.20, 0.20], rot: [0, 0, 0], palma: [0, 0, 1] },
      testa:   { mao: [-0.11, 1.460, 0.17], rot: [-50, 0, 0], palma: [0, 0, -1] },
      olho:    { mao: [-0.11, 1.428, 0.17], rot: [-50, 0, 0], palma: [0, 0, -1] },
      boca:    { mao: [-0.10, 1.355, 0.17], rot: [-50, 0, 0], palma: [0, 0, -1] },
      queixo:  { mao: [-0.10, 1.310, 0.17], rot: [-50, 0, 0], palma: [0, 0.35, -1] },
      orelha:  { mao: [-0.21, 1.560, 0.04], rot: [0, -6, 0], palma: [0, 0, -1] },
      pescoco: { mao: [-0.09, 1.270, 0.16], rot: [-50, 0, 0], palma: [0, 0, -1] },
      peito:   { mao: [-0.11, 1.270, 0.19], rot: [4, 0, 0], palma: [0, 0, -1] },
      barriga: { mao: [-0.10, cintura - 0.02, 0.24], rot: [4, 0, 0], palma: [0, 0, -1] },
      ombro:   { mao: [-0.22, ombro + 0.02, 0.10], rot: [0, 0, 0], palma: [0, 0, -1] },
      frente:  { mao: [-0.16, 1.266, 0.36], rot: [0, 0, 0], palma: [0, 0, 1] },
      neutro:  { mao: [-0.30, 1.02, 0.17], rot: [0, 0, 0] },
      lado:    { mao: [-0.36, 1.096, 0.12], rot: [0, 0, 0], palma: [0, 0, 1] },
      baixo:   { mao: [-0.15, cintura - 0.16, 0.28], rot: [4, 0, 0], palma: [0, 0, -1] },
      mao:     { mao: [-0.05, 1.226, 0.30], rot: [4, 0, 0], palma: [0, 1, 0.3] },
      telhado: { mao: [-0.15, topo + 0.05, 0.16], rot: [0, 0, 0], palma: [0, -1, 0.5] },
    };
    return ANC;
  }

  const espelhar = p => [-p[0], p[1], p[2]];

  /* pose no instante k (0..1) de uma passagem A→B */
  function poseEm(b, k) {
    const L = ancoras()[b.local] || ancoras().frente;
    const d = [
      ((b.pos1[0] || 0) - (b.pos0[0] || 0)) * ESC_MOV,
      ((b.pos1[1] || 0) - (b.pos0[1] || 0)) * ESC_MOV,
      ((b.pos1[2] || 0) - (b.pos0[2] || 0)) * ESC_MOV,
    ];
    const g = [
      ((b.rot1 && b.rot1[0]) || 0) - ((b.rot0 && b.rot0[0]) || 0),
      ((b.rot1 && b.rot1[1]) || 0) - ((b.rot0 && b.rot0[1]) || 0),
      ((b.rot1 && b.rot1[2]) || 0) - ((b.rot0 && b.rot0[2]) || 0),
    ];
    const mao = [L.mao[0] + d[0] * k, L.mao[1] + d[1] * k, L.mao[2] + d[2] * k];
    const pulso = [L.rot[0] + g[0] * k * 0.7, L.rot[1] + g[1] * k * 0.7, L.rot[2] + g[2] * k * 0.7];
    const dMao = { mao, pulso, forma: b.forma, palma: L.palma };

    if (!b.duas) {
      return { D: dMao, E: { mao: [0.30, 1.02, 0.17], pulso: [0, 0, 0], forma: 'curva' } };
    }
    return {
      sim: true,
      D: dMao,
      E: {
        mao: espelhar(mao),
        pulso: [pulso[0], -pulso[1], -pulso[2]],
        forma: b.forma,
        palma: L.palma ? espelhar(L.palma) : null,
      },
    };
  }

  /* cabeça e expressão por tipo de palavra */
  const PERGUNTA = /^(como|quando|onde|porqu[eê]|quem|qual|quanto|perguntar)/i;

  function rostoDe(b) {
    const p = String(b.rotulo || '').toLowerCase();
    if (b.rotulo === '?') return { cabeca: [3, 0, -7], expr: 'surpresa' };
    if (PERGUNTA.test(p) || /\?$/.test(b.rotulo || '')) return { cabeca: [3, 0, -6], expr: 'surpresa' };
    if (/^(n[ãa]o|nunca|mau|triste|doente)$/.test(p)) return { cabeca: [2, 0, 0], expr: 'serio' };
    if (/^(ol[áa]|bom dia|boa tarde|obrigad|gostar|amor|feliz|alegre|bem|tchau)$/.test(p)) return { cabeca: [2, 0, 2], expr: 'alegre' };
    return { expr: 'neutro' };
  }

  function passosDeBeat(b) {
    if (!b || b.tipo === 'pausa') {
      return [{
        pose: { D: { mao: [-0.30, 1.02, 0.17], forma: 'curva' }, E: { mao: [0.30, 1.02, 0.17], forma: 'curva' } },
        dur: (b && b.dur ? b.dur : 260) / 1000, mistura: 0.2,
      }];
    }

    const base = { ...rostoDe(b) };
    const passos = [];
    /* frações do mesmo compasso: a soma dos passos = duração do beat, para que
       o relógio da aplicação e o da pose nunca se desencontrem */
    const dur = (b.dur || 760) / 1000;
    const pA = { ...base, ...poseEm(b, 0) };
    const pB = { ...base, ...poseEm(b, 1) };

    if (b.reps === 2) {
      passos.push({ pose: pA, dur: dur * 0.25, mistura: 0.12 });
      passos.push({ pose: pB, dur: dur * 0.25, mistura: 0.12 });
      passos.push({ pose: pA, dur: dur * 0.25, mistura: 0.12 });
      passos.push({ pose: pB, dur: dur * 0.25, mistura: 0.12 });
    } else {
      passos.push({ pose: pA, dur: dur * 0.42, mistura: 0.14 });
      passos.push({ pose: pB, dur: dur * 0.58, mistura: 0.22 });
    }
    return passos;
  }

  /* sequência completa de uma lista de beats; cada passo sabe a que beat pertence */
  function sequencia(beats) {
    const out = [];
    beats.forEach((b, i) => {
      passosDeBeat(b).forEach((p) => out.push({ ...p, beat: i, rotulo: b.rotulo || '' }));
    });
    return out;
  }

  global.SINAL3D = { passosDeBeat, sequencia, poseEm, ancoras, ESC_MOV };
})(window);
