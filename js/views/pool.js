import { h, toast, modal, confirmBox, readFileAsDataURL, shrinkImage, uid, LETTERS, trLower, loadImg } from '../util.js';
import { db } from '../db.js';

export const QTYPES = { coktan: 'Çoktan seçmeli', dy: 'Doğru / Yanlış', bosluk: 'Boşluk doldurma', klasik: 'Klasik (açık uçlu)' };
export const LEVELS = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
const SINIFLAR = Array.from({ length: 12 }, (_, i) => (i + 1) + '. Sınıf').concat(['Mezun']);

// ---------- Soru kartı ----------
export function qCard(q, { onClick, selected, actions } = {}) {
  return h('div.q-item' + (selected ? '.selected' : ''), { on: onClick ? { click: onClick } : null, style: onClick ? { cursor: 'pointer' } : null },
    h('div.q-body',
      q.text ? h('div.q-text', q.text.length > 280 ? q.text.slice(0, 280) + '…' : q.text) : null,
      q.image ? h('img', { src: q.image, alt: '', loading: 'lazy' }) : null,
      h('div.q-meta',
        q.answer && (q.type === 'coktan' || q.type === 'dy' || !q.type) ? h('span.chip.ans', 'Cevap ' + q.answer) : null,
        h('span.chip', QTYPES[q.type || 'coktan']),
        q.sinif ? h('span.chip', q.sinif) : null,
        q.ders ? h('span.chip', q.ders) : null,
        q.konu ? h('span.chip', q.konu) : null,
        q.zorluk ? h('span.chip.lvl' + q.zorluk, LEVELS[q.zorluk]) : null,
        q.kazanim ? h('span.chip', { title: q.kazanim }, '🎯 ' + q.kazanim.slice(0, 24)) : null)),
    actions || null);
}

