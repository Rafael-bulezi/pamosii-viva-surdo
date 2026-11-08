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

/* Os transportes ficam apagados quando não há nada para percorrer: um botão
   que não faz nada é pior do que um botão que se vê desligado. */
function atualizarTransporte() {
  const n = P.beats.length;
  if (EL.play) EL.play.disabled = !n;
  if (EL.prev) EL.prev.disabled = !n || P.i <= 0;
  if (EL.next) EL.next.disabled = !n || P.i >= n - 1;
}

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
  if (EL.agora) EL.agora.textContent = rotulo || (P.beats.length ? 'Em repouso' : 'Sem sinais ainda');
  if (P.i !== ULTIMO_BEAT) { ULTIMO_BEAT = P.i; marcarFita(); }
  atualizarTransporte();
}

function pintarFita() {
  if (!EL.fita) return;
  EL.fita.innerHTML = P.fita.length
    ? P.fita.map(b => `<button type="button" class="fita-item fita-${b.tipo}" data-beat="${b.i}">${esc(b.rotulo)}</button>`).join('')
    : '<p class="fita-vazia">A glosa aparece aqui — escreve uma frase e carrega em «Ver sinais».</p>';
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

/* ---------------- painel da sinalizadora 3D ---------------- */
const SG_FRASE = 'Bom dia! Onde fica a escola? Amanhã eu vou com a minha família.';
const SG = {
  aberto: false, texto: '', beats: [], passos: [], poses: null, inicio: [], total: 0,
  t: 0, beat: -1, tocando: false, raf: 0, last: 0, vel: 1, repetir: true,
  pillVisivel: false, palcoAVista: false, editorAVista: false, poseLga: null,
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

function marcarCheio() {
  const p = document.getElementById('sg-painel');
  const b = document.getElementById('sg-cheio');
  if (!p || !b) return;
  const on = document.fullscreenElement === p || p.classList.contains('cheio');
  b.classList.toggle('on', on);
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', on ? 'Sair do ecrã inteiro' : 'Ecrã inteiro');
}

function montarSigner() {
  if (document.getElementById('sg-painel')) return;

  const fab = document.createElement('button');
  fab.id = 'sg-fab';
  fab.type = 'button';
  fab.className = 'sg-fab';
  fab.setAttribute('aria-expanded', 'false');
  fab.setAttribute('aria-controls', 'sg-painel');
  fab.innerHTML = '<img src="assets/logo-mark.png" alt="" width="22" height="22"><span>Sinalizador 3D</span>';

  const painel = document.createElement('div');
  painel.id = 'sg-painel';
  painel.className = 'sg-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-labelledby', 'sg-titulo');
  painel.hidden = true;
  painel.innerHTML = `
    <div class="sg-topo">
      <p class="sg-titulo" id="sg-titulo">${SINALIZADOR.nome} · ${SINALIZADOR.papel}</p>
      <div class="sg-btns">
        <button class="sg-fechar" id="sg-cheio" type="button" aria-label="Ecrã inteiro" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>
        </button>
        <button class="sg-fechar" id="sg-fechar" type="button" aria-label="Fechar a sinalizadora">×</button>
      </div>
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
    <p class="sg-nota">
      <span>Gestos de estudo inspirados na língua gestual internacional. <b>Não</b> são sinais de LGA validados por sinalizadores surdos.</span>
      <button type="button" class="sg-info" id="sg-info" aria-label="Sobre estes gestos" aria-expanded="false">i</button>
      <span class="sg-info-txt" id="sg-info-txt" role="tooltip">A sinalizadora mostra gestos de estudo para acompanhar o texto, inspirados na língua gestual internacional. Não é tradução de LGA: a LGA tem gramática e sinais próprios, e esta versão ainda não foi validada por sinalizadores surdos.</span>
    </p>`;
  document.body.append(painel, fab);

  fab.addEventListener('click', () => {
    if (SG.aberto) { fecharSigner(); return; }
    if (SG.poseLga) { abrirSignerNotacao(SG.poseLga.notacao, SG.poseLga.rotulo, SG.poseLga.aproximado, SG.poseLga.dur); return; }
    /* o que está escrito no editor manda sobre a frase da última demonstração */
    const txt = document.getElementById('txt');
    const escrito = txt && txt.value.trim();
    abrirSigner(escrito || SG.texto || SG_FRASE);
  });
  $('#sg-fechar').addEventListener('click', () => fecharSigner());
  const info = $('#sg-info');
  info.addEventListener('click', () => {
    const on = info.getAttribute('aria-expanded') === 'true';
    info.setAttribute('aria-expanded', String(!on));
  });
  $('#sg-cheio').addEventListener('click', async () => {
    const p = $('#sg-painel');
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await p.requestFullscreen();
    } catch (err) {
      p.classList.toggle('cheio');
    }
    marcarCheio();
  });
  document.addEventListener('fullscreenchange', marcarCheio);
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
    if (e.key === 'Escape' && SG.aberto && !document.fullscreenElement) fecharSigner();
  });
}

