// Guarda la aplicación para usarla sin conexión.
// Con conexión se pide siempre la versión publicada; la copia guardada solo se usa sin red.
const CACHE = 'solfeo-fichas-v2';
const APP = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Red primero; si no responde en 4 segundos o no hay conexión, la copia guardada
function networkFirst(req, cache) {
  const fromNet = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  const timeout = new Promise((resolve, reject) => setTimeout(reject, 4000));
  return Promise.race([fromNet, timeout])
    .catch(() => cache.match(req, { ignoreSearch: true }))
    .then(res => res || fromNet);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La versión siempre se pide a la red; sin conexión simplemente no se muestra
  if (url.pathname.endsWith('/version.json')) return;
  const isApp = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!isApp && !isFont) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    if (isApp) return networkFirst(req, cache);
    // Tipografías: no cambian, se sirven de la copia guardada
    const cached = await cache.match(req);
    if (cached) return cached;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
    return res;
  }));
});