// ---------- Filtre çubuğu ----------
function filterBar(all, onChange) {
  const st = { q: '', ders: '', sinif: '', zorluk: '', type: '' };
  const uniq = k => [...new Set(all.map(x => x[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  const mk = (k, label, opts) => h('select.inp', { style: { width: 'auto' }, on: { change: e => { st[k] = e.target.value; onChange(st); } } }, h('option', { value: '' }, label), opts.map(([v, l]) => h('option', { value: v }, l)));
  return h('div.row', { style: { margin: '12px 0' } },
    h('input.inp', { type: 'search', placeholder: 'Soru metni, konu ya da kazanım ara…', style: { flex: '1 1 240px', width: 'auto' }, on: { input: e => { st.q = e.target.value; onChange(st); } } }),
    mk('ders', 'Tüm dersler', uniq('ders').map(x => [x, x])),
    mk('sinif', 'Tüm sınıflar', uniq('sinif').map(x => [x, x])),
    mk('zorluk', 'Her zorluk', Object.entries(LEVELS)),
    mk('type', 'Her tip', Object.entries(QTYPES)));
}
export function applyFilter(all, st) {
  const q = trLower(st.q);
  return all.filter(x => (!st.ders || x.ders === st.ders) && (!st.sinif || x.sinif === st.sinif) && (!st.zorluk || String(x.zorluk) === st.zorluk) && (!st.type || (x.type || 'coktan') === st.type)
    && (!q || trLower([x.text, x.konu, x.kazanim, x.ders, ...(x.choices || [])].join(' ')).includes(q)));
}

// ---------- Havuz ekranı ----------
export async function poolView(app) {
  let all = (await db.all('questions')).sort((a, b) => b.created - a.created);
  let st = {};
  const list = h('div.q-list');
  const count = h('span.muted');
  const render = () => {
    const rows = applyFilter(all, st);
    count.textContent = rows.length === all.length ? `${all.length} soru` : `${rows.length} / ${all.length} soru`;
    list.innerHTML = '';
    if (!all.length) { list.append(h('div.card.empty', h('p', 'Havuz boş. Sorularınızı elle yazın ya da PDF / görselden kırpın.'), h('div.row', { style: { justifyContent: 'center' } }, addBtn(), cropBtn()))); return; }
    if (!rows.length) { list.append(h('div.empty', 'Aramaya uyan soru yok.')); return; }
    for (const q of rows.slice(0, 300)) {
      list.append(qCard(q, { actions: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
        h('button.btn.btn-sm', { on: { click: () => editQuestion(q, saved => { Object.assign(q, saved); render(); }) } }, 'Düzenle'),
        h('button.btn.btn-sm.btn-danger', { on: { click: async () => { if (!await confirmBox('Bu soru havuzdan silinsin mi? Kullanıldığı belgelerde boş görünür.', 'Sil')) return; await db.del('questions', q.id); all = all.filter(x => x !== q); render(); } } }, 'Sil')) }));
    }
    if (rows.length > 300) list.append(h('p.muted.small', 'İlk 300 soru gösteriliyor; aramayı daraltın.'));
  };
  const addBtn = () => h('button.btn.btn-primary', { on: { click: () => editQuestion(null, q => { all.unshift(q); render(); }) } }, '+ Soru yaz');
  const cropBtn = () => h('button.btn.btn-accent', { on: { click: () => cropTool(qs => { all.unshift(...qs.reverse()); render(); }) } }, '✂ PDF / görselden kırp');

  app.append(
    h('div.row', h('h1', { style: { margin: 0 } }, 'Soru Havuzum'), count, h('span.spacer'), addBtn(), cropBtn()),
    h('p.muted', 'Bir kez ekleyin, her belgede kullanın. Aynı soru hem yazılıda hem testte yer alabilir.'),
    filterBar(all, s => { st = s; render(); }),
    list);
  render();
}

// ---------- Soru düzenleyici ----------
export async function editQuestion(q, onSaved) {
  const defaults = (await db.kvGet('lastMeta')) || {};
  const d = q ? structuredClone(q) : { id: uid(), type: 'coktan', text: '', image: '', choices: ['', '', '', '', ''], answer: '', ders: defaults.ders || '', sinif: defaults.sinif || '', konu: defaults.konu || '', kazanim: '', zorluk: 2, cozum: '', created: Date.now() };
  d.choices ||= ['', '', '', '', ''];
  const typeSpecific = h('div');
  const img = h('img', { style: { maxWidth: '100%', maxHeight: '240px', display: d.image ? 'block' : 'none', border: '1px solid var(--line)', borderRadius: '8px', marginTop: '6px' } });
  if (d.image) img.src = d.image;
  const setImage = async dataURL => { d.image = dataURL ? await shrinkImage(dataURL) : ''; img.src = d.image; img.style.display = d.image ? 'block' : 'none'; };
  const fileInp = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (f) setImage(await readFileAsDataURL(f)); } } });

  const drawType = () => {
    typeSpecific.innerHTML = '';
    if (d.type === 'coktan') {
      const ansSeg = h('div.seg', LETTERS.map(L => h('button' + (d.answer === L ? '.on' : ''), { type: 'button', on: { click: e => { d.answer = L; [...ansSeg.children].forEach(b => b.classList.toggle('on', b === e.target)); } } }, L)));
      typeSpecific.append(
        h('div', { style: { display: 'grid', gap: '6px' } }, LETTERS.map((L, i) => h('div.row', { style: { flexWrap: 'nowrap' } }, h('b', { style: { width: '22px' } }, L + ')'), h('input.inp', { value: d.choices[i] || '', placeholder: i < 4 ? 'Şık ' + L : 'Şık E (isteğe bağlı)', on: { input: e => { d.choices[i] = e.target.value; } } })))),
        h('p.small.muted', { style: { margin: '6px 0' } }, 'Şıklar görselin içindeyse boş bırakın.'),
        h('div.row', h('b.small', 'Doğru cevap:'), ansSeg));
    } else if (d.type === 'dy') {
      const seg = h('div.seg', [['D', 'Doğru'], ['Y', 'Yanlış']].map(([v, l]) => h('button' + (d.answer === v ? '.on' : ''), { type: 'button', on: { click: e => { d.answer = v; [...seg.children].forEach(b => b.classList.toggle('on', b === e.target)); } } }, l)));
      typeSpecific.append(h('div.row', h('b.small', 'Cevap:'), seg));
    } else {
      typeSpecific.append(h('div.form-grid',
        h('label.fld', { style: { gridColumn: '1/-1' } }, 'Beklenen cevap', h('textarea', { value: d.cevapMetni || '', rows: 2, on: { input: e => { d.cevapMetni = e.target.value; } } })),
        d.type === 'klasik' ? h('label.fld', 'Cevap boşluğu (satır)', h('input', { type: 'number', min: 1, max: 30, value: d.bosluk || 4, on: { input: e => { d.bosluk = +e.target.value; } } })) : null));
    }
  };
  drawType();

  const typeSel = h('select.inp', { value: d.type, on: { change: e => { d.type = e.target.value; d.answer = ''; drawType(); } } }, Object.entries(QTYPES).map(([v, l]) => h('option', { value: v }, l)));
  const ta = h('textarea.inp', { value: d.text, rows: 4, placeholder: 'Soru kökü. Görseli Ctrl+V ile yapıştırabilirsiniz.' });
  ta.addEventListener('input', () => { d.text = ta.value; });
  ta.addEventListener('paste', async e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); setImage(await readFileAsDataURL(item.getAsFile())); toast('Görsel eklendi'); }
  });
  const fld = (label, key, attrs = {}) => h('label.fld', label, h('input', { value: d[key] || '', ...attrs, on: { input: e => { d[key] = e.target.value; } } }));

  let m;
  const saveBtn = h('button.btn.btn-primary', { on: { click: async () => {
    if (!d.text.trim() && !d.image) { toast('Soru metni ya da görsel gerekli'); return; }
    if (d.type === 'coktan' && !d.answer) { if (!await confirmBox('Doğru cevap seçilmedi. Yine de kaydedilsin mi?', 'Kaydet')) return; }
    d.updated = Date.now();
    await db.put('questions', d);
    await db.kvSet('lastMeta', { ders: d.ders, sinif: d.sinif, konu: d.konu });
    m.close(); toast('Soru kaydedildi'); onSaved?.(d);
  } } }, 'Kaydet');

  m = modal(q ? 'Soruyu düzenle' : 'Yeni soru', h('div', { style: { display: 'grid', gap: '12px' } },
    h('div.row', h('label.fld', { style: { flex: 1 } }, 'Soru tipi', typeSel)),
    ta,
    h('div.row', h('button.btn.btn-sm', { on: { click: () => fileInp.click() } }, '🖼 Görsel ekle'), h('button.btn.btn-sm.btn-ghost', { on: { click: () => setImage('') } }, 'Görseli kaldır'), fileInp),
    img,
    typeSpecific,
    h('div.form-grid',
      h('label.fld', 'Sınıf', h('select', { value: d.sinif, on: { change: e => { d.sinif = e.target.value; } } }, h('option', { value: '' }, '—'), SINIFLAR.map(s => h('option', { value: s }, s)))),
      fld('Ders', 'ders', { placeholder: 'Kimya' }),
      fld('Konu', 'konu', { placeholder: 'Mol kavramı' }),
      h('label.fld', 'Zorluk', h('select', { value: String(d.zorluk || 2), on: { change: e => { d.zorluk = +e.target.value; } } }, Object.entries(LEVELS).map(([v, l]) => h('option', { value: v }, l))))),
    fld('Öğrenme çıktısı / kazanım', 'kazanim', { placeholder: 'Ör. KİM.9.2.1' }),
    h('label.fld', 'Çözüm (öğretmen sürümünde görünür)', h('textarea', { value: d.cozum || '', rows: 2, on: { input: e => { d.cozum = e.target.value; } } })),
  ), { actions: [h('button.btn', { on: { click: () => m.close() } }, 'Vazgeç'), saveBtn] });
  setTimeout(() => ta.focus(), 50);
}

