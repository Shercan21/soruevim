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

export const db = {
  all: store => tx(store, 'readonly', s => wrap(s.getAll())),
  get: (store, id) => tx(store, 'readonly', s => wrap(s.get(id))),
  put: (store, obj) => tx(store, 'readwrite', s => wrap(s.put(obj))),
  del: (store, id) => tx(store, 'readwrite', s => wrap(s.delete(id))),
  clear: store => tx(store, 'readwrite', s => wrap(s.clear())),
  kvGet: key => tx('kv', 'readonly', s => wrap(s.get(key))),
  kvSet: (key, val) => tx('kv', 'readwrite', s => wrap(s.put(val, key))),
  async exportAll() {
    const out = { app: 'soruevim', version: 1, exportedAt: new Date().toISOString() };
    for (const s of STORES.filter(x => x !== 'kv' && x !== 'files')) out[s] = await db.all(s);
    out.brand = await db.kvGet('brand');
    out.siniflar = await db.kvGet('siniflar');
    out.ozelKazanimlar = await db.kvGet('ozelKazanimlar');
    out.brans = await db.kvGet('brans');
    return out;
  },
  async importAll(data, { replace = false } = {}) {
    if (!data || data.app !== 'soruevim') throw new Error('Bu dosya bir Soru Evim yedeği değil.');
    for (const s of STORES.filter(x => x !== 'kv' && x !== 'files')) {
      if (replace) await db.clear(s);
      for (const item of data[s] || []) await db.put(s, item);
    }
    if (data.brand) await db.kvSet('brand', data.brand);
    if (data.siniflar) await db.kvSet('siniflar', data.siniflar);
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
