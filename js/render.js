// A4 sayfa motoru: önizleme ile baskı aynı fonksiyondan üretilir.
import { h, esc, LETTERS, shuffle } from './util.js';

export const FONTS = {
  sans: { ad: 'Modern (Sans)', css: 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif' },
  serif: { ad: 'Klasik (Serif)', css: 'Georgia,"Times New Roman",Cambria,serif' },
  rounded: { ad: 'Yumuşak', css: '"Nunito","Segoe UI Rounded","Arial Rounded MT Bold",system-ui,sans-serif' },
  book: { ad: 'Kitap', css: '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif' },
};
export const HEADERS = { band: 'Renkli bant', line: 'Alt çizgili', tab: 'Sekmeli kutu' };
export const NUMBERS = { madalyon: 'Madalyon', halka: 'Halka', kutu: 'Kutu', duz: 'Düz' };

export const KINDS = {
  foy: { ad: 'Konu Anlatım Föyü', kisa: 'Konu Föyü', aciklama: 'Başlık, not kutusu, örnek — yayınevi düzeni' },
  test: { ad: 'Yaprak Test', kisa: 'Yaprak Test', aciklama: 'Çoktan seçmeli, 2 sütunlu MEB düzeni' },
  yazili: { ad: 'Yazılı Sınav', kisa: 'Yazılı', aciklama: 'Tek sütun, açık uçlu, puan çizelgeli' },
  deneme: { ad: 'Deneme Sınavı', kisa: 'Deneme', aciklama: 'LGS, TYT, AYT ya da genel — bölümlü kitapçık' },
  banka: { ad: 'Soru Bankası', kisa: 'Soru Bankası', aciklama: 'Çok sayfalı derleme — kendi soru kitabınız' },
};

export const DENEME_PRESETS = {
  LGS: { sure: '135 dk', bolumler: [['Türkçe', 20], ['T.C. İnkılap Tarihi ve Atatürkçülük', 10], ['Din Kültürü ve Ahlak Bilgisi', 10], ['Yabancı Dil', 10], ['Matematik', 20], ['Fen Bilimleri', 20]] },
  TYT: { sure: '165 dk', bolumler: [['Türkçe', 40], ['Sosyal Bilimler', 20], ['Temel Matematik', 40], ['Fen Bilimleri', 20]] },
  AYT: { sure: '180 dk', bolumler: [['Matematik', 40], ['Fizik', 14], ['Kimya', 13], ['Biyoloji', 13]] },
  Genel: { sure: '', bolumler: [['Bölüm 1', 0]] },
};

const FOY_LABELS = { formul: 'FORMÜL', ornek: 'ÖRNEK', uyari: 'DİKKAT', alistirma: 'SIRA SİZDE', not: 'NOT' };

// ---------- Soru kutusu ----------
export function questionEl(q, no, { teacher = false, points = null, compact = false, wide = false } = {}) {
  if (!q) return h('div.pq', h('div.no', no + '.'), h('div.qb', h('i', '(Silinmiş soru)')));
  const body = h('div.qb');
  if (q.text) body.append(h('div.qt', q.text));
  if (q.image) body.append(h('img', { src: q.image, alt: '' }));
  const type = q.type || 'coktan';
  if (type === 'coktan') {
    const ch = (q.choices || []).map((c, i) => [LETTERS[i], c]).filter(([, c]) => c && c.trim());
    if (ch.length) {
      const short = ch.every(([, c]) => c.length <= (wide ? 32 : 16));
      body.append(h('div.ch.' + (short ? 'g2' : 'g1'), ch.map(([L, c]) => h('div', h('b', L + ')'), h('span', c)))));
    }
  } else if (type === 'dy') {
    body.append(h('div', { style: { marginTop: '1.5mm' } }, h('span.dy-box'), 'D', '  ', h('span.dy-box', { style: { marginLeft: '4mm' } }), 'Y'));
  } else if (type === 'klasik') {
    const lines = Number(q.bosluk || 4);
    body.append(h('div.ansspace', { style: { height: (lines * 7) + 'mm' } }));
  }
  if (teacher) {
    const ans = type === 'coktan' ? q.answer : type === 'dy' ? (q.answer === 'D' ? 'Doğru' : 'Yanlış') : (q.cevapMetni || q.answer || '');
    if (ans || q.cozum) body.append(h('div.sol', ans ? h('b', 'Cevap: ' + ans + (q.cozum ? ' — ' : '')) : null, q.cozum || ''));
  }
  return h('div.pq' + (compact ? '.compact' : ''),
    h('div.no', String(no)),
    body,
    points != null ? h('div.pts', points + ' p') : null);
}

// ---------- Başlık ----------
function headerEl(brand, doc, first) {
  const title = doc.title || KINDS[doc.kind].ad;
  const meta = [doc.meta?.sinif, doc.meta?.ders, doc.meta?.konu].filter(Boolean).join(' · ');
  if (!first) {
    return h('div.ph-small', h('span', brand.kurum || ''), h('span', title + (doc.kitapcik && doc.kind !== 'foy' ? '  ·  ' + doc.kitapcik + ' kitapçığı' : '')));
  }
  const logo = brand.logo ? h('img.logo', { src: brand.logo, alt: '' }) : null;
  const wrap = h('div.ph.ph-' + (brand.baslik || 'band'),
    logo,
    h('div.ph-t',
      brand.kurum ? h('div.inst', brand.kurum) : null,
      h('div.ttl', title),
      meta ? h('div.sub', meta) : null),
    doc.kind !== 'foy' && doc.kind !== 'banka' && doc.kitapcik ? h('div', { style: { fontWeight: 900, fontSize: '18pt' } }, doc.kitapcik) : null
  );
  const out = h('div', wrap);
  if (['test', 'yazili'].includes(doc.kind)) {
    out.append(h('div.stu-line', h('span', 'Adı Soyadı:'), h('span', { style: { flex: '.5' } }, 'No:'), h('span', { style: { flex: '.5' } }, doc.kind === 'yazili' ? 'Puan:' : 'Süre: ' + (doc.meta?.sure || ''))));
  }
  return out;
}

function footerEl(brand, pno) {
  return h('div.pg-foot',
    brand.logo ? h('img', { src: brand.logo, alt: '', style: { height: '5mm' } }) : null,
    h('span', [brand.ogretmen, brand.iletisim].filter(Boolean).join('  ·  ')),
    h('span.pno', String(pno)));
}

function sheetEl(brand) {
  const s = h('div.sheet.qn-' + (brand.numara || 'madalyon') + (brand.cerceve ? '.frame-line' : ''));
  s.style.setProperty('--paper-acc', brand.renk || '#1B4B7F');
  s.style.setProperty('--paper-font', (FONTS[brand.font] || FONTS.sans).css);
  if (brand.filigran && brand.logo) s.append(h('div.watermark', h('img', { src: brand.logo, alt: '' })));
  return s;
}

// ---------- Sayfalama ----------
// blocks: [{el, newPage?:bool, cols?:1|2}] — sütun taşarsa sonraki sütuna/sayfaya geçer.
async function paginate(host, brand, doc, blocks, { cols = 2, startPage = 1, firstHeader = true } = {}) {
  const pages = [];
  let page, colsEls, ci;
  const newPage = (c = cols) => {
    const s = sheetEl(brand);
    const inner = h('div.pg-in');
    const first = firstHeader && pages.length === 0;
    inner.append(h('div.pg-head', headerEl(brand, doc, first)));
    const body = h('div.pg-body.cols-' + c);
    colsEls = Array.from({ length: c }, () => h('div.col'));
    body.append(...colsEls);
    inner.append(body, footerEl(brand, startPage + pages.length));
    s.append(inner);
    host.append(s);
    pages.push(s);
    page = s; ci = 0;
  };
  newPage();
  for (const b of blocks) {
    await waitImages(b.el);
    if (b.newPage && colsEls.some(c => c.childElementCount)) newPage(b.cols || cols);
    else if (b.cols && b.cols !== colsEls.length) {
      if (colsEls.some(c => c.childElementCount)) newPage(b.cols); else { page.remove(); pages.pop(); newPage(b.cols); }
    }
    let col = colsEls[ci];
    col.append(b.el);
    if (fits(col)) continue;
    b.el.remove();
    // sonraki sütun
    if (ci < colsEls.length - 1 && col.childElementCount) { ci++; colsEls[ci].append(b.el); if (fits(colsEls[ci])) continue; b.el.remove(); }
    if (col.childElementCount || colsEls[ci].childElementCount) newPage(colsEls.length);
    colsEls[ci].append(b.el);
    if (!fits(colsEls[ci])) shrinkToFit(b.el, colsEls[ci]);
  }
  // boş son sayfayı at
  if (pages.length > 1 && !colsEls.some(c => c.childElementCount)) { page.remove(); pages.pop(); }
  return pages;
}
const fits = col => col.scrollHeight <= col.clientHeight + 1;
function shrinkToFit(el, col) {
  for (const img of el.querySelectorAll('img')) img.style.maxHeight = Math.max(40, col.clientHeight - 60) + 'px';
}
function waitImages(el) {
  const imgs = [...el.querySelectorAll('img')];
  return Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
}

function keyPage(brand, doc, groups, pno) {
  const s = sheetEl(brand);
  const inner = h('div.pg-in');
  inner.append(h('div.pg-head', h('div.ph.ph-line', h('div.ph-t', h('div.inst', brand.kurum || ''), h('div.ttl', 'Cevap Anahtarı'), h('div.sub', (doc.title || '') + (doc.kitapcik ? ' · ' + doc.kitapcik + ' kitapçığı' : ''))))));
  const body = h('div', { style: { flex: 1 } });
  for (const g of groups) {
    if (g.name) body.append(h('div.sec-title', g.name));
    body.append(h('div.key-grid', { style: { marginBottom: '6mm' } }, g.items.map(([n, a]) => h('div', h('b', n + '.'), a || '—'))));
  }
  inner.append(body, footerEl(brand, pno));
  s.append(inner);
  return s;
}

function optikPage(brand, doc, groups, pno) {
  const s = sheetEl(brand);
  const inner = h('div.pg-in');
  inner.append(h('div.pg-head', h('div.ph.ph-line', brand.logo ? h('img.logo', { src: brand.logo }) : null, h('div.ph-t', h('div.inst', brand.kurum || ''), h('div.ttl', 'Optik Form'), h('div.sub', doc.title || '')))));
  const body = h('div', { style: { flex: 1 } });
  body.append(h('div.optik-head', h('div', 'Adı Soyadı'), h('div', 'Numara'), h('div', 'Kitapçık: ' + (doc.kitapcik || 'A'))));
  const nChoices = doc.kind === 'deneme' && doc.meta?.tur === 'LGS' ? 4 : 5;
  for (const g of groups) {
    if (g.name) body.append(h('div.sec-title', g.name));
    body.append(h('div.optik', { style: { marginBottom: '5mm' } }, g.items.map(([n]) => h('div.orow', h('span.n', n), LETTERS.slice(0, nChoices).map(L => h('span.bub', L))))));
  }
  inner.append(body, footerEl(brand, pno));
  s.append(inner);
  return s;
}

function coverPage(brand, doc, sections) {
  const s = sheetEl(brand);
  const inner = h('div.pg-in');
  const total = sections.reduce((a, b) => a + b.qs.length, 0);
  inner.append(h('div.cover',
    brand.logo ? h('img', { src: brand.logo }) : null,
    brand.kurum ? h('div', { style: { fontWeight: 700, fontSize: '13pt' } }, brand.kurum) : null,
    h('div.ct', doc.title || 'Deneme Sınavı'),
    h('div', { style: { fontSize: '12pt' } }, [doc.meta?.tur, doc.meta?.sinif].filter(Boolean).join(' · ')),
    doc.kitapcik ? h('div.kit', doc.kitapcik) : null,
    h('table', h('tr', h('th', 'Bölüm'), h('th', 'Soru')), sections.map(sec => h('tr', h('td', sec.name), h('td', String(sec.qs.length)))), h('tr', h('td', h('b', 'Toplam')), h('td', h('b', String(total))))),
    doc.meta?.sure ? h('div', 'Süre: ', h('b', doc.meta.sure)) : null,
    h('div', { style: { fontSize: '9pt', color: '#555', maxWidth: '130mm' } }, doc.meta?.yonerge || 'Cevaplarınızı optik forma kurşun kalemle işaretleyiniz. Her sorunun yalnız bir doğru cevabı vardır.'),
  ));
  inner.append(footerEl(brand, 1));
  s.append(inner);
  return s;
}

// Kitapçık B: soru sırası tohumla karışır, A ile aynı soru kümesi
export function orderedIds(ids, doc) {
  return doc.kitapcik === 'B' ? shuffle(ids, (doc.seed || 1) + 7) : ids;
}

// ---------- Ana giriş ----------
export async function renderDoc(host, doc, qmap, brand, { teacher = false } = {}) {
  host.innerHTML = '';
  const kind = doc.kind;
  const opt = doc.options || {};
  const keyGroups = [];
  let pages = [];

  if (kind === 'foy') {
    const blocks = [];
    let n = 0;
    for (const b of doc.blocks || []) {
      if (b.t === 'soru') { const q = qmap[b.qid]; n++; blocks.push({ el: questionEl(q, n, { teacher, wide: opt.cols === 1 }) }); if (q?.answer) (keyGroups[0] ||= { items: [] }).items.push([n, q.answer]); continue; }
      if (b.t === 'sayfa') { blocks.push({ el: h('div'), newPage: true }); continue; }
      blocks.push({ el: foyBlock(b, teacher) });
    }
    pages = await paginate(host, brand, doc, blocks, { cols: opt.cols || 1 });
  } else if (kind === 'deneme') {
    const sections = (doc.sections || []).map(sec => ({ name: sec.name, qs: orderedIds(sec.qids || [], doc) }));
    const cover = coverPage(brand, doc, sections);
    host.append(cover);
    pages = [cover];
    const blocks = [];
    sections.forEach((sec, si) => {
      const items = [];
      blocks.push({ el: h('div.sec-title', sec.name), newPage: si > 0 || true });
      sec.qs.forEach((id, i) => { const q = qmap[id]; blocks.push({ el: questionEl(q, i + 1, { teacher }) }); items.push([i + 1, q?.answer]); });
      keyGroups.push({ name: sec.name, items });
    });
    const rest = await paginate(host, brand, doc, blocks, { cols: 2, startPage: 2, firstHeader: false });
    pages.push(...rest);
  } else {
    const ids = orderedIds((doc.items || []).map(i => i.qid), doc);
    const ptsMap = Object.fromEntries((doc.items || []).map(i => [i.qid, i.puan]));
    const blocks = [];
    const items = [];
    let lastKonu = null;
    ids.forEach((id, i) => {
      const q = qmap[id];
      if (kind === 'banka' && opt.konuBaslik !== false && q?.konu && q.konu !== lastKonu) { blocks.push({ el: h('div.konu-title', q.konu) }); lastKonu = q.konu; }
      blocks.push({ el: questionEl(q, i + 1, { teacher, points: kind === 'yazili' ? (ptsMap[id] ?? 0) : null, wide: kind === 'yazili' }) });
      items.push([i + 1, q ? (q.type === 'coktan' || !q.type ? q.answer : q.type === 'dy' ? q.answer : (q.cevapMetni ? '✎' : '')) : '']);
    });
    keyGroups.push({ items });
    const cols = kind === 'yazili' ? 1 : (opt.cols || 2);
    pages = await paginate(host, brand, doc, blocks, { cols });
    if (kind === 'banka') pages.forEach(p => p.style.fontSize = '9.5pt');
  }

  const showKey = opt.anahtar !== false && kind !== 'yazili' && keyGroups.some(g => g.items.length);
  if (showKey) host.append(keyPage(brand, doc, keyGroups, pages.length + 1));
  if (opt.optik && ['test', 'deneme'].includes(kind)) host.append(optikPage(brand, doc, keyGroups, pages.length + (showKey ? 2 : 1)));
  return host.querySelectorAll('.sheet').length;
}

function foyBlock(b, teacher) {
  if (b.t === 'baslik') return h('div.fb.fb-baslik', b.text || '');
  if (b.t === 'anlatim') return h('div.fb.fb-anlatim', b.text || '', b.image ? h('img', { src: b.image }) : null);
  const box = h('div.fb.fb-box.fb-' + b.t, h('div', h('span.lbl', FOY_LABELS[b.t] || b.t.toUpperCase())), h('div', b.text || ''));
  if (b.image) box.append(h('img', { src: b.image }));
  if ((b.t === 'ornek' || b.t === 'alistirma') && b.cevap) {
    if (teacher || b.t === 'ornek') box.append(h('div.sol', h('b', b.t === 'ornek' ? 'Çözüm: ' : 'Cevap: '), b.cevap));
    else box.append(h('div.ansspace', { style: { height: '18mm' } }));
  }
  return box;
}

export function brandStyleVars(brand) {
  return `--paper-acc:${esc(brand.renk)};--paper-font:${(FONTS[brand.font] || FONTS.sans).css}`;
}
