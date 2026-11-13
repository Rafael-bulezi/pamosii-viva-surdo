/* ============================================================================
   AGATHA — duas funções: ver sinais de um texto, e procurar uma palavra.
   Sem contas, sem recolha de dados, sem build. Ficheiros: dados.js (glossário e
   glosador), maos.js (rig 3D desenhado em SVG) e este.
   ----------------------------------------------------------------------------
   [VISÃO DE EVOLUÇÃO]: Futura homepage cinematográfica com 2 personagens
   em interação 3D (diálogo em palco partilhado, troca de turnos e câmara dinâmica).
   ============================================================================ */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* `lim` vem do maos.js (mesmo âmbito global) */

/* ---------------- acessibilidade ---------------- */
const A11Y_KEY = 'vs.a11y';
const A11Y_PADRAO = { temaEscuro: false, contraste: false, movimento: false, escala: 100, brilhoAoVivo: 'horizonte' };
let A11Y = { ...A11Y_PADRAO };
try { A11Y = { ...A11Y_PADRAO, ...(JSON.parse(localStorage.getItem(A11Y_KEY) || '{}')) }; } catch (e) { /* sem armazenamento */ }

function aplicarA11y() {
  const h = document.documentElement;
  h.toggleAttribute('data-tema-escuro', !!A11Y.temaEscuro);
  h.toggleAttribute('data-contraste-alto', !!A11Y.contraste);
  h.toggleAttribute('data-movimento-reduzido', !!A11Y.movimento);
  h.style.setProperty('--escala', ([100, 115, 130, 150].includes(Number(A11Y.escala)) ? Number(A11Y.escala) : 100) / 100);
  try { localStorage.setItem(A11Y_KEY, JSON.stringify(A11Y)); } catch (e) { /* modo privado */ }
  if (typeof BRILHO !== 'undefined' && BRILHO.sincronizar) BRILHO.sincronizar();
}

function montarA11y() {
  const raiz = $('#a11y-root');
  if (!raiz) return;
  raiz.innerHTML = `
    <button class="a11y-btn" id="a11y-btn" type="button" aria-expanded="false" aria-controls="a11y-painel" title="Definições e acessibilidade" aria-label="Opções de acessibilidade">
      <svg class="a11y-ico" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" aria-hidden="true">
        <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
      </svg>
      <span class="a11y-btn-rotulo">Definições</span>
    </button>
    <div class="a11y-painel" id="a11y-painel" hidden>
      <p class="a11y-titulo">Definições</p>
      <div class="a11y-seccao">
        <label class="a11y-linha a11y-escala">Brilho ao vivo
          <select data-a11y="brilhoAoVivo">
            <option value="horizonte">Horizonte (Horizon Cue)</option>
            <option value="fita">Fita líquida (Ribbon)</option>
            <option value="nenhum">Desligado</option>
          </select>
        </label>
      </div>
      <div class="a11y-seccao">
        <p class="a11y-subtitulo">Acessibilidade</p>
        <label class="a11y-linha"><input type="checkbox" data-a11y="temaEscuro"> Fundo escuro</label>
        <label class="a11y-linha"><input type="checkbox" data-a11y="contraste"> Contraste alto</label>
        <label class="a11y-linha"><input type="checkbox" data-a11y="movimento"> Parar animações</label>
        <label class="a11y-linha a11y-escala">Texto
          <select data-a11y="escala">
            <option value="100">100%</option><option value="115">115%</option>
            <option value="130">130%</option><option value="150">150%</option>
          </select>
        </label>
      </div>
    </div>`;
  const btn = $('#a11y-btn'), painel = $('#a11y-painel');
  const sync = () => {
    $$('[data-a11y]', painel).forEach(el => {
      const k = el.dataset.a11y;
      if (el.type === 'checkbox') el.checked = !!A11Y[k]; else el.value = String(A11Y[k] || '');
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
    A11Y[k] = el.type === 'checkbox' ? el.checked : (k === 'escala' ? Number(el.value) : el.value);
    aplicarA11y();
    if (k === 'movimento' && A11Y.movimento && SG.tocando) pausarSigner();
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !painel.hidden) { painel.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
  });
  sync();
}

/* ---------------- glosa em beats ---------------- */
/* mão em descanso: à frente da cintura, palma virada para o corpo, dedos soltos */
const REP = { forma: formaMisturar(FORMAS_MAO.curva, FORMAS_MAO.abre, 0.45), pos: [-1.04, 0.96, 0.30], rot: [6, 180, 186] };

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
    tipo: 'letra', rotulo: l, grupo: it.palavra, forma: l, duas: false, reps: 1, movimento: 'parado',
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
    pill.hidden = true; SEL_TEXTO = '';
    return;
  }
  SEL_TEXTO = texto;
  const n = texto.split(' ').filter(Boolean).length;
  pill.querySelector('.sel-txt').textContent = 'Sinalizar «' + (texto.length > 46 ? texto.slice(0, 46).trimEnd() + '…' : texto) + '»';
  pill.querySelector('.sel-conta').textContent = n === 1 ? '1 palavra' : n + ' palavras';
  pill.hidden = false;
}

function esconderSelecao() {
  const pill = document.getElementById('sel-pill');
  if (pill) pill.hidden = true;
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
  pronto: false, vivo: false, origem: null, poseLga: null,
};

