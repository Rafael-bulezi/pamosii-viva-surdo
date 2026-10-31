/* Teste do glosador, sem browser: corre dados.js num vm e imprime a análise
   de cada exemplo. Falha se uma frase deixar de produzir glosa, se o tempo
   deixar de ir à frente ou se o «não» deixar de ir ao fim.
   uso: node tools/engine-test.cjs [dados.js] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ficheiro = path.resolve(process.argv[2] || path.join(__dirname, '..', 'app', 'dados.js'));
const ctx = { console };
ctx.window = ctx; /* os módulos do app fecham-se com (function(global){…})(window) */
vm.createContext(ctx);
const referencias = fs.readFileSync(path.join(__dirname, '..', 'app', 'referencias.js'), 'utf8');
vm.runInContext(referencias + '\n' + fs.readFileSync(ficheiro, 'utf8') + `
;globalThis.__api = { analisarTexto, glosaTexto, procurarSinal, GLOSSARIO, PM_EXEMPLOS };`, ctx);
const api = ctx.__api;

let falhas = 0;
const erro = m => { falhas++; console.error(' ✗ ' + m); };

console.log('glossário: ' + api.GLOSSARIO.length + ' temas, ' +
  api.GLOSSARIO.reduce((n, g) => n + g.termos.length, 0) + ' palavras\n');

const frases = [
  ...api.PM_EXEMPLOS,
  'Amanhã eu não vou à escola.',
  'O professor escreve a lição no caderno.',
];

for (const frase of frases) {
  const textos = api.analisarTexto(frase, { soletrar: true });
  if (!textos.length) { erro('sem análise para: ' + frase); continue; }
  const r = textos[0];
  const glosa = api.glosaTexto(r).trim();
  console.log('FRASE: ' + r.frase);
  console.log('  glosa: ' + glosa);
  console.log('  sinais ' + r.sinais.length + '/' + r.contas.palavras +
    ' · datilologia ' + r.datilologias.length + ' · omitidas ' + r.contas.omitidos +
    ' · desconhecidas ' + r.desconhecidas.length);
  console.log('  itens: ' + r.itens.map(i => `${i.tipo}:${i.palavra}${i.origem ? '<-' + i.origem : ''}` +
    `${i.expressao ? '(expr)' : ''}${i.plural ? '(pl)' : ''}`).join(' | '));
  if (!glosa) erro('glosa vazia: ' + frase);
  if (r.datilologias.some(d => !d.nome)) erro('letra soletrada sem nome: ' + frase);
  if (/^amanhã/i.test(r.frase.trim()) && !/^AMANHÃ/i.test(glosa)) erro('tempo não foi à frente: ' + frase);
  if (/\bnão\b/i.test(r.frase) && !/NÃO\s*$/i.test(glosa)) erro('«não» não foi ao fim: ' + frase);
  console.log('');
}

console.log('--- lemas e plurais ---');
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
for (const palavra of ['vou', 'vai', 'fui', 'casas', 'águas', 'professores', 'escreve', 'escreveu', 'amigo', 'amiga']) {
  const r = api.procurarSinal(norm(palavra));
  console.log(' ', palavra, '→', r ? r.palavra + (r.lema ? ' (lema ' + r.lema + ')' : '') + (r.plural ? ' (plural)' : '') : 'null');
}

if (falhas) { console.error('\n' + falhas + ' falha(s).'); process.exit(1); }
console.log('\nOK — ' + frases.length + ' frases glosadas.');
