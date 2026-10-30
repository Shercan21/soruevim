// Akıllı tahta, Z-Kitap (sayfa çevirmeli kitap), PNG ve Word indirme
import { h, toast, modal, download, shuffle } from '../util.js';
import { db, getBrand } from '../db.js';
import { questionEl, renderDoc, rich, setKatex, lookOf } from '../render.js';
import { ensureFonts, loadKatex } from '../design.js';

const LET = ['A', 'B', 'C', 'D', 'E'];

// ---------- ortak: kalem katmanı ----------
function penLayer(host) {
  const cv = h('canvas.pen-layer');
  host.append(cv);
  const ctx = cv.getContext('2d');
  let on = false, color = '#e0352b', size = 4, erase = false, drawing = false, last = null;
  const fit = () => { const r = host.getBoundingClientRect(); const img = cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null; cv.width = r.width; cv.height = r.height; if (img) ctx.putImageData(img, 0, 0); };
  new ResizeObserver(fit).observe(host);
  const p = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', e => { if (!on) return; drawing = true; cv.setPointerCapture(e.pointerId); last = p(e); });
  cv.addEventListener('pointermove', e => {
    if (!drawing) return; const q = p(e);
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color; ctx.lineWidth = erase ? size * 6 : size; ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...q); ctx.stroke(); last = q;
  });
  cv.addEventListener('pointerup', () => { drawing = false; });
  const api = {
    set on(v) { on = v; cv.style.pointerEvents = v ? 'auto' : 'none'; cv.style.cursor = v ? 'crosshair' : ''; }, get on() { return on; },
    clear: () => ctx.clearRect(0, 0, cv.width, cv.height),
    save: () => cv.width ? ctx.getImageData(0, 0, cv.width, cv.height) : null,
    load: d => { api.clear(); if (d && d.width === cv.width) ctx.putImageData(d, 0, 0); },
  };
  const colors = ['#e0352b', '#1B4B7F', '#1d8a4e', '#111111', '#f2b705'];
  const bar = h('div.pen-bar',
    h('button.btn.btn-sm', { title: 'Kalem (P)', on: { click: e => { erase = false; api.on = !on; e.currentTarget.classList.toggle('btn-accent', on); } } }, '✏'),
    ...colors.map(c => h('button.pen-dot', { style: { background: c }, title: 'Renk', on: { click: () => { color = c; erase = false; api.on = true; } } })),
    h('select.inp', { style: { width: 'auto' }, on: { change: e => { size = +e.target.value; } } }, [2, 4, 8, 14].map(v => h('option', { value: v, selected: v === 4 }, v + ' px'))),
    h('button.btn.btn-sm', { title: 'Silgi', on: { click: () => { erase = true; api.on = true; } } }, '🩹'),
    h('button.btn.btn-sm', { title: 'Çizimleri temizle', on: { click: () => api.clear() } }, '🗑'));
  api.bar = bar;
  api.on = false;
  return api;
}