/* o modelo só existe uma vez: o painel leva o mesmo canvas, e uma casa fora do
   ecrã guarda-o quando o painel fecha */
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

  const painel = document.createElement('div');
  painel.id = 'sg-painel';
  painel.className = 'sg-painel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-labelledby', 'sg-titulo');
  painel.hidden = true;
  painel.innerHTML = `
    <div class="sg-topo">
      <p class="sg-titulo" id="sg-titulo">${SINALIZADOR.nome} · ${SINALIZADOR.papel}</p>
      <span class="sg-modo" id="sg-modo" hidden>modo simples</span>
      <div class="sg-btns">
        <button type="button" class="sg-fechar sg-info" id="sg-info" aria-label="Sobre estes gestos" aria-expanded="false">i</button>
        <span class="sg-info-txt" id="sg-info-txt" role="tooltip">Gestos de estudo inspirados na língua gestual internacional. Não é tradução de LGA: a LGA tem gramática e sinais próprios, e esta versão ainda não foi validada por sinalizadores surdos. No modo ao vivo, o Chrome transcreve o áudio nos servidores da Google e a frase segue para um modelo que escolhe os sinais; nada fica guardado neste aparelho.</span>
        <button class="sg-fechar" id="sg-cheio" type="button" aria-label="Ecrã inteiro" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>
        </button>
        <button class="sg-fechar" id="sg-fechar" type="button" aria-label="Fechar a sinalizadora">×</button>
      </div>
    </div>
    <div class="sg-palco" id="sg-palco">
      <div class="sg-viewbar" id="sg-viewbar" role="toolbar" aria-label="Controlo de visualização 3D">
        <button class="sg-vb-btn" id="sg-vb-esq" type="button" title="Girar à esquerda (Q)" aria-label="Girar o modelo para a esquerda">↺</button>
        <button class="sg-vb-btn" id="sg-vb-reset" type="button" title="Redefinir vista (0)" aria-label="Redefinir ângulo e zoom da câmara">⊙</button>
        <button class="sg-vb-btn" id="sg-vb-dir" type="button" title="Girar à direita (E)" aria-label="Girar o modelo para a direita">↻</button>
        <span class="sg-vb-sep" aria-hidden="true"></span>
        <button class="sg-vb-btn" id="sg-vb-mais" type="button" title="Aproximar (+)" aria-label="Aproximar a câmara">+</button>
        <button class="sg-vb-btn" id="sg-vb-menos" type="button" title="Afastar (-)" aria-label="Afastar a câmara">−</button>
      </div>
      <p class="sg-espera">A preparar a sinalizadora…</p>
      <p class="sg-transcricao" id="sg-transcricao" aria-live="polite" hidden></p>
      <div class="sg-palco-baixo">
        <div class="sg-chips" id="sg-chips" aria-label="Glosa"></div>
        <div class="sg-acoes">
          <button class="sg-mic" id="sg-mic" type="button" aria-pressed="false" hidden>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>
            <span id="sg-mic-txt">Microfone</span>
          </button>
          <button class="bt icone" id="sg-play" type="button" aria-label="Reproduzir">▶</button>
          <button class="sg-rep on" id="sg-rep" type="button" aria-pressed="true">Repetir</button>
          <div class="vel" role="group" aria-label="Velocidade">
            <button type="button" class="vel-b" data-sgvel="0.5">0,5×</button>
            <button type="button" class="vel-b on" data-sgvel="1">1×</button>
            <button type="button" class="vel-b" data-sgvel="1.5">1,5×</button>
          </div>
        </div>
      </div>
    </div>
    <div class="sg-rodape">
      <p class="sg-frase" id="sg-frase"></p>
      <p class="sg-nota sg-nota-vivo" id="sg-nota-vivo" hidden>Transcrição do Chrome (servidores Google) · a frase segue para o modelo · nada fica guardado.</p>
    </div>`;
  document.body.append(painel);

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
    /* Sem ciclo, a sequência pára no fim. Ligar «Repetir» com a cabeça no fim
       não mudava nada no ecrã: recomeça para a pessoa ver o ciclo a andar. */
    if (SG.repetir && SG.total && SG.t >= SG.total - 0.05) {
      SG.t = 0;
      SG.beat = -1;
      desenharSigner(0);
      if (!SG.tocando) tocarSigner();
    }
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
  $('#sg-mic').addEventListener('click', () => {
    if (AO_VIVO.ligado()) pararAoVivo();
    else ligarAoVivo();
  });

  /* Controlo de câmara 3D (botões da barra e atalhos de teclado) */
  const vbEsq = $('#sg-vb-esq');
  const vbReset = $('#sg-vb-reset');
  const vbDir = $('#sg-vb-dir');
  const vbMais = $('#sg-vb-mais');
  const vbMenos = $('#sg-vb-menos');
  if (vbEsq) vbEsq.addEventListener('click', () => window.AVATAR?.girar?.(-1));
  if (vbDir) vbDir.addEventListener('click', () => window.AVATAR?.girar?.(1));
  if (vbReset) vbReset.addEventListener('click', () => window.AVATAR?.redefinirCamera?.());
  if (vbMais) vbMais.addEventListener('click', () => window.AVATAR?.zoom?.(1 / 1.25));
  if (vbMenos) vbMenos.addEventListener('click', () => window.AVATAR?.zoom?.(1.25));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && SG.aberto && !document.fullscreenElement) {
      fecharSigner();
      return;
    }
    if (!SG.aberto || e.ctrlKey || e.metaKey || e.altKey) return;
    const foco = document.activeElement ? document.activeElement.tagName : '';
    if (foco === 'INPUT' || foco === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    if (e.code === 'KeyQ' || e.key === '[') {
      e.preventDefault();
      window.AVATAR?.girar?.(-1);
    } else if (e.code === 'KeyE' || e.key === ']') {
      e.preventDefault();
      window.AVATAR?.girar?.(1);
    } else if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
      e.preventDefault();
      window.AVATAR?.zoom?.(1 / 1.25);
    } else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
      e.preventDefault();
      window.AVATAR?.zoom?.(1.25);
    } else if (e.key === '0' || e.code === 'Numpad0') {
      e.preventDefault();
      window.AVATAR?.redefinirCamera?.();
    }
  });
}

async function abrirSigner(texto) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim() || SG_FRASE;
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

function esperaPalco(msg) {
  const p = $('#sg-palco');
  if (!p) return;
  let e = p.querySelector('.sg-espera');
  if (!e) {
    e = document.createElement('p');
    e.className = 'sg-espera';
    p.prepend(e);
  }
  e.textContent = msg;
}