async function abrirSigner(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim() || SG.texto || SG_FRASE;
  SG.poseLga = null;
  return abrirSignerBeats(t, analisarEmBeats(t).beats, {});
}

/* Uma pose (ou uma lista de passos, nos sinais compostos) vinda da notação da
   LGA: o painel mostra a mão em repouso entre repetições em vez de glosar a
   palavra por regras que não são da LGA. */
async function abrirSignerNotacao(notacao, rotulo, aproximado, dur) {
  const partes = (Array.isArray(notacao) ? notacao : [notacao]).map(t => String(t).trim()).filter(Boolean);
  const beats = [];
  for (const parte of partes) {
    const n = window.sinalDeNotacao ? sinalDeNotacao(parte, {}) : null;
    if (!n) continue;
    beats.push({
      tipo: 'sinal', rotulo: rotulo || '', forma: n.forma, duas: n.duas, reps: n.reps, local: n.local,
      pos0: n.inicio.pos, rot0: n.inicio.rot, pos1: n.fim.pos, rot1: n.fim.rot,
      dur: (Array.isArray(dur) ? dur[beats.length] : dur) || 760,
      palma: n.palma, esq: n.esq, amp: n.amp, movimento: n.movimento,
      chip: beats.length === 0,
    });
  }
  if (!beats.length) return false;
  SG.poseLga = { notacao: partes, rotulo, aproximado: !!aproximado, dur: dur || null };
  await abrirSignerBeats(rotulo || '', [...beats, pausa()], { notacao: true, aproximado: !!aproximado });
  return true;
}

