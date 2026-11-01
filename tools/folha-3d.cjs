#!/usr/bin/env node
'use strict';
/*
 * FOLHA-3D — fotografa o avatar 3D a executar cada sinal, para auditoria visual.
 *
 *   node tools/folha-3d.cjs --palavras=sim,casa,azul
 *   node tools/folha-3d.cjs --com-referencia            # as 83 que têm vídeo IS
 *   node tools/folha-3d.cjs --todos --porFolha=8        # os 191, em folhas
 *   node tools/folha-3d.cjs --palavras=casa --instantes=inicio,fim
 *
 * O que faz: abre o Chrome sem interface, espera a sinalizadora carregar, e para
 * cada palavra monta o beat exactamente pela mesma rota que o site usa
 * (sinalNotacao -> SINAL3D.sequencia -> AVATAR.poseParaQuats), congela essa pose,
 * lê o canvas e cola o recorte numa folha com etiqueta. Cada folha é um PNG em
 * ~/glb-lab/folhas/. Serve para comparar o QUE O UTILIZADOR VÊ com o vídeo da
 * fonte — não para comparar a notação com o vídeo, que é outro teste.
 *
 * Precisa do servidor local de pé: node tools/serve.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');
const { frear } = require('./freno.cjs');

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const a = argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.slice(n.length + 3) : d;
};
const tem = n => argv.includes('--' + n);

const RAIZ = path.resolve(__dirname, '..');
const BASE = flag('base', 'http://127.0.0.1:8123/');
const PORTA = Number(flag('porta', 9333));
const SAIDA = path.resolve(RAIZ, flag('out', path.join(os.homedir(), 'glb-lab', 'folhas')));
/* 4 palavras = 8 poses por folha. Com 12, o WebGL por software prendia os
   quatro threads até ao fim da folha; assim o SO interrompe entre lotes. */
const POR_FOLHA = Number(flag('porFolha', 4));
const PREFIXO = flag('prefix', '');
const DESDE = Number(flag('desde', 1));
const INSTANTES = (flag('instantes', 'inicio,fim') || 'fim').split(',').map(s => s.trim()).filter(Boolean);
/* O enquadramento de referência é o palco 1000×700: é a razão em que as
   folhas revistas foram fotografadas. A janela de recorte é uma fracção
   DESSA largura, por isso mudar a janela muda a escala da figura no
   painel. A 400×520 o palco da página deixa de ter a razão 10:7 e a
   mesma fracção passa a apanhar outro pedaço do mundo — a figura saía
   pequena e com margem. Fica 1000×700, como folha-03.png. */
const LARGURA = Number(flag('largura', 1000));
const ALTURA = Number(flag('altura', 700));
const PAUSA = Number(flag('pausa', 2000));
const TEM_MAOS = tem('maos');
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LOCAL_FORMA = flag('localForma', 'frente');

const CHROME = [
  flag('chrome', ''),
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find(p => fs.existsSync(p));

if (!CHROME) {
  console.error('Não encontro o Chrome. Passa o caminho com --chrome=.');
  process.exit(1);
}

/* ---------------- as palavras a fotografar, lidas do próprio código ---------------- */
function listarPalavras() {
  const caixa = vm.createContext({ Math, console });
  const fonte = fs.readFileSync(path.join(RAIZ, 'app', 'maos.js'), 'utf8');
  const api = vm.runInContext(fonte + '\n;({SINAIS: SINAIS, sinalNotacao: sinalNotacao});', caixa, { filename: 'maos.js' });
  if (tem('todos')) return Object.keys(api.SINAIS);
  if (tem('alfabeto')) return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  if (tem('com-referencia')) {
    const mapa = JSON.parse(fs.readFileSync(path.join(RAIZ, 'tools', 'fonte', 'is-correspondencias.json'), 'utf8'));
    return Object.keys(mapa).filter(p => !!api.sinalNotacao(p));
  }
  const dado = flag('palavras', '');
  if (!dado) {
    console.error('Diz --palavras=a,b,c | --com-referencia | --todos');
    process.exit(1);
  }
  return dado.split(',').map(s => s.trim()).filter(Boolean);
}

/* ---------------- cliente CDP mínimo ---------------- */
function ligar(url) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(url);
    let id = 0;
    const espera = new Map();
    const eventos = [];
    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id && espera.has(m.id)) {
        const { ok, ko } = espera.get(m.id);
        espera.delete(m.id);
        m.error ? ko(new Error(m.error.message)) : ok(m.result);
        return;
      }
      eventos.forEach(fn => fn(m));
    };
    ws.onerror = e => rej(new Error('WebSocket: ' + (e.message || 'erro')));
    ws.onopen = () => res({
      pedir(method, params) {
        return new Promise((ok, ko) => {
          const n = ++id;
          espera.set(n, { ok, ko });
          ws.send(JSON.stringify({ id: n, method, params: params || {} }));
        });
      },
      ao(fn) { eventos.push(fn); },
      fechar() { try { ws.close(); } catch (e) { /* já fechado */ } },
    });
  });
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function alvo(porta) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) return await r.json();
    } catch (e) { /* ainda a arrancar */ }
    await dormir(150);
  }
  throw new Error('O Chrome não abriu a porta de depuração ' + porta);
}