async function abrirSignerBeats(t, beats, opcoes) {
  const o = opcoes || {};
  if (!document.getElementById('sg-painel')) montarSigner();
  if (!SG.aberto) SG.origem = document.activeElement;
  SG.texto = t;
  SG.aberto = true;
  SG.vivo = !!o.vivo;
  if (!o.vivo && window.AO_VIVO && AO_VIVO.ligado()) pararAoVivo();
  SG.beats = beats.slice();
  SG.passos = [];
  SG.poses = null;
  SG.inicio = [];
  SG.total = 0;
  SG.t = 0;
  SG.beat = -1;
  SG.pronto = false;
  $('#sg-painel').hidden = false;
  $('#sg-frase').textContent = o.vivo ? 'Ao vivo · a ouvir' : '«' + t + '»' + (o.aproximado ? ' · aproximação à aula' : '');
  $('#sg-nota-vivo').hidden = !o.vivo;
  $('#sg-mic').hidden = !o.vivo;
  const transcricao = $('#sg-transcricao');
  if (transcricao) { transcricao.hidden = true; transcricao.textContent = ''; }
  pintarChipsSigner();
  $('#sg-fechar').focus({ preventScroll: true });

  const palco = $('#sg-palco');
  if (!(window.AVATAR && window.SINAL3D)) {
    esperaPalco('O modelo 3D não carregou.');
    return;
  }
  if (!SG.beats.length && !o.vivo) {
    esperaPalco('Sem sinais para esta frase. Escreve outra.');
    return;
  }
  try {
    await AVATAR.init(palco, { progresso: espera3d });
    /* fechado enquanto o modelo carregava: o canvas volta para a casa */
    if (!SG.aberto) { devolverAvatar(); return; }
    AVATAR.retomar();
    const espera = palco.querySelector('.sg-espera');
    if (espera) espera.remove();
    /* painel de 100dvh: enquadra dos joelhos ao alto dos braços */
    AVATAR.enquadrar('joelhos', 1.0);
    montarTimeline();
    SG.pronto = true;
    if (!SG.poses.length) { AVATAR.pousar(); return; }
    if (A11Y.movimento || matchMedia('(prefers-reduced-motion: reduce)').matches) desenharSigner(0);
    else tocarSigner();
  } catch (err) {
    esperaPalco('O modelo 3D não carregou.');
  }
}

/* Os beats viram passos e poses. Feito à parte para a fila do modo ao vivo
   poder crescer sem reabrir o painel. */
function montarTimeline() {
  SG.passos = SG.beats.length ? SINAL3D.sequencia(SG.beats) : [];
  SG.inicio = [];
  let acc = 0;
  SG.passos.forEach((p) => {
    if (SG.inicio[p.beat] === undefined) SG.inicio[p.beat] = acc;
    acc += p.dur;
  });
  SG.total = acc;
  SG.poses = SG.passos.length ? AVATAR.prepararPoses(SG.passos) : [];
}

function devolverAvatar() {
  if (!(window.AVATAR && AVATAR.pronto)) return;
  AVATAR.pousar();
  AVATAR.init(casaSigner());
  AVATAR.suspender();
}

function fecharSigner(silencioso) {
  const painel = document.getElementById('sg-painel');
  if (!painel || painel.hidden) return;
  if (document.fullscreenElement === painel) document.exitFullscreen().catch(() => {});
  painel.classList.remove('cheio');
  marcarCheio();
  painel.hidden = true;
  SG.aberto = false;
  SG.vivo = false;
  SG.pronto = false;
  SG.tocando = false;
  cancelAnimationFrame(SG.raf);
  SG.t = 0;
  SG.beat = -1;
  if (window.AO_VIVO && AO_VIVO.ligado()) pararAoVivo();
  const play = $('#sg-play');
  if (play) { play.textContent = '▶'; play.setAttribute('aria-label', 'Reproduzir'); }
  devolverAvatar();
  const origem = SG.origem;
  SG.origem = null;
  if (!silencioso && origem && origem.isConnected && origem.focus) origem.focus({ preventScroll: true });
}

/* ---------------- modo ao vivo ---------------- */
/* A fila é uma promessa encadeada: duas frases seguidas nunca chegam ao painel
   fora de ordem, mesmo que a segunda resposta seja mais rápida. */
const VIVO = { fila: Promise.resolve(), simples: false, fechada: '' };

/* ---------------- indicador de voz: horizonte ---------------- */
const HORIZONTE = (() => {
  let montado = false;
  let ativo = false;
  let estado = 'listening';
  let cur = 0;
  let escrito = -1;
  let rafId = null;
  let vozAtivaAte = 0;
  let gate = 0;
  let gateAte = 0;

  function montar() {
    if (montado) return;
    const hexWrap = $('#vgHexes');
    if (hexWrap && !hexWrap.children.length) {
      const HEX_COUNT = 40;
      const hexSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,2 20.66,7 20.66,17 12,22 3.34,17 3.34,7"/></svg>';
      for (let i = 0; i < HEX_COUNT; i++) {
        const r = (n) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
        const v = ((i + r(1)) / HEX_COUNT) * 2 - 1;
        const x = 50 + 44 * Math.sign(v) * Math.pow(Math.abs(v), 1.35);
        const h = document.createElement('i');
        h.className = 'vg-hex';
        h.innerHTML = hexSvg;
        h.style.setProperty('--x', x.toFixed(1) + '%');
        h.style.setProperty('--y', (r(2) * 20).toFixed(0) + 'px');
        h.style.setProperty('--s', (5 + r(3) * 4).toFixed(1) + 'px');
        h.style.setProperty('--dx', ((r(4) - 0.5) * 30).toFixed(0) + 'px');
        h.style.setProperty('--dy', (-(16 + r(5) * 52)).toFixed(0) + 'px');
        h.style.setProperty('--rot', ((r(6) - 0.5) * 90).toFixed(0) + 'deg');
        h.style.setProperty('--d', (10 + r(7) * 8).toFixed(1) + 's');
        h.style.setProperty('--dl', '-' + (r(8) * 18).toFixed(1) + 's');
        h.style.setProperty('--po', (0.3 + r(9) * 0.3).toFixed(2));
        hexWrap.appendChild(h);
      }
    }
    montado = true;
  }

  function simular(t) {
    if (estado === 'listening') {
      const vozReal = performance.now() < vozAtivaAte;
      if (vozReal) {
        const ond = 0.6 + 0.4 * Math.sin(t / 140);
        return 0.75 * ond;
      }
      if (t > gateAte) {
        gate = Math.random() < 0.6 ? 1 : 0;
        gateAte = t + (gate ? 700 + Math.random() * 1800 : 500 + Math.random() * 1400);
      }
      const syl = 0.5 + 0.5 * Math.sin(t / 260) * Math.sin(t / 420 + 1);
      return gate * (0.25 + 0.6 * syl * (0.6 + 0.4 * Math.sin(t / 900)));
    }
    if (estado === 'speaking') {
      const syl = 0.5 + 0.5 * Math.sin(t / 240 + Math.sin(t / 700) * 2);
      const phrase = 0.55 + 0.45 * Math.sin(t / 1300);
      return 0.2 + 0.55 * syl * phrase;
    }
    return 0;
  }

  function loop(t) {
    if (!ativo) { rafId = null; return; }
    const vg = $('#vg');
    if (vg && !document.hidden) {
      const target = simular(t);
      cur += (target - cur) * (target > cur ? 0.2 : 0.05);
      if (Math.abs(cur - escrito) > 0.004) {
        vg.style.setProperty('--level', cur.toFixed(3));
        escrito = cur;
      }
    }
    rafId = requestAnimationFrame(loop);
  }

  return {
    ligar() {
      montar();
      ativo = true;
      const vg = $('#vg');
      if (vg) {
        vg.classList.add('is-on');
        vg.dataset.state = estado;
      }
      if (!rafId) rafId = requestAnimationFrame(loop);
    },
    desligar() {
      ativo = false;
      const vg = $('#vg');
      if (vg) vg.classList.remove('is-on');
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },
    setState(s) {
      estado = s;
      const vg = $('#vg');
      if (vg) vg.dataset.state = s;
    },
    notarVoz() {
      vozAtivaAte = performance.now() + 600;
    },
  };
})();

