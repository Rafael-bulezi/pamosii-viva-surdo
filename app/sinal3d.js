/* ============================================================================
   SINAL 3D — converte a notação da casa (forma · local · movimento) em passos
   de osso para o avatar.
   As unidades do palco servem para o desenho em SVG, não para um corpo real:
   por isso cada lugar (queixo, peito, alto…) é ancorado nos ossos do avatar e
   só o deslocamento do movimento é convertido por uma escala.
   ============================================================================ */
(function (global) {
  'use strict';

  /* Deslocamento por movimento, em metros por unidade de palco. Um toque anda
     milímetros; um varre atravessa o corpo. A escala única (0,37) fazia tudo
     parecer parado — medido: punho a 5,7 cm por sinal, contra 40–70 cm/s num
     sinalizador real. */
  const AMPL = {
    parado: 0, frente: 0.55, tras: 0.45, cima: 0.60, baixo: 0.58, onda: 0.50,
    arco: 0.70, circulo: 0.70, toque: 0.40, abre: 0.60, torce: 0.50, varre: 0.75,
    bate: 0.40, repete: 0.40,
  };
  const ESC_PADRAO = 0.50;
  /* À frente da cara o mesmo deslocamento atravessa a cabeça: os lugares do
     rosto andam a pouco mais de metade. */
  const CABECA = { testa: 1, olho: 1, boca: 1, queixo: 1, orelha: 1, pescoco: 1, telhado: 1 };
  const ESC_MOV = 0.55;
  const lerp = (a, b, t) => a + (b - a) * t;
  /* rotação de um vector por ângulos XYZ em graus (mesma convenção do pulso) */
  function virar(v, g) {
    const [ax, ay, az] = g.map(d => (d || 0) * Math.PI / 180);
    const cx = Math.cos(ax), sx = Math.sin(ax);
    const cy = Math.cos(ay), sy = Math.sin(ay);
    const cz = Math.cos(az), sz = Math.sin(az);
    const x1 = v[0], y1 = v[1] * cx - v[2] * sx, z1 = v[1] * sx + v[2] * cx;
    const x2 = x1 * cy + z1 * sy, y2 = y1, z2 = -x1 * sy + z1 * cy;
    const x3 = x2 * cz - y2 * sz, y3 = x2 * sz + y2 * cz, z3 = z2;
    const n = Math.hypot(x3, y3, z3) || 1;
    return [x3 / n, y3 / n, z3 / n];
  }
  /* mão que não assina: ao lado do corpo, não no ar */
  const REPOUSO_E = { mao: [0.285, 0.962, 0.17], pulso: [0, 0, 0], forma: 'relax', palma: [-0.95, 0, -0.3] };
  /* quando o lugar É a palma da outra mão, a outra mão existe: palma para cima,
     à frente do peito, debaixo da mão que assina (10 cm entre punhos) */
  const PARCEIRA = { mao: [0.05, 1.19, 0.30], pulso: [0, 0, 0], forma: 'plano', palma: [0, 1, 0.25], rolar: 90 };

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
      barriga: { mao: [-0.10, cintura + 0.02, 0.17], rot: [4, 0, 0], palma: [0, 0, -1] },
      ombro:   { mao: [-0.22, ombro + 0.02, 0.10], rot: [0, 0, 0], palma: [0, 0, -1] },
      frente:  { mao: [-0.16, 1.266, 0.36], rot: [0, 0, 0], palma: [0, 0, 1] },
      neutro:  { mao: [-0.30, 1.02, 0.17], rot: [0, 0, 0] },
      lado:    { mao: [-0.36, 1.096, 0.12], rot: [0, 0, 0], palma: [0, 0, 1] },
      /* o alvo antigo (cintura−0,16, 28 cm à frente) ficava 13,6 cm fora do
         alcance do braço: o IK esticava e a mão nunca lá chegava. Mediu-se o
         punho alcançável a 0,877 m e pôs-se o alvo aí; os dedos descem até
         ~0,70 m, abaixo da anca. */
      baixo:   { mao: [-0.15, cintura + 0.05, 0.21], rot: [4, 0, 0], palma: [0, 0, -1] },
      mao:     { mao: [-0.05, 1.226, 0.30], rot: [4, 0, 0], palma: [0, -1, 0.35] },
      telhado: { mao: [-0.15, topo + 0.05, 0.16], rot: [0, 0, 0], palma: [0, -1, 0.5] },
    };
    return ANC;
  }

  const espelhar = p => [-p[0], p[1], p[2]];

  /* pose no instante k (0..1) de uma passagem A→B */
  function poseEm(b, k) {
    const A = ancoras();
    const L = A[b.local] || A.frente;
    let esc = typeof b.amp === 'number' && b.amp > 0
      ? b.amp
      : (AMPL[b.movimento] !== undefined ? AMPL[b.movimento] : ESC_PADRAO);
    if (CABECA[b.local]) esc *= 0.55;
    /* A palma da outra mão é uma superfície com ~10 cm: um movimento de 25 cm
       tirava o dedo de cima dela. No lugar `mao` o deslocamento é amortecido
       para o sinal ficar em cima da palma; a rotação mantém-se inteira. */
    const anda = b.local === 'mao' ? esc * 0.35 : esc;
    const d = [
      ((b.pos1[0] || 0) - (b.pos0[0] || 0)) * anda,
      ((b.pos1[1] || 0) - (b.pos0[1] || 0)) * anda,
      ((b.pos1[2] || 0) - (b.pos0[2] || 0)) * anda,
    ];
    /* Num sinal espelhado a varredura é para fora. `varre` anda +0,255 m e a
       mão que assina ia de −0,16 a +0,095 — a esquerda ao contrário — e no fim
       os antebraços cruzavam-se em X (`mesa`, `teto`, `chão`). A componente
       lateral que aponta para o meio do corpo inverte-se; só dispara quando as
       duas mãos existem e o deslocamento aponta contra o lado da mão. */
    if (b.duas && d[0] && Math.sign(d[0]) !== Math.sign(L.mao[0])) d[0] = -d[0];
    const g = [
      ((b.rot1 && b.rot1[0]) || 0) - ((b.rot0 && b.rot0[0]) || 0),
      ((b.rot1 && b.rot1[1]) || 0) - ((b.rot0 && b.rot0[1]) || 0),
      ((b.rot1 && b.rot1[2]) || 0) - ((b.rot0 && b.rot0[2]) || 0),
    ];
    const mao = [L.mao[0] + d[0] * k, L.mao[1] + d[1] * k, L.mao[2] + d[2] * k];
    const pulso = [L.rot[0] + g[0] * k * 0.7, L.rot[1] + g[1] * k * 0.7, L.rot[2] + g[2] * k * 0.7];
    /* A palma pertence ao sinal, não ao lugar: se existe alvo de palma, a rodagem
       do movimento roda a palma (antes era deitada fora, porque o pulso só vale
       quando não há palma). */
    const basePalma = b.palma || L.palma || null;
    const palma = basePalma ? virar(basePalma, [g[0] * k, g[1] * k, 0]) : null;
    /* A rodagem em Z não muda a normal da palma: é o punho a inclinar-se (o
       aceno). Antes era deitada fora com o pulso; segue à parte. */
    const rolar = basePalma ? g[2] * k : 0;
    const dMao = { mao, pulso, forma: b.forma, palma, rolar };
    /* Lugares baixos obrigam o tronco a inclinar-se para a frente: é o que um
       sinalizador faz para apontar abaixo da anca, e é o que faz o ombro
       chegar lá — sem isto o IK esticava e a mão ficava 17 cm aquém. */
    const inclina = Math.max(0, Math.min(14, (1.16 - mao[1]) * 90));
    const corpo = inclina > 0.6 ? [inclina, 0] : null;

    /* sinal assimétrico: a esquerda tem forma, lugar e movimento próprios */
    if (b.esq && b.esq.local) {
      const L2 = A[b.esq.local] || A.frente;
      const M2 = (global.MOVIMENTOS && global.MOVIMENTOS[b.esq.movimento]) || [[0, 0, 0], [0, 0, 0]];
      const e2 = AMPL[b.esq.movimento] !== undefined ? AMPL[b.esq.movimento] : ESC_PADRAO;
      const mao2 = L2.mao.map((v, i) => v + (M2[0][i] || 0) * e2);
      const palma2 = L2.palma ? virar(L2.palma, (M2[1] || [0, 0, 0]).map(v => v)) : null;
      return { corpo, D: dMao, E: { mao: mao2, pulso: (L2.rot || [0, 0, 0]).slice(), forma: b.esq.forma, palma: palma2 } };
    }
    if (!b.duas || b.local === 'mao') {
      /* `2:` com lugar na palma não existe: a palma É a outra mão. Espelhar
         punha as duas mãos no mesmo ponto (lição, cozinha, amigo, amiga). */
      const P = b.local === 'mao' ? PARCEIRA : REPOUSO_E;
      return { corpo, D: dMao, E: { mao: P.mao.slice(), pulso: P.pulso.slice(), forma: P.forma, palma: P.palma.slice(), rolar: P.rolar || 0 } };
    }
    /* mãos que se tocam (`telhado`) ficam como estão; as outras ganham 3 cm
       por lado, senão a 16 cm de distância os dedos atravessam-se */
    const folga = b.local === 'telhado' ? 0 : 0.03;
    const maoD = [mao[0] - folga, mao[1], mao[2]];
    return {
      sim: true,
      corpo,
      D: { ...dMao, mao: maoD },
      E: {
        mao: espelhar(maoD),
        pulso: [pulso[0], -pulso[1], -pulso[2]],
        forma: b.forma,
        palma: palma ? espelhar(palma) : null,
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
      /* chegar, parar e segurar: um sinal não acaba a meio do gesto */
      passos.push({ pose: pA, dur: dur * 0.36, mistura: 0.14 });
      passos.push({ pose: pB, dur: dur * 0.48, mistura: 0.22 });
      passos.push({ pose: pB, dur: dur * 0.16, mistura: 0.03 });
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

  global.SINAL3D = { passosDeBeat, sequencia, poseEm, ancoras, ESC_MOV, AMPL };
})(window);
