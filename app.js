/* ============================================================================
   AGATHA — duas funções: ver sinais de um texto, e procurar uma palavra.
   Sem contas, sem recolha de dados, sem build. Ficheiros: dados.js (glossário e
   glosador), maos.js (rig 3D desenhado em SVG) e este.
   ============================================================================ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* `lim` vem do maos.js (mesmo âmbito global) */

/* ---------------- acessibilidade ---------------- */
const A11Y_KEY = 'vs.a11y';
const A11Y_PADRAO = { temaEscuro: false, contraste: false, movimento: false, escala: 100 };
let A11Y = { ...A11Y_PADRAO };
try { A11Y = { ...A11Y_PADRAO, ...(JSON.parse(localStorage.getItem(A11Y_KEY) || '{}')) }; } catch (e) { /* sem armazenamento */ }

function aplicarA11y() {
  const h = document.documentElement;
  h.toggleAttribute('data-tema-escuro', !!A11Y.temaEscuro);
  h.toggleAttribute('data-contraste-alto', !!A11Y.contraste);
  h.toggleAttribute('data-movimento-reduzido', !!A11Y.movimento);
  h.style.setProperty('--escala', ([100, 115, 130, 150].includes(Number(A11Y.escala)) ? Number(A11Y.escala) : 100) / 100);
  try { localStorage.setItem(A11Y_KEY, JSON.stringify(A11Y)); } catch (e) { /* modo privado */ }
}

function montarA11y() {
  const raiz = $('#a11y-root');
  if (!raiz) return;
  raiz.innerHTML = `
    <button class="a11y-btn" id="a11y-btn" type="button" aria-expanded="false" aria-controls="a11y-painel" aria-label="Opções de acessibilidade">Aa</button>
    <div class="a11y-painel" id="a11y-painel" hidden>
      <p class="a11y-titulo">Acessibilidade</p>
      <label class="a11y-linha"><input type="checkbox" data-a11y="temaEscuro"> Fundo escuro</label>
      <label class="a11y-linha"><input type="checkbox" data-a11y="contraste"> Contraste alto</label>
      <label class="a11y-linha"><input type="checkbox" data-a11y="movimento"> Parar animações</label>
      <label class="a11y-linha a11y-escala">Texto
        <select data-a11y="escala">
          <option value="100">100%</option><option value="115">115%</option>
          <option value="130">130%</option><option value="150">150%</option>
        </select>
      </label>
    </div>`;
  const btn = $('#a11y-btn'), painel = $('#a11y-painel');
  const sync = () => {
    $$('[data-a11y]', painel).forEach(el => {
      const k = el.dataset.a11y;
      if (el.type === 'checkbox') el.checked = !!A11Y[k]; else el.value = String(A11Y[k]);
    });
  };
  btn.addEventListener('click', () => {
    const aberto = painel.hidden;
    painel.hidden = !aberto;
    btn.setAttribute('aria-expanded', String(aberto));
    if (aberto) sync();
  });
  painel.addEventListener('change', (e) => {
    const el = e.target.closest('[data-a11y]');
    if (!el) return;
    const k = el.dataset.a11y;
    A11Y[k] = el.type === 'checkbox' ? el.checked : Number(el.value);
    aplicarA11y();
    if (k === 'movimento' && A11Y.movimento && P.tocando) pausar();
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !painel.hidden) { painel.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  });
  sync();
}

/* ---------------- avatar / player ---------------- */
const P = {
  frases: [], beats: [], fita: [], i: 0, t: 0, tocando: false, raf: 0, last: 0,
  vel: 1, leg: [], cue: null, modo: 'texto', texto: '',
};
const EL = {};

