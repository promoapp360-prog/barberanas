const CACHE_PREFIX = 'anas-barber-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v5`;
const offline = new URL('offline.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.add(new Request(offline, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache personal cards, API requests, or development bundles.
  if (request.mode !== 'navigate' || request.method !== 'GET'
    || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request).catch(async () => (await caches.match(offline, { cacheName: CACHE_NAME })) ?? Response.error()),
  );
});
