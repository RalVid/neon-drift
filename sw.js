const CACHE = 'neon-drift-v2';
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
    // NOTE: no skipWaiting() here — the page decides when to activate the
    // update (only while the player is on the start screen).
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Let the page trigger activation of a waiting worker.
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function isDocument(req) {
  return req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // App shell (HTML): network-first so a new version is picked up immediately
  // when online, falling back to cache when offline.
  if (isDocument(req)) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('index.html', copy));
        return res;
      }).catch(() =>
        caches.match(req).then(r => r || caches.match('index.html') || caches.match('./'))
      )
    );
    return;
  }

  // Static assets: cache-first with runtime caching.
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