/* A cinta azul ou o horizonte acendem enquanto o microfone ouve. */
const BRILHO = {
  sincronizar() {
    const ligado = !!(window.AO_VIVO && AO_VIVO.ligado());
    const modo = A11Y.brilhoAoVivo || 'horizonte';
    const htmlEl = document.documentElement;
    htmlEl.classList.toggle('vivo-ligado', ligado && modo === 'fita');
    htmlEl.classList.toggle('horizonte-ligado', ligado && modo === 'horizonte');
    if (ligado && modo === 'horizonte') {
      HORIZONTE.ligar();
    } else {
      HORIZONTE.desligar();
    }
  },
};
BRILHO.sincronizar();

function mostrarTranscricao(provisorio, fechada) {
  const caixa = $('#sg-transcricao');
  if (!caixa) return;
  const texto = [fechada, provisorio].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  caixa.hidden = !texto;
  caixa.textContent = texto.length > 170 ? '…' + texto.slice(-170) : texto;
  caixa.classList.toggle('provisoria', !!provisorio);
}

function marcarModoSimples() {
  VIVO.simples = true;
  const m = $('#sg-modo');
  if (m) m.hidden = false;
}

async function pedirSinais(frase) {
  const r = await fetch('api/sinais', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ frase }),
  });
  if (!r.ok) throw new Error('http ' + r.status);
  const d = await r.json();
  return Array.isArray(d && d.sinais) ? d.sinais : null;
}

function beatsDePalavras(palavras) {
  const beats = [];
  palavras.forEach((p) => {
    const n = sinalNotacao(String(p).toLowerCase().trim());
    if (!n) return;
    beats.push({
      tipo: 'sinal', rotulo: p, forma: n.forma, duas: n.duas, reps: n.reps, local: n.local,
      pos0: n.inicio.pos, rot0: n.inicio.rot, pos1: n.fim.pos, rot1: n.fim.rot, dur: 760,
      palma: n.palma, esq: n.esq, amp: n.amp, movimento: n.movimento,
    });
  });
  return beats;
}

function anexarAoPalco(beats) {
  if (!beats || !beats.length || !SG.aberto) return;
  SG.beats = SG.beats.concat(beats, pausa());
  pintarChipsSigner();
  if (!SG.pronto) return; /* o init usa SG.beats quando o modelo ficar pronto */
  const t = SG.t;
  montarTimeline();
  SG.t = Math.min(t, Math.max(0, SG.total - 1));
  SG.beat = -1;
  desenharSigner(SG.t);
  if (!SG.tocando) tocarSigner();
}

function enfileirarFrase(frase) {
  VIVO.fila = VIVO.fila.then(async () => {
    if (!SG.aberto || !SG.vivo) return;
    let palavras = null;
    try { palavras = await pedirSinais(frase); } catch (e) { palavras = null; }
    if (!SG.aberto || !SG.vivo) return;
    let beats;
    if (palavras) {
      beats = beatsDePalavras(palavras);
    } else {
      /* sem função (Pages), sem rede ou sem chave: o motor de regras segura a
         glosa e o painel diz que está no modo simples */
      marcarModoSimples();
      beats = analisarEmBeats(frase).beats;
    }
    anexarAoPalco(beats);
  });
}

function ligarAoVivo() {
  if (!window.AO_VIVO) return;
  SG.repetir = false;
  const rep = $('#sg-rep');
  if (rep) { rep.classList.remove('on'); rep.setAttribute('aria-pressed', 'false'); }
  const ok = AO_VIVO.iniciar({
    aoProvisorio: (txt) => {
      HORIZONTE.notarVoz();
      mostrarTranscricao(txt, VIVO.fechada);
    },
    aoFrase: (frase) => {
      HORIZONTE.setState('thinking');
      VIVO.fechada = (VIVO.fechada + ' ' + frase).replace(/\s+/g, ' ').trim().slice(-170);
      mostrarTranscricao('', VIVO.fechada);
      enfileirarFrase(frase);
    },
    aoErro: (erro, fatal) => {
      BRILHO.sincronizar();
      if (erro === 'not-allowed' || erro === 'service-not-allowed') {
        mostrarTranscricao('Permissão do microfone recusada.', '');
        return;
      }
      if (erro === 'audio-capture') {
        mostrarTranscricao('Não encontrei um microfone.', '');
        return;
      }
      if (fatal) mostrarTranscricao('O reconhecimento de fala parou.', '');
    },
  });
  const botao = $('#sg-mic');
  const ligado = !!(ok && AO_VIVO.ligado());
  if (botao) {
    botao.classList.toggle('on', ligado);
    botao.setAttribute('aria-pressed', String(ligado));
  }
  const rotulo = $('#sg-mic-txt');
  if (rotulo) rotulo.textContent = ligado ? 'A ouvir' : 'Microfone';
  HORIZONTE.setState(ligado ? 'listening' : 'muted');
  BRILHO.sincronizar();
}