// ---------- Havuzdan seçici ----------
export async function pickQuestions({ exclude = [], title = 'Havuzdan soru seç', filter } = {}) {
  let all = (await db.all('questions')).sort((a, b) => b.created - a.created);
  if (filter) all = all.filter(filter);
  const ex = new Set(exclude);
  const chosen = [];
  let st = {};
  return new Promise(resolve => {
    const list = h('div.q-list', { style: { maxHeight: '58vh', overflow: 'auto' } });
    const cnt = h('b', '0');
    const render = () => {
      list.innerHTML = '';
      const rows = applyFilter(all, st).filter(q => !ex.has(q.id));
      if (!rows.length) list.append(h('div.empty', all.length ? 'Uygun soru yok.' : 'Havuz boş. Önce Soru Havuzu\'na soru ekleyin.'));
      for (const q of rows.slice(0, 300)) {
        const el = qCard(q, { selected: chosen.includes(q.id), onClick: () => { const i = chosen.indexOf(q.id); i < 0 ? chosen.push(q.id) : chosen.splice(i, 1); el.classList.toggle('selected'); cnt.textContent = chosen.length; } });
        list.append(el);
      }
    };
    let done = false;
    const finish = v => { if (done) return; done = true; m.close(); resolve(v); };
    const m = modal(title, h('div',
      filterBar(all, s => { st = s; render(); }),
      h('div.row', { style: { marginBottom: '8px' } }, h('button.btn.btn-sm', { on: { click: () => { applyFilter(all, st).filter(q => !ex.has(q.id) && !chosen.includes(q.id)).forEach(q => chosen.push(q.id)); cnt.textContent = chosen.length; render(); } } }, 'Görünenlerin hepsini seç'), h('button.btn.btn-sm.btn-accent', { on: { click: () => { finish(null); cropTool(() => toast('Kırpılan sorular havuza eklendi; tekrar seçiciyi açın.')); } } }, '✂ Yeni kırp')),
      list), { wide: true, actions: [h('span.muted', 'Seçili: ', cnt), h('span.spacer'), h('button.btn', { on: { click: () => finish([]) } }, 'Vazgeç'), h('button.btn.btn-primary', { on: { click: () => finish(chosen.slice()) } }, 'Ekle')] });
    // modal X / dışına tıklama
    const obs = new MutationObserver(() => { if (!m.box.isConnected) { obs.disconnect(); finish([]); } });
    obs.observe(document.body, { childList: true });
    render();
  });
}

