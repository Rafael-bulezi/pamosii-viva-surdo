/* Testes da função /api/sinais — sem rede, sem chave.
   ----------------------------------------------------------------------------
   A função é o único ponto onde texto do utilizador sai do aparelho, e a única
   coisa que pode correr com dinheiro de terceiros: por isso o que se testa é o
   contrato (estados, limites) e o filtro (uma resposta inventada pelo modelo
   não pode fazer aparecer um sinal que a app não sabe desenhar).

   Corre com: node tools/sinais-test.cjs   (código 1 se falhar)                */

'use strict';

const path = require('path');
const handler = require(path.join(__dirname, '..', 'app', 'api', 'sinais.js'));

const falhas = [];
let feitos = 0;
function ok(cond, nome, extra) {
  feitos += 1;
  if (!cond) falhas.push(nome + (extra !== undefined ? ' → ' + JSON.stringify(extra) : ''));
}

/* --- duplos de req/res ---------------------------------------------------- */
function pedir(corpo, cabecalhos) {
  const res = {
    statusCode: 200, headers: {}, corpo: null, terminou: false,
    setHeader(k, v) { this.headers[k] = v; },
    end(t) { this.corpo = t ? JSON.parse(t) : null; this.terminou = true; },
  };
  const req = { method: 'POST', body: corpo, headers: Object.assign({ 'x-forwarded-for': '10.0.0.1' }, cabecalhos) };
  return { req, res };
}

const CHAMADAS = [];
function fingirFetch(resposta) {
  CHAMADAS.length = 0;
  global.fetch = async (url, opcoes) => {
    CHAMADAS.push({ url, opcoes });
    return resposta;
  };
}
const modeloQueDiz = (conteudo) => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content: conteudo } }] }),
});

