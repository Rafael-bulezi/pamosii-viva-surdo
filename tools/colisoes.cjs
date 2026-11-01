/* Auditoria de colisões: duas palavras cuja notação produz o mesmo tuple
   renderizam exatamente a mesma pose no avatar. Agrupa e imprime.
   uso: node tools/colisoes.cjs */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'app', 'maos.js'), 'utf8') +
    `;globalThis.__api = { SINAIS, sinalNotacao, LOCAIS, FORMAS_MAO, MOVIMENTOS };`,
  ctx
);
const { SINAIS, sinalNotacao, LOCAIS } = ctx.__api;

const entradas = Object.entries(SINAIS);
const grupos = new Map();
const hist = { local: new Map(), forma: new Map(), mov: new Map(), duas: 0 };
const semNota = [];

const bump = (map, k) => map.set(k, (map.get(k) || 0) + 1);

for (const [chave, nota] of entradas) {
  const n = sinalNotacao(chave);
  if (!n) {
    semNota.push(chave + ' [' + nota + ']');
    continue;
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  const sig = [
    n.forma,
    n.duas ? '2' : '1',
    n.local,
    n.inicio.pos.map(r2).join(','),
    n.fim.pos.map(r2).join(','),
    n.inicio.rot.map((v) => Math.round(v * 10) / 10).join(','),
    n.fim.rot.map((v) => Math.round(v * 10) / 10).join(','),
  ].join('|');
  if (!grupos.has(sig)) grupos.set(sig, []);
  grupos.get(sig).push(chave + ' [' + nota + ']');
  bump(hist.local, n.local);
  bump(hist.forma, n.forma);
  bump(hist.mov, n.movimento);
  if (n.duas) hist.duas++;
}

const ordenados = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
const colidem = ordenados.filter(([, w]) => w.length > 1);

console.log('palavras na tabela .......: ' + entradas.length);
console.log('com notação válida .......: ' + (entradas.length - semNota.length));
console.log('assinaturas de pose distintas: ' + grupos.size);
console.log('grupos com colisão .......: ' + colidem.length);
console.log('palavras presas em colisão: ' + colidem.reduce((n, [, w]) => n + w.length, 0));
console.log('  → ' + Math.round((100 * colidem.reduce((n, [, w]) => n + w.length, 0)) / entradas.length) + '% do léxico');
console.log('mãos duplas ..............: ' + hist.duas);
console.log('sem notação ..............: ' + semNota.length);
if (semNota.length) console.log('  ' + semNota.join(', '));

console.log('\n=== TODOS os grupos de palavras com pose IDÊNTICA ===');
for (const [sig, palavras] of ordenados) {
  if (palavras.length < 2) continue;
  const p = sig.split('|');
  console.log('\n(' + palavras.length + ') ' + p[0] + ' · ' + (p[1] === '2' ? '2 mãos' : '1 mão') + ' · local ' + p[2]);
  console.log('    ' + palavras.join('\n    '));
}

const top = (map, n) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => k + ':' + v).join('  ');
console.log('\nlocal : ' + top(hist.local, 20));
console.log('forma : ' + top(hist.forma, 20));
console.log('movim : ' + top(hist.mov, 20));

/* amplitude real do movimento */
const amov = new Map();
const semMov = [];
for (const [chave, nota] of entradas) {
  const n = sinalNotacao(chave);
  if (!n) continue;
  const d = Math.hypot(...n.fim.pos.map((v, i) => v - n.inicio.pos[i]));
  const r = Math.hypot(...n.fim.rot.map((v, i) => v - n.inicio.rot[i]));
  const arr = amov.get(n.movimento) || [];
  arr.push({ chave, d, r });
  amov.set(n.movimento, arr);
  if (d < 0.02 && r < 6) semMov.push(chave + ' [' + nota + ']');
}
console.log('\n=== amplitude por movimento (unidades de palco; 1.0 ≈ altura total) ===');
for (const [mov, arr] of [...amov.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const dm = arr.reduce((s, x) => s + x.d, 0) / arr.length;
  const rm = arr.reduce((s, x) => s + x.r, 0) / arr.length;
  console.log(
    '  ' + mov.padEnd(9) + ' n=' + String(arr.length).padStart(3) +
      '  deslize ' + (dm * 100).toFixed(1).padStart(5) + ' cm-equiv' +
      '  giro ' + rm.toFixed(1).padStart(5) + '°'
  );
}
console.log('\n=== sinais cujo início e fim são praticamente a mesma imagem ===');
console.log(semMov.length + ' de ' + (entradas.length - semNota.length) + ':');
console.log('  ' + semMov.join('\n  '));

/* locais sem mão-parceira: quantos sinais dependem de uma segunda mão que não existe */
const maoLoc = Object.keys(LOCAIS).filter((k) => k === 'mao');
console.log('\n=== âncoras de local (posições de palco) ===');
for (const [k, L] of Object.entries(LOCAIS)) {
  const p = Array.isArray(L) ? L : L.p;
  console.log('  ' + k.padEnd(12) + p.map((v) => v.toFixed(2)).join(', '));
}