/* mão em descanso: à frente da cintura, palma virada para o corpo, dedos soltos */
const REP = { forma: formaMisturar(FORMAS_MAO.curva, FORMAS_MAO.abre, 0.45), pos: [-1.04, 0.96, 0.30], rot: [6, 180, 186] };
const repouso = (lado) => lado === 'E'
  ? { forma: REP.forma, pos: [-REP.pos[0], REP.pos[1], REP.pos[2]], rot: [0, -REP.rot[1], -REP.rot[2]] }
  : { forma: REP.forma, pos: REP.pos, rot: REP.rot };
const suave = t => t * t * (3 - 2 * t);

function maoPose(forma, pos, rot) { return { forma, pos, rot }; }

function posesDe(b) {
  const a = maoPose(b.forma, b.pos0, b.rot0);
  const z = maoPose(b.forma, b.pos1, b.rot1);
  if (!b.duas) return { a: { dir: a, esq: repouso('E') }, b: { dir: z, esq: repouso('E') } };
  const espelhar = p => maoPose(p.forma, [-p.pos[0], p.pos[1], p.pos[2]], [p.rot[0], -p.rot[1], -p.rot[2]]);
  return { a: { dir: a, esq: espelhar(a) }, b: { dir: z, esq: espelhar(z) } };
}

function mistura(x, y, e) {
  return { dir: maoMisturar(x.dir, y.dir, e), esq: maoMisturar(x.esq, y.esq, e) };
}

function cenaEm(idx, t) {
  const b = P.beats[idx];
  if (!b) return { cena: { dir: repouso('D'), esq: repouso('E') }, rotulo: '' };
  const prev = idx > 0 ? posesDe(P.beats[idx - 1]).b : { dir: repouso('D'), esq: repouso('E') };
  const pr = posesDe(b);
  const u = lim(t / b.dur, 0, 1);
  const p = b.tipo === 'letra' ? 0.42 : 0.30;
  if (u < p) return { cena: mistura(prev, pr.a, suave(u / p)), rotulo: b.rotulo };
  const v = (u - p) / (1 - p);
  if (b.reps === 2) {
    const q = v * 3, seg = Math.min(2, Math.floor(q)), e = suave(q - seg);
    const cena = seg === 1 ? mistura(pr.b, pr.a, e) : mistura(pr.a, pr.b, e);
    return { cena, rotulo: b.rotulo };
  }
  return { cena: mistura(pr.a, pr.b, suave(v)), rotulo: b.rotulo };
}

function beatsDeItem(it) {
  if (it.marca === 'assinado') {
    const n = sinalNotacao(String(it.palavra).toLowerCase().trim());
    if (n) return [{
      tipo: 'sinal', rotulo: it.palavra, forma: n.forma, duas: n.duas, reps: n.reps,
      pos0: n.inicio.pos, rot0: n.inicio.rot, pos1: n.fim.pos, rot1: n.fim.rot, dur: 760,
    }];
  }
  const letras = it.marca === 'assinado'
    ? [...String(it.palavra).toUpperCase()].filter(l => /[A-Z]/.test(l))
    : (it.letras || []);
  return letras.filter(l => FORMAS_MAO[l]).map(l => ({
    tipo: 'letra', rotulo: l, forma: l, duas: false, reps: 1,
    pos0: LOCAIS.frente, rot0: [0, 0, 0], pos1: LOCAIS.frente, rot1: [0, 0, 0], dur: 340,
  }));
}

const pausa = () => ({
  tipo: 'pausa', rotulo: '', forma: REP.forma, duas: false, reps: 1,
  pos0: REP.pos, rot0: REP.rot, pos1: REP.pos, rot1: REP.rot, dur: 260,
});

function preparar(texto) {
  P.texto = String(texto || '');
  P.frases = analisarTexto(P.texto);
  const beats = [];
  P.frases.forEach(fr => {
    const bs = [];
    fr.itens.forEach(it => bs.push(...beatsDeItem(it)));
    if (!bs.length) return;
    beats.push(...bs, pausa());
  });
  P.beats = beats;
  P.fita = beats.map((b, i) => ({ i, rotulo: b.rotulo, tipo: b.tipo })).filter(b => b.rotulo);
  P.i = 0;
  P.t = 0;
  desenhar();
  pintarFita();
  pintarContas();
}

