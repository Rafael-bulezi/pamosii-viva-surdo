/* ============================================================================
   LGA-3D — leitura nossa das aulas, não validada pela comunidade.
   ----------------------------------------------------------------------------
   Camada de poses 3D exclusiva para a aba LGA, produzida por observação
   segundo a segundo dos fotogramas das aulas do canal Viva surdo.
   Cada entrada associa a chave normalizada da palavra à sua notação (forma,
   lugar, movimento) e replica aula, segundos, confiança e veSe de lga.js.
   Esta camada NUNCA altera SINAIS, o glossário nem os dados de International Sign.
   ============================================================================ */
(function (global) {
  'use strict';

  const SINAIS_LGA = {
    'oi/ola': {
      notacao: 'abre alto onda',
      aula: 'Aula 01 — Saudação de LGA',
      segundos: [2, 7],
      confianca: 'alta',
      veSe: 'mão direita aberta com palma voltada para a frente à altura da cabeça a acenar suavemente',
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
      aula: 'Aula 03 — Números',
      segundos: [59, 74],
      confianca: 'média',
      veSe: "polegar e indicador unidos em círculo/pinça (configuração em 'F'), com os outros três dedos estendidos para cima",
    },
  };

  global.SINAIS_LGA = SINAIS_LGA;
})(typeof window !== 'undefined' ? window : globalThis);