/* ---------------- o script que corre dentro da página ----------------
   Devolve {ok, falhas, largura, altura} e deixa a folha montada no DOM. */
function scriptFolha(palavras, instantes) {
  return `(async () => {
    const PAL = ${JSON.stringify(palavras)};
    const INST = ${JSON.stringify(instantes)};
    const FORMAS = ${JSON.stringify(LETRAS)};
    const LOCAL_FORMA = ${JSON.stringify(LOCAL_FORMA)};
    const SO_MAOS = ${TEM_MAOS ? 'true' : 'false'};
    const COLUNAS = Math.min(3, PAL.length);
    const TW = SO_MAOS ? 250 : 270, TH = SO_MAOS ? 250 : 350, BANDA = 26;
    const linhas = Math.ceil(PAL.length / COLUNAS);
    const folha = document.getElementById('folha3d') || document.createElement('canvas');
    folha.id = 'folha3d';
    folha.width = COLUNAS * TW * INST.length;
    folha.height = linhas * (TH + BANDA);
    folha.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#fff';
    if (!folha.parentNode) document.body.appendChild(folha);
    const g = folha.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, folha.width, folha.height);
    const palco = document.querySelector('#palco canvas');
    if (!palco) return { ok: 0, falhas: ['sem canvas do palco'] };
    const tmp = document.createElement('canvas');
    const tg = tmp.getContext('2d');
    const beatDe = (w) => {
      if (FORMAS.indexOf(w) >= 0) {
        /* modo formas: desenha só a mão, sem movimento, para ler a silhueta */
        return { tipo: 'sinal', rotulo: w, forma: w, duas: false, reps: 1, local: LOCAL_FORMA,
          pos0: [0, 0, 0], rot0: [0, 0, 0], pos1: [0, 0, 0], rot1: [0, 0, 0], dur: 760 };
      }
      const n = (typeof sinalNotacao === 'function') && sinalNotacao(w);
      if (!n) return null;
      return { tipo: 'sinal', rotulo: w, forma: n.forma, duas: n.duas, reps: n.reps, local: n.local,
        pos0: n.inicio.pos, rot0: n.inicio.rot, pos1: n.fim.pos, rot1: n.fim.rot, dur: 760,
        movimento: n.movimento, palma: n.palma, esq: n.esq, amp: n.amp };
    };
    const espera2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    let ok = 0; const falhas = []; const tempos = [];
    for (let i = 0; i < PAL.length; i++) {
      const w = PAL[i];
      const b = beatDe(w);
      if (!b) { falhas.push(w + ': sem notação'); continue; }
      let passos;
      try {
        passos = SINAL3D.sequencia([b]);
      } catch (e) { falhas.push(w + ': ' + e.message); continue; }
      const linha = Math.floor(i / COLUNAS), col = i % COLUNAS;
      for (let k = 0; k < INST.length; k++) {
        const idx = INST[k] === 'inicio' ? 0 : passos.length - 1;
        try {
          const ta = performance.now();
          AVATAR.poseParaQuats(passos[idx].pose);
          AVATAR.congelar();
          const tb = performance.now();
          await espera2();
          const tc = performance.now();
          /* recorte: com --maos, um quadrado em volta da mão projectada; sem,
             42% da largura ao centro, do topo quase ao fundo */
          let recorte = null;
          if (SO_MAOS) {
            const v = new AVATAR.THREE.Vector3();
            AVATAR.ossos['J_Bip_R_Hand'].getWorldPosition(v).project(AVATAR.cam);
            recorte = { x: (v.x * 0.5 + 0.5), y: (-v.y * 0.5 + 0.5) };
          }
          /* Cópia directa do canvas. O toDataURL comprimia um PNG do palco por
             pose e voltava a descodificá-lo — 24 vezes por folha, em série, e
             era esse o custo que prendia o CPU todo. drawImage lê o mesmo
             buffer sem passar por PNG. (O palco é criado com
             preserveDrawingBuffer quando a página é aberta com ?folha3d=1.) */
          tmp.width = palco.width; tmp.height = palco.height;
          tg.fillStyle = '#f6f9f1'; tg.fillRect(0, 0, tmp.width, tmp.height);
          tg.drawImage(palco, 0, 0);
          const td = performance.now();
          const x = (col * INST.length + k) * TW;
          const y = linha * (TH + BANDA);
          g.fillStyle = '#fff'; g.fillRect(x, y, TW, TH + BANDA);
          /* recorte: corpo inteiro (42% da largura ao centro) ou a mão em close */
          let cx, cy, cw, ch;
          if (recorte) {
            const lado = Math.round(tmp.height * 0.34);
            cx = Math.max(0, Math.min(tmp.width - lado, Math.round(recorte.x * tmp.width) - lado / 2));
            cy = Math.max(0, Math.min(tmp.height - lado, Math.round(recorte.y * tmp.height) - lado / 2));
            cw = ch = lado;
          } else {
            /* A janela é 0,42 da largura à razão 1000×700; a outra razão o
               enquadramento mudava. Corrige-se pela razão: a 400×520 são 78%
               da largura e o corpo aparece exactamente à mesma escala. */
            const fracLarg = Math.min(1, 0.42 * (1000 / 700) / (tmp.width / tmp.height));            cx = Math.round(tmp.width * (0.5 - fracLarg / 2)); cw = Math.round(tmp.width * fracLarg);
            cy = 0; ch = Math.round(tmp.height * 0.97);
          }
          g.drawImage(tmp, cx, cy, cw, ch, x + 2, y + 2, TW - 4, TH - 2);
          g.fillStyle = '#111'; g.font = 'bold 14px sans-serif';
          g.fillText(w + ' [' + INST[k] + ']', x + 5, y + TH + 16);
          g.font = '12px sans-serif'; g.fillStyle = '#444';
          const nota = (typeof SINAIS !== 'undefined' && SINAIS[w]) || '';
          const larg = g.measureText(nota).width;
          g.fillText(nota, x + TW - larg - 6, y + TH + 16);
          tempos.push({ pose: Math.round(tb - ta), raf: Math.round(tc - tb), copia: Math.round(td - tc), celula: Math.round(performance.now() - td) });
          ok++;
        } catch (e) { falhas.push(w + '/' + INST[k] + ': ' + e.message); }
      }
    }
    try { AVATAR.pousar(); } catch (e) { /* tanto faz */ }
    /* A folha já é um canvas 2D completo. Exportá-la aqui custa uma
       codificação pequena; içar o estado WebGL até ao compositor do Chrome
       para o fotografar custava 546 s por folha (medido em folha-d01).
       Uma folha, um PNG — em vez de 24 PNGs do palco por folha. */
    let png = null;
    try { png = folha.toDataURL('image/png'); } catch (e) { falhas.push('png: ' + e.message); }
    return { ok, falhas, tempos, largura: folha.width, altura: folha.height, png };
  })()`;
}

