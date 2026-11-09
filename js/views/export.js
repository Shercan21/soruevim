// Belgeyi PNG ve Word olarak indirme
import { h, toast, modal, download } from '../util.js';
import { db, getBrand } from '../db.js';
import { renderDoc, rich, setKatex, lookOf } from '../render.js';
import { ensureFonts, loadKatex } from '../design.js';

const LET = ['A', 'B', 'C', 'D', 'E'];

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
    h('button.btn', { on: { click: () => { m.close(); exportPng(doc, { teacher }); } } }, h('b', '🖼 PNG'), h('span.small.muted', ' — her sayfa ayrı resim')),
    h('button.btn', { on: { click: () => { m.close(); exportWord(doc, { teacher }); } } }, h('b', '📝 Word'), h('span.small.muted', ' — düzenlenebilir metin, görseller dahil')),
    h('p.small.muted', 'PDF için “Yazdır / PDF” düğmesini kullanın.')));
}
