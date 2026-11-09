import { h, toast, uid, confirmBox, readFileAsDataURL, readFileAsText, shrinkImage, download, modal, $ } from '../util.js';
import { db, getBrand } from '../db.js';
import { KINDS, VARIANTS, kindInfo, DENEME_TURLERI, BRANSLAR, denemeTuru, renderDoc, defaultAyar, setKatex, FOY_LABELS } from '../render.js';
import { HEADERS, TEMPLATES, PAGE_NUMS, Q_NUMS, BODY_FONTS, TITLE_FONTS, FOOTERS, SIZES, PAPERS, ensureFonts, loadKatex } from '../design.js';
import { pickQuestions, editQuestion, qCard, cropTool, DERSLER } from './pool.js';
import { SENARYOLAR, SENARYO_YILI, ciktiMetni, OGRENME_CIKTILARI } from '../meb.js';
import { shuffle } from '../util.js';

const FOY_TYPES = { paragraf: 'Paragraf', arabaslik: 'Ara Başlık', baslik: 'Konu Başlığı', not: 'NOT', dikkat: 'DİKKAT', ornek: 'Örnek', alistirma: 'Şimdi Sen', kural: 'KURAL', tanim: 'TANIM', puf: 'İPUCU', formul: 'Formül', gorsel: 'Görsel', ayrac: 'Ayraç', bosluk: 'Boşluk', soru: 'Depodan soru', sayfa: 'Sayfa sonu' };
const SINIFLAR = Array.from({ length: 12 }, (_, i) => (i + 1) + '. Sınıf').concat(['Mezun']);
export const KIMLER = {
  foy: [['Branş öğretmeni', 'Konuyu kendi anlatım sırasına dizer; not, dikkat ve örnek kutularıyla ders notunu çıkarır.'], ['Özel ders veren', 'Öğrencisine kendi logosu ve iletişim bilgisiyle basılmış föy bırakır.'], ['Kurs ve etüt merkezi', 'Konu konu föy serisi üretir; hepsi aynı marka kimliğinde çıkar.'], ['Zümre', 'Çözümleri gizleyip öğrenci sürümünü, gösterip öğretmen sürümünü aynı belgeden basar.']],
  test: [['Branş öğretmeni', 'Ders sonu pekiştirme testi hazırlar; iki sütunlu düzen, anahtar ayrı sayfada.'], ['Zümre', 'Aynı öğrenme çıktısını bütün şubelerde ölçen ortak tarama testi çıkarır.'], ['Kurs ve etüt merkezi', 'Haftalık ödev testi serisini kendi markasıyla basar.'], ['Soru biriktiren', 'Depodaki soruları seçip dakikalar içinde sayfaya dizer.']],
  yazili: [['Branş öğretmeni', 'Dönem yazılısını puan çizelgesi, süre ve veli imzasıyla hazırlar.'], ['Okul idaresi', 'Ortak yazılıyı tek şablondan bütün şubelere verir.'], ['Karma sınav yapan', 'Açık uçlu, boşluk doldurma, doğru-yanlış ve çoktan seçmeliyi aynı kâğıtta toplar.'], ['Fotokopiyle çoğaltan', '“Sade ve Ekonomik” tasarımlar siyah-beyaz baskıda toner yakmaz.']],
  deneme: [['Kurum ve kurs', 'LGS, TYT, AYT ya da genel deneme kitapçığı üretir; bölümlü ve süreli.'], ['Sınav uygulayan', 'A ve B kitapçığını birlikte basar; sorular ve şıklar karışır.'], ['Değerlendiren', 'Optik form ve cevap anahtarı kitapçıkla gelir; net formülü sınav ailesinden.'], ['Rehber öğretmen', 'Deneme sonrası çözümleme için hazır anahtar ve öğrenme çıktısı sayfası.']],
  banka: [['Branş öğretmeni', 'Yıl boyu biriken soruları kapaklı, içindekilerli tek kitaba çevirir.'], ['Yayın hazırlayan', 'Kendi soru kitabını kendi markasıyla basar.'], ['Zümre', 'Ortak depodan sınıf seviyesine göre derleme yapar.'], ['Arşivleyen', 'Konu konu bölümler; isterseniz her bölüm 1’den numaralanır.']],
};

export function newDoc(kind, opts = {}) {
  const v = VARIANTS[kind]; if (v) kind = v.kind;
  const d = { id: uid(), kind, title: KINDS[kind].ad, meta: { sinif: '', ders: '', konu: '', sure: kind === 'test' || kind === 'yazili' ? '40 dk' : '' }, seed: Math.floor(Math.random() * 1e6), ayar: defaultAyar(kind), created: Date.now(), updated: Date.now() };
  if (v) { d.title = v.ad; d.variant = opts.variant; Object.assign(d.ayar, v.ayar); if (v.sure) d.meta.sure = v.sure; }
  if (kind === 'foy') d.blocks = [];
  else if (kind === 'deneme') {
    const t = denemeTuru(opts.tur || 'serbest');
    d.meta.tur = t.id; d.meta.sure = t.sure ? t.sure + ' dk' : ''; d.title = t.ad + ' Denemesi';
    d.sections = t.bolumler.map(b => ({ id: uid(), name: b.name, hedef: b.n, qids: [], sure: b.sure || '' }));
  } else d.items = [];
  if (opts.qids?.length) {
    if (kind === 'foy') d.blocks = opts.qids.map(qid => ({ id: uid(), t: 'soru', qid }));
    else if (kind === 'deneme') d.sections[0].qids = opts.qids.slice();
    else d.items = opts.qids.map(qid => ({ qid, puan: 0 }));
  }
  return d;
}
function migrate(doc) {
  if (!doc.ayar) {
    doc.ayar = { ...defaultAyar(doc.kind) };
    const o = doc.options || {};
    if (o.cols) doc.ayar.cols = o.cols; if (o.anahtar === false) doc.ayar.anahtar = false; if (o.optik) doc.ayar.optik = true;
    if (doc.kitapcik === 'B') doc.ayar.kitapciklar = ['B'];
  }
  if (doc.kind === 'deneme' && doc.meta?.tur && !denemeTuru(doc.meta.tur)) doc.meta.tur = 'serbest';
  return doc;
}

// ---------- Giriş ekranı ----------
export async function introView(app, kind, opts = {}) {
  let tur = 'lgs-sayisal';
  const kzBox = (kind === 'test' || kind === 'tarama') ? await kazanimCard(kind, !!opts.qids?.length) : null;
  const dnBox = kind === 'deneme' && !opts.qids?.length ? await denemeDoldurCard(() => tur) : null;
  const start = async (bos) => {
    let sec = null;
    if (dnBox) {
      const d = newDoc(kind, { tur: tur || 'serbest', variant: kind });
      if (!await dnBox.doldur(d)) return;
      await db.put('documents', d); location.hash = '#/belge/' + d.id; return;
    }
    if (kzBox && bos !== true) { sec = await kzBox.secim(); if (!sec) return; }
    const d = newDoc(kind, { tur: tur || 'serbest', qids: opts.qids, variant: kind });
    if (sec) {
      Object.assign(d.meta, { sinif: sec.sinif, ders: sec.ders, konu: sec.konu, kazanimlar: sec.kodlar });
      if (sec.qids.length && !opts.qids?.length) d.items = sec.qids.map(qid => ({ qid, puan: 0 }));
      if (sec.eksik) toast(`Depoda yeterli soru yok: ${sec.qids.length} soru eklendi`);
    }
    await db.put('documents', d); location.hash = '#/belge/' + d.id;
  };
  let turBox = null;
  if (kind === 'deneme') {
    const all = DENEME_TURLERI.flatMap(a => a.turler.map(t => ({ ...t, aile: a.aile, sik: a.sik, not: a.not })));
    const qty = t => t.bolumler.reduce((x, b) => x + b.n, 0);
    const radio = t => h('label.item-row.tur-opt', { style: { cursor: 'pointer' } }, h('input', { type: 'radio', name: 'tur', checked: t.id === tur, on: { change: () => { tur = t.id; dnBox?.redraw(); } } }),
      h('span.txt', h('b', t.ad), h('span.small.muted', '  ' + [qty(t) ? qty(t) + ' soru' : '', t.sure ? t.sure + ' dk' : '', t.sik + ' şık'].filter(Boolean).join(' · '))));
    const body = h('div');
    let sekme = 'genel', brans = 'Kimya';
    const draw = () => {
      body.innerHTML = '';
      if (sekme === 'genel') {
        for (const fam of DENEME_TURLERI) {
          const ts = all.filter(t => t.aile === fam.aile && t.grup !== 'Branş denemesi');
          if (!ts.length) continue;
          body.append(h('div', { style: { marginTop: '12px' } }, h('div', h('b', fam.aile), h('span.small.muted', '  ' + fam.not)),
            ...[...new Set(ts.map(t => t.grup))].map(g => h('div', h('div.small.muted', { style: { margin: '6px 0 4px' } }, g), h('div.grid.grid-2', { style: { gap: '6px' } }, ts.filter(t => t.grup === g).map(radio))))));
        }
      } else {
        body.append(h('div.chips', { style: { marginTop: '12px' } }, BRANSLAR.map(d => h('button.chip-btn' + (d === brans ? '.on' : ''), { type: 'button', on: { click: () => { brans = d; draw(); } } }, d))));
        const ts = all.filter(t => t.grup === 'Branş denemesi' && t.ders === brans);
        if (!ts.some(t => t.id === tur)) { tur = ts[0]?.id || tur; setTimeout(() => dnBox?.redraw()); }
        body.append(h('div.grid.grid-2', { style: { gap: '6px', marginTop: '12px' } }, ts.map(t => h('div', radio(t), h('div.small.muted', { style: { margin: '2px 0 0 30px' } }, t.not)))));
        body.append(h('p.small.muted', { style: { marginTop: '8px' } }, 'Okul denemesinde soru sayısını ve süreyi belge açıldıktan sonra değiştirebilirsiniz.'));
      }
    };
    const tabs = h('div.seg.seg-lg', [['genel', 'Genel Deneme'], ['brans', 'Branş Denemesi']].map(([v, l]) => h('button' + (v === sekme ? '.on' : ''), { type: 'button', on: { click: e => { sekme = v; [...tabs.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); if (v === 'brans') tur = ''; else tur = 'lgs-sayisal'; draw(); } } }, l)));
    draw();
    turBox = h('div.card', { style: { marginTop: '12px' } }, tabs, body);
  }
  const senBox = kind === 'yazili' && !opts.qids?.length ? await senaryoCard() : null;
  app.append(...[
    h('a.btn.btn-sm.btn-ghost', { href: '#/' }, '← Geri dön'),
    h('h1', { style: { marginTop: '8px' } }, kindInfo(kind).ad), h('p.muted', kindInfo(kind).aciklama),
    kind === 'foy' ? h('div.card', h('p', { style: { margin: 0 } }, 'Konu anlatımını boş başlatıp bloklarla kurabilir ya da hazır notlarınızı yapıştırıp otomatik bloklara böldürebilirsiniz.')) : null,
    opts.qids?.length ? h('div.card', h('b', opts.qids.length + ' seçili soru'), ' bu belgeye eklenecek.') : null,
    turBox, dnBox, senBox, kzBox,
    h('button.btn.btn-accent', { style: { width: '100%', marginTop: '14px', padding: '14px', fontSize: '1.05rem' }, on: { click: () => start() } }, senBox ? 'Boş kâğıtla başla →' : dnBox ? 'Denemeyi kur →' : kzBox ? 'Testi kur →' : 'Başla →'),
    kzBox ? h('button.btn.btn-ghost', { style: { width: '100%', marginTop: '6px' }, on: { click: () => start(true) } }, 'Kazanım seçmeden boş kâğıtla başla') : null,
    ].filter(Boolean));
}


