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
  passos: [], poses: null, inicioBeat: [], avatarOn: false, carregando3d: false, salto: false,
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
      tipo: 'sinal', rotulo: it.palavra, forma: n.forma, duas: n.duas, reps: n.reps, local: n.local,
      pos0: n.inicio.pos, rot0: n.inicio.rot, pos1: n.fim.pos, rot1: n.fim.rot, dur: 760,
      palma: n.palma, esq: n.esq, amp: n.amp, movimento: n.movimento,
    }];
  }
  const letras = it.marca === 'assinado'
    ? [...String(it.palavra).toUpperCase()].filter(l => /[A-Z]/.test(l))
    : (it.letras || []);
  return letras.filter(l => FORMAS_MAO[l]).map(l => ({
    tipo: 'letra', rotulo: l, forma: l, duas: false, reps: 1, movimento: 'parado',
    pos0: LOCAIS.frente, rot0: [0, 0, 0], pos1: LOCAIS.frente, rot1: [0, 0, 0], dur: 340,
  }));
}

const pausa = () => ({
  tipo: 'pausa', rotulo: '', forma: REP.forma, duas: false, reps: 1, movimento: 'parado',
  pos0: REP.pos, rot0: REP.rot, pos1: REP.pos, rot1: REP.rot, dur: 260,
});

function analisarEmBeats(texto) {
  const frases = analisarTexto(String(texto || ''));
  const beats = [];
  frases.forEach(fr => {
    const bs = [];
    fr.itens.forEach(it => bs.push(...beatsDeItem(it)));
    if (!bs.length) return;
    beats.push(...bs, pausa());
  });
  return { frases, beats };
}

function preparar(texto) {
  P.texto = String(texto || '');
  const { frases, beats } = analisarEmBeats(texto);
  P.frases = frases;
  P.beats = beats;
  P.fita = beats.map((b, i) => ({ i, rotulo: b.rotulo, tipo: b.tipo })).filter(b => b.rotulo);
  P.i = 0;
  P.t = 0;
  recalcularPoses();
  desenhar();
  pintarFita();
  pintarContas();
}

/* passos de osso e poses pré-calculadas a partir dos beats (o relógio manda) */
function recalcularPoses() {
  P.passos = (window.SINAL3D && P.beats.length) ? SINAL3D.sequencia(P.beats) : [];
  P.inicioBeat = [];
  let acc = 0;
  P.passos.forEach(s => {
    if (P.inicioBeat[s.beat] === undefined) P.inicioBeat[s.beat] = acc;
    acc += s.dur;
  });
  P.poses = (P.avatarOn && window.AVATAR && AVATAR.pronto) ? AVATAR.prepararPoses(P.passos) : null;
}

let ULTIMO_BEAT = -1;

function desenhar() {
  if (!EL.palco || SG.aberto) return;
  const b = P.beats[P.i];
  const rotulo = b && b.tipo !== 'pausa' ? b.rotulo : '';
  if (P.avatarOn && window.AVATAR && AVATAR.pronto) {
    if (P.poses && P.poses.length) {
      const t0 = P.inicioBeat[P.i] || 0;
      /* parado no início de um salto: a mistura k=0 mostraria a pose anterior */
      const saltar = P.salto ? 0.2 : 0;
      P.salto = false;
      AVATAR.mostrar(P.poses, t0 + P.t / 1000 + saltar);
    } else {
      AVATAR.pousar();
    }
  } else if (!P.carregando3d) {
    const { cena, rotulo: r } = cenaEm(P.i, P.t);
    EL.palco.innerHTML = maoCena(cena, r ? 'Sinal ' + r : 'Sinalizador em repouso');
  }
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
  P.salto = true;
  desenhar();
  if (P.tocando) { P.last = 0; cancelAnimationFrame(P.raf); P.raf = requestAnimationFrame(passo); }
}

/* ---------------- seleção de texto ---------------- */
let SEL_TEXTO = '';

function selecaoNaPagina() {
  const ativo = document.activeElement;
  if (ativo && ativo.id === 'txt' && typeof ativo.selectionStart === 'number'
    && ativo.selectionEnd > ativo.selectionStart) {
    return ativo.value.slice(ativo.selectionStart, ativo.selectionEnd);
  }
  const s = window.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return '';
  const no = s.anchorNode;
  const el = no && (no.nodeType === 1 ? no : no.parentElement);
  if (el && el.closest('input, select, textarea, #sel-pill, #sg-painel, .topo, .rodape, [contenteditable="true"]')) return '';
  return String(s);
}

function atualizarSelecao() {
  const pill = document.getElementById('sel-pill');
  if (!pill) return;
  const texto = selecaoNaPagina().replace(/\s+/g, ' ').trim();
  if (texto.length < 3 || !/[A-Za-zÀ-ÿ]/.test(texto)) {
    pill.hidden = true; SEL_TEXTO = ''; SG.pillVisivel = false; atualizarFab();
    return;
  }
  SEL_TEXTO = texto;
  const n = texto.split(' ').filter(Boolean).length;
  pill.querySelector('.sel-txt').textContent = 'Sinalizar «' + (texto.length > 46 ? texto.slice(0, 46).trimEnd() + '…' : texto) + '»';
  pill.querySelector('.sel-conta').textContent = n === 1 ? '1 palavra' : n + ' palavras';
  pill.hidden = false;
  SG.pillVisivel = true;
  atualizarFab();
}

function esconderSelecao() {
  const pill = document.getElementById('sel-pill');
  if (pill) pill.hidden = true;
  SG.pillVisivel = false;
  atualizarFab();
  SEL_TEXTO = '';
}

