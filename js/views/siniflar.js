// Sınıflarım: şube ve öğrenci listeleri, öğrenci başına aylık gelişim
import { h, toast, modal, confirmBox, uid, fmtDate, readFileAsText } from '../util.js';
import { db } from '../db.js';

const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const norm = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
const noNorm = s => String(s || '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');

export async function getSiniflar() { return (await db.kvGet('siniflar')) || []; }
export async function setSiniflar(list) { await db.kvSet('siniflar', list); }

// Numaradan (ve varsa şubeden) öğrenci bul
export async function ogrenciBul(no, sube) {
  const n = noNorm(no); if (!n) return null;
  const list = await getSiniflar();
  const aday = list.filter(s => !sube || norm(s.ad) === norm(sube));
  for (const s of (aday.length ? aday : list)) { const o = s.ogrenciler.find(x => noNorm(x.no) === n); if (o) return { ...o, sube: s.ad }; }
  return null;
}

// Sonuç bu öğrenciye mi ait?
const eslesir = (r, o, sube) => {
  const rn = noNorm(r.no), on = noNorm(o.no);
  if (rn && on && rn === on) return !r.sinif || norm(r.sinif) === norm(sube);
  return norm(r.ad) === norm(o.ad);
};

// Listeyi yapıştırılan metinden çıkar: "123 Ali Veli", "Ali Veli 123", "123<TAB>Ali<TAB>Veli", e-Okul satırları
export function listeCoz(text) {
  const out = [];
  for (let line of String(text).split(/\r?\n/)) {
    line = line.replace(/\t+/g, ' ').trim(); if (!line) continue;
    if (/^(s[ıi]ra|no|numara|ad[ıi]?\s)/i.test(line) && !/\d{2,}/.test(line)) continue; // başlık satırı
    const parts = line.split(/\s+/);
    // baştaki sıra no + okul no ("1 123 Ali Veli") → okul no ikinci sayı
    const nums = parts.filter(p => /^\d+$/.test(p));
    const words = parts.filter(p => !/^\d+$/.test(p) && !/^(erkek|kız|kiz|e|k)$/i.test(p));
    if (!words.length) continue;
    const no = nums.length >= 2 ? nums[1] : nums[0] || '';
    out.push({ no, ad: words.join(' ').replace(/\s+/g, ' ') });
  }
  return out;
}

// ---------- Liste ekranı ----------
export async function siniflarView(app) {
  let list = await getSiniflar();
  const results = await db.all('results');
  const save = async () => { await setSiniflar(list); draw(); };
  const wrap = h('div');
  const yeni = () => {
    const ad = h('input.inp', { placeholder: 'Şube adı — ör. 9-A' });
    const ta = h('textarea.inp', { rows: 10, placeholder: 'Öğrenci listesini yapıştırın — her satıra bir öğrenci.\nÖr.\n123 Ayşe Kaya\n145 Mehmet Demir\n\nExcel’den ya da e-Okul’dan kopyaladığınız tabloyu da olduğu gibi yapıştırabilirsiniz.' });
    const onizle = h('p.small.muted');
    ta.addEventListener('input', () => { const l = listeCoz(ta.value); onizle.textContent = l.length ? `${l.length} öğrenci okundu. İlk: ${l[0].no || '(no yok)'} ${l[0].ad}` : ''; });
    let m;
    m = modal('Yeni şube', h('div', { style: { display: 'grid', gap: '10px' } }, h('label.fld', 'Şube adı', ad), h('label.fld', 'Öğrenci listesi', ta), onizle), {
      actions: [h('button.btn.btn-primary', { on: { click: async () => {
        if (!ad.value.trim()) { toast('Şube adı yazın'); return; }
        list.push({ id: uid(), ad: ad.value.trim(), ogrenciler: listeCoz(ta.value), created: Date.now() });
        m.close(); await save(); toast('Şube eklendi');
      } } }, 'Kaydet')] });
    setTimeout(() => ad.focus(), 50);
  };
  const draw = () => {
    wrap.innerHTML = '';
    if (!list.length) { wrap.append(h('div.card.empty', h('p', 'Henüz şube yok.'), h('p.small.muted', 'Şube açıp öğrenci listesini yapıştırın; sınav sonuçları öğrenci numarasından kendiliğinden eşleşir.'), h('button.btn.btn-primary', { on: { click: yeni } }, '+ Şube ekle'))); return; }
    wrap.append(h('div.grid.grid-2', list.sort((a, b) => a.ad.localeCompare(b.ad, 'tr', { numeric: true })).map(s => {
      const rs = results.filter(r => s.ogrenciler.some(o => eslesir(r, o, s.ad)));
      const ort = rs.length ? (rs.reduce((a, r) => a + r.puan, 0) / rs.length).toFixed(1) : '—';
      return h('a.card.kind-card', { href: '#/sinif/' + s.id }, h('div.ico', { style: { fontWeight: 800, fontSize: '.95rem' } }, s.ad.slice(0, 4)),
        h('div', h('h3', s.ad), h('p', `${s.ogrenciler.length} öğrenci · ${rs.length} sonuç · ortalama ${ort}`)), h('span.arrow', '→'));
    })));
  };
  app.append(h('div.row', h('a.btn.btn-sm.btn-ghost', { href: '#/sinavlar' }, '← Sınav ve Karne'), h('h1', { style: { margin: 0 } }, '👥 Sınıflarım'), h('span.spacer'), h('button.btn.btn-primary', { on: { click: yeni } }, '+ Şube ekle')),
    h('p.muted', 'Sonuçlar öğrenci numarasıyla eşleşir. Cevap girerken ya da optik okurken numarayı yazmanız yeterli.'), wrap);
  draw();
}

