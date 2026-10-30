import { h, toast, uid, confirmBox, readFileAsDataURL, shrinkImage, $ } from '../util.js';
import { db, getBrand } from '../db.js';
import { KINDS, DENEME_PRESETS, renderDoc } from '../render.js';
import { pickQuestions, editQuestion, qCard } from './pool.js';
import { createExamFromDoc } from './exams.js';

const FOY_TYPES = { baslik: 'Başlık', anlatim: 'Anlatım', formul: 'Formül', ornek: 'Örnek', uyari: 'Dikkat', not: 'Not', alistirma: 'Sıra sizde', soru: 'Havuzdan soru', sayfa: 'Sayfa sonu' };
const SINIFLAR = Array.from({ length: 12 }, (_, i) => (i + 1) + '. Sınıf').concat(['Mezun']);

function newDoc(kind) {
  const d = { id: uid(), kind, title: KINDS[kind].ad, meta: { sinif: '', ders: '', konu: '', sure: kind === 'test' ? '40 dk' : kind === 'yazili' ? '40 dk' : '' }, kitapcik: kind === 'foy' || kind === 'banka' ? '' : 'A', seed: Math.floor(Math.random() * 1e6), options: { cols: kind === 'foy' ? 1 : 2, anahtar: true, optik: false }, created: Date.now(), updated: Date.now() };
  if (kind === 'foy') d.blocks = [{ id: uid(), t: 'baslik', text: 'Konu başlığı' }, { id: uid(), t: 'anlatim', text: 'Konu anlatımınızı buraya yazın.' }, { id: uid(), t: 'ornek', text: 'Örnek soru', cevap: 'Çözüm' }];
  else if (kind === 'deneme') { d.meta.tur = 'LGS'; d.meta.sure = DENEME_PRESETS.LGS.sure; d.sections = DENEME_PRESETS.LGS.bolumler.map(([name, hedef]) => ({ id: uid(), name, hedef, qids: [] })); d.options.optik = true; }
  else d.items = [];
  return d;
}

