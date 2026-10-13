/* Offline support for What's on Tonight?
   - The page itself: try the network first (so updates you push to GitHub show up),
     but fall back to the saved copy after 3 seconds or when there's no signal.
   - Icons, manifest and Google Fonts: served from the saved copy, fetched once. */
const CACHE = 'tonight-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return caches.open(CACHE).then(cache => {
    const fromNet = fetch(request).then(res => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    });
    const timeout = new Promise(resolve => setTimeout(resolve, 3000));
    const fallback = () => cache.match(request).then(r => r || cache.match('./index.html'));
    return Promise.race([fromNet.catch(() => null), timeout])
      .then(res => res || fallback())
      .then(res => res || fromNet);
  });
}

function cacheFirst(request) {
  return caches.open(CACHE).then(cache =>
    cache.match(request).then(hit => hit || fetch(request).then(res => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    }))
  );
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') { event.respondWith(networkFirst(req)); return; }
  if (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
});
