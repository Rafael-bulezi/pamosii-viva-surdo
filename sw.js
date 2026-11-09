/* Viva Surdo — service worker (funcionar sem rede)

   Guarda neste aparelho: a página, o estilo, o glossário e o rig das mãos.
   Não guarda: o vídeo que a pessoa abre (fica no aparelho dela e não sai de lá).
   Ao publicar, o `?v=` do index.html e o VERSAO abaixo mudam juntos. */

const VERSAO = 'vs134';
const CASULO = 'casulo-' + VERSAO;

const FICHEIROS = [
  './',
  './index.html',
  './styles.css?v=' + VERSAO,
  './referencias.js?v=' + VERSAO,
  './dados.js?v=' + VERSAO,
  './lga.js?v=' + VERSAO,
  './lga-3d.js?v=' + VERSAO,
  './maos.js?v=' + VERSAO,
  './vendor/three.min.js?v=' + VERSAO,
  './vendor/GLTFLoader.js?v=' + VERSAO,
  './avatar.js?v=' + VERSAO,
  './sinal3d.js?v=' + VERSAO,
  './aoVivo.js?v=' + VERSAO,
  './app.js?v=' + VERSAO,
  './manifest.webmanifest',
  './favicon.ico',
  './assets/logo-mark.png',
  './assets/logo-emblem.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
];

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const c = await caches.open(CASULO);
    await Promise.all(FICHEIROS.map(async f => {
      try {
        const res = await fetch(f, { cache: 'reload' });
        if (res && res.ok) await c.put(f, res);
      } catch (e) { /* um ficheiro em falta não chumba a instalação */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const nome of await caches.keys()) {
      if (nome !== CASULO) await caches.delete(nome);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* navegação: rede primeiro, casulo se não houver rede */
  if (req.mode === 'navigate') {
    ev.respondWith((async () => {
      try {
        const res = await fetch(req);
        /* guardar é um extra: se o cache recusar, a página segue na mesma */
        try {
          const c = await caches.open(CASULO);
          await c.put('./index.html', res.clone());
          await c.put('./', res.clone());
        } catch (e) { /* sem cache, mas com rede */ }
        return res;
      } catch (e) {
        const c = await caches.open(CASULO);
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  /* ficheiros do site: chave exacta (com o ?v=), senão rede */
  if (url.origin === self.location.origin) {
    ev.respondWith((async () => {
      const c = await caches.open(CASULO);
      const guardado = await c.match(req);
      if (guardado) return guardado;
      try {
        const res = await fetch(req);
        /* o modelo 3D (13 MB) fica de fora do cache; e falhar a escrita nunca
           pode estragar uma resposta que veio bem da rede */
        if (res && res.ok && !/\.glb$/i.test(url.pathname)) {
          try { await c.put(req, res.clone()); } catch (e) { /* cache cheio */ }
        }
        return res;
      } catch (e) {
        return Response.error();
      }
    })());
  }
});
