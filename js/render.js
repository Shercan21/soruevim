// A4 sayfa motoru: önizleme ile baskı aynı fonksiyondan üretilir.
import { h, esc, LETTERS, shuffle, rng } from './util.js';
import { ciktiMetni } from './meb.js';
import { BODY_FONTS, TITLE_FONTS, SIZES, PAPERS, DEFAULT_LOOK, loadQR } from './design.js';

export const KINDS = {
  foy: { ad: 'Konu Anlatımı', kisa: 'Konu Anlatımı', aciklama: 'Başlıklar, bilgi kutuları, çözümlü örnekler', ek: 'Konu' },
  test: { ad: 'Test', kisa: 'Test', aciklama: 'Tek konuda kısa çoktan seçmeli test, cevap anahtarlı', ek: 'Test' },
  yazili: { ad: 'Dönem Yazılısı', kisa: 'Yazılı', aciklama: 'MEB senaryolu, puanlı, açık uçlu ya da karma', ek: 'Yazılı' },
  deneme: { ad: 'Deneme Kitapçığı', kisa: 'Deneme', aciklama: 'Genel ya da branş denemesi — LGS, TYT, AYT, okul', ek: 'Deneme' },
  banka: { ad: 'Soru Kitabı', kisa: 'Soru Kitabı', aciklama: 'Kapaklı, içindekiler sayfalı, ünite ünite', ek: 'Soru Kitabı' },
};