let ULTIMO_BEAT = -1;

function desenhar() {
  if (!EL.palco) return;
  const { cena, rotulo } = cenaEm(P.i, P.t);
  EL.palco.innerHTML = maoCena(cena, rotulo ? 'Sinal ' + rotulo : 'Sinalizador em repouso');
  if (EL.agora) EL.agora.textContent = rotulo || 'Em repouso';
  if (P.i !== ULTIMO_BEAT) { ULTIMO_BEAT = P.i; marcarFita(); }
}

function pintarFita() {
  if (!EL.fita) return;
  EL.fita.innerHTML = P.fita.map(b => `<button type="button" class="fita-item fita-${b.tipo}" data-beat="${b.i}">${esc(b.rotulo)}</button>`).join('');
  ULTIMO_BEAT = -1;
}

function marcarFita() {
  if (!EL.fita) return;
  const ativo = P.fita.find(b => b.i === P.i) || [...P.fita].reverse().find(b => b.i <= P.i);
  $$('.fita-item', EL.fita).forEach(el => {
    const on = ativo && Number(el.dataset.beat) === ativo.i;
    el.classList.toggle('on', !!on);
    if (on && P.tocando) {
      const r = el.getBoundingClientRect(), c = EL.fita.getBoundingClientRect();
      if (r.left < c.left || r.right > c.right) el.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  });
}

function pintarContas() {
  if (!EL.contas) return;
  if (!P.frases.length) { EL.contas.textContent = ''; EL.contas.hidden = true; return; }
  const t = P.frases.reduce((a, f) => ({
    p: a.p + f.contas.palavras, s: a.s + f.contas.assinados,
    l: a.l + f.contas.letras, o: a.o + f.contas.omitidos,
  }), { p: 0, s: 0, l: 0, o: 0 });
  EL.contas.hidden = false;
  let texto = `${t.p} palavras · ${t.s} com sinal`;
  if (t.l) texto += ` · ${t.l} soletradas`;
  if (t.o) texto += ` · ${t.o} omitidas`;
  EL.contas.textContent = texto;
}

function passo(ts) {
  if (!P.tocando) return;
  const dt = P.last ? Math.min(80, ts - P.last) : 16;
  P.last = ts;
  P.t += dt * P.vel;
  let b = P.beats[P.i];
  while (b && P.t >= b.dur) {
    P.t -= b.dur;
    P.i += 1;
    if (P.i >= P.beats.length) {
      P.i = P.beats.length - 1;
      P.t = P.beats[P.i] ? P.beats[P.i].dur : 0;
      pausar();
      desenhar();
      return;
    }
    b = P.beats[P.i];
  }
  desenhar();
  P.raf = requestAnimationFrame(passo);
}

function tocar() {
  if (!P.beats.length) return;
  if (P.i >= P.beats.length - 1 && P.t >= P.beats[P.i].dur - 1) { P.i = 0; P.t = 0; }
  P.tocando = true;
  P.last = 0;
  if (EL.play) { EL.play.textContent = '❚❚'; EL.play.setAttribute('aria-label', 'Pausa'); }
  cancelAnimationFrame(P.raf);
  P.raf = requestAnimationFrame(passo);
}

function pausar() {
  P.tocando = false;
  cancelAnimationFrame(P.raf);
  if (EL.play) { EL.play.textContent = '▶'; EL.play.setAttribute('aria-label', 'Reproduzir'); }
}

function irPara(i) {
  P.i = lim(i, 0, Math.max(0, P.beats.length - 1));
  P.t = 0;
  desenhar();
  if (P.tocando) { P.last = 0; cancelAnimationFrame(P.raf); P.raf = requestAnimationFrame(passo); }
}

/* ---------------- legendas e PDF ---------------- */
function lerLegendas(txt) {
  const out = [];
  const blocos = String(txt).replace(/\r/g, '').replace(/^WEBVTT.*$/m, '').split(/\n{2,}/);
  for (const bloco of blocos) {
    const linhas = bloco.split('\n').filter(l => l.trim());
    if (!linhas.length) continue;
    const i = /^\d+$/.test(linhas[0].trim()) ? 1 : 0;
    const m = (linhas[i] || '').match(/(\d+):(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(\d+):(\d{2}):(\d{2})[.,](\d{1,3})/);
    if (!m) continue;
    const s = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
    const e = (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]) + (+m[8].padEnd(3, '0')) / 1000;
    const texto = linhas.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
    if (texto) out.push({ s, e, texto });
  }
  return out;
}

async function inflar(u8) {
  if (!('DecompressionStream' in window)) return null;
  try {
    const fluxo = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Uint8Array(await new Response(fluxo).arrayBuffer());
  } catch (e) { return null; }
}

function textoDeConteudo(s) {
  let out = '', buf = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') {
      let j = i + 1, nivel = 1, txt = '';
      while (j < s.length && nivel) {
        const d = s[j];
        if (d === '\\') {
          const n = s[j + 1];
          if (/[0-7]/.test(n)) { txt += String.fromCharCode(parseInt(s.substr(j + 1, 3), 8)); j += 4; }
          else { txt += n === 'n' ? '\n' : n === 'r' ? '' : n; j += 2; }
          continue;
        }
        if (d === '(') nivel++;
        if (d === ')') { nivel--; if (!nivel) { j++; break; } }
        txt += d; j++;
      }
      buf += txt; i = j - 1;
    } else if (c === ']') { out += buf; buf = ''; }
    else if (s.startsWith('TJ', i) || s.startsWith('Tj', i) || s.startsWith('Td', i) || s.startsWith('TD', i) || s.startsWith('T*', i)) {
      out += buf + ' '; buf = ''; i += 1;
    }
  }
  return (out + buf).replace(/[ \t]+/g, ' ').trim();
}