// ---------- PDF / görselden kırpma ----------
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
let pdfjsP;
async function loadPdfJs() {
  pdfjsP ||= import(PDFJS).then(m => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; });
  return pdfjsP;
}

export async function cropTool(onDone) {
  const meta = (await db.kvGet('lastMeta')) || {};
  const added = [];
  let pdf = null, pageNo = 1, pageCount = 1;
  let canvas = h('canvas'), ctx = canvas.getContext('2d');
  let rect = null, drag = null, mode = 'crop', viewScale = 1;
  const rectEl = h('div.crop-rect', { hidden: true });
  const stage = h('div.crop-stage', canvas, rectEl);
  const pageLbl = h('span.small.muted', '');
  const thumbs = h('div', { style: { display: 'grid', gap: '6px', maxHeight: '30vh', overflow: 'auto' } });
  const preview = h('img.thumb', { hidden: true });
  const status = h('p.small.muted', 'Bir PDF ya da sayfa görseli açın.');

  const fileInp = h('input', { type: 'file', accept: 'application/pdf,image/*', hidden: true, on: { change: e => openFile(e.target.files[0]) } });

  async function openFile(f) {
    if (!f) return;
    status.textContent = 'Açılıyor…';
    try {
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const lib = await loadPdfJs();
        pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
        pageCount = pdf.numPages; pageNo = 1;
        await drawPdfPage();
      } else {
        pdf = null; pageCount = 1; pageNo = 1;
        const im = await loadImg(await readFileAsDataURL(f));
        canvas.width = im.width; canvas.height = im.height;
        ctx.drawImage(im, 0, 0);
        fitCanvas();
      }
      status.textContent = 'Sorunun çevresine çerçeve çizin, sonra cevabın harfine basın (klavyede A–E).';
    } catch (err) {
      console.error(err);
      status.textContent = navigator.onLine ? 'Dosya açılamadı: ' + err.message : 'PDF okuyucu ilk kez internet gerektirir. Bir kez çevrimiçiyken açın, sonra çevrimdışı da çalışır. Görsel dosyalar her zaman açılır.';
    }
  }
  async function drawPdfPage() {
    const page = await pdf.getPage(pageNo);
    const vp = page.getViewport({ scale: 2.2 });
    canvas.width = vp.width; canvas.height = vp.height;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    fitCanvas();
  }
  function fitCanvas() {
    const w = stage.clientWidth || 700;
    viewScale = Math.min(1, w / canvas.width);
    canvas.style.width = canvas.width * viewScale + 'px';
    canvas.style.height = canvas.height * viewScale + 'px';
    rect = null; rectEl.hidden = true; preview.hidden = true;
    pageLbl.textContent = pdf ? `Sayfa ${pageNo} / ${pageCount}` : '';
  }
  const pos = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / viewScale, y: (e.clientY - r.top) / viewScale }; };
  canvas.addEventListener('pointerdown', e => {
    if (!canvas.width) return;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    if (mode === 'tippex') { drag = { tippex: true }; paint(p); return; }
    drag = p; rect = { x: p.x, y: p.y, w: 0, h: 0 };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = pos(e);
    if (drag.tippex) { paint(p); return; }
    rect = { x: Math.min(drag.x, p.x), y: Math.min(drag.y, p.y), w: Math.abs(p.x - drag.x), h: Math.abs(p.y - drag.y) };
    drawRect();
  });
  canvas.addEventListener('pointerup', () => {
    if (drag && !drag.tippex && rect && rect.w > 10 && rect.h > 10) showPreview();
    else if (drag && drag.tippex && rect) showPreview();
    drag = null;
  });
  const paint = p => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x, p.y, 14 / viewScale * 0.9, 0, Math.PI * 2); ctx.fill(); };
  const drawRect = () => { rectEl.hidden = false; Object.assign(rectEl.style, { left: rect.x * viewScale + 'px', top: rect.y * viewScale + 'px', width: rect.w * viewScale + 'px', height: rect.h * viewScale + 'px' }); };
  const cropData = () => {
    const c = document.createElement('canvas');
    const pad = 6;
    const x = Math.max(0, rect.x - pad), y = Math.max(0, rect.y - pad);
    c.width = Math.min(canvas.width - x, rect.w + pad * 2); c.height = Math.min(canvas.height - y, rect.h + pad * 2);
    const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(canvas, x, y, c.width, c.height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };
  const showPreview = () => { drawRect(); preview.src = cropData(); preview.hidden = false; };

  async function commit(answer) {
    if (!rect || rect.w < 10) { toast('Önce sorunun çevresine çerçeve çizin'); return; }
    const q = { id: uid(), type: 'coktan', text: '', image: await shrinkImage(cropData(), 1200), choices: ['', '', '', '', ''], answer: answer || '', ders: metaInputs.ders.value, sinif: metaInputs.sinif.value, konu: metaInputs.konu.value, zorluk: 2, kazanim: '', cozum: '', created: Date.now(), kaynak: pdf ? 'PDF s.' + pageNo : 'Görsel' };
    await db.put('questions', q);
    added.push(q);
    await db.kvSet('lastMeta', { ders: q.ders, sinif: q.sinif, konu: q.konu });
    thumbs.prepend(h('div.row', { style: { flexWrap: 'nowrap' } }, h('img', { src: q.image, style: { width: '120px', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff' } }), h('span.chip.ans', answer ? 'Cevap ' + answer : 'Cevapsız')));
    // dolu alanı işaretle ki aynı soru iki kez kırpılmasın
    ctx.save(); ctx.fillStyle = 'rgba(27,75,127,.08)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.restore();
    rect = null; rectEl.hidden = true; preview.hidden = true;
    status.textContent = `${added.length} soru havuza eklendi. Sıradakini çerçeveleyin.`;
  }

  const metaInputs = {
    ders: h('input.inp', { value: meta.ders || '', placeholder: 'Ders' }),
    sinif: h('input.inp', { value: meta.sinif || '', placeholder: 'Sınıf' }),
    konu: h('input.inp', { value: meta.konu || '', placeholder: 'Konu' }),
  };
  const modeSeg = h('div.seg', [['crop', '✂ Kırp'], ['tippex', '🩹 Tippex']].map(([v, l]) => h('button' + (v === mode ? '.on' : ''), { type: 'button', on: { click: e => { mode = v; [...modeSeg.children].forEach(b => b.classList.toggle('on', b === e.target)); stage.style.cursor = v === 'tippex' ? 'cell' : 'crosshair'; } } }, l)));
  stage.style.cursor = 'crosshair';

  const onKey = e => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLocaleUpperCase('tr-TR');
    if (LETTERS.includes(k)) { e.preventDefault(); commit(k); }
    else if (k === 'ENTER' || k === '0') { e.preventDefault(); commit(''); }
    else if (pdf && e.key === 'ArrowRight' && pageNo < pageCount) { pageNo++; drawPdfPage(); }
    else if (pdf && e.key === 'ArrowLeft' && pageNo > 1) { pageNo--; drawPdfPage(); }
  };
  document.addEventListener('keydown', onKey);

  const m = modal('PDF / görselden soru kırp', h('div.crop-wrap',
    h('div',
      h('div.row', { style: { marginBottom: '8px' } },
        h('button.btn.btn-primary.btn-sm', { on: { click: () => fileInp.click() } }, 'Dosya aç'), fileInp,
        h('button.btn.btn-sm', { on: { click: async () => { if (pdf && pageNo > 1) { pageNo--; await drawPdfPage(); } } } }, '‹'),
        pageLbl,
        h('button.btn.btn-sm', { on: { click: async () => { if (pdf && pageNo < pageCount) { pageNo++; await drawPdfPage(); } } } }, '›'),
        h('span.spacer'), modeSeg),
      stage, status),
    h('div.crop-side', { style: { display: 'grid', gap: '10px', alignContent: 'start' } },
      h('b', 'Etiketler (sonraki sorulara da uygulanır)'),
      metaInputs.sinif, metaInputs.ders, metaInputs.konu,
      preview,
      h('b', 'Cevap harfine basın:'),
      h('div.ans-keys', LETTERS.map(L => h('button', { on: { click: () => commit(L) } }, L))),
      h('button.btn.btn-sm', { on: { click: () => commit('') } }, 'Cevapsız kaydet (Enter)'),
      h('b', { style: { marginTop: '6px' } }, 'Bu oturumda eklenenler'),
      thumbs)
  ), { wide: true, actions: [h('button.btn.btn-primary', { on: { click: () => m.close() } }, 'Bitti')] });

  // Modal kapanınca temizle
  const obs = new MutationObserver(() => { if (!m.box.isConnected) { obs.disconnect(); document.removeEventListener('keydown', onKey); if (added.length) { toast(added.length + ' soru havuza eklendi'); onDone?.(added); } } });
  obs.observe(document.body, { childList: true });
  // sürükle-bırak
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', e => { e.preventDefault(); openFile(e.dataTransfer.files[0]); });
  canvas.width = 0;
  setTimeout(() => fileInp.click(), 60);
}
