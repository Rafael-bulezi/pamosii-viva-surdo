/* POST /api/sinais — a frase transcrita entra, a lista de sinais sai.

   O modelo não desenha nada: escolhe palavras da lista que a app sabe
   sinalizar (api/sinais-lista.json, gerado do léxico). A resposta é filtrada
   contra essa lista outra vez aqui, por isso uma resposta inventada ou uma
   injecção de prompt só pode devolver palavras que existem.

   A chave vive em OPENROUTER_API_KEY (só na Vercel). Sem chave responde 503 e
   o cliente recua para o motor de regras.                                   */
'use strict';

const LISTA = require('./sinais-lista.json');

const MAX_FRASE = 300;
const MAX_SINAIS = 8;
const POR_MINUTO = 20;
const JANELA = 60000;
const TEMPO_LIMITE = 12000;
const URL = 'https://openrouter.ai/api/v1/chat/completions';

const normalizar = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[?!.,;:]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/* A lista tem «avó» e «avô»: sem acentos as duas caem no mesmo sítio, por isso
   a procura exacta (só caixa e espaços normalizados) vem primeiro. */
const EXATO = new Map(LISTA.palavras.map((p) => [p.palavra.toLowerCase().trim(), p.palavra]));
const CANON = new Map();
for (const p of LISTA.palavras) {
  const n = normalizar(p.palavra);
  if (!CANON.has(n)) CANON.set(n, p.palavra);
}

/* Agrupada por tema: dá ao modelo o contexto que uma lista solta não dá. */
const LISTA_PROMPT = (() => {
  const temas = new Map();
  for (const { palavra, tema } of LISTA.palavras) {
    if (!temas.has(tema)) temas.set(tema, []);
    temas.get(tema).push(palavra);
  }
  return [...temas.entries()].map(([tema, palavras]) => tema + ': ' + palavras.join(', ')).join('\n');
})();

const PROMPT = `És um glosador de estudo para português de Angola. Recebes uma frase falada e devolves os sinais que a sinalizadora sabe fazer, escolhidos SÓ da lista.

Regras:
- Escolhe no máximo ${MAX_SINAIS} palavras da lista, pela ordem em que se sinalizam.
- Artigos, preposições e conjunções caem; verbos auxiliares caem.
- O tempo (hoje, amanhã, ontem) vai à frente.
- O «não» vai no fim.
- Se nada da frase se sinalizar, devolve {"sinais":[]}.
- Não inventes palavras, não expliques, não uses palavras fora da lista.
- Responde apenas com JSON válido: {"sinais":["palavra","palavra"]}

Lista:
${LISTA_PROMPT}`;

const contador = new Map();

function permitir(ip) {
  const agora = Date.now();
  const registo = contador.get(ip);
  if (!registo || agora - registo.inicio > JANELA) {
    contador.set(ip, { inicio: agora, n: 1 });
    if (contador.size > 5000) contador.clear();
    return true;
  }
  if (registo.n >= POR_MINUTO) return false;
  registo.n += 1;
  return true;
}

function filtrar(texto) {
  const limpo = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const inicio = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (inicio < 0 || fim < inicio) return [];
  let dados;
  try { dados = JSON.parse(limpo.slice(inicio, fim + 1)); } catch (e) { return []; }
  const lista = Array.isArray(dados && dados.sinais) ? dados.sinais : [];
  const saida = [];
  for (const cru of lista) {
    if (typeof cru !== 'string') continue;
    const palavra = EXATO.get(cru.toLowerCase().replace(/\s+/g, ' ').trim()) || CANON.get(normalizar(cru));
    if (!palavra || saida.includes(palavra)) continue;
    saida.push(palavra);
    if (saida.length >= MAX_SINAIS) break;
  }
  return saida;
}

async function escolher(frase, chave) {
  const controlo = new AbortController();
  const relogio = setTimeout(() => controlo.abort(), TEMPO_LIMITE);
  try {
    const r = await fetch(URL, {
      method: 'POST',
      signal: controlo.signal,
      headers: {
        authorization: 'Bearer ' + chave,
        'content-type': 'application/json',
        'http-referer': 'https://vivasurdo.vercel.app',
        'x-title': 'Viva Surdo',
      },
      body: JSON.stringify({
        model: process.env.SINAIS_MODELO || 'google/gemini-2.5-flash-lite',
        temperature: 0,
        max_tokens: 120,
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: frase },
        ],
      }),
    });
    if (!r.ok) return null;
    const dados = await r.json();
    const conteudo = dados && dados.choices && dados.choices[0]
      && dados.choices[0].message && dados.choices[0].message.content;
    return filtrar(conteudo);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(relogio);
  }
}

function falha(res, estado, motivo) {
  res.statusCode = estado;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ erro: motivo }));
}

module.exports = async function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') return falha(res, 405, 'metodo');

  const ip = String((req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || 'local')
    .split(',')[0].trim();
  if (!permitir(ip)) return falha(res, 429, 'demasiados_pedidos');

  let corpo = req.body;
  if (typeof corpo === 'string') {
    try { corpo = JSON.parse(corpo); } catch (e) { corpo = null; }
  }
  const frase = corpo && typeof corpo.frase === 'string'
    ? corpo.frase.replace(/\s+/g, ' ').trim()
    : '';
  if (!frase) return falha(res, 400, 'frase_vazia');
  if (frase.length > MAX_FRASE) return falha(res, 400, 'frase_longa');

  const chave = process.env.OPENROUTER_API_KEY;
  if (!chave) return falha(res, 503, 'sem_chave');

  const sinais = await escolher(frase, chave);
  if (!sinais) return falha(res, 502, 'modelo_indisponivel');

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ sinais }));
};

module.exports.filtrar = filtrar;
module.exports.escolher = escolher;
module.exports.PROMPT = PROMPT;
module.exports.normalizar = normalizar;
module.exports.LISTA = LISTA;
