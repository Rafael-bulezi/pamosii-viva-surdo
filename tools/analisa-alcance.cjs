/* Analisa sonda-alcance.json: erro de colocação, distância entre mãos,
   encravamento no torso. uso: node tools/analisa-alcance.cjs [ficheiro] */
const fs = require('fs');
const path = require('path');
const os = require('os');
const f = process.argv[2] || path.join(os.homedir(), 'glb-lab', 'sonda-alcance.json');
const dados = JSON.parse(fs.readFileSync(f, 'utf8'));
const { saida } = dados;

const med = a => a.reduce((s, x) => s + x, 0) / a.length;
const p95 = a => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.95)];

/* --- 1. a mão chega onde a notação pediu? --- */
const porLocal = new Map();
for (const r of saida) {
  if (!porLocal.has(r.local)) porLocal.set(r.local, []);
  porLocal.get(r.local).push(r);
}
console.log('=== 1. ERRO DE COLOCAÇÃO — onde a notação pede vs onde o osso chega ===');
console.log('(alvo = posição do punho pedida por SINAL3D.ancoras(); erro = ‖real − alvo‖ em metros)');
console.log('local        n   alvo(x,y,z)          erro médio  erro máx   desvio Y');
const linhas = [];
for (const [loc, rs] of [...porLocal.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const e = rs.map(r => r.inicio.erroAlvo);
  const dy = rs.map(r => r.inicio.maoD[1] - r.alvo[1]);
  linhas.push({ loc, n: rs.length, alvo: rs[0].alvo, em: med(e), ex: Math.max(...e), dy: med(dy) });
}
for (const l of linhas.sort((a, b) => b.em - a.em)) {
  console.log(
    '  ' + l.loc.padEnd(11) + String(l.n).padStart(3) + '   ' +
    ('[' + l.alvo.map(v => v.toFixed(2)).join(', ') + ']').padEnd(20) +
    l.em.toFixed(3).padStart(9) + ' m' + l.ex.toFixed(3).padStart(8) + ' m' +
    (l.dy >= 0 ? '  +' : '  ') + l.dy.toFixed(3) + ' m'
  );
}
const todos = saida.map(r => r.inicio.erroAlvo);
console.log('\n  global: médio ' + med(todos).toFixed(3) + ' m · p95 ' + p95(todos).toFixed(3) + ' m · ' +
  saida.filter(r => r.inicio.erroAlvo > 0.15).length + '/191 com erro > 15 cm');

/* --- 2. as duas mãos tocam-se alguma vez? --- */
const dup = saida.filter(r => r.duas);
const sgl = saida.filter(r => !r.duas);
const dDup = dup.map(r => Math.min(r.inicio.maosJuntas, r.fim.maosJuntas));
const dSgl = sgl.map(r => Math.min(r.inicio.maosJuntas, r.fim.maosJuntas));
console.log('\n=== 2. DISTÂNCIA ENTRE AS DUAS MÃOS (m) ===');
console.log('  sinais 2: (n=' + dup.length + ')  distância mínima  médio ' + med(dDup).toFixed(3) +
  ' · máx ' + Math.max(...dDup).toFixed(3) + ' · ' + dDup.filter(d => d < 0.12).length + ' com contacto');
console.log('  sinais 1 mão (n=' + sgl.length + ')  distância à mão parada  médio ' + med(dSgl).toFixed(3) +
  ' · mín ' + Math.min(...dSgl).toFixed(3) + ' · ' + dSgl.filter(d => d < 0.12).length + ' com a mão parada ao alcance');

const precisaSuperficie = sgl.filter(r => /mao|telhado|lado|baixo|barriga/.test(r.local));
console.log('\n  sinais a 1 mão cujo LOCAL pede uma segunda mão (mao/telhado/lado/baixo/barriga): ' + precisaSuperficie.length);
for (const r of precisaSuperficie.sort((a, b) => b.inicio.maosJuntas - a.inicio.maosJuntas)) {
  console.log('    ' + r.palavra.padEnd(16) + r.nota.padEnd(24) + ' mão parada a ' + r.inicio.maosJuntas.toFixed(2) + ' m');
}

/* --- 3. encravamento: ponta do dedo mais próxima do corpo --- */
const perto = saida.filter(r => Math.min(r.inicio.pontaAoEsterno ?? 9, r.fim.pontaAoEsterno ?? 9) < 0.26);
console.log('\n=== 3. PONTA DO DEDO MÉDIO → ESTERNO (m) — abaixo de ~0,26 m a mão entra na camisola ===');
console.log('  ' + perto.length + '/191 sinais com os dedos a menos de 26 cm do esterno');
for (const r of perto.sort((a, b) => Math.min(a.inicio.pontaAoEsterno, a.fim.pontaAoEsterno) - Math.min(b.inicio.pontaAoEsterno, b.fim.pontaAoEsterno)).slice(0, 24)) {
  console.log('    ' + r.palavra.padEnd(16) + r.nota.padEnd(24) + Math.min(r.inicio.pontaAoEsterno, r.fim.pontaAoEsterno).toFixed(2) + ' m');
}
const cara = saida.filter(r => Math.min(r.inicio.pontaPertoDaCara ?? 9, r.fim.pontaPertoDaCara ?? 9) < 0.22);
console.log('  ' + cara.length + ' sinais com os dedos a menos de 22 cm da cabeça: ' + cara.map(r => r.palavra).join(', '));

/* --- 4. movimento real: todos os ossos, não só o pulso --- */
console.log('\n=== 4. MOVIMENTO REAL ENTRE O PRIMEIRO E O ÚLTIMO PASSO ===');
console.log('(somaOssos = soma dos graus de todos os 55 ossos; angPalma = quanto vira a palma)');
const mov = new Map();
for (const r of saida) {
  const m = r.nota.replace(/^2:/, '').split(/\s+/).pop();
  if (!mov.has(m)) mov.set(m, []);
  mov.get(m).push(r);
}
for (const [m, rs] of [...mov.entries()].sort((x, y) => y[1].length - x[1].length)) {
  const soma = med(rs.map(r => r.movimento.somaOssos));
  const palma = med(rs.map(r => r.movimento.angPalma));
  const desl = med(rs.map(r => r.movimento.deslizePunho)) * 100;
  console.log('  ' + m.padEnd(9) + ' n=' + String(rs.length).padStart(3) +
    '  ossos ' + soma.toFixed(0).padStart(5) + '°' +
    '  palma ' + palma.toFixed(0).padStart(4) + '°' +
    '  punho ' + desl.toFixed(1).padStart(5) + ' cm' +
    (soma < 12 ? '   ← quase nada' : ''));
}
const fraco = saida.filter(r => r.movimento.somaOssos < 12);
console.log('\n  sinais cujo corpo inteiro muda menos de 12° entre início e fim: ' + fraco.length + '/191');
console.log('  ' + fraco.map(r => r.palavra + '[' + r.movimento.somaOssos + '°]').join(', '));

/* --- 5. colisão perceptiva: pares de sinais que são a mesma animação --- */
const prox = dados.proximos || [];
const envolvidos = new Set();
for (const p of prox) { envolvidos.add(p.a); envolvidos.add(p.b); }
console.log('\n=== 5. PARES DE SINAIS INDISTINGUÍVEIS (mesma animação: <8° de diferença média por osso) ===');
console.log('  ' + prox.length + ' pares · ' + envolvidos.size + '/191 palavras (' +
  Math.round(100 * envolvidos.size / saida.length) + '%) partilham a animação com outra');
const porPalavra = new Map();
for (const p of prox) {
  if (!porPalavra.has(p.a)) porPalavra.set(p.a, []);
  porPalavra.get(p.a).push(p.b + ' (' + p.d + '°)');
}
const top = [...porPalavra.entries()].sort((a, b) => b[1].length - a[1].length);
console.log('\n  os piores nós (palavras com mais gémeas):');
for (const [p, outras] of top.slice(0, 12)) {
  console.log('    ' + p.padEnd(16) + '(' + outras.length + ') ' + outras.slice(0, 14).join(', '));
}
console.log('\n  os 25 pares mais próximos:');
for (const p of prox.slice(0, 25)) console.log('    ' + p.d.toFixed(2) + '°  ' + p.a + '  ≈  ' + p.b);