// ---------- Deneme türleri ----------
const S = (name, n, sure) => ({ name, n, sure });
const DK = n => Math.max(10, Math.round(n * 1.4));
const B = (id, ad, ders, n, sec) => ({ id, ad, grup: 'Branş denemesi', ders, sure: DK(n), bolumler: [S(sec || ders, n)] });
export const BRANSLAR = ['Türkçe', 'Matematik', 'Fizik', 'Kimya', 'Biyoloji', 'Tarih', 'Coğrafya', 'Felsefe', 'Türk Dili ve Edebiyatı', 'Din Kültürü ve Ahlak Bilgisi', 'Fen Bilimleri', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Yabancı Dil'];
export const DENEME_TURLERI = [
  { aile: 'LGS', not: '3 yanlış 1 doğruyu götürür (net = D − Y/3).', ceza: 3, sik: 4, turler: [
    { id: 'lgs-sozel', ad: 'LGS Sözel Bölüm', grup: 'Genel deneme', sure: 75, bolumler: [S('Türkçe', 20), S('T.C. İnkılap Tarihi ve Atatürkçülük', 10), S('Din Kültürü ve Ahlak Bilgisi', 10), S('Yabancı Dil', 10)] },
    { id: 'lgs-sayisal', ad: 'LGS Sayısal Bölüm', grup: 'Genel deneme', sure: 80, bolumler: [S('Matematik', 20), S('Fen Bilimleri', 20)] },
    { ...B('lgs-tr', 'LGS Türkçe', 'Türkçe', 20), sure: 30 },
    { ...B('lgs-mat', 'LGS Matematik', 'Matematik', 20), sure: 40 },
    { ...B('lgs-fen', 'LGS Fen Bilimleri', 'Fen Bilimleri', 20), sure: 40 },
    { ...B('lgs-ink', 'LGS İnkılap Tarihi', 'T.C. İnkılap Tarihi ve Atatürkçülük', 10), sure: 15 },
    { ...B('lgs-din', 'LGS Din Kültürü', 'Din Kültürü ve Ahlak Bilgisi', 10), sure: 15 },
    { ...B('lgs-ing', 'LGS Yabancı Dil', 'Yabancı Dil', 10), sure: 15 },
  ] },
  { aile: 'YKS', not: '4 yanlış 1 doğruyu götürür (net = D − Y/4).', ceza: 4, sik: 5, turler: [
    { id: 'tyt', ad: 'TYT', grup: 'Genel deneme', sure: 165, bolumler: [S('Türkçe', 40), S('Sosyal Bilimler', 20), S('Temel Matematik', 40), S('Fen Bilimleri', 20)] },
    { id: 'ayt-say', ad: 'AYT Sayısal', grup: 'Genel deneme', sure: 90, bolumler: [S('Matematik', 40), S('Fizik', 14), S('Kimya', 13), S('Biyoloji', 13)] },
    { id: 'ayt-ea', ad: 'AYT Eşit Ağırlık', grup: 'Genel deneme', sure: 90, bolumler: [S('Matematik', 40), S('Türk Dili ve Edebiyatı', 24), S('Tarih-1', 10), S('Coğrafya-1', 6)] },
    { id: 'ayt-soz', ad: 'AYT Sözel', grup: 'Genel deneme', sure: 90, bolumler: [S('Türk Dili ve Edebiyatı', 24), S('Tarih-1', 10), S('Coğrafya-1', 6), S('Tarih-2', 11), S('Coğrafya-2', 11), S('Felsefe Grubu', 12), S('Din Kültürü', 6)] },
    { id: 'ayt-tam', ad: 'AYT Tam Kitapçık', grup: 'Genel deneme', sure: 180, bolumler: [S('Türk Dili ve Edebiyatı–Sosyal Bilimler-1', 40), S('Sosyal Bilimler-2', 40), S('Matematik', 40), S('Fen Bilimleri', 40)] },
    { id: 'ydt', ad: 'YDT', grup: 'Genel deneme', sure: 120, bolumler: [S('Yabancı Dil', 80)] },
    { id: 'tyt-fen', ad: 'TYT Fen Bilimleri', grup: 'Alan denemesi', sure: 28, bolumler: [S('Fizik', 7), S('Kimya', 7), S('Biyoloji', 6)] },
    { id: 'tyt-sos', ad: 'TYT Sosyal Bilimler', grup: 'Alan denemesi', sure: 28, bolumler: [S('Tarih', 5), S('Coğrafya', 5), S('Felsefe', 5), S('Din Kültürü', 5)] },
    { id: 'ayt-fen', ad: 'AYT Fen Bilimleri', grup: 'Alan denemesi', sure: 45, bolumler: [S('Fizik', 14), S('Kimya', 13), S('Biyoloji', 13)] },
    { id: 'ayt-ed', ad: 'AYT Edebiyat–Sosyal-1', grup: 'Alan denemesi', sure: 45, bolumler: [S('Türk Dili ve Edebiyatı', 24), S('Tarih-1', 10), S('Coğrafya-1', 6)] },
    { id: 'ayt-sos2', ad: 'AYT Sosyal Bilimler-2', grup: 'Alan denemesi', sure: 45, bolumler: [S('Tarih-2', 11), S('Coğrafya-2', 11), S('Felsefe Grubu', 12), S('Din Kültürü', 6)] },
    { ...B('tyt-tr', 'TYT Türkçe', 'Türkçe', 40), sure: 55 },
    { ...B('tyt-mat', 'TYT Temel Matematik', 'Matematik', 40, 'Temel Matematik'), sure: 55 },
    B('tyt-fiz', 'TYT Fizik', 'Fizik', 7), B('tyt-kim', 'TYT Kimya', 'Kimya', 7), B('tyt-biy', 'TYT Biyoloji', 'Biyoloji', 6),
    B('tyt-tar', 'TYT Tarih', 'Tarih', 5), B('tyt-cog', 'TYT Coğrafya', 'Coğrafya', 5), B('tyt-fel', 'TYT Felsefe', 'Felsefe', 5), B('tyt-din', 'TYT Din Kültürü', 'Din Kültürü ve Ahlak Bilgisi', 5),
    { ...B('ayt-mat', 'AYT Matematik', 'Matematik', 40), sure: 60 },
    B('ayt-fiz', 'AYT Fizik', 'Fizik', 14), B('ayt-kim', 'AYT Kimya', 'Kimya', 13), B('ayt-biy', 'AYT Biyoloji', 'Biyoloji', 13),
    { ...B('ayt-edb', 'AYT Edebiyat', 'Türk Dili ve Edebiyatı', 24), sure: 35 },
    { id: 'ayt-tar', ad: 'AYT Tarih (1 + 2)', grup: 'Branş denemesi', ders: 'Tarih', sure: 30, bolumler: [S('Tarih-1', 10), S('Tarih-2', 11)] },
    { id: 'ayt-cog', ad: 'AYT Coğrafya (1 + 2)', grup: 'Branş denemesi', ders: 'Coğrafya', sure: 25, bolumler: [S('Coğrafya-1', 6), S('Coğrafya-2', 11)] },
    B('ayt-fel', 'AYT Felsefe Grubu', 'Felsefe', 12, 'Felsefe Grubu'), B('ayt-din', 'AYT Din Kültürü', 'Din Kültürü ve Ahlak Bilgisi', 6),
  ] },
  { aile: 'Serbest', not: 'Yanlış cevap doğruyu götürmez.', ceza: 0, sik: 5, turler: [
    { id: 'serbest', ad: 'Serbest Deneme', grup: 'Genel deneme', sure: 0, bolumler: [S('Bölüm 1', 0)] },
    ...BRANSLAR.map((d, i) => ({ id: 'okul-' + i, ad: 'Okul ' + d + ' Denemesi', grup: 'Branş denemesi', ders: d, sure: 40, bolumler: [S(d, 20)] })),
  ] },
];
export const denemeTuru = id => { for (const a of DENEME_TURLERI) for (const t of a.turler) if (t.id === id) return { ...t, aile: a.aile, ceza: a.ceza, sik: a.sik, not: a.not }; return null; };

export const FOY_LABELS = { not: 'NOT', dikkat: 'DİKKAT', kural: 'KURAL', tanim: 'TANIM', puf: 'İPUCU', formul: 'FORMÜL', ornek: 'Örnek', alistirma: 'Şimdi Sen' };

// Varsayılan belge ayarları
// Aynı belge türünün hazır ayarları farklı kolları (Oluştur'da ayrı kart olarak görünür)
export const VARIANTS = {
  tarama: { kind: 'test', ad: 'Tarama Testi', aciklama: 'Ünite ya da dönem taraması, sonda kazanım listesi',
    ayar: { ogrenmeCiktilari: true, bosluk: 8 }, sure: '60 dk' },
};
export const kindInfo = k => VARIANTS[k] || KINDS[k];

export function defaultAyar(kind) {
  return {
    kagit: 'A4', bosluk: kind === 'banka' ? 6 : 10, olcek: 100,
    puanEtiketi: false, okul: '', testAdi: '', ogretmen: '', yil: '', donem: '', tarih: '',
    ogrenci: { ad: kind !== 'foy' && kind !== 'banka', sinif: kind === 'test' || kind === 'yazili', no: kind === 'test' || kind === 'yazili', puan: kind === 'yazili', veli: false },
    anahtar: kind !== 'yazili', ogrenmeCiktilari: false, cozumler: 'yok', anahtarYeri: 'ayri', optik: kind === 'deneme',
    kapak: kind === 'deneme' || kind === 'banka', icindekiler: kind === 'banka', kaynak: '', karekod: '',
    yonerge: '', yonergeYer: 'ust', imzalar: [], cevapAlani: 'cerceve', cevapYukseklik: 40,
    kitapciklar: ['A'], cols: kind === 'foy' || kind === 'yazili' ? 1 : 2, foyCevap: 'yok',
  };
}

// ---------- Zengin metin ----------
let KATEX = null;
export function setKatex(k) { KATEX = k; }
export function rich(text) {
  if (text == null) return '';
  let s = String(text);
  const math = [];
  s = s.replace(/\$\$([^$]+)\$\$|\$([^$\n]+)\$/g, (m, a, b) => { math.push([a || b, !!a]); return `\u0000${math.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/!!(.+?)!!/g, '<span class="r-warn">$1</span>')
    .replace(/==(.+?)==/g, '<span class="r-hl">$1</span>')
    .replace(/\+\+(.+?)\+\+/g, '<span class="r-hl2">$1</span>')
    .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>')
    .replace(/_\{([^}]*)\}/g, '<sub>$1</sub>')
    .replace(/(?<=[\p{L}\p{N})\]])\^([0-9+\-−]+)/gu, '<sup>$1</sup>')
    .replace(/(?<=[\p{L})\]])_([0-9]+)/gu, '<sub>$1</sub>');
  // madde işaretleri
  const lines = s.split('\n'); const out = []; let inList = false;
  for (const ln of lines) {
    const m = ln.match(/^\s*(?:-|•|▸)\s+(.*)$/);
    if (m) { if (!inList) { out.push('<ul class="r-list">'); inList = true; } out.push('<li>' + m[1] + '</li>'); }
    else { if (inList) { out.push('</ul>'); inList = false; } out.push(ln + '\n'); }
  }
  if (inList) out.push('</ul>');
  s = out.join('').replace(/\n$/, '').replace(/<\/ul>\n/g, '</ul>');
  s = s.replace(/\u0000(\d+)\u0000/g, (m, i) => {
    const [tex, disp] = math[+i];
    if (KATEX) { try { return KATEX.renderToString(tex, { throwOnError: false, displayMode: disp }); } catch { } }
    return esc(tex);
  });
  return s;
}
const R = (tag, text, props = {}) => h(tag, { ...props, html: rich(text) });

// ---------- Görünüm ----------
export function lookOf(brand, doc) { return { ...DEFAULT_LOOK, ...(brand.look || {}), ...(doc?.gorunum || {}) }; }

function sheetEl(ctx) {
  const { brand, look, ayar } = ctx;
  const [pw, ph] = PAPERS[ayar.kagit] || PAPERS.A4;
  const s = h('div.sheet.qn-' + look.soruNo + '.tpl-' + look.sablon + '.pn-' + look.sayfaNo);
  const st = s.style;
  st.setProperty('--acc', brand.renk || '#4C3BB5');
  st.setProperty('--acc2', brand.renk2 || brand.renk || '#C2418F');
  st.setProperty('--pf', (BODY_FONTS[look.govdeFont] || BODY_FONTS.yayinevi).css);
  st.setProperty('--tf', (TITLE_FONTS[look.baslikFont] || TITLE_FONTS.grotesk).css);
  const basePt = (SIZES[look.boyut] || SIZES.lise).pt * (ctx.small ? .92 : 1) * ((ayar.olcek || 100) / 100);
  st.setProperty('--fs', basePt.toFixed(2) + 'pt');
  st.setProperty('--pw', pw + 'mm'); st.setProperty('--ph', ph + 'mm');
  st.setProperty('--gap', (ayar.bosluk ?? 10) * 0.5 + 'mm');
  s.append(h('div.layer'));
  if (brand.filigran) {
    if (brand.logo) s.append(h('div.wm-logo', h('img', { src: brand.logo, alt: '' })));
    else if (brand.metinFiligran) s.append(h('div.wm-text', h('span', brand.metinFiligran)));
  }
  return s;
}

function testAdiOf(doc, ayar) {
  const t = String(ayar.testAdi || '').trim();
  if (/^\d+$/.test(t)) return `${t}. ${KINDS[doc.kind].ek}`;
  return t;
}

function headerEl(ctx, first, kit) {
  const { brand, doc, ayar, look, qr } = ctx;
  const okul = ayar.okul || brand.kurum || '';
  const title = doc.title || KINDS[doc.kind].ad;
  const tAdi = testAdiOf(doc, ayar);
  const meta = [doc.meta?.sinif, doc.meta?.ders, doc.meta?.konu].filter(Boolean).join(' · ');
  if (!first) return h('div.ph-small', h('span', okul), h('span', title + (kit ? '  ·  ' + kit + ' kitapçığı' : '')));
  const kitEl = kit && doc.kind !== 'foy' && doc.kind !== 'banka' ? h('div.kit', kit) : null;
  const qrEl = qr && doc.kind === 'foy' ? h('img.qr', { src: qr, alt: '' }) : null;
  let wrap;
  if (look.baslik === 'meb') {
    wrap = h('div.ph.ph-meb',
      h('div', brand.logo ? h('img.logo', { src: brand.logo }) : null, h('div.inst', okul)),
      h('div', h('div.ttl', title), meta ? h('div.sub', meta) : null, tAdi ? h('div.sub', h('b', tAdi)) : null),
      h('div', kitEl || qrEl || h('div.sub', [ayar.yil, ayar.donem].filter(Boolean).join(' · '))));
  } else {
    const logo = brand.logo ? h('img.logo', { src: brand.logo, alt: '' }) : (look.baslik === 'amblem' ? h('div.amb', (okul || title).slice(0, 1)) : null);
    wrap = h('div.ph.ph-' + look.baslik, { 'data-tab': (KINDS[doc.kind].kisa || '').toLocaleUpperCase('tr-TR') },
      logo,
      h('div.ph-t', okul ? h('div.inst', okul) : null, h('div.ttl', title), meta || tAdi ? h('div.sub', [meta, tAdi].filter(Boolean).join('  ·  ')) : null),
      qrEl, kitEl);
  }
  const out = h('div', wrap);
  const kun = [ayar.yil && 'Eğitim-Öğretim Yılı: ' + ayar.yil, ayar.donem, ayar.tarih && 'Tarih: ' + ayar.tarih, doc.meta?.sure && 'Süre: ' + doc.meta.sure, (ayar.ogretmen || brand.ogretmen) && doc.kind !== 'foy' && 'Öğretmen: ' + (ayar.ogretmen || brand.ogretmen)].filter(Boolean);
  if (kun.length && doc.kind !== 'foy' && look.baslik !== 'meb') out.append(h('div.kunye', kun.map(k => h('span', k))));
  const o = ayar.ogrenci || {};
  if (o.ad || o.sinif || o.no || o.puan || o.veli) {
    out.append(h('div.stu-line',
      o.ad ? h('span.f', 'Adı Soyadı:') : null,
      o.sinif ? h('span.f.n', 'Sınıf/Şube:') : null,
      o.no ? h('span.f.n', 'No:') : null,
      o.veli ? h('span.f.n', 'Veli İmzası:') : null,
      o.puan ? h('span.puan', h('small', 'ALDIĞI NOT'), ' ') : null));
  }
  if (ayar.yonerge && ayar.yonergeYer !== 'alt' && ['yazili', 'test', 'deneme'].includes(doc.kind)) out.append(R('div.yonerge', ayar.yonerge));
  return out;
}

function footerEl(ctx, pno) {
  const { brand, look } = ctx;
  const soz = brand.soz ?? 'İyi çalışmalar.';
  const sozEl = soz ? h('span.soz', soz + (brand.simge ? ' ' + brand.simge : '')) : null;
  const pn = h('span.pn-wrap', h('span.pn', String(pno)));
  const lay = look.altBilgi || 'klasik';
  const left = lay === 'logolu'
    ? [brand.logo ? h('img.flogo', { src: brand.logo }) : null, h('span', brand.kurum || '')]
    : [h('span', brand.ogretmen || '')];
  const f = h('div.pg-foot.ft-' + lay, lay === 'kutu' ? [sozEl, pn] : [...left, h('span.sp'), sozEl, pn]);
  return f;
}

// ---------- Soru ----------
function choiceList(q, wide) {
  const texts = (q.choices || []);
  const imgs = q.choiceImgs || [];
  const ch = LETTERS.map((L, i) => [L, texts[i], imgs[i]]).filter(([, t, im]) => (t && String(t).trim()) || im);
  if (!ch.length) return null;
  let lay = q.layout || 'auto';
  if (lay === 'auto') {
    const maxLen = Math.max(...ch.map(([, t]) => String(t || '').replace(/[*_{}^]/g, '').length));
    lay = ch.some(([, , im]) => im) ? 'iki' : maxLen <= (wide ? 10 : 6) ? 'yan' : maxLen <= (wide ? 30 : 16) ? 'iki' : 'alt';
  }
  return h('div.ch.l-' + lay, ch.map(([L, t, im]) => h('div', h('b.L', L + ')'), im ? h('img', { src: im }) : h('span', { html: rich(t) }))));
}

export function questionEl(q, no, ctx, { points = null, wide = false, item = {} } = {}) {
  const { teacher, ayar, doc } = ctx;
  if (!q) return h('div.pq', h('div.no', String(no)), h('div.qb', h('i', '(Silinmiş soru)')));
  const body = h('div.qb');
  if (q.surec && ctx.showSurec) body.append(h('div.surec', q.surec));
  if (q.text) {
    const qt = R('div.qt', q.text);
    if (points != null && ayar.puanEtiketi) qt.append(' ', h('span.pts-inline', `(${points} Puan)`));
    body.append(qt);
  }
  for (const tb of q.tablo || []) body.append(h('table.dtab', tb.map(r => h('tr', r.map(c => h('td', { html: rich(c) }))))));
  const imgs = q.images?.length ? q.images : (q.image ? [q.image] : []);
  for (const im of imgs) body.append(h('img.qimg', { src: im, alt: '', style: q.imgW ? { width: q.imgW + '%' } : null }));
  const type = q.type || 'coktan';
  if (type === 'coktan') { const c = choiceList(q, wide); if (c) body.append(c); }
  else if (type === 'dy') body.append(h('div', { style: { marginTop: '1.5mm' } }, h('span.dy-box'), 'D', h('span.dy-box', { style: { marginLeft: '5mm' } }), 'Y'));
  else if (type === 'klasik' || type === 'bosluk') {
    if (doc.kind === 'yazili' || type === 'klasik') {
      const hgt = q.bosluk ? q.bosluk * 7 : (ayar.cevapYukseklik || 40);
      if (type === 'klasik') body.append(h('div.ans.' + (ayar.cevapAlani || 'cerceve'), { style: { height: hgt + 'mm' } }));
    }
  }
  const showSol = teacher || ayar.cozumler === 'alt';
  if (showSol) {
    const ans = type === 'coktan' ? q.answer : type === 'dy' ? (q.answer === 'D' ? 'Doğru' : q.answer === 'Y' ? 'Yanlış' : '') : (q.cevapMetni || '');
    if (ans || q.cozum || q.cozumImg) {
      const sol = h('div.sol', ans && (teacher || ayar.cozumler !== 'alt' || true) ? h('b', 'Cevap: ' + ans + (q.cozum ? ' — ' : '')) : null);
      if (q.cozum) sol.append(h('span', { html: rich(q.cozum) }));
      if (q.cozumImg) sol.append(h('img', { src: q.cozumImg, style: { maxWidth: '100%', display: 'block' } }));
      body.append(sol);
    }
  }
  const el = h('div.pq' + (item.genis ? '.genis' : ''),
    h('div.no', String(no)), body,
    points != null && !ayar.puanEtiketi ? h('div.pts', points + ' p') : null);
  if (q.damga && ctx.stamps[q.damga]) el.append(h('img.stamp', { src: ctx.stamps[q.damga] }));
  return el;
}

function kokEl(item) {
  const el = h('div.kok');
  if (item.baslik !== '') el.append(h('div.kh', item.baslik || 'Aşağıdaki soruları bu bilgilere göre cevaplayınız.'));
  if (item.text) el.append(R('div', item.text));
  if (item.image) el.append(h('img', { src: item.image }));
  return el;
}

// ---------- Föy blokları ----------
function foyBlock(b, ctx, counters) {
  const al = b.align ? 'al-' + b.align : 'al-center';
  const img = () => b.image ? h('img.' + al, { src: b.image, style: { width: (b.imgW || 100) + '%' } }) : null;
  switch (b.t) {
    case 'baslik': return R('div.fb.fb-baslik', b.text);
    case 'arabaslik': return h('div.fb', R('div.fb-arabaslik', b.text));
    case 'anlatim': case 'paragraf': return h('div.fb.fb-paragraf', { html: rich(b.text) }, img());
    case 'gorsel': return h('div.fb.fb-gorsel', img());
    case 'ayrac': return h('hr.fb.fb-ayrac');
    case 'bosluk': return h('div.fb', { style: { height: (b.yukseklik || 10) + 'mm', margin: 0 } });
    case 'ornek': case 'alistirma': {
      const n = ++counters[b.t];
      const box = h('div.fb.fb-box.fb-' + b.t, h('span.lbl', FOY_LABELS[b.t] + ' ' + n), h('span', { html: rich(b.text) }), img());
      if (b.cevap) {
        if (b.t === 'ornek' && ctx.ayar.cozumGoster !== false) box.append(h('div.solline', { html: rich(b.cevap) }));
        else if (ctx.teacher) box.append(h('div.sol', { html: rich(b.cevap) }));
        else box.append(h('div', { style: { height: '14mm' } }));
      }
      if (b.harf) box.dataset.note = `${FOY_LABELS[b.t]} ${n}: ${b.harf}`;
      return box;
    }
    default: {
      const box = h('div.fb.fb-box.fb-' + b.t, h('span.lbl', FOY_LABELS[b.t] || b.t.toUpperCase()), h('div', { html: rich(b.text) }), img());
      return box;
    }
  }
}

// ---------- Sayfalama (bant tabanlı) ----------
async function paginate(host, ctx, blocks, { cols = 2, startPage = 1, firstHeader = true, kit = '', notes = '' } = {}) {
  const pages = [];
  let body, band, colsEls, ci, page, notesEl;
  const newBand = c => {
    band = h('div', { style: { display: 'flex', gap: c > 1 ? '7mm' : '0', alignItems: 'stretch' } });
    band.className = 'band cols-' + c;
    colsEls = Array.from({ length: c }, () => h('div.col', { style: { height: 'auto', overflow: 'visible' } }));
    if (c > 1) colsEls.slice(1).forEach(x => { x.style.borderLeft = '.35mm solid color-mix(in srgb,var(--acc) 35%,#fff)'; x.style.paddingLeft = '6mm'; });
    band.append(...colsEls); body.append(band); ci = 0;
  };
  const newPage = () => {
    const s = sheetEl(ctx);
    const inner = h('div.pg-in');
    const first = firstHeader && pages.length === 0;
    inner.append(h('div.pg-head', headerEl(ctx, first, kit)));
    body = h('div.pg-body', { style: { flexDirection: 'column', gap: '0' } });
    inner.append(body);
    notesEl = notes ? h('div.pg-notes.' + notes, { style: { minHeight: notes === 'kutu' ? '7mm' : '5mm' } }) : null;
    if (notesEl) inner.append(notesEl);
    inner.append(footerEl(ctx, startPage + pages.length));
    if (ctx.brand.iletisim) inner.append(h('div.iletisim', ctx.brand.iletisim));
    s.append(inner);
    host.append(s); pages.push(s); page = s;
    newBand(cols);
  };
  const overflow = () => body.scrollHeight > body.clientHeight + 1;
  const empty = () => !body.querySelector('.col > *');
  newPage();
  for (const b of blocks) {
    await waitImages(b.el);
    if (b.newPage && !empty()) newPage();
    if (b.genis || b.full) {
      const prevBand = band;
      if (!colsEls.some(c => c.childElementCount) && prevBand) prevBand.remove();
      newBand(1); colsEls[0].append(b.el);
      if (overflow()) { b.el.remove(); band.remove(); newPage(); band.remove(); newBand(1); colsEls[0].append(b.el); if (overflow()) shrinkToFit(b.el, body); }
      newBand(cols);
      continue;
    }
    colsEls[ci].append(b.el);
    if (!overflow()) continue;
    b.el.remove();
    let placed = false;
    while (ci < colsEls.length - 1) { ci++; colsEls[ci].append(b.el); if (!overflow()) { placed = true; break; } b.el.remove(); }
    if (placed) continue;
    newPage(); colsEls[0].append(b.el);
    if (overflow()) shrinkToFit(b.el, body);
  }
  // boş bantları/sayfaları temizle
  for (const p of pages) p.querySelectorAll('.band').forEach(bd => { if (!bd.querySelector('.col > *')) bd.remove(); });
  while (pages.length > 1 && !pages.at(-1).querySelector('.col > *')) pages.pop().remove();
  // sayfa altı notlar
  if (notes) for (const p of pages) {
    const ns = [...p.querySelectorAll('[data-note]')].map(e => e.dataset.note);
    const box = p.querySelector('.pg-notes');
    if (!ns.length) { box.style.visibility = 'hidden'; continue; }
    box.innerHTML = ns.map(n => { const [a, b] = n.split(': '); return `<b>${esc(a)}:</b> ${esc(b || '')}`; }).join('  ·  ');
  }
  return pages;
}
function shrinkToFit(el, body) { for (const img of el.querySelectorAll('img')) img.style.maxHeight = Math.max(40, body.clientHeight - 80) + 'px'; }
function waitImages(el) {
  const imgs = [...el.querySelectorAll('img')];
  return Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; })));
}

// Tek sayfalık özel sayfalar (anahtar, optik, kapak…)
function simplePage(ctx, title, content, pno, { sub = '' } = {}) {
  const s = sheetEl(ctx);
  const inner = h('div.pg-in');
  inner.append(h('div.pg-head', h('div.ph.ph-minimal', ctx.brand.logo ? h('img.logo', { src: ctx.brand.logo }) : null, h('div.ph-t', h('div.inst', ctx.ayar.okul || ctx.brand.kurum || ''), h('div.ttl', title), sub ? h('div.sub', sub) : null))));
  inner.append(h('div', { style: { flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 1 } }, content));
  inner.append(footerEl(ctx, pno));
  s.append(inner);
  return s;
}

function coverPage(ctx, { kit, rows, extra } = {}) {
  const { brand, doc, ayar } = ctx;
  const s = sheetEl(ctx);
  const inner = h('div.pg-in');
  const cover = h('div.cover');
  if (brand.kapakGorsel) { s.append(h('img.cover-full', { src: brand.kapakGorsel })); s.append(inner); return s; }
  s.prepend(h('div.cover-pattern'));
  const box = h('div.cbox',
    brand.logo ? h('img.clogo', { src: brand.logo }) : null,
    (ayar.okul || brand.kurum) ? h('div', { style: { fontWeight: 700, fontSize: '1.15em' } }, ayar.okul || brand.kurum) : null,
    h('div.ct', doc.title || KINDS[doc.kind].ad),
    h('div', { style: { fontSize: '1.05em' } }, [doc.meta?.tur && denemeTuru(doc.meta.tur)?.ad, doc.meta?.sinif, doc.meta?.ders].filter(Boolean).join(' · ')),
    testAdiOf(doc, ayar) ? h('div', h('b', testAdiOf(doc, ayar))) : null,
    kit ? h('div.kitbox', kit) : null,
    rows ? h('table', h('tr', h('th', 'Bölüm'), h('th', 'Soru'), rows.some(r => r[2]) ? h('th', 'Süre') : null), rows.map(r => h('tr', h('td', r[0]), h('td', String(r[1])), rows.some(x => x[2]) ? h('td', r[2] ? r[2] + ' dk' : '') : null))) : null,
    extra || null,
    doc.meta?.sure ? h('div', 'Süre: ', h('b', doc.meta.sure)) : null,
    ayar.yonerge && doc.kind === 'deneme' ? R('div', ayar.yonerge, { style: { fontSize: '.85em', color: '#444', maxWidth: '130mm' } }) : null,
    (ayar.ogretmen || brand.ogretmen) ? h('div', { style: { fontSize: '.9em' } }, ayar.ogretmen || brand.ogretmen) : null);
  cover.append(box);
  inner.append(cover);
  s.append(inner);
  return s;
}

// ---------- B kitapçığı: soru ve şık karıştırma ----------
function variantFor(q, seed) {
  if (!q || (q.type && q.type !== 'coktan')) return q;
  const filled = (q.choices || []).map((c, i) => [c, (q.choiceImgs || [])[i], i]).filter(([c, im]) => (c && String(c).trim()) || im);
  if (filled.length < 3 || q.sabitSik) return q;
  // "Hepsi", "I ve II" gibi sıra bağımlı şıklarda karıştırma yapma
  if (filled.some(([c]) => /^(Yalnız|I+ ve|I, II|Hiçbiri|Hepsi)/i.test(String(c || '')))) return q;
  const order = shuffle(filled.map((_, i) => i), seed);
  const nc = order.map(i => filled[i][0]); const ni = order.map(i => filled[i][1]);
  const oldIdx = LETTERS.indexOf(q.answer);
  const newAns = oldIdx >= 0 ? LETTERS[order.findIndex(i => filled[i][2] === oldIdx)] : q.answer;
  return { ...q, choices: nc, choiceImgs: ni, answer: newAns };
}
export function orderedItems(items, kit, seed) {
  if (kit !== 'B') return items;
  // kök + bağlı sorular birlikte kalsın: grupla
  const groups = []; let cur = null;
  for (const it of items) { if (it.type === 'kok') { cur = [it]; groups.push(cur); } else if (cur && it.kokBagli) cur.push(it); else { cur = null; groups.push([it]); } }
  return shuffle(groups, seed + 7).flat();
}

// ---------- Ana giriş ----------
export async function renderDoc(host, doc, qmap, brand, { teacher = false, small = false } = {}) {
  host.innerHTML = '';
  const ayar = { ...defaultAyar(doc.kind), ...(doc.ayar || {}) };
  ayar.ogrenci = { ...defaultAyar(doc.kind).ogrenci, ...(doc.ayar?.ogrenci || {}) };
  const look = lookOf(brand, doc);
  const stamps = Object.fromEntries((brand.damgalar || []).map(d => [d.id, d.img]));
  let qr = null;
  if (ayar.karekod) { const QR = await loadQR(); if (QR) { try { const qq = QR(0, 'M'); qq.addData(ayar.karekod); qq.make(); qr = qq.createDataURL(4, 0); } catch { } } }
  const ctx = { brand, doc, ayar, look, teacher, small, stamps, qr, showSurec: doc.kind !== 'yazili' && ayar.surecGoster };
  const kind = doc.kind;
  const all = [];
  let pno = 1;
  const kits = ['test', 'deneme', 'yazili'].includes(kind) ? (ayar.kitapciklar?.length ? ayar.kitapciklar : ['A']) : [''];
  const tur = kind === 'deneme' ? denemeTuru(doc.meta?.tur) : null;
  const nSik = tur ? tur.sik : 5;
  const keyGroupsByKit = {};
  const solutions = [];

  for (const kit of kits) {
    const seed = (doc.seed || 1) + (kit === 'B' ? 101 : 0);
    const keyGroups = [];
    const kitSuffix = kits.length > 1 || kit === 'B' ? kit : (kind === 'foy' || kind === 'banka' ? '' : kit);
    const qv = id => kit === 'B' ? variantFor(qmap[id], seed + id.length * 13 + id.charCodeAt(0)) : qmap[id];

    if (ayar.kapak) {
      const rows = kind === 'deneme' ? (doc.sections || []).map(s => [s.name, (s.qids || []).length, s.sure]) : null;
      const units = kind === 'banka' ? h('div', { style: { fontSize: '.9em' } }, [...new Set((doc.items || []).map(i => qmap[i.qid]?.konu).filter(Boolean))].slice(0, 14).join(' · ')) : null;
      const c = coverPage(ctx, { kit: kitSuffix, rows, extra: units }); host.append(c); all.push(c); pno++;
    }

    if (kind === 'foy') {
      const blocks = []; const counters = { ornek: 0, alistirma: 0 }; let n = 0;
      for (const b of doc.blocks || []) {
        if (b.t === 'soru') { const q = qmap[b.qid]; n++; counters.alistirma++; const el = questionEl(q, n, ctx, { wide: ayar.cols === 1 }); if (q?.answer) el.dataset.note = `Şimdi Sen ${counters.alistirma}: ${q.answer}`; blocks.push({ el }); if (q?.answer) (keyGroups[0] ||= { items: [] }).items.push([n, q.answer]); continue; }
        if (b.t === 'sayfa') { blocks.push({ el: h('div'), newPage: true }); continue; }
        blocks.push({ el: foyBlock(b, ctx, counters), genis: b.genis });
      }
      const pages = await paginate(host, ctx, blocks, { cols: ayar.cols || 1, startPage: pno, notes: ayar.foyCevap !== 'yok' ? ayar.foyCevap : '' });
      all.push(...pages); pno += pages.length;
    } else if (kind === 'deneme') {
      const blocks = [];
      (doc.sections || []).forEach((sec, si) => {
        const items = []; const ids = orderedItems((sec.qids || []).map(qid => ({ qid })), kit, seed + si).map(i => i.qid);
        blocks.push({ el: h('div.sec-title', sec.name + (sec.sure ? ` · ${sec.sure} dk` : '')), newPage: true });
        ids.forEach((id, i) => { const q = qv(id); const el = questionEl(q, i + 1, ctx); blocks.push({ el }); items.push([i + 1, q?.answer]); if (q?.cozum || q?.cozumImg) solutions.push([sec.name + ' ' + (i + 1), q]); });
        keyGroups.push({ name: sec.name, items, qs: ids.map(qv) });
      });
      const pages = await paginate(host, ctx, blocks, { cols: ayar.cols || 2, startPage: pno, firstHeader: !ayar.kapak, kit: kitSuffix });
      all.push(...pages); pno += pages.length;
    } else {
      const items = orderedItems(doc.items || [], kit, seed);
      const blocks = []; const keyItems = []; const qsInOrder = [];
      let lastKonu = null, n = 0;
      const notes = ayar.anahtarYeri !== 'ayri' && kind !== 'yazili' ? ayar.anahtarYeri : '';
      for (const it of items) {
        if (it.type === 'kok') { blocks.push({ el: kokEl(it), genis: it.genis }); continue; }
        const q = qv(it.qid);
        if (kind === 'banka' && ayar.konuBaslik !== false && q?.konu && q.konu !== lastKonu) {
          if (ayar.bolumNumara && lastKonu !== null) n = 0;
          blocks.push({ el: h('div.konu-title', q.konu), genis: true }); lastKonu = q.konu;
        }
        n++;
        const el = questionEl(q, n, ctx, { points: kind === 'yazili' ? (it.puan ?? 0) : null, wide: kind === 'yazili' || it.genis || ayar.cols === 1, item: it });
        const ans = q ? ((q.type === 'coktan' || !q.type || q.type === 'dy') ? q.answer : (q.cevapMetni ? '✎' : '')) : '';
        if (notes && ans) el.dataset.note = `${n}: ${ans}`;
        blocks.push({ el, genis: it.genis });
        keyItems.push([n, ans]); qsInOrder.push(q);
        if (q?.cozum || q?.cozumImg) solutions.push([String(n), q]);
      }
      if (ayar.yonerge && ayar.yonergeYer === 'alt') blocks.push({ el: R('div.yonerge', ayar.yonerge), genis: true });
      const imz = (ayar.imzalar || []).filter(x => x && (x.ad || x.unvan));
      if (kind === 'yazili' && imz.length) blocks.push({ el: h('div.imza', imz.map(x => h('div', h('b', x.ad || ''), x.unvan || ''))), genis: true });
      keyGroups.push({ items: keyItems, qs: qsInOrder });
      const cols = kind === 'yazili' ? (ayar.cols || 1) : (ayar.cols || 2);
      const pages = await paginate(host, ctx, blocks, { cols, startPage: pno, firstHeader: !(ayar.kapak && kind !== 'banka') || true, kit: kitSuffix, notes });
      if (ayar.icindekiler && kind === 'banka') {
        // içindekiler: konu → sayfa
        const map = []; pages.forEach((p, i) => p.querySelectorAll('.konu-title').forEach(t => map.push([t.textContent, pno + 1 + i])));
        const toc = simplePage(ctx, 'İçindekiler', h('div.toc', map.map(([t, p]) => h('div.row', h('span', t), h('span.sp'), h('b', String(p))))), pno);
        host.insertBefore(toc, pages[0]); all.push(toc);
        pages.forEach((p, i) => { const pn = p.querySelector('.pn'); if (pn) pn.textContent = String(pno + 1 + i); });
        pno++;
      }
      all.push(...pages); pno += pages.length;
    }
    keyGroupsByKit[kit] = keyGroups;
  }

  // Çözümler sonda
  if (ayar.cozumler === 'sonda' && solutions.length) {
    const blocks = solutions.map(([n, q]) => ({ el: h('div.pq', h('div.no', n), h('div.qb', q.answer ? h('b', 'Cevap: ' + q.answer + ' ') : null, q.cozum ? h('span', { html: rich(q.cozum) }) : null, q.cozumImg ? h('img.qimg', { src: q.cozumImg }) : null)) }));
    const saved = ctx.ayar.ogrenci; ctx.ayar = { ...ayar, ogrenci: {}, yonerge: '' };
    const sdoc = ctx.doc; ctx.doc = { ...doc, title: 'Çözümler' };
    const pages = await paginate(host, ctx, blocks, { cols: 2, startPage: pno });
    ctx.ayar = { ...ayar, ogrenci: saved }; ctx.doc = sdoc;
    all.push(...pages); pno += pages.length;
  }

  // Cevap anahtarı
  const anyKey = Object.values(keyGroupsByKit).some(gs => gs.some(g => g.items.length));
  if (ayar.anahtar && (ayar.anahtarYeri === 'ayri' || kind === 'yazili' || kind === 'deneme') && anyKey) {
    const content = h('div');
    for (const [kit, groups] of Object.entries(keyGroupsByKit)) {
      if (kit) content.append(h('div.sec-title', kit + ' kitapçığı'));
      for (const g of groups) {
        if (g.name) content.append(h('div.konu-title', g.name));
        content.append(h('div.key-grid', { style: { marginBottom: '5mm' } }, g.items.map(([n, a]) => h('div', h('b', n + '.'), a || '—'))));
      }
    }
    const kaynaklar = ayar.kaynak ? [ayar.kaynak] : [...new Set(Object.values(keyGroupsByKit).flat().flatMap(g => (g.qs || []).map(q => String(q?.kaynak || '').split(' · ')[0])).filter(Boolean))].slice(0, 6);
    if (ayar.kaynakGoster !== false && kaynaklar.length) content.append(h('div.kaynak', h('b', 'Kaynak: '), kaynaklar.join(' · ')));
    if (qr && kind !== 'foy') content.append(h('div', { style: { marginTop: '4mm', display: 'flex', gap: '3mm', alignItems: 'center', fontSize: '.8em' } }, h('img', { src: qr, style: { width: '22mm' } }), ayar.karekod));
    const kp = simplePage(ctx, 'Cevap Anahtarı', content, pno, { sub: doc.title || '' }); host.append(kp); all.push(kp); pno++;
  }

  // Öğrenme çıktıları
  if (ayar.ogrenmeCiktilari) {
    const groups = Object.values(keyGroupsByKit)[0] || [];
    const map = new Map();
    groups.forEach(g => (g.qs || []).forEach((q, i) => { if (!q) return; const k = q.kazanim || '(etiketsiz)'; if (!map.has(k)) map.set(k, { konu: q.konu || '', nos: [] }); map.get(k).nos.push((g.name ? g.name + ' ' : '') + g.items[i][0]); }));
    const tbl = h('table.lo-table', h('tr', h('th', 'Öğrenme çıktısı'), h('th', 'Konu'), h('th', 'Sorular')), [...map].map(([k, v]) => h('tr', h('td', h('b', k), ciktiMetni(k) ? h('div', { style: { fontSize: '.85em' } }, ciktiMetni(k)) : null), h('td', v.konu), h('td', v.nos.join(', ')))));
    const lp = simplePage(ctx, 'Öğrenme Çıktıları', tbl, pno); host.append(lp); all.push(lp); pno++;
  }

  // Optik form
  if (ayar.optik && ['test', 'deneme'].includes(kind)) {
    for (const [kit, groups] of Object.entries(keyGroupsByKit)) {
      const content = h('div', h('div.optik-head', h('div', 'Adı Soyadı'), h('div', 'Numara'), h('div', 'Kitapçık: ' + (kit || 'A'))));
      for (const g of groups) {
        if (g.name) content.append(h('div.konu-title', g.name));
        content.append(h('div.optik', { style: { marginBottom: '4mm' } }, g.items.map(([n]) => h('div.orow', h('span.n', n), LETTERS.slice(0, nSik).map(L => h('span.bub', L))))));
      }
      const op = simplePage(ctx, 'Optik Form', content, pno, { sub: (doc.title || '') + (kit ? ' · ' + kit : '') }); host.append(op); all.push(op); pno++;
    }
  }

  // Sayfa damgaları
  (doc.damgalar || []).forEach(st => {
    const sh = all[st.pg]; const img = stamps[st.sid];
    if (!sh || !img) return;
    let layer = sh.querySelector('.stamps'); if (!layer) { layer = h('div.stamps'); sh.append(layer); }
    layer.append(h('img', { src: img, style: { left: st.x + '%', top: st.y + '%' }, 'data-stamp': st.id }));
  });
  return all.length;
}

export function paperSizeOf(doc) { const k = doc?.ayar?.kagit || 'A4'; return PAPERS[k] || PAPERS.A4; }
