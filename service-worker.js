/**
 * Codex Tools — shared service worker.
 *
 * Caches the page shell of each app on first visit so they work offline.
 * Each app at /<slug>/ registers this file via:
 *
 *   <script>navigator.serviceWorker?.register('../service-worker.js', { scope: './' });</script>
 *
 * The cache key includes the app's URL so different apps don't poison each other.
 */
const CACHE_VERSION = 'codex-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Only cache same-origin requests
  if (url.origin !== location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    if (cached) {
      // Refresh in the background — stale-while-revalidate
      fetch(request).then((r) => r.ok && cache.put(request, r.clone())).catch(() => {});
      return cached;
    }
    try {
      const fresh = await fetch(request);
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    } catch (err) {
      // Offline + nothing cached → fall back to root if HTML
      if (request.headers.get('accept')?.includes('text/html')) {
        return cache.match('./') ?? cache.match('./index.html');
      }
      throw err;
    }
  })());
});