/* Extracção de texto de PDF sem bibliotecas: descomprime os fluxos e lê os
   operadores de texto. Funciona em PDFs com texto; num PDF digitalizado (imagem)
   não há texto nenhum para ler — e a página diz isso em vez de inventar. */
async function textoDePDF(cache) {
  const bytes = new Uint8Array(cache);
  const cru = new TextDecoder('latin1').decode(bytes);
  const pedacos = [];
  let pos = 0;
  while (true) {
    const ini = cru.indexOf('stream', pos);
    if (ini < 0) break;
    const fim = cru.indexOf('endstream', ini);
    if (fim < 0) break;
    let a = ini + 6;
    if (cru[a] === '\r') a++;
    if (cru[a] === '\n') a++;
    const dados = bytes.subarray(a, fim);
    pos = fim + 9;
    const texto = textoDeConteudo(new TextDecoder('latin1').decode(dados));
    if (texto.length > 12) { pedacos.push(texto); continue; }
    const inf = await inflar(dados);
    if (inf) {
      const t2 = textoDeConteudo(new TextDecoder('latin1').decode(inf));
      if (t2.length > 12) pedacos.push(t2);
    }
  }
  return pedacos.join(' ').replace(/\s+/g, ' ').trim();
}

/* ---------------- rotas ---------------- */
const routes = [];
const on = (path, view) => routes.push({ path, view });
const matchRoute = (hash) => {
  const limpo = (hash || '').replace(/^#/, '').split('?')[0] || '/';
  for (const r of routes) {
    const pr = r.path.split('/').filter(Boolean), pa = limpo.split('/').filter(Boolean);
    if (pr.length !== pa.length) continue;
    const params = {};
    const ok = pr.every((seg, i) => seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(pa[i])), true) : seg === pa[i]);
    if (ok) return { view: r.view, params };
  }
  return null;
};

