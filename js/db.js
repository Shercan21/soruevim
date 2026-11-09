// IndexedDB katmanı — tüm veriler cihazda kalır.
const DB_NAME = 'soruevim';
const DB_VER = 2;
const STORES = ['kv', 'questions', 'documents', 'exams', 'results', 'files'];
let dbp;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, s === 'kv' ? undefined : { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(r => { out = r; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}
const wrap = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

// Bulut eşitlemesi için değişiklik izleme: sorular ve belgeler zaman damgası (_t) alır,
// silinenler "mezar" olarak kaydedilir; bazı ayarların değişme zamanı tutulur.
export const IZLENEN = ['questions', 'documents'];
export const KV_IZLENEN = ['brand', 'brans', 'ozelKazanimlar', 'ozelSenaryolar'];
const degisti = () => { try { window.dispatchEvent(new Event('soruevim-degisti')); } catch { } };
const ham = {
  put: (store, obj) => tx(store, 'readwrite', s => wrap(s.put(obj))),
  kvGet: key => tx('kv', 'readonly', s => wrap(s.get(key))),
  kvSet: (key, val) => tx('kv', 'readwrite', s => wrap(s.put(val, key))),
};
async function mezar(store, ids) {
  if (!ids.length) return;
  const m = (await ham.kvGet('silinen')) || {}; const t = Date.now();
  for (const id of ids) m[store[0] + ':' + id] = t;
  await ham.kvSet('silinen', m);
}
export const db = {
  all: store => tx(store, 'readonly', s => wrap(s.getAll())),
  get: (store, id) => tx(store, 'readonly', s => wrap(s.get(id))),
  // opt.sessiz: zaman damgası koyma (hazır paket yükleme, buluttan gelen veri)
  put: async (store, obj, opt = {}) => { if (IZLENEN.includes(store) && !opt.sessiz) obj._t = Date.now(); const r = await ham.put(store, obj); if (IZLENEN.includes(store) && !opt.bulut) degisti(); return r; },
  del: async (store, id, opt = {}) => { const r = await tx(store, 'readwrite', s => wrap(s.delete(id))); if (IZLENEN.includes(store) && !opt.bulut) { await mezar(store, [id]); degisti(); } return r; },
  clear: async store => { if (IZLENEN.includes(store)) await mezar(store, (await db.all(store)).map(x => x.id)); const r = await tx(store, 'readwrite', s => wrap(s.clear())); if (IZLENEN.includes(store)) degisti(); return r; },
  kvGet: key => ham.kvGet(key),
  kvSet: async (key, val, opt = {}) => { const r = await ham.kvSet(key, val); if (KV_IZLENEN.includes(key) && !opt.bulut) { const z = (await ham.kvGet('kvZaman')) || {}; z[key] = Date.now(); await ham.kvSet('kvZaman', z); degisti(); } return r; },
  async exportAll() {
    try { await db.kvSet('sonYedek', Date.now()); } catch { }
    const out = { app: 'soruevim', version: 1, exportedAt: new Date().toISOString() };
    for (const s of STORES.filter(x => x !== 'kv' && x !== 'files')) out[s] = await db.all(s);
    out.brand = await db.kvGet('brand');
    out.siniflar = await db.kvGet('siniflar'); out.ozelSenaryolar = await db.kvGet('ozelSenaryolar');
    out.ozelKazanimlar = await db.kvGet('ozelKazanimlar');
    out.brans = await db.kvGet('brans');
    return out;
  },
  async importAll(data, { replace = false } = {}) {
    if (!data || data.app !== 'soruevim') throw new Error('Bu dosya bir Soru Evim yedeği değil.');
    for (const s of STORES.filter(x => x !== 'kv' && x !== 'files')) {
      if (replace) await db.clear(s);
      for (const item of data[s] || []) await db.put(s, item, { sessiz: !!item.hazir && !item._t });
    }
    if (data.brand) await db.kvSet('brand', data.brand);
    if (data.siniflar) await db.kvSet('siniflar', data.siniflar);
    if (data.ozelSenaryolar) await db.kvSet('ozelSenaryolar', data.ozelSenaryolar);
    if (data.ozelKazanimlar) await db.kvSet('ozelKazanimlar', data.ozelKazanimlar);
    if (data.brans) await db.kvSet('brans', data.brans);
  },
  async persist() {
    try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { }
    return false;
  }
};

export const DEFAULT_BRAND = {
  kurum: '', ogretmen: '', iletisim: '', logo: '', renk: '#4C3BB5', renk2: '#C2418F',
  soz: 'İyi çalışmalar.', simge: '', filigran: false, metinFiligran: '', damgalar: [], kapakGorsel: '', look: null,
};
export async function getBrand() {
  const b = { ...DEFAULT_BRAND, ...(await db.kvGet('brand') || {}) };
  if (!b.look) b.look = { baslik: 'serit', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'yayinevi', baslikFont: 'grotesk', altBilgi: 'klasik', boyut: 'lise' };
  return b;
}
