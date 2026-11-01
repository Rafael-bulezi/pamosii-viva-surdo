#!/usr/bin/env node
'use strict';
/*
 * SONDA-ALCANCE — mede onde a mão REALMENTE fica, contra onde a notação pede.
 *
 *   node tools/serve.cjs            (noutro terminal)
 *   node tools/sonda-alcance.cjs
 *
 * Para cada uma das 191 palavras: monta o beat pela rota do site, aplica a pose
 * de início e de fim, e lê a posição no mundo do osso da mão. Depois compara com
 * o alvo que SINAL3D.ancoras() pediu, mede a distância entre as duas mãos
 * (contacto?) e a distância ao esterno (encravamento?). Não tira fotografias.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const { frear } = require('./freno.cjs');

const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const RAIZ = path.resolve(__dirname, '..');
const BASE = flag('base', 'http://127.0.0.1:8123/');
const PORTA = Number(flag('porta', 9343));
const SAIDA = path.resolve(RAIZ, flag('out', path.join(os.homedir(), 'glb-lab', 'sonda-alcance.json')));

const CHROME = [
  flag('chrome', ''),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].filter(Boolean).find(p => fs.existsSync(p));
if (!CHROME) { console.error('sem Chrome'); process.exit(1); }

const caixa = vm.createContext({ Math, console });
const fonte = fs.readFileSync(path.join(RAIZ, 'app', 'maos.js'), 'utf8');
const api = vm.runInContext(fonte + '\n;({SINAIS: SINAIS});', caixa, { filename: 'maos.js' });
const SO = flag('palavras', '');
const PALAVRAS = SO ? SO.split(',').map(s => s.trim()).filter(Boolean) : Object.keys(api.SINAIS);

function ligar(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const espera = new Map();
    const eventos = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && espera.has(m.id)) {
        const { ok, ko } = espera.get(m.id); espera.delete(m.id);
        m.error ? ko(new Error(m.error.message)) : ok(m.result); return;
      }
      eventos.forEach(fn => fn(m));
    };
    ws.onerror = e => rej(new Error('WebSocket: ' + (e.message || 'erro')));
    ws.onopen = () => res({
      pedir(method, params) {
        return new Promise((ok, ko) => { const n = ++id; espera.set(n, { ok, ko }); ws.send(JSON.stringify({ id: n, method, params: params || {} })); });
      },
      ao(fn) { eventos.push(fn); },
      fechar() { try { ws.close(); } catch (e) { } },
    });
  });
}
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function alvo(porta) {
  for (let i = 0; i < 80; i++) {
    try { const r = await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) return await r.json(); } catch (e) { }
    await dormir(150);
  }
  throw new Error('Chrome sem porta ' + porta);
}

function script(palavras) {
  return `(async () => {
    const PAL = ${JSON.stringify(palavras)};
    const T = AVATAR.THREE;
    const o = AVATAR.ossos;
    const ANC = SINAL3D.ancoras();
    const w = nome => o[nome];
    const pos = b => { const v = new T.Vector3(); v.setFromMatrixPosition(b.matrixWorld); return [v.x, v.y, v.z]; };
    const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
    const NOMES = Object.keys(o);
    /* ossos que decidem se dois sinais se distinguem: mão e as três falanges
       dos cinco dedos, dos dois lados */
    const OSSOS_MAO = NOMES.filter(n => /_Hand$|_(Index|Middle|Ring|Little|Thumb)[123]$/.test(n));
    /* instantâneo completo: posição do punho, normal da palma e o ângulo de
       cada um dos 55 ossos — é isto que o olho vê, não só o pulso a mexer */
    const instantaneo = () => {
      const q = {};
      const m = new T.Matrix4();
      for (const nome of NOMES) {
        q[nome] = o[nome].quaternion.clone();
        if (nome === 'J_Bip_R_Hand') m.copy(o[nome].matrixWorld);
      }
      /* quaternião no mundo: o local só diz como a mão está dobrada, não para
         onde está virada — e é isso que distingue um plano ao peito de um
         plano à frente. Guarda-se para todos os ossos porque a distância de
         corpo também se mede nesta trilha. */
      const qw = {};
      for (const nome of NOMES) qw[nome] = o[nome].getWorldQuaternion(new T.Quaternion());
      const palma = new T.Vector3(0, 0, 1).transformDirection(m).toArray();
      /* eixo dos dedos: uma onda roda o punho em torno da normal da palma, por
         isso a normal não muda — mas a direcção dos dedos muda muito. Sem esta
         medida, sete acenos contavam como mão parada. */
      const dedos = new T.Vector3(0, 1, 0).transformDirection(m).toArray();
      return { q, qw, palma, dedos, mao: pos(o['J_Bip_R_Hand']), ponta: o['J_Bip_R_Middle_1'] ? pos(o['J_Bip_R_Middle_1']) : null };
    };
    const beatDe = (k) => {
      const n = sinalNotacao(k); if (!n) return null;
      return { tipo:'sinal', rotulo:k, forma:n.forma, duas:n.duas, reps:n.reps, local:n.local,
        pos0:n.inicio.pos, rot0:n.inicio.rot, pos1:n.fim.pos, rot1:n.fim.rot, dur:760,
        movimento:n.movimento, palma:n.palma, esq:n.esq, amp:n.amp };
    };
    const saida = [];
    const falhas = [];
    /* referência do corpo, com o avatar em pose de repouso */
    AVATAR.repor && AVATAR.repor();
    AVATAR.cena.updateMatrixWorld(true);
    const corpo = { esterno: pos(w('J_Bip_C_Chest')), cabeca: pos(w('J_Bip_C_Head')), anca: pos(w('J_Bip_C_Hips')),
                    ombroD: pos(w('J_Bip_R_UpperArm')), ombroE: pos(w('J_Bip_L_UpperArm')) };
    for (const k of PAL) {
      const b = beatDe(k);
      if (!b) { falhas.push(k); continue; }
      let passos;
      try { passos = SINAL3D.sequencia([b]); } catch (e) { falhas.push(k + ': ' + e.message); continue; }
      const alvo = (ANC[b.local] || ANC.frente).mao;
      const reg = { palavra: k, local: b.local, forma: b.forma, duas: b.duas, nota: SINAIS[k] || '',
                    alvo: alvo.map(v => +v.toFixed(3)), corpo: corpo };
      const snaps = {};
      const guarda = {};
      for (const [nome, idx] of [['inicio', 0], ['fim', passos.length - 1]]) {
        AVATAR.repor && AVATAR.repor();
        AVATAR.poseParaQuats(passos[idx].pose);
        AVATAR.cena.updateMatrixWorld(true);
        snaps[nome] = instantaneo();
        guarda[nome === 'inicio' ? '_ini' : '_fim'] = snaps[nome];
        const he = pos(w('J_Bip_L_Hand'));
        /* o alvo que conta é o punho PEDIDO naquele instante, não a âncora
           parada: um sinal que se afasta da âncora não está fora de alcance. */
        const pedido = passos[idx].pose.D.mao;
        reg[nome] = {
          maoD: snaps[nome].mao.map(v => +v.toFixed(3)),
          palma: snaps[nome].palma.map(v => +v.toFixed(2)),
          maoE: he.map(v => +v.toFixed(3)),
          erroAlvo: +dist(snaps[nome].mao, alvo).toFixed(3),
          erroPedido: +dist(snaps[nome].mao, pedido).toFixed(3),
          maosJuntas: +dist(snaps[nome].mao, he).toFixed(3),
          aoEsterno: +dist(snaps[nome].mao, corpo.esterno).toFixed(3),
          pontaAoEsterno: snaps[nome].ponta ? +dist(snaps[nome].ponta, corpo.esterno).toFixed(3) : null,
          pontaPertoDaCara: snaps[nome].ponta ? +dist(snaps[nome].ponta, corpo.cabeca).toFixed(3) : null,
        };
      }
      /* movimento total: soma dos ângulos (graus) de todos os ossos entre os
         dois instantes, mais o ângulo da palma e o deslocamento do punho */
      let soma = 0, maxOsso = 0, maisMovido = '';
      for (const nome of NOMES) {
        const a = snaps.inicio.q[nome], c = snaps.fim.q[nome];
        const ang = 2 * Math.acos(Math.min(1, Math.abs(a.dot(c)))) * 180 / Math.PI;
        soma += ang;
        if (ang > maxOsso) { maxOsso = ang; maisMovido = nome.replace('J_Bip_', ''); }
      }
      const pa = new T.Vector3(...snaps.inicio.palma), pb = new T.Vector3(...snaps.fim.palma);
      const angPalma = Math.acos(Math.max(-1, Math.min(1, pa.dot(pb)))) * 180 / Math.PI;
      const da = new T.Vector3(...snaps.inicio.dedos), db = new T.Vector3(...snaps.fim.dedos);
      const angDedos = Math.acos(Math.max(-1, Math.min(1, da.dot(db)))) * 180 / Math.PI;
      reg.movimento = {
        somaOssos: +soma.toFixed(1),
        ossoMax: +maxOsso.toFixed(1),
        ossoNome: maisMovido,
        angPalma: +angPalma.toFixed(1),
        angDedos: +angDedos.toFixed(1),
        deslizePunho: +dist(snaps.inicio.mao, snaps.fim.mao).toFixed(3),
      };
      reg._ini = guarda._ini;
      reg._fim = guarda._fim;
      /* a trajectória inteira, não só as pontas: um movimento que vai e volta
         acaba onde começou, e comparar só as pontas dizia que bate e parado
         eram o mesmo sinal. Cinco amostras ao longo dos passos. */
      const IDX = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(t * (passos.length - 1)));
      reg._trilha = IDX.map((idx) => {
        AVATAR.repor && AVATAR.repor();
        AVATAR.poseParaQuats(passos[idx].pose);
        AVATAR.cena.updateMatrixWorld(true);
        return instantaneo().qw;
      });
      saida.push(reg);
    }
    AVATAR.pousar && AVATAR.pousar();
    /* distância de trajectória entre dois sinais. Duas medidas, porque só a
       primeira engana: a média sobre os 55 ossos é dominada pelo tronco, que é
       o mesmo em quase todos os sinais — dois sinais com mãos diferentes dão
       menos de 8°. A distinção lê-se nas mãos: osso da mão e as três falanges
       de cada um dos cinco dedos, dos dois lados. */
    const mediaQ = (A, B, lista) => {
      let s = 0;
      for (const nome of lista) {
        const a = A[nome], c = B[nome];
        s += 2 * Math.acos(Math.min(1, Math.abs(a.dot(c)))) * 180 / Math.PI;
      }
      return s / lista.length;
    };
    /* média ao longo das cinco amostras: corpo para contexto, mãos para decidir */
    const mediaTrilha = (A, B, lista) => {
      let s = 0;
      for (let i = 0; i < A.length; i++) s += mediaQ(A[i], B[i], lista);
      return s / A.length;
    };
    const proximos = [];
    for (let i = 0; i < saida.length; i++) {
      for (let j = i + 1; j < saida.length; j++) {
        const a = saida[i], b = saida[j];
        const m = mediaTrilha(a._trilha, b._trilha, OSSOS_MAO);
        if (m < 10) {
          const d = mediaTrilha(a._trilha, b._trilha, NOMES);
          proximos.push({ a: a.palavra, b: b.palavra, d: +d.toFixed(2), m: +m.toFixed(2) });
        }
      }
    }
    proximos.sort((x, y) => x.m - y.m);
    for (const r of saida) { delete r._ini; delete r._fim; delete r._trilha; delete r.corpo; }
    return { saida, falhas, proximos };
  })()`;
}

async function main() {
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'pamosii-alc-'));
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + PORTA, '--user-data-dir=' + perfil,
    '--no-first-run', '--no-default-browser-check', '--use-gl=angle', '--use-angle=swiftshader', 'about:blank'], { stdio: 'ignore' });
  await frear(chrome.pid, 7);
  let cliente = null;
  try {
    const t = await alvo(PORTA);
    cliente = await ligar(t.webSocketDebuggerUrl);
    const p = cliente.pedir;
    await p('Page.enable'); await p('Runtime.enable');
    await p('Emulation.setDeviceMetricsOverride', { width: 900, height: 700, deviceScaleFactor: 1, mobile: false });
    const avaliar = async expr => {
      const r = await p('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 180000 });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || ''));
      return r.result.value;
    };
    const pronto = new Promise(res => cliente.ao(m => { if (m.method === 'Page.loadEventFired') res(); }));
    await p('Page.navigate', { url: BASE + '?folha3d=1#/' });
    await Promise.race([pronto, dormir(20000)]);
    await dormir(400);
    for (let i = 0; i < 120; i++) {
      if (await avaliar('!!(window.AVATAR && AVATAR.pronto && window.SINAL3D && typeof sinalNotacao === "function")')) break;
      await dormir(500);
      if (i === 119) throw new Error('a sinalizadora não carregou');
    }
    console.log('pronta — a medir ' + PALAVRAS.length + ' palavras');
    const r = await avaliar(script(PALAVRAS));
    fs.writeFileSync(SAIDA, JSON.stringify(r, null, 1));
    console.log('→ ' + SAIDA + '  (' + r.saida.length + ' medidas, ' + (r.falhas || []).length + ' falhas)');
  } finally {
    if (cliente) cliente.fechar();
    chrome.kill();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { }
  }
  return 0;
}
main().then(c => process.exit(c || 0)).catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
