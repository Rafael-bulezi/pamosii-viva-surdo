/* ============================================================================
   DADOS — glossário e glosador.
   ----------------------------------------------------------------------------
   O QUE ISTO É: uma lista de palavras com uma associação de estudo, e um
   glosador que decide o que cai (artigos, preposições), o que vira letra
   (palavras sem sinal) e o que fica como sinal.
   O QUE ISTO NÃO É: tradução de português para LGA. Uma glosa é uma sequência
   de sinais; a gramática da LGA (espaço, ordem, expressão facial) não está aqui.
   ============================================================================ */
'use strict';

const GLOSSARIO = [
  { tema: 'Saudações', termos: ['olá', 'bom dia', 'boa tarde', 'boa noite', 'tchau', 'obrigado', 'obrigada', 'como está?', 'bom', 'mau', 'por favor', 'desculpa', 'sim', 'não'] },
  { tema: 'Diálogos', termos: ['conversa', 'perguntar', 'responder', 'falar em LGA'] },
  { tema: 'Escola', termos: ['escola', 'professor', 'aluno', 'caderno', 'caneta', 'lápis', 'borracha', 'mochila', 'livro', 'carteira', 'recreio', 'lição'] },
  { tema: 'Cores', termos: ['vermelho', 'azul', 'verde', 'amarelo', 'preto', 'branco', 'laranja', 'roxo', 'rosa', 'castanho', 'cinza', 'cores'] },
  { tema: 'Verbos', termos: ['comer', 'beber', 'dormir', 'acordar', 'andar', 'correr', 'ver', 'escrever', 'ler', 'trabalhar', 'estudar', 'gostar', 'querer', 'ter', 'dar', 'fazer', 'ajudar', 'brincar', 'ir', 'vir'] },
  { tema: 'Comida', termos: ['água', 'pão', 'arroz', 'feijão', 'peixe', 'carne', 'fruta', 'legumes', 'leite', 'café', 'açúcar', 'sal', 'óleo', 'comida', 'bebida', 'faminta', 'sede'] },
  { tema: 'Adjetivos', termos: ['grande', 'pequeno', 'bonito', 'novo', 'velho', 'rápido', 'lento', 'quente', 'frio', 'feliz', 'triste', 'cansado', 'doente', 'saudável'] },
  { tema: 'Frases', termos: ['como te chamas', 'chamo-me', 'onde fica', 'quanto custa', 'não entendo', 'repete por favor', 'muito bem', 'até amanhã'] },
  { tema: 'Casa', termos: ['casa', 'porta', 'janela', 'cama', 'mesa', 'cadeira', 'cozinha', 'quarto', 'sala', 'casa de banho', 'teto', 'chão', 'família', 'mãe', 'pai', 'filho', 'filha', 'avó', 'avô', 'irmão', 'irmã'] },
  { tema: 'Tempo', termos: ['hoje', 'amanhã', 'ontem', 'agora', 'depois', 'semana', 'mês', 'ano', 'dia', 'hora', 'cedo', 'tarde', 'sempre', 'nunca', 'devagar'] },
  { tema: 'Corpo', termos: ['cabeça', 'olho', 'mão', 'dedo', 'boca', 'nariz', 'orelha', 'ombro', 'braço', 'perna', 'pé', 'barriga', 'dente', 'cabelo'] },
  { tema: 'Dia a dia', termos: ['mercado', 'autocarro', 'dinheiro', 'telefone', 'amigo', 'amiga', 'computador', 'hospital', 'médico', 'igreja', 'futebol', 'música', 'dança', 'roupa', 'sapato', 'cartão', 'comprar', 'vender', 'pagar', 'esperar', 'chegar', 'precisar', 'poder', 'dever', 'muito', 'pouco', 'aqui', 'ali'] },
].map(g => ({ tema: g.tema, termos: g.termos.map(t => ({ palavra: String(t), estado: 'a-validar', sinal: null })) }));

const GLOSSARIO_QTD = GLOSSARIO.reduce((n, g) => n + g.termos.length, 0);