// ---------- Basit çizgi grafik (SVG) ----------
function cizgi(seriler, etiketler, { max = 100, h: H = 180 } = {}) {
  const W = 640, P = 34, n = etiketler.length;
  const x = i => P + (n === 1 ? (W - 2 * P) / 2 : i * (W - 2 * P) / (n - 1));
  const y = v => H - 24 - (v / max) * (H - 44);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'rp-cizgi');
  const add = (tag, at, txt) => { const e = document.createElementNS(ns, tag); for (const k in at) e.setAttribute(k, at[k]); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  for (const v of [0, 25, 50, 75, 100].filter(v => v <= max)) { add('line', { x1: P, x2: W - P, y1: y(v), y2: y(v), stroke: 'currentColor', 'stroke-opacity': .12 }); add('text', { x: 4, y: y(v) + 4, 'font-size': 10, fill: 'currentColor', 'fill-opacity': .5 }, v); }
  etiketler.forEach((l, i) => add('text', { x: x(i), y: H - 6, 'font-size': 11, 'text-anchor': 'middle', fill: 'currentColor', 'fill-opacity': .7 }, l));
  for (const s of seriler) {
    const pts = s.v.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    if (pts.length > 1) add('polyline', { points: pts.map(p => p.join(',')).join(' '), fill: 'none', stroke: s.renk, 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-dasharray': s.kesik ? '6 5' : '' });
    s.v.forEach((v, i) => { if (v == null) return; add('circle', { cx: x(i), cy: y(v), r: 4.5, fill: s.renk }); if (!s.kesik) add('text', { x: x(i), y: y(v) - 9, 'font-size': 11, 'font-weight': 700, 'text-anchor': 'middle', fill: s.renk }, Math.round(v)); });
  }
  return svg;
}
const ayAnahtar = t => { const d = new Date(t); return d.getFullYear() * 12 + d.getMonth(); };
const ayEtiket = k => AYLAR[k % 12] + ' ' + String(Math.floor(k / 12)).slice(2);
function aylik(rs) {
  const m = new Map();
  for (const r of rs) { const k = ayAnahtar(r.created); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return [...m.keys()].sort((a, b) => a - b).map(k => ({ k, etiket: ayEtiket(k), puan: m.get(k).reduce((a, r) => a + r.puan, 0) / m.get(k).length, net: m.get(k).reduce((a, r) => a + r.net, 0) / m.get(k).length, n: m.get(k).length }));
}

// ---------- Şube ekranı ----------
export async function sinifView(app, id) {
  let list = await getSiniflar();
  const s = list.find(x => x.id === id);
  if (!s) { app.append(h('div.card', 'Şube bulunamadı. ', h('a', { href: '#/siniflar' }, 'Sınıflarım'))); return; }
  const [results, exams] = await Promise.all([db.all('results'), db.all('exams')]);
  const exMap = Object.fromEntries(exams.map(e => [e.id, e]));
  const save = () => setSiniflar(list);
  const sinifSonuc = results.filter(r => exMap[r.examId] && s.ogrenciler.some(o => eslesir(r, o, s.ad)));
  const ay = aylik(sinifSonuc);

  const ekle = () => {
    const ta = h('textarea.inp', { rows: 8, placeholder: '123 Ayşe Kaya\n145 Mehmet Demir' });
    let m; m = modal('Öğrenci ekle — ' + s.ad, h('div', h('p.small.muted', 'Her satıra bir öğrenci; aynı numara varsa adı güncellenir.'), ta), { actions: [h('button.btn.btn-primary', { on: { click: async () => {
      for (const o of listeCoz(ta.value)) { const v = s.ogrenciler.find(x => o.no && noNorm(x.no) === noNorm(o.no)); if (v) v.ad = o.ad; else s.ogrenciler.push(o); }
      await save(); m.close(); location.reload();
    } } }, 'Ekle')] });
  };
  const ogrSatir = o => {
    const rs = sinifSonuc.filter(r => eslesir(r, o, s.ad)).sort((a, b) => a.created - b.created);
    const son = rs.at(-1), once = rs.at(-2);
    const fark = son && once ? son.puan - once.puan : null;
    return h('tr', h('td', o.no || ''), h('td', h('a', { href: `#/ogrenci/${s.id}/${encodeURIComponent(o.no || o.ad)}` }, o.ad)), h('td', String(rs.length)),
      h('td', rs.length ? (rs.reduce((a, r) => a + r.puan, 0) / rs.length).toFixed(1) : '—'),
      h('td', son ? String(son.puan) : '—'), h('td', fark == null ? '' : h('b', { style: { color: fark >= 0 ? '#16a34a' : '#dc2626' } }, (fark >= 0 ? '▲ ' : '▼ ') + Math.abs(fark).toFixed(1))),
      h('td', h('button.icon-btn', { title: 'Listeden çıkar', on: { click: async () => { if (!await confirmBox(o.ad + ' listeden çıkarılsın mı? Sonuçları silinmez.', 'Çıkar')) return; s.ogrenciler = s.ogrenciler.filter(x => x !== o); await save(); location.reload(); } } }, '✕')));
  };
  app.append(...[
    h('div.row', h('a.btn.btn-sm.btn-ghost', { href: '#/siniflar' }, '← Sınıflarım'), h('h1', { style: { margin: 0 } }, s.ad), h('span.spacer'),
      h('button.btn', { on: { click: ekle } }, '+ Öğrenci ekle'),
      h('button.btn.btn-sm.btn-danger', { on: { click: async () => { if (!await confirmBox(s.ad + ' şubesi silinsin mi? Sınav sonuçları silinmez.', 'Sil')) return; list = list.filter(x => x !== s); await setSiniflar(list); location.hash = '#/siniflar'; } } }, 'Şubeyi sil')),
    h('div.rp-ozet', ...[['Öğrenci', s.ogrenciler.length], ['Sınav sonucu', sinifSonuc.length], ['Genel ortalama', sinifSonuc.length ? (sinifSonuc.reduce((a, r) => a + r.puan, 0) / sinifSonuc.length).toFixed(1) : '—'], ['Son ay', ay.length ? ay.at(-1).puan.toFixed(1) : '—']].map(([l, v]) => h('div', h('b', String(v)), h('span', l)))),
    h('div.card', { style: { marginTop: '14px' } }, h('h3', 'Aylık sınıf ortalaması'), ay.length ? cizgi([{ v: ay.map(a => a.puan), renk: '#8b5cf6' }], ay.map(a => a.etiket)) : h('p.muted.small', 'Bu şubenin henüz sınav sonucu yok.')),
    h('div.card', { style: { marginTop: '14px', overflowX: 'auto' } }, h('h3', 'Öğrenciler'),
      s.ogrenciler.length ? h('table.table', h('tr', ['No', 'Ad Soyad', 'Sınav', 'Ortalama', 'Son puan', 'Değişim', ''].map(t => h('th', t))), [...s.ogrenciler].sort((a, b) => (+noNorm(a.no) || 0) - (+noNorm(b.no) || 0)).map(ogrSatir)) : h('p.muted', 'Liste boş.')),
  ]);
}

// ---------- Öğrenci ekranı: aylık gelişim ----------
export async function ogrenciView(app, sid, key) {
  const list = await getSiniflar();
  const s = list.find(x => x.id === sid);
  const o = s?.ogrenciler.find(x => (x.no || x.ad) === key);
  if (!o) { app.append(h('div.card', 'Öğrenci bulunamadı.')); return; }
  const [results, exams] = await Promise.all([db.all('results'), db.all('exams')]);
  const exMap = Object.fromEntries(exams.map(e => [e.id, e]));
  const rs = results.filter(r => exMap[r.examId] && eslesir(r, o, s.ad)).sort((a, b) => a.created - b.created);
  const sinifRs = results.filter(r => exMap[r.examId] && s.ogrenciler.some(x => eslesir(r, x, s.ad)));
  const ay = aylik(rs), sinifAy = aylik(sinifRs);
  const ayK = ay.map(a => a.k);
  // konu bazlı toplam
  const konu = new Map();
  for (const r of rs) { const ex = exMap[r.examId]; ex.sections.flatMap(x => x.qs).forEach((q, i) => { if (!q.answer) return; const k = q.konu || q.kazanim; if (!k) return; if (!konu.has(k)) konu.set(k, { d: 0, n: 0 }); const v = konu.get(k); v.n++; if (r.answers[i] === q.answer) v.d++; }); }
  const konular = [...konu.entries()].map(([k, v]) => ({ k, ...v, p: Math.round(v.d / v.n * 100) })).sort((a, b) => a.p - b.p);
  const renk = p => p >= 70 ? '#16a34a' : p >= 40 ? '#f59e0b' : '#dc2626';
  const ilk = ay[0]?.puan, son = ay.at(-1)?.puan;
  app.append(...[
    h('div.row', h('a.btn.btn-sm.btn-ghost', { href: '#/sinif/' + s.id }, '← ' + s.ad), h('h1', { style: { margin: 0 } }, o.ad), h('span.muted', o.no ? 'No ' + o.no : ''), h('span.spacer'), h('button.btn.btn-sm', { on: { click: () => print() } }, '🖨 Yazdır')),
    h('div.rp-ozet', ...[['Sınav', rs.length], ['Ortalama puan', rs.length ? (rs.reduce((a, r) => a + r.puan, 0) / rs.length).toFixed(1) : '—'], ['Ortalama net', rs.length ? (rs.reduce((a, r) => a + r.net, 0) / rs.length).toFixed(2) : '—'], ['İlk aydan son aya', ay.length > 1 ? ((son - ilk >= 0 ? '+' : '') + (son - ilk).toFixed(1)) : '—']].map(([l, v]) => h('div', h('b', String(v)), h('span', l)))),
    h('div.card', { style: { marginTop: '14px' } }, h('h3', 'Aylık gelişim'),
      ay.length ? h('div', cizgi([{ v: ayK.map(k => sinifAy.find(a => a.k === k)?.puan ?? null), renk: '#94a3b8', kesik: true }, { v: ay.map(a => a.puan), renk: '#8b5cf6' }], ay.map(a => a.etiket)),
        h('div.small.muted', h('span', { style: { color: '#8b5cf6', fontWeight: 700 } }, '● ' + o.ad), '   ', h('span', { style: { color: '#94a3b8', fontWeight: 700 } }, '- - Şube ortalaması'))) : h('p.muted', 'Henüz sınav sonucu yok.'),
      ay.length ? h('table.table', { style: { marginTop: '10px' } }, h('tr', ['Ay', 'Sınav', 'Ortalama puan', 'Ortalama net', 'Şube ortalaması'].map(t => h('th', t))), ay.map(a => h('tr', h('td', a.etiket), h('td', String(a.n)), h('td', h('b', a.puan.toFixed(1))), h('td', a.net.toFixed(2)), h('td', sinifAy.find(x => x.k === a.k)?.puan.toFixed(1) || '—')))) : null),
    konular.length ? h('div.card', { style: { marginTop: '14px' } }, h('h3', 'Konulara göre (bütün sınavlar)'),
      h('table.table', h('tr', h('th', 'Konu / kazanım'), h('th', 'Doğru'), h('th', 'Başarı')), konular.map(k => h('tr', h('td', k.k), h('td', k.d + ' / ' + k.n), h('td', h('div.rp-bar', h('div', { style: { width: Math.max(2, k.p) + '%', background: renk(k.p) } }), h('span', '%' + k.p))))))) : null,
    h('div.card', { style: { marginTop: '14px', overflowX: 'auto' } }, h('h3', 'Girdiği sınavlar'),
      rs.length ? h('table.table', h('tr', ['Tarih', 'Sınav', 'D', 'Y', 'B', 'Net', 'Puan'].map(t => h('th', t))), [...rs].reverse().map(r => h('tr', h('td', fmtDate(r.created)), h('td', h('a', { href: '#/sinav/' + r.examId }, exMap[r.examId].title)), h('td', String(r.d)), h('td', String(r.y)), h('td', String(r.b)), h('td', String(r.net)), h('td', h('b', String(r.puan))))))
        : h('p.muted', 'Yok.')),
  ].filter(Boolean));
}

// Cevap girişi / optik okuma: şube önerileri ve numaradan ad doldurma
export function ogrenciBagla(noInp, adInp, subeInp) {
  getSiniflar().then(list => {
    if (!list.length) return;
    const dl = h('datalist', { id: 'dl-sube-' + uid().slice(0, 6) }, list.map(s => h('option', { value: s.ad })));
    subeInp.after(dl); subeInp.setAttribute('list', dl.id);
  });
  const doldur = async () => {
    const o = await ogrenciBul(noInp.value, subeInp.value);
    if (o) { if (!adInp.value.trim() || adInp.dataset.oto) { adInp.value = o.ad; adInp.dataset.oto = '1'; } if (!subeInp.value.trim()) subeInp.value = o.sube; }
  };
  noInp.addEventListener('input', doldur); subeInp.addEventListener('change', doldur);
  adInp.addEventListener('input', () => delete adInp.dataset.oto);
  if (noInp.value) doldur();
}
