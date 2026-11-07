/* ============================================================================
   LGA-3D — leitura nossa das aulas, não validada pela comunidade.
   ----------------------------------------------------------------------------
   Camada de poses 3D exclusiva para a aba LGA, produzida por observação
   segundo a segundo dos fotogramas das aulas do canal Viva surdo.
   Cada entrada associa a chave normalizada da palavra à sua notação (forma,
   lugar, movimento) e replica aula, segundos, confiança e veSe de lga.js.
   `notacao` aceita uma string ou uma lista de strings: um compasso por passo,
   para os sinais compostos (`bom dia` = polegar erguido + mão que sobe).
   Esta camada NUNCA altera SINAIS, o glossário nem os dados de International Sign.
   ============================================================================ */
(function (global) {
  'use strict';

  const SINAIS_LGA = {
    'oi/ola': {
      notacao: 'abre rosto aceno',
      /* o aceno tem duas idas e voltas: a 760 ms cada passo a mão tremia */
      dur: 1700,
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [2, 7],
      confianca: 'alta',
      veSe: 'mão direita aberta com os dedos afastados, palma para a frente à altura da cara, acena de lado a lado',
    },
    'bom dia': {
      notacao: ['joinha peito parado', 'plano queixo nasce'],
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [19, 27],
      confianca: 'alta',
      veSe: 'polegar erguido à frente do peito; depois a mão plana sobe do queixo ao lado da cara com a palma virada para si (o sol a nascer)',
    },
    'bom/boa/bem': {
      notacao: 'joinha peito frente',
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [10, 16],
      confianca: 'alta',
      veSe: 'mão direita fecha em punho e projeta o polegar estendido para cima (sinal de positivo)',
    },
    'obrigado/a': {
      notacao: '2:plano boca frente',
      aproximado: true,
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [102, 107],
      confianca: 'alta',
      veSe: 'pontas dos dedos de ambas as mãos tocam nos lábios/queixo e projetam-se abertas para a frente com palmas para cima',
    },
    'por favor': {
      notacao: 'plano boca frente',
      aproximado: true,
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [123, 129],
      confianca: 'alta',
      veSe: 'pontas dos dedos da mão direita tocam suavemente nos lábios/queixo e projetam-se suavemente para o interlocutor',
    },
    'ouvinte': {
      notacao: 'C orelha parado',
      aproximado: true,
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [150, 154],
      confianca: 'alta',
      veSe: 'mão direita curvada em concha/arco junto ao ouvido direito (atenção auditiva / escuta)',
    },
    'tchau/adeus': {
      notacao: 'abre alto onda',
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [167, 171],
      confianca: 'alta',
      veSe: 'mão direita aberta com palma virada para a frente acena lateralmente em despedida',
    },
    'dois': {
      notacao: 'Y peito parado',
      aula: 'Aula 03 — Números',
      segundos: [8, 11],
      confianca: 'média',
      veSe: "mão direita com polegar e dedo mínimo estendidos (configuração em 'Y' / shaka), palma virada para o peito",
    },
    'três': {
      notacao: 'tres peito parado',
      aula: 'Aula 03 — Números',
      segundos: [13, 25],
      confianca: 'média',
      veSe: "três dedos centrais estendidos verticalmente (indicador, médio e anelar) ou configuração em 'W', polegar a segurar o mínimo",
    },
    'quatro': {
      notacao: 'B peito parado',
      aproximado: true,
      aula: 'Aula 03 — Números',
      segundos: [26, 37],
      confianca: 'média',
      veSe: 'quatro dedos estendidos e afastados (indicador, médio, anelar, mínimo), com o polegar dobrado sobre a palma',
    },
    'cinco': {
      notacao: 'joinha peito parado',
      aula: 'Aula 03 — Números',
      segundos: [38, 45],
      confianca: 'média',
      veSe: 'punho fechado com o polegar estendido para cima',
    },
    'seis': {
      notacao: 'aponta peito parado',
      aula: 'Aula 03 — Números',
      segundos: [46, 53],
      confianca: 'média',
      veSe: 'dedo indicador estendido para cima, palma virada para a frente, outros dedos recolhidos',
    },
    'oito': {
      notacao: 'F peito parado',
      aproximado: true,
      aula: 'Aula 03 — Números',
      segundos: [59, 74],
      confianca: 'média',
      veSe: "polegar e indicador unidos em círculo/pinça (configuração em 'F'), com os outros três dedos estendidos para cima",
    },
    'ver': {
      notacao: 'aponta olho toque',
      aula: 'Aula 06 — Verbos de LGA 1',
      segundos: [15, 16],
      confianca: 'alta',
      veSe: 'dedo indicador da mão direita aponta para junto do olho e projeta-se ligeiramente para a frente',
    },
    'comer': {
      notacao: 'curva boca repete',
      aproximado: true,
      aula: 'Aula 06 — Verbos de LGA 1',
      segundos: [37, 40],
      confianca: 'alta',
      veSe: 'mão direita com dedos juntos em cúspide/pinça fecha repetidamente junto à boca',
    },
    'poder': {
      notacao: '2:punho ombro baixo',
      aula: 'Aula 06 — Verbos de LGA 1',
      segundos: [71, 74],
      confianca: 'alta',
      veSe: 'ambas as mãos em punho cerrado à altura dos ombros descem firmemente à frente do peito com movimento assertivo',
    },
    'falar': {
      notacao: 'curva boca frente',
      aproximado: true,
      aula: 'Aula 06 — Verbos de LGA 1',
      segundos: [97, 101],
      confianca: 'alta',
      veSe: 'mão direita aberta junto à boca fecha os 4 dedos contra o polegar (bico) repetidamente saindo da boca para a frente',
    },
    'ter': {
      notacao: 'joinha peito toque',
      aula: 'Aula 06 — Verbos de LGA 1',
      segundos: [110, 112],
      confianca: 'alta',
      veSe: 'mão direita fechada em punho com o polegar estendido toca no peito com a ponta do polegar',
    },
    'amar': {
      notacao: 'plano peito toque',
      aula: 'Aula 06 — Verbos de LGA 1',
      segundos: [136, 138],
      confianca: 'alta',
      veSe: 'mão direita aberta pousa suavemente sobre o lado esquerdo do peito (coração)',
    },
  };

  global.SINAIS_LGA = SINAIS_LGA;
})(typeof window !== 'undefined' ? window : globalThis);