// ---------- Akıllı tahta ----------
export async function boardView(app) {
  let ids = [];
  try { ids = JSON.parse(sessionStorage.getItem('tahtaIds') || '[]'); } catch { }
  if (!ids.length) {
    app.append(h('div.card', { style: { maxWidth: '640px', margin: '30px auto', textAlign: 'center' } },
      h('h2', '🖥 Akıllı tahta'),
      h('p.muted', 'Soruları sınıfta tek tek, büyük yazıyla gösterin; cevabı ve çözümü istediğiniz an açın, üzerine kalemle çizin.'),
      h('button.btn.btn-primary', { on: { click: async () => { const { pickQuestions } = await import('./pool.js'); const sel = await pickQuestions({ title: 'Tahtada gösterilecek sorular' }); if (sel?.length) { sessionStorage.setItem('tahtaIds', JSON.stringify(sel)); location.reload(); } } } }, 'Havuzdan soru seç')));
    return;
  }
  const qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q]));
  let list = ids.map(i => qmap[i]).filter(Boolean);
  if (!list.length) { app.append(h('p.muted', 'Seçilen sorular havuzda bulunamadı.')); return; }
  const brand = await getBrand(); const look = lookOf(brand, null);
  ensureFonts([look.pf, look.tf]);
  if (list.some(q => /\$/.test(q.text + (q.choices || []).join('') + (q.cozum || '')))) { try { setKatex(await loadKatex()); } catch { } }
  let i = +(sessionStorage.getItem('tahtaPos') || 0); if (i >= list.length) i = 0;
  let reveal = false, fs = +(localStorage.getItem('tahtaFs') || 30), timer = null, left = 0;
  const drawings = {};
  const qBox = h('div.sheet.board-sheet', { style: { '--acc': brand.renk || '#1B4B7F', '--acc2': brand.renk2 || '#2E6DB4' } });
  const stage = h('div.board-stage', qBox);
  const pen = penLayer(stage);
  const curtain = h('div.curtain', { hidden: true }, h('div.curtain-grip', '⇕ Perdeyi sürükleyin'));
  stage.append(curtain);
  const num = h('b.board-num');
  const timeEl = h('b.board-time', { hidden: true });
  const draw = () => {
    const q = list[i];
    qBox.style.setProperty('--fs', fs + 'px');
    qBox.innerHTML = '';
    const el = questionEl(q, i + 1, { teacher: reveal, ayar: { cozumler: 'yok' }, doc: { kind: 'test' }, showSurec: false, stamps: {} }, { wide: false });
    qBox.append(el);
    if (reveal && q.type === 'coktan' && q.answer) {
      const li = [...el.querySelectorAll('.ch > div')].find(d => d.querySelector('.L')?.textContent.startsWith(q.answer)); if (li) li.classList.add('ch-right');
    }
    num.textContent = `Soru ${i + 1} / ${list.length}`;
    revealBtn.textContent = reveal ? '🙈 Cevabı gizle' : '💡 Cevabı göster';
    sessionStorage.setItem('tahtaPos', i);
    pen.load(drawings[q.id]);
  };
  const go = d => { const q = list[i]; drawings[q.id] = pen.save(); i = Math.max(0, Math.min(list.length - 1, i + d)); reveal = false; draw(); };
  const revealBtn = h('button.btn.btn-accent', { on: { click: () => { reveal = !reveal; draw(); } } });
  const tick = () => { left--; timeEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) { clearInterval(timer); timer = null; timeEl.classList.add('bitti'); timeEl.textContent = 'Süre bitti!'; try { new AudioContext().resume().then(function () { const a = new AudioContext(), o = a.createOscillator(); o.connect(a.destination); o.start(); setTimeout(() => o.stop(), 400); }); } catch { } } };
  const startTimer = sec => { clearInterval(timer); timeEl.classList.remove('bitti'); if (!sec) { timeEl.hidden = true; return; } left = sec + 1; timeEl.hidden = false; tick(); timer = setInterval(tick, 1000); };
  // perde sürükleme
  let cy = null;
  curtain.addEventListener('pointerdown', e => { cy = e.clientY - curtain.offsetTop; curtain.setPointerCapture(e.pointerId); });
  curtain.addEventListener('pointermove', e => { if (cy == null) return; curtain.style.top = Math.max(0, e.clientY - cy) + 'px'; });
  curtain.addEventListener('pointerup', () => { cy = null; });
  const onKey = e => {
    if (!app.contains(stage)) { document.removeEventListener('keydown', onKey); clearInterval(timer); return; }
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
    else if (e.key === ' ') { e.preventDefault(); reveal = !reveal; draw(); }
    else if (e.key === '+') { fs += 2; localStorage.setItem('tahtaFs', fs); draw(); }
    else if (e.key === '-') { fs = Math.max(12, fs - 2); localStorage.setItem('tahtaFs', fs); draw(); }
  };
  document.addEventListener('keydown', onKey);
  const shell = h('div.board',
    h('div.board-top',
      h('a.btn.btn-sm.btn-ghost', { href: '#/havuz' }, '‹ Havuz'), num, timeEl, h('span.spacer'),
      h('button.btn.btn-sm', { title: 'Yazıyı küçült (−)', on: { click: () => { fs = Math.max(12, fs - 2); localStorage.setItem('tahtaFs', fs); draw(); } } }, 'A−'),
      h('button.btn.btn-sm', { title: 'Yazıyı büyüt (+)', on: { click: () => { fs += 2; localStorage.setItem('tahtaFs', fs); draw(); } } }, 'A+'),
      h('button.btn.btn-sm', { on: { click: () => { list = shuffle(list, Date.now() & 0xffffff); i = 0; reveal = false; draw(); } } }, '🔀 Karıştır'),
      h('select.inp', { style: { width: 'auto' }, title: 'Geri sayım', on: { change: e => startTimer(+e.target.value) } }, [['0', '⏱ Süre yok'], ['30', '30 sn'], ['60', '1 dk'], ['120', '2 dk'], ['180', '3 dk'], ['300', '5 dk']].map(([v, l]) => h('option', { value: v }, l))),
      h('button.btn.btn-sm', { title: 'Sorunun bir kısmını perdeyle kapatın', on: { click: () => { curtain.hidden = !curtain.hidden; curtain.style.top = '45%'; } } }, '🎭 Perde'),
      h('button.btn.btn-sm', { title: 'Tam ekran', on: { click: () => document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen?.() } }, '⛶')),
    stage,
    h('div.board-bottom', h('button.btn', { on: { click: () => go(-1) } }, '‹ Önceki'), pen.bar, h('span.spacer'), revealBtn, h('button.btn.btn-primary', { on: { click: () => go(1) } }, 'Sonraki ›')));
  app.append(shell);
  draw();
}