(async () => {
  const guardarChave = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  /* --- 1. filtro puro ----------------------------------------------------- */
  ok(handler.normalizar('Bom  DIA, escola?!') === 'bom dia escola', 'normalizar tira acentos, pontuação e duplos espaços',
    handler.normalizar('Bom  DIA, escola?!'));

  const LIMPO = handler.filtrar('{"sinais":["bom dia","ESCOLA"]}');
  ok(LIMPO.length === 2 && LIMPO[0] === 'bom dia' && LIMPO[1] === 'escola', 'filtrar devolve as duas palavras canónicas', LIMPO);

  const CERCADO = handler.filtrar('```json\n{"sinais":["casa"]}\n```');
  ok(CERCADO.length === 1 && CERCADO[0] === 'casa', 'filtrar sobrevive a cercas de código', CERCADO);

  const LIXO = handler.filtrar('Não posso ajudar com isso.');
  ok(Array.isArray(LIXO) && LIXO.length === 0, 'texto sem JSON devolve lista vazia', LIXO);

  const INVENTADO = handler.filtrar('{"sinais":["bom dia","xilogravura","casa","casa","sinal secreto"]}');
  ok(INVENTADO.length === 2 && INVENTADO[0] === 'bom dia' && INVENTADO[1] === 'casa',
    'palavras fora do léxico caem e duplicados ficam um só', INVENTADO);

  const MUITOS = handler.filtrar(JSON.stringify({ sinais: handler.LISTA.palavras.slice(0, 30).map(p => p.palavra) }));
  ok(MUITOS.length === 8, 'filtrar corta em 8 sinais', MUITOS.length);

  const OUTRA_CHAVE = handler.filtrar('{"palavras":["casa"]}');
  ok(OUTRA_CHAVE.length === 0, 'JSON com a chave errada não inventa sinais', OUTRA_CHAVE);

  /* --- 2. estado da função ------------------------------------------------ */
  fingirFetch(modeloQueDiz('{"sinais":["casa"]}'));

  let t = pedir('{"frase":"bom dia"}');
  await handler(t.req, t.res);
  ok(t.res.statusCode === 503 && t.res.corpo.erro === 'sem_chave', 'sem OPENROUTER_API_KEY responde 503 sem_chave', t.res.corpo);
  ok(CHAMADAS.length === 0, 'sem chave não gasta um pedido ao modelo');

  process.env.OPENROUTER_API_KEY = 'sk-de-teste-nao-real';
  try {
    t = pedir('{"frase":"bom dia"}'); t.req.method = 'GET';
    await handler(t.req, t.res);
    ok(t.res.statusCode === 405, 'método diferente de POST dá 405', t.res.statusCode);

    for (const [nome, corpo] of [
      ['frase vazia', '{"frase":"   "}'],
      ['sem corpo', null],
      ['corpo que não é JSON', 'isto não é json'],
      ['frase não textual', '{"frase":{"$ne":null}}'],
    ]) {
      t = pedir(corpo);
      await handler(t.req, t.res);
      ok(t.res.statusCode === 400 && t.res.corpo.erro === 'frase_vazia', nome + ' dá 400 frase_vazia', t.res.corpo);
    }

    t = pedir(JSON.stringify({ frase: 'a'.repeat(301) }));
    await handler(t.req, t.res);
    ok(t.res.statusCode === 400 && t.res.corpo.erro === 'frase_longa', 'frase acima de 300 caracteres dá 400 frase_longa', t.res.corpo);

    t = pedir(JSON.stringify({ frase: 'bom dia' }), { 'x-forwarded-for': '10.1.1.1' });
    await handler(t.req, t.res);
    ok(t.res.statusCode === 200 && Array.isArray(t.res.corpo.sinais), 'pedido válido com chave responde 200 com sinais', t.res.corpo);
    ok(CHAMADAS.length === 1 && CHAMADAS[0].url.indexOf('openrouter.ai/api/v1/chat/completions') > 0,
      'chama o OpenRouter', CHAMADAS.length);

    const env = CHAMADAS[0].opcoes;
    ok(env.headers.authorization === 'Bearer sk-de-teste-nao-real', 'chave vai no cabeçalho Bearer');
    ok(JSON.stringify(env.body).indexOf('sk-de-teste-nao-real') < 0, 'chave não viaja no corpo do pedido');
    const corpo = JSON.parse(env.body);
    ok(corpo.temperature === 0, 'temperature 0 para a resposta ser repetível', corpo.temperature);
    ok(corpo.messages[0].role === 'system' && corpo.messages[0].content === handler.PROMPT,
      'o prompt de sistema é o do ficheiro');
    ok(corpo.messages[1].content === 'bom dia', 'a frase vai como mensagem do utilizador', corpo.messages[1].content);

    /* resposta suja: cercas, inventadas, duplicadas, outra caixa */
    fingirFetch(modeloQueDiz('```json\n{"sinais":["Bom Dia","xilogravura","ONDE FICA","bom dia","escola"]}\n```'));
    t = pedir('{"frase":"bom dia onde fica a escola"}', { 'x-forwarded-for': '10.1.1.2' });
    await handler(t.req, t.res);
    ok(t.res.statusCode === 200, 'resposta suja ainda dá 200', t.res.statusCode);
    const s = t.res.corpo.sinais;
    ok(s.length === 3 && s.join('|') === 'bom dia|onde fica|escola', 'só passam sinais do léxico, sem repetidos', s);

    /* ordem: o filtro não reordena — a ordem é a do modelo, imposta pelo prompt */
    fingirFetch(modeloQueDiz('{"sinais":["amanhã","casa","não"]}'));
    t = pedir('{"frase":"amanhã casa não"}', { 'x-forwarded-for': '10.1.1.3' });
    await handler(t.req, t.res);
    ok(t.res.corpo.sinais.join('|') === 'amanhã|casa|não', 'o filtro devolve a ordem do modelo intacta', t.res.corpo.sinais);
    ok(/tempo .*à frente/i.test(handler.PROMPT) && /«não» vai no fim/.test(handler.PROMPT),
      'o prompt é que manda o tempo à frente e o «não» para o fim');

    /* avó/avô: a procura exacta tem de desempatar as duas */
    fingirFetch(modeloQueDiz('{"sinais":["avô","avó","AVÓ"]}'));
    t = pedir('{"frase":"a minha avó e o meu avô"}', { 'x-forwarded-for': '10.1.1.6' });
    await handler(t.req, t.res);
    ok(t.res.corpo.sinais.join('|') === 'avô|avó', 'avó e avô não colapsam um no outro', t.res.corpo.sinais);

    fingirFetch({ ok: false, status: 500, json: async () => ({}) });
    t = pedir('{"frase":"bom dia"}', { 'x-forwarded-for': '10.1.1.4' });
    await handler(t.req, t.res);
    ok(t.res.statusCode === 502 && t.res.corpo.erro === 'modelo_indisponivel', 'falha do fornecedor dá 502', t.res.corpo);

    global.fetch = async () => { throw new Error('rede em baixo'); };
    t = pedir('{"frase":"bom dia"}', { 'x-forwarded-for': '10.1.1.5' });
    await handler(t.req, t.res);
    ok(t.res.statusCode === 502, 'rede em baixo dá 502 em vez de rebentar', t.res.statusCode);

    /* --- 3. limite por IP ------------------------------------------------- */
    fingirFetch(modeloQueDiz('{"sinais":["casa"]}'));
    let estado = 0;
    for (let i = 0; i < 21; i++) {
      t = pedir('{"frase":"casa"}', { 'x-forwarded-for': '10.9.9.9' });
      await handler(t.req, t.res);
      estado = t.res.statusCode;
      if (i === 19) ok(estado === 200, 'o 20.º pedido do mesmo IP ainda passa', estado);
    }
    ok(estado === 429, 'o 21.º pedido do mesmo IP é travado com 429', estado);
    ok(CHAMADAS.length === 20, 'o travão poupa o modelo: 20 chamadas, não 21', CHAMADAS.length);

    /* --- 4. retrato do léxico --------------------------------------------- */
    const palavras = handler.LISTA.palavras.map(p => p.palavra);
    ok(palavras.length === new Set(palavras).size, 'o retrato não tem palavras repetidas');
    ok(palavras.length === handler.LISTA.total, 'o total do retrato bate com a lista', [palavras.length, handler.LISTA.total]);
    ok(handler.PROMPT.indexOf('Lista:') > 0 && handler.PROMPT.indexOf(palavras[0]) > 0,
      'o prompt leva a lista do retrato');
  } finally {
    if (guardarChave === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = guardarChave;
  }

  if (falhas.length) {
    console.error('FALHOU — ' + falhas.length + ' de ' + feitos + ' verificações\n· ' + falhas.join('\n· '));
    process.exit(1);
  }
  console.log('OK — ' + feitos + ' verificações em api/sinais.js (contrato, filtro, limite, retrato)');
})();
