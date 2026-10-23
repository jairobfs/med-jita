/* MED JITA. Change the cache version when publishing an updated bundle. */
const CACHE_NAME = 'med-jita-github-v57-identity-20261023';
const BASE = new URL('./', self.registration.scope);
const OFFLINE_FILES = [
  './', './index.html', './independente.html', './calculadora.html', './manifest.webmanifest', './JITA_vetorial.svg',
  './apple-touch-icon.png', './favicon.png',
  './icons/icon-192.png', './icons/icon-512.png',
  './assets/estigma-atlas-principal.svg', './assets/estigma-atlas-esquina.svg',
  './assets/estigma-atlas-elaces.svg', './assets/med-jita-logo.svg',
  './identidade/med-jita-brand-v11.svg',
  './assets/med-jita-app-icon.svg', './assets/jita-cartola-avatar.svg', './assets/integrado-oficial-2026.png',
  './integrations/sync-ui.js', './gateway-enhance.js', './gateway-enhance.css',
  './uc-engine.js', './uc-native.js', './uc-native.css',
  './icons/jita-corpo.svg', './icons/jita-rosto.svg', './icons/jita-rc.svg',
  './icons/jita-morfo.svg', './icons/jita-anatomia.svg',
  './icons/jita-tutoria.svg', './icons/jita-simulacoes.svg',
  './icons/jita-history.svg', './icons/jita-face.svg', './icons/jita-tut.svg',
  './icons/jita-sim.svg'
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
        return (await caches.match(request)) || (await caches.match(new URL('./index.html', BASE).href))
          || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    let cached = await caches.match(request);
    // Recursos com ?v= devem permanecer disponíveis no primeiro uso offline.
    if (!cached && /\.(?:css|js|svg)$/.test(new URL(request.url).pathname)) {
      cached = await caches.match(request, { ignoreSearch: true });
    }
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
