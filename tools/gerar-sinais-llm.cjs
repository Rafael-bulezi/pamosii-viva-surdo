/* Gera app/api/sinais-lista.json: as palavras do glossário que a sinalizadora sabe
   mesmo fazer, com o tema de cada uma.

   O modelo que escolhe os sinais não pode inventar movimentos: a lista que ele
   recebe no prompt e a lista com que a resposta é filtrada são este ficheiro.
   Se o léxico (dados.js + maos.js) mudar sem o retrato, o teste de integridade
   falha. Uso: node tools/gerar-sinais-llm.cjs */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'app');
const ler = f => fs.readFileSync(path.join(APP, f), 'utf8');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  ler('referencias.js') + '\n' + ler('dados.js') + '\n' + ler('maos.js') +
  '\n;globalThis.__api = { GLOSSARIO, sinalNotacao };', ctx);

const { GLOSSARIO, sinalNotacao } = ctx.__api;
if (!GLOSSARIO || typeof sinalNotacao !== 'function') {
  throw new Error('dados.js/maos.js não expõem GLOSSARIO e sinalNotacao');
}

const vistas = new Map();
for (const grupo of GLOSSARIO) {
  for (const termo of grupo.termos) {
    const palavra = String(termo.palavra).toLowerCase().trim();
    if (vistas.has(palavra)) continue;
    if (!sinalNotacao(palavra)) continue;
    vistas.set(palavra, grupo.tema);
  }
}

const palavras = [...vistas.entries()]
  .map(([palavra, tema]) => ({ palavra, tema }))
  .sort((a, b) => a.palavra.localeCompare(b.palavra, 'pt'));

const destino = path.join(APP, 'api', 'sinais-lista.json');
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify({ fonte: 'dados.js + maos.js', total: palavras.length, palavras }, null, 1) + '\n');

console.log('OK — ' + palavras.length + ' sinais em ' + new Set(palavras.map(p => p.tema)).size +
  ' temas → ' + path.relative(path.join(__dirname, '..'), destino));