function lerFeito(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, 'done.json'), 'utf8')); } catch (e) { return {}; }
}

async function main() {
  const todas = listarPalavras();
  fs.mkdirSync(SAIDA, { recursive: true });
  /* o índice é sempre lido e acrescentado: um lote parcial não pode apagar o
     registo dos anteriores */
  const feito = lerFeito(SAIDA);
  const palavras = tem('pular-existentes') ? todas.filter(p => !feito[p]) : todas;
  const saltadas = todas.length - palavras.length;
  console.log(`${todas.length} palavras · ${saltadas} já fotografadas · ${palavras.length} a fazer · ${INSTANTES.join('+')} · ${POR_FOLHA} por folha → ${SAIDA}`);
  if (!palavras.length) { console.log('nada a fazer.'); return 0; }

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'pamosii-folha-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=' + PORTA, '--user-data-dir=' + perfil,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--use-gl=angle', '--use-angle=swiftshader', 'about:blank',
  ], { stdio: 'ignore' });

  const pidChrome = chrome.pid;
  /* 3 de 4 threads. Com 2 (máscara 3) o Chrome ficava BelowNormal sem CPU
     que chegasse e a folha levava 15 min; a rasterização do SwiftShader é
     o custo real (ver a linha «captura» no log), não a prioridade. */
  await frear(pidChrome, 7);

  let cliente = null;
  const folhas = [];
  try {
    const t = await alvo(PORTA);
    cliente = await ligar(t.webSocketDebuggerUrl);
    const p = cliente.pedir;
    await p('Page.enable');
    await p('Runtime.enable');
    await p('Emulation.setDeviceMetricsOverride', { width: LARGURA, height: ALTURA, deviceScaleFactor: 1, mobile: false });

    const avaliar = async expr => {
      const r = await p('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 180000 });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || ''));
      return r.result.value;
    };
    const carregar = async url => {
      const pronto = new Promise(res => cliente.ao(m => { if (m.method === 'Page.loadEventFired') res(); }));
      await p('Page.navigate', { url });
      await Promise.race([pronto, dormir(20000)]);
      await dormir(400);
    };

    await carregar(BASE + '?folha3d=1#/');
    const sonda = 'JSON.stringify({AVATAR:!!window.AVATAR, pronto:!!(window.AVATAR&&AVATAR.pronto), SINAL3D:!!window.SINAL3D, nota:typeof window.sinalNotacao, THREE:!!window.THREE, err:window.__erro||null})';
    for (let i = 0; i < 120; i++) {
      const pronto = await avaliar('!!(window.AVATAR && AVATAR.pronto && window.SINAL3D && typeof sinalNotacao === "function")');
      if (pronto) break;
      await dormir(500);
      if (i === 119) throw new Error('a sinalizadora não carregou em ' + BASE + ' → ' + await avaliar(sonda));
    }
    console.log('sinalizadora pronta.');

    for (let i = 0; i < palavras.length; i += POR_FOLHA) {
      const lote = palavras.slice(i, i + POR_FOLHA);
      const t0 = Date.now();
      const r = await avaliar(scriptFolha(lote, INSTANTES));
      const t1 = Date.now();
      const n = PREFIXO + String(DESDE + Math.floor(i / POR_FOLHA)).padStart(2, '0');
      if (!r.png) throw new Error('a folha voltou sem PNG (' + (r.falhas || []).join(' | ') + ')');
      const ficheiro = path.join(SAIDA, 'folha-' + n + '.png');
      fs.writeFileSync(ficheiro, Buffer.from(r.png.slice(r.png.indexOf(',') + 1), 'base64'));
      const t2 = Date.now();
      folhas.push(ficheiro);
      for (const p of lote) feito[p] = path.basename(ficheiro);
      fs.writeFileSync(path.join(SAIDA, 'done.json'), JSON.stringify(feito, null, 1));
      const seg = ((Date.now() - t0) / 1000).toFixed(1);
      /* O colapso do lote diz onde está o custo: dentro da página (guião) ou
         no disco. Sem isto atribuí-se o tempo ao sítio errado. */
      const fora = `guião ${((t1 - t0) / 1000).toFixed(1)}s · disco ${((t2 - t1) / 1000).toFixed(1)}s`;
      const soma = k => ((r.tempos || []).reduce((s, t) => s + t[k], 0) / 1000).toFixed(1);
      console.log(`folha ${n}: ${r.ok} poses em ${seg}s (${fora} · pose ${soma('pose')}s · rAF ${soma('raf')}s · cópia ${soma('copia')}s · célula ${soma('celula')}s) → ${ficheiro}`);
      if (r.falhas && r.falhas.length) console.log('   falhas: ' + r.falhas.join(' | '));
      /* pausa entre folhas: o rasterizador por software precisa de largar os
         threads, senão a máquina fica a 100% enquanto a fila não acaba */
      await dormir(PAUSA);
    }
  } finally {
    /* Só se fecha o Chrome que este processo lançou: primeiro CDP
       Browser.close, depois kill no handle. Nada de matar processos por nome. */
    if (cliente) {
      try { await cliente.pedir('Browser.close'); } catch (e) { /* fecha connosco */ }
      cliente.fechar();
    }
    chrome.kill();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) { /* Windows segura o directório */ }
  }
  console.log('\n' + folhas.length + ' folha(s) em ' + SAIDA);
  return 0;
}

main().then(c => process.exit(c || 0)).catch(e => { console.error('ERRO: ' + e.message); process.exit(1); });
