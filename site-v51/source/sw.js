/* MED JITA. Network-first assets avoid mixing a new HTML with old scripts. */
const CACHE_NAME = 'med-jita-v51-2026102304';
const BASE = new URL('./', self.registration.scope);
const OFFLINE_FILES = [
  './', './index.html', './atelier.html', './vercel-exit.css', './mobile-editorial-v58.css', './brand-evolution.css', './jita-motion.css', './navigation-motion.css', './jita-curricular.css', './manifest.webmanifest', './JITA_vetorial.svg',
  './apple-touch-icon.png', './favicon.png',
  './icons/icon-192.png', './icons/icon-512.png',
  './assets/estigma-atlas-principal.svg', './assets/estigma-atlas-esquina.svg',
  './assets/estigma-atlas-elaces.svg', './assets/med-jita-logo.svg',
  './assets/med-jita-app-icon.svg', './assets/med-jita-brand-v11.svg', './assets/integrado-oficial-2026.png',
  './assets/completa-organic.svg', './assets/completa-organic-inversa.svg',
  './assets/wordmark-organic.svg', './assets/j-cartola.svg', './assets/jita-cartola-avatar.svg',
  './assets/icon-ajustes.svg', './assets/icon-ajustes-inverso.svg',
  './assets/icon-exportar.svg', './assets/icon-exportar-inverso.svg',
  './assets/icon-salvar.svg', './assets/icon-salvar-inverso.svg',
  './integrations/sync-ui.js', './integrations/editorial-live.js', './integrations/profiles-ui.js',
  './integrations/vercel-exit.js', './integrations/fusion-archive.mjs',
  './integrations/uc-engine.js', './integrations/brand-v08.js', './integrations/jita-motion.js',
  './integrations/gateway-motion.js', './integrations/palette-orbit.js', './integrations/navigation-motion.js',
  './integrations/med-brand-system.js',
  './icons/jita-corpo.svg', './icons/jita-rosto.svg', './icons/jita-rc.svg',
  './icons/jita-morfo.svg', './icons/jita-anatomia.svg',
  './icons/jita-tutoria.svg', './icons/jita-simulacoes.svg',
  './icons/jita-history.svg', './icons/jita-face.svg', './icons/jita-tut.svg',
  './icons/jita-sim.svg',
  './assets/jita-v11/cor/media.svg', './assets/jita-v11/cor/calcular.svg',
  './assets/jita-v11/cor/meta.svg', './assets/jita-v11/cor/simular.svg',
  './assets/jita-v11/cor/historico.svg', './assets/jita-v11/cor/progresso.svg',
  './assets/jita-v11/cor/ajuda.svg', './assets/jita-v11/cor/integrar.svg',
  './assets/jita-v11/cor/salvar.svg',
  './assets/jita-v11/inverso/media.svg', './assets/jita-v11/inverso/calcular.svg',
  './assets/jita-v11/inverso/meta.svg', './assets/jita-v11/inverso/simular.svg',
  './assets/jita-v11/inverso/historico.svg'
].map(path => new URL(path, BASE).href);

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('med-jita-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Do not persist private API responses or public Craft editorial data offline.
  if (new URL(request.url).pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request, { ignoreSearch: true }))
          || (await cache.match(new URL('./index.html', BASE).href, { ignoreSearch: true }))
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const response = await fetch(request, { cache: 'no-store' });
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