const NAV = [['/', 'Sinalizar'], ['/dicionario', 'Dicionário']];

function shell(conteudo, ativo) {
  const itens = NAV.map(([href, rotulo]) => `<a href="#${href}" class="nav-a${ativo === href ? ' on' : ''}"${ativo === href ? ' aria-current="page"' : ''}>${rotulo}</a>`).join('');
  return `
    <header class="topo">
      <a class="marca" href="#/" aria-label="Agatha, início">
        <img src="assets/logo-mark.svg" alt="" width="26" height="26">
        <span>Agatha</span>
      </a>
      <nav class="nav" aria-label="Principal">${itens}</nav>
      <div id="a11y-root"></div>
    </header>
    <main id="conteudo" tabindex="-1">${conteudo}</main>
    <footer class="rodape">
      <p>Protótipo da Viva Surdo. As associações palavra-sinal estão <b>por validar</b> por sinalizadores surdos.</p>
    </footer>`;
}

/* ---------------- vista: sinalizar ---------------- */
function vistaSinalizar() {
  return `
  <section class="entrada">
    <h1>Texto em, sinais out.</h1>
    <p class="sub">Cola uma frase, um texto ou as legendas de um filme. Vê a glosa em sinais.</p>
    <label class="campo">
      <span class="sr-only">Texto para sinalizar</span>
      <textarea id="txt" rows="3" placeholder="Escreve aqui…" spellcheck="false"></textarea>
    </label>
    <div class="acoes">
      <button class="bt primario" id="bt-ver" type="button">Ver sinais</button>
      <label class="bt" for="fich">Ficheiro</label>
      <input id="fich" type="file" accept=".txt,.srt,.vtt,.pdf,text/plain,application/pdf" hidden>
      <button class="bt" id="bt-exemplo" type="button">Exemplo</button>
    </div>
    <p class="recado" id="recado" role="status" hidden></p>
  </section>

  <section class="palco-sec" aria-label="Sinalizador">
    <div class="palco" id="palco"></div>
    <div class="controles">
      <p class="agora" id="agora" aria-live="polite">Em repouso</p>
      <div class="transporte">
        <button class="bt icone" id="bt-play" type="button" aria-label="Reproduzir">▶</button>
        <button class="bt icone" id="bt-prev" type="button" aria-label="Sinal anterior">‹</button>
        <button class="bt icone" id="bt-next" type="button" aria-label="Sinal seguinte">›</button>
        <div class="vel" role="group" aria-label="Velocidade">
          <button type="button" class="vel-b" data-vel="0.5">0,5×</button>
          <button type="button" class="vel-b on" data-vel="1">1×</button>
          <button type="button" class="vel-b" data-vel="1.5">1,5×</button>
        </div>
      </div>
      <div class="fita" id="fita" aria-label="Glosa"></div>
      <p class="contas" id="contas" hidden></p>
    </div>
  </section>

  <section class="vcx" id="vcx" hidden>
    <div class="vcx-topo">
      <label class="bt" for="vid">Abrir vídeo</label>
      <input id="vid" type="file" accept="video/*" hidden>
      <span class="mini">Os sinais seguem o tempo das legendas.</span>
    </div>
    <video id="vid-el" playsinline controls></video>
  </section>

  <details class="nota">
    <summary>O que esta glosa não é</summary>
    <p>Não é tradução para LGA. Uma glosa é uma sequência de sinais: artigos e preposições caem, o tempo vai à frente e o «não» vai ao fim — mas a ordem, o espaço e a expressão facial de um sinalizador surdo não cabem numa lista de palavras.</p>
  </details>`;
}

