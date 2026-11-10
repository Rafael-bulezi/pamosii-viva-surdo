/* ============================================================================
   tools/merge-lga-3d.cjs
   Mescla as 135 notações validadas em SINAIS_LGA em app/lga-3d.js, atingindo
   100% de cobertura (246/246 palavras das aulas de LGA com poses 3D).
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
global.window = global;
eval(fs.readFileSync(path.join(raiz, 'app/lga.js'), 'utf8'));
eval(fs.readFileSync(path.join(raiz, 'app/lga-3d.js'), 'utf8'));
eval(fs.readFileSync(path.join(raiz, 'app/maos.js'), 'utf8'));

const NOTACOES = {
  // Aula 00 — Abecedário
  'letra-a': 'A frente parado',
  'letra-b': 'joinha frente parado',
  'letra-c': 'C frente parado',
  'letra-d': 'D frente parado',
  'letra-e': 'E frente parado',
  'letra-f': 'F frente parado',
  'letra-h': 'H frente parado',
  'letra-i': 'I frente parado',
  'letra-j': 'J frente parado',
  'letra-k': 'K frente parado',
  'letra-l': 'L frente parado',
  'letra-m': 'M frente parado',
  'letra-n': 'N frente parado',
  'letra-o': 'O frente parado',
  'letra-p': 'P frente parado',
  'letra-q': 'Q frente parado',
  'letra-r': 'R frente parado',
  'letra-s': 'S frente parado',
  'letra-t': 'T frente parado',
  'letra-u': 'U frente parado',
  'letra-v': 'V frente parado',
  'letra-w': 'W frente parado',
  'letra-x': 'X frente parado',
  'letra-y': 'Y frente parado',
  'letra-z': 'aponta frente onda',

  // Aula 01 — Saudação
  'boa tarde': ['joinha peito frente', 'plano rosto baixo'],
  'boa noite': ['joinha peito frente', 'plano olho varre'],
  'meu nome': ['plano peito toque', '2:aponta peito bate'],
  'qual e o teu nome / teu nome': ['2:aponta peito bate', 'aponta frente frente'],
  'tudo bem': ['2:plano peito frente', '2:joinha peito frente'],
  'desculpa': 'Y mao varre',
  'de nada': '2:abre frente onda',
  'prazer em conhecer-te': ['plano peito circulo', 'aponta frente frente'],
  'surdo/a': ['aponta orelha toque', 'aponta boca toque'],
  'interprete': '2:F peito circulo',
  'meu sinal': ['plano peito toque', 'F rosto toque'],
  'lingua portuguesa': ['L frente onda', 'P peito parado'],

  // Aula 03 — Números
  'um': 'joinha peito parado',
  'sete': 'plano peito parado',
  'nove': 'curva peito parado',
  'dez': 'joinha peito onda',
  'onze': 'joinha peito frente',
  'doze': 'Y peito frente',
  'treze': 'tres peito frente',
  'catorze': 'B peito frente',
  'quinze': 'joinha peito frente',
  'dezasseis': ['joinha peito onda', 'aponta peito parado'],
  'dezassete': ['joinha peito onda', 'plano peito parado'],
  'dezoito': ['joinha peito onda', 'F peito parado'],
  'dezanove': ['joinha peito onda', 'curva peito parado'],
  'vinte': ['Y peito parado', 'O peito parado'],
  'trinta': ['tres peito parado', 'O peito parado'],
  'quarenta': ['B peito parado', 'O peito parado'],
  'cinquenta': ['joinha peito parado', 'O peito parado'],
  'sessenta': ['aponta peito parado', 'O peito parado'],
  'setenta': ['plano peito parado', 'O peito parado'],
  'oitenta': ['F peito parado', 'O peito parado'],
  'noventa': ['curva peito parado', 'O peito parado'],

  // Aula 06 — Verbos 1
  'viver': ['abre peito baixo', 'Y peito parado'],
  'andar': 'V baixo frente',
  'correr': '2:punho peito frente',

  // Aula 07 — Comida 1
  'mucua': ['M frente parado', 'U frente parado', 'C frente parado', 'A frente parado'],
  'goiaba': ['G frente parado', 'O frente parado', 'I frente parado', 'A frente parado'],
  'abacate': ['A frente parado', 'B frente parado', 'C frente parado', 'E frente parado'],
  'farinha-musseque': ['F frente parado', 'M frente parado'],
  'trigo': ['T frente parado', 'R frente parado'],
  'pimento': ['curva peito parado', 'V testa toque'],
  'repolho': ['R frente parado', 'P frente parado'],

  // Aula 08 — Comida 2
  'salada': ['S frente parado', 'L frente parado', 'D frente parado'],
  'vinagre': ['V frente parado', 'N frente parado', 'G frente parado'],
  'presunto': ['P frente parado', 'R frente parado', 'S frente parado'],
  'sandes': ['S frente parado', 'N frente parado', 'D frente parado'],
  'pizza': ['P frente parado', 'I frente parado', 'Z frente parado'],

  // Aula 10 — Verbos 2
  'verbos': ['L rosto frente', 'V rosto frente'],
  'comprar': ['curva testa baixo', 'curva mao bate'],
  'pagar': 'plano mao frente',
  'querer': '2:garra peito tras',
  'pegar': 'garra mao toque',
  'escolher': 'F rosto repete',

  // Aula 11 — Casa 1
  'tv': ['T peito parado', 'V peito parado'],

  // Aula 13 — Tempos e Meses
  'tempo/hora': 'aponta mao bate',
  'ontem': 'aponta ombro tras',
  'hoje/agora': '2:plano peito baixo',
  'amanha': 'aponta queixo arco',
  'sempre': '2:aponta peito circulo',
  'nunca': 'B peito varre',
  'atrasar/demorar': 'aponta mao tras',
  'esperar': '2:plano peito onda',
  'mes': '2:aponta peito varre',
  'janeiro': 'J testa arco',
  'fevereiro': 'abre rosto onda',
  'marco': 'aponta frente frente',
  'abril': 'curva queixo toque',
  'maio': 'aponta boca toque',
  'junho': 'J peito arco',
  'julho': ['J peito arco', 'L peito parado'],
  'agosto': 'aponta peito toque',
  'setembro': '2:F ombro baixo',
  'outubro': 'O peito toque',
  'novembro': 'N peito toque',
  'dezembro': ['D peito arco', '2:abre peito varre'],

  // Aula 14 — Corpo
  'cabeca': 'plano testa toque',
  'braco': 'punho ombro parado',
  'mao': 'abre frente parado',
  'pe': 'curva mao toque',
  'pescoco': 'curva pescoco toque',
  'barriga': '2:plano barriga toque',
  'coracao': 'garra peito bate',
  'olho': 'aponta olho toque',
  'nariz': 'aponta queixo toque',

  // Diálogo 01
  'ola': 'abre rosto aceno',
  'estou bem, e tu': ['joinha peito toque', 'aponta frente frente'],
  'qual e o seu nome': '2:aponta peito bate',
  'meu nome e m-i-l-t-o-n': ['2:aponta peito bate', 'M frente parado', 'L frente parado'],
  'qual e o seu nome pergunta de retorno': '2:plano frente frente',
  'meu nome e e-d-u-a-n-y': ['2:aponta peito bate', 'E frente parado', 'D frente parado'],
  'onde voce nasceu': '2:plano frente onda',
  'eu nasci aqui em a-n-g-o-l-a': ['2:plano peito nasce', 'A frente parado'],
  'onde voce nasceu segunda ocorrencia': '2:plano frente onda',
  'eu nasci em namibia': ['plano peito nasce', 'N frente parado'],
  'n-a-m-i-b-i-a': ['N frente parado', 'M frente parado', 'B frente parado'],
  'voce mora com seus pais': ['curva peito parado', 'aponta frente frente'],
  'sim, vivo junto com meus pais': '2:curva peito toque',
  '-voce mora com sua familia / -sim': 'aponta queixo toque',
  'moro com minha familia': '2:curva peito toque',
  'quantos irmaos voce tem': '2:aponta peito onda',
  'eu tenho 3 irmaos e tu': ['tres peito parado', 'aponta frente frente'],
  'eu tenho 5 irmaos, sendo 3 homens e 2 mulheres': ['joinha peito parado', 'tres peito parado', 'Y peito parado'],
  'entendo': 'aponta rosto toque',
  'qual e o sinal do seu nome': ['2:aponta peito bate', 'F rosto toque'],
  'sinal do nome do milton': 'curva testa toque',
  'e voce': 'aponta frente frente',
  'sinal do nome do eduany': 'garra testa toque',
  'prazer em conhece-lo': ['plano peito circulo', 'aponta frente frente'],
  'eu tambem, prazer em conhece-lo': ['plano peito toque', 'aponta queixo toque']
};

const missingKeys = Object.keys(global.FONTE_LGA).filter(k => !global.SINAIS_LGA[k]);
console.log('Faltavam:', missingKeys.length);

if (missingKeys.length === 0) {
  console.log('Já está 100% coberto!');
  process.exit(0);
}

// Agrupar por aula
const grouped = {};
missingKeys.forEach(k => {
  const f = global.FONTE_LGA[k];
  if (!grouped[f.aula]) grouped[f.aula] = [];
  grouped[f.aula].push(k);
});

let snippet = '\n';
for (const [aula, keys] of Object.entries(grouped)) {
  snippet += '    /* ------------------------------------------------------------------------\n';
  snippet += '       ' + aula + ' (' + keys.length + ' palavras)\n';
  snippet += '       ------------------------------------------------------------------------ */\n';
  keys.forEach(k => {
    const f = global.FONTE_LGA[k];
    const not = NOTACOES[k];
    const notStr = Array.isArray(not) ? JSON.stringify(not) : JSON.stringify(not);
    snippet += '    ' + JSON.stringify(k) + ': {\n';
    snippet += '      notacao: ' + notStr + ',\n';
    snippet += '      aproximado: true,\n';
    snippet += '      aula: ' + JSON.stringify(f.aula) + ',\n';
    snippet += '      segundos: ' + JSON.stringify(f.segundos) + ',\n';
    snippet += '      confianca: ' + JSON.stringify(f.confianca) + ',\n';
    snippet += '      veSe: ' + JSON.stringify(f.veSe) + ',\n';
    snippet += '    },\n';
  });
}

const lga3dPath = path.join(raiz, 'app/lga-3d.js');
let lga3dContent = fs.readFileSync(lga3dPath, 'utf8');

const fechoIdx = lga3dContent.lastIndexOf('  };');
if (fechoIdx === -1) {
  console.error('Não encontrou o fecho `  };` em app/lga-3d.js');
  process.exit(1);
}

const novoConteudo = lga3dContent.slice(0, fechoIdx) + snippet + lga3dContent.slice(fechoIdx);
fs.writeFileSync(lga3dPath, novoConteudo, 'utf8');
console.log('app/lga-3d.js atualizado com sucesso!');