function montarSelecao() {
  if (document.getElementById('sel-pill')) return;
  const pill = document.createElement('button');
  pill.id = 'sel-pill';
  pill.type = 'button';
  pill.className = 'selecao-pill';
  pill.hidden = true;
  pill.setAttribute('aria-label', 'Abrir a sinalizadora com o texto selecionado');
  pill.innerHTML = '<span class="sel-txt"></span><span class="sel-conta"></span><span class="sel-seta" aria-hidden="true">→</span>';
  /* o mousedown não pode roubar a seleção ao botão */
  pill.addEventListener('mousedown', (e) => e.preventDefault());
  pill.addEventListener('click', () => {
    const t = SEL_TEXTO;
    esconderSelecao();
    const s = window.getSelection();
    if (s && !s.isCollapsed) s.removeAllRanges();
    abrirSigner(t);
  });
  document.body.appendChild(pill);
  document.addEventListener('selectionchange', atualizarSelecao);
  document.addEventListener('mouseup', () => setTimeout(atualizarSelecao, 0));
  document.addEventListener('keyup', () => setTimeout(atualizarSelecao, 0));
}

/* ---------------- painel da sinalizadora (Agatha signer) ---------------- */
const SG_FRASE = 'Bom dia! Onde fica a escola? Amanhã eu vou com a minha família.';
const SG = {
  aberto: false, texto: '', beats: [], passos: [], poses: null, inicio: [], total: 0,
  t: 0, beat: -1, tocando: false, raf: 0, last: 0, vel: 1, repetir: true,
  pillVisivel: false, palcoAVista: false, editorAVista: false,
};

/* o botão flutuante sai da frente da bolha de seleção, do transporte do palco
   e dos botões do editor (no telemóvel tapava o «Ficheiro») */
function atualizarFab() {
  const fab = document.getElementById('sg-fab');
  if (!fab) return;
  fab.hidden = !!(SG.aberto || SG.pillVisivel || SG.palcoAVista || SG.editorAVista);
}

let OBS_PALCO = null;
function vigiarPalco() {
  if (OBS_PALCO) { OBS_PALCO.disconnect(); OBS_PALCO = null; }
  SG.palcoAVista = false;
  SG.editorAVista = false;
  const alvos = [['palcoAVista', $('#palco-sec')], ['editorAVista', $('.painel.editor')]]
    .filter(([, el]) => el);
  if (!alvos.length || !('IntersectionObserver' in window)) return;
  const chave = new WeakMap(alvos.map(([k, el]) => [el, k]));
  OBS_PALCO = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { SG[chave.get(e.target)] = e.isIntersecting; });
    atualizarFab();
  }, { threshold: 0.06 });
  alvos.forEach(([, el]) => OBS_PALCO.observe(el));
}

/* o modelo só existe uma vez: o painel leva o mesmo canvas, e o palco da
   página recebe-o de volta quando o painel fecha */
function casaSigner() {
  let casa = document.getElementById('sg-casa');
  if (!casa) {
    casa = document.createElement('div');
    casa.id = 'sg-casa';
    casa.className = 'sg-casa';
    casa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(casa);
  }
  return casa;
}

function montarSigner() {
  if (document.getElementById('sg-painel')) return;

  const fab = document.createElement('button');
  fab.id = 'sg-fab';
  fab.type = 'button';
  fab.className = 'sg-fab';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'sg-painel');
  fab.innerHTML = '<img src="assets/logo-mark.svg" alt="" width="18" height="18"><span>Agatha signer</span>';

  const painel = document.createElement('div');
  painel.id = 'sg-painel';
  painel.className = 'sg-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-labelledby', 'sg-titulo');
  painel.hidden = true;
  painel.innerHTML = `
    <div class="sg-topo">
      <p class="sg-titulo" id="sg-titulo">Agatha · sinalizador</p>
      <button class="sg-fechar" id="sg-fechar" type="button" aria-label="Fechar a sinalizadora">×</button>
    </div>
    <p class="sg-frase" id="sg-frase"></p>
    <div class="sg-palco" id="sg-palco"><p class="sg-espera">A preparar a sinalizadora…</p></div>
    <div class="sg-acoes">
      <button class="bt icone" id="sg-play" type="button" aria-label="Reproduzir">▶</button>
      <button class="sg-rep on" id="sg-rep" type="button" aria-pressed="true">Repetir</button>
      <div class="vel" role="group" aria-label="Velocidade">
        <button type="button" class="vel-b" data-sgvel="0.5">0,5×</button>
        <button type="button" class="vel-b on" data-sgvel="1">1×</button>
        <button type="button" class="vel-b" data-sgvel="1.5">1,5×</button>
      </div>
    </div>
    <div class="sg-chips" id="sg-chips" aria-label="Glosa"></div>
    <a class="sg-abrir" id="sg-abrir" href="#/" hidden>Abrir em Sinalizar →</a>
    <p class="sg-nota">Gestos de estudo inspirados na língua gestual internacional. <b>Não</b> são sinais de LGA validados por sinalizadores surdos.</p>`;
  document.body.append(painel, fab);

  fab.addEventListener('click', () => {
    if (SG.aberto) fecharSigner(); else abrirSigner(SG.texto || SG_FRASE);
  });
  $('#sg-fechar').addEventListener('click', () => fecharSigner());
  $('#sg-play').addEventListener('click', () => { if (SG.tocando) pausarSigner(); else tocarSigner(); });
  $('#sg-rep').addEventListener('click', (e) => {
    SG.repetir = !SG.repetir;
    e.currentTarget.classList.toggle('on', SG.repetir);
    e.currentTarget.setAttribute('aria-pressed', String(SG.repetir));
  });
  $$('[data-sgvel]').forEach(b => b.addEventListener('click', () => {
    SG.vel = Number(b.dataset.sgvel);
    $$('[data-sgvel]').forEach(x => x.classList.toggle('on', x === b));
  }));
  $('#sg-chips').addEventListener('click', (e) => {
    const c = e.target.closest('[data-beat]');
    if (!c) return;
    SG.t = SG.inicio[Number(c.dataset.beat)] || 0;
    SG.beat = -1;
    desenharSigner(SG.t);
    if (!SG.tocando) tocarSigner();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && SG.aberto) fecharSigner();
  });
}

