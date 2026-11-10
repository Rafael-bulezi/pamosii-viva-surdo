/* ============================================================================
   tools/atualizar-compostos-lga.cjs
   Atualiza 27 sinais que eram tratados em apenas 1 compasso/passo para
   notação composta de dois tempos (dois compassos/gestos sequenciais),
   conforme a observação detalhada dos vídeos das aulas de LGA.
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const lga3dPath = path.join(raiz, 'app/lga-3d.js');

const UPDATES = {
  // Números 11–15: dois impulsos oscilantes sequenciais
  'onze': ['joinha peito parado', 'joinha peito frente'],
  'doze': ['Y peito parado', 'Y peito frente'],
  'treze': ['tres peito parado', 'tres peito frente'],
  'catorze': ['B peito parado', 'B peito frente'],
  'quinze': ['joinha peito parado', 'joinha peito frente'],

  // Saudações e expressões sociais: toque inicial + projeção
  'obrigado/a': ['2:plano queixo toque', '2:plano frente frente'],
  'por favor': ['plano queixo toque', 'plano frente frente'],
  'de nada': ['2:joinha peito parado', '2:abre frente onda'],
  'interprete': ['2:F peito toque', '2:F peito circulo'],

  // Verbos: movimentos sequenciais compostos
  'ver': ['aponta olho toque', 'aponta frente frente'],
  'dormir': ['plano rosto toque', '2:abre alto cima'],
  'falar': ['curva boca toque', 'curva frente frente'],
  'ajudar': ['joinha mao toque', 'joinha mao frente'],
  'usar': ['U mao circulo', 'U mao toque'],
  'pagar': ['plano mao toque', 'plano mao frente'],
  'querer': ['2:garra frente parado', '2:garra peito tras'],
  'pegar': ['garra peito frente', 'garra mao toque'],

  // Tempos e calendário: toque/início + deslocamento
  'amanha': ['aponta queixo toque', 'aponta frente arco'],
  'tempo/hora': ['aponta mao toque', 'aponta mao bate'],
  'atrasar/demorar': ['aponta mao toque', 'aponta mao tras'],
  'mes': ['2:aponta peito toque', '2:aponta lado varre'],

  // Frases de diálogo: sinal base + pergunta/apontar
  'qual e o seu nome': ['2:aponta peito bate', 'aponta frente frente'],
  'onde voce nasceu': ['2:plano peito nasce', '2:plano frente onda'],
  'quantos irmaos voce tem': ['2:aponta peito bate', '2:aponta peito onda'],

  // Corpo e casa: pulso ou acção em duas fases
  'coracao': ['garra peito toque', 'garra peito bate'],
  'porta': ['2:plano peito frente', '2:plano frente bate'],
  'trancar': ['2:punho peito frente', '2:punho peito torce']
};

let lga3dContent = fs.readFileSync(lga3dPath, 'utf8');

let count = 0;
for (const [k, notacao] of Object.entries(UPDATES)) {
  const notStr = JSON.stringify(notacao);
  // Procura a entrada `"chave": {\n      notacao: ...,\n`
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
console.log('Atualizados ' + count + ' sinais com notação de 2 compassos em app/lga-3d.js');
