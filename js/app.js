import { $, $$, h, toast } from './util.js';
import { db } from './db.js';
import { homeView, docsView } from './views/home.js';
import { brandView } from './views/brand.js';
import { poolView } from './views/pool.js';
import { editorView } from './views/editor.js';
import { examsView, solveView, examDetailView } from './views/exams.js';

const app = $('#app');
let cleanup = null;

const routes = [
  [/^\/?$/, () => homeView(app), 'home'],
  [/^\/belgeler$/, () => docsView(app), 'belgeler'],
  [/^\/marka$/, () => brandView(app), 'marka'],
  [/^\/havuz$/, () => poolView(app), 'havuz'],
  [/^\/yeni\/(foy|test|yazili|deneme|banka)$/, m => editorView(app, { kind: m[1] }), 'belgeler'],
  [/^\/belge\/([\w-]+)$/, m => editorView(app, { id: m[1] }), 'belgeler'],
  [/^\/sinavlar$/, () => examsView(app), 'sinavlar'],
  [/^\/sinav\/([\w-]+)$/, m => examDetailView(app, m[1]), 'sinavlar'],
  [/^\/coz\/([\w-]+)$/, m => solveView(app, m[1]), 'sinavlar'],
];

async function route() {
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  if (typeof cleanup === 'function') { try { cleanup(); } catch { } }
  cleanup = null;
  for (const [re, fn, nav] of routes) {
    const m = path.match(re);
    if (m) {
      $$('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === nav));
      app.innerHTML = '';
      window.scrollTo(0, 0);
      try { cleanup = await fn(m); } catch (e) { console.error(e); app.append(h('div.card', h('h2', 'Bir şeyler ters gitti'), h('p.muted', String(e.message || e)))); }
      return;
    }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', route);
route();

// ---------- PWA: service worker, kurulum, çevrimdışı ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            const t = $('#toast');
            t.innerHTML = '';
            t.append('Yeni sürüm hazır. ', h('button.btn.btn-sm.btn-accent', { style: { marginLeft: '8px', pointerEvents: 'auto' }, on: { click: () => { nw.postMessage('skipWaiting'); } } }, 'Yenile'));
            t.classList.add('show'); t.style.pointerEvents = 'auto';
          }
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    } catch (e) { console.warn('SW kaydı başarısız', e); }
  });
}

let deferredPrompt = null;
const installBtn = $('#installBtn');
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') toast('Soru Evim yüklendi');
  deferredPrompt = null; installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

const off = $('#offlineBadge');
const net = () => { off.hidden = navigator.onLine; };
window.addEventListener('online', net); window.addEventListener('offline', net); net();

db.persist();
