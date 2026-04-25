const CACHE = 'applify-v2';
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always network-first for API calls
  if (url.pathname.startsWith('/api/') || url.hostname === 'lrclib.net') {
    e.respondWith(
      fetch(e.request, { signal: AbortSignal.timeout(12000) }).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // External audio streams — always network
  if (url.hostname.includes('googlevideo') || url.hostname.includes('piped') || url.hostname.includes('invidious')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