// ---------- Belge sayfalarını oluştur ----------
async function renderPages(doc, { teacher = false } = {}) {
  const qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q]));
  const brand = await getBrand();
  const look = lookOf(brand, doc); ensureFonts([look.pf, look.tf]);
  try { setKatex(await loadKatex()); } catch { }
  const host = h('div', { style: { position: 'fixed', left: '-99999px', top: 0 } });
  document.body.append(host);
  await renderDoc(host, doc, qmap, brand, { teacher });
  await document.fonts?.ready;
  return { host, sheets: [...host.querySelectorAll('.sheet')], qmap, brand };
}

// ---------- Z-Kitap ----------
export async function zkitapView(app, id) {
  const doc = await db.get('documents', id);
  if (!doc) { app.append(h('p.muted', 'Belge bulunamadı.')); return; }
  const { host, sheets } = await renderPages(doc);
  host.remove();
  let i = 0, spread = innerWidth > 1000;
  const book = h('div.zk-book');
  const stage = h('div.zk-stage', book);
  const pen = penLayer(stage);
  const drawings = {};
  const lbl = h('b');
  const W = sheets[0]?.offsetWidth || 794;
  const show = (dir = 0) => {
    const per = spread ? 2 : 1;
    book.innerHTML = '';
    const pg = sheets.slice(i, i + per).map(s => { const c = s.cloneNode(true); c.style.margin = '0'; return h('div.zk-page', c); });
    book.append(...pg);
    const avW = stage.clientWidth - 30, avH = stage.clientHeight - 20;
    const H = sheets[0]?.offsetHeight || 1123;
    const sc = Math.min(avW / (W * per), avH / H);
    pg.forEach(p => { p.style.width = W * sc + 'px'; p.style.height = H * sc + 'px'; p.firstChild.style.transform = `scale(${sc})`; p.firstChild.style.transformOrigin = '0 0'; });
    if (dir) { book.classList.remove('flip-l', 'flip-r'); void book.offsetWidth; book.classList.add(dir > 0 ? 'flip-r' : 'flip-l'); }
    lbl.textContent = `${i + 1}${per > 1 && sheets[i + 1] ? '–' + (i + 2) : ''} / ${sheets.length}`;
    pen.load(drawings[i]);
  };
  const go = d => { drawings[i] = pen.save(); const per = spread ? 2 : 1; const n = i + d * per; if (n < 0 || n >= sheets.length) return; i = n; show(d); };
  const onKey = e => { if (!app.contains(stage)) { document.removeEventListener('keydown', onKey); return; } if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); };
  document.addEventListener('keydown', onKey);
  let sx = null;
  stage.addEventListener('pointerdown', e => { if (!pen.on) sx = e.clientX; });
  stage.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 60) go(e.clientX < sx ? 1 : -1); sx = null; });
  const shell = h('div.board.zk',
    h('div.board-top', h('a.btn.btn-sm.btn-ghost', { href: '#/belge/' + id }, '‹ Belgeye dön'), h('b', doc.title || 'Z-Kitap'), h('span.spacer'), lbl,
      h('button.btn.btn-sm', { on: { click: () => { spread = !spread; i = spread ? i - (i % 2) : i; show(); } } }, '📖 Tek / çift sayfa'),
      h('button.btn.btn-sm', { on: { click: () => document.fullscreenElement ? document.exitFullscreen() : shell.requestFullscreen?.() } }, '⛶')),
    stage,
    h('div.board-bottom', h('button.btn', { on: { click: () => go(-1) } }, '‹'), pen.bar, h('span.spacer'), h('button.btn.btn-primary', { on: { click: () => go(1) } }, '›')));
  app.append(shell);
  requestAnimationFrame(() => show());
  addEventListener('resize', () => app.contains(stage) && show());
}

