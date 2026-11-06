#!/usr/bin/env node
'use strict';
/*
 * FOLHA-LGA-3D — Fotografa a personagem 3D Agatha no palco WebGL executando
 * os sinais LGA verificados das aulas do canal Viva surdo.
 *
 * Suporta --lote=1a (Saudação) ou --lote=1b (Números).
 * Captura 3 momentos de cada sinal (início, meio, fim) diretamente do canvas 3D.
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { frear } = require('./freno.cjs');

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const a = argv.find(x => x.startsWith('--' + n + '='));
  return a ? a.slice(n.length + 3) : d;
};

const LOTE = flag('lote', '1b');
const RAIZ = path.resolve(__dirname, '..');
const APP_DIR = path.join(RAIZ, 'app');
const PORTA_HTTP = 8123;
const PORTA_CDP = 9336;

const CONFIG_LOTE = {
  '1a': {
    aula: 'Saudação',
    titulo: 'LGA 3D — Lote 1a: Aula 01 (Saudação)',
    subtitulo: 'Avatar 3D Agatha (Three.js WebGL) · 6 poses no palco WebGL (3 diretas, 3 aproximadas) · 3 instantes por sinal · viva-surdo',
    saida: path.join(RAIZ, 'tools', 'fonte', 'lga-3d', 'lote-1a-saudacao.png'),
  },
  '1b': {
    aula: 'Números',
    titulo: 'LGA 3D — Lote 1b: Aula 03 (Números)',
    subtitulo: 'Avatar 3D Agatha (Three.js WebGL) · 6 poses no palco WebGL (5 diretas, 1 aproximada) · 3 instantes por sinal · viva-surdo',
    saida: path.join(RAIZ, 'tools', 'fonte', 'lga-3d', 'lote-1b-numeros.png'),
  },
}[LOTE] || {
  aula: 'Números',
  titulo: 'LGA 3D — Lote 1b: Aula 03 (Números)',
  subtitulo: 'Avatar 3D Agatha (Three.js WebGL) · poses no palco WebGL',
  saida: path.join(RAIZ, 'tools', 'fonte', 'lga-3d', 'lote-1b-numeros.png'),
};

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(p => fs.existsSync(p));

if (!CHROME) {
  console.error('Chrome não encontrado.');
  process.exit(1);
}

const tiposMime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
  '.webmanifest': 'application/manifest+json',
};

function criarServidor() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    if (p === '/') p = '/index.html';
    const ficheiro = path.normalize(path.join(APP_DIR, p));
    if (!ficheiro.startsWith(APP_DIR)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(ficheiro, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('not found: ' + p);
      }
      res.writeHead(200, {
        'Content-Type': tiposMime[path.extname(ficheiro)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    });
  });
  return new Promise((ok, ko) => {
    srv.listen(PORTA_HTTP, '127.0.0.1', () => {
      console.log(`Servidor HTTP local a correr em http://127.0.0.1:${PORTA_HTTP}`);
      ok(srv);
    });
    srv.on('error', ko);
  });
}

function ligarCDP(url) {
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
      fechar() { try { ws.close(); } catch (e) {} },
    });
  });
}

const dormir = ms => new Promise(r => setTimeout(r, ms));

async function obterAlvoCDP(porta) {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${porta}/json/new?about:blank`, { method: 'PUT' });
      if (r.ok) return await r.json();
    } catch (e) {}
    await dormir(150);
  }
  throw new Error('Chrome não abriu a porta CDP ' + porta);
}

function scriptRenderizacao(filtroAula, titulo, subtitulo) {
  return `(async () => {
    const SINAIS = window.SINAIS_LGA || {};
    const FONTE = window.FONTE_LGA || {};
    const filtro = ${JSON.stringify(filtroAula)};
    const titulo = ${JSON.stringify(titulo)};
    const subtitulo = ${JSON.stringify(subtitulo)};

    const itens = Object.entries(SINAIS).map(([chave, d]) => {
      const fe = FONTE[chave] || {};
      return {
        chave,
        palavra: fe.palavra || chave,
        notacao: d.notacao,
        aproximado: !!d.aproximado,
        aula: d.aula,
        segundos: d.segundos,
      };
    }).filter(x => x.aula && x.aula.includes(filtro) && !!x.notacao);

    if (!itens.length) return { ok: 0, erro: 'Nenhum sinal LGA com notação encontrado para ' + filtro };

    const palco = document.querySelector('#palco canvas');
    if (!palco) return { ok: 0, erro: 'Canvas 3D (#palco canvas) não encontrado' };

    // Enquadra busto com folga 1.28 para braços e mãos estarem sempre no plano de visualização
    if (window.AVATAR && AVATAR.enquadrar) {
      AVATAR.enquadrar('busto', 1.28);
    }

    const INSTANTES = [
      { id: 'inicio', t: 0.0, label: 'início' },
      { id: 'meio',   t: 0.5, label: 'meio' },
      { id: 'fim',    t: 1.0, label: 'fim' }
    ];

    const COLUNAS = INSTANTES.length;
    const TW = 340, TH = 380, BANDA_TOPO = 28, BANDA_FUNDO = 28, CABECALHO = 68;
    const linhas = itens.length;
    const larguraTotal = COLUNAS * TW;
    const alturaTotal = CABECALHO + linhas * (TH + BANDA_TOPO + BANDA_FUNDO);

    const folha = document.createElement('canvas');
    folha.width = larguraTotal;
    folha.height = alturaTotal;
    const g = folha.getContext('2d');

    // Fundo geral
    g.fillStyle = '#0b1411';
    g.fillRect(0, 0, folha.width, folha.height);

    // Cabeçalho geral
    g.fillStyle = '#142721';
    g.fillRect(0, 0, folha.width, CABECALHO);
    g.fillStyle = '#4ade80';
    g.font = 'bold 22px system-ui, -apple-system, sans-serif';
    g.fillText(titulo + ' — ' + itens.length + ' Poses', 24, 30);
    g.fillStyle = '#94a3b8';
    g.font = '13px system-ui, -apple-system, sans-serif';
    g.fillText(subtitulo, 24, 52);

    const tmp = document.createElement('canvas');
    const tg = tmp.getContext('2d');
    const espera2 = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    let ok = 0;
    const falhas = [];

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const beat = window.notacaoParaBeat ? window.notacaoParaBeat(item.notacao, item.chave) : null;
      if (!beat) {
        falhas.push(item.chave + ': beat inválido');
        continue;
      }

      const yLinha = CABECALHO + i * (TH + BANDA_TOPO + BANDA_FUNDO);

      for (let k = 0; k < INSTANTES.length; k++) {
        const inst = INSTANTES[k];
        try {
          const pose = SINAL3D.poseEm(beat, inst.t);
          AVATAR.poseParaQuats(pose);
          AVATAR.congelar();
          await espera2();
          await espera2();

          tmp.width = palco.width;
          tmp.height = palco.height;
          tg.fillStyle = '#192b25';
          tg.fillRect(0, 0, tmp.width, tmp.height);
          tg.drawImage(palco, 0, 0);

          const x = k * TW;
          const y = yLinha;

          // Célula
          g.fillStyle = '#101e19';
          g.fillRect(x + 2, y + 2, TW - 4, TH + BANDA_TOPO + BANDA_FUNDO - 4);

          // Topo: chave, palavra, segundos e instante
          g.fillStyle = item.aproximado ? '#2e2613' : '#1a322a';
          g.fillRect(x + 3, y + 3, TW - 6, BANDA_TOPO);

          g.fillStyle = '#f8fafc';
          g.font = 'bold 13px system-ui, sans-serif';
          const segTexto = item.segundos ? (item.segundos[0] + 's->' + item.segundos[1] + 's') : '';
          const rotuloPalavra = item.palavra !== item.chave ? (item.palavra + ' (' + item.chave + ')') : item.chave;
          g.fillText(rotuloPalavra + ' · ' + segTexto, x + 8, y + 19);

          g.fillStyle = item.aproximado ? '#fbbf24' : '#4ade80';
          g.font = 'bold 12px monospace';
          const tagTexto = item.aproximado ? ('[aprox: ' + inst.label + ']') : ('[' + inst.label + ']');
          const wTag = g.measureText(tagTexto).width;
          g.fillText(tagTexto, x + TW - wTag - 8, y + 19);

          // Recorte centrado amplo (84% da largura)
          const fracLarg = 0.84;
          const cx = Math.round(tmp.width * (0.5 - fracLarg / 2));
          const cw = Math.round(tmp.width * fracLarg);
          const cy = 0;
          const ch = Math.round(tmp.height * 0.98);

          g.drawImage(tmp, cx, cy, cw, ch, x + 3, y + BANDA_TOPO, TW - 6, TH);

          // Rodapé: notação e aula
          g.fillStyle = '#0d1814';
          g.fillRect(x + 3, y + BANDA_TOPO + TH, TW - 6, BANDA_FUNDO);

          g.fillStyle = item.aproximado ? '#fbbf24' : '#38bdf8';
          g.font = '12px monospace';
          g.fillText(item.notacao, x + 8, y + BANDA_TOPO + TH + 18);

          g.fillStyle = '#94a3b8';
          g.font = '11px system-ui, sans-serif';
          const aulaTxt = item.aula.replace(/ —.*$/, '');
          const wAula = g.measureText(aulaTxt).width;
          g.fillText(aulaTxt, x + TW - wAula - 8, y + BANDA_TOPO + TH + 18);

          ok++;
        } catch (e) {
          falhas.push(item.chave + '/' + inst.id + ': ' + e.message);
        }
      }
    }

    try { AVATAR.pousar(); } catch (e) {}

    let png = null;
    try {
      png = folha.toDataURL('image/png');
    } catch (e) {
      falhas.push('erro toDataURL: ' + e.message);
    }

    return { ok, falhas, largura: folha.width, altura: folha.height, png };
  })()`;
}

async function main() {
  fs.mkdirSync(path.dirname(CONFIG_LOTE.saida), { recursive: true });

  let servidor = null;
  try {
    servidor = await criarServidor();
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.log('Servidor HTTP já está a correr na porta ' + PORTA_HTTP);
    } else {
      throw err;
    }
  }

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'pamosii-lga3d-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + PORTA_CDP,
    '--user-data-dir=' + perfil,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    'about:blank',
  ], { stdio: 'ignore' });

  await frear(chrome.pid, 7);

  let cliente = null;
  try {
    const alvo = await obterAlvoCDP(PORTA_CDP);
    cliente = await ligarCDP(alvo.webSocketDebuggerUrl);
    const p = cliente.pedir;
    await p('Page.enable');
    await p('Runtime.enable');
    await p('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });

    const avaliar = async expr => {
      const r = await p('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 180000 });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.text + ' ' + ((r.exceptionDetails.exception || {}).description || ''));
      }
      return r.result.value;
    };

    const carregar = async url => {
      const pronto = new Promise(res => cliente.ao(m => { if (m.method === 'Page.loadEventFired') res(); }));
      await p('Page.navigate', { url });
      await Promise.race([pronto, dormir(20000)]);
      await dormir(500);
    };

    console.log('A navegar para http://127.0.0.1:' + PORTA_HTTP + '/?folha3d=1#/ ...');
    await carregar(`http://127.0.0.1:${PORTA_HTTP}/?folha3d=1#/`);

    console.log('A aguardar que a personagem 3D Agatha (AVATAR) carregue...');
    for (let i = 0; i < 120; i++) {
      const pronto = await avaliar('!!(window.AVATAR && AVATAR.pronto && window.SINAL3D && window.SINAIS_LGA && typeof notacaoParaBeat === "function")');
      if (pronto) break;
      await dormir(500);
      if (i === 119) {
        const estado = await avaliar('JSON.stringify({AVATAR:!!window.AVATAR, pronto:!!(window.AVATAR&&AVATAR.pronto), SINAL3D:!!window.SINAL3D, LGA:!!window.SINAIS_LGA, beat:typeof notacaoParaBeat})');
        throw new Error('A sinalizadora 3D não carregou a tempo: ' + estado);
      }
    }
    console.log('Personagem 3D Agatha pronta no palco WebGL!');

    console.log(`A gerar folha de prova 3D para ${CONFIG_LOTE.titulo}...`);
    const r = await avaliar(scriptRenderizacao(CONFIG_LOTE.aula, CONFIG_LOTE.titulo, CONFIG_LOTE.subtitulo));
    if (!r.png) throw new Error('A folha voltou sem PNG: ' + (r.falhas || []).join(' | '));

    const buffer = Buffer.from(r.png.slice(r.png.indexOf(',') + 1), 'base64');
    fs.writeFileSync(CONFIG_LOTE.saida, buffer);
    console.log(`Prova 3D gerada com sucesso (${r.ok} quadros 3D WebGL, ${r.largura}x${r.altura}px, ${buffer.length} bytes):`);
    console.log('  -> ' + CONFIG_LOTE.saida);

    if (r.falhas && r.falhas.length) {
      console.log('Avisos/falhas:', r.falhas);
    }
  } finally {
    if (cliente) {
      try { await cliente.pedir('Browser.close'); } catch (e) {}
      cliente.fechar();
    }
    chrome.kill();
    try { fs.rmSync(perfil, { recursive: true, force: true }); } catch (e) {}
    if (servidor) {
      try { servidor.close(); } catch (e) {}
    }
  }
}

main().catch(err => {
  console.error('ERRO:', err);
  process.exit(1);
});