const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const tokenizar = (frase) => (frase.match(/[\p{L}\p{M}][\p{L}\p{M}'’-]*|\p{N}+/gu) || []);
const dividirPalavra = (tk) => String(tk).split(/[-'’]/).filter(Boolean);

/* palavras funcionais: caem da glosa ou viram marcação */
const PAMOSSI_TIPOS = {
  artigo: { rotulo: 'Artigo', acao: 'omitir', nota: 'A LGA não usa artigos.' },
  preposicao: { rotulo: 'Preposição', acao: 'omitir', nota: 'O lugar faz-se no espaço, não com palavra.' },
  conjuncao: { rotulo: 'Conjunção', acao: 'omitir', nota: 'As ideias ligam-se por sequência e pausa.' },
  determinante: { rotulo: 'Posse', acao: 'marcador', nota: 'Aponta-se para a pessoa ou para o lugar dela.' },
  pronome: { rotulo: 'Pronome', acao: 'marcador', nota: 'Aponta-se para o lugar reservado a essa pessoa.' },
  'verbo-suporte': { rotulo: 'Ser / estar', acao: 'omitir', nota: 'Está dentro do próprio verbo.' },
  interrogativo: { rotulo: 'Pergunta', acao: 'marcador', nota: 'A pergunta faz-se com as sobrancelhas e a cabeça.' },
};

const PAMOSSI_MAPA = {};
[
  ['artigo', ['a', 'o', 'as', 'os', 'uma', 'um', 'umas', 'uns']],
  ['preposicao', ['de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'para', 'por', 'sem', 'com', 'entre', 'sob', 'apos', 'ate', 'desde', 'perante', 'sobre', 'alem', 'tras']],
  ['conjuncao', ['e', 'ou', 'mas', 'porem', 'porque', 'pois', 'se', 'ainda', 'logo', 'entao']],
  ['determinante', ['meu', 'minha', 'teu', 'tua', 'seu', 'sua', 'nosso', 'nossa', 'vosso', 'vossa', 'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'isso', 'isto', 'aquele', 'aquela']],
  ['pronome', ['eu', 'tu', 'ele', 'ela', 'nos', 'voce', 'voces', 'eles', 'elas', 'me', 'te', 'lhe', 'lhes', 'se', 'convosco', 'comigo', 'contigo', 'connosco']],
  ['verbo-suporte', ['ser', 'sou', 'es', 'eh', 'somos', 'sao', 'estar', 'estou', 'estas', 'esta', 'estamos', 'estao', 'esteja', 'ficar', 'fico', 'fica']],
  ['interrogativo', ['quem', 'onde', 'quando', 'como', 'qual', 'quais', 'quanto', 'quanta']],
].forEach(([tipo, palavras]) => palavras.forEach(p => { if (!(p in PAMOSSI_MAPA)) PAMOSSI_MAPA[p] = tipo; }));

/* forma conjugada → forma de dicionário */
const PAMOSSI_LEMAS = {};
[
  ['querer', ['quero', 'queres', 'queremos', 'querem', 'queria', 'queriamos', 'queriam', 'quis', 'quiseram']],
  ['comer', ['comes', 'come', 'comemos', 'comem', 'comia', 'comiamos', 'comi', 'comeu', 'comeram']],
  ['beber', ['bebes', 'bebe', 'bebemos', 'bebem', 'bebia', 'bebi', 'bebeu']],
  ['dormir', ['dormes', 'dorme', 'dormimos', 'dormem', 'dormi', 'dormiu']],
  ['acordar', ['acordo', 'acordas', 'acorda', 'acordamos', 'acordam']],
  ['andar', ['ando', 'andas', 'anda', 'andamos', 'andam', 'andei', 'andou']],
  ['correr', ['corro', 'corres', 'corre', 'corremos', 'correm', 'corri', 'correu']],
  ['ver', ['ves', 've', 'vemos', 'veem', 'viram', 'vi', 'viu']],
  ['ir', ['vou', 'vais', 'vai', 'vamos', 'vao', 'fui', 'foi', 'foram', 'ia', 'iam']],
  ['vir', ['venho', 'vens', 'vem', 'vimos', 'veio', 'vieram']],
  ['escrever', ['escrevo', 'escreves', 'escreve', 'escrevemos', 'escrevem', 'escrevi']],
  ['ler', ['le', 'les', 'lemos', 'leem', 'leram', 'li', 'leu']],
  ['trabalhar', ['trabalho', 'trabalhas', 'trabalha', 'trabalhamos', 'trabalham']],
  ['estudar', ['estudo', 'estudas', 'estuda', 'estudamos', 'estudam']],
  ['gostar', ['gosto', 'gostas', 'gosta', 'gostamos', 'gostam']],
  ['ter', ['tenho', 'tens', 'tem', 'temos', 'tinhas', 'tinha', 'tivemos', 'tive', 'teve']],
  ['dar', ['dou', 'damos', 'dao', 'dam', 'dei', 'deu']],
  ['fazer', ['faco', 'fazes', 'faz', 'fazemos', 'fazem', 'fiz', 'fez']],
  ['ajudar', ['ajudo', 'ajudas', 'ajuda', 'ajudamos', 'ajudam']],
  ['brincar', ['brinco', 'brincas', 'brinca', 'brincamos', 'brincam']],
].forEach(([base, formas]) => formas.forEach(f => { if (!(f in PAMOSSI_LEMAS)) PAMOSSI_LEMAS[f] = base; }));

/* índices palavra → entrada; e expressões de várias palavras ("bom dia", "casa de banho") */
const PAMOSSI_INDICE = new Map();
const PAMOSSI_EXPRESSOES = new Map();
let PAMOSSI_EXP_MAX = 1;
GLOSSARIO.forEach(g => g.termos.forEach(t => {
  const chave = norm(t.palavra).replace(/[….:;?!]/g, '').trim();
  if (!chave) return;
  const entrada = { palavra: t.palavra, tema: g.tema, estado: t.estado };
  if (!PAMOSSI_INDICE.has(chave)) PAMOSSI_INDICE.set(chave, entrada);
  const partes = [];
  tokenizar(chave).forEach(tk => dividirPalavra(tk).forEach(p => partes.push(norm(p))));
  if (partes.length > 1) {
    const k = partes.join(' ');
    if (!PAMOSSI_EXPRESSOES.has(k)) PAMOSSI_EXPRESSOES.set(k, entrada);
    PAMOSSI_EXP_MAX = Math.max(PAMOSSI_EXP_MAX, partes.length);
  }
}));

const PAMOSSI_DESINENCIAS = ['o', 'as', 'a', 'amos', 'am', 'ava', 'avam', 'ei', 'ou',
  'e', 'es', 'emos', 'em', 'eu', 'ia', 'iam', 'imos', 'iu'];
function procurarSinal(c) {
  if (PAMOSSI_INDICE.has(c)) return PAMOSSI_INDICE.get(c);
  if (c.length > 3 && c.endsWith('s') && PAMOSSI_INDICE.has(c.slice(0, -1))) {
    return { ...PAMOSSI_INDICE.get(c.slice(0, -1)), plural: true, termo: PAMOSSI_INDICE.get(c.slice(0, -1)).palavra };
  }
  if (c.length > 4 && c.endsWith('es') && PAMOSSI_INDICE.has(c.slice(0, -2))) {
    return { ...PAMOSSI_INDICE.get(c.slice(0, -2)), plural: true, termo: PAMOSSI_INDICE.get(c.slice(0, -2)).palavra };
  }
  const base = PAMOSSI_LEMAS[c];
  if (base && PAMOSSI_INDICE.has(base)) {
    return { ...PAMOSSI_INDICE.get(base), lema: base, termo: PAMOSSI_INDICE.get(base).palavra };
  }
  if (PAMOSSI_MAPA[c]) return null;
  for (const suf of PAMOSSI_DESINENCIAS) {
    if (c.length <= suf.length + 3 || !c.endsWith(suf)) continue;
    const raiz = c.slice(0, -suf.length);
    for (const inf of ['ar', 'er', 'ir']) {
      const found = PAMOSSI_INDICE.get(raiz + inf);
      if (found) return { ...found, lema: raiz + inf, termo: found.palavra };
    }
  }
  return null;
}

/* frases com o terminador, para saber o que foi pergunta */
function dividirFrases(texto) {
  const re = /([^[\n.!?…]+)([.!?…\n]*)/g;
  const out = [];
  let m;
  while ((m = re.exec(String(texto || '')))) {
    const frase = m[1].trim();
    if (frase) out.push({ frase, terminador: m[2] || '' });
  }
  return out;
}

/* palavras de tempo que a glosa põe à frente da frase */
const TEMPO_FRENTE = new Set(['hoje', 'amanha', 'ontem', 'agora', 'depois', 'depois', 'cedo', 'tarde', 'sempre', 'nunca', 'semana', 'mes', 'ano', 'dia', 'hora']);

/* texto → [{ frase, itens, sinais, datilologias, omitidas, contas }] */
function analisarTexto(texto) {
  const unidadesDe = (frase) => {
    const u = [];
    tokenizar(frase).forEach(tk => dividirPalavra(tk).forEach(p => u.push({ chave: norm(p), parte: p })));
    return u;
  };

  return dividirFrases(texto).map(({ frase, terminador }) => {
    const pergunta = /[?]/.test(terminador + frase);
    const unidades = unidadesDe(frase);
    let itens = [];
    let i = 0;
    while (i < unidades.length) {
      let achado = null;
      for (let n = Math.min(PAMOSSI_EXP_MAX, unidades.length - i); n >= 2 && !achado; n--) {
        const k = unidades.slice(i, i + n).map(u => u.chave).join(' ');
        if (PAMOSSI_EXPRESSOES.has(k)) achado = { entrada: PAMOSSI_EXPRESSOES.get(k), cobre: n };
      }
      if (achado) {
        const e = achado.entrada;
        itens.push({ tipo: 'sinal', palavra: e.palavra, entrada: e, expressao: true, marca: 'assinado' });
        i += achado.cobre;
        continue;
      }
      const { chave, parte } = unidades[i];
      const func = PAMOSSI_MAPA[chave];
      const tipoFunc = func ? PAMOSSI_TIPOS[func] : null;
      const contaComoMarcador = tipoFunc && !(func === 'interrogativo' && !pergunta);
      const artigoCurto = contaComoMarcador && tipoFunc.acao === 'omitir' && chave.length <= 2;
      const entrada = artigoCurto ? null : procurarSinal(chave);

      if (entrada) {
        itens.push({ tipo: 'sinal', palavra: entrada.palavra, entrada, marca: 'assinado', origem: entrada.termo && entrada.termo !== parte.toLowerCase() ? parte : null });
      } else if (contaComoMarcador) {
        itens.push({ tipo: func, palavra: parte, rotulo: tipoFunc.rotulo, acao: tipoFunc.acao, nota: tipoFunc.nota, marca: tipoFunc.acao === 'omitir' ? 'omitido' : 'marcador' });
      } else {
        itens.push({
          tipo: 'datilologia',
          palavra: parte,
          letras: [...parte].filter(l => /[\p{L}\p{N}]/u.test(l)).map(l => l.toUpperCase()),
          nome: i > 0 && /^\p{Lu}/u.test(parte),
          marca: 'letra',
          nota: i > 0 && /^\p{Lu}/u.test(parte) ? 'Nome próprio: soletra-se.' : 'Sem sinal: soletra-se.',
        });
      }
      i += 1;
    }

    /* regra de ordem: tempo à frente, negação no fim (é assim que muitas línguas gestuais marcam) */
    const ehTempo = it => it.marca === 'assinado' && TEMPO_FRENTE.has(norm(it.palavra));
    const ehNao = it => it.palavra && norm(it.palavra) === 'nao' && it.marca !== 'omitido';
    const tempo = itens.filter(ehTempo);
    const nao = itens.filter(ehNao);
    if (tempo.length || nao.length) {
      const resto = itens.filter(it => !tempo.includes(it) && !nao.includes(it));
      itens = [...tempo, ...resto, ...nao];
      itens.forEach(it => { if (ehTempo(it)) it.movido = 'tempo'; if (ehNao(it)) it.movido = 'negacao'; });
    }
    if (pergunta) itens.push({ tipo: 'marcador-pergunta', palavra: '?', rotulo: 'Pergunta', acao: 'marcador', marca: 'marcador', nota: 'Sobrancelhas franzidas e cabeça ligeiramente inclinada enquanto se sinaliza.' });

    const contas = {
      palavras: unidades.length,
      assinados: itens.filter(it => it.marca === 'assinado').length,
      letras: itens.filter(it => it.marca === 'letra').reduce((n, it) => n + it.letras.length, 0),
      omitidos: itens.filter(it => it.marca === 'omitido').length,
    };
    return {
      frase, itens, contas,
      sinais: itens.filter(it => it.tipo === 'sinal'),
      datilologias: itens.filter(it => it.tipo === 'datilologia'),
      omitidas: itens.filter(it => it.marca === 'omitido'),
      desconhecidas: itens.filter(it => it.marca === 'letra').map(d => ({ palavra: d.palavra, nome: d.nome })),
    };
  });
}

const glosaTexto = (r) => r.itens
  .filter(i => i.tipo === 'sinal' || i.tipo === 'datilologia')
  .map(i => i.tipo === 'datilologia' ? [...i.palavra].map(l => l.toUpperCase()).join('-')
    : String(i.palavra || '').replace(/[…]/g, '').trim().toUpperCase().replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
  .join(' · ');

const PM_EXEMPLOS = [
  'Bom dia! Chamo-me Ana e sou de Luanda.',
  'Onde fica a escola?',
  'A minha mãe trabalha no hospital.',
  'Eu queria água, por favor.',
  'Amanhã eu não vou à escola.',
  'Eu gosto de música.',
  'Estou feliz hoje.',
  'A minha irmã está doente.',
];