function pararAoVivo() {
  if (window.AO_VIVO) AO_VIVO.parar();
  HORIZONTE.setState('muted');
  BRILHO.sincronizar();
  const botao = $('#sg-mic');
  if (botao) { botao.classList.remove('on'); botao.setAttribute('aria-pressed', 'false'); }
  const rotulo = $('#sg-mic-txt');
  if (rotulo) rotulo.textContent = 'Microfone';
}

function abrirAoVivo() {
  VIVO.fechada = '';
  VIVO.simples = false;
  const modo = $('#sg-modo');
  if (modo) modo.hidden = true;
  abrirSignerBeats('', [], { vivo: true });
  if (!window.AO_VIVO || !AO_VIVO.suportado()) {
    mostrarTranscricao('Este navegador não reconhece fala. Usa o cartão Texto.', '');
    return;
  }
  ligarAoVivo();
}

/* Uma palavra soletrada dá um beat por letra para o corpo, mas no ecrã é uma
   palavra só: a glosa agrupa letras seguidas da mesma palavra num único chip. */
function glosaSigner() {
  const out = [];
  SG.beats.forEach((b, i) => {
    if (!b.rotulo || b.tipo === 'pausa' || b.chip === false) return;
    const ult = out[out.length - 1];
    if (b.tipo === 'letra') {
      if (ult && ult.tipo === 'letra' && ult.grupo === b.grupo && ult.fim === i - 1) {
        ult.fim = i;
        return;
      }
      out.push({ tipo: 'letra', grupo: b.grupo, rotulo: b.grupo || b.rotulo, ini: i, fim: i });
      return;
    }
    out.push({ tipo: b.tipo, rotulo: b.rotulo, ini: i, fim: i });
  });
  return out;
}

function pintarChipsSigner() {
  const caixa = $('#sg-chips');
  if (!caixa) return;
  caixa.innerHTML = glosaSigner().map(c =>
    `<button type="button" class="sg-chip${c.tipo === 'letra' ? ' sg-letra' : ''}" data-beat="${c.ini}" data-fim="${c.fim}">${esc(c.rotulo)}</button>`
  ).join('');
  SG.beat = -1;
  caixa.scrollLeft = 0;
}

function marcarChipsSigner() {
  const caixa = $('#sg-chips');
  if (!caixa) return;
  let ativo = null;
  $$('[data-beat]', caixa).forEach((el) => {
    const on = SG.beat >= Number(el.dataset.beat) && SG.beat <= Number(el.dataset.fim || el.dataset.beat);
    el.classList.toggle('on', on);
    el.setAttribute('aria-current', on ? 'true' : 'false');
    if (on) ativo = el;
  });
  if (!ativo) return;
  /* a fila desliza sozinha para a palavra que está a ser sinalizada */
  const alvo = ativo.offsetLeft - (caixa.clientWidth - ativo.offsetWidth) / 2;
  const max = caixa.scrollWidth - caixa.clientWidth;
  caixa.scrollLeft = Math.max(0, Math.min(max, alvo));
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
  if (SG.vivo && typeof HORIZONTE !== 'undefined') HORIZONTE.setState('speaking');
  const play = $('#sg-play');
  if (play) { play.textContent = '❚❚'; play.setAttribute('aria-label', 'Pausa'); }
  cancelAnimationFrame(SG.raf);
  SG.raf = requestAnimationFrame(passoSigner);
}

