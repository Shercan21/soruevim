import { $, $$, h, toast, readFileAsText } from './util.js';
import { db } from './db.js';
import { homeView, docsView, startTour } from './views/home.js';
import { brandView } from './views/brand.js';
import { poolView } from './views/pool.js';
import { editorView, introView } from './views/editor.js';
import { examsView, solveView, examDetailView } from './views/exams.js';

const app = $('#app');
let cleanup = null;

const takeQids = () => { const s = sessionStorage.getItem('yeniQids'); sessionStorage.removeItem('yeniQids'); try { return s ? JSON.parse(s) : null; } catch { return null; } };
const lazy = (path, fn) => async (...a) => (await import(path))[fn](...a);

const routes = [
  [/^\/?$/, () => homeView(app), 'home'],
  [/^\/belgeler$/, () => docsView(app), 'belgeler'],
  [/^\/marka$/, () => brandView(app), 'marka'],
  [/^\/havuz$/, () => poolView(app), 'havuz'],
  [/^\/yeni\/(foy|test|yazili|deneme|banka)$/, m => introView(app, m[1], { qids: takeQids() }), 'home'],
  [/^\/belge\/([\w-]+)$/, m => editorView(app, { id: m[1] }), 'belgeler'],
  [/^\/sinavlar$/, () => examsView(app), 'sinavlar'],
  [/^\/sinav\/([\w-]+)$/, m => examDetailView(app, m[1]), 'sinavlar'],
  [/^\/coz\/([\w-]+)$/, m => solveView(app, m[1]), 'sinavlar'],
  [/^\/tahta$/, () => lazy('./views/board.js', 'boardView')(app), 'havuz'],
  [/^\/zkitap\/([\w-]+)$/, m => lazy('./views/board.js', 'zkitapView')(app, m[1]), 'belgeler'],
  [/^\/online\/(.+)$/, m => lazy('./views/online.js', 'onlineSolveView')(app, m[1]), 'sinavlar'],
  [/^\/sonuc\/(.+)$/, m => lazy('./views/online.js', 'resultImportView')(app, m[1]), 'sinavlar'],
];

async function route() {
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  if (typeof cleanup === 'function') { try { cleanup(); } catch { } }
  cleanup = null;
  document.querySelectorAll('.modal-bg').forEach(m => m.remove());
  document.body.classList.remove('student-mode');
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

// ---------- Görünüm (açık / koyu / sistem) ----------
const applyTheme = t => {
  const dark = t === 'koyu' || (t === 'sistem' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#1d2129' : '#1B4B7F');
};
let theme = localStorage.getItem('tema') || 'acik';
applyTheme(theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(theme));

// ---------- Menü ----------
const openInp = h('input', { type: 'file', accept: '.soruevim,.json,application/json', hidden: true, on: { change: async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = '';
  try {
    const d = JSON.parse(await readFileAsText(f));
    if (d.tip === 'belge' && d.belge) {
      for (const q of d.questions || []) await db.put('questions', q);
      const doc = { ...d.belge, updated: Date.now() };
      if (await db.get('documents', doc.id)) doc.id = crypto.randomUUID();
      await db.put('documents', doc); toast('Belge açıldı'); location.hash = '#/belge/' + doc.id;
    } else if (d.app === 'soruevim') { await db.importAll(d); toast('Yedek içe aktarıldı'); location.reload(); }
    else toast('Bu dosya bir Soru Evim belgesi değil');
  } catch { toast('Dosya okunamadı'); }
} } });
const themeBtns = h('div.seg', { style: { margin: '4px 8px' } }, [['acik', 'Açık'], ['koyu', 'Koyu'], ['sistem', 'Sistem']].map(([v, l]) => h('button' + (theme === v ? '.on' : ''), { type: 'button', on: { click: e => { theme = v; localStorage.setItem('tema', v); applyTheme(v); [...themeBtns.children].forEach(b => b.classList.toggle('on', b === e.target)); } } }, l)));
async function forceUpdate() {
  toast('Güncelleniyor…');
  try {
    // Yalnız uygulama dosyalarının önbelleği temizlenir; sorular ve belgeler (IndexedDB) yerinde kalır
    for (const r of await navigator.serviceWorker?.getRegistrations?.() || []) await r.unregister();
    for (const k of await caches.keys()) if (k.startsWith('soruevim-')) await caches.delete(k);
    await Promise.all(['./', './index.html', './sw.js', './css/app.css', './css/paper.css', './js/app.js', './js/db.js', './js/util.js', './js/render.js', './js/design.js', './js/meb.js', ...['home', 'brand', 'pool', 'editor', 'exams', 'imgtools', 'board', 'online', 'optik'].map(v => `./js/views/${v}.js`)].map(u => fetch(u, { cache: 'reload' }).catch(() => { })));
  } catch { }
  location.reload();
}
document.body.append(openInp);
// Tema ve güncelleme, ana sayfanın altındaki küçük satırda gösterilir
const themeSeg = () => h('div.seg', [['acik', '☀️ Açık'], ['koyu', '🌙 Koyu'], ['sistem', '🖥 Sistem']].map(([v, l]) => h('button' + (theme === v ? '.on' : ''), { type: 'button', on: { click: e => { theme = v; localStorage.setItem('tema', v); applyTheme(v); [...e.currentTarget.parentNode.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); } } }, l)));
window.__soruevim = { themeSeg, forceUpdate, openFile: () => openInp.click(), tour: () => { location.hash = '#/'; setTimeout(startTour, 400); } };

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
      // Uygulama her öne geldiğinde yeni sürüm var mı bak (telefonda kurulu uygulama için)
      const check = () => reg.update().catch(() => { });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60 * 1000);
      window.__swReg = reg;
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
