/* ============================================================================
   Anel — a casa em forma de anel, na linguagem de um estúdio claro.

   A Agatha assina ao centro, em pé sobre uma elipse de nove fichas de sinal.
   Arrastar o anel roda-o; a ficha que chega à frente-esquerda é a escolhida e
   é esse sinal que ela faz. A ficha (recibo) só mostra campos que existem em
   lga.js — palavra, aula, forma, lugar, movimento, confiança, segundos, vídeo.

   Tudo o que é número nesta vista vem do léxico: o índice, o total, a confiança
   e o segundo do vídeo. Nada aqui inventa preços, avaliações ou contagens.
   ============================================================================ */
(function (global) {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const TAU = Math.PI * 2;
  const PASSO = TAU / 9;          /* nove lugares no anel */
  const FRENTE = Math.PI / 9;     /* o lugar da ficha escolhida: 20° à esquerda */

  const ST = {
    ligado: false,
    sel: 0,
    giro: 0,
    arrastando: false,
    x0: 0,
    g0: 0,
    vista: 'anel',
    recibo: -1,
    semMov: false,
    vigia: 0,
    tsel: 0,
  };

  /* ---------------- o léxico que a Agatha sabe fazer ---------------- */
  let LISTA = null;

  function itens() {
    if (LISTA) return LISTA;
    const S = global.SINAIS_LGA || {};
    const L = global.FONTE_LGA || {};
    LISTA = Object.keys(S).map((chave, i) => {
      const p = S[chave];
      const e = L[chave] || null;
      return {
        i,
        chave,
        pose: p,
        entrada: e,
        palavra: e ? e.palavra : chave,
        rotulo: chave === 'oi/ola' ? 'olá' : (e ? e.palavra : chave),
        forma: formaDe(p),
        aula: e ? e.aula : 'LGA',
        aulaCurta: e ? e.aula.replace(/ —.*$/, '') : 'LGA',
        confianca: e ? e.confianca : '',
        segundos: e && e.segundos && e.segundos.length ? e.segundos[0] : null,
        video: e ? e.video : '',
      };
    });
    return LISTA;
  }

  function formaDe(p) {
    if (!p || !p.notacao) return null;
    const bruto = Array.isArray(p.notacao) ? p.notacao[0] : p.notacao;
    const forma = String(bruto).replace(/^2:/, '').trim().split(/\s+/)[0];
    return (global.FORMAS_MAO && global.FORMAS_MAO[forma]) ? forma : null;
  }

  function nota(p) {
    if (!p || !p.notacao) return [];
    return (Array.isArray(p.notacao) ? p.notacao : [p.notacao])
      .map(t => String(t).trim()).filter(Boolean);
  }

  /* befa de um sinal: mesma construção que o painel usa para a LGA */
  function beatsDe(item) {
    const p = item.pose;
    const partes = nota(p);
    const out = [];
    partes.forEach((parte, k) => {
      const n = global.sinalDeNotacao ? global.sinalDeNotacao(parte, {}) : null;
      if (!n) return;
      out.push({
        tipo: 'sinal',
        rotulo: item.rotulo,
        forma: n.forma, duas: n.duas, reps: n.reps, local: n.local,
        pos0: n.inicio.pos, rot0: n.inicio.rot, pos1: n.fim.pos, rot1: n.fim.rot,
        dur: (Array.isArray(p.dur) ? p.dur[k] : p.dur) || 760,
        palma: n.palma, esq: n.esq, amp: n.amp, movimento: n.movimento,
      });
    });
    return out;
  }

  function pausa(dur) {
    return { tipo: 'pausa', rotulo: '', dur: dur || 460 };
  }

  /* O primeiro sinal do anel é a saudação inteira: olá e bom dia, como na
     referência. Os outros são o próprio sinal, com uma pausa para respirar. */
  function sequenciaDe(item) {
    if (!global.SINAL3D) return [];
    const beats = beatsDe(item);
    if (!beats.length) return [];
    if (item.chave === 'oi/ola') {
      const bom = itens().find(x => x.chave === 'bom dia');
      const dois = bom ? beatsDe(bom) : [];
      return global.SINAL3D.sequencia([...beats, pausa(360), ...dois, pausa(420)]);
    }
    return global.SINAL3D.sequencia([...beats, pausa(620)]);
  }

  /* ---------------- a mesa ---------------- */
  function vista() {
    return `
  <section class="rg" aria-labelledby="rg-titulo">
    <div class="rg-mesa" id="rg-mesa" tabindex="0" aria-label="Anel de sinais. Arrasta, ou usa as setas esquerda e direita.">
      <div class="rg-chao" aria-hidden="true"></div>
      <div class="rg-palco" id="rg-palco">
        <p class="rg-espera">A preparar a Agatha… <b id="rg-pct">0%</b></p>
      </div>
      <div class="rg-anel" id="rg-anel" role="group" aria-label="Sinais com pose da Agatha"></div>
      <div class="rg-cromo">
        <button class="rg-indice" id="rg-indice" type="button" aria-expanded="false" aria-controls="rg-gaveta">
          <span>INDEX</span>
        </button>
        <div class="rg-vistas" role="group" aria-label="Vista do anel">
          <button type="button" class="on" data-rg-vista="anel">RING</button>
          <button type="button" data-rg-vista="grade">GRID</button>
        </div>
        <div class="rg-bloco">
          <p class="rg-conta">
            <b id="rg-conta">01</b> <span>/ ${itens().length}</span>
            <button class="rg-replay" id="rg-replay" type="button" aria-label="Repetir este sinal">▶</button>
          </p>
          <h1 class="rg-titulo" id="rg-titulo">OI/OLÁ</h1>
          <p class="rg-meta" id="rg-meta">AULA 01 — SAUDAÇÃO DE LGA</p>
        </div>
        <div class="rg-abrir">
          <span>VER O SINAL</span>
          <button class="rg-mais" id="rg-mais" type="button" aria-label="Abrir a ficha deste sinal" aria-expanded="false" aria-controls="rg-recibo">+</button>
        </div>
        <div class="rg-modos" aria-label="Modos da aplicação">
          <button type="button" class="rg-modo" data-modo="texto">Texto</button>
          <button type="button" class="rg-modo" data-modo="ao-vivo">Ao vivo</button>
          <a class="rg-modo" href="#/dicionario">Dicionário</a>
        </div>
        <div class="rg-recibo" id="rg-recibo" hidden></div>
        <div class="rg-grade" id="rg-grade" hidden></div>
        <div class="rg-gaveta" id="rg-gaveta" hidden></div>
      </div>
    </div>
  </section>
  ${typeof caixaTexto === 'function' ? caixaTexto() : ''}`;
  }

  /* ---------------- fichas ---------------- */
  function cartao(item, extra) {
    const e = item.entrada || {};
    const fig = item.forma ? global.maoFigura(item.forma, true) : '';
    const ap = item.pose && item.pose.aproximado ? ' data-aprox="1"' : '';
    const rot = [
      String(item.i + 1).padStart(2, '0'),
      item.palavra,
      e.aula || '',
      e.confianca ? 'confiança ' + e.confianca : '',
    ].filter(Boolean).join(' · ');
    return `<button class="rg-carta${extra || ''}" type="button" data-i="${item.i}" aria-label="${esc(rot)}">
      <span class="rg-carta-topo"><b>${String(item.i + 1).padStart(2, '0')}</b><span>${esc(item.aulaCurta.toUpperCase())}</span></span>
      <span class="rg-carta-fig${fig ? '' : ' vazia'}">${fig || '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-dasharray="3 4"/></svg>'}</span>
      <span class="rg-carta-nome">${esc(item.palavra)}</span>
      <span class="rg-carta-selo"${ap}>${ap ? '3D ≈' : '3D'}</span>
    </button>`;
  }

  function desenharAnel() {
    const anel = $('#rg-anel');
    if (!anel) return;
    anel.innerHTML = itens().map(it => cartao(it)).join('');
  }

  function desenharGaveta() {
    const g = $('#rg-gaveta');
    if (!g) return;
    const aulas = [];
    itens().forEach((it) => {
      let g2 = aulas.find(a => a.aula === it.aula);
      if (!g2) { g2 = { aula: it.aula, itens: [] }; aulas.push(g2); }
      g2.itens.push(it);
    });
    g.innerHTML = `
      <div class="rg-gaveta-topo">
        <p>Índice</p>
        <button type="button" class="rg-gaveta-x" id="rg-gaveta-x" aria-label="Fechar o índice">×</button>
      </div>
      <div class="rg-gaveta-lista">
        ${aulas.map(a => `
          <div class="rg-gaveta-grupo">
            <p class="rg-gaveta-aula">${esc(a.aula)} <span>${String(a.itens.length).padStart(2, '0')}</span></p>
            ${a.itens.map(it => `<button type="button" class="rg-gaveta-item" data-i="${it.i}">
              <b>${String(it.i + 1).padStart(2, '0')}</b>${esc(it.palavra)}</button>`).join('')}
          </div>`).join('')}
      </div>
      <p class="rg-gaveta-nota">Todos os sinais desta lista têm uma pose da Agatha lida da aula de origem.</p>`;
  }

  function desenharGrade() {
    const g = $('#rg-grade');
    if (!g) return;
    g.innerHTML = `
      <div class="rg-grade-topo">
        <p><b>${itens().length}</b> sinais com pose · LGA</p>
        <button type="button" class="rg-grade-x" id="rg-grade-x" aria-label="Voltar ao anel">×</button>
      </div>
      <div class="rg-grade-lista">${itens().map(it => cartao(it, ' rg-grade-carta')).join('')}</div>`;
  }

  function pintar() {
    const mesa = $('#rg-mesa');
    const anel = $('#rg-anel');
    if (!mesa || !anel) return;
    const W = mesa.clientWidth || 1200;
    const H = mesa.clientHeight || 700;
    /* num palco estreito o anel encolhe para as fichas não saírem do quadro */
    const estreito = W < 620;
    const RX = Math.min(W * (estreito ? 0.36 : 0.435), 610);
    const RY = Math.min(H * (estreito ? 0.19 : 0.33), estreito ? 140 : 200);
    $$('.rg-carta', anel).forEach((el, i) => {
      let ang = (i + 0.5) * PASSO + ST.giro;
      ang = ((ang + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const prof = (1 - Math.cos(ang)) / 2;             /* 0 à frente · 1 atrás */
      const x = Math.sin(ang) * RX;
      const y = -prof * RY;
      const s = (1 - 0.26 * prof) * (i === ST.sel ? 1.05 : 1);
      el.style.setProperty('--x', x.toFixed(1) + 'px');
      el.style.setProperty('--y', y.toFixed(1) + 'px');
      el.style.setProperty('--s', s.toFixed(3));
      el.style.zIndex = String(200 - Math.round(prof * 120));
      el.style.filter = prof > 0.04 ? 'blur(' + (prof * 1.5).toFixed(2) + 'px)' : 'none';
      el.style.opacity = String(1 - prof * 0.26);
      el.classList.toggle('on', i === ST.sel);
      /* a ficha do fundo fica atrás da Agatha: não vale a pena apanhar o rato */
      el.style.pointerEvents = prof > 0.88 ? 'none' : 'auto';
    });
  }

  /* ---------------- seleção ---------------- */
  function selecaoPorGiro() {
    let melhor = 0, dist = Infinity;
    itens().forEach((it, i) => {
      let ang = (i + 0.5) * PASSO + ST.giro + FRENTE;
      ang = Math.abs(((ang + Math.PI) % TAU + TAU) % TAU - Math.PI);
      if (ang < dist) { dist = ang; melhor = i; }
    });
    return melhor;
  }

  function sincronizar(comRecibo) {
    const item = itens()[ST.sel];
    if (!item) return;
    const conta = $('#rg-conta');
    const tit = $('#rg-titulo');
    const meta = $('#rg-meta');
    if (conta) conta.textContent = String(ST.sel + 1).padStart(2, '0');
    if (tit) tit.textContent = item.palavra;
    if (meta) meta.textContent = String(item.aula).toUpperCase();
    $$('.rg-carta', $('#rg-anel')).forEach(el => {
      const on = Number(el.dataset.i) === ST.sel;
      el.classList.toggle('on', on);
      el.setAttribute('aria-current', on ? 'true' : 'false');
    });
    if (comRecibo && ST.recibo >= 0) abrirRecibo(true);
  }

  function selecionar(i, opt) {
    const lista = itens();
    if (i < 0) i = lista.length - 1;
    if (i >= lista.length) i = 0;
    /* o giro que deixa esta ficha exactamente no lugar da frente */
    const alvo = -(i + 1) * PASSO;
    ST.giro = alvo + Math.round((ST.giro - alvo) / TAU) * TAU;
    ST.sel = i;
    const anel = $('#rg-anel');
    if (anel) anel.classList.remove('arrastando');
    pintar();
    sincronizar(true);
    if (!opt || opt.tocar !== false) tocarSinal(true);
  }

  /* ---------------- Agatha ---------------- */
  function percentagem(carregados, total) {
    const b = $('#rg-pct');
    if (!b) return;
    b.textContent = total
      ? Math.max(1, Math.round((carregados / total) * 100)) + '%'
      : (carregados / 1048576).toFixed(1).replace('.', ',') + ' MB';
  }

  function painelAberto() {
    const p = document.getElementById('sg-painel');
    return !!(p && !p.hidden);
  }

  function tocarSinal(umaVez) {
    if (!ST.ligado || painelAberto()) return;
    if (ST.semMov && !umaVez) return;
    if (!(global.AVATAR && global.AVATAR.pronto)) return;
    const item = itens()[ST.sel];
    if (!item) return;
    const passos = sequenciaDe(item);
    if (!passos.length) return;
    clearTimeout(ST.tsel);
    ST.tsel = setTimeout(() => {
      if (!ST.ligado || painelAberto()) return;
      global.AVATAR.tocarSequencia(passos, () => {
        if (ST.ligado && !ST.semMov && !painelAberto()) tocarSinal();
      });
    }, 60);
  }

  /* corpo inteiro com margem de estúdio: a figura ocupa ~62% da altura do palco
     e os pés ficam à altura da linha onde assentam as fichas */
  function enquadrar() {
    if (!(global.AVATAR && global.AVATAR.pronto)) return;
    global.AVATAR.enquadrar('corpo', 1.42);
  }

  function reclamar() {
    const palco = $('#rg-palco');
    if (!palco || !(global.AVATAR && global.AVATAR.pronto)) return false;
    if (palco.querySelector('canvas')) return false;
    const espera2 = $('.rg-espera', palco);
    if (espera2) espera2.remove();
    global.AVATAR.init(palco);
    enquadrar();
    return true;
  }

  function vigiar() {
    clearInterval(ST.vigia);
    ST.vigia = setInterval(() => {
      if (!ST.ligado) return;
      if (painelAberto()) {
        /* o painel levou o canvas e o relógio: o anel espera */
        global.AVATAR && global.AVATAR.pararSequencia();
        return;
      }
      if (reclamar()) tocarSinal();
    }, 420);
  }

  /* ---------------- recibo ---------------- */
  function codigoBarras(txt) {
    const t = String(txt || 'lga');
    let out = '';
    for (let i = 0; i < 44; i++) {
      const c = t.charCodeAt(i % t.length) + i * 37;
      out += `<i style="width:${(c % 3) + 1}px"></i>`;
    }
    return out;
  }

  function abrirRecibo(soConteudo) {
    const caixa = $('#rg-recibo');
    const mais = $('#rg-mais');
    if (!caixa) return;
    const item = itens()[ST.sel];
    if (!item) return;
    const e = item.entrada || {};
    const seg = item.segundos;
    const tempo = seg == null ? '' : Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
    const url = item.video ? 'https://www.youtube.com/watch?v=' + encodeURIComponent(item.video) + '&t=' + (seg || 0) + 's' : '';
    caixa.innerHTML = `
      <button type="button" class="rg-recibo-x" id="rg-recibo-x" aria-label="Fechar a ficha">×</button>
      <div class="rg-recibo-folha">
        <p class="rg-recibo-marca">VIVA SURDO<sup>®</sup></p>
        <p class="rg-recibo-linha">LGA · ${esc(item.aulaCurta.toUpperCase())}</p>
        <p class="rg-recibo-linha">SINAL ${String(item.i + 1).padStart(2, '0')} — ${esc(item.palavra.toUpperCase())}</p>
        <div class="rg-recibo-regua" aria-hidden="true"></div>
        <dl class="rg-recibo-campos">
          <div><dt>FORMA</dt><dd>${esc(e.forma || '—')}</dd></div>
          <div><dt>LUGAR</dt><dd>${esc(e.lugar || '—')}</dd></div>
          <div><dt>MOVIMENTO</dt><dd>${esc(e.movimento || '—')}</dd></div>
        </dl>
        <div class="rg-recibo-regua" aria-hidden="true"></div>
        <p class="rg-recibo-tot"><span>CONFIANÇA</span><b>${esc((item.confianca || '—').toUpperCase())}</b></p>
        <p class="rg-recibo-tot"><span>NO VÍDEO</span><b>${tempo || '—'}</b></p>
        ${url ? `<a class="rg-recibo-video" href="${url}" target="_blank" rel="noopener noreferrer">VER A AULA DE ORIGEM ↗</a>` : ''}
        <button type="button" class="rg-recibo-cta" id="rg-recibo-cta">ABRIR NA AGATHA <span aria-hidden="true">→</span></button>
        <div class="rg-recibo-codigo" aria-hidden="true">${codigoBarras(item.chave)}</div>
        <p class="rg-recibo-ref">REF. ${esc(item.chave.toUpperCase())}</p>
        <p class="rg-recibo-fim">POR VALIDAR POR SINALIZADORES SURDOS</p>
      </div>`;
    caixa.hidden = false;
    ST.recibo = ST.sel;
    if (mais) { mais.setAttribute('aria-expanded', 'true'); mais.textContent = '−'; }
    requestAnimationFrame(() => caixa.classList.add('aberto'));
    $('#rg-recibo-x').addEventListener('click', fecharRecibo);
    $('#rg-recibo-cta').addEventListener('click', () => {
      if (typeof abrirSignerNotacao !== 'function') return;
      const n = e.palavra;
      abrirSignerNotacao(nota(item.pose), n, !!(item.pose && item.pose.aproximado), item.pose && item.pose.dur);
    });
    if (!soConteudo) $('#rg-recibo-x').focus({ preventScroll: true });
  }

  function fecharRecibo() {
    const caixa = $('#rg-recibo');
    if (!caixa || caixa.hidden) return;
    caixa.classList.remove('aberto');
    const mais = $('#rg-mais');
    if (mais) { mais.setAttribute('aria-expanded', 'false'); mais.textContent = '+'; }
    ST.recibo = -1;
    setTimeout(() => { if (!caixa.classList.contains('aberto')) caixa.hidden = true; }, 260);
    tocarSinal();
  }

  /* ---------------- vistas ---------------- */
  function mudarVista(nome) {
    ST.vista = nome;
    const grade = $('#rg-grade');
    $$('[data-rg-vista]').forEach(b => b.classList.toggle('on', b.dataset.rgVista === nome));
    const anel = $('#rg-anel');
    if (grade) grade.hidden = nome !== 'grade';
    if (anel) anel.hidden = nome === 'grade';
    if (nome === 'grade') {
      fecharRecibo();
      desenharGrade();
    } else {
      pintar();
    }
  }

  function abrirGaveta(on) {
    const g = $('#rg-gaveta');
    const b = $('#rg-indice');
    if (!g) return;
    if (on) {
      desenharGaveta();
      fecharRecibo();
      g.hidden = false;
      requestAnimationFrame(() => g.classList.add('aberta'));
    } else {
      g.classList.remove('aberta');
      setTimeout(() => { if (!g.classList.contains('aberta')) g.hidden = true; }, 240);
    }
    if (b) b.setAttribute('aria-expanded', String(on));
  }

  /* ---------------- ligar / parar ---------------- */
  function ligar() {
    ST.ligado = true;
    ST.sel = 0;
    ST.giro = -PASSO;
    ST.recibo = -1;
    /* movimento reduzido: sem autoplay nem repetição — só quando a pessoa pede */
    const prefere = global.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const marca = document.documentElement.hasAttribute('data-movimento-reduzido');
    ST.semMov = !!(prefere || marca);

    desenharAnel();
    desenharGaveta();
    pintar();
    sincronizar();

    const mesa = $('#rg-mesa');
    const anel = $('#rg-anel');

    /* ---- arrastar ---- */
    mesa.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('button, a, input, textarea')) return;
      ST.arrastando = true;
      ST.x0 = e.clientX;
      ST.g0 = ST.giro;
      anel.classList.add('arrastando');
      fecharRecibo();
      try { mesa.setPointerCapture(e.pointerId); } catch (err) { /* sem captura */ }
    });
    mesa.addEventListener('pointermove', (e) => {
      if (!ST.arrastando) return;
      const largura = mesa.clientWidth || 1200;
      const RX = Math.min(largura * (largura < 620 ? 0.36 : 0.435), 610);
      ST.giro = ST.g0 + (e.clientX - ST.x0) / RX;
      const sel = selecaoPorGiro();
      const mudou = sel !== ST.sel;
      ST.sel = sel;
      pintar();
      sincronizar();
      if (mudou) tocarSinal();
    });
    const soltar = (e) => {
      if (!ST.arrastando) return;
      ST.arrastando = false;
      try { mesa.releasePointerCapture(e.pointerId); } catch (err) { /* já solto */ }
      anel.classList.remove('arrastando');
      /* encaixar no lugar: o giro tem de ser múltiplo do passo */
      ST.giro = Math.round(ST.giro / PASSO) * PASSO;
      ST.sel = selecaoPorGiro();
      pintar();
      sincronizar();
      tocarSinal();
    };
    mesa.addEventListener('pointerup', soltar);
    mesa.addEventListener('pointercancel', soltar);

    /* ---- teclado ---- */
    mesa.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); selecionar(ST.sel + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); selecionar(ST.sel - 1); }
      else if (e.key === 'Escape') { fecharRecibo(); abrirGaveta(false); }
      else if (e.key === 'Enter' && e.target === mesa) { e.preventDefault(); abrirRecibo(); }
    });

    /* ---- fichas ---- */
    anel.addEventListener('click', (e) => {
      const c = e.target.closest('.rg-carta');
      if (!c) return;
      const i = Number(c.dataset.i);
      if (ST.vista === 'grade') {
        mudarVista('anel');
        selecionar(i);
        setTimeout(() => abrirRecibo(), 420);
        return;
      }
      if (i === ST.sel) { abrirRecibo(); return; }
      selecionar(i);
    });
    anel.addEventListener('focusin', (e) => {
      const c = e.target.closest('.rg-carta');
      if (!c) return;
      const i = Number(c.dataset.i);
      if (i !== ST.sel) selecionar(i);
    });

    /* ---- cromo ---- */
    $$('[data-rg-vista]').forEach(b => b.addEventListener('click', () => mudarVista(b.dataset.rgVista)));
    $('#rg-mais').addEventListener('click', () => {
      const c = $('#rg-recibo');
      if (c && !c.hidden) fecharRecibo(); else abrirRecibo();
    });
    $('#rg-replay').addEventListener('click', () => {
      if (ST.semMov) { tocarUmaVez(); return; }
      if (global.AVATAR) global.AVATAR.pararSequencia();
      tocarSinal();
    });
    $('#rg-indice').addEventListener('click', () => {
      const g = $('#rg-gaveta');
      abrirGaveta(!!(g && g.hidden));
    });
    $('#rg-gaveta').addEventListener('click', (e) => {
      if (e.target.closest('#rg-gaveta-x')) { abrirGaveta(false); return; }
      const it = e.target.closest('.rg-gaveta-item');
      if (!it) return;
      abrirGaveta(false);
      selecionar(Number(it.dataset.i));
    });
    $('#rg-grade').addEventListener('click', (e) => {
      if (e.target.closest('#rg-grade-x')) { mudarVista('anel'); return; }
      const c = e.target.closest('.rg-carta');
      if (!c) return;
      mudarVista('anel');
      selecionar(Number(c.dataset.i));
      setTimeout(() => abrirRecibo(), 420);
    });

    global.addEventListener('resize', pintar);
    vigiar();

    /* ---- a Agatha ---- */
    const palco = $('#rg-palco');
    if (global.AVATAR && global.SINAL3D) {
      const pronto = global.AVATAR.init(palco, { progresso: percentagem });
      Promise.resolve(pronto).then(() => {
        const espera2 = $('.rg-espera', palco);
        if (espera2) espera2.remove();
        enquadrar();
        if (!ST.semMov) tocarSinal();
      }).catch(() => {
        const espera2 = $('.rg-espera', palco);
        if (espera2) espera2.textContent = 'O modelo 3D não carregou.';
      });
    } else {
      const espera2 = $('.rg-espera', palco);
      if (espera2) espera2.textContent = 'O modelo 3D não carregou.';
    }
  }

  function tocarUmaVez() {
    if (!(global.AVATAR && global.AVATAR.pronto)) return;
    const passos = sequenciaDe(itens()[ST.sel]);
    if (passos.length) global.AVATAR.tocarSequencia(passos, null);
  }

  function parar() {
    ST.ligado = false;
    clearInterval(ST.vigia);
    clearTimeout(ST.tsel);
    global.removeEventListener('resize', pintar);
    if (global.AVATAR && global.AVATAR.pararSequencia) global.AVATAR.pararSequencia();
  }

  global.RING = { vista, ligar, parar, itens };
})(window);
