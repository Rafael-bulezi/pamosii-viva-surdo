/* Integridade da Agatha — teste de regressão
   ----------------------------------------------------------------------------
   A app foi reduzida a duas funções: ver sinais de um texto (#/) e procurar uma
   palavra (#/dicionario). Este teste falha quando a interface afirma o que o
   código não faz, quando a notação de um sinal deixa de ser desenhável, ou
   quando o casulo offline fica fora de sincronia com o index.

   Não precisa de browser: lê os ficheiros e corre dados.js + maos.js num vm.
   Uso: node tools/integridade-test.cjs   (sai com código 1 se falhar)          */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..', 'app');
const ler = f => fs.readFileSync(path.join(RAIZ, f), 'utf8');

const app = ler('app.js');
const dados = ler('dados.js');
const maos = ler('maos.js');
const referencias = ler('referencias.js');
const html = ler('index.html');
const css = ler('styles.css');
const sw = ler('sw.js');
const manifest = JSON.parse(ler('manifest.webmanifest'));

const falhas = [];
const avisos = [];
const nota = m => avisos.push(m);

/* ------------------------------------------------------------------ 1. claims */

/* comentário de código não é promessa a quem usa o site; a lista de regras vive
   em comentários e não pode fazer o teste falhar sozinha */
function semComentarios(t) {
  return String(t)
    .replace(/accept="[^"]*"/g, 'accept=""')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1 ');
}

const norm = s => String(s).toLowerCase().replace(/\s+/g, ' ').normalize('NFC');

const NEGACAO = /(n[aã]o|nem\b|nunca\b|sem\b|nenhuma?\b|jamais\b|em vez de\b|ao inv[ée]s\b|fals[oe]|imposs[íi]vel|proibid|evit|corrig|deixa de|em vez)/;
function afirmacaoProibida(texto, frase) {
  const alvo = norm(frase);
  let i = -1;
  while ((i = texto.indexOf(alvo, i + 1)) >= 0) {
    const cortes = [texto.lastIndexOf('.', i), texto.lastIndexOf(';', i), texto.lastIndexOf('!', i),
      texto.lastIndexOf('?', i), texto.lastIndexOf('\n', i), texto.lastIndexOf('—', i),
      texto.lastIndexOf(':', i), texto.lastIndexOf(')', i)];
    const inicio = Math.max.apply(null, cortes);
    const antes = texto.slice(inicio + 1, i);
    if (!NEGACAO.test(antes)) return antes + ' >>> ' + texto.slice(i, i + alvo.length + 45);
  }
  return null;
}

const PROIBIDAS = [
  ['traduz automaticamente', 'afirma tradução automática; isto é uma glosa de estudo'],
  ['tradução automática de fala', 'afirma tradução de fala; não há reconhecimento de voz'],
  ['traduz fala', 'afirma fala→LGA; não existe microfone nem reconhecimento'],
  ['converte a voz', 'afirma voz→sinais; não existe'],
  ['reconhece sinais', 'afirma leitura de sinais por câmara; não existe'],
  ['reconhece a sua língua gestual', 'afirma reconhecimento; não existe'],
  ['inteligência artificial que traduz', 'afirma IA tradutora; não existe'],
  ['validado pela comunidade surda', 'afirma validação; o estado máximo é «por validar»'],
  ['tradução instantânea', 'promessa de instantaneidade'],
  ['tradutor português', 'o site não é um tradutor; é uma glosa'],
  ['pessoas normais', 'linguagem capacitista; usar «pessoas ouvintes»'],
  ['open minds', 'texto da Open Minds Academy que não devia estar aqui'],
  ['patrocinado pela unicef', 'a UNICEF não patrocina este site'],
];

const corpo = norm([app, html, css, dados].map(semComentarios).join('\n '));
for (const [frase, porque] of PROIBIDAS) {
  const contexto = afirmacaoProibida(corpo, frase);
  if (contexto) falhas.push('CLAIM proibida (afirmada, não negada): «' + frase + '» — ' + porque +
    '\n    contexto: …' + contexto.replace(/\n/g, ' ').slice(-220) + '…');
}