// ---------- PNG indir ----------
const H2I = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm';
export async function exportPng(doc, { teacher = false } = {}) {
  toast('Sayfalar resme dönüştürülüyor…');
  let lib; try { lib = await import(H2I); } catch { toast('Resim aracı ilk kez internet gerektirir.'); return; }
  const { host, sheets } = await renderPages(doc, { teacher });
  host.style.left = '0'; host.style.zIndex = '-1';
  const base = (doc.title || 'belge').replace(/[\\/:*?"<>|]/g, '');
  try {
    for (let n = 0; n < sheets.length; n++) {
      const s = sheets[n]; s.style.margin = '0'; s.style.boxShadow = 'none';
      const url = await lib.toPng(s, { pixelRatio: 2, backgroundColor: '#fff', cacheBust: false });
      const blob = await (await fetch(url)).blob();
      download(blob, `${base}${sheets.length > 1 ? '-' + (n + 1) : ''}.png`);
      await new Promise(r => setTimeout(r, 250));
    }
    toast(sheets.length + ' sayfa PNG olarak indirildi');
  } catch (e) { console.error(e); toast('PNG oluşturulamadı: ' + e.message); }
  host.remove();
}

// ---------- Word indir (düzenlenebilir) ----------
function docQids(doc) {
  if (doc.kind === 'foy') return (doc.blocks || []).filter(b => b.qid).map(b => b.qid);
  if (doc.kind === 'deneme') return (doc.sections || []).flatMap(s => s.qids);
  return (doc.items || []).map(i => i.qid);
}
function richWord(s) { return rich(s || '').replace(/<span class="katex[\s\S]*?<\/span><\/span><\/span>/g, m => m.replace(/<[^>]+>/g, '')); }
export async function exportWord(doc, { teacher = false } = {}) {
  const qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q]));
  const brand = await getBrand();
  const acc = brand.renk || '#1B4B7F';
  const parts = []; let pid = 0;
  const img = (src, w) => {
    const m = /^data:(image\/[\w+]+);base64,(.+)$/.exec(src || ''); if (!m) return src ? `<img src="${src}" width="${w}">` : '';
    const name = `img${++pid}.${m[1].split('/')[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg')}`;
    parts.push({ name, type: m[1], data: m[2] });
    return `<img src="${name}" width="${w}">`;
  };
  const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let body = `<p class=MsoTitle style="color:${acc}">${esc(doc.title)}</p>`;
  const head = [brand.kurum, doc.meta?.ders, doc.meta?.sinif, doc.meta?.konu].filter(Boolean).map(esc).join(' • ');
  if (head) body += `<p style="color:#555">${head}</p>`;
  if (doc.kind !== 'foy' || true) body += `<p>Adı Soyadı: ............................................ Sınıf: ........ No: ........</p><hr>`;
  const blocks = doc.kind === 'foy' ? (doc.blocks || []) : docQids(doc).map(qid => ({ t: 'soru', qid }));
  let no = 0; const key = [];
  for (const b of blocks) {
    if (b.t !== 'soru') {
      if (b.t === 'baslik') body += `<h1 style="color:${acc}">${esc(b.text)}</h1>`;
      else if (b.t === 'arabaslik') body += `<h2 style="color:${acc}">${esc(b.text)}</h2>`;
      else if (b.t === 'gorsel') body += `<p>${img(b.src || b.image, 420)}</p>`;
      else if (b.text) body += `<p>${richWord(b.text)}</p>`;
      continue;
    }
    const q = qmap[b.qid]; if (!q) continue; no++;
    body += `<p style="margin-top:12pt"><b style="color:${acc}">${no}.</b> ${richWord(q.text)}</p>`;
    for (const tb of q.tablo || []) body += `<table border=1 cellpadding=4 style="border-collapse:collapse">${tb.map(r => `<tr>${r.map(c => `<td>${richWord(c)}</td>`).join('')}</tr>`).join('')}</table>`;
    for (const im of (q.images?.length ? q.images : q.image ? [q.image] : [])) body += `<p>${img(im, 380)}</p>`;
    if ((q.type || 'coktan') === 'coktan') {
      const ch = (q.choices || []).map((c, k) => (c || q.choiceImgs?.[k]) ? `<p style="margin-left:18pt">${LET[k]}) ${richWord(c)} ${q.choiceImgs?.[k] ? img(q.choiceImgs[k], 140) : ''}</p>` : '').join('');
      body += ch;
    } else if (q.type === 'dy') body += `<p>( ) Doğru &nbsp;&nbsp; ( ) Yanlış</p>`;
    else body += `<p>&nbsp;</p><p>&nbsp;</p>`;
    if (teacher && (q.cozum || q.cozumImg)) body += `<p style="color:#555"><i>Çözüm:</i> ${richWord(q.cozum)} ${q.cozumImg ? img(q.cozumImg, 300) : ''}</p>`;
    key.push(`${no}-${q.answer || '?'}`);
  }
  if (doc.ayar?.anahtar !== false && key.length) body += `<br clear=all style="page-break-before:always"><h2 style="color:${acc}">Cevap Anahtarı</h2><p>${key.join(' &nbsp; ')}</p>`;
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>body{font-family:Arial;font-size:11pt} p{margin:3pt 0} @page{size:21cm 29.7cm;margin:1.8cm}</style></head><body>${body}</body></html>`;
  // MHTML: Word görselleri ile birlikte açar
  const B = '----=_SoruEvim_' + Date.now();
  let mht = `MIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="${B}"; type="text/html"\r\n\r\n--${B}\r\nContent-Type: text/html; charset="utf-8"\r\nContent-Transfer-Encoding: 8bit\r\nContent-Location: file:///C:/soruevim/belge.htm\r\n\r\n${html}\r\n`;
  for (const p of parts) mht += `--${B}\r\nContent-Type: ${p.type}\r\nContent-Transfer-Encoding: base64\r\nContent-Location: file:///C:/soruevim/${p.name}\r\n\r\n${p.data.replace(/.{76}/g, '$&\r\n')}\r\n`;
  mht += `--${B}--\r\n`;
  download(new Blob([mht], { type: 'application/msword' }), (doc.title || 'belge').replace(/[\\/:*?"<>|]/g, '') + '.doc');
  toast('Word dosyası indirildi (Word’de “Farklı kaydet → .docx” yapabilirsiniz)');
}

export function exportMenu(doc, { teacher = false, save } = {}) {
  const m = modal('İndir / göster', h('div', { style: { display: 'grid', gap: '8px' } },
    h('button.btn', { on: { click: async () => { m.close(); await save?.(); location.hash = '#/zkitap/' + doc.id; } } }, h('b', '📖 Z-Kitap'), h('span.small.muted', ' — sayfa çevirerek, kalemle anlatın')),
    h('button.btn', { on: { click: () => { m.close(); exportPng(doc, { teacher }); } } }, h('b', '🖼 PNG'), h('span.small.muted', ' — her sayfa ayrı resim')),
    h('button.btn', { on: { click: () => { m.close(); exportWord(doc, { teacher }); } } }, h('b', '📝 Word'), h('span.small.muted', ' — düzenlenebilir metin, görseller dahil')),
    h('p.small.muted', 'PDF için “Yazdır / PDF” düğmesini kullanın.')));
}
