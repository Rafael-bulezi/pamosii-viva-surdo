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
  };

  global.SINAIS_LGA = SINAIS_LGA;
})(typeof window !== 'undefined' ? window : globalThis);
