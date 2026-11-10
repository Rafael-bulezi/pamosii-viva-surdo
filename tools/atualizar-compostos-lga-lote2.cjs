/* ============================================================================
   tools/atualizar-compostos-lga-lote2.cjs
   Auditoria detalhada de 47 sinais que continham apenas 1 compasso/passo e
   que passam a notação de 2 a 3 compassos conforme as evidências de vídeo.
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lga3dPath = path.join(raiz, 'app/lga-3d.js');

const UPDATES_BATCH_2 = {
  // Saudação
  'desculpa': ['Y mao toque', 'Y mao varre'],
  'bom/boa/bem': ['punho peito parado', 'joinha peito frente'],

  // Números
  'dez': ['joinha peito parado', 'joinha peito onda'],

  // Verbos 1
  'estudar': ['plano mao toque', 'plano mao bate', 'plano mao bate'],
  'trabalhar': ['2:punho peito toque', '2:punho peito bate'],
  'cozinhar': ['punho mao toque', 'punho mao circulo'],
  'ler': ['V mao toque', 'V mao varre'],
  'sentar': ['curva peito frente', 'curva mao toque'],
  'levantar': ['V mao toque', 'V mao cima'],
  'perder': ['2:plano peito frente', '2:plano peito baixo'],
  'levar': ['2:plano peito parado', '2:plano lado frente'],
  'trazer': ['2:garra frente parado', '2:garra peito tras'],
  'pedir': ['2:plano peito toque', '2:plano frente frente'],
  'comer': ['curva peito frente', 'curva boca toque'],
  'poder': ['2:punho ombro parado', '2:punho peito baixo'],

  // Comida 1
  'sopa': ['curva peito frente', 'curva boca toque'],
  'funge': ['punho barriga circulo', 'punho barriga bate'],
  'massa-macarrao': ['2:Y peito toque', '2:Y lado onda'],
  'arroz': ['curva mao toque', 'curva mao repete'],

  // Comida 2
  'ovo': ['2:curva peito toque', '2:curva peito baixo'],
  'cafe': ['F peito frente', 'F mao toque'],
  'manteiga': ['H mao toque', 'H mao varre'],
  'leite': ['abre orelha parado', 'punho orelha repete'],
  'hamburguer': ['2:C peito frente', '2:C peito toque'],

  // Casa 1
  'lampada': ['curva alto baixo', 'abre alto cima'],
  'colher': ['curva peito frente', 'curva boca toque'],
  'garfo': ['tres peito frente', 'tres boca toque'],
  'tomada': ['aponta peito frente', 'aponta mao toque'],
  'quarto': ['plano rosto toque', '2:plano peito parado'],
  'chao': ['2:plano peito baixo', '2:plano baixo varre'],
  'casa': ['2:plano alto frente', '2:plano alto bate'],

  // Casa 2
  'chave': ['F peito frente', 'F peito torce'],
  'fora': ['plano mao toque', 'plano frente frente'],
  'dentro': ['curva peito frente', 'curva mao toque'],
  'elevador': ['plano mao toque', 'plano alto cima'],
  'arca': ['2:punho baixo parado', '2:punho peito cima'],
  'mesa': ['2:plano peito toque', '2:plano lado varre'],
  'em cima': ['plano peito toque', 'plano alto cima'],
  'em baixo': ['plano peito toque', 'plano baixo baixo'],

  // Tempos e Meses
  'setembro': ['2:F ombro frente', '2:F peito baixo'],
  'fevereiro': ['abre olho toque', 'abre rosto onda'],
  'hoje/agora': ['2:plano peito frente', '2:plano peito baixo'],

  // Partes do Corpo
  'pe': ['curva peito frente', 'curva mao toque'],
  'mao': ['abre peito toque', 'abre frente parado'],
  'braco': ['punho peito baixo', 'punho ombro cima'],

  // Diálogo 01
  'qual e o seu nome pergunta de retorno': ['2:plano peito baixo', '2:plano frente frente'],
  'onde voce nasceu segunda ocorrencia': ['2:plano peito nasce', '2:plano frente onda']
};

let lga3dContent = fs.readFileSync(lga3dPath, 'utf8');

let count = 0;
for (const [k, notacao] of Object.entries(UPDATES_BATCH_2)) {
  const notStr = JSON.stringify(notacao);
  const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('("' + escapedK + '":\\s*\\{[\\s\\S]*?notacao:\\s*)(?:"[^"]*"|\\[[^\\]]*\\])(,)', 'g');
  if (regex.test(lga3dContent)) {
    lga3dContent = lga3dContent.replace(regex, '$1' + notStr + '$2');
    count++;
  } else {
    console.warn('Não encontrou padrão para chave:', k);
  }
}

fs.writeFileSync(lga3dPath, lga3dContent, 'utf8');
console.log('Atualizados ' + count + ' sinais com notação de 2 a 3 compassos em app/lga-3d.js');