/* o contrário também se verifica: as honestidades não podem desaparecer */
if (!/por validar/.test(app)) falhas.push('Desapareceu «por validar» do rodapé/dicionário.');
if (!/O que esta glosa não é/.test(app)) falhas.push('Desapareceu o bloco «O que esta glosa não é».');
if (!/Não é tradução para LGA/.test(app)) falhas.push('A página deixou de dizer que não é tradução para LGA.');
if (!/não substituem/.test(app)) falhas.push('O dicionário deixou de dizer que as descrições não substituem um sinalizador surdo.');
if (!/por validar/.test(html)) falhas.push('O <meta name="description"> perdeu o aviso de que as associações estão por validar.');

/* ------------------------------------------------------------- 2. credenciais */
const SEGREDAS = [
  /sk-[A-Za-z0-9]{16,}/,
  /AIza[0-9A-Za-z_\-]{30,}/,
  /xox[baprs]-[0-9A-Za-z-]{10,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /ghp_[0-9A-Za-z]{30,}/,
  /github_pat_[0-9A-Za-z_]{40,}/,
];
for (const [nome, texto] of [['app.js', app], ['dados.js', dados], ['maos.js', maos],
  ['referencias.js', referencias], ['index.html', html], ['styles.css', css], ['sw.js', sw]]) {
  for (const re of SEGREDAS) if (re.test(texto)) falhas.push('Possível credencial em ' + nome + ' (' + re + ')');
}
if (/(?:apiKey|api_key|API_KEY)\s*[:=]/.test(app)) falhas.push('Aparece algo com cara de chave de API no frontend.');

/* --------------------------------------------------- 3. dados de demonstração */
const DEMO = [
  [/\bKz\s?[\d.,]+\s*(?:por|\/|de mensalidade)/i, 'preço em kwanzas'],
  [/\bR\$\s?[\d.,]+/i, 'preço em reais'],
  [/depoim?ento/i, 'depoimento inventado'],
  [/junte[\s-]se a [\d.]+ (?:pessoas|alunos)/i, 'número de inscritos inventado'],
];
for (const [re, porque] of DEMO) {
  const m = corpo.match(re);
  if (!m) continue;
  const antes = corpo.slice(Math.max(0, m.index - 90), m.index);
  if (NEGACAO.test(antes)) continue;
  falhas.push('Parece dado de demonstração (' + porque + '): …' +
    corpo.slice(Math.max(0, m.index - 40), m.index + 60) + '…');
}

/* ------------------------------------------------------------- 4. navegação */
const rotas = [...app.matchAll(/^on\('([^']+)'[,\s]/gm)].map(m => m[1]);
if (rotas.length !== 2) falhas.push('A app devia ter exactamente duas rotas; tem ' + rotas.length + ': ' + rotas.join(', '));
if (!rotas.includes('/') || !rotas.includes('/dicionario')) {
  falhas.push('Faltam as rotas base (#/ e #/dicionario): ' + rotas.join(', '));
}
const nav = [...app.matchAll(/\[\s*'([^']+)',\s*'([^']+)'\s*\]/g)]
  .filter(m => m[1].startsWith('/'))
  .map(m => m[1]);
if (nav.length !== 2) falhas.push('O menu devia ter duas entradas; tem ' + nav.length + ': ' + nav.join(', '));
for (const p of nav) if (!rotas.includes(p)) falhas.push('Item de menu sem vista: ' + p);
const hrefs = [...new Set([...app.matchAll(/#\/([a-z0-9:._-]+)/gi), ...html.matchAll(/#\/([a-z0-9:._-]+)/gi)].map(m => '/' + m[1]))];
for (const h of hrefs) if (!rotas.includes(h)) falhas.push('Ligação interna sem rota registada: #' + h);

/* ---------------------------------------------- 5. ficheiros locais referidos */
const refs = [...new Set([...html.matchAll(/(?:src|href)="(?!https?:|#)([^"?#]+)/g)].map(m => m[1]))]
  .filter(r => /\.(?:css|js|png|jpg|jpeg|svg|webp|gif|json|webmanifest)$/.test(r));
for (const r of refs) {
  if (!fs.existsSync(path.join(RAIZ, r))) falhas.push('index.html refere ficheiro local que não existe: ' + r);
}
for (const [icone] of manifest.icons.map(i => [i.src])) {
  if (!fs.existsSync(path.join(RAIZ, icone))) falhas.push('manifest declara ícone em falta: ' + icone);
}

/* -------------------------------------------------------- 6. versão do offline */
const versaoSW = (sw.match(/const VERSAO = '([^']+)'/) || [])[1];
const versoesHtml = [...new Set([...html.matchAll(/[?&]v=(vs\d+)/g)].map(m => m[1]))];
if (!versaoSW) falhas.push('sw.js sem const VERSAO.');
if (versoesHtml.length !== 1) falhas.push('index.html com mais do que uma versão: ' + versoesHtml.join(', '));
if (versaoSW && versoesHtml[0] && versaoSW !== versoesHtml[0]) {
  falhas.push('Offline desactualizado: sw.js é ' + versaoSW + ' mas o index pede ' + versoesHtml[0] + '.');
}
for (const ficheiro of ['styles.css', 'referencias.js', 'dados.js', 'lga.js', 'maos.js', 'app.js']) {
  if (!new RegExp("'\\./" + ficheiro.replace('.', '\\.') + "\\?v=' \\+ VERSAO").test(sw)) {
    falhas.push('sw.js não pré-guarda ' + ficheiro + ' na chave versionada (?v= + VERSAO).');
  }
  if (!new RegExp(ficheiro.replace('.', '\\.') + '\\?v=' + versaoSW).test(html)) {
    falhas.push('index.html não pede ' + ficheiro + ' com ?v=' + versaoSW + ' — o casulo não acertaria.');
  }
}

/* ------------------------------------------------------------- 7. acessibilidade */
const iframesHTML = [...app.matchAll(/<iframe\b[^>]*>/gi)].map(m => m[0]);
for (const f of iframesHTML) if (!/title=/.test(f)) falhas.push('iframe sem título: ' + f.slice(0, 80));
const imgs = [...app.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
for (const i of imgs) if (!/\balt=/.test(i)) falhas.push('<img> sem alt: ' + i.slice(0, 80));
if (/<(?:video|audio)\b[^>]*autoplay/i.test(app)) falhas.push('Há <video>/<audio> com autoplay — proibido.');
if (!/<video\b[^>]*controls/.test(app)) falhas.push('O vídeo de legendas perdeu os controlos.');
if (!/prefers-reduced-motion/.test(css)) falhas.push('O CSS deixou de respeitar prefers-reduced-motion.');
if (!/prefers-reduced-motion/.test(app)) falhas.push('O JS deixou de parar a animação quando o sistema pede menos movimento.');
if (!/:focus-visible/.test(css)) falhas.push('O CSS deixou de ter foco visível (:focus-visible).');
if (!/aria-live/.test(app)) falhas.push('Desapareceram as regiões aria-live.');
if (!/data-contraste-alto/.test(css)) falhas.push('Desapareceu o modo de contraste alto.');
if (!/class="skip"/.test(html)) falhas.push('Desapareceu o link «Saltar para o conteúdo».');
if (!/aria-label="Opções de acessibilidade"/.test(app)) falhas.push('O botão de acessibilidade perdeu nome acessível.');

/* ------------------------------------------------------- 8. arquitectura nova */
/* ordem de carregamento: referências -> dados -> mãos -> app (o app usa os três) */
const ordem = ['referencias.js', 'dados.js', 'maos.js', 'app.js'].map(f => html.indexOf(f + '?v='));
if (ordem.some(i => i < 0)) falhas.push('index.html não carrega referencias.js, dados.js, maos.js e app.js.');
else if (!(ordem[0] < ordem[1] && ordem[1] < ordem[2] && ordem[2] < ordem[3])) {
  falhas.push('Os scripts carregam fora de ordem (referências → dados → mãos → app).');
}

/* o site desenha os sinais sozinho; não pode voltar a depender de imagens de mãos */
if (!/function maoCena/.test(maos) || !/function maoPecas/.test(maos) || !/function formaMisturar/.test(maos)) {
  falhas.push('maos.js perdeu o rig (maoCena / maoPecas / formaMisturar): as mãos deixariam de se transformar.');
}
if (!/maoCena\(/.test(app)) falhas.push('app.js deixou de usar o rig das mãos.');
if (!/maoFigura\(/.test(app)) falhas.push('O dicionário deixou de desenhar a forma de cada sinal.');
if (/<img[^>]+(?:mao|hand|sinal|sign)[^>]*>/i.test(app + html)) {
  falhas.push('Há uma imagem a fingir de mão/sinal — o rig tem de ser desenhado, não colado.');
}
if (/<script[^>]+src="https?:/i.test(html)) falhas.push('Há um script remoto no index (biblioteca externa).');

/* variáveis globais: os três ficheiros partilham o mesmo âmbito lexical; um
   `const` repetido entre ficheiros mata o ficheiro inteiro com SyntaxError */
const declaradas = new Map();
for (const [nome, texto] of [['dados.js', dados], ['maos.js', maos], ['app.js', app]]) {
  for (const m of texto.matchAll(/^(?:const|let)\s+([A-Za-z_$][\w$]*)/gm)) {
    const antes = declaradas.get(m[1]);
    if (antes) falhas.push('`' + m[1] + '` é declarado em ' + antes + ' e outra vez em ' + nome +
      ' — o segundo ficheiro não chega a correr (SyntaxError).');
    else declaradas.set(m[1], nome);
  }
}

/* --------------------------------------------------- 9. a notação é desenhável */
const ctx = { console };
ctx.window = ctx; /* os módulos fecham-se com (function(global){…})(window) */
vm.createContext(ctx);
vm.runInContext(referencias + '\n' + dados + '\n' + maos + `
;globalThis.__api = { SINAIS, FORMAS_MAO, LOCAIS, MOVIMENTOS, sinalNotacao,
  GLOSSARIO, GLOSSARIO_QTD, procurarSinal, analisarTexto, glosaTexto,
  PM_EXEMPLOS, TEMPO_FRENTE, REFERENCIAS_IS, IS_TEMAS, IS_FONTE };
`, ctx);
const api = ctx.__api;
if (!api) throw new Error('não foi possível avaliar referencias.js + dados.js + maos.js no vm');

const sinais = Object.keys(api.SINAIS);
const notacaoMaus = [];
for (const chave of sinais) {
  const n = api.sinalNotacao(chave);
  if (!n) { notacaoMaus.push(chave + ' (não analisa)'); continue; }
  const tokens = api.SINAIS[chave].replace(/^2:/, '').split(/\s+/);
  if (tokens.length !== 3) { notacaoMaus.push(chave + ' (esperava forma local movimento: «' + api.SINAIS[chave] + '»)'); continue; }
  const [forma, local, mov] = tokens;
  if (!api.FORMAS_MAO[forma]) notacaoMaus.push(chave + ' (forma «' + forma + '» desconhecida)');
  if (!api.LOCAIS[local]) notacaoMaus.push(chave + ' (local «' + local + '» desconhecido)');
  if (!api.MOVIMENTOS[mov]) notacaoMaus.push(chave + ' (movimento «' + mov + '» desconhecido)');
}
if (notacaoMaus.length) falhas.push('Sinais com notação que o rig não desenha:\n    - ' + notacaoMaus.join('\n    - '));

const totalGlossario = api.GLOSSARIO.reduce((n, g) => n + g.termos.length, 0);
if (api.GLOSSARIO_QTD !== totalGlossario) {
  falhas.push('GLOSSARIO_QTD (' + api.GLOSSARIO_QTD + ') não bate com as entradas do glossário (' + totalGlossario + ').');
}
const entradas = [];
for (const g of api.GLOSSARIO) {
  for (const t of g.termos) {
    if (api.sinalNotacao(String(t.palavra).toLowerCase().trim())) entradas.push(t.palavra);
  }
}
if (!entradas.length) falhas.push('O dicionário ficou sem entradas desenháveis.');
if (entradas.length > totalGlossario) falhas.push('O dicionário tem mais entradas do que palavras no glossário.');
const porTema = api.GLOSSARIO.map(g => g.tema + ':' + g.termos.length).join(', ');
nota('glossário: ' + totalGlossario + ' palavras em ' + api.GLOSSARIO.length + ' temas (' + porTema + ')');
nota('notação: ' + sinais.length + ' sinais desenháveis; dicionário mostra ' + entradas.length + ' cartões');

for (const chave of sinais) {
  if (/^2:/.test(api.SINAIS[chave]) && !api.sinalNotacao(chave).duas) {
    falhas.push('Sinal de duas mãos sem o prefixo 2: em ' + chave);
  }
}

/* -------------------------------------- 9b. as referências International Sign */
const palavrasGlossario = new Set();
for (const g of api.GLOSSARIO) for (const t of g.termos) palavrasGlossario.add(String(t.palavra).toLowerCase().trim());

const refsFora = Object.keys(api.REFERENCIAS_IS).filter(p => !palavrasGlossario.has(p));
if (refsFora.length) falhas.push('Referências IS para palavras que não estão no glossário: ' + refsFora.join(', '));

const urlsMas = Object.entries(api.REFERENCIAS_IS)
  .filter(([, r]) => !/^https:\/\/www\.sematos\.eu\/en\/isl\/words\/[a-z0-9-]+$/.test(r.url))
  .map(([p]) => p);
if (urlsMas.length) falhas.push('Referências IS sem URL válida da Sématos: ' + urlsMas.join(', '));

for (const g of api.IS_TEMAS) {
  const tema = api.GLOSSARIO.find(x => x.tema === g.tema);
  if (!tema) { falhas.push('O tema IS «' + g.tema + '» não chegou ao glossário — dados.js deixou de juntar IS_TEMAS.'); continue; }
  const faltam = g.termos.filter(t => !tema.termos.some(x => x.palavra === t));
  if (faltam.length) falhas.push('Faltam no glossário palavras IS do tema ' + g.tema + ': ' + faltam.join(', '));
}

/* uma palavra sem notação não pode aparecer como se a personagem soubesse o sinal */
if (!/cartao-ref/.test(app)) falhas.push('O dicionário perdeu o cartão de referência sem pose (cartao-ref).');
if (!/target="_blank" rel="noopener/.test(app)) falhas.push('Os cartões de referência deixaram de abrir a fonte em aba própria com rel=noopener.');
/* o cartão com pose abre a personagem; o vídeo da fonte é um link à parte */
if (!/class="cartao-video" href="\$\{esc\(e\.ref\.url\)\}"/.test(app)) {
  falhas.push('Os cartões com pose e referência perderam o link para o vídeo da fonte (cartao-video).');
}
const comRefEPose = Object.keys(api.REFERENCIAS_IS).filter(p => api.sinalNotacao(p)).length;
nota('vídeo da fonte: ' + comRefEPose + ' cartões com pose levam um selo para o vídeo IS');

/* as contas da página têm de sair dos dados, não de um número escrito à mão */
const h1Dic = (app.match(/<h1>\$\{([^}]+)\}[^<]*sinal/i) || [])[1] || '(sem contagem)';
if (!/CONTAS\./.test(h1Dic)) falhas.push('O título do dicionário voltou a ter uma contagem escrita à mão: ' + h1Dic);
if (!/FONTE_IS\.total/.test(app)) falhas.push('A contagem de sinais da fonte deixou de vir de IS_FONTE (tools/fonte/sematos-isl-slugs.txt).');

/* ------------------------------------------- 9c. o caderno de comparações IS */
const COMPARADO = JSON.parse(fs.readFileSync(path.join(__dirname, 'fonte', 'is-comparado.json'), 'utf8'));
const VEREDICTOS = ['igual', 'corrigido', 'aproximado'];
for (const [palavra, c] of Object.entries(COMPARADO)) {
  if (palavra.startsWith('_')) continue;
  if (!api.REFERENCIAS_IS[palavra]) { falhas.push('«' + palavra + '» está no caderno de comparações sem referência IS.'); continue; }
  if (!VEREDICTOS.includes(c.veredicto)) falhas.push('«' + palavra + '» tem veredicto desconhecido: ' + c.veredicto);
  if (!c.no_video || c.no_video.length < 20) falhas.push('«' + palavra + '» não descreve o que se vê no vídeo.');
  const actual = api.SINAIS[palavra];
  if (actual !== c.depois) {
    falhas.push('«' + palavra + '» foi comparada e o código mudou depois disso: o caderno diz «' + c.depois +
      '», maos.js tem «' + actual + '». Voltar a comparar, ou corrigir o caderno com prova.');
  }
}
const comparadas = Object.keys(api.REFERENCIAS_IS).filter(p => api.REFERENCIAS_IS[p].comparado).length;
if (comparadas !== Object.keys(COMPARADO).filter(k => !k.startsWith('_')).length) {
  falhas.push('referencias.js marca ' + comparadas + ' palavras como comparadas mas o caderno tem ' +
    Object.keys(COMPARADO).filter(k => !k.startsWith('_')).length + ' — correr tools/gerar-referencias.py.');
}
nota('comparações: ' + comparadas + ' poses vistas fotograma a fotograma contra o vídeo da fonte');

const comRef = Object.keys(api.REFERENCIAS_IS).length;
const refComPose = Object.keys(api.REFERENCIAS_IS).filter(p => api.sinalNotacao(p)).length;
nota('referências: ' + comRef + ' palavras ligadas ao léxico IS da Sématos (' + refComPose + ' já com pose 3D)');

/* ------------------------------------ 9d. o inventário das aulas de LGA */
/* lga.js é gerado de tools/fonte/aulas-lga/*.json; se um dos dois mudar sem o
   outro, a app passa a mostrar evidência que já não existe. */
const lgaTexto = ler('lga.js');
const ctxLga = { console };
ctxLga.window = ctxLga;
vm.createContext(ctxLga);
vm.runInContext(lgaTexto + '\n;globalThis.__lga = { FONTE_LGA, LGA_META };', ctxLga);
const lga = ctxLga.__lga;
if (!lga) falhas.push('lga.js não expõe FONTE_LGA/LGA_META.');

const NUM_LGA = { 1: 'um', 2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete',
  8: 'oito', 9: 'nove', 10: 'dez', 11: 'onze', 12: 'doze', 13: 'treze', 14: 'catorze', 15: 'quinze',
  16: 'dezasseis', 17: 'dezassete', 18: 'dezoito', 19: 'dezanove', 20: 'vinte', 30: 'trinta',
  40: 'quarenta', 50: 'cinquenta', 60: 'sessenta', 70: 'setenta', 80: 'oitenta', 90: 'noventa' };
const chaveLga = (s) => {
  const limpo = String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[?!.:;()"]/g, '').replace(/\s+/g, ' ').trim();
  return NUM_LGA[String(s).trim()] || limpo;
};

const chavesLga = Object.keys(lga.FONTE_LGA);
if (lga.LGA_META.entradas !== chavesLga.length) {
  falhas.push('LGA_META.entradas (' + lga.LGA_META.entradas + ') não bate com as chaves de lga.js (' +
    chavesLga.length + '). Correr tools/gerar-lga.py.');
}
const lgaMaus = [];
for (const [k, e] of Object.entries(lga.FONTE_LGA)) {
  if (!e.palavra || !e.aula) lgaMaus.push(k + ': sem palavra ou aula');
  if (!/^[A-Za-z0-9_-]{6,}$/.test(e.video)) lgaMaus.push(k + ': id de vídeo inválido');
  if (!Array.isArray(e.segundos) || !e.segundos.length || !e.segundos.every(n => Number.isInteger(n) && n >= 0)) {
    lgaMaus.push(k + ': segundos inválidos');
  }
  if (!['alta', 'média', 'baixa'].includes(e.confianca)) lgaMaus.push(k + ': confiança «' + e.confianca + '»');
  if (!e.veSe || e.veSe.length < 15) lgaMaus.push(k + ': sem descrição do que se vê');
}
if (lgaMaus.length) falhas.push('Entradas LGA inválidas:\n    - ' + lgaMaus.join('\n    - '));

const pastaAulas = path.join(__dirname, 'fonte', 'aulas-lga');
const fonteLga = [];
let saltadasLga = 0;
for (const f of fs.readdirSync(pastaAulas).filter(x => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(pastaAulas, f), 'utf8'));
  for (const p of d.palavras || []) {
    if (String(p.palavra).startsWith('[')) { saltadasLga++; continue; }
    fonteLga.push({ chave: chaveLga(p.palavra), aula: d.aula, veSe: p['ve-se'] || '' });
  }
}
if (!fonteLga.length) falhas.push('tools/fonte/aulas-lga/ não tem palavras — a aba LGA ficaria vazia.');
const semChave = [...new Set(fonteLga.map(p => p.chave))].filter(k => !lga.FONTE_LGA[k]);
if (semChave.length) {
  falhas.push('lga.js não tem palavras que os JSON das aulas têm (correr tools/gerar-lga.py): ' +
    semChave.slice(0, 12).join(', '));
}
const inventadas = chavesLga.filter(k => !fonteLga.some(p => p.chave === k));
if (inventadas.length) {
  falhas.push('lga.js tem palavras que não estão em nenhuma aula: ' + inventadas.join(', '));
}
const desactualizadas = [];
for (const [k, e] of Object.entries(lga.FONTE_LGA)) {
  const daChave = fonteLga.filter(p => p.chave === k);
  if (daChave.length && !daChave.some(p => p.veSe === e.veSe)) desactualizadas.push(k);
}
if (desactualizadas.length) {
  falhas.push('lga.js desactualizado (a descrição já não está nas aulas): ' + desactualizadas.slice(0, 8).join(', ') +
    ' — correr tools/gerar-lga.py.');
}
const chavesGlossario = new Set();
for (const g of api.GLOSSARIO) for (const t of g.termos) chavesGlossario.add(chaveLga(t.palavra));
const lgaNaApp = chavesLga.filter(k => chavesGlossario.has(k));
nota('LGA: ' + chavesLga.length + ' palavras de ' + lga.LGA_META.aulas + ' aulas do ' + lga.LGA_META.nome +
  ' (' + lgaNaApp.length + ' já no dicionário, ' + saltadasLga + ' entrada de fecho saltada)');

/* as duas fontes ficam em abas separadas: o cartão IS não pode mostrar LGA */
const fCartoes = (app.match(/function cartoes\(\) \{[\s\S]*?\n\}/) || [''])[0];
if (/LGA/.test(fCartoes)) falhas.push('A aba International Sign passou a mostrar conteúdo LGA — as fontes têm de ficar separadas.');
if (!/fonte === 'lga'/.test(app)) falhas.push('O dicionário perdeu a aba LGA (#/dicionario?fonte=lga).');
if (!/LGA_LISTA\.length/.test(app)) falhas.push('O título da aba LGA deixou de contar a partir dos dados.');
if (!/cartao-lga/.test(app)) falhas.push('Os cartões da LGA desapareceram.');
if (!/<script src="lga\.js\?v=/.test(html)) falhas.push('O index.html não carrega lga.js.');

/* 9e. a camada 3D da LGA: só palavras da fonte e notação que o rig desenha.
   A pose vive noutro ficheiro, por isso é aqui que se impede que ela invente
   uma palavra, troque o segundo da aula ou peça uma forma de mão inexistente. */
vm.runInContext(ler('lga-3d.js'), ctx);
const sinaisLga3d = ctx.SINAIS_LGA;
if (!sinaisLga3d) {
  falhas.push('lga-3d.js não expõe SINAIS_LGA.');
} else {
  const maus = [];
  for (const [k, e] of Object.entries(sinaisLga3d)) {
    const fonte = lga.FONTE_LGA[k];
    if (!fonte) { maus.push(k + ' (não existe em lga.js)'); continue; }
    const tokens = String(e.notacao || '').replace(/^2:/, '').split(/\s+/);
    if (tokens.length !== 3) { maus.push(k + ' (esperava forma local movimento: «' + e.notacao + '»)'); continue; }
    const [forma, local, mov] = tokens;
    if (!api.FORMAS_MAO[forma]) maus.push(k + ' (forma «' + forma + '» desconhecida)');
    if (!api.LOCAIS[local]) maus.push(k + ' (local «' + local + '» desconhecido)');
    if (!api.MOVIMENTOS[mov]) maus.push(k + ' (movimento «' + mov + '» desconhecido)');
    if (e.aula !== fonte.aula) maus.push(k + ' (aula «' + e.aula + '» ≠ fonte «' + fonte.aula + '»)');
    if (String(e.segundos) !== String(fonte.segundos)) maus.push(k + ' (segundos ' + e.segundos + ' ≠ fonte ' + fonte.segundos + ')');
    if (e.confianca !== fonte.confianca) maus.push(k + ' (confiança «' + e.confianca + '» ≠ fonte «' + fonte.confianca + '»)');
    if (!e.veSe) maus.push(k + ' (sem veSe)');
  }
  if (maus.length) falhas.push('Poses LGA em contradição com a fonte ou com o rig:\n    - ' + maus.join('\n    - '));
  const total3d = Object.keys(sinaisLga3d).length;
  const aprox3d = Object.values(sinaisLga3d).filter(e => e.aproximado).length;
  nota('LGA 3D: ' + total3d + ' poses (' + aprox3d + ' aproximadas) — ' +
    Math.round(100 * total3d / chavesLga.length) + '% das palavras');
}
if (!/<script src="lga-3d\.js\?v=/.test(html)) falhas.push('O index.html não carrega lga-3d.js.');
if (!/lga-3d\.js\?v=/.test(sw)) falhas.push('O casulo offline não guarda lga-3d.js.');
if (!/poseLga\(e\.chave\)/.test(app)) falhas.push('Os cartões da LGA deixaram de usar a pose 3D quando existe.');

/* o glosador tem de continuar a ordenar como promete a nota do site */
for (const frase of ['Amanhã eu vou à escola.', 'Eu não quero água.']) {
  const resolvido = api.analisarTexto(frase, { soletrar: true });
  if (!resolvido.length) { falhas.push('O glosador deixou de resolver: ' + frase); continue; }
  const glosa = api.glosaTexto(resolvido[0]).trim();
  if (!glosa) falhas.push('Glosa vazia para: ' + frase);
  if (/amanhã/i.test(frase) && !/^AMANHÃ/i.test(glosa)) {
    falhas.push('O tempo deixou de ir à frente da glosa: «' + frase + '» → ' + glosa);
  }
  if (/não/i.test(frase) && !/NÃO\s*$/i.test(glosa)) {
    falhas.push('O «não» deixou de ir ao fim da glosa: «' + frase + '» → ' + glosa);
  }
}
for (const lema of ['vou', 'foi', 'vai']) {
  if (!api.procurarSinal(lema)) falhas.push('O lema «' + lema + '» deixou de encontrar o sinal ir.');
}

/* --------------------------------------------------------------- 10. privacidade */
const semComApp = semComentarios(app);
if (/navigator\.sendBeacon|XMLHttpRequest|method:\s*['"]POST/.test(semComApp)) {
  falhas.push('O site passou a enviar dados para fora (sendBeacon/XHR/POST).');
}
if (/\bfetch\(/.test(semComApp)) falhas.push('O site passou a fazer fetch — os ficheiros lidos deviam ficar no aparelho.');
if (/getUserMedia|MediaRecorder|AudioContext/.test(semComApp)) {
  falhas.push('O site passou a captar áudio/microfone.');
}
const chavesLocal = [...semComApp.matchAll(/localStorage\.(?:get|set|remove)Item\('([^']+)'/g)].map(m => m[1]);
for (const c of new Set(chavesLocal)) {
  if (c !== 'vs.a11y') falhas.push('O site guarda algo além das opções de acessibilidade: ' + c);
}
if (!/DecompressionStream/.test(app)) falhas.push('A leitura de PDF deixou de ser local (sem DecompressionStream).');

/* ---------------------------------------------------------------- 11. manifesto */
if (!manifest.name || !manifest.short_name) falhas.push('manifest sem name/short_name.');
if (!manifest.icons || manifest.icons.length < 2) falhas.push('manifest com menos de dois ícones.');
const atalhos = (manifest.shortcuts || []).map(s => s.url || '');
for (const u of atalhos) {
  const r = (u.match(/#(\/[a-z0-9:._-]*)/) || [])[1];
  if (r && !rotas.includes(r)) falhas.push('Atalho do manifest para uma rota que já não existe: ' + u);
}

/* ------------------------------------------------------------------- resultado */
if (avisos.length) console.log(avisos.map(a => '· ' + a).join('\n'));
if (falhas.length) {
  console.error('\nFALHAS (' + falhas.length + '):\n');
  console.error(falhas.map(f => ' ✗ ' + f).join('\n\n'));
  process.exit(1);
}
console.log('\nOK — ' + rotas.length + ' rotas, ' + sinais.length + ' sinais desenháveis, ' +
  totalGlossario + ' palavras no glossário, versão ' + versaoSW + '.');