async function abrirSignerBeats(t, beats, opcoes) {
  if (!document.getElementById('sg-painel')) montarSigner();
  SG.texto = t;
  SG.aberto = true;
  SG.beats = beats;
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
  $('#sg-frase').textContent = '«' + t + '»' + (opcoes.aproximado ? ' · aproximação à aula' : '');
  pintarChipsSigner();
  const abrir = $('#sg-abrir');
  if (abrir) {
    const rota = (location.hash || '').replace(/^#/, '').split('?')[0] || '/';
    abrir.hidden = opcoes.notacao || rota !== '/dicionario';
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
    await AVATAR.init(palco, { progresso: espera3d });
    /* fechado enquanto o modelo carregava: o canvas volta para o palco da página */
    if (!SG.aberto) { devolverAvatar(); return; }
    const espera = palco.querySelector('.sg-espera');
    if (espera) espera.remove();
    /* o painel já é largo e alto; 1,06 aproxima o suficiente para o rosto e as
       mãos lerem bem sem cortar os braços nos sinais abertos */
    AVATAR.enquadrar('busto', 1.06);
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
  if (document.fullscreenElement === painel) document.exitFullscreen().catch(() => {});
  painel.classList.remove('cheio');
  marcarCheio();
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
  caixa.innerHTML = SG.beats.map((b, i) => (!b.rotulo || b.tipo === 'pausa' || b.chip === false) ? ''
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

/* Ilustrações dos cartões. Tudo a `currentColor` e a opacidades: a mesma arte
   serve o tema claro, o escuro e o contraste alto sem cores cravadas. */
const MAO_ARTE = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="currentColor">
  <rect x="-27" y="2" width="54" height="52" rx="16"/>
  <rect x="-25" y="-26" width="12" height="38" rx="6"/>
  <rect x="-9.5" y="-36" width="12" height="48" rx="6"/>
  <rect x="6" y="-32" width="12" height="44" rx="6"/>
  <rect x="21" y="-20" width="11" height="32" rx="5.5"/>
  <rect x="-39" y="6" width="13" height="30" rx="6.5" transform="rotate(-24 -32.5 21)"/>
  <rect x="-7" y="50" width="22" height="16" rx="8"/>
</g>`;

const ARTE = {
  /* Um editor com a linha que está a ser sinalizada, e a mão a acompanhar. */
  texto: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <g transform="rotate(-3 118 92)">
        <rect x="26" y="26" width="180" height="122" rx="15" fill="currentColor" fill-opacity=".14"/>
        <rect x="26" y="26" width="180" height="122" rx="15" stroke="currentColor" stroke-opacity=".5" stroke-width="2.5"/>
        <rect x="26" y="26" width="180" height="25" rx="12.5" fill="currentColor" fill-opacity=".13"/>
        <circle cx="42" cy="38.5" r="3.4" fill="currentColor" fill-opacity=".85"/>
        <circle cx="54" cy="38.5" r="3.4" fill="currentColor" fill-opacity=".85"/>
        <circle cx="66" cy="38.5" r="3.4" fill="currentColor" fill-opacity=".85"/>
        <rect x="42" y="68" width="92" height="8" rx="4" fill="currentColor" fill-opacity=".45"/>
        <rect x="42" y="86" width="132" height="16" rx="8" fill="currentColor" fill-opacity=".2"/>
        <rect x="44" y="90" width="106" height="8" rx="4" fill="currentColor"/>
        <rect x="154" y="88" width="3" height="12" fill="currentColor"/>
        <rect x="42" y="114" width="76" height="8" rx="4" fill="currentColor" fill-opacity=".45"/>
        <rect x="42" y="130" width="50" height="8" rx="4" fill="currentColor" fill-opacity=".28"/>
      </g>
      ${MAO_ARTE(246, 102, 0.9)}
    </svg>`,
  /* Um fotograma com legenda e a barra do tempo: o que o ficheiro traz. */
  legendas: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <rect x="20" y="22" width="280" height="118" rx="16" fill="currentColor" fill-opacity=".13"/>
      <rect x="20" y="22" width="280" height="118" rx="16" stroke="currentColor" stroke-opacity=".5" stroke-width="2.5"/>
      <circle cx="124" cy="72" r="26" fill="currentColor" fill-opacity=".16" stroke="currentColor" stroke-opacity=".6" stroke-width="2.5"/>
      <path d="M117 59l20 13-20 13z" fill="currentColor"/>
      <rect x="36" y="106" width="148" height="10" rx="5" fill="currentColor" fill-opacity=".9"/>
      <rect x="192" y="106" width="76" height="10" rx="5" fill="currentColor" fill-opacity=".4"/>
      <rect x="36" y="122" width="100" height="10" rx="5" fill="currentColor" fill-opacity=".4"/>
      <g transform="translate(36 158)">
        <rect width="248" height="8" rx="4" fill="currentColor" fill-opacity=".22"/>
        <rect width="152" height="8" rx="4" fill="currentColor" fill-opacity=".85"/>
        <circle cx="152" cy="4" r="7.5" fill="currentColor"/>
      </g>
      ${MAO_ARTE(272, 118, 0.78)}
    </svg>`,
  /* Duas fichas de dicionário, uma à frente com a mão, e a lupa por cima. */
  dicionario: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <g transform="rotate(-5 88 100)">
        <rect x="28" y="46" width="118" height="106" rx="13" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".35" stroke-width="2"/>
        <rect x="40" y="58" width="54" height="44" rx="9" fill="currentColor" fill-opacity=".16"/>
        <rect x="42" y="114" width="70" height="8" rx="4" fill="currentColor" fill-opacity=".4"/>
        <rect x="42" y="128" width="46" height="7" rx="3.5" fill="currentColor" fill-opacity=".25"/>
      </g>
      <g transform="rotate(3 176 96)">
        <rect x="106" y="34" width="130" height="112" rx="13" fill="currentColor" fill-opacity=".18"/>
        <rect x="106" y="34" width="130" height="112" rx="13" stroke="currentColor" stroke-opacity=".6" stroke-width="2.5"/>
        <rect x="118" y="46" width="62" height="54" rx="9" fill="currentColor" fill-opacity=".2"/>
        ${MAO_ARTE(149, 84, 0.34)}
        <rect x="120" y="112" width="78" height="9" rx="4.5" fill="currentColor" fill-opacity=".8"/>
        <rect x="120" y="128" width="52" height="7" rx="3.5" fill="currentColor" fill-opacity=".45"/>
      </g>
      <circle cx="252" cy="132" r="26" fill="currentColor" fill-opacity=".14" stroke="currentColor" stroke-width="6"/>
      <path d="M271 151l17 17" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
    </svg>`,
  /* Cartão da fonte LGA: uma aula em vídeo com a mão a sinalizar. */
  fonteLga: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <rect x="16" y="18" width="288" height="150" rx="18" fill="currentColor" fill-opacity=".09" stroke="currentColor" stroke-opacity=".32" stroke-width="2"/>
      <rect x="32" y="34" width="46" height="7" rx="3.5" fill="currentColor" fill-opacity=".55"/>
      <rect x="86" y="34" width="26" height="7" rx="3.5" fill="currentColor" fill-opacity=".3"/>
      <circle cx="118" cy="86" r="30" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5"/>
      <path d="M110 71l23 15-23 15z" fill="currentColor"/>
      <rect x="32" y="128" width="256" height="10" rx="5" fill="currentColor" fill-opacity=".22"/>
      <rect x="32" y="128" width="96" height="10" rx="5" fill="currentColor" fill-opacity=".9"/>
      <circle cx="128" cy="133" r="8" fill="currentColor"/>
      <rect x="32" y="148" width="64" height="7" rx="3.5" fill="currentColor" fill-opacity=".4"/>
      ${MAO_ARTE(240, 92, 0.78)}
    </svg>`,
  /* Cartão da fonte IS: o globo do léxico, o play e a mão. */
  fonteIs: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <circle cx="112" cy="93" r="58" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".8" stroke-width="3.5"/>
      <ellipse cx="112" cy="93" rx="26" ry="58" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5"/>
      <path d="M84 44c14 30 14 68 0 98M140 44c-14 30-14 68 0 98" stroke="currentColor" stroke-opacity=".42" stroke-width="2.5"/>
      <path d="M54 93h116" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5"/>
      <path d="M63 63h98M63 123h98" stroke="currentColor" stroke-opacity=".4" stroke-width="2.5"/>
      <circle cx="170" cy="134" r="27" fill="currentColor"/>
      <path d="M162 121l20 13-20 13z" fill="var(--surface)"/>
      ${MAO_ARTE(246, 90, 0.8)}
    </svg>`,
};

function shell(conteudo, ativo) {
  const itens = NAV.map(([href, rotulo]) => `<a href="#${href}" class="nav-a${ativo === href ? ' on' : ''}"${ativo === href ? ' aria-current="page"' : ''}>${rotulo}</a>`).join('');
  return `
    <header class="topo">
      <div class="topo-ini">
        <a class="marca" href="#/" aria-label="Viva Surdo, início">
          <img src="assets/logo-mark.png" alt="" width="24" height="24">
          <span>Viva Surdo</span>
        </a>
      </div>
      <nav class="nav" aria-label="Principal">${itens}</nav>
      <div class="topo-fim" id="a11y-root"></div>
    </header>
    <main id="conteudo" tabindex="-1">${conteudo}</main>
    <footer class="rodape">
      <div class="rodape-linha">
        <img class="rodape-marca" src="assets/logo-emblem.png" alt="" width="41" height="34">
        <p>Protótipo da Viva Surdo. As associações palavra-sinal estão <b>por validar</b> por sinalizadores surdos.</p>
      </div>
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
      <span class="mode-art">
        <span class="mode-num" aria-hidden="true">01</span>
        <span class="mode-eyebrow">Escreve</span>
        ${ARTE.texto}
      </span>
      <span class="mode-copy">
        <span class="mode-name">Texto</span>
        <span class="mode-sub">Cola uma frase e vê a glosa em sinais, gesto a gesto.</span>
        <span class="mode-foot">
          <span class="mode-cta">Ir para o editor</span>
          <span class="mode-go" aria-hidden="true">↓</span>
        </span>
      </span>
    </button>
    <button class="modo-card legendas" type="button" data-modo="legendas">
      <span class="mode-art">
        <span class="mode-num" aria-hidden="true">02</span>
        <span class="mode-eyebrow">Abre .srt · .vtt</span>
        ${ARTE.legendas}
      </span>
      <span class="mode-copy">
        <span class="mode-name">Legendas</span>
        <span class="mode-sub">Carrega um ficheiro com tempos e um vídeo para sincronizar.</span>
        <span class="mode-foot">
          <span class="mode-cta">Escolher ficheiro</span>
          <span class="mode-go" aria-hidden="true">↑</span>
        </span>
      </span>
    </button>
    <a class="modo-card dicionario" href="#/dicionario">
      <span class="mode-art">
        <span class="mode-num" aria-hidden="true">03</span>
        <span class="mode-eyebrow">${LGA_LISTA.length} LGA · ${CONTAS.ref} IS</span>
        ${ARTE.dicionario}
      </span>
      <span class="mode-copy">
        <span class="mode-name">Dicionário</span>
        <span class="mode-sub">Duas línguas, cada palavra com o sinal, a aula e o vídeo de origem.</span>
        <span class="mode-foot">
          <span class="mode-cta">Abrir o dicionário</span>
          <span class="mode-go" aria-hidden="true">→</span>
        </span>
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
      <button class="bt" id="bt-fich" type="button">Ficheiro</button>
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
      <button class="bt" id="bt-vid" type="button">Abrir vídeo</button>
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

/* O GLB tem 13 MB: numa ligação lenta a espera passa dos quatro minutos.
   Uma percentagem prova que está a andar, em vez de parecer pendurado. */
function espera3d(pct) {
  const txt = 'A preparar a sinalizadora… ' + Math.max(1, Math.round(pct * 100)) + '%';
  document.querySelectorAll('.palco-espera, .sg-espera').forEach((e) => {
    if (/^A preparar/.test(e.textContent)) e.textContent = txt;
  });
}

function ligarSinalizar(params) {
  EL.palco = $('#palco');
  EL.agora = $('#agora');
  EL.play = $('#bt-play');
  EL.prev = $('#bt-prev');
  EL.next = $('#bt-next');
  EL.fita = $('#fita');
  EL.contas = $('#contas');
  vigiarPalco();
  if (window.AVATAR && window.SINAL3D) {
    P.carregando3d = true;
    EL.palco.innerHTML = '<p class="palco-espera">A preparar a sinalizadora…</p>';
    AVATAR.init(EL.palco, { progresso: espera3d }).then(() => {
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
    const alvo = $('.painel.editor');
    txt.focus();
    if (!alvo) return;
    /* o foco sozinho é invisível ao longe: o painel pisca para onde olhar */
    alvo.classList.remove('a-piscar');
    void alvo.offsetWidth;
    alvo.classList.add('a-piscar');
    setTimeout(() => alvo.classList.remove('a-piscar'), 1400);
    alvo.scrollIntoView({ block: 'center', behavior: reduzido() ? 'auto' : 'smooth' });
  }));

  const aplicar = (texto) => {
    txt.value = texto;
    contar(texto);
    preparar(texto);
    if (!P.beats.length) {
      aviso(String(texto).trim()
        ? 'Nenhuma palavra desta frase tem sinal na glosa. Tenta «Bom dia» ou usa o dicionário.'
        : 'Escreve alguma coisa para ver sinais.');
      txt.focus();
      return;
    }
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
  $('#bt-fich').addEventListener('click', () => fich.click());
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
  $('#bt-vid').addEventListener('click', () => $('#vid').click());
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

/* A entrada do dicionário são duas fontes e só duas: primeiro escolhe-se a
   língua, depois vê-se o vocabulário dela. Misturar as duas numa lista foi o
   que tornou os cartões ilegíveis. */
function vistaFontes() {
  return `
  <section class="entrada">
    <p class="kicker">Dicionário</p>
    <h1>Duas fontes, dois vocabulários.</h1>
    <p class="sub">Escolhe a língua e vês só os sinais dela: as ${LGA_LISTA.length} palavras lidas nas aulas de LGA do ${esc(META_LGA.nome)}, ou as ${CONTAS.ref} referências International Sign do léxico da ${esc(FONTE_IS.nome)}.</p>
  </section>
  <section class="fontes">
    <a class="fonte-card lga" href="#/dicionario?fonte=lga">
      <span class="fonte-art">
        <span class="fonte-num" aria-hidden="true">${LGA_LISTA.length}</span>
        <span class="fonte-eyebrow">Aulas em vídeo</span>
        ${ARTE.fonteLga}
      </span>
      <span class="fonte-copy">
        <span class="fonte-nome">LGA · ${esc(META_LGA.nome)}</span>
        <span class="fonte-desc">Palavras lidas fotograma a fotograma nas aulas. ${LGA_COM_POSE} já abrem no palco 3D da Agatha.</span>
        <span class="fonte-chips">
          <span>${LGA_LISTA.length} palavras</span>
          <span>${META_LGA.aulas} aulas</span>
          <span>${LGA_COM_POSE} em 3D</span>
        </span>
        <span class="fonte-seta">Ver a LGA <b aria-hidden="true">→</b></span>
      </span>
    </a>
    <a class="fonte-card is" href="#/dicionario?fonte=is">
      <span class="fonte-art">
        <span class="fonte-num" aria-hidden="true">${CONTAS.ref}</span>
        <span class="fonte-eyebrow">${esc(FONTE_IS.nome)}</span>
        ${ARTE.fonteIs}
      </span>
      <span class="fonte-copy">
        <span class="fonte-nome">International Sign</span>
        <span class="fonte-desc">Sinais documentados no léxico da ${esc(FONTE_IS.nome)}, com o vídeo de cada um. ${CONTAS.comparado} já foram comparados fotograma a fotograma.</span>
        <span class="fonte-chips">
          <span>${CONTAS.ref} sinais IS</span>
          <span>${FONTE_IS.total} no léxico</span>
          <span>${CONTAS.comparado} comparados</span>
        </span>
        <span class="fonte-seta">Ver o International Sign <b aria-hidden="true">→</b></span>
      </span>
    </a>
  </section>`;
}

function migalhas(fonte) {
  const outra = fonte === 'lga'
    ? ['?fonte=is', 'International Sign']
    : ['?fonte=lga', 'LGA · ' + META_LGA.nome];
  return `<nav class="migalhas" aria-label="Fonte do dicionário">
    <a class="voltar" href="#/dicionario">← Fontes</a>
    <a class="trocar" href="#/dicionario${outra[0]}">${esc(outra[1])} →</a>
  </nav>`;
}

/* O abecedário abre a Aula 00 mas enterra o vocabulário: no dicionário fica no fim. */
const ehLetraLga = (e) => /^letra-/.test(e.palavra);
const LGA_ORDEM = LGA_LISTA.filter(e => !ehLetraLga(e)).concat(LGA_LISTA.filter(ehLetraLga));

/* A camada 3D (lga-3d.js) cobre só as palavras já lidas no quadro. Sem pose, o
   cartão abre o vídeo: pôr a Agatha a fazer um gesto que ninguém comparou com a
   aula seria dizer que sabemos o que não sabemos. `notacao` pode ser uma lista:
   um compasso por passo dos sinais compostos (`bom dia` = polegar + mão que sobe). */
function notacoesLga(p) {
  if (!p || !p.notacao) return [];
  return (Array.isArray(p.notacao) ? p.notacao : [p.notacao]).map(t => String(t).trim()).filter(Boolean);
}

function poseLga(chave) {
  const p = window.SINAIS_LGA && window.SINAIS_LGA[chave];
  const partes = notacoesLga(p);
  if (!partes.length || !window.FORMAS_MAO || !window.LOCAIS) return null;
  const campos = partes.map(t => String(t).replace(/^2:/, '').split(/\s+/));
  if (campos.some(([forma, local]) => !FORMAS_MAO[forma] || !LOCAIS[local])) return null;
  const [forma, local, movimento] = campos[0];
  return { forma, local, movimento, notacao: partes, aproximado: !!p.aproximado, dur: p.dur };
}

const LGA_COM_POSE = LGA_LISTA.filter(e => poseLga(e.chave)).length;

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
    const pose = poseLga(e.chave);
    const aulaCurta = e.aula.replace(/ —.*$/, '');
    const fig = pose
      ? maoFigura(pose.forma, true)
      : `<span class="fig-play" aria-hidden="true">▶</span>
         <span class="fig-rodape" aria-hidden="true"><span class="fig-fonte-nome">${esc(aulaCurta)}</span><span class="fig-tempo">${tempo}</span></span>`;
    const selo = pose
      ? `<span class="selo-3d"${pose.aproximado ? ' data-aprox="1"' : ''}>${pose.aproximado ? '3D ≈' : '3D'}</span>`
      : '';
    const rotulo = pose
      ? `${esc(e.palavra)} — pose 3D da Agatha${pose.aproximado ? ' (aproximação)' : ''}, ${esc(e.aula)}. Abre no palco 3D.`
      : `${esc(e.palavra)} — ${esc(e.aula)}, ${tempo}, confiança ${esc(e.confianca)}. Abre a aula no YouTube.`;
    const video = pose
      ? `<a class="cartao-video" href="${url}" target="_blank" rel="noopener noreferrer"
           title="Ver na aula de origem" aria-label="Ver ${esc(e.palavra)} na aula do Viva surdo no YouTube">▶</a>`
      : '';
    return `
    <div class="cartao-item">
      <a class="cartao cartao-lga" data-conf="${esc(e.confianca)}"
         href="${pose ? '#/dicionario?fonte=lga' : url}"
         ${pose ? `data-lga-palavra="${esc(e.chave)}" data-lga-rotulo="${esc(e.palavra)}"` : 'target="_blank" rel="noopener noreferrer"'}
         title="${esc(e.veSe)}" aria-label="${rotulo}">
        <span class="fig${pose ? '' : ' fig-fonte'}">${fig}${selo}</span>
        <b>${esc(e.palavra)}</b>
        <span class="meta"><span class="ponto"></span>${pose ? esc(aulaCurta) + ' · ' : ''}confiança ${esc(e.confianca)}${noDic ? '<span class="meta-selo">no dicionário</span>' : ''}</span>
        <small class="lga-ve">${esc(e.veSe)}</small>
      </a>
      ${video}
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
    <p class="sub">${META_LGA.aulas} aulas do Mini curso de LGA, lidas fotograma a fotograma a 540×360 no YouTube. ${LGA_NO_DICIONARIO.size} destas palavras já estão no dicionário; ${LGA_COM_POSE} já abrem no palco 3D da Agatha e as restantes abrem a aula no segundo certo. Confiança: ${conta('alta')} alta, ${conta('média')} média, ${conta('baixa')} baixa — as de confiança baixa estão marcadas para revisão humana.</p>
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
  <p class="rodape-nota">Os cartões com selo 3D abrem no palco da Agatha; o ≈ marca as poses que são aproximação declarada. Os restantes abrem a aula no segundo em que a palavra é sinalizada. As descrições são leitura de fotogramas do canal Viva surdo e não substituem um sinalizador surdo: nenhuma foi validada pela comunidade.</p>`;
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
    const selo = temPose ? '<span class="selo-3d">3D</span>' : '';
    /* O selo verde é o vídeo da fonte, não a personagem. No cartão com pose ele
       não pode ficar dentro do <a> do cartão (link dentro de link é inválido),
       por isso é um irmão ancorado ao canto superior direito da figura. No
       cartão que só tem referência, a figura inteira já abre o vídeo. */
    const video = temPose && e.ref
      ? `<a class="cartao-video" href="${esc(e.ref.url)}" target="_blank" rel="noopener noreferrer"
           title="Vídeo de referência (Sématos)" aria-label="Ver o vídeo de referência de ${esc(e.palavra)} na Sématos">▶</a>`
      : '';
    const fig = temPose
      ? maoFigura(e.notacao.forma, true)
      : `<span class="fig-play" aria-hidden="true">▶</span>
         <span class="fig-rodape" aria-hidden="true"><span class="fig-fonte-nome">Sématos</span></span>`;
    return `
    <div class="cartao-item">
      <a class="cartao" href="${href}"${externo}
         ${temPose ? `data-palavra="${esc(e.palavra)}"` : ''} aria-label="${aria}">
        <span class="fig${temPose ? '' : ' fig-fonte'}">${fig}${selo}</span>
        <b>${esc(e.palavra)}</b>
        <span class="meta">${detalhe}${esc(nota)}</span>
      </a>
      ${video}
    </div>`;
  }).join('');
}

function vistaDicionario(params) {
  const fonte = (params && (params.fonte === 'lga' || params.fonte === 'is')) ? params.fonte : '';
  if (!fonte) return vistaFontes();
  if (fonte === 'lga') return migalhas(fonte) + vistaDicionarioLga();
  const chips = ['', ...TEMAS].map(t => `<button type="button" class="chip${t === TEMA ? ' on' : ''}" data-tema="${esc(t)}">${t || 'Tudo'}</button>`).join('');
  const estados = FILTROS_ESTADO.map(([v, r]) => `<button type="button" class="chip chip-estado${ESTADO === v ? ' on' : ''}" data-estado="${v}">${r}</button>`).join('');
  return migalhas(fonte) + `
  <section class="entrada">
    <p class="kicker">Dicionário · International Sign</p>
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
  if (gradeL) gradeL.addEventListener('click', (e) => {
    const c = e.target.closest('[data-lga-palavra]');
    if (!c || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const pose = poseLga(c.dataset.lgaPalavra);
    if (!pose) return;
    e.preventDefault();
    abrirSignerNotacao(pose.notacao, c.dataset.lgaRotulo, pose.aproximado, pose.dur);
  });
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
  /* carregar no separador onde já estamos não muda o hash: leva ao topo e
     limpa os filtros do dicionário, em vez de não fazer nada */
  $$('.nav .nav-a, .marca').forEach(a => a.addEventListener('click', (e) => {
    if (a.getAttribute('href') !== location.hash) return;
    e.preventDefault();
    PESQUISA = TEMA = ESTADO = '';
    LGA_PESQUISA = LGA_AULA = LGA_CONF = '';
    render();
    window.scrollTo(0, 0);
  }));
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