export async function editorView(app, { id, kind }) {
  let doc = id ? await db.get('documents', id) : newDoc(kind);
  if (!doc) { app.append(h('div.card', 'Belge bulunamadı. ', h('a', { href: '#/belgeler' }, 'Belgelerime dön'))); return; }
  const brand = await getBrand();
  let qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q]));
  let teacher = false;
  let isNew = !id;

  // ---- Önizleme ----
  const pages = h('div');
  const scaleBox = h('div.preview-scale', pages);
  const area = h('div.preview-area', scaleBox);
  const pageInfo = h('span.small.muted');
  const fitScale = () => {
    const s = Math.min(1, (area.clientWidth - 36) / 794);
    scaleBox.style.transform = `scale(${s})`; scaleBox.style.width = '794px';
    scaleBox.style.height = (pages.offsetHeight * s) + 'px';
  };
  let rt, rendering = Promise.resolve();
  const refresh = () => { clearTimeout(rt); rt = setTimeout(() => { rendering = rendering.then(async () => {
    const n = await renderDoc(pages, doc, qmap, brand, { teacher });
    pageInfo.textContent = n + ' sayfa';
    fitScale();
  }); }, 150); };
  window.addEventListener('resize', fitScale);

  // ---- Kaydet ----
  let st;
  const save = () => { clearTimeout(st); st = setTimeout(async () => {
    doc.updated = Date.now(); await db.put('documents', doc);
    if (isNew) { isNew = false; history.replaceState(null, '', '#/belge/' + doc.id); }
  }, 300); };
  const changed = () => { save(); refresh(); };

  // ---- Genel ayarlar ----
  const metaFld = (label, key, attrs = {}) => h('label.fld', label, h('input', { value: doc.meta[key] || '', ...attrs, on: { input: e => { doc.meta[key] = e.target.value; changed(); } } }));
  const general = h('div.card',
    h('label.fld', 'Belge başlığı', h('input', { value: doc.title, on: { input: e => { doc.title = e.target.value; changed(); } } })),
    h('div.form-grid', { style: { marginTop: '10px' } },
      h('label.fld', 'Sınıf', h('select', { value: doc.meta.sinif || '', on: { change: e => { doc.meta.sinif = e.target.value; changed(); } } }, h('option', { value: '' }, '—'), SINIFLAR.map(s => h('option', { value: s }, s)))),
      metaFld('Ders', 'ders'),
      doc.kind !== 'deneme' ? metaFld('Konu', 'konu') : null,
      doc.kind !== 'foy' && doc.kind !== 'banka' ? metaFld('Süre', 'sure', { placeholder: '40 dk' }) : null));

  const optionsCard = h('div.card', h('h3', 'Seçenekler'), h('div', { style: { display: 'grid', gap: '10px' } },
    doc.kitapcik !== '' ? h('div.row', h('b.small', 'Kitapçık'), seg(['A', 'B'], doc.kitapcik, v => { doc.kitapcik = v; changed(); }), h('span.small.muted', 'B: aynı sorular, karışık sıra')) : null,
    ['foy', 'banka', 'test'].includes(doc.kind) ? h('div.row', h('b.small', 'Sütun'), seg(['1', '2'], String(doc.options.cols || 2), v => { doc.options.cols = +v; changed(); })) : null,
    doc.kind !== 'yazili' ? check('Cevap anahtarı sayfası ekle', doc.options.anahtar !== false, v => { doc.options.anahtar = v; changed(); }) : null,
    ['test', 'deneme'].includes(doc.kind) ? check('Optik form sayfası ekle', !!doc.options.optik, v => { doc.options.optik = v; changed(); }) : null,
    doc.kind === 'banka' ? check('Konu başlıklarıyla böl', doc.options.konuBaslik !== false, v => { doc.options.konuBaslik = v; changed(); }) : null,
    check('Öğretmen sürümü (cevap ve çözümler görünsün)', teacher, v => { teacher = v; refresh(); }),
  ));

  // ---- İçerik ----
  const content = h('div.card');
  const drawContent = () => {
    content.innerHTML = '';
    if (doc.kind === 'foy') drawFoy(); else if (doc.kind === 'deneme') drawDeneme(); else drawItems();
  };

  const reloadQ = async () => { qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q])); };
  const qLabel = q => q ? (q.text ? q.text.replace(/\s+/g, ' ').slice(0, 60) : '🖼 Görsel soru') + (q.answer ? ' · ' + q.answer : '') : '(silinmiş soru)';
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

  function drawItems() {
    const items = doc.items;
    const total = items.reduce((a, b) => a + (+b.puan || 0), 0);
    content.append(h('div.row', h('h3', { style: { margin: 0 } }, 'Sorular (' + items.length + ')'), h('span.spacer'),
      h('button.btn.btn-sm.btn-primary', { on: { click: async () => { const ids = await pickQuestions({ exclude: items.map(i => i.qid) }); if (!ids?.length) return; await reloadQ(); ids.forEach(qid => items.push({ qid, puan: 0 })); if (doc.kind === 'yazili') equalize(); drawContent(); changed(); } } }, '+ Havuzdan'),
      h('button.btn.btn-sm', { on: { click: () => editQuestion(null, async q => { await reloadQ(); items.push({ qid: q.id, puan: 0 }); if (doc.kind === 'yazili') equalize(); drawContent(); changed(); }) } }, '+ Yeni yaz')));
    if (doc.kind === 'yazili') {
      content.append(h('div.row', { style: { margin: '8px 0' } }, h('span', 'Toplam puan: ', h('b', String(total))), h('span.spacer'), h('button.btn.btn-sm', { on: { click: () => { equalize(); drawContent(); changed(); } } }, 'Eşit dağıt')));
      if (items.length && total !== 100) content.append(h('div.warn', `Puanların toplamı ${total}. Yazılı sınavda toplam 100 olmalı.`));
    }
    if (!items.length) content.append(h('p.muted.small', 'Henüz soru yok. Havuzdan seçin ya da yeni soru yazın.'));
    const list = h('div', { style: { display: 'grid', gap: '6px', marginTop: '8px' } });
    items.forEach((it, i) => {
      list.append(h('div.item-row',
        h('b', String(i + 1)),
        h('span.txt', { title: qLabel(qmap[it.qid]) }, qLabel(qmap[it.qid])),
        doc.kind === 'yazili' ? h('input.inp', { type: 'number', min: 0, value: it.puan ?? 0, on: { change: e => { it.puan = +e.target.value; drawContent(); changed(); } } }) : null,
        h('button.icon-btn', { title: 'Düzenle', on: { click: () => qmap[it.qid] && editQuestion(qmap[it.qid], async () => { await reloadQ(); drawContent(); refresh(); }) } }, '✎'),
        h('button.icon-btn', { title: 'Yukarı', on: { click: () => { move(items, i, -1); drawContent(); changed(); } } }, '↑'),
        h('button.icon-btn', { title: 'Aşağı', on: { click: () => { move(items, i, 1); drawContent(); changed(); } } }, '↓'),
        h('button.icon-btn', { title: 'Çıkar', on: { click: () => { items.splice(i, 1); drawContent(); changed(); } } }, '✕')));
    });
    content.append(list);
  }
  function equalize() {
    const n = doc.items.length; if (!n) return;
    const base = Math.floor(100 / n), extra = 100 - base * n;
    doc.items.forEach((it, i) => { it.puan = base + (i >= n - extra ? 1 : 0); });
  }

  function drawDeneme() {
    const presetSel = h('select.inp', { value: doc.meta.tur || 'LGS', on: { change: async e => {
      const v = e.target.value;
      const hasQ = doc.sections.some(s => s.qids.length);
      if (hasQ && !await confirmBox('Bölümler yeniden kurulsun mu? Eklediğiniz sorular bölümlerden çıkarılır (havuzda kalır).', 'Yeniden kur')) { e.target.value = doc.meta.tur; return; }
      doc.meta.tur = v; doc.meta.sure = DENEME_PRESETS[v].sure;
      doc.sections = DENEME_PRESETS[v].bolumler.map(([name, hedef]) => ({ id: uid(), name, hedef, qids: [] }));
      drawContent(); changed();
    } } }, Object.keys(DENEME_PRESETS).map(k => h('option', { value: k }, k)));
    content.append(h('div.row', h('h3', { style: { margin: 0 } }, 'Bölümler'), h('span.spacer'), h('label.fld', { style: { flexDirection: 'row', alignItems: 'center' } }, 'Düzen ', presetSel)));
    doc.sections.forEach((sec, si) => {
      const n = sec.qids.length;
      const box = h('div.block-ed', { style: { marginTop: '10px' } },
        h('div.row', { style: { flexWrap: 'nowrap' } },
          h('input.inp', { value: sec.name, on: { input: e => { sec.name = e.target.value; changed(); } } }),
          h('button.icon-btn', { title: 'Bölümü sil', on: { click: async () => { if (await confirmBox('“' + sec.name + '” bölümü silinsin mi?', 'Sil')) { doc.sections.splice(si, 1); drawContent(); changed(); } } } }, '✕')),
        h('div.row.small', h('span', h('b', String(n)), sec.hedef ? ' / ' + sec.hedef + ' soru' : ' soru'),
          sec.hedef && n !== sec.hedef ? h('span', { style: { color: n > sec.hedef ? 'var(--bad)' : 'var(--muted)' } }, n > sec.hedef ? '(fazla)' : '(eksik)') : null,
          h('span.spacer'),
          h('button.btn.btn-sm.btn-primary', { on: { click: async () => {
            const used = doc.sections.flatMap(s => s.qids);
            const ids = await pickQuestions({ exclude: used, title: sec.name + ' — havuzdan seç' });
            if (!ids?.length) return; await reloadQ(); sec.qids.push(...ids); drawContent(); changed();
          } } }, '+ Soru')),
        h('div', { style: { display: 'grid', gap: '4px' } }, sec.qids.map((qid, i) => h('div.item-row', h('b', String(i + 1)), h('span.txt', qLabel(qmap[qid])),
          h('button.icon-btn', { on: { click: () => { move(sec.qids, i, -1); drawContent(); changed(); } } }, '↑'),
          h('button.icon-btn', { on: { click: () => { move(sec.qids, i, 1); drawContent(); changed(); } } }, '↓'),
          h('button.icon-btn', { on: { click: () => { sec.qids.splice(i, 1); drawContent(); changed(); } } }, '✕')))));
      content.append(box);
    });
    content.append(h('button.btn.btn-sm', { style: { marginTop: '10px' }, on: { click: () => { doc.sections.push({ id: uid(), name: 'Yeni bölüm', hedef: 0, qids: [] }); drawContent(); changed(); } } }, '+ Bölüm ekle'));
    content.append(h('label.fld', { style: { marginTop: '12px' } }, 'Kapak yönergesi', h('textarea', { rows: 2, value: doc.meta.yonerge || '', placeholder: 'Cevaplarınızı optik forma kurşun kalemle işaretleyiniz…', on: { input: e => { doc.meta.yonerge = e.target.value; changed(); } } })));
  }

  function drawFoy() {
    const blocks = doc.blocks;
    content.append(h('h3', 'Bloklar'));
    const list = h('div', { style: { display: 'grid', gap: '8px' } });
    blocks.forEach((b, i) => {
      const head = h('div.bh', FOY_TYPES[b.t], h('span.spacer'),
        h('button.icon-btn', { on: { click: () => { move(blocks, i, -1); drawContent(); changed(); } } }, '↑'),
        h('button.icon-btn', { on: { click: () => { move(blocks, i, 1); drawContent(); changed(); } } }, '↓'),
        h('button.icon-btn', { on: { click: () => { blocks.splice(i, 1); drawContent(); changed(); } } }, '✕'));
      const ed = h('div.block-ed', head);
      if (b.t === 'soru') ed.append(qmap[b.qid] ? qCard(qmap[b.qid]) : h('i.muted', 'Silinmiş soru'));
      else if (b.t === 'sayfa') ed.append(h('span.small.muted', 'Sonraki blok yeni sayfadan başlar.'));
      else {
        ed.append(h(b.t === 'baslik' ? 'input.inp' : 'textarea.inp', { value: b.text || '', rows: b.t === 'anlatim' ? 5 : 3, on: { input: e => { b.text = e.target.value; changed(); } } }));
        if (b.t === 'ornek' || b.t === 'alistirma') ed.append(h('textarea.inp', { rows: 2, value: b.cevap || '', placeholder: b.t === 'ornek' ? 'Çözüm (öğrenci sürümünde de görünür)' : 'Cevap (yalnız öğretmen sürümünde)', on: { input: e => { b.cevap = e.target.value; changed(); } } }));
        if (b.t !== 'baslik') {
          const inp = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; b.image = await shrinkImage(await readFileAsDataURL(f)); drawContent(); changed(); } } });
          ed.append(h('div.row', b.image ? h('img', { src: b.image, style: { maxHeight: '60px', borderRadius: '6px' } }) : null,
            h('button.btn.btn-sm', { on: { click: () => inp.click() } }, b.image ? 'Görseli değiştir' : '🖼 Görsel'),
            b.image ? h('button.btn.btn-sm.btn-ghost', { on: { click: () => { delete b.image; drawContent(); changed(); } } }, 'Kaldır') : null, inp));
        }
      }
      list.append(ed);
    });
    content.append(list);
    content.append(h('div.row', { style: { marginTop: '10px', gap: '6px' } }, Object.entries(FOY_TYPES).map(([t, l]) => h('button.btn.btn-sm', { on: { click: async () => {
      if (t === 'soru') { const ids = await pickQuestions({}); if (!ids?.length) return; await reloadQ(); ids.forEach(qid => blocks.push({ id: uid(), t: 'soru', qid })); }
      else blocks.push({ id: uid(), t, text: '' });
      drawContent(); changed();
    } } }, '+ ' + l))));
  }

  // ---- Eylemler ----
  const printDoc = async () => {
    const root = $('#printRoot');
    clearTimeout(rt);
    await rendering;
    await renderDoc(pages, doc, qmap, brand, { teacher });
    fitScale();
    // Ne görüyorsanız o basılır: önizlemede sayfalanmış kâğıtların aynısı
    root.innerHTML = '';
    pages.querySelectorAll('.sheet').forEach(s => root.append(s.cloneNode(true)));
    const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(() => window.print(), 50);
  };
  const actions = h('div.card', h('div', { style: { display: 'grid', gap: '8px' } },
    h('button.btn.btn-primary', { on: { click: printDoc } }, '🖨 Yazdır / PDF olarak kaydet'),
    h('p.small.muted', { style: { margin: 0 } }, 'Yazdırma penceresinde hedef olarak “PDF olarak kaydet” seçin; kenar boşluğu “Yok”, arka plan grafikleri açık olsun.'),
    ['test', 'deneme'].includes(doc.kind) ? h('button.btn', { on: { click: async () => { await db.put('documents', doc); const ex = await createExamFromDoc(doc, qmap); if (ex) location.hash = '#/sinav/' + ex.id; } } }, '📱 Bu testle sınav yap') : null,
    h('button.btn.btn-danger.btn-sm', { on: { click: async () => { if (!await confirmBox('Bu belge silinsin mi? Sorular havuzda kalır.', 'Sil')) return; await db.del('documents', doc.id); location.hash = '#/belgeler'; } } }, 'Belgeyi sil')));

  app.append(
    h('div.row', { style: { marginBottom: '14px' } }, h('a.btn.btn-sm.btn-ghost', { href: '#/belgeler' }, '← Belgelerim'), h('h1', { style: { margin: 0, fontSize: '1.4rem' } }, KINDS[doc.kind].ad), h('span.spacer'), pageInfo),
    h('div.editor', h('div.editor-side', general, content, optionsCard, actions), area));
  drawContent();
  refresh();
  if (isNew) save();
  return () => { window.removeEventListener('resize', fitScale); };
}

function seg(values, cur, onPick) {
  const s = h('div.seg', values.map(v => h('button' + (v === cur ? '.on' : ''), { type: 'button', on: { click: e => { [...s.children].forEach(b => b.classList.toggle('on', b === e.target)); onPick(v); } } }, v)));
  return s;
}
function check(label, val, on) {
  return h('label.check', h('input', { type: 'checkbox', checked: val, on: { change: e => on(e.target.checked) } }), label);
}