async function abrirSigner(texto) {
  if (!document.getElementById('sg-painel')) montarSigner();
  const t = String(texto || '').replace(/\s+/g, ' ').trim() || SG.texto || SG_FRASE;
  SG.texto = t;
  SG.aberto = true;
  SG.beats = analisarEmBeats(t).beats;
  SG.passos = [];
  SG.poses = null;
  SG.inicio = [];
  SG.total = 0;
  SG.t = 0;
  SG.beat = -1;
  pausar(); /* o leitor da página não pode conduzir o avatar com o painel aberto */
  $('#sg-painel').hidden = false;
  $('#sg-fab').setAttribute('aria-expanded', 'true');
  atualizarFab();
  $('#sg-frase').textContent = '«' + t + '»';
  pintarChipsSigner();
  const abrir = $('#sg-abrir');
  if (abrir) {
    const rota = (location.hash || '').replace(/^#/, '').split('?')[0] || '/';
    abrir.hidden = rota !== '/dicionario';
    abrir.href = '#/?s=' + encodeURIComponent(t);
  }
  $('#sg-fechar').focus({ preventScroll: true });

  const palco = $('#sg-palco');
  if (!(window.AVATAR && window.SINAL3D)) {
    palco.innerHTML = '<p class="sg-espera">O modelo 3D não carregou.</p>';
    return;
  }
  if (!SG.beats.length) {
    palco.innerHTML = '<p class="sg-espera">Sem sinais para esta frase. Escreve outra.</p>';
    return;
  }
  try {
    await AVATAR.init(palco);
    /* fechado enquanto o modelo carregava: o canvas volta para o palco da página */
    if (!SG.aberto) { devolverAvatar(); return; }
    const espera = palco.querySelector('.sg-espera');
    if (espera) espera.remove();
    AVATAR.enquadrar('busto', 1.16);
    SG.passos = SINAL3D.sequencia(SG.beats);
    let acc = 0;
    SG.passos.forEach((p) => {
      if (SG.inicio[p.beat] === undefined) SG.inicio[p.beat] = acc;
      acc += p.dur;
    });
    SG.total = acc;
    SG.poses = AVATAR.prepararPoses(SG.passos);
    if (!SG.poses.length) throw new Error('sem passos');
    if (A11Y.movimento || matchMedia('(prefers-reduced-motion: reduce)').matches) desenharSigner(0);
    else tocarSigner();
  } catch (err) {
    palco.innerHTML = '<p class="sg-espera">O modelo 3D não carregou.</p>';
  }
}

function notacaoParaBeat(notacao, rotulo) {
  let texto = String(notacao || '').trim(), duas = false;
  if (texto.startsWith('2:')) { duas = true; texto = texto.slice(2).trim(); }
  const [forma, local, mov] = texto.split(/\s+/);
  if (!window.FORMAS_MAO || !window.FORMAS_MAO[forma] || !window.LOCAIS || !window.LOCAIS[local]) return null;
  const [delta, giro] = (window.MOVIMENTOS && window.MOVIMENTOS[mov]) || [[0, 0, 0], [0, 0, 0]];
  const L = window.LOCAIS[local];
  const p = Array.isArray(L) ? L : L.p;
  const base = Array.isArray(L) ? [0, 0, 0] : L.rot;
  return {
    tipo: 'sinal', rotulo: rotulo || '', forma, duas, reps: mov === 'repete' ? 2 : 1, local,
    pos0: p.slice(), rot0: base.slice(),
    pos1: [p[0] + delta[0], p[1] + delta[1], p[2] + delta[2]],
    rot1: [base[0] + giro[0], base[1] + giro[1], base[2] + giro[2]],
    dur: 760, palma: null, esq: null, amp: null, movimento: mov,
  };
}

async function abrirSignerNotacao(notacao, rotulo) {
  if (!document.getElementById('sg-painel')) montarSigner();
  const b = notacaoParaBeat(notacao, rotulo);
  if (!b) return;
  const r = String(rotulo || '').trim();
  SG.texto = r;
  SG.aberto = true;
  SG.beats = [b, pausa()];
  SG.passos = [];
  SG.poses = null;
  SG.inicio = [];
  SG.total = 0;
  SG.t = 0;
  SG.beat = -1;
  pausar();
  $('#sg-painel').hidden = false;
  $('#sg-fab').setAttribute('aria-expanded', 'true');
  atualizarFab();
  $('#sg-frase').textContent = '«' + r + '»';
  pintarChipsSigner();
  const abrir = $('#sg-abrir');
  if (abrir) abrir.hidden = true;
  $('#sg-fechar').focus({ preventScroll: true });

  const palco = $('#sg-palco');
  if (!(window.AVATAR && window.SINAL3D)) {
    palco.innerHTML = '<p class="sg-espera">O modelo 3D não carregou.</p>';
    return;
  }
  try {
    await AVATAR.init(palco);
    if (!SG.aberto) { devolverAvatar(); return; }
    const espera = palco.querySelector('.sg-espera');
    if (espera) espera.remove();
    AVATAR.enquadrar('busto', 1.16);
    SG.passos = SINAL3D.sequencia(SG.beats);
    let acc = 0;
    SG.passos.forEach((p) => {
      if (SG.inicio[p.beat] === undefined) SG.inicio[p.beat] = acc;
      acc += p.dur;
    });
    SG.total = acc;
    SG.poses = AVATAR.prepararPoses(SG.passos);
    if (!SG.poses.length) throw new Error('sem passos');
    if (A11Y.movimento || matchMedia('(prefers-reduced-motion: reduce)').matches) desenharSigner(0);
    else tocarSigner();
  } catch (err) {
    palco.innerHTML = '<p class="sg-espera">O modelo 3D não carregou.</p>';
  }
}
window.abrirSignerNotacao = abrirSignerNotacao;

function devolverAvatar() {
  if (!(window.AVATAR && AVATAR.pronto)) return;
  AVATAR.pousar();
  const casa = (EL.palco && EL.palco.isConnected) ? EL.palco : casaSigner();
  AVATAR.init(casa);
  if (casa === EL.palco) { AVATAR.enquadrar('busto', 1.18); desenhar(); }
}

function fecharSigner(silencioso) {
  const painel = document.getElementById('sg-painel');
  if (!painel || painel.hidden) return;
  painel.hidden = true;
  SG.aberto = false;
  SG.tocando = false;
  cancelAnimationFrame(SG.raf);
  SG.t = 0;
  SG.beat = -1;
  const fab = document.getElementById('sg-fab');
  if (fab) {
    fab.setAttribute('aria-expanded', 'false');
    atualizarFab();
    if (!fab.hidden && !silencioso) fab.focus();
  }
  const play = $('#sg-play');
  if (play) { play.textContent = '▶'; play.setAttribute('aria-label', 'Reproduzir'); }
  devolverAvatar();
}

function pintarChipsSigner() {
  const caixa = $('#sg-chips');
  if (!caixa) return;
  caixa.innerHTML = SG.beats.map((b, i) => (!b.rotulo || b.tipo === 'pausa') ? ''
    : `<button type="button" class="sg-chip${b.tipo === 'letra' ? ' sg-letra' : ''}" data-beat="${i}">${esc(b.rotulo)}</button>`).join('');
  SG.beat = -1;
}

function marcarChipsSigner() {
  const caixa = $('#sg-chips');
  if (!caixa) return;
  $$('[data-beat]', caixa).forEach(el => el.classList.toggle('on', Number(el.dataset.beat) === SG.beat));
}

function beatEm(t) {
  let acc = 0, i = 0;
  while (i < SG.passos.length - 1 && t >= acc + SG.passos[i].dur) { acc += SG.passos[i].dur; i++; }
  for (let j = i; j >= 0; j--) {
    const b = SG.beats[SG.passos[j].beat];
    if (b && b.tipo !== 'pausa') return SG.passos[j].beat;
  }
  return 0;
}

function desenharSigner(t) {
  if (!SG.poses || !SG.poses.length || !(window.AVATAR && AVATAR.pronto)) return;
  AVATAR.mostrar(SG.poses, t);
  const beat = beatEm(t);
  if (beat !== SG.beat) { SG.beat = beat; marcarChipsSigner(); }
}

function tocarSigner() {
  if (!SG.poses || !SG.poses.length) return;
  if (SG.total && SG.t >= SG.total - 0.01) SG.t = 0;
  SG.tocando = true;
  SG.last = 0;
  const play = $('#sg-play');
  if (play) { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pausa'); }
  cancelAnimationFrame(SG.raf);
  SG.raf = requestAnimationFrame(passoSigner);
}

function pausarSigner() {
  SG.tocando = false;
  cancelAnimationFrame(SG.raf);
  const play = $('#sg-play');
  if (play) { play.textContent = '▶'; play.setAttribute('aria-label', 'Reproduzir'); }
}

function passoSigner(ts) {
  if (!SG.tocando) return;
  const dt = SG.last ? Math.min(80, ts - SG.last) : 16;
  SG.last = ts;
  SG.t += (dt / 1000) * SG.vel;
  if (SG.total && SG.t >= SG.total) {
    if (SG.repetir) {
      SG.t %= SG.total;
    } else {
      SG.t = SG.total - 0.001;
      desenharSigner(SG.t);
      pausarSigner();
      return;
    }
  }
  desenharSigner(SG.t);
  SG.raf = requestAnimationFrame(passoSigner);
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
  const [caminho, consulta] = (hash || '').replace(/^#/, '').split('?');
  const limpo = caminho || '/';
  const busca = {};
  new URLSearchParams(consulta || '').forEach((v, k) => { busca[k] = v; });
  for (const r of routes) {
    const pr = r.path.split('/').filter(Boolean), pa = limpo.split('/').filter(Boolean);
    if (pr.length !== pa.length) continue;
    const params = { ...busca };
    const ok = pr.every((seg, i) => seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(pa[i])), true) : seg === pa[i]);
    if (ok) return { view: r.view, params };
  }
  return null;
};

const NAV = [['/', 'Sinalizar'], ['/dicionario', 'Dicionário']];

/* Ilustrações dos cartões da entrada: traço, não fotografia. */
const ARTE = {
  texto: `<svg viewBox="0 0 320 150" fill="none" aria-hidden="true">
      <rect x="24" y="22" width="164" height="106" rx="15" fill="var(--surface)" stroke="currentColor" stroke-opacity=".4" stroke-width="3"/>
      <rect x="38" y="42" width="86" height="9" rx="4.5" fill="currentColor" fill-opacity=".38"/>
      <rect x="36" y="60" width="140" height="22" rx="8" fill="var(--green)" fill-opacity=".22"/>
      <rect x="38" y="66" width="124" height="9" rx="4.5" fill="currentColor" fill-opacity=".85"/>
      <rect x="38" y="92" width="70" height="9" rx="4.5" fill="currentColor" fill-opacity=".38"/>
      <g stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(212 30)">
        <rect x="16" y="50" width="52" height="42" rx="16"/>
        <path d="M25 50V32a6.5 6.5 0 0 1 13 0v18"/>
        <path d="M38 50V25a6.5 6.5 0 0 1 13 0v25"/>
        <path d="M51 50V31a6.5 6.5 0 0 1 13 0v19"/>
        <path d="M64 54V45a6.5 6.5 0 0 1 13 0v9"/>
        <path d="M16 64c-7 0-11 5-11 10s4 9 11 9"/>
      </g>
    </svg>`,
  legendas: `<svg viewBox="0 0 320 150" fill="none" aria-hidden="true">
      <rect x="22" y="30" width="276" height="92" rx="16" fill="var(--surface)" stroke="currentColor" stroke-opacity=".4" stroke-width="3"/>
      <g fill="currentColor" fill-opacity=".24">
        <rect x="38" y="40" width="12" height="8" rx="2"/><rect x="60" y="40" width="12" height="8" rx="2"/><rect x="82" y="40" width="12" height="8" rx="2"/>
        <rect x="38" y="102" width="12" height="8" rx="2"/><rect x="60" y="102" width="12" height="8" rx="2"/><rect x="82" y="102" width="12" height="8" rx="2"/>
        <rect x="226" y="40" width="12" height="8" rx="2"/><rect x="248" y="40" width="12" height="8" rx="2"/><rect x="270" y="40" width="12" height="8" rx="2"/>
        <rect x="226" y="102" width="12" height="8" rx="2"/><rect x="248" y="102" width="12" height="8" rx="2"/><rect x="270" y="102" width="12" height="8" rx="2"/>
      </g>
      <rect x="104" y="58" width="112" height="36" rx="10" fill="currentColor" fill-opacity=".1"/>
      <rect x="116" y="66" width="88" height="8" rx="4" fill="currentColor" fill-opacity=".7"/>
      <rect x="128" y="80" width="64" height="8" rx="4" fill="currentColor" fill-opacity=".4"/>
    </svg>`,
  dicionario: `<svg viewBox="0 0 320 150" fill="none" aria-hidden="true">
      <rect x="34" y="20" width="150" height="110" rx="16" fill="var(--surface)" stroke="currentColor" stroke-opacity=".4" stroke-width="3"/>
      <g stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" transform="translate(56 36)">
        <rect x="14" y="40" width="48" height="38" rx="14"/>
        <path d="M23 40V22a6 6 0 0 1 12 0v18"/>
        <path d="M35 40V16a6 6 0 0 1 12 0v24"/>
        <path d="M47 40V23a6 6 0 0 1 12 0v17"/>
        <path d="M59 44v-8a6 6 0 0 1 12 0v8"/>
        <path d="M14 54c-6 0-10 5-10 9s4 9 10 9"/>
      </g>
      <circle cx="214" cy="96" r="34" fill="var(--yellow)" fill-opacity=".35" stroke="currentColor" stroke-width="4"/>
      <path d="M238 120l24 24" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    </svg>`,
};

function shell(conteudo, ativo) {
  const itens = NAV.map(([href, rotulo]) => `<a href="#${href}" class="nav-a${ativo === href ? ' on' : ''}"${ativo === href ? ' aria-current="page"' : ''}>${rotulo}</a>`).join('');
  return `
    <header class="topo">
      <div class="topo-ini">
        <a class="marca" href="#/" aria-label="Agatha, início">
          <img src="assets/logo-mark.svg" alt="" width="20" height="20">
          <span>Agatha</span>
        </a>
      </div>
      <nav class="nav" aria-label="Principal">${itens}</nav>
      <div class="topo-fim" id="a11y-root"></div>
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
    <p class="kicker">Protótipo · Viva Surdo</p>
    <h1>Texto em,<br><em>sinais</em> out.</h1>
    <p class="sub">Cola uma frase, um texto ou as legendas de um filme. Vê a glosa em sinais, gesto a gesto.</p>
  </section>

  <section class="modo-grid" aria-label="Começar">
    <button class="modo-card texto" type="button" data-modo="texto">
      <span class="mode-art">${ARTE.texto}</span>
      <span class="mode-copy">
        <span class="mode-head"><span class="mode-name">Texto</span><span class="mode-go" aria-hidden="true">→</span></span>
        <span class="mode-sub">Cola aqui e vê sinal a sinal.</span>
      </span>
    </button>
    <button class="modo-card legendas" type="button" data-modo="legendas">
      <span class="mode-art">${ARTE.legendas}</span>
      <span class="mode-copy">
        <span class="mode-head"><span class="mode-name">Legendas</span><span class="mode-go" aria-hidden="true">→</span></span>
        <span class="mode-sub">Abre um .srt ou .vtt e um vídeo.</span>
      </span>
    </button>
    <a class="modo-card dicionario" href="#/dicionario">
      <span class="mode-art">${ARTE.dicionario}</span>
      <span class="mode-copy">
        <span class="mode-head"><span class="mode-name">Dicionário</span><span class="mode-go" aria-hidden="true">→</span></span>
        <span class="mode-sub">${CONTAS.ref} palavras com sinal International Sign documentado.</span>
      </span>
    </a>
  </section>

  <section class="demo" aria-label="Frase de demonstração">
    <div class="demo-topo">
      <p class="rotulo">Frase de demonstração</p>
      <button class="bt" id="bt-demo" type="button">Abrir sinalizadora</button>
    </div>
    <p class="demo-frase">${esc(SG_FRASE)}</p>
    <p class="demo-dica">Seleciona uma frase com o rato ou com o dedo. A bolha verde abre a sinalizadora com essa frase.</p>
  </section>

  <section class="painel editor">
    <div class="painel-topo">
      <label class="rotulo" for="txt">Texto para sinalizar</label>
      <span class="conta" id="editor-conta">0 palavras</span>
    </div>
    <textarea id="txt" rows="3" placeholder="Escreve ou cola aqui…" spellcheck="false"></textarea>
    <div class="acoes">
      <button class="bt primario" id="bt-ver" type="button">Ver sinais</button>
      <label class="bt" for="fich">Ficheiro</label>
      <input id="fich" type="file" accept=".txt,.srt,.vtt,.pdf,text/plain,application/pdf" hidden>
      <button class="bt" id="bt-exemplo" type="button">Exemplo</button>
    </div>
    <p class="recado" id="recado" role="status" hidden></p>
    <p class="dica">Ctrl + Enter para ver. Seleciona uma frase — aqui ou em qualquer parágrafo desta página — e a bolha verde abre a sinalizadora com essa frase.</p>
  </section>

  <section class="palco-sec" id="palco-sec" aria-label="Sinalizador">
    <div class="palco" id="palco"></div>
    <div class="controles">
      <div class="ctrl-topo">
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
  vigiarPalco();
  if (window.AVATAR && window.SINAL3D) {
    P.carregando3d = true;
    EL.palco.innerHTML = '<p class="palco-espera">A preparar a sinalizadora…</p>';
    AVATAR.init(EL.palco).then(() => {
      P.avatarOn = true;
      P.carregando3d = false;
      const espera = EL.palco.querySelector('.palco-espera');
      if (espera) espera.remove();
      recalcularPoses();
      if (!SG.aberto) { AVATAR.init(EL.palco); AVATAR.enquadrar('busto', 1.10); desenhar(); }
    }).catch(() => {
      P.avatarOn = false;
      P.carregando3d = false;
      P.poses = null;
      desenhar();
    });
  }
  const txt = $('#txt'), recado = $('#recado'), conta = $('#editor-conta');
  const aviso = (m) => { recado.hidden = !m; recado.textContent = m || ''; };
  const reduzido = () => A11Y.movimento || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const contar = (v) => {
    if (!conta) return;
    const n = String(v).trim() ? String(v).trim().split(/\s+/).length : 0;
    conta.textContent = n === 1 ? '1 palavra' : n + ' palavras';
  };
  contar('');
  txt.addEventListener('input', () => contar(txt.value));
  txt.addEventListener('select', () => atualizarSelecao());
  txt.addEventListener('mouseup', () => setTimeout(atualizarSelecao, 0));

  $$('.modo-card[data-modo]').forEach((c) => c.addEventListener('click', () => {
    if (c.dataset.modo === 'legendas') { $('#fich').click(); return; }
    txt.focus();
    const alvo = $('.painel.editor');
    if (alvo) alvo.scrollIntoView({ block: 'center', behavior: reduzido() ? 'auto' : 'smooth' });
  }));

  const aplicar = (texto) => {
    txt.value = texto;
    contar(texto);
    preparar(texto);
    if (!P.beats.length) { aviso('Escreve alguma coisa para ver sinais.'); return; }
    aviso('');
    if (reduzido()) pausar(); else tocar();
    const palco = $('#palco-sec');
    if (palco) palco.scrollIntoView({ block: 'start', behavior: reduzido() ? 'auto' : 'smooth' });
  };

  const ver = () => aplicar(txt.value);
  $('#bt-ver').addEventListener('click', ver);
  txt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ver(); } });
  $('#bt-exemplo').addEventListener('click', () => { txt.value = PM_EXEMPLOS[Math.floor(Math.random() * PM_EXEMPLOS.length)]; aplicar(txt.value); });
  const demo = $('#bt-demo');
  if (demo) demo.addEventListener('click', () => abrirSigner(SG_FRASE));

  EL.play.addEventListener('click', () => { if (P.tocando) pausar(); else tocar(); });
  $('#bt-prev').addEventListener('click', () => { pausar(); irPara(P.i - 1); });
  $('#bt-next').addEventListener('click', () => { pausar(); irPara(P.i + 1); });
  $$('.vel-b', $('.controles')).forEach(b => b.addEventListener('click', () => {
    P.vel = Number(b.dataset.vel);
    $$('.vel-b', $('.controles')).forEach(x => x.classList.toggle('on', x === b));
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
    recalcularPoses();
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
let PESQUISA = '', TEMA = '', ESTADO = '';
let LGA_PESQUISA = '', LGA_AULA = '', LGA_CONF = '';

const REFS = (typeof REFERENCIAS_IS !== 'undefined') ? REFERENCIAS_IS : {};
const FONTE_IS = (typeof IS_FONTE !== 'undefined') ? IS_FONTE : { nome: 'Sématos', total: 0, colhido: '' };

/* A LGA tem a sua própria aba: o que as aulas do Viva surdo mostram não se
   mistura com o léxico International Sign da Sématos — são línguas diferentes
   e a evidência de cada uma vale o que vale. */
const LGA = (typeof FONTE_LGA !== 'undefined') ? FONTE_LGA : {};
const META_LGA = (typeof LGA_META !== 'undefined') ? LGA_META : { nome: 'Viva surdo', aulas: 0, entradas: 0 };
const chaveLga = (s) => norm(String(s)).replace(/[?!.:;()"]/g, '').replace(/\s+/g, ' ').trim();
const LGA_LISTA = Object.values(LGA);
const LGA_NO_DICIONARIO = new Set();
GLOSSARIO.forEach(g => g.termos.forEach(t => {
  const k = chaveLga(t.palavra);
  if (LGA[k]) LGA_NO_DICIONARIO.add(k);
}));

function entradasDicionario() {
  const out = [];
  GLOSSARIO.forEach(g => g.termos.forEach(t => {
    const chave = String(t.palavra).toLowerCase().trim();
    out.push({
      palavra: t.palavra,
      tema: g.tema,
      notacao: sinalNotacao(chave) || null,
      ref: REFS[chave] || null,
    });
  }));
  return out;
}

const ENTRADAS = entradasDicionario();
const TEMAS = [...new Set(ENTRADAS.map(e => e.tema))];
const CONTAS = {
  total: ENTRADAS.length,
  ref: ENTRADAS.filter(e => e.ref).length,
  pose: ENTRADAS.filter(e => e.notacao).length,
  refComPose: ENTRADAS.filter(e => e.ref && e.notacao).length,
  comparado: ENTRADAS.filter(e => e.ref && e.ref.comparado).length,
  soRef: ENTRADAS.filter(e => e.ref && !e.notacao).length,
  soPose: ENTRADAS.filter(e => e.notacao && !e.ref).length,
};

const FILTROS_ESTADO = [
  ['', 'Tudo'],
  ['ref', 'Com referência IS'],
  ['pose', 'Com pose 3D'],
  ['sem', 'Sem referência'],
];

/* ---------------- dicionário: aba LGA (aulas do Viva surdo) ---------------- */
const LGA_CONFIANCAS = [['', 'Tudo'], ['alta', 'Confiança alta'], ['média', 'Média'], ['baixa', 'Baixa']];

function abasFonte(fonte) {
  const aba = (consulta, rotulo, on) => `<a class="aba-fonte${on ? ' on' : ''}" href="#/dicionario${consulta}"${on ? ' aria-current="page"' : ''}>${rotulo}</a>`;
  return `<nav class="abas-fonte" aria-label="Fonte do dicionário">
    ${aba('', 'International Sign', fonte === 'is')}
    ${aba('?fonte=lga', 'LGA · ' + esc(META_LGA.nome), fonte === 'lga')}
  </nav>`;
}

/* O abecedário abre a Aula 00 mas enterra o vocabulário: no dicionário fica no fim. */
const ehLetraLga = (e) => /^letra-/.test(e.palavra);
const LGA_ORDEM = LGA_LISTA.filter(e => !ehLetraLga(e)).concat(LGA_LISTA.filter(ehLetraLga));

function cartoesLga() {
  const q = norm(LGA_PESQUISA);
  const lista = LGA_ORDEM.filter(e => {
    if (LGA_AULA && e.aula !== LGA_AULA) return false;
    if (LGA_CONF && e.confianca !== LGA_CONF) return false;
    return !q || norm(e.palavra).includes(q) || norm(e.veSe).includes(q);
  });
  if (!lista.length) return '<p class="vazio">Nada encontrado.</p>';
  return lista.map(e => {
    const seg = (e.segundos && e.segundos.length) ? e.segundos[0] : 0;
    const tempo = Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
    const url = 'https://www.youtube.com/watch?v=' + encodeURIComponent(e.video) + '&t=' + seg + 's';
    const noDic = LGA_NO_DICIONARIO.has(e.chave);
    const pose = (window.SINAIS_LGA && window.SINAIS_LGA[e.chave]) || null;
    const temPose = !!(pose && pose.notacao);
    const botaoPlay = temPose
      ? `<button type="button" class="cartao-play-lga" data-lga-chave="${esc(e.chave)}"
                 aria-label="toca o sinal LGA de ${esc(e.palavra)}" title="Toca o sinal LGA de ${esc(e.palavra)}">▶</button>`
      : '';
    const fig = temPose && typeof maoFigura === 'function'
      ? maoFigura(pose.notacao.replace(/^2:/, '').split(/\s+/)[0])
      : '<span class="ref-marca">LGA</span>';
    return `
    <div class="cartao-item">
      <a class="cartao cartao-ref cartao-lga" data-conf="${esc(e.confianca)}" href="${url}"
         target="_blank" rel="noopener noreferrer"
         aria-label="${esc(e.palavra)} — ${esc(e.aula)}, ${tempo}, confiança ${esc(e.confianca)}. Abre a aula no YouTube.">
        <span class="fig">${fig}</span>
        <b>${esc(e.palavra)}</b>
        <small>${esc(e.aula.replace(/ —.*$/, ''))} · ${tempo} · ${esc(e.confianca)}${noDic ? ' · no dicionário' : ''}</small>
        <small class="lga-ve">${esc(e.veSe)}</small>
      </a>
      ${botaoPlay}
    </div>`;
  }).join('');
}

function vistaDicionarioLga() {
  const aulas = [...new Set(LGA_LISTA.map(e => e.aula))];
  const conta = (c) => LGA_LISTA.filter(e => e.confianca === c).length;
  const chipsAula = ['', ...aulas].map(a =>
    `<button type="button" class="chip${a === LGA_AULA ? ' on' : ''}" data-aula="${esc(a)}">${esc(a.replace(/ —.*$/, '') || 'Tudo')}</button>`).join('');
  const chipsConf = LGA_CONFIANCAS.map(([v, r]) =>
    `<button type="button" class="chip chip-estado${LGA_CONF === v ? ' on' : ''}" data-conf="${v}">${r}</button>`).join('');
  return `
  <section class="entrada">
    <p class="kicker">Dicionário · LGA</p>
    <h1>${LGA_LISTA.length} palavras nas aulas de LGA do ${esc(META_LGA.nome)}.</h1>
    <p class="sub">${META_LGA.aulas} aulas do Mini curso de LGA, lidas fotograma a fotograma a 540×360 no YouTube. ${LGA_NO_DICIONARIO.size} destas palavras já estão no dicionário; as restantes são o inventário das aulas. Confiança: ${conta('alta')} alta, ${conta('média')} média, ${conta('baixa')} baixa — as de confiança baixa estão marcadas para revisão humana.</p>
  </section>
  <section class="painel busca">
    <label class="campo">
      <span class="rotulo">Procurar na LGA</span>
      <input id="busca-lga" type="search" value="${esc(LGA_PESQUISA)}" placeholder="Procurar palavra…" autocomplete="off">
    </label>
    <div class="chips" id="aulas-lga">${chipsAula}</div>
    <div class="chips" id="conf-lga">${chipsConf}</div>
  </section>
  <section class="grade" id="grade-lga" aria-live="polite">${cartoesLga()}</section>
  <p class="rodape-nota">Cada cartão abre a aula no segundo em que a palavra é sinalizada. As descrições são leitura de fotogramas do canal Viva surdo e não substituem um sinalizador surdo: nenhuma foi validada pela comunidade.</p>`;
}

function cartoes() {
  const q = norm(PESQUISA);
  const lista = ENTRADAS.filter(e => {
    if (TEMA && e.tema !== TEMA) return false;
    if (ESTADO === 'ref' && !e.ref) return false;
    if (ESTADO === 'pose' && !e.notacao) return false;
    if (ESTADO === 'sem' && e.ref) return false;
    return !q || norm(e.palavra).includes(q);
  });
  if (!lista.length) return '<p class="vazio">Nada encontrado.</p>';
  /* Uma entrada só é tocável no palco se tiver notação. As que só têm
     referência levam ao vídeo da fonte: pôr a personagem a fazer um gesto que
     nunca foi comparado com o sinal seria dizer que sabemos o que não sabemos. */
  return lista.map(e => {
    const temPose = !!e.notacao;
    const href = temPose ? '#/?s=' + encodeURIComponent(e.palavra) : esc(e.ref.url);
    const externo = temPose ? '' : ' target="_blank" rel="noopener noreferrer"';
    const detalhe = e.ref
      ? 'IS · ' + esc(e.ref.glossa) + (e.ref.comparado ? ' · visto no vídeo' : '')
      : (e.notacao ? esc(e.notacao.forma) + ' · ' + esc(e.notacao.movimento) : 'sem pose');
    const nota = temPose && !e.ref ? ' · sem referência IS' : '';
    const aria = e.ref
      ? `${esc(e.palavra)} — sinal International Sign documentado (${esc(e.ref.glossa)})`
      : `${esc(e.palavra)} — gesto de estudo, sem referência`;
    /* O selo verde é o vídeo da fonte, não a personagem. No cartão com pose ele
       não pode ficar dentro do <a> do cartão (link dentro de link é inválido),
       por isso é um irmão ancorado ao canto superior direito da figura. No
       cartão que só tem referência, o cartão inteiro já é o vídeo. Sem
       referência não há vídeo, e o cartão não inventa um selo. */
    const selo = !temPose && e.ref ? '<span class="cartao-play" aria-hidden="true">▶</span>' : '';
    const video = temPose && e.ref
      ? `<a class="cartao-video" href="${esc(e.ref.url)}" target="_blank" rel="noopener noreferrer"
           title="Vídeo de referência (Sématos)" aria-label="Ver o vídeo de referência de ${esc(e.palavra)} na Sématos">▶</a>`
      : '';
    return `
    <div class="cartao-item">
      <a class="cartao${temPose ? '' : ' cartao-ref'}" href="${href}"${externo}
         ${temPose ? `data-palavra="${esc(e.palavra)}"` : ''} aria-label="${aria}">
        <span class="fig">${temPose ? maoFigura(e.notacao.forma) : '<span class="ref-marca">IS</span>'}${selo}</span>
        <b>${esc(e.palavra)}</b>
        <small>${detalhe}${esc(nota)}</small>
      </a>
      ${video}
    </div>`;
  }).join('');
}

function vistaDicionario(params) {
  const fonte = (params && params.fonte === 'lga') ? 'lga' : 'is';
  if (fonte === 'lga') return abasFonte(fonte) + vistaDicionarioLga();
  const chips = ['', ...TEMAS].map(t => `<button type="button" class="chip${t === TEMA ? ' on' : ''}" data-tema="${esc(t)}">${t || 'Tudo'}</button>`).join('');
  const estados = FILTROS_ESTADO.map(([v, r]) => `<button type="button" class="chip chip-estado${ESTADO === v ? ' on' : ''}" data-estado="${v}">${r}</button>`).join('');
  return abasFonte(fonte) + `
  <section class="entrada">
    <p class="kicker">Dicionário</p>
    <h1>${CONTAS.ref} palavras com sinal documentado em International Sign.</h1>
    <p class="sub">As ${CONTAS.ref} referências vêm do léxico International Sign da ${FONTE_IS.nome} (${FONTE_IS.total} sinais, colhido a ${FONTE_IS.colhido}) e ligam ao vídeo de cada sinal. ${CONTAS.pose} têm pose no palco 3D — ${CONTAS.soRef} ainda só existem na fonte, ${CONTAS.soPose} são gestos nossos sem correspondência IS. ${CONTAS.comparado} poses já foram comparadas fotograma a fotograma com o vídeo.</p>
  </section>
  <section class="painel busca">
    <label class="campo">
      <span class="rotulo">Procurar palavra</span>
      <input id="busca" type="search" value="${esc(PESQUISA)}" placeholder="Procurar palavra…" autocomplete="off">
    </label>
    <div class="chips" id="temas">${chips}</div>
    <div class="chips" id="estados">${estados}</div>
  </section>
  <section class="grade" id="grade" aria-live="polite">${cartoes()}</section>
  <p class="rodape-nota">As referências dizem que o International Sign tem um sinal para esta ideia e onde o vê-lo; não substituem o vídeo de um sinalizador surdo. As ${CONTAS.pose} poses do palco 3D são aproximações nossas — ${CONTAS.refComPose} delas ligadas a um sinal IS documentado, nenhuma validada por sinalizadores surdos.</p>`;
}

function ligarDicionario() {
  const grade = $('#grade'), busca = $('#busca');
  if (busca && grade) {
    busca.addEventListener('input', () => { PESQUISA = busca.value; grade.innerHTML = cartoes(); });
    grade.addEventListener('click', (e) => {
      const c = e.target.closest('[data-palavra]');
      if (!c || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      abrirSigner(c.dataset.palavra);
    });
  }
  const temas = $('#temas');
  if (temas) temas.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tema]');
    if (!b) return;
    TEMA = b.dataset.tema;
    $$('.chip', temas).forEach(c => c.classList.toggle('on', c === b));
    grade.innerHTML = cartoes();
  });
  const estados = $('#estados');
  if (estados) estados.addEventListener('click', (e) => {
    const b = e.target.closest('[data-estado]');
    if (!b) return;
    ESTADO = b.dataset.estado;
    $$('.chip', estados).forEach(c => c.classList.toggle('on', c === b));
    grade.innerHTML = cartoes();
  });

  const gradeL = $('#grade-lga'), buscaL = $('#busca-lga');
  if (buscaL && gradeL) {
    buscaL.addEventListener('input', () => { LGA_PESQUISA = buscaL.value; gradeL.innerHTML = cartoesLga(); });
  }
  if (gradeL) {
    gradeL.addEventListener('click', (e) => {
      const btn = e.target.closest('.cartao-play-lga');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      const k = btn.dataset.lgaChave;
      const pose = window.SINAIS_LGA && window.SINAIS_LGA[k];
      const entry = window.FONTE_LGA && window.FONTE_LGA[k];
      if (pose && pose.notacao) {
        abrirSignerNotacao(pose.notacao, (entry && entry.palavra) || k);
      }
    });
  }
  const aulasL = $('#aulas-lga');
  if (aulasL && gradeL) aulasL.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aula]');
    if (!b) return;
    LGA_AULA = b.dataset.aula;
    $$('.chip', aulasL).forEach(c => c.classList.toggle('on', c === b));
    gradeL.innerHTML = cartoesLga();
  });
  const confL = $('#conf-lga');
  if (confL && gradeL) confL.addEventListener('click', (e) => {
    const b = e.target.closest('[data-conf]');
    if (!b) return;
    LGA_CONF = b.dataset.conf;
    $$('.chip', confL).forEach(c => c.classList.toggle('on', c === b));
    gradeL.innerHTML = cartoesLga();
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
  esconderSelecao();
  fecharSigner(true);
  app.innerHTML = shell(view(m ? m.params : {}), ativo);
  const live = document.getElementById('route-live');
  if (live) live.textContent = ativo === '/dicionario' ? 'Dicionário' : 'Sinalizar';
  if (ativo === '/dicionario') {
    if (OBS_PALCO) { OBS_PALCO.disconnect(); OBS_PALCO = null; }
    SG.palcoAVista = false;
    SG.editorAVista = false;
    ligarDicionario();
  }
  else ligarSinalizar(m ? m.params : {});
  atualizarFab();
  montarA11y();
}

window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', () => {
  aplicarA11y();
  render();
  montarSelecao();
  montarSigner();
});

/* Em localhost o service worker esconde ficheiros acabados de editar; só é usado
   com ?sw=1 (para o testar) ou num servidor a sério. */
const semSW = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !/[?&]sw=1\b/.test(location.search);
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !semSW) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sem offline neste browser */ });
  });
}
