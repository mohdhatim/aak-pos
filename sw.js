// Service worker A&A POS
// - Ada internet: ambil index.html terbaru dari GitHub (supaya update terus nampak)
// - Tiada internet: guna salinan yang tersimpan dalam peranti
// Tukar nombor versi ini setiap kali fail app dikemas kini.
const VERSION = 'aak-pos-v9';
const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      // cache:'reload' = abaikan salinan lama dalam browser, ambil terus dari GitHub
      .then(c => c.addAll(APP_FILES.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && !k.endsWith('-fonts')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cuba internet dulu (maks 4 saat), jika gagal guna simpanan
function networkFirst(req, cacheKey) {
  return new Promise(resolve => {
    let done = false;
    const fallback = () => caches.match(cacheKey || req, { ignoreSearch: true })
      .then(hit => hit || caches.match('./index.html'))
      .then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
    const timer = setTimeout(fallback, 4000);
    fetch(req, { cache: 'no-store' }).then(res => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(cacheKey || req, copy));
        if (!done) { done = true; resolve(res); }
      } else fallback();
    }).catch(() => { clearTimeout(timer); fallback(); });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fon Google: simpanan dulu, kemas kini di belakang
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(VERSION + '-fonts').then(async cache => {
        const hit = await cache.match(req);
        const net = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Page utama: internet dulu
  if (req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/aak-pos/')) {
    event.respondWith(networkFirst(req, './index.html'));
    return;
  }

  // Ikon & manifest: simpanan dulu
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }))
  );
});
