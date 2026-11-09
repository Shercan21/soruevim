/* Soru Evim service worker — uygulama kabuğu önbellekte, veriler IndexedDB'de. */
const VERSION = 'v2.6.1';
const SHELL = `soruevim-shell-${VERSION}`;
const RUNTIME = 'soruevim-runtime';
const SHELL_FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/app.css', './css/paper.css', './js/design.js',
  './js/app.js', './js/meb.js', './js/db.js', './js/util.js', './js/render.js',
  './js/views/home.js', './js/views/brand.js', './js/views/pool.js', './js/views/editor.js', './js/views/imgtools.js', './js/views/export.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png',
];
// PDF okuyucu (ilk açılışta indirilir, sonra çevrimdışı çalışır)
const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // HTTP önbelleğini atla: her sürümde dosyaların en yenisi alınsın
    await cache.addAll(SHELL_FILES.map(u => new Request(u, { cache: 'reload' })));
    // CDN dosyaları en iyi çaba: başarısız olursa kurulum yine tamamlanır
    const rt = await caches.open(RUNTIME);
    await Promise.all(CDN_FILES.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok && rt.put(u, r)).catch(() => {})));
    self.skipWaiting(); // yeni sürüm beklemeden devreye girsin
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('soruevim-shell-') && k !== SHELL).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); if (e.data === 'version') e.source?.postMessage({ version: VERSION }); });

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Sayfa gezinmeleri: ağ önce, yoksa önbellekteki kabuk (tek sayfa uygulama)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', net.clone());
        return net;
      } catch {
        return (await caches.match('./index.html', { ignoreSearch: true })) || (await caches.match('./'));
      }
    })());
    return;
  }

  // Kendi dosyalarımız: önbellek önce, arkada güncelle (stale-while-revalidate)
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
      return hit || (await net) || new Response('', { status: 504 });
    })());
    return;
  }

  // CDN (pdf.js, KaTeX, QR) ve yazı tipleri: önbellek önce
  if (/^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)\//.test(req.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME);
      const hit = await cache.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok || r.type === 'opaque') cache.put(req, r.clone());
      return r;
    })());
  }
});
