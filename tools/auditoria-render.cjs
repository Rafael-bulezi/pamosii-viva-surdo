/* Junta as medições (sonda-alcance.json) e as colisões de notação num
   veredicto por palavra, para a auditoria de render.
   uso: node tools/auditoria-render.cjs > tools/fonte/auditoria-render.json */
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const dados = JSON.parse(fs.readFileSync(path.join(os.homedir(), 'glb-lab', 'sonda-alcance.json'), 'utf8'));
const caixa = vm.createContext({ Math, console });
const api = vm.runInContext(
  fs.readFileSync(path.join(RAIZ, 'app', 'maos.js'), 'utf8') + '\n;({SINAIS: SINAIS, sinalNotacao: sinalNotacao});',
  caixa, { filename: 'maos.js' });

const LOCAL_PRECISA_PARCEIRA = /^mao$|^baixo$|^lado$|^barriga$|^telhado$/;
const twinsBy = new Map();
for (const p of dados.proximos || []) {
  if (!twinsBy.has(p.a)) twinsBy.set(p.a, []);
  if (!twinsBy.has(p.b)) twinsBy.set(p.b, []);
  twinsBy.get(p.a).push(p);
  twinsBy.get(p.b).push(p);
}

const linhas = [];
for (const r of dados.saida) {
  const g = twinsBy.get(r.palavra) || [];
  const problemas = [];
  if (r.movimento.somaOssos < 12) problemas.push('imóvel:' + r.movimento.somaOssos + '°');
  /* só o lugar `mao` exige a outra palma; mede-se a distância, não se assume */
  if (!r.duas && r.local === 'mao' && r.inicio.maosJuntas > 0.18)
    problemas.push('sem-parceira:' + r.inicio.maosJuntas + 'm');
  if (r.duas && Math.min(r.inicio.maosJuntas, r.fim.maosJuntas) > 0.12 && /mao|telhado/.test(r.local))
    problemas.push('mãos-não-tocam');
  if (g.length) problemas.push('gemeas:' + g.length);
  /* Contra o punho PEDIDO, não contra a âncora parada: um sinal que se afasta
     da âncora não está fora de alcance. Acima de 3 cm o braço esticou e a mão
     não chegou onde a notação a mandou. */
  const alcance = Math.max(r.inicio.erroPedido, r.fim.erroPedido);
  if (alcance > 0.03) problemas.push('fora-de-alcance:' + alcance.toFixed(3) + 'm');
  linhas.push({
    palavra: r.palavra,
    nota: r.nota,
    forma: r.forma,
    local: r.local,
    duas: r.duas,
    movimento_total_graus: r.movimento.somaOssos,
    palma_vira_graus: r.movimento.angPalma,
    dedos_rodam_graus: r.movimento.angDedos,
    punho_desliza_cm: Math.round(r.movimento.deslizePunho * 1000) / 10,
    mao_parada_a_cm: Math.round(Math.min(r.inicio.maosJuntas, r.fim.maosJuntas) * 100),
    erros: problemas,
    veredicto: problemas.length ? (problemas[0].startsWith('imóvel') ? 'errado' : 'ambíguo') : 'verificar-visual',
    gemeas: g.slice(0, 6).map(p => (p.a === r.palavra ? p.b : p.a) + ' (' + p.m + '°/mão)'),
  });
}

const conta = f => linhas.filter(f).length;
const resumo = {
  gerado: '2026-11-01',
  ferramenta: 'tools/folha-3d.cjs + tools/sonda-alcance.cjs + tools/auditoria-render.cjs',
  palavras: linhas.length,
  immobili: conta(l => l.movimento_total_graus < 12),
  sem_mao_parceira: conta(l => l.erros.some(e => e.startsWith('sem-parceira'))),
  com_gemeas: conta(l => l.erros.some(e => e.startsWith('gemeas'))),
  fora_de_alcance: conta(l => l.erros.some(e => e.startsWith('fora-de-alcance'))),
  palma_nao_vira: conta(l => l.palma_vira_graus < 5),
  /* a mão que não roda nem nos dedos nem na palma é a que se lê como congelada */
  mao_nao_roda: conta(l => l.palma_vira_graus < 5 && l.dedos_rodam_graus < 5),
  pares_indistinguiveis: (dados.proximos || []).length,
  /* abaixo de 3° nas mãos os dois sinais são a mesma imagem: não é ambiguidade,
     é falta de sinal próprio */
  pares_iguais_maos: (dados.proximos || []).filter(p => p.m < 3).length,
  movimentos: {
    soma_ossos_por_movimento: (() => {
      const m = new Map();
      for (const r of dados.saida) {
        const k = r.nota.replace(/^2:/, '').split(/\s+/).pop();
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(r.movimento.somaOssos);
      }
      return Object.fromEntries([...m.entries()].map(([k, v]) => [k, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]));
    })(),
  },
};
console.log(JSON.stringify({ resumo, linhas }, null, 1));