// ---------- Deneme: bölümleri depodan doldur (soru sayısı türden gelir) ----------
const BOLUM_DERS = { 'Temel Matematik': ['Matematik'], 'Fen Bilimleri': ['Fizik', 'Kimya', 'Biyoloji', 'Fen Bilimleri'], 'Sosyal Bilimler': ['Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü ve Ahlak Bilgisi'],
  'Felsefe Grubu': ['Felsefe'], 'Din Kültürü': ['Din Kültürü ve Ahlak Bilgisi'], 'Türk Dili ve Edebiyatı–Sosyal Bilimler-1': ['Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya'], 'Sosyal Bilimler-2': ['Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü ve Ahlak Bilgisi'] };
const bolumDersleri = (ad, tur) => BOLUM_DERS[ad] ? (tur?.aile === 'LGS' && ad === 'Fen Bilimleri' ? ['Fen Bilimleri'] : BOLUM_DERS[ad]) : [ad.replace(/-\d$/, '')];
const turSiniflari = tur => tur?.aile === 'LGS' ? ['5. Sınıf', '6. Sınıf', '7. Sınıf', '8. Sınıf'] : tur?.id?.startsWith('tyt') ? ['9. Sınıf', '10. Sınıf'] : tur?.id?.startsWith('ayt') ? ['11. Sınıf', '12. Sınıf'] : null;
async function denemeDoldurCard(getTur) {
  const all = await db.all('questions');
  const st = { mod: 'oto', oran: { 1: 30, 2: 50, 3: 20 }, zor: '', sinif: '', kzMax: 1 };
  const zor = q => ['1', '2', '3'].includes(String(q.zorluk)) ? String(q.zorluk) : '2';
  const box = h('div.card', { style: { marginTop: '12px' } });
  const havuzu = (bolum, tur) => { const ds = bolumDersleri(bolum, tur); const sn = st.sinif ? [st.sinif] : turSiniflari(tur); return all.filter(q => ds.includes(q.ders) && (!sn || sn.includes(q.sinif))); };
  const draw = () => {
    box.innerHTML = '';
    const tur = denemeTuru(getTur());
    box.append(h('h3', { style: { margin: '0 0 4px' } }, 'Sorular nasıl yerleşsin?'),
      h('p.small.muted', { style: { margin: '0 0 10px' } }, 'Soru sayıları seçtiğiniz deneme türünden gelir. Sorular bölümün kazanımlarına dengeli dağıtılır.'),
      h('div.seg', [['oto', '⚡ Otomatik'], ['elle', '✋ Kendim seçeyim'], ['bos', '☐ Boş başla']].map(([v, l]) => h('button' + (st.mod === v ? '.on' : ''), { type: 'button', on: { click: () => { st.mod = v; draw(); } } }, l))));
    if (st.mod === 'bos') return;
    if (tur?.aile === 'Serbest') box.append(h('label.fld', { style: { marginTop: '10px', maxWidth: '260px' } }, 'Hangi sınıfın soruları?', h('select.inp', { on: { change: e => { st.sinif = e.target.value; draw(); } } },
      [['', 'Bütün sınıflar'], ...Array.from({ length: 8 }, (_, i) => [(i + 5) + '. Sınıf', (i + 5) + '. Sınıf'])].map(([v, l]) => h('option', { value: v, selected: v === st.sinif }, l)))));
    box.append(h('div.row', { style: { marginTop: '10px', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('b.small', 'Kazanım başına en çok'),
      h('div.seg', [[1, '1 soru'], [2, '2 soru'], [3, '3 soru'], [0, 'Sınırsız']].map(([v, l]) => h('button' + (st.kzMax === v ? '.on' : ''), { type: 'button', on: { click: () => { st.kzMax = v; draw(); } } }, l)))));
    const tablo = h('table.table', { style: { marginTop: '10px', fontSize: '.9rem' } }, h('tr', h('th', 'Bölüm'), h('th', 'Soru'), h('th', 'Depoda'), h('th', 'Kazanım')));
    for (const b of tur?.bolumler || []) {
      const p = havuzu(b.name, tur); const kz = new Set(p.map(q => q.kazanim || q.konu || q.id)).size;
      tablo.append(h('tr', h('td', b.name), h('td', String(b.n || '—')), h('td', String(p.length)), h('td', { style: { color: st.kzMax && b.n > kz * st.kzMax ? '#c0392b' : '' } }, String(kz))));
    }
    box.append(tablo);
    if (st.mod === 'oto') {
      box.append(h('div.row', { style: { marginTop: '10px', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, h('b.small', 'Zorluk yüzdesi'),
        ...['1', '2', '3'].map(z => h('label.row', { style: { gap: '4px' } }, h('span.chip.lvl' + z, { 1: 'Kolay', 2: 'Orta', 3: 'Zor' }[z]), h('input.inp', { type: 'number', min: 0, max: 100, step: 5, value: st.oran[z], style: { width: '70px' }, on: { input: e => { st.oran[z] = Math.max(0, Math.min(100, +e.target.value || 0)); } } }), '%')),
        h('button.btn.btn-sm.btn-ghost', { type: 'button', on: { click: () => { st.oran = { 1: 30, 2: 50, 3: 20 }; draw(); } } }, 'Önerilen: %30 · %50 · %20')),
        h('p.small.muted', 'Kırmızı: bu sınırla bölüm dolmuyor; “Kazanım başına en çok” değerini artırın ya da eksikleri belgede elle tamamlayın.'));
    } else {
      box.append(h('div.row', { style: { marginTop: '10px', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('b.small', 'Listelenecek sorular'),
        ...[['', 'Hepsi'], ['1', 'Kolay'], ['2', 'Orta'], ['3', 'Zor']].map(([v, l]) => h('button.chip-btn' + (st.zor === v ? '.on' : ''), { type: 'button', on: { click: () => { st.zor = v; draw(); } } }, l))),
        h('p.small.muted', '“Denemeyi kur”a basınca her bölüm için o bölümün soruları sırayla listelenir; istediklerinizi işaretleyin.'));
    }
  };
  box.doldur = async (d) => {
    if (st.mod === 'bos') return true;
    const tur = denemeTuru(d.meta.tur);
    if (st.mod === 'oto' && st.oran[1] + st.oran[2] + st.oran[3] !== 100) { toast('Zorluk yüzdelerinin toplamı 100 olmalı'); return false; }
    let eksik = 0;
    for (const sec of d.sections) {
      const pool = havuzu(sec.name, tur);
      if (st.mod === 'elle') {
        const ids = new Set(pool.map(q => q.id));
        if (!ids.size) continue;
        const r = await pickQuestions({ title: `${sec.name} — ${sec.hedef ? sec.hedef + ' soru seçin' : 'soru seçin'}`, filter: q => ids.has(q.id), preset: st.zor ? { zorluk: st.zor } : {}, max: sec.hedef || 0, kazanimMax: st.kzMax });
        if (r === null) return false;
        sec.qids = r; continue;
      }
      const n = sec.hedef || 0; if (!n) continue;
      // kazanımlara göre grupla (kazanımı olmayanlar konuya göre), sıralı listeden eşit aralıklarla n grup seç
      const gmap = new Map();
      for (const q of shuffle(pool)) { const k = q.kazanim || ('konu:' + (q.konu || '?')); if (!gmap.has(k)) gmap.set(k, []); gmap.get(k).push(q); }
      const keys = [...gmap.keys()].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
      // her turda bütün kazanımlardan birer soru; son eksik tur kazanımlara eşit aralıkla yayılır
      const secilen = []; const tavan = st.kzMax || Infinity;
      for (let tur = 0; tur < tavan && secilen.length < n; tur++) {
        const uygun = keys.filter(k => gmap.get(k).length > tur); if (!uygun.length) break;
        const kalanN = n - secilen.length;
        secilen.push(...(uygun.length <= kalanN ? uygun : Array.from({ length: kalanN }, (_, i) => uygun[Math.floor(i * uygun.length / kalanN)])));
      }
      secilen.sort((a, b) => keys.indexOf(a) - keys.indexOf(b));
      const t = st.oran[1] + st.oran[2] + st.oran[3]; const k1 = Math.round(secilen.length * st.oran[1] / t), k3 = Math.round(secilen.length * st.oran[3] / t);
      const kota = { 1: k1, 3: k3, 2: secilen.length - k1 - k3 }, kalan = { ...kota };
      const yakin = { 1: ['1', '2', '3'], 2: ['2', '1', '3'], 3: ['3', '2', '1'] };
      sec.qids = secilen.map(k => {
        const z = ['3', '1', '2'].sort((a, b) => kalan[b] / (kota[b] || 1) - kalan[a] / (kota[a] || 1)).find(z => kalan[z] > 0) || '2'; kalan[z]--;
        const g = gmap.get(k); for (const zz of yakin[z]) { const j = g.findIndex(q => zor(q) === zz); if (j >= 0) return g.splice(j, 1)[0].id; } return g.shift().id;
      });
      eksik += Math.max(0, n - sec.qids.length);
    }
    if (eksik) toast(`Depoda yeterli kazanım yok: ${eksik} soru eksik kaldı`);
    return true;
  };
  draw();
  box.redraw = draw;
  return box;
}

// ---------- Test: tek kazanım (ya da alt çıktı) · Tarama: birden çok kazanım ----------
const ALT_RE = /^\d+\.\d+\.\d+-[a-zçğıöşü]\b/i;
async function kazanimCard(kind, seciliSoruVar) {
  const tek = kind === 'test';
  const all = await db.all('questions');
  const last = (await db.kvGet('kazanimSecim')) || {};
  const siniflar = Object.keys(OGRENME_CIKTILARI);
  const st = { sinif: siniflar.includes(last.sinif) ? last.sinif : '9. Sınıf', ders: last.ders || 'Kimya', secili: new Set(), alt: '', adet: tek ? 10 : 20, adetElle: false, elleZor: '', oran: { 1: 30, 2: 50, 3: 20 }, doldur: !seciliSoruVar };
  const zor = q => ['1', '2', '3'].includes(String(q.zorluk)) ? String(q.zorluk) : '2';
  const oneri = () => tek ? 10 : Math.max(10, Math.min(40, st.secili.size * 4));
  const box = h('div.card', { style: { marginTop: '12px' } });
  const havuz = kod => all.filter(q => q.kazanim === kod && q.sinif === st.sinif && (q.ders || '') === st.ders);
  const altlar = kod => [...new Set(havuz(kod).map(q => (q.altKazanim || '').trim()).filter(a => ALT_RE.test(a)))].sort((a, b) => a.localeCompare(b, 'tr'));
  const draw = () => {
    box.innerHTML = '';
    const liste = (OGRENME_CIKTILARI[st.sinif] || []).filter(x => x.ders === st.ders);
    const dersler = [...new Set((OGRENME_CIKTILARI[st.sinif] || []).map(x => x.ders))].sort((a, b) => a.localeCompare(b, 'tr'));
    if (!dersler.includes(st.ders)) st.ders = dersler.includes('Kimya') ? 'Kimya' : dersler[0];
    box.append(h('h3', { style: { margin: '0 0 4px' } }, tek ? 'Hangi kazanımın testi?' : 'Hangi kazanımları tarayacak?'),
      h('p.small.muted', { style: { margin: '0 0 10px' } }, tek ? 'Bir kazanım seçin; depoda alt çıktısı etiketli sorular varsa alt çıktıyı da seçebilirsiniz.' : 'Taranacak kazanımları işaretleyin; sorular seçtiğiniz kazanımlara eşit dağıtılır.'),
      h('div.grid.grid-2', { style: { gap: '8px' } },
        h('label.fld', 'Sınıf', h('select.inp', { on: { change: e => { st.sinif = e.target.value; st.secili.clear(); st.alt = ''; draw(); } } }, siniflar.map(o => h('option', { value: o, selected: o === st.sinif }, o)))),
        h('label.fld', 'Ders', h('select.inp', { on: { change: e => { st.ders = e.target.value; st.secili.clear(); st.alt = ''; draw(); } } }, dersler.map(o => h('option', { value: o, selected: o === st.ders }, o))))));
    const temalar = [...new Set(liste.map(x => x.tema || ''))];
    const kutu = h('div', { style: { maxHeight: '420px', overflow: 'auto', marginTop: '10px', display: 'grid', gap: '4px' } });
    for (const t of temalar) {
      const ks = liste.filter(x => (x.tema || '') === t);
      kutu.append(h('div.row', { style: { margin: '8px 0 2px', gap: '8px' } }, h('b.small', t || 'Kazanımlar'),
        !tek ? h('button.btn.btn-sm.btn-ghost', { type: 'button', on: { click: () => { const hepsi = ks.every(x => st.secili.has(x.kod)); ks.forEach(x => hepsi ? st.secili.delete(x.kod) : st.secili.add(x.kod)); draw(); } } }, ks.every(x => st.secili.has(x.kod)) ? 'Temayı bırak' : 'Temayı seç') : null));
      for (const x of ks) {
        const n = havuz(x.kod).length;
        const on = st.secili.has(x.kod);
        kutu.append(h('label.item-row.tur-opt', { style: { cursor: 'pointer', alignItems: 'flex-start' } },
          h('input', { type: tek ? 'radio' : 'checkbox', name: 'kz', checked: on, style: { marginTop: '4px' }, on: { change: e => { if (tek) { st.secili.clear(); st.alt = ''; } e.target.checked ? st.secili.add(x.kod) : st.secili.delete(x.kod); draw(); } } }),
          h('span.txt', h('b', x.kod), ' ', h('span', x.metin), h('div.small.muted', n ? `depoda ${n} soru` : 'depoda soru yok'))));
        if (tek && on) {
          const a = altlar(x.kod);
          if (a.length) kutu.append(h('div.chips', { style: { margin: '2px 0 6px 30px' } },
            [['', 'Bütün alt çıktılar'], ...a.map(v => [v, v])].map(([v, l]) => h('button.chip-btn' + (st.alt === v ? '.on' : ''), { type: 'button', on: { click: () => { st.alt = v; draw(); } } }, l + (v ? ` (${havuz(x.kod).filter(q => (q.altKazanim || '').trim() === v).length})` : '')))));
        }
      }
    }
    if (!liste.length) kutu.append(h('p.small.muted', 'Bu sınıf ve ders için kazanım listesi yok.'));
    box.append(kutu);
    const uygun = () => [...st.secili].flatMap(k => havuz(k).filter(q => !(tek && st.alt) || (q.altKazanim || '').trim() === st.alt));
    const toplam = uygun().length;
    if (!st.adetElle) st.adet = oneri();
    const say = uygun().reduce((a, q) => (a[zor(q)]++, a), { 1: 0, 2: 0, 3: 0 });
    box.append(h('div.row', { style: { marginTop: '12px', gap: '14px', flexWrap: 'wrap', alignItems: 'center' } },
      h('div.seg', [[true, '⚡ Otomatik seç'], [false, '✋ Kendim seçeyim']].map(([v, l]) => h('button' + (st.doldur === v ? '.on' : ''), { type: 'button', on: { click: () => { st.doldur = v; draw(); } } }, l))),
      st.doldur ? h('label.row', { style: { gap: '6px' } }, 'Toplam soru', h('input.inp', { type: 'number', min: 1, max: 100, value: st.adet, style: { width: '80px' }, on: { input: e => { st.adet = Math.max(1, Math.min(100, +e.target.value || 1)); st.adetElle = true; ozet(); } } })) : null,
      st.doldur ? h('span.small.muted', `Önerilen: ${oneri()} soru`, st.adetElle && st.adet !== oneri() ? h('button.btn.btn-sm.btn-ghost', { type: 'button', on: { click: () => { st.adetElle = false; draw(); } } }, 'Öneriyi uygula') : null) : null,
      h('span.small.muted', st.secili.size ? `${st.secili.size} kazanım seçili · uygun ${toplam} soru` : 'Henüz kazanım seçilmedi')));
    if (!st.doldur) {
      box.append(h('div.row', { style: { marginTop: '10px', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, h('b.small', 'Listelenecek sorular'),
        ...[['', 'Hepsi', toplam], ['1', 'Kolay', say[1]], ['2', 'Orta', say[2]], ['3', 'Zor', say[3]]].map(([v, l, n]) =>
          h('button.chip-btn' + (st.elleZor === v ? '.on' : ''), { type: 'button', on: { click: () => { st.elleZor = v; draw(); } } }, `${l} (${n})`))),
        h('p.small.muted', { style: { marginTop: '6px' } }, '“Testi kur”a bastığınızda seçtiğiniz kazanımların ' + ({ '': '', 1: 'kolay ', 2: 'orta ', 3: 'zor ' }[st.elleZor]) + 'soruları listelenir; istediklerinizi işaretleyip ekleyin. Listede zorluğu yine değiştirebilirsiniz.'));
      return;
    }
    const ad = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
    const ozetEl = h('div.small.muted', { style: { marginTop: '6px' } });
    const ozet = () => {
      const k = kota();
      ozetEl.textContent = `Dağılım: ${k[1]} kolay · ${k[2]} orta · ${k[3]} zor` + (st.secili.size ? `  —  depoda ${say[1]} kolay, ${say[2]} orta, ${say[3]} zor` : '') + (st.oran[1] + st.oran[2] + st.oran[3] !== 100 ? '  ⚠ Yüzdelerin toplamı 100 olmalı' : '');
    };
    box.append(h('div.row', { style: { marginTop: '10px', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } }, h('b.small', 'Zorluk yüzdesi'),
      ...['1', '2', '3'].map(z => h('label.row', { style: { gap: '4px' } }, h('span.chip.lvl' + z, ad[z]), h('input.inp', { type: 'number', min: 0, max: 100, step: 5, value: st.oran[z], style: { width: '70px' }, on: { input: e => { st.oran[z] = Math.max(0, Math.min(100, +e.target.value || 0)); ozet(); } } }), '%')),
      h('button.btn.btn-sm.btn-ghost', { type: 'button', on: { click: () => { st.oran = { 1: 30, 2: 50, 3: 20 }; draw(); } } }, 'Önerilen: %30 · %50 · %20')), ozetEl);
    ozet();
  };
  const kota = () => { const t = st.oran[1] + st.oran[2] + st.oran[3] || 1; const k1 = Math.round(st.adet * st.oran[1] / t), k3 = Math.round(st.adet * st.oran[3] / t); return { 1: k1, 3: k3, 2: Math.max(0, st.adet - k1 - k3) }; };
  draw();
  box.secim = async () => {
    if (!st.secili.size) { toast(tek ? 'Bir kazanım seçin' : 'En az bir kazanım seçin'); box.scrollIntoView({ behavior: 'smooth' }); return null; }
    db.kvSet('kazanimSecim', { sinif: st.sinif, ders: st.ders });
    const kodlar = [...st.secili];
    let qids = [];
    if (st.doldur) {
      if (st.oran[1] + st.oran[2] + st.oran[3] !== 100) { toast('Zorluk yüzdelerinin toplamı 100 olmalı'); return null; }
      const gruplar = kodlar.map(k => shuffle(havuz(k).filter(q => !(tek && st.alt) || (q.altKazanim || '').trim() === st.alt)));
      const al = (n, uyar) => { let i = 0, alinan = 0; while (alinan < n && gruplar.some(g => g.some(uyar))) { const g = gruplar[i++ % gruplar.length]; const j = g.findIndex(uyar); if (j >= 0) { qids.push(g.splice(j, 1)[0].id); alinan++; } } };
      const k = kota();
      for (const z of ['1', '2', '3']) al(k[z], q => zor(q) === z);
      al(st.adet - qids.length, q => zor(q) === '2'); al(st.adet - qids.length, () => true); // eksik kalanı diğer zorluklardan tamamla
      // kolaydan zora sırala
      const byId = Object.fromEntries(all.map(q => [q.id, q])); qids.sort((a, b) => zor(byId[a]) - zor(byId[b]));
    }
    if (!st.doldur) {
      const uyan = new Set([...st.secili].flatMap(k => havuz(k).filter(q => !(tek && st.alt) || (q.altKazanim || '').trim() === st.alt)).map(q => q.id));
      if (!uyan.size) { toast('Seçtiğiniz kazanımlarda depoda soru yok'); return null; }
      const sec = await pickQuestions({ title: `Soru seçin — ${uyan.size} uygun soru`, filter: q => uyan.has(q.id), preset: st.elleZor ? { zorluk: st.elleZor } : {} });
      if (!sec?.length) return null;
      qids = sec;
    }
    const konu = tek ? ((st.alt ? st.alt + ' · ' : '') + (ciktiMetni(kodlar[0]) || kodlar[0])) : [...new Set(kodlar.map(k => (OGRENME_CIKTILARI[st.sinif] || []).find(x => x.kod === k)?.tema).filter(Boolean))].join(', ');
    return { sinif: st.sinif, ders: st.ders, kodlar, konu, qids, eksik: st.doldur && qids.length < st.adet };
  };
  return box;
}

// ---------- Senaryodan yazılı kurma (MEB konu-soru dağılım tabloları) ----------
function senaryoUygula(d, st, sc) {
  const [donem, sira] = st.sinav.split(/(?<=Dönem) /);
  d.title = `${st.sinif} ${st.ders} Dersi ${st.sinav}`;
  d.meta.sinif = st.sinif; d.meta.ders = st.ders;
  Object.assign(d.ayar, { donem, testAdi: sira, yil: SENARYO_YILI, ogrenmeCiktilari: true, puanEtiketi: true });
  d.senaryo = { sinav: st.sinav, ad: sc.ad };
  const qi = d.items; const base = Math.floor(100 / qi.length), extra = 100 - base * qi.length;
  qi.forEach((it, i) => { it.puan = base + (i >= qi.length - extra ? 1 : 0); });
  return d;
}

async function senaryoCard(onKur) {
  const all = await db.all('questions');
  const last = (await db.kvGet('senaryoSecim')) || {};
  const st = { sinif: last.sinif || '9. Sınıf', ders: last.ders || 'Kimya', sinav: last.sinav || '', sen: 0 };
  const box = h('div');
  const sel = (opts, val, on) => h('select.inp', { on: { change: e => on(e.target.value) } }, opts.map(o => h('option', { value: o, selected: o === val }, o)));
  const pool = kod => all.filter(q => q.kazanim === kod && q.sinif === st.sinif && (q.ders || '') === st.ders);
  const draw = () => {
    box.innerHTML = '';
    const data = SENARYOLAR[st.sinif]?.[st.ders] || null;
    const mevcut = Object.keys(SENARYOLAR[st.sinif] || {});
    const sinavlar = data ? Object.keys(data) : [];
    if (!sinavlar.includes(st.sinav)) st.sinav = sinavlar[0] || '';
    box.append(h('div.grid.grid-3', { style: { gap: '8px' } },
      h('label.fld', 'Sınıf', sel(SINIFLAR.slice(4, 12), st.sinif, v => { st.sinif = v; st.sen = 0; draw(); })),
      h('label.fld', 'Ders', h('select.inp', { on: { change: e => { st.ders = e.target.value; st.sen = 0; draw(); } } },
        mevcut.length ? h('optgroup', { label: 'Senaryosu olan dersler' }, mevcut.map(o => h('option', { value: o, selected: o === st.ders }, o))) : null,
        h('optgroup', { label: 'Diğer dersler' }, DERSLER.filter(x => !mevcut.includes(x)).map(o => h('option', { value: o, selected: o === st.ders }, o))))),
      h('label.fld', 'Sınav', sinavlar.length ? sel(sinavlar, st.sinav, v => { st.sinav = v; st.sen = 0; draw(); }) : h('select.inp', { disabled: true }, h('option', '—')))));
    if (!data) { box.append(h('p.small.muted', { style: { marginTop: '10px' } }, `${st.sinif} ${st.ders} için ${SENARYO_YILI} senaryo tablosu yok` + (mevcut.length ? ` (bu sınıfta olanlar: ${mevcut.join(', ')}).` : '. 8. sınıf ve 12. sınıfta (kimya dışında) OYSS senaryosu yayımlanmadı.') + ' Boş kâğıtla başlayıp depodan soru ekleyebilirsiniz.')); return; }
    const list = data[st.sinav];
    if (list?.ulke) { box.append(h('p.small', { style: { marginTop: '10px' } }, `${st.sinif} ${st.ders} ${st.sinav} ülke genelinde tek ortak sınav olarak yapılır; okul senaryosu yok.`)); return; }
    box.append(h('div.row', { style: { margin: '10px 0 6px', gap: '6px', flexWrap: 'wrap' } }, list.map((x, i) => h('button.btn.btn-sm' + (i === st.sen ? '.btn-primary' : ''), { on: { click: () => { st.sen = i; draw(); } } }, `${x.ad} · ${Object.values(x.d).reduce((a, b) => a + b, 0)} soru`))));
    const sc = list[st.sen];
    let eksik = 0;
    const rows = Object.entries(sc.d).map(([kod, n]) => { const p = pool(kod).length; if (p < n) eksik += n - p; return h('tr', h('td', h('b', kod), h('div.small.muted', ciktiMetni(kod))), h('td', { style: { textAlign: 'center' } }, h('b', String(n))), h('td', { style: { textAlign: 'center', color: p < n ? 'var(--bad)' : 'var(--ok)' } }, 'depoda ' + p)); });
    box.append(h('table.table', h('tr', h('th', 'Öğrenme çıktısı'), h('th', 'Soru'), h('th', '')), rows));
    if (eksik) box.append(h('p.small', { style: { color: 'var(--bad)' } }, `Depoda ${eksik} soru eksik; o çıktılar için yer tutucu soru konur, kâğıtta doldurursunuz.`));
    box.append(h('button.btn.btn-primary', { style: { width: '100%', marginTop: '8px', padding: '12px' }, on: { click: () => kur(sc) } }, 'Soruları yerleştir →'));
  };
  const kur = async sc => {
    await db.kvSet('senaryoSecim', { sinif: st.sinif, ders: st.ders, sinav: st.sinav });
    const qids = [], used = (await db.all('documents')).flatMap(d => (d.items || []).map(i => i.qid));
    for (const [kod, n] of Object.entries(sc.d)) {
      const p = pool(kod).sort((a, b) => (used.includes(a.id) - used.includes(b.id)) || Math.random() - .5);
      qids.push(...p.slice(0, n).map(q => q.id));
      for (let k = p.length; k < n; k++) {
        const q = { id: uid(), type: 'klasik', text: `(${kod} için soru yazın: ${ciktiMetni(kod)})`, choices: [], answer: '', ders: st.ders, sinif: st.sinif, kazanim: kod, zorluk: 2, created: Date.now(), yerTutucu: true };
        await db.put('questions', q); qids.push(q.id);
      }
    }
    const d = onKur ? null : newDoc('yazili', { qids });
    if (onKur) return onKur(senaryoUygula({ items: qids.map(qid => ({ qid, puan: 0 })), meta: {}, ayar: {} }, st, sc));
    senaryoUygula(d, st, sc);
    await db.put('documents', d); location.hash = '#/belge/' + d.id;
  };
  draw();
  return h('div.card', { style: { marginTop: '12px' } }, h('h3', { style: { marginTop: 0 } }, '📋 MEB dağılım tablosundan hazırla'),
    h('p.small.muted', `MEB ${SENARYO_YILI} ortak yazılı konu-soru dağılım tablolarından birini seçin; sorular depodaki etiketli sorulardan yerleşir.`), box);
}

// ---------- Editör ----------
export async function editorView(app, { id }) {
  ensureFonts();
  let doc = await db.get('documents', id);
  if (!doc) { app.append(h('div.card', 'Belge bulunamadı. ', h('a', { href: '#/belgeler' }, 'Dosyalarıma dön'))); return; }
  migrate(doc);
  let brand = await getBrand();
  let qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q]));
  let teacher = false;
  let stampMode = null;
  const A = () => doc.ayar;
  loadKatex().then(k => { if (k) { setKatex(k); refresh(); } });

  // ---- Geri al / yinele ----
  const past = [], future = [];
  let lastSnap = JSON.stringify(doc);
  const snapshot = () => { const s = JSON.stringify(doc); if (s !== lastSnap) { past.push(lastSnap); if (past.length > 80) past.shift(); lastSnap = s; future.length = 0; updUndo(); } };
  const restore = s => { doc = JSON.parse(s); lastSnap = s; drawAll(); save(true); };
  const undo = () => { if (!past.length) return; future.push(JSON.stringify(doc)); restore(past.pop()); updUndo(); };
  const redo = () => { if (!future.length) return; past.push(JSON.stringify(doc)); restore(future.pop()); updUndo(); };
  const undoBtn = h('button.btn.btn-sm', { title: 'Geri al (Ctrl+Z)', on: { click: undo } }, '↶');
  const redoBtn = h('button.btn.btn-sm', { title: 'Yinele (Ctrl+Y)', on: { click: redo } }, '↷');
  const updUndo = () => { undoBtn.disabled = !past.length; redoBtn.disabled = !future.length; };
  const onKey = e => {
    if (!(e.ctrlKey || e.metaKey) || e.target.tagName === 'TEXTAREA' || (e.target.tagName === 'INPUT' && !['checkbox', 'radio', 'range', 'button'].includes(e.target.type))) return;
    if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
  };
  document.addEventListener('keydown', onKey);

  // ---- Önizleme ----
  const pages = h('div');
  const scaleBox = h('div.preview-scale', pages);
  const area = h('div.preview-area', scaleBox);
  const pageInfo = h('span.small.muted');
  let scale = 1;
  const fitScale = () => {
    const pw = (PAPERS[A().kagit] || PAPERS.A4)[0] * 3.7795;
    scale = Math.min(1, (area.clientWidth - 36) / pw);
    scaleBox.style.transform = `scale(${scale})`; scaleBox.style.width = pw + 'px';
    scaleBox.style.height = (pages.offsetHeight * scale) + 'px';
  };
  let rt, rendering = Promise.resolve();
  const refresh = () => { clearTimeout(rt); rt = setTimeout(() => { rendering = rendering.then(async () => {
    const n = await renderDoc(pages, doc, qmap, brand, { teacher });
    pageInfo.textContent = n + ' sayfa'; fitScale(); bindStamps();
  }); }, 160); };
  window.addEventListener('resize', fitScale);

  // Sayfaya damga: tıkla-yerleştir, sürükle-taşı
  function bindStamps() {
    pages.querySelectorAll('.sheet').forEach((sh, pg) => {
      sh.onclick = e => {
        if (!stampMode) return;
        const r = sh.getBoundingClientRect();
        (doc.damgalar ||= []).push({ id: uid(), pg, sid: stampMode, x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 });
        stampMode = null; area.style.cursor = ''; changed(); toast('Damga basıldı — sürükleyerek taşıyabilirsiniz');
      };
      sh.querySelectorAll('[data-stamp]').forEach(img => {
        img.onpointerdown = ev => {
          ev.preventDefault(); ev.stopPropagation(); img.setPointerCapture(ev.pointerId);
          const r = sh.getBoundingClientRect(); const st = (doc.damgalar || []).find(x => x.id === img.dataset.stamp);
          img.onpointermove = mv => { st.x = (mv.clientX - r.left) / r.width * 100; st.y = (mv.clientY - r.top) / r.height * 100; img.style.left = st.x + '%'; img.style.top = st.y + '%'; };
          img.onpointerup = () => { img.onpointermove = null; changed(); };
        };
        img.ondblclick = () => { doc.damgalar = doc.damgalar.filter(x => x.id !== img.dataset.stamp); changed(); };
      });
    });
  }

  // ---- Kaydet ----
  let st;
  const save = (now) => { clearTimeout(st); st = setTimeout(async () => { doc.updated = Date.now(); await db.put('documents', doc); await db.kvSet('sonBelge', doc.id); }, now ? 0 : 300); };
  let snapT;
  const changed = () => { save(); refresh(); clearTimeout(snapT); snapT = setTimeout(snapshot, 350); };

  const content = h('div.card');
  const settings = h('div');
  const drawAll = () => { drawContent(); drawSettings(); refresh(); };

  // ---------- İçerik ----------
  const reloadQ = async () => { qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q])); };
  const qLabel = q => q ? (q.text ? q.text.replace(/[*_{}^=!+]/g, '').replace(/\s+/g, ' ').slice(0, 60) : '🖼 Görsel soru') + (q.answer ? ' · ' + q.answer : '') : '(silinmiş soru)';
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  const filterForDoc = () => {
    const s = doc.meta?.sinif, d = doc.meta?.ders;
    return { sinif: s || '', ders: d || '' };
  };

  function drawContent() {
    content.innerHTML = '';
    if (doc.kind === 'foy') drawFoy(); else if (doc.kind === 'deneme') drawDeneme(); else drawItems();
  }

  async function senaryoAc() {
    let m;
    const card = await senaryoCard(async r => {
      if (doc.items.length && !await confirmBox('Kâğıttaki sorular seçilen senaryonun sorularıyla değiştirilsin mi? Sorular depoda kalır.', 'Değiştir')) return;
      doc.items = r.items; doc.title = r.title; doc.senaryo = r.senaryo; Object.assign(doc.meta, r.meta); Object.assign(doc.ayar, r.ayar);
      m.close(); await reloadQ(); drawAll(); changed(); toast('Kâğıt senaryoya göre kuruldu');
    });
    m = modal('MEB dağılım tablosundan hazırla', card, { wide: true });
  }

  function drawItems() {
    const items = doc.items;
    const qItems = items.filter(i => i.type !== 'kok');
    const total = qItems.reduce((a, b) => a + (+b.puan || 0), 0);
    if (doc.kind === 'yazili') content.append(h('button.btn.btn-accent', { style: { width: '100%', marginBottom: '12px' }, on: { click: senaryoAc } }, doc.senaryo ? `📋 Senaryo: ${doc.senaryo.sinav} · ${doc.senaryo.ad} — değiştir` : '📋 MEB tablosundan hazırla (sınıf · ders · senaryo)'));
    content.append(h('div.row', h('h3', { style: { margin: 0 } }, 'Kâğıt (' + qItems.length + ' soru)'), h('span.spacer'),
      h('button.btn.btn-sm.btn-primary', { on: { click: async () => { const ids = await pickQuestions({ exclude: qItems.map(i => i.qid), preset: filterForDoc() }); if (!ids?.length) return; await reloadQ(); ids.forEach(qid => items.push({ qid, puan: 0 })); if (doc.kind === 'yazili') equalize(); drawContent(); changed(); } } }, '+ Depodan'),
      h('button.btn.btn-sm', { on: { click: () => editQuestion(null, async q => { await reloadQ(); items.push({ qid: q.id, puan: 0 }); if (doc.kind === 'yazili') equalize(); drawContent(); changed(); }, { preset: { sinif: doc.meta.sinif, ders: doc.meta.ders, konu: doc.meta.konu } }) } }, '+ Yeni yaz'),
      h('button.btn.btn-sm', { title: 'Sorunun üstüne ortak kök ya da bilgi kutusu', on: { click: () => editKok(null, k => { items.push(k); drawContent(); changed(); }) } }, '+ Ortak kök')));
    if (doc.kind === 'yazili') {
      content.append(h('div.row', { style: { margin: '8px 0' } }, h('span', 'Toplam puan: ', h('b', String(total))), h('span.spacer'), h('button.btn.btn-sm', { on: { click: () => { equalize(); drawContent(); changed(); } } }, 'Eşit dağıt')));
      if (qItems.length && total !== 100) content.append(h('div.warn', `Puanların toplamı ${total}. Yazılı sınavda toplam 100 olmalı.`));
    }
    if (!items.length) content.append(h('p.muted.small', 'Henüz soru yok. Depodan seçin, yeni soru yazın ya da üstteki ✂ ile PDF’ten kırpın.'));
    const list = h('div', { style: { display: 'grid', gap: '6px', marginTop: '8px' } });
    let n = 0;
    items.forEach((it, i) => {
      if (it.type === 'kok') {
        list.append(h('div.item-row', { style: { background: '#f4f8fc' } }, h('b', '◆'), h('span.txt', 'Ortak kök: ' + (it.text || '').slice(0, 50)),
          h('button.icon-btn', { title: 'Düzenle', on: { click: () => editKok(it, () => { drawContent(); changed(); }) } }, '✎'),
          h('button.icon-btn', { on: { click: () => { move(items, i, -1); drawContent(); changed(); } } }, '↑'),
          h('button.icon-btn', { on: { click: () => { move(items, i, 1); drawContent(); changed(); } } }, '↓'),
          h('button.icon-btn', { on: { click: () => { items.splice(i, 1); drawContent(); changed(); } } }, '✕')));
        return;
      }
      n++;
      list.append(h('div.item-row',
        h('b', String(n)),
        h('span.txt', { title: qLabel(qmap[it.qid]) }, qLabel(qmap[it.qid])),
        doc.kind === 'yazili' ? h('input.inp', { type: 'number', min: 0, value: it.puan ?? 0, title: 'Puan', on: { change: e => { it.puan = +e.target.value; drawContent(); changed(); } } }) : null,
        (A().cols || 2) > 1 ? h('button.icon-btn', { title: 'Soruyu iki sütuna yay (tam genişlik)', style: it.genis ? { color: 'var(--orange)' } : null, on: { click: () => { it.genis = !it.genis; drawContent(); changed(); } } }, '⇔') : null,
        h('button.icon-btn', { title: 'Düzenle / çözüm yaz', on: { click: () => qmap[it.qid] && editQuestion(qmap[it.qid], async () => { await reloadQ(); drawContent(); refresh(); }) } }, '✎'),
        h('button.icon-btn', { title: 'Yukarı', on: { click: () => { move(items, i, -1); drawContent(); changed(); } } }, '↑'),
        h('button.icon-btn', { title: 'Aşağı', on: { click: () => { move(items, i, 1); drawContent(); changed(); } } }, '↓'),
        h('button.icon-btn', { title: 'Kâğıttan çıkar', on: { click: () => { items.splice(i, 1); drawContent(); changed(); } } }, '✕')));
    });
    content.append(list);
  }
  function equalize() {
    const qi = doc.items.filter(i => i.type !== 'kok'); const n = qi.length; if (!n) return;
    const base = Math.floor(100 / n), extra = 100 - base * n;
    qi.forEach((it, i) => { it.puan = base + (i >= n - extra ? 1 : 0); });
  }
  function editKok(k, onSave) {
    const d = k || { type: 'kok', text: '', baslik: '', image: '' };
    const ta = h('textarea.inp', { rows: 5, value: d.text, placeholder: 'Ortak metin, tablo açıklaması ya da bilgi kutusu' });
    const bs = h('input.inp', { value: d.baslik, placeholder: 'Başlık (boşsa: “Aşağıdaki soruları bu bilgilere göre cevaplayınız.”)' });
    const img = h('img', { src: d.image || '', style: { maxHeight: '120px', display: d.image ? 'block' : 'none' } });
    const fi = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; d.image = await shrinkImage(await readFileAsDataURL(f)); img.src = d.image; img.style.display = 'block'; } } });
    let m;
    m = modal(k ? 'Ortak kökü düzenle' : 'Ortak kök / bilgi kutusu', h('div', { style: { display: 'grid', gap: '10px' } }, bs, ta, h('div.row', h('button.btn.btn-sm', { on: { click: () => fi.click() } }, '🖼 Görsel'), fi), img,
      h('label.check', h('input', { type: 'checkbox', checked: d.genis !== false, on: { change: e => { d.genis = e.target.checked; } } }), 'Tam genişlikte bas')),
      { actions: [h('button.btn.btn-primary', { on: { click: () => { d.text = ta.value; d.baslik = bs.value; if (d.genis === undefined) d.genis = true; m.close(); onSave(d); } } }, 'Kaydet')] });
  }

  function drawDeneme() {
    const t = denemeTuru(doc.meta.tur) || denemeTuru('serbest');
    content.append(h('div.row', h('h3', { style: { margin: 0 } }, 'Bölümler'), h('span.spacer'), h('span.small.muted', t.ad + ' · ' + t.sik + ' şık')),
      h('div.row', { style: { margin: '8px 0' } },
        h('button.btn.btn-sm', { on: { click: async () => {
          const pool = (await db.all('questions')).filter(q => (q.type || 'coktan') === 'coktan');
          const used = new Set(doc.sections.flatMap(s => s.qids));
          let added = 0;
          for (const sec of doc.sections) {
            const need = (sec.hedef || 0) - sec.qids.length; if (need <= 0) continue;
            const key = sec.name.toLocaleLowerCase('tr-TR').split(/[ –-]/)[0];
            const cands = pool.filter(q => !used.has(q.id) && (q.ders || '').toLocaleLowerCase('tr-TR').includes(key) && (!doc.meta.sinif || !q.sinif || q.sinif === doc.meta.sinif));
            for (const q of cands.slice(0, need)) { sec.qids.push(q.id); used.add(q.id); added++; }
          }
          drawContent(); changed(); toast(added ? added + ' soru depodan yerleştirildi' : 'Bölüm adlarıyla eşleşen ders etiketli soru bulunamadı');
        } } }, '⚡ Depodan otomatik doldur'),
        h('button.btn.btn-sm', { on: { click: () => chooseTur() } }, 'Türü değiştir')));
    doc.sections.forEach((sec, si) => {
      const n = sec.qids.length;
      const box = h('div.block-ed', { style: { marginTop: '10px' } },
        h('div.row', { style: { flexWrap: 'nowrap' } },
          h('input.inp', { value: sec.name, on: { input: e => { sec.name = e.target.value; changed(); } } }),
          h('input.inp', { type: 'number', min: 0, value: sec.sure || '', placeholder: 'dk', title: 'Bölüm süresi (dk)', style: { width: '64px' }, on: { input: e => { sec.sure = e.target.value; changed(); } } }),
          h('button.icon-btn', { title: 'Bölümü sil', on: { click: async () => { if (await confirmBox('“' + sec.name + '” bölümü silinsin mi?', 'Sil')) { doc.sections.splice(si, 1); drawContent(); changed(); } } } }, '✕')),
        h('div.row.small', h('span', h('b', String(n)), sec.hedef ? ' / ' + sec.hedef + ' soru' : ' soru'),
          sec.hedef && n !== sec.hedef ? h('span', { style: { color: n > sec.hedef ? 'var(--bad)' : 'var(--muted)' } }, n > sec.hedef ? '(fazla)' : '(eksik)') : null,
          h('span.spacer'),
          h('button.btn.btn-sm.btn-primary', { on: { click: async () => {
            const used = doc.sections.flatMap(s => s.qids);
            const ids = await pickQuestions({ exclude: used, title: sec.name + ' — depodan seç', preset: { sinif: doc.meta.sinif || '' } });
            if (!ids?.length) return; await reloadQ(); sec.qids.push(...ids); drawContent(); changed();
          } } }, '+ Soru')),
        h('div', { style: { display: 'grid', gap: '4px' } }, sec.qids.map((qid, i) => h('div.item-row', h('b', String(i + 1)), h('span.txt', qLabel(qmap[qid])),
          h('button.icon-btn', { on: { click: () => { move(sec.qids, i, -1); drawContent(); changed(); } } }, '↑'),
          h('button.icon-btn', { on: { click: () => { move(sec.qids, i, 1); drawContent(); changed(); } } }, '↓'),
          h('button.icon-btn', { on: { click: () => { sec.qids.splice(i, 1); drawContent(); changed(); } } }, '✕')))));
      content.append(box);
    });
    content.append(h('button.btn.btn-sm', { style: { marginTop: '10px' }, on: { click: () => { doc.sections.push({ id: uid(), name: 'Yeni bölüm', hedef: 0, qids: [] }); drawContent(); changed(); } } }, '+ Bölüm ekle'));
  }
  function chooseTur() {
    let m; const opts = [];
    DENEME_TURLERI.forEach(a => a.turler.forEach(t => opts.push(h('button.btn', { style: { justifyContent: 'flex-start' }, on: { click: async () => {
      const has = doc.sections.some(s => s.qids.length);
      if (has && !await confirmBox('Bölümler yeniden kurulsun mu? Eklenen sorular bölümlerden çıkarılır (depoda kalır).', 'Yeniden kur')) return;
      doc.meta.tur = t.id; doc.meta.sure = t.sure ? t.sure + ' dk' : '';
      doc.sections = t.bolumler.map(b => ({ id: uid(), name: b.name, hedef: b.n, qids: [], sure: b.sure || '' }));
      m.close(); drawAll(); changed();
    } } }, a.aile + ' · ' + t.ad))));
    m = modal('Deneme türü', h('div', { style: { display: 'grid', gap: '6px', maxHeight: '60vh', overflow: 'auto' } }, opts));
  }

  function drawFoy() {
    const blocks = doc.blocks;
    content.append(h('div.row', h('h3', { style: { margin: 0 } }, 'Bloklar'), h('span.spacer'),
      h('button.btn.btn-sm', { on: { click: bulkPaste } }, '📋 Notları yapıştır'),
      !blocks.length ? h('button.btn.btn-sm', { on: { click: () => { doc.blocks = sampleFoy(); drawContent(); changed(); } } }, 'Örnek anlatımı yükle') : null));
    const list = h('div', { style: { display: 'grid', gap: '8px', marginTop: '8px' } });
    const addMenu = (at) => h('div.row', { style: { gap: '4px' } }, Object.entries(FOY_TYPES).map(([t, l]) => h('button.btn.btn-sm', { style: { padding: '3px 7px', fontSize: '.78rem' }, on: { click: async () => {
      if (t === 'soru') { const ids = await pickQuestions({ preset: filterForDoc() }); if (!ids?.length) return; await reloadQ(); blocks.splice(at, 0, ...ids.map(qid => ({ id: uid(), t: 'soru', qid }))); }
      else blocks.splice(at, 0, { id: uid(), t, text: '' });
      drawContent(); changed();
    } } }, '+ ' + l)));
    blocks.forEach((b, i) => {
      const head = h('div.bh', FOY_TYPES[b.t] || b.t, h('span.spacer'),
        h('button.icon-btn', { title: 'Buraya blok ekle', on: { click: e => { const x = e.target.closest('.block-ed'); const ex = x.querySelector('.addhere'); if (ex) ex.remove(); else x.append(h('div.addhere', addMenu(i + 1))); } } }, '+'),
        h('button.icon-btn', { on: { click: () => { move(blocks, i, -1); drawContent(); changed(); } } }, '↑'),
        h('button.icon-btn', { on: { click: () => { move(blocks, i, 1); drawContent(); changed(); } } }, '↓'),
        h('button.icon-btn', { title: 'Bloğu sil', on: { click: () => { blocks.splice(i, 1); drawContent(); changed(); } } }, '✕'));
      const ed = h('div.block-ed', head);
      if (b.t === 'soru') ed.append(qmap[b.qid] ? qCard(qmap[b.qid]) : h('i.muted', 'Silinmiş soru'));
      else if (b.t === 'sayfa') ed.append(h('span.small.muted', 'Sonraki blok yeni sayfadan başlar.'));
      else if (b.t === 'ayrac') ed.append(h('span.small.muted', 'Yatay ayraç çizgisi'));
      else if (b.t === 'bosluk') ed.append(h('label.row.small', 'Yükseklik (mm) ', h('input.inp', { type: 'number', value: b.yukseklik || 10, style: { width: '80px' }, on: { input: e => { b.yukseklik = +e.target.value; changed(); } } })));
      else {
        if (b.t !== 'gorsel') ed.append(h(b.t === 'baslik' || b.t === 'arabaslik' ? 'input.inp' : 'textarea.inp', { value: b.text || '', rows: b.t === 'paragraf' || b.t === 'anlatim' ? 5 : 3, placeholder: 'Metin. **kalın**, ==vurgu==, !!uyarı!!, x^2, H_2O, $\\frac{a}{b}$, satır başında “- ” madde', on: { input: e => { b.text = e.target.value; changed(); } } }));
        if (b.t === 'ornek' || b.t === 'alistirma') {
          ed.append(h('textarea.inp', { rows: 2, value: b.cevap || '', placeholder: b.t === 'ornek' ? 'Çözüm (öğrenci sürümünde de görünür)' : 'Cevap / çözüm (öğretmen sürümünde)', on: { input: e => { b.cevap = e.target.value; changed(); } } }));
          ed.append(h('div.row.small', 'Doğru şık: ', h('div.seg', ['', 'A', 'B', 'C', 'D', 'E'].map(L => h('button' + ((b.harf || '') === L ? '.on' : ''), { type: 'button', on: { click: () => { b.harf = L; drawContent(); changed(); } } }, L || '—')))));
        }
        if (!['baslik', 'arabaslik'].includes(b.t)) {
          const inp = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; b.image = await shrinkImage(await readFileAsDataURL(f)); drawContent(); changed(); } } });
          ed.append(h('div.row', b.image ? h('img', { src: b.image, style: { maxHeight: '54px', borderRadius: '6px' } }) : null,
            h('button.btn.btn-sm', { on: { click: () => inp.click() } }, b.image ? 'Görseli değiştir' : '+ Görsel'),
            b.image ? h('div.seg', [['left', '⇤'], ['center', '↔'], ['right', '⇥']].map(([v, l]) => h('button' + ((b.align || 'center') === v ? '.on' : ''), { type: 'button', on: { click: () => { b.align = v; drawContent(); changed(); } } }, l))) : null,
            b.image ? h('div.seg', [30, 50, 70, 100].map(w => h('button' + ((b.imgW || 100) === w ? '.on' : ''), { type: 'button', on: { click: () => { b.imgW = w; drawContent(); changed(); } } }, '%' + w))) : null,
            b.image ? h('button.btn.btn-sm.btn-ghost', { on: { click: () => { delete b.image; drawContent(); changed(); } } }, 'Kaldır') : null, inp));
        }
      }
      list.append(ed);
    });
    content.append(list, h('div', { style: { marginTop: '10px' } }, h('div.small.muted', 'Sona öğe ekle'), addMenu(blocks.length)));
  }
  function bulkPaste() {
    const ta = h('textarea.inp', { rows: 14, placeholder: '# Konu başlığı\n## Ara başlık\nParagraf metni…\n\nNOT: …\nDİKKAT: …\nKURAL: …\nTANIM: …\nİPUCU: …\nÖrnek: soru metni\nÇözüm: …\nŞimdi Sen: …\n---' });
    let m;
    m = modal('Notları yapıştır — otomatik bloklara böl', h('div', h('p.small.muted', 'Hazır notlarınızı yapıştırın. Satır başındaki anahtar kelimelere göre bloklara ayrılır; boş satırla ayrılan metinler paragraf olur.'), ta),
      { wide: true, actions: [h('button.btn.btn-primary', { on: { click: () => { const bl = parseNotes(ta.value); doc.blocks.push(...bl); m.close(); drawContent(); changed(); toast(bl.length + ' blok eklendi'); } } }, 'Bloklara böl')] });
  }

  // ---------- Ayar paneli ----------
  const sec = (title, open, ...kids) => { const d = h('details.card', { open, style: { padding: '12px 16px' } }, h('summary', { style: { cursor: 'pointer', fontWeight: 800, fontSize: '.8rem', letterSpacing: '.06em', color: 'var(--orange)', textTransform: 'uppercase' } }, title), h('div', { style: { display: 'grid', gap: '10px', marginTop: '10px' } }, kids)); return d; };
  const chk = (label, get, set) => h('label.check', h('input', { type: 'checkbox', checked: !!get(), on: { change: e => { set(e.target.checked); changed(); } } }), label);
  const txt = (label, obj, key, ph, hint) => h('label.fld', label, h('input.inp', { value: obj[key] || '', placeholder: ph || '', on: { input: e => { obj[key] = e.target.value; changed(); } } }), hint ? h('span.small.muted', { style: { fontWeight: 400 } }, hint) : null);
  const sel = (label, obj, key, opts, after) => h('label.fld', label, h('select.inp', { value: obj[key] ?? '', on: { change: e => { obj[key] = e.target.value; changed(); after?.(); } } }, Object.entries(opts).map(([v, l]) => h('option', { value: v }, typeof l === 'string' ? l : l.ad))));
  const range = (label, obj, key, min, max, unit) => { const out = h('b', (obj[key] ?? min) + unit); return h('label.fld', h('span', label, ': ', out), h('input', { type: 'range', min, max, value: obj[key] ?? min, on: { input: e => { obj[key] = +e.target.value; out.textContent = e.target.value + unit; changed(); } } })); };
  const segPick = (values, cur, onPick) => { const s = h('div.seg', values.map(([v, l]) => h('button' + (v === cur ? '.on' : ''), { type: 'button', on: { click: e => { [...s.children].forEach(b => b.classList.toggle('on', b === e.target)); onPick(v); } } }, l))); return s; };

  function drawSettings() {
    settings.innerHTML = '';
    const a = A(); a.ogrenci ||= {};
    const k = doc.kind;
    settings.append(
      sec('Temel bilgiler', true,
        h('label.fld', 'Konu / başlık', h('input.inp', { value: doc.title, on: { input: e => { doc.title = e.target.value; changed(); } } }), h('span.small.muted', { style: { fontWeight: 400 } }, 'Her sayfanın üstündeki künyede basılır.')),
        h('div.form-grid',
          h('label.fld', 'Sınıf', h('select.inp', { value: doc.meta.sinif || '', on: { change: e => { doc.meta.sinif = e.target.value; changed(); } } }, h('option', { value: '' }, '—'), SINIFLAR.map(s => h('option', { value: s }, s)))),
          h('label.fld', 'Ders / alan', h('input.inp', { value: doc.meta.ders || '', placeholder: 'Ders seçin ya da yazın', list: 'dersListE', on: { input: e => { doc.meta.ders = e.target.value; changed(); } } }), h('datalist#dersListE', DERSLER.map(x => h('option', { value: x })))),
          k !== 'deneme' ? txt('Konu', doc.meta, 'konu', '') : null,
          k !== 'foy' && k !== 'banka' ? txt('Süre', doc.meta, 'sure', '40 dk') : null),
        h('div.row', h('b.small', 'Sütun'), segPick([[1, '1 Sütun'], [2, '2 Sütun']], a.cols || 2, v => { a.cols = v; drawContent(); changed(); }))),
      sec('Sayfa ve yerleşim', true,
        sel('Kâğıt boyutu', a, 'kagit', { A4: 'A4 (210 × 297 mm)', A5: 'A5 (148 × 210 mm)', A3: 'A3 (297 × 420 mm)', Letter: 'Letter (216 × 279 mm)', Legal: 'Legal (216 × 356 mm)' }),
        k !== 'foy' ? range('Sorular arası boşluk', a, 'bosluk', 2, 60, ' mm') : null,
        k !== 'foy' ? sel('Akıllı yerleştirme', a, 'akilli', { ikisi: 'Açık — az sayfa + boşluğu eşit dağıt', esit: 'Yalnızca boşluğu sayfaya eşit dağıt', az: 'Yalnızca daha az sayfa (boşluğu gerekirse daralt)', yok: 'Kapalı — sorular üstten sıkışık dizilir' }) : null,
        k !== 'foy' ? h('p.small.muted', { style: { margin: '-4px 0 0' } }, 'Eşit dağıt: dolu sayfalarda kalan boşluk sorular arasına paylaştırılır, sayfa altı boş kalmaz. Az sayfa: son sayfaya birkaç soru taşıyorsa boşluk otomatik daraltılır.') : null,
        range('Yazı ölçeği', a, 'olcek', 70, 140, '%'),
        k !== 'foy' ? chk('Soru başına puan etiketi — “(5 Puan)”', () => a.puanEtiketi, v => a.puanEtiketi = v) : null,
        k !== 'foy' ? chk('Süreç bileşeni etiketini göster (ör. “Bağlam”)', () => a.surecGoster, v => a.surecGoster = v) : null),
      k !== 'foy' ? sec('Künye', false,
        txt('Okul / kurum adı', a, 'okul', brand.kurum || 'Ör. Atatürk Ortaokulu', 'Boşsa marka kimliğindeki ad basılır.'),
        txt('Sıra no / test adı', a, 'testAdi', '3  ·  Kavrama Testi', `Sayı yazarsanız “3. ${KINDS[k].ek}” olur.`),
        txt('Ders öğretmeni', a, 'ogretmen', brand.ogretmen || ''),
        k === 'yazili' || k === 'deneme' ? h('div.form-grid', txt('Eğitim-öğretim yılı', a, 'yil', '2026-2027'), txt('Dönem', a, 'donem', '1. Dönem'), txt('Tarih', a, 'tarih', '')) : null,
        k === 'yazili' || k === 'test' || k === 'deneme' ? h('label.fld', 'Sınav yönergesi', h('textarea.inp', { rows: 2, value: a.yonerge || '', on: { input: e => { a.yonerge = e.target.value; changed(); } } }), segPick([['ust', 'Başlığın altında'], ['alt', 'Sayfanın sonunda']], a.yonergeYer || 'ust', v => { a.yonergeYer = v; changed(); })) : null,
        k === 'yazili' ? h('label.fld', 'Kâğıt sonu imzaları', ...[0, 1, 2].map(i => h('div.row', { style: { flexWrap: 'nowrap' } }, h('input.inp', { placeholder: 'Ad Soyad', value: a.imzalar?.[i]?.ad || '', on: { input: e => { (a.imzalar ||= [])[i] = { ...(a.imzalar[i] || {}), ad: e.target.value }; changed(); } } }), h('input.inp', { placeholder: 'Unvan (Ders Öğretmeni, Müdür…)', value: a.imzalar?.[i]?.unvan || '', on: { input: e => { (a.imzalar ||= [])[i] = { ...(a.imzalar[i] || {}), unvan: e.target.value }; changed(); } } }))), h('span.small.muted', { style: { fontWeight: 400 } }, 'Son soru sayfasının altına yan yana basılır; boş satır basılmaz.')) : null) : null,
      k !== 'foy' ? sec('Öğrenci satırı', false,
        chk('Adı Soyadı satırı', () => a.ogrenci.ad, v => a.ogrenci.ad = v), chk('Sınıf / Şube', () => a.ogrenci.sinif, v => a.ogrenci.sinif = v), chk('Okul numarası', () => a.ogrenci.no, v => a.ogrenci.no = v),
        chk('Puan kutusu (ALDIĞI NOT)', () => a.ogrenci.puan, v => a.ogrenci.puan = v), chk('Veli imza alanı', () => a.ogrenci.veli, v => a.ogrenci.veli = v)) : null,
      k === 'yazili' ? sec('Cevap alanı', false,
        h('div.seg', { style: { flexWrap: 'wrap' } }, [['bos', 'Boş'], ['cerceve', 'Çerçeve'], ['cozum', 'ÇÖZÜM kutusu'], ['cizgili', 'Çizgili'], ['kareli', 'Kareli']].map(([v, l]) => h('button' + ((a.cevapAlani || 'cerceve') === v ? '.on' : ''), { type: 'button', on: { click: () => { a.cevapAlani = v; drawSettings(); changed(); } } }, l))),
        range('Her sorunun altına', a, 'cevapYukseklik', 10, 120, ' mm')) : null,
      k === 'foy' ? sec('Anlatım ayarları', false,
        h('label.fld', 'Örnek / Şimdi Sen cevapları', h('select.inp', { value: a.foyCevap || 'yok', on: { change: e => { a.foyCevap = e.target.value; changed(); } } }, h('option', { value: 'yok' }, 'Basılmasın'), h('option', { value: 'satir' }, 'Her sayfanın altında — tek satır'), h('option', { value: 'kutu' }, 'Her sayfanın altında — kutu içinde')), h('span.small.muted', { style: { fontWeight: 400 } }, 'Doğru şık bloktan seçilir; “Örnek 1: B” biçiminde basılır.')),
        chk('Örnek çözümlerini öğrenci sürümünde göster', () => a.cozumGoster !== false, v => a.cozumGoster = v),
        chk('Öne kapak ekle', () => a.kapak, v => a.kapak = v),
        h('label.fld', 'Karekod bağlantısı (ör. konu videosu)', h('input.inp', { value: a.karekod || '', placeholder: 'https://…', on: { change: e => { a.karekod = e.target.value.trim(); changed(); } } }), h('span.small.muted', { style: { fontWeight: 400 } }, 'İlk sayfanın başlığına basılır; öğrenci okutup videoyu açar.'))) : null,
      k !== 'foy' ? sec('Baskı ekleri', false,
        k !== 'yazili' ? chk('Sona cevap anahtarı ekle', () => a.anahtar, v => a.anahtar = v) : chk('Sona cevap anahtarı ekle', () => a.anahtar, v => a.anahtar = v),
        chk('Sona öğrenme çıktıları ekle', () => a.ogrenmeCiktilari, v => a.ogrenmeCiktilari = v),
        sel('Çözümler', a, 'cozumler', { yok: 'Gösterme', alt: 'Her sorunun altında', sonda: 'Sonda, ayrı sayfalarda' }),
        k === 'test' || k === 'banka' ? sel('Cevap anahtarı nereye basılsın?', a, 'anahtarYeri', { ayri: 'Ayrı sayfada', satir: 'Her sayfanın altında — tek satır', kutu: 'Her sayfanın altında — kutu içinde', sag: 'Her sayfanın sağ altında — küçük tablo', sol: 'Her sayfanın sol altında — küçük tablo' }) : h('span.small.muted', 'Anahtar her zaman ayrı sayfaya basılır; öğrencinin sayfasında görünmez.'),
        k === 'test' || k === 'deneme' ? chk('Optik form ekle', () => a.optik, v => a.optik = v) : null,
        k === 'test' || k === 'deneme' || k === 'yazili' ? h('div.row', h('b.small', 'Kitapçık'), segPick([['-', 'Yok'], ['A', 'A'], ['B', 'B'], ['AB', 'A + B']], (a.kitapciklar || ['A']).join(''), v => { a.kitapciklar = v.split(''); changed(); }), h('span.small.muted', 'B: aynı sorular, karışık sıra ve şıklar')) : null,
        chk(k === 'deneme' ? 'Öne kapak sayfası — ders / soru / süre tablosu' : k === 'banka' ? 'Öne kapak — ders, sınıf, konu listesi' : 'Öne kapak ekle', () => a.kapak, v => a.kapak = v),
        k === 'banka' ? chk('İçindekiler sayfası ekle', () => a.icindekiler, v => a.icindekiler = v) : null,
        k === 'banka' ? chk('Konu başlıklarıyla böl', () => a.konuBaslik !== false, v => a.konuBaslik = v) : null,
        k === 'banka' ? chk('Her bölüm 1’den numaralansın', () => a.bolumNumara, v => a.bolumNumara = v) : null,
        txt('Kaynak künyesi', a, 'kaynak', 'Boşsa soruların kaynağı yazılır', 'Cevap anahtarı sayfasına basılır.'),
        h('label.fld', 'Karekod bağlantısı', h('input.inp', { value: a.karekod || '', placeholder: 'https://…', on: { change: e => { a.karekod = e.target.value.trim(); changed(); } } }), h('span.small.muted', { style: { fontWeight: 400 } }, 'Öğrencinin kâğıdında görünmez; yalnız cevap anahtarı sayfasına basılır.'))) : null,
      sec('Sayfa tasarımı', false,
        h('p.small.muted', { style: { margin: 0 } }, 'Yalnız bu belgeye uygulanır; boş bırakılanlar marka kimliğinden gelir.'),
        ...[['baslik', 'Başlık tasarımı', HEADERS], ['sablon', 'Sayfa şablonu', TEMPLATES], ['soruNo', 'Soru numarası', Q_NUMS], ['sayfaNo', 'Sayfa numarası', PAGE_NUMS], ['govdeFont', 'Gövde yazı tipi', BODY_FONTS], ['baslikFont', 'Başlık yazı tipi', TITLE_FONTS], ['altBilgi', 'Alt bilgi', FOOTERS], ['boyut', 'Yazı boyutu', SIZES]].map(([key, label, opts]) => {
          doc.gorunum ||= {};
          return h('label.fld', label, h('select.inp', { value: doc.gorunum[key] || '', on: { change: e => { if (e.target.value) doc.gorunum[key] = e.target.value; else delete doc.gorunum[key]; changed(); } } }, h('option', { value: '' }, '— Kurum kimliğinden —'), Object.entries(opts).map(([v, l]) => h('option', { value: v }, typeof l === 'string' ? l : l.ad))));
        }),
        h('div.row', h('button.btn.btn-sm', { on: { click: () => { doc.gorunum = {}; drawSettings(); changed(); } } }, 'Tasarımı sıfırla'), h('a.btn.btn-sm', { href: '#/marka' }, 'Kurum kimliği →'))),
      sec('Sayfaya damga', false,
        (brand.damgalar || []).length ? h('div.row', brand.damgalar.map(d => h('button', { title: 'Seç, sonra sayfada bir yere tıkla', style: { border: '1px solid var(--line)', borderRadius: '8px', background: '#fff', padding: '4px', cursor: 'pointer' }, on: { click: () => { stampMode = d.id; area.style.cursor = 'crosshair'; toast('Sayfada damganın yerine tıklayın'); } } }, h('img', { src: d.img, style: { width: '48px', height: '48px', objectFit: 'contain' } })))) : h('p.small.muted', { style: { margin: 0 } }, 'Henüz damga yok. Kurum Kimliği → Damgalarım’dan oluşturun.'),
        h('span.small.muted', 'Basılan damgayı sürükleyerek taşıyın; çift tıklayınca silinir.')),
      sec('Kayıtlı ayarlar', false, ...templatesUI()));
    [...settings.childNodes].forEach(n => { if (n.nodeType === 3 && n.textContent === "null") n.remove(); });
  }

  function templatesUI() {
    const list = h('div', { style: { display: 'grid', gap: '6px' } });
    const name = h('input.inp', { placeholder: 'Ayar adı — örn. 9-A tarama testi' });
    const draw = async () => {
      const all = (await db.kvGet('sablonlar')) || [];
      list.innerHTML = '';
      all.filter(s => s.kind === doc.kind).forEach(s => list.append(h('div.item-row', h('span.txt', s.ad), h('button.btn.btn-sm', { on: { click: () => { const keep = { okul: 1, kagit: 1, bosluk: 1, olcek: 1, puanEtiketi: 1, ogrenci: 1, anahtar: 1, ogrenmeCiktilari: 1, cozumler: 1, anahtarYeri: 1, optik: 1, kapak: 1, icindekiler: 1, yonergeYer: 1, cevapAlani: 1, cevapYukseklik: 1, kitapciklar: 1, cols: 1, imzalar: 1, ogretmen: 1, yil: 1, donem: 1, yonerge: 1 }; for (const k in s.ayar) if (keep[k]) doc.ayar[k] = structuredClone(s.ayar[k]); if (s.gorunum) doc.gorunum = { ...s.gorunum }; drawAll(); changed(); toast('Şablon uygulandı'); } } }, 'Uygula'), h('button.icon-btn', { on: { click: async () => { await db.kvSet('sablonlar', all.filter(x => x !== s)); draw(); } } }, '✕'))));
    };
    draw();
    return [h('p.small.muted', { style: { margin: 0 } }, 'Kâğıt, düzen, okul adı gibi tekrar eden ayarları kaydedin; sonraki belgede tek tıkla uygulayın. Başlık, tarih ve ders şablona dahil edilmez.'),
      h('div.row', { style: { flexWrap: 'nowrap' } }, name, h('button.btn.btn-sm.btn-primary', { on: { click: async () => { if (!name.value.trim()) { toast('Şablona bir ad verin'); return; } const all = (await db.kvGet('sablonlar')) || []; const ay = structuredClone(doc.ayar); delete ay.testAdi; delete ay.tarih; all.push({ id: uid(), ad: name.value.trim(), kind: doc.kind, ayar: ay, gorunum: doc.gorunum || {} }); await db.kvSet('sablonlar', all); name.value = ''; draw(); toast('Şablon kaydedildi'); } } }, 'Kaydet')), list];
  }

  // ---------- Eylemler ----------
  const printDoc = async () => {
    const root = $('#printRoot');
    clearTimeout(rt); await rendering;
    await renderDoc(pages, doc, qmap, brand, { teacher }); fitScale(); bindStamps();
    root.innerHTML = '';
    pages.querySelectorAll('.sheet').forEach(s => root.append(s.cloneNode(true)));
    const [w, hh] = PAPERS[A().kagit] || PAPERS.A4;
    let ps = document.getElementById('pageSize'); if (!ps) { ps = h('style#pageSize'); document.head.append(ps); }
    ps.textContent = `@page{size:${w}mm ${hh}mm;margin:0}`;
    const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 80);
  };
  const exportFile = () => {
    const ids = new Set();
    (doc.items || []).forEach(i => i.qid && ids.add(i.qid)); (doc.sections || []).forEach(s => s.qids.forEach(x => ids.add(x))); (doc.blocks || []).forEach(b => b.qid && ids.add(b.qid));
    const data = { app: 'soruevim', tip: 'belge', version: 1, belge: doc, questions: [...ids].map(i => qmap[i]).filter(Boolean) };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), (doc.title || 'belge').replace(/[\\/:*?"<>|]/g, '') + '.soruevim');
    toast('Belge dosyaya kaydedildi');
  };
  const teacherBtn = h('button.btn.btn-sm', { title: 'Çözümleri göster/gizle (öğretmen sürümü)', on: { click: () => { teacher = !teacher; teacherBtn.classList.toggle('btn-accent', teacher); teacherBtn.textContent = teacher ? '👁 Öğretmen' : '👁 Öğrenci'; refresh(); } } }, '👁 Öğrenci');
  const toolbar = h('div.row.editor-toolbar', { style: { marginBottom: '12px', position: 'sticky', top: '58px', zIndex: 10, background: 'var(--cream)', padding: '6px 0' } },
    h('a.btn.btn-sm.btn-ghost', { href: '#/', title: 'Başlangıç ekranına dön' }, '⌂'),
    h('b', { style: { fontSize: '1.05rem' } }, kindInfo(doc.variant || doc.kind).ad), undoBtn, redoBtn,
    h('button.btn.btn-sm', { title: 'PDF’ten kırp — belgenin sonuna eklenir', on: { click: () => cropTool(async qs => { await reloadQ(); if (doc.kind === 'foy') doc.blocks.push(...qs.map(q => ({ id: uid(), t: 'soru', qid: q.id }))); else if (doc.kind === 'deneme') doc.sections.at(-1).qids.push(...qs.map(q => q.id)); else doc.items.push(...qs.map(q => ({ qid: q.id, puan: 0 }))); drawContent(); changed(); }) } }, '✂'),
    h('button.btn.btn-sm', { title: 'Belgeyi temizle', on: { click: async () => { if (!await confirmBox('Bütün içerik silinsin mi? Sorular depoda kalır.', 'Temizle')) return; if (doc.kind === 'foy') doc.blocks = []; else if (doc.kind === 'deneme') doc.sections.forEach(s => s.qids = []); else doc.items = []; drawContent(); changed(); } } }, '🗑'),
    teacherBtn,
    h('span.spacer'), pageInfo,
    h('button.btn.btn-sm', { title: 'Belgeyi dosyaya kaydet (.soruevim)', on: { click: exportFile } }, '💾 Kaydet'),
    h('button.btn.btn-sm', { title: 'PNG, Word', on: { click: async () => { await db.put('documents', doc); (await import('./export.js')).exportMenu(doc, { teacher, save: () => db.put('documents', doc) }); } } }, '⬇ İndir'),
    h('button.btn.btn-sm.btn-primary', { on: { click: printDoc } }, '🖨 Yazdır / PDF'));

  app.append(toolbar, h('div.editor', h('div.editor-side', content, settings,
    h('div.card', h('p.small.muted', { style: { margin: 0 } }, 'Yazdırma penceresinde “PDF olarak kaydet” seçin; kenar boşluğu “Yok”, arka plan grafikleri açık olsun.'),
      h('button.btn.btn-danger.btn-sm', { style: { marginTop: '8px' }, on: { click: async () => { if (!await confirmBox('Bu belge silinsin mi? Sorular depoda kalır.', 'Sil')) return; await db.del('documents', doc.id); location.hash = '#/belgeler'; } } }, 'Belgeyi sil'))), area));
  updUndo();
  drawAll();
  db.kvSet('sonBelge', doc.id);
  return () => { window.removeEventListener('resize', fitScale); document.removeEventListener('keydown', onKey); };
}

