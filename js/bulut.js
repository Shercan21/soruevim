// Google Drive eşitleme: veriler öğretmenin kendi Drive'ındaki gizli uygulama klasöründe (appDataFolder) durur.
// İzin: drive.appdata — yalnızca Soru Evim'in kendi klasörü; kullanıcının diğer dosyalarına erişilmez.
import { db, IZLENEN, KV_IZLENEN } from './db.js';

export const CLIENT_ID = (typeof window !== 'undefined' && window.__SE_CLIENT_ID) || '';   // Google Cloud → OAuth istemci kimliği (Web)
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
const UP = 'https://www.googleapis.com/upload/drive/v3';
const PARCA = { questions: 16, documents: 8 };

let token = null, tokenBitis = 0, tokenClient = null, gisP = null, calisiyor = false, bekleyen = false, zamanlayici = null;
const durumDinleyici = new Set();
export const durum = { bagli: false, son: 0, hata: '', calisiyor: false, eposta: '' };
const yayinla = () => durumDinleyici.forEach(f => { try { f({ ...durum }); } catch { } });
export const dinle = f => { durumDinleyici.add(f); f({ ...durum }); return () => durumDinleyici.delete(f); };

const hash = s => { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36); };
const parcaNo = (id, n) => { let x = 0; for (const c of String(id)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x % n; };
const zaman = x => x?._t || x?.updated || x?.created || 0;

function gisYukle() {
  if (gisP) return gisP;
  gisP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = res; s.onerror = () => { gisP = null; rej(new Error('Google girişi yüklenemedi (internet?)')); }; document.head.append(s); });
  return gisP;
}
async function tokenAl(sessiz) {
  if (token && Date.now() < tokenBitis - 60000) return token;
  if (!CLIENT_ID) throw new Error('Google Drive eşitlemesi henüz yapılandırılmadı.');
  await gisYukle();
  return new Promise((res, rej) => {
    tokenClient = google.accounts.oauth2.initTokenClient({ client_id: CLIENT_ID, scope: SCOPE + ' email', prompt: sessiz ? '' : 'consent',
      callback: r => { if (r.error) return rej(new Error(r.error)); token = r.access_token; tokenBitis = Date.now() + (r.expires_in || 3600) * 1000; res(token); },
      error_callback: e => rej(new Error(e?.type === 'popup_closed' ? 'Giriş penceresi kapatıldı' : e?.type === 'popup_failed_to_open' ? 'Giriş penceresi açılamadı' : 'Giriş yapılamadı')) });
    tokenClient.requestAccessToken({ prompt: sessiz ? '' : 'consent' });
  });
}
async function istek(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: 'Bearer ' + token, ...(opt.headers || {}) } });
  if (r.status === 401) { token = null; throw new Error('Oturum süresi doldu; yeniden bağlanın.'); }
  if (!r.ok) throw new Error('Drive hatası ' + r.status);
  return r;
}
async function dosyalar() {
  const out = []; let page = '';
  do {
    const r = await (await istek(`${API}/files?spaces=appDataFolder&pageSize=200&fields=nextPageToken,files(id,name,appProperties)${page ? '&pageToken=' + page : ''}`)).json();
    out.push(...r.files); page = r.nextPageToken || '';
  } while (page);
  return Object.fromEntries(out.map(f => [f.name, f]));
}
const indir = async id => (await istek(`${API}/files/${id}?alt=media`)).json();
async function yukle(ad, veri, mevcut, h) {
  const meta = { name: ad, appProperties: { h }, ...(mevcut ? {} : { parents: ['appDataFolder'] }) };
  const fd = new FormData();
  fd.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
  fd.append('file', new Blob([JSON.stringify(veri)], { type: 'application/json' }));
  await istek(mevcut ? `${UP}/files/${mevcut.id}?uploadType=multipart` : `${UP}/files?uploadType=multipart`, { method: mevcut ? 'PATCH' : 'POST', body: fd });
}

// Bir deponun eşitlenecek kayıtları: hazır paket soruları (düzenlenmemişse) Drive'a yüklenmez
const eslenir = (store, x) => !(store === 'questions' && x.hazir && !x._t);