function ligarSinalizar(params) {
  EL.palco = $('#palco');
  EL.agora = $('#agora');
  EL.play = $('#bt-play');
  EL.fita = $('#fita');
  EL.contas = $('#contas');
  const txt = $('#txt'), recado = $('#recado');
  const aviso = (m) => { recado.hidden = !m; recado.textContent = m || ''; };
  const reduzido = () => A11Y.movimento || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const aplicar = (texto) => {
    txt.value = texto;
    preparar(texto);
    if (!P.beats.length) { aviso('Escreve alguma coisa para ver sinais.'); return; }
    aviso('');
    if (reduzido()) pausar(); else tocar();
  };

  const ver = () => aplicar(txt.value);
  $('#bt-ver').addEventListener('click', ver);
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ver(); } });
  $('#bt-exemplo').addEventListener('click', () => { txt.value = PM_EXEMPLOS[Math.floor(Math.random() * PM_EXEMPLOS.length)]; aplicar(txt.value); });

  EL.play.addEventListener('click', () => { if (P.tocando) pausar(); else tocar(); });
  $('#bt-prev').addEventListener('click', () => { pausar(); irPara(P.i - 1); });
  $('#bt-next').addEventListener('click', () => { pausar(); irPara(P.i + 1); });
  $$('.vel-b').forEach(b => b.addEventListener('click', () => {
    P.vel = Number(b.dataset.vel);
    $$('.vel-b').forEach(x => x.classList.toggle('on', x === b));
  }));
  EL.fita.addEventListener('click', (e) => {
    const b = e.target.closest('[data-beat]');
    if (!b) return;
    pausar(); irPara(Number(b.dataset.beat)); tocar();
  });

  const fich = $('#fich');
  fich.addEventListener('change', async () => {
    const f = fich.files && fich.files[0];
    fich.value = '';
    if (!f) return;
    const nome = f.name.toLowerCase();
    try {
      if (nome.endsWith('.pdf')) {
        aviso('A ler o PDF…');
        const t = await textoDePDF(await f.arrayBuffer());
        if (!t) { aviso('Este PDF não tem texto legível — pode ser uma digitalização. Copia o texto e cola aqui.'); return; }
        aplicar(t);
        return;
      }
      if (nome.endsWith('.srt') || nome.endsWith('.vtt')) {
        P.leg = lerLegendas(await f.text());
        if (!P.leg.length) { aviso('Não encontrei legendas com tempo neste ficheiro.'); return; }
        P.modo = 'legendas';
        $('#vcx').hidden = false;
        aplicar(P.leg.map(c => c.texto).join(' '));
        aviso(`Legendas carregadas: ${P.leg.length} blocos. Abre um vídeo para sincronizar.`);
        return;
      }
      aplicar(await f.text());
    } catch (err) {
      aviso('Não consegui ler este ficheiro. Tenta copiar o texto e colar aqui.');
    }
  });

  const vid = $('#vid-el');
  $('#vid').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    vid.src = URL.createObjectURL(f);
    vid.load();
  });
  const cueDe = (t) => P.leg.find(c => t >= c.s - 0.08 && t <= c.e + 0.08) || null;
  const cuePlay = (cue) => {
    const dur = Math.max(400, (cue.e - cue.s) * 1000);
    preparar(cue.texto);
    const base = P.beats.reduce((n, b) => n + b.dur, 0) || 1;
    const f = dur / base;
    P.beats.forEach(b => { b.dur = Math.max(120, b.dur * f); });
    P.i = 0; P.t = 0;
    desenhar();
    if (!vid.paused) tocar();
  };
  vid.addEventListener('timeupdate', () => {
    if (P.modo !== 'legendas' || !P.leg.length) return;
    const cue = cueDe(vid.currentTime);
    if (!cue) return;
    if (cue !== P.cue) { P.cue = cue; cuePlay(cue); }
    else if (!vid.paused && !P.tocando) tocar();
    else if (vid.paused && P.tocando) pausar();
  });
  vid.addEventListener('play', () => { if (P.modo === 'legendas' && P.cue) tocar(); });
  vid.addEventListener('pause', () => pausar());

  preparar('');
  if (params && params.s) { txt.value = params.s; aplicar(params.s); }
  else desenhar();
}

