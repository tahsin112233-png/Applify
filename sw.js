const CACHE = 'applify-v4';
const PRECACHE = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
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

  // Network only for API and YouTube
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('ytimg.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('lrclib.net')
  ) {
    e.respondWith(fetch(e.request).catch(() =>
      new Response(JSON.stringify({ error: 'offline' }), {
        headers: { 'Content-Type': 'application/json' }
      })
    ));
    return;
  }

  // Cache first for static
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

// Keep service worker alive for background audio
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
  if (e.data === 'KEEP_ALIVE') {
    // Respond to keep-alive pings from the page
    e.ports[0]?.postMessage('ALIVE');
  }
});