function pausarSigner() {
  SG.tocando = false;
  cancelAnimationFrame(SG.raf);
  if (SG.vivo && typeof HORIZONTE !== 'undefined') {
    HORIZONTE.setState(window.AO_VIVO && AO_VIVO.ligado() ? 'listening' : 'muted');
  }
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
      if (SG.vivo && typeof HORIZONTE !== 'undefined') {
        HORIZONTE.setState(window.AO_VIVO && AO_VIVO.ligado() ? 'listening' : 'muted');
      }
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
   serve o tema claro, o escuro e o contraste alto sem cores cravadas. Só
   objectos — mão desenhada a partir de rectângulos lia-se como luva. */
const ARTE = {
  /* O editor com a linha que está a ser sinalizada e o selo do texto. */
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
      <circle cx="256" cy="102" r="37" fill="currentColor" fill-opacity=".12"/>
      <circle cx="256" cy="102" r="37" stroke="currentColor" stroke-opacity=".45" stroke-width="2.5"/>
      <text x="256" y="114" text-anchor="middle" fill="currentColor" style="font:900 30px/1 var(--display);letter-spacing:-.5px">Aa</text>
    </svg>`,
  /* O microfone, as ondas e a legenda que fecha a frase. */
  aoVivo: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <g transform="translate(72 34)">
        <rect x="-16" y="0" width="32" height="62" rx="16" fill="currentColor" fill-opacity=".9"/>
        <rect x="-8" y="10" width="16" height="42" rx="8" fill="var(--surface)" fill-opacity=".55"/>
        <path d="M-30 40v6a30 30 0 0 0 60 0v-6" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
        <path d="M0 76v18" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
        <path d="M-22 100h44" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-opacity=".6"/>
      </g>
      <g stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-opacity=".5">
        <path d="M130 74h10M134 90h8M130 106h10"/>
        <path d="M152 62h16M156 78h20M152 94h16M156 110h20"/>
      </g>
      <g transform="translate(196 50)">
        <rect width="104" height="86" rx="14" fill="currentColor" fill-opacity=".12"/>
        <rect width="104" height="86" rx="14" stroke="currentColor" stroke-opacity=".5" stroke-width="2.5"/>
        <circle cx="88" cy="18" r="4.5" fill="currentColor"/>
        <rect x="14" y="32" width="76" height="9" rx="4.5" fill="currentColor" fill-opacity=".9"/>
        <rect x="14" y="50" width="58" height="9" rx="4.5" fill="currentColor" fill-opacity=".55"/>
        <rect x="14" y="68" width="40" height="9" rx="4.5" fill="currentColor" fill-opacity=".3"/>
      </g>
    </svg>`,
  /* O livro aberto do léxico e a lupa. */
  dicionario: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <path d="M160 52 56 62v82l104 12 104-12V62z" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M158 44 60 54v80l98 10z" fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M162 44l98 10v80l-98 10z" fill="currentColor" fill-opacity=".28" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M160 44v100" stroke="currentColor" stroke-opacity=".7" stroke-width="2.5"/>
      <g stroke="currentColor" stroke-linecap="round" stroke-width="6">
        <path d="M74 72h64M74 88h52M74 104h58" stroke-opacity=".5"/>
        <path d="M182 72h64M182 88h52M182 104h58" stroke-opacity=".62"/>
      </g>
      <path d="M226 50V30h13v20l-6.5-6z" fill="currentColor" fill-opacity=".85"/>
      <g transform="translate(248 120)">
        <circle r="26" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".9" stroke-width="3.5"/>
        <path d="M19 19l16 16" stroke="currentColor" stroke-opacity=".9" stroke-width="7" stroke-linecap="round"/>
      </g>
    </svg>`,
  /* LGA em destaque, envolvida por uma fita inspirada na bandeira angolana. */
  fonteLga: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="lga-ribbon-red" x1="25" y1="28" x2="290" y2="126" gradientUnits="userSpaceOnUse">
          <stop stop-color="#E22B43"/><stop offset=".58" stop-color="#CD022B"/><stop offset="1" stop-color="#A90025"/>
        </linearGradient>
        <linearGradient id="lga-ribbon-black" x1="22" y1="72" x2="300" y2="166" gradientUnits="userSpaceOnUse">
          <stop stop-color="#303039"/><stop offset=".52" stop-color="#111116"/><stop offset="1" stop-color="#292830"/>
        </linearGradient>
        <filter id="lga-soft-shadow" x="8" y="4" width="306" height="178" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
      </defs>
      <circle cx="160" cy="94" r="76" fill="#FFFFFF" fill-opacity=".22"/>
      <path d="M15 110C46 34 111 22 173 46c55 22 88 17 132-20l7 19c-42 43-89 52-148 28C107 48 51 62 26 133z" fill="#111116" opacity=".13" filter="url(#lga-soft-shadow)"/>
      <!-- A fita passa por trás das letras e regressa pela frente, como tecido enrolado. -->
      <path d="M14 105C45 32 111 20 173 45c56 22 88 17 132-20l7 19c-42 43-89 52-148 28C107 48 51 62 26 133z" fill="url(#lga-ribbon-red)"/>
      <path d="M18 120C49 47 114 35 177 60c55 22 87 17 132-20l4 19c-42 43-90 52-148 28C110 63 55 77 30 148z" fill="url(#lga-ribbon-black)"/>
      <path d="M26 132c39-34 78-38 123-17 48 22 91 26 143-11l9 16c-55 40-110 39-160 16-39-18-73-15-108 12z" fill="url(#lga-ribbon-red)"/>
      <path d="M30 148c38-27 69-30 105-14 52 23 105 24 157-13l8 15c-55 39-112 39-169 15-32-14-60-11-91 12z" fill="url(#lga-ribbon-black)"/>
      <!-- Reflexos discretos dão volume à fita sem alterar a leitura das cores nacionais. -->
      <path d="M26 97C58 43 111 35 165 55" stroke="#FF9AA7" stroke-opacity=".55" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M44 142c30-17 57-16 83-5" stroke="#FFFFFF" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>
      <!-- Letras em primeiro plano: a sigla é a protagonista do cartão. -->
      <text x="160" y="116" text-anchor="middle" fill="#17263A" stroke="#FFF9EF" stroke-width="8" stroke-linejoin="round" paint-order="stroke" font-family="Arial, Helvetica, sans-serif" font-size="63" font-weight="900" letter-spacing="-3">LGA</text>
      <text x="160" y="116" text-anchor="middle" fill="currentColor" font-family="Arial, Helvetica, sans-serif" font-size="63" font-weight="900" letter-spacing="-3">LGA</text>
      <!-- Emblema dourado reduzido como selo na ponta da fita. -->
      <g transform="translate(258 77)" fill="#FFCC00">
        <!-- Roda dentada: secção em C com nove dentes radiais distintos. -->
        <path fill-rule="evenodd" d="M-13.1-13.1A18.5 18.5 0 0 1 13.1-13.1L9.2-9.2A13 13 0 0 0-9.2-9.2Z"/>
        <g>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(-135)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(-101.25)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(-67.5)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(-33.75)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(0)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(33.75)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(67.5)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(101.25)"/>
          <path d="M-2.5-25h5v7h-5z" transform="rotate(135)"/>
        </g>
        <!-- Estrela de cinco pontas, com proporções geométricas mais fiéis. -->
        <path d="M-7-24-2.7-12.8 9.2-12.5-.4-5.2 3.1 6.2-7-1-17.1 6.2-13.6-5.2-23.2-12.5-11.3-12.8Z"/>
        <!-- Catana: lâmina curva voltada à esquerda e punho à direita. -->
        <path d="M-20-7C-22-1-18 6-11 11L13 29l7-8L-2 1C-9-5-12-12-9-19-14-17-18-13-20-7Z"/>
        <path d="m13 23 5-7 5 4-5 8z"/>
        <path d="m19 22 4-5 8 7c4 3 5 7 2 10-3 3-7 2-10-1l-7-7z"/>
        <path d="M-13 2 16 23" fill="none" stroke="#A87500" stroke-width="1.2" stroke-linecap="round"/>
        <circle cx="25" cy="27" r="1.15" fill="#A87500"/>
        <circle cx="28" cy="30" r="1.15" fill="#A87500"/>
      </g>
      <path d="M16 164c43-14 78-9 111 3" stroke="#FFCC00" stroke-opacity=".8" stroke-width="3" stroke-linecap="round"/>
      <circle cx="20" cy="164" r="3" fill="#FFCC00"/>
    </svg>`,
  /* Cartão da fonte IS: o globo do léxico e o play. */
  fonteIs: `<svg viewBox="0 0 320 186" fill="none" aria-hidden="true">
      <circle cx="150" cy="93" r="58" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".8" stroke-width="3.5"/>
      <ellipse cx="150" cy="93" rx="26" ry="58" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5"/>
      <path d="M122 44c14 30 14 68 0 98M178 44c-14 30-14 68 0 98" stroke="currentColor" stroke-opacity=".42" stroke-width="2.5"/>
      <path d="M92 93h116" stroke="currentColor" stroke-opacity=".55" stroke-width="2.5"/>
      <path d="M101 63h98M101 123h98" stroke="currentColor" stroke-opacity=".4" stroke-width="2.5"/>
      <circle cx="208" cy="134" r="27" fill="currentColor"/>
      <path d="M200 121l20 13-20 13z" fill="var(--surface)"/>
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
      <div class="rodape-creditos">
        <p class="creditos-marcas">
          <span class="credito-marca">
            <img src="assets/logo-mark.png" alt="" width="18" height="18">
            <span>Viva Surdo</span>
          </span>
          <span class="credito-e" aria-hidden="true">+</span>
          <span class="credito-marca credito-hf" tabindex="0" aria-describedby="credito-nif">
            <span class="credito-sigla" aria-hidden="true">HF</span>
            <span>Horizonte Futuro</span>
            <span class="credito-nif" id="credito-nif" role="tooltip">NIF 5002540410</span>
          </span>
        </p>
        <p class="creditos-txt">Aplicação criada pela <b>Horizonte Futuro</b> em parceria com a <b>Viva Surdo</b>.</p>
        <p class="creditos-dir">Todos os direitos reservados 2026.</p>
      </div>
    </footer>`;
}

/* ---------------- vista: sinalizar ---------------- */
function vistaSinalizar() {
  return `
  <section class="entrada">
    <p class="kicker">Protótipo · Viva Surdo</p>
    <h1>Texto em,<br><em>sinais</em> out.</h1>
    <p class="sub">Escreve, carrega um ficheiro ou fala: a ${SINALIZADOR.nome} acompanha em gestos de estudo, gesto a gesto.</p>
  </section>

  <section class="modo-grid" aria-label="Começar">
    <button class="modo-card texto" type="button" data-modo="texto">
      <span class="mode-art">${ARTE.texto}</span>
      <span class="mode-copy">
        <span class="mode-name">Texto</span>
        <span class="mode-sub">Uma caixa de texto, ou um ficheiro .txt, .srt, .vtt ou PDF.</span>
        <span class="mode-foot">
          <span class="mode-cta">Abrir a caixa de texto</span>
          <span class="mode-go" aria-hidden="true">↗</span>
        </span>
      </span>
    </button>
    <button class="modo-card ao-vivo" type="button" data-modo="ao-vivo">
      <span class="mode-art">${ARTE.aoVivo}</span>
      <span class="mode-copy">
        <span class="mode-name">Traduzir ao vivo</span>
        <span class="mode-sub">Fala em português: a transcrição escolhe os sinais do léxico.</span>
        <span class="mode-foot">
          <span class="mode-cta">Ligar o microfone</span>
          <span class="mode-go" aria-hidden="true">●</span>
        </span>
      </span>
    </button>
    <a class="modo-card dicionario" href="#/dicionario">
      <span class="mode-art">${ARTE.dicionario}</span>
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

  <details class="nota">
    <summary>O que esta glosa não é</summary>
    <p>Não é tradução para LGA. Uma glosa é uma sequência de sinais: artigos e preposições caem, o tempo vai à frente e o «não» vai ao fim — mas a ordem, o espaço e a expressão facial de um sinalizador surdo não cabem numa lista de palavras.</p>
  </details>

  <dialog class="caixa" id="caixa-texto" aria-labelledby="caixa-titulo">
    <div class="caixa-topo">
      <p class="caixa-titulo" id="caixa-titulo">Texto para sinalizar</p>
      <button class="sg-fechar" id="caixa-x" type="button" aria-label="Fechar">×</button>
    </div>
    <div class="caixa-abas" role="tablist" aria-label="Como carregar o texto">
      <button class="caixa-aba on" id="aba-escrever" type="button" role="tab" aria-selected="true" aria-controls="pano-escrever">Escrever</button>
      <button class="caixa-aba" id="aba-carregar" type="button" role="tab" aria-selected="false" aria-controls="pano-carregar" tabindex="-1">Carregar ficheiro</button>
    </div>
    <div class="caixa-pano" id="pano-escrever" role="tabpanel" aria-labelledby="aba-escrever">
      <label class="sr-only" for="txt">Texto para sinalizar</label>
      <textarea id="txt" rows="6" placeholder="Escreve ou cola aqui…" spellcheck="false"></textarea>
      <div class="caixa-pe">
        <span class="conta" id="editor-conta">0 palavras</span>
        <div class="acoes">
          <button class="bt" id="bt-exemplo" type="button">Exemplo</button>
          <button class="bt primario" id="bt-ver" type="button">Ver sinais</button>
        </div>
      </div>
      <p class="dica">Ctrl + Enter também abre a sinalizadora.</p>
    </div>
    <div class="caixa-pano" id="pano-carregar" role="tabpanel" aria-labelledby="aba-carregar" hidden>
      <button class="caixa-solta" id="bt-fich" type="button">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
        <b>Escolher um ficheiro</b>
        <span>.txt · .srt · .vtt · .pdf</span>
      </button>
      <input id="fich" type="file" accept=".txt,.srt,.vtt,.pdf,text/plain,application/pdf" hidden>
      <p class="dica">Um PDF precisa de texto selecionável; digitalizações não têm texto para ler.</p>
    </div>
    <p class="recado" id="recado" role="status" hidden></p>
  </dialog>`;
}

/* O GLB tem 13 MB: numa ligação lenta a espera passa dos quatro minutos.
   Uma percentagem prova que está a andar, em vez de parecer pendurado. O
   Vercel serve o ficheiro com Brotli e sem Content-Length, por isso aí o
   total é 0 e a espera conta os MB que já chegaram. */
function espera3d(carregados, total) {
  const quanto = total
    ? Math.max(1, Math.round((carregados / total) * 100)) + '%'
    : (carregados / 1048576).toFixed(1).replace('.', ',') + ' MB';
  const txt = 'A preparar a sinalizadora… ' + quanto;
  document.querySelectorAll('.palco-espera, .sg-espera').forEach((e) => {
    if (/^A preparar/.test(e.textContent)) e.textContent = txt;
  });
}

function ligarSinalizar(params) {
  /* O GLB e o renderizador só são preparados quando a pessoa abre a
     sinalizadora: a página inicial não precisa de criar o palco 3D. */
  const caixa = $('#caixa-texto');
  const txt = $('#txt'), recado = $('#recado'), conta = $('#editor-conta');
  const fich = $('#fich');
  const aviso = (m) => { if (!recado) return; recado.hidden = !m; recado.textContent = m || ''; };

  const contar = (v) => {
    if (!conta) return;
    const t = String(v).trim();
    const n = t ? t.split(/\s+/).length : 0;
    conta.textContent = n === 1 ? '1 palavra' : n + ' palavras';
  };

  const abas = [$('#aba-escrever'), $('#aba-carregar')].filter(Boolean);
  const panos = { escrever: $('#pano-escrever'), carregar: $('#pano-carregar') };
  function abrirAba(nome) {
    abas.forEach((b) => {
      const on = b.id === 'aba-' + nome;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    Object.entries(panos).forEach(([k, p]) => { if (p) p.hidden = k !== nome; });
  }
  abas.forEach((b, i) => {
    b.addEventListener('click', () => {
      const nome = i === 0 ? 'escrever' : 'carregar';
      abrirAba(nome);
      const alvo = nome === 'escrever' ? txt : $('#bt-fich');
      if (alvo) alvo.focus({ preventScroll: true });
    });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const outro = abas[(i + 1) % abas.length];
      outro.focus();
      outro.click();
    });
  });

  function abrirCaixa() {
    aviso('');
    abrirAba('escrever');
    if (!caixa.open) caixa.showModal();
    contar(txt.value);
    txt.focus({ preventScroll: true });
    const fim = txt.value.length;
    txt.setSelectionRange(fim, fim);
  }
  const fecharCaixa = () => { if (caixa.open) caixa.close(); };

  $('#caixa-x').addEventListener('click', fecharCaixa);
  caixa.addEventListener('close', () => aviso(''));
  /* clicar no véu fecha; clicar dentro da caixa não */
  caixa.addEventListener('click', (e) => {
    if (e.target !== caixa) return;
    const r = caixa.getBoundingClientRect();
    const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (fora) fecharCaixa();
  });

  $$('.modo-card[data-modo]').forEach((c) => c.addEventListener('click', () => {
    if (c.dataset.modo === 'ao-vivo') abrirAoVivo();
    else abrirCaixa();
  }));

  txt.addEventListener('input', () => { contar(txt.value); aviso(''); });

  const ver = () => {
    const texto = String(txt.value || '').replace(/\s+/g, ' ').trim();
    if (!texto) { aviso('Escreve alguma coisa para ver sinais.'); txt.focus(); return; }
    if (!analisarEmBeats(texto).beats.length) {
      aviso('Nenhuma palavra desta frase tem sinal na glosa. Tenta «Bom dia» ou usa o dicionário.');
      txt.focus();
      return;
    }
    aviso('');
    fecharCaixa();
    abrirSigner(texto);
  };
  $('#bt-ver').addEventListener('click', ver);
  txt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); ver(); }
  });
  $('#bt-exemplo').addEventListener('click', () => {
    txt.value = PM_EXEMPLOS[Math.floor(Math.random() * PM_EXEMPLOS.length)];
    contar(txt.value);
    aviso('');
    txt.focus();
  });

  const lerFicheiro = async (f) => {
    const nome = f.name.toLowerCase();
    aviso('A ler o ficheiro…');
    try {
      let texto;
      if (nome.endsWith('.pdf')) {
        texto = await textoDePDF(await f.arrayBuffer());
        if (!texto) { aviso('Este PDF não tem texto legível — pode ser uma digitalização. Copia o texto e cola aqui.'); return; }
      } else if (nome.endsWith('.srt') || nome.endsWith('.vtt')) {
        const cues = lerLegendas(await f.text());
        texto = cues.map((c) => c.texto).join(' ').replace(/\s+/g, ' ').trim();
        if (!texto) { aviso('Não encontrei legendas com texto neste ficheiro.'); return; }
      } else {
        texto = await f.text();
      }
      abrirAba('escrever');
      txt.value = texto.trim();
      contar(txt.value);
      aviso('');
      txt.focus({ preventScroll: true });
    } catch (err) {
      aviso('Não consegui ler este ficheiro. Tenta copiar o texto e colar aqui.');
    }
  };
  $('#bt-fich').addEventListener('click', () => fich.click());
  fich.addEventListener('change', () => {
    const f = fich.files && fich.files[0];
    fich.value = '';
    if (f) lerFicheiro(f);
  });

  if (params && params.s) {
    const t = String(params.s).replace(/\s+/g, ' ').trim();
    if (t) abrirSigner(t);
  }
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
    <p class="sub">${META_LGA.aulas} aulas do Mini curso de LGA, lidas fotograma a fotograma a 540×360 no YouTube. ${LGA_NO_DICIONARIO.size} destas palavras já estão no dicionário; ${LGA_COM_POSE === LGA_LISTA.length ? 'todas as ' + LGA_COM_POSE + ' palavras já abrem no palco 3D da Agatha com link para a aula de origem.' : LGA_COM_POSE + ' já abrem no palco 3D da Agatha e as restantes abrem a aula no segundo certo.'} Confiança: ${conta('alta')} alta, ${conta('média')} média, ${conta('baixa')} baixa — as de confiança baixa estão marcadas para revisão humana.</p>
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
    <p class="sub">Sinais documentados no léxico da ${esc(FONTE_IS.nome)} — ${FONTE_IS.total} referências colhidas a ${FONTE_IS.colhido}, cada uma com o vídeo do sinal. ${CONTAS.pose} têm pose no palco 3D — ${CONTAS.soRef} ainda só existem na fonte, ${CONTAS.soPose} são gestos nossos sem correspondência IS. ${CONTAS.comparado} poses já foram comparadas fotograma a fotograma com o vídeo.</p>
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
  esconderSelecao();
  fecharSigner(true);
  app.innerHTML = shell(view(m ? m.params : {}), ativo);
  const live = document.getElementById('route-live');
  if (live) live.textContent = ativo === '/dicionario' ? 'Dicionário' : 'Sinalizar';
  if (ativo === '/dicionario') ligarDicionario();
  else ligarSinalizar(m ? m.params : {});
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