async function esitle() {
  const remote = await dosyalar();
  const silinen = (await db.kvGet('silinen')) || {};
  const sonGorulen = (await db.kvGet('bulutGorulen')) || {};
  // 1) meta: ayarlar + mezarlar + hazır paket listesi
  const kvZ = (await db.kvGet('kvZaman')) || {};
  let rMeta = { kv: {}, silinen: {}, hazir: [] };
  if (remote['meta.json'] && remote['meta.json'].appProperties?.h !== sonGorulen['meta.json']) rMeta = await indir(remote['meta.json'].id);
  else if (remote['meta.json']) rMeta = (await db.kvGet('bulutMeta')) || rMeta;
  for (const [k, t] of Object.entries(rMeta.silinen || {})) if (!silinen[k] || silinen[k] < t) silinen[k] = t;
  const kvOut = {};
  for (const key of KV_IZLENEN) {
    const lv = await db.kvGet(key), lt = kvZ[key] || 0, rv = rMeta.kv?.[key];
    if (rv && rv.t > lt) { await db.kvSet(key, rv.v, { bulut: true }); kvZ[key] = rv.t; kvOut[key] = rv; }
    else if (lv !== undefined) kvOut[key] = { v: lv, t: lt };
  }
  await db.kvSet('kvZaman', kvZ);
  // 2) sorular ve belgeler: parça parça birleştir
  let degisenYerel = 0;
  const yerelHazir = new Set();
  for (const store of IZLENEN) {
    const n = PARCA[store], hepsi = await db.all(store);
    const yerel = Array.from({ length: n }, () => new Map());
    for (const x of hepsi) { if (store === 'questions' && x.hazir) yerelHazir.add(x.hazir); if (eslenir(store, x)) yerel[parcaNo(x.id, n)].set(x.id, x); }
    const yerelTum = new Map(hepsi.map(x => [x.id, x]));
    for (let i = 0; i < n; i++) {
      const ad = `${store[0]}-${i}.json`, rf = remote[ad];
      const birlesik = new Map(yerel[i]);
      if (rf && rf.appProperties?.h !== sonGorulen[ad]) {
        for (const x of await indir(rf.id)) {
          const l = birlesik.get(x.id);
          if (!l || zaman(x) > zaman(l)) {
            const m = silinen[store[0] + ':' + x.id];
            if (m && m >= zaman(x)) continue;
            birlesik.set(x.id, x);
            const yl = yerelTum.get(x.id);
            if (!yl || zaman(x) > zaman(yl)) { await db.put(store, x, { sessiz: true, bulut: true }); degisenYerel++; }
          }
        }
      }
      // mezarları uygula
      for (const [id, x] of [...birlesik]) { const m = silinen[store[0] + ':' + id]; if (m && m >= zaman(x)) { birlesik.delete(id); if (yerelTum.has(id)) { await db.del(store, id, { bulut: true }); degisenYerel++; } } }
      const liste = [...birlesik.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const h = hash(JSON.stringify(liste));
      if (!rf || rf.appProperties?.h !== h) { if (liste.length || rf) await yukle(ad, liste, rf, h); }
      sonGorulen[ad] = h;
    }
  }
  // 3) meta yükle
  const hazir = [...new Set([...(rMeta.hazir || []), ...yerelHazir])].sort();
  // 90 günden eski mezarları temizle
  const sinir = Date.now() - 90 * 864e5; for (const k of Object.keys(silinen)) if (silinen[k] < sinir) delete silinen[k];
  const meta = { kv: kvOut, silinen, hazir };
  const mh = hash(JSON.stringify(meta));
  if (remote['meta.json']?.appProperties?.h !== mh) await yukle('meta.json', meta, remote['meta.json'], mh);
  sonGorulen['meta.json'] = mh;
  await db.kvSet('silinen', silinen); await db.kvSet('bulutGorulen', sonGorulen); await db.kvSet('bulutMeta', meta);
  return { degisenYerel, eksikHazir: hazir.filter(p => !yerelHazir.has(p)) };
}

export async function simdiEsitle({ sessiz = false } = {}) {
  if (calisiyor) { bekleyen = true; return; }
  calisiyor = true; durum.calisiyor = true; durum.hata = ''; yayinla();
  try {
    await tokenAl(sessiz);
    const r = await esitle();
    durum.bagli = true; durum.son = Date.now(); await db.kvSet('bulutSon', durum.son); await db.kvSet('bulutBagli', true);
    if (r.eksikHazir.length) window.dispatchEvent(new CustomEvent('soruevim-hazir-eksik', { detail: r.eksikHazir }));
    if (r.degisenYerel) window.dispatchEvent(new CustomEvent('soruevim-buluttan', { detail: r.degisenYerel }));
  } catch (e) { durum.hata = e.message || String(e); }
  finally { calisiyor = false; durum.calisiyor = false; yayinla(); if (bekleyen) { bekleyen = false; setTimeout(() => simdiEsitle({ sessiz: true }), 1500); } }
}
export async function baglan() { token = null; await simdiEsitle({ sessiz: false }); return !durum.hata; }
export async function baglantiyiKes() {
  try { if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => { }); } catch { }
  token = null; durum.bagli = false; durum.hata = ''; await db.kvSet('bulutBagli', false); await db.kvSet('bulutGorulen', {}); yayinla();
}
// Uygulama açılışında: daha önce bağlandıysa sessizce eşitle; değişikliklerden sonra 8 sn bekleyip eşitle
export async function baslat() {
  durum.bagli = !!(await db.kvGet('bulutBagli')); durum.son = (await db.kvGet('bulutSon')) || 0; yayinla();
  window.addEventListener('soruevim-degisti', () => { if (!durum.bagli) return; clearTimeout(zamanlayici); zamanlayici = setTimeout(() => simdiEsitle({ sessiz: true }), 8000); });
  if (durum.bagli && CLIENT_ID && navigator.onLine) setTimeout(() => simdiEsitle({ sessiz: true }), 2500);
}
export const hazirMi = () => !!CLIENT_ID;