// ---------- Notları bloklara böl ----------
export function parseNotes(text) {
  const blocks = []; const paras = [];
  const flush = () => { const t = paras.join('\n').trim(); if (t) blocks.push({ id: uid(), t: 'paragraf', text: t }); paras.length = 0; };
  const KEYS = [[/^#\s+(.*)/, 'baslik'], [/^##\s+(.*)/, 'arabaslik'], [/^(?:NOT|Not)\s*[:：]\s*(.*)/, 'not'], [/^(?:DİKKAT|Dikkat)\s*[:：]\s*(.*)/, 'dikkat'], [/^(?:KURAL|Kural)\s*[:：]\s*(.*)/, 'kural'], [/^(?:TANIM|Tanım)\s*[:：]\s*(.*)/, 'tanim'], [/^(?:İPUCU|İpucu|PÜF(?: NOKTASI)?|Püf(?: noktası)?)\s*[:：]\s*(.*)/, 'puf'], [/^(?:FORMÜL|Formül)\s*[:：]\s*(.*)/, 'formul'], [/^(?:Örnek|ÖRNEK)(?:\s*\d+)?\s*[:：.]\s*(.*)/, 'ornek'], [/^(?:Şimdi Sen|ŞİMDİ SEN|Sıra Sizde|SIRA SİZDE)(?:\s*\d+)?\s*[:：.]\s*(.*)/, 'alistirma']];
  let last = null;
  for (const raw of text.split('\n')) {
    const ln = raw.trimEnd();
    if (/^\s*---+\s*$/.test(ln)) { flush(); blocks.push({ id: uid(), t: 'ayrac' }); last = null; continue; }
    const cz = ln.match(/^(?:Çözüm|ÇÖZÜM|Cevap)\s*[:：]\s*(.*)/);
    if (cz && last && (last.t === 'ornek' || last.t === 'alistirma')) { last.cevap = (last.cevap ? last.cevap + '\n' : '') + cz[1]; continue; }
    let hit = null;
    for (const [re, t] of KEYS) { const m = ln.match(re); if (m) { hit = [t, m[1]]; break; } }
    if (hit) { flush(); last = { id: uid(), t: hit[0], text: hit[1] }; blocks.push(last); continue; }
    if (!ln.trim()) { flush(); last = null; continue; }
    if (last && last.t !== 'baslik' && last.t !== 'arabaslik') { last.text += '\n' + ln; continue; }
    paras.push(ln);
  }
  flush();
  return blocks;
}

function sampleFoy() {
  return parseNotes(`# Mol Kavramı
Maddelerin tanecik sayısını ifade etmek için **mol** birimi kullanılır. 1 mol, Avogadro sayısı kadar (N_{A} = 6,02·10^{23}) tanecik içerir.

## Mol – Kütle İlişkisi
TANIM: Bir maddenin 1 molünün gram cinsinden kütlesine ==mol kütlesi== denir.
KURAL: $n = \\dfrac{m}{M_A}$
- n: mol sayısı
- m: kütle (g)
- M_{A}: mol kütlesi (g/mol)
DİKKAT: Mol kütlesi ile atom kütlesi !!aynı şey değildir!!; birimleri farklıdır.
Örnek: 8 g CH_4 kaç moldür? (C: 12, H: 1)
Çözüm: M_{A} = 12 + 4·1 = 16 g/mol → n = 8 / 16 = 0,5 mol
İPUCU: Gazlarda NŞA’da 1 mol = 22,4 L olduğunu hatırlayın.
Şimdi Sen: 0,2 mol H_2O kaç gramdır? (H: 1, O: 16)
Cevap: 3,6 g
---
NOT: Avogadro sayısı yalnızca atomlar için değil, iyon ve moleküller için de geçerlidir.`);
}