/* ---------------- vista: dicionário ---------------- */
let PESQUISA = '', TEMA = '';

function entradasDicionario() {
  const out = [];
  GLOSSARIO.forEach(g => g.termos.forEach(t => {
    const n = sinalNotacao(String(t.palavra).toLowerCase().trim());
    if (n) out.push({ palavra: t.palavra, tema: g.tema, notacao: n });
  }));
  return out;
}

const ENTRADAS = entradasDicionario();
const TEMAS = [...new Set(ENTRADAS.map(e => e.tema))];

function cartoes() {
  const q = norm(PESQUISA);
  const lista = ENTRADAS.filter(e => (!TEMA || e.tema === TEMA) && (!q || norm(e.palavra).includes(q)));
  if (!lista.length) return '<p class="vazio">Nada encontrado.</p>';
  return lista.map(e => `
    <a class="cartao" href="#/?s=${encodeURIComponent(e.palavra)}">
      <span class="fig">${maoFigura(e.notacao.forma)}</span>
      <b>${esc(e.palavra)}</b>
      <small>${esc(e.notacao.forma)} · ${esc(e.notacao.movimento)}${e.notacao.duas ? ' · 2 mãos' : ''}</small>
    </a>`).join('');
}

function vistaDicionario() {
  const chips = ['', ...TEMAS].map(t => `<button type="button" class="chip${t === TEMA ? ' on' : ''}" data-tema="${esc(t)}">${t || 'Tudo'}</button>`).join('');
  const faltam = GLOSSARIO_QTD - ENTRADAS.length;
  return `
  <section class="entrada">
    <h1>Dicionário</h1>
    <p class="sub">${ENTRADAS.length} sinais de estudo.${faltam > 0 ? ` ${faltam} palavras do glossário ainda não têm descrição de sinal e são soletradas.` : ''}</p>
    <label class="campo">
      <span class="sr-only">Procurar palavra</span>
      <input id="busca" type="search" value="${esc(PESQUISA)}" placeholder="Procurar palavra…" autocomplete="off">
    </label>
    <div class="chips" id="temas">${chips}</div>
  </section>
  <section class="grade" id="grade" aria-live="polite">${cartoes()}</section>
  <p class="rodape-nota">As descrições (forma · movimento) são uma notação nossa para treinar a mão — não substituem o vídeo de um sinalizador surdo.</p>`;
}

function ligarDicionario() {
  const grade = $('#grade'), busca = $('#busca');
  busca.addEventListener('input', () => { PESQUISA = busca.value; grade.innerHTML = cartoes(); });
  $('#temas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tema]');
    if (!b) return;
    TEMA = b.dataset.tema;
    $$('.chip', $('#temas')).forEach(c => c.classList.toggle('on', c === b));
    grade.innerHTML = cartoes();
  });
}

on('/', vistaSinalizar);
on('/dicionario', vistaDicionario);

/* ---------------- arranque ---------------- */
function render() {
  const m = matchRoute(location.hash || '#/');
  const view = m ? m.view : vistaSinalizar;
  const ativo = (location.hash || '').replace(/^#/, '').split('?')[0] === '/dicionario' ? '/dicionario' : '/';
  const app = document.getElementById('app');
  pausar();
  app.innerHTML = shell(view(), ativo);
  const live = document.getElementById('route-live');
  if (live) live.textContent = ativo === '/dicionario' ? 'Dicionário' : 'Sinalizar';
  if (ativo === '/dicionario') ligarDicionario();
  else ligarSinalizar(m ? m.params : {});
  montarA11y();
}

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  aplicarA11y();
  render();
});

/* Em localhost o service worker esconde ficheiros acabados de editar; só é usado
   com ?sw=1 (para o testar) ou num servidor a sério. */
const semSW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1\b/.test(location.search);
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !semSW) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem offline neste browser */ });
  });
}
