// Optik form: yazdırılabilir form + telefon kamerasıyla/fotoğraftan okuma
import { h, toast, modal, uid, LETTERS, loadImg, readFileAsDataURL, $ } from '../util.js';
import { db, getBrand } from '../db.js';

const PW = 210, PH = 297;
const MARK = 8; // köşe işareti kenarı (mm)
const MC = [[12, 12], [198, 12], [12, 285], [198, 285]]; // işaret merkezleri
const R = 2.1; // balon yarıçapı (mm)

export function optikLayout(N, nCh = 5, digits = 4) {
  const L = { no: [], kit: [], q: [] };
  // öğrenci numarası: sol üst, her basamak bir sütun
  for (let d = 0; d < digits; d++) { const col = []; for (let v = 0; v < 10; v++) col.push([24 + d * 6, 58 + v * 5.6]); L.no.push(col); }
  L.kit = [[24 + digits * 6 + 12, 58], [24 + digits * 6 + 12, 63.6]];
  // cevaplar: 30'luk sütunlar
  const per = 30, colW = nCh * 5.6 + 12, startX = 22, startY = 128;
  const cols = Math.ceil(N / per);
  const gapX = cols > 1 ? Math.min(colW + 8, (PW - 2 * startX - colW) / (cols - 1)) : 0;
  for (let i = 0; i < N; i++) {
    const c = Math.floor(i / per), r = i % per;
    const x0 = startX + c * gapX + 8, y = startY + r * 5.3;
    L.q.push(Array.from({ length: nCh }, (_, k) => [x0 + k * 5.6, y]));
  }
  return L;
}

export function optikSvg({ N, nCh = 5, title = '', kurum = '', acc = '#1B4B7F', logo = '' }) {
  const L = optikLayout(N, nCh);
  const s = [];
  const T = (x, y, t, o = '') => s.push(`<text x="${x}" y="${y}" ${o}>${String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`);
  MC.forEach(([x, y]) => s.push(`<rect x="${x - MARK / 2}" y="${y - MARK / 2}" width="${MARK}" height="${MARK}" fill="#000"/>`));
  if (logo) s.push(`<image href="${logo}" x="22" y="9" width="16" height="16" preserveAspectRatio="xMidYMid meet"/>`);
  T(logo ? 42 : 22, 15, kurum, 'font-size="3.6" fill="#555"');
  T(logo ? 42 : 22, 22.5, title || 'Optik Cevap Kâğıdı', `font-size="5.6" font-weight="700" fill="${acc}"`);
  s.push(`<rect x="22" y="30" width="166" height="15" rx="2" fill="none" stroke="${acc}" stroke-width=".35"/>`);
  T(25, 36, 'Adı Soyadı:', 'font-size="3.4" font-weight="700"'); T(120, 36, 'Sınıf:', 'font-size="3.4" font-weight="700"'); T(155, 36, 'İmza:', 'font-size="3.4" font-weight="700"');
  T(25, 42.5, 'Kurşun kalemle, balonu tamamen doldurun. Kâğıdı katlamayın; köşelerdeki siyah kareler görünsün.', 'font-size="2.5" fill="#666"');
  T(22, 53, 'ÖĞRENCİ NO', `font-size="3" font-weight="700" fill="${acc}"`);
  L.no.forEach((col, d) => { s.push(`<rect x="${col[0][0] - 2.7}" y="49.5" width="5.4" height="5" fill="none" stroke="#999" stroke-width=".25"/>`); col.forEach(([x, y], v) => { s.push(`<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${acc}" stroke-width=".3"/>`); T(x, y + 0.9, v, 'font-size="2.4" text-anchor="middle" fill="#aaa"'); }); });
  T(L.kit[0][0] - 3, 53, 'KİTAPÇIK', `font-size="3" font-weight="700" fill="${acc}"`);
  L.kit.forEach(([x, y], k) => { s.push(`<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${acc}" stroke-width=".3"/>`); T(x, y + 0.9, 'AB'[k], 'font-size="2.4" text-anchor="middle" fill="#aaa"'); });
  s.push(`<rect x="100" y="50" width="88" height="62" rx="2" fill="none" stroke="#ccc" stroke-width=".3"/>`); T(144, 56, 'Öğretmen notu', 'font-size="2.8" text-anchor="middle" fill="#999"');
  T(22, 122, 'CEVAPLAR', `font-size="3" font-weight="700" fill="${acc}"`);
  L.q.forEach((row, i) => {
    const [x0, y] = row[0];
    T(x0 - 4, y + 1, i + 1, 'font-size="2.8" font-weight="700" text-anchor="end"');
    row.forEach(([x], k) => { s.push(`<circle cx="${x}" cy="${y}" r="${R}" fill="none" stroke="${acc}" stroke-width=".3"/>`); T(x, y + 0.9, LETTERS[k], 'font-size="2.4" text-anchor="middle" fill="#aaa"'); });
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PW} ${PH}" width="${PW}mm" height="${PH}mm" font-family="Arial, sans-serif">${s.join('')}</svg>`;
}

export async function printOptik(ex, count = 1) {
  const brand = await getBrand();
  const N = ex.sections.reduce((a, s) => a + s.qs.length, 0);
  const svg = optikSvg({ N, nCh: ex.sik === 4 ? 4 : 5, title: ex.title, kurum: brand.kurum, acc: brand.renk || '#1B4B7F', logo: brand.logo });
  const root = $('#printRoot'); root.innerHTML = '';
  for (let i = 0; i < count; i++) root.append(h('div.sheet', { style: { boxShadow: 'none', margin: 0 }, html: svg }));
  let ps = document.getElementById('pageSize'); if (!ps) { ps = h('style#pageSize'); document.head.append(ps); }
  ps.textContent = '@page{size:210mm 297mm;margin:0}';
  const done = () => { root.innerHTML = ''; removeEventListener('afterprint', done); };
  addEventListener('afterprint', done);
  setTimeout(() => print(), 80);
}

// ---------- okuma ----------
function solve8(A, b) { // Gauss
  const n = 8; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function homography(src, dst) {
  const A = [], b = [];
  src.forEach(([x, y], i) => { const [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); });
  const m = solve8(A, b);
  return ([x, y]) => { const w = m[6] * x + m[7] * y + 1; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
}
function otsu(gray) {
  const hist = new Array(256).fill(0); gray.forEach(v => hist[v]++);
  const total = gray.length; let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sB = 0, wB = 0, best = 0, th = 128;
  for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = total - wB; if (!wF) break; sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) ** 2; if (v > best) { best = v; th = t; } }
  return th;
}

export async function readOptik(src, { N, nCh = 5 }) {
  const im = await loadImg(src);
  const k = Math.min(1, 1600 / Math.max(im.width, im.height));
  const W = Math.round(im.width * k), H = Math.round(im.height * k);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const gray = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) gray[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) | 0;
  // yerel eşik: gölgeye dayanıklı olsun diye 2 kat küçültülmüş ortalama
  const th = otsu(gray);
  const dark = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) dark[i] = gray[i] < Math.min(th, 150) ? 1 : 0;
  // bağlı bileşenler
  const lab = new Int32Array(W * H); const comps = []; const stack = [];
  for (let i = 0; i < W * H; i++) {
    if (!dark[i] || lab[i]) continue;
    const id = comps.length + 1; let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
    stack.push(i); lab[i] = id;
    while (stack.length) {
      const p = stack.pop(); const x = p % W, y = (p / W) | 0; n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [p - 1, p + 1, p - W, p + W]) if (q >= 0 && q < W * H && dark[q] && !lab[q] && Math.abs((q % W) - x) <= 1) { lab[q] = id; stack.push(q); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    comps.push({ n, cx: sx / n, cy: sy / n, bw, bh, fill: n / (bw * bh) });
  }
  const minSide = Math.min(W, H);
  const cands = comps.filter(o => o.bw > minSide * 0.012 && o.bw < minSide * 0.09 && o.bh / o.bw > 0.6 && o.bh / o.bw < 1.6 && o.fill > 0.7);
  if (cands.length < 4) throw new Error('Köşe kareleri bulunamadı. Kâğıdın tamamı ve dört siyah kare görünecek şekilde, düz ve aydınlık çekin.');
  const corners = [[0, 0], [W, 0], [0, H], [W, H]];
  const pts = corners.map(([X, Y]) => { let best = null, bd = 1e18; for (const o of cands) { const dd = (o.cx - X) ** 2 + (o.cy - Y) ** 2; if (dd < bd) { bd = dd; best = o; } } return best; });
  if (new Set(pts).size < 4) throw new Error('Köşe kareleri ayırt edilemedi. Fotoğrafı daha yakından ve düz çekin.');
  const map = homography(MC, pts.map(o => [o.cx, o.cy]));
  // mm başına piksel ölçeği
  const scale = Math.hypot(pts[1].cx - pts[0].cx, pts[1].cy - pts[0].cy) / (MC[1][0] - MC[0][0]);
  const rr = Math.max(2, R * 0.62 * scale);
  const fillAt = ([mx, my]) => {
    const [px, py] = map([mx, my]); let n = 0, t = 0;
    for (let y = Math.round(py - rr); y <= py + rr; y++) for (let x = Math.round(px - rr); x <= px + rr; x++) { if ((x - px) ** 2 + (y - py) ** 2 > rr * rr || x < 0 || y < 0 || x >= W || y >= H) continue; t++; n += gray[y * W + x] < Math.min(th + 10, 170) ? 1 : 0; }
    return t ? n / t : 0;
  };
  const L = optikLayout(N, nCh);
  const pick = (cells, letters) => {
    const f = cells.map(fillAt); const sorted = [...f].sort((a, b) => b - a);
    if (sorted[0] < 0.42) return { v: '', f };
    if (sorted[1] > 0.42 && sorted[1] > sorted[0] * 0.7) return { v: '*', f };
    return { v: letters[f.indexOf(sorted[0])], f };
  };
  const answers = L.q.map(row => pick(row, LETTERS).v);
  const no = L.no.map(col => pick(col, '0123456789'.split('')).v).join('').replace(/[*]/g, '?');
  const kit = pick(L.kit, ['A', 'B']).v;
  // kontrol görüntüsü
  ctx.lineWidth = 2;
  const mark = (mm, col) => { const [x, y] = map(mm); ctx.strokeStyle = col; ctx.beginPath(); ctx.arc(x, y, rr * 1.5, 0, Math.PI * 2); ctx.stroke(); };
  L.q.forEach((row, i) => { const a = answers[i]; if (a && a !== '*') mark(row[LETTERS.indexOf(a)], '#1d8a4e'); else if (a === '*') row.forEach(m => mark(m, '#c0392b')); });
  pts.forEach(o => { ctx.strokeStyle = '#2E6DB4'; ctx.strokeRect(o.cx - o.bw / 2 - 3, o.cy - o.bh / 2 - 3, o.bw + 6, o.bh + 6); });
  return { answers, no: no.replace(/^$/, ''), kit, preview: c.toDataURL('image/jpeg', 0.7) };
}

// Öğretmen arayüzü: sırayla fotoğraf çek → oku → düzelt → kaydet
export function optikReaderModal(ex, score, onDone) {
  const N = ex.sections.reduce((a, s) => a + s.qs.length, 0);
  const nCh = ex.sik === 4 ? 4 : 5;
  let saved = 0;
  const out = h('div', { style: { display: 'grid', gap: '10px' } });
  const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', multiple: true, hidden: true, on: { change: async e => { const files = [...e.target.files]; e.target.value = ''; for (const f of files) await handle(f); } } });
  const queue = h('div', { style: { display: 'grid', gap: '12px' } });
  async function handle(f) {
    const box = h('div.card', h('p.small.muted', f.name + ' okunuyor…'));
    queue.prepend(box);
    try {
      const r = await readOptik(await readFileAsDataURL(f), { N, nCh });
      const prev = (await db.all('results')).find(x => r.no && x.no === r.no && x.ad);
      const ad = h('input.inp', { placeholder: 'Adı Soyadı', value: prev?.ad || '' });
      const no = h('input.inp', { placeholder: 'No', value: r.no.includes('?') ? '' : r.no.replace(/^0+(?=\d)/, '') });
      const ans = h('input.inp', { value: r.answers.map(a => a || '-').join(''), style: { fontFamily: 'monospace', letterSpacing: '2px' } });
      const multi = r.answers.filter(a => a === '*').length;
      box.innerHTML = '';
      box.append(h('div', { style: { display: 'grid', gridTemplateColumns: '180px minmax(0,1fr)', gap: '12px' } },
        h('a', { href: r.preview, target: '_blank' }, h('img', { src: r.preview, style: { width: '100%', borderRadius: '6px', border: '1px solid var(--line)' } })),
        h('div', { style: { display: 'grid', gap: '8px', alignContent: 'start' } },
          h('div.row', ad, no, r.kit ? h('span.chip', 'Kitapçık ' + r.kit) : null),
          h('label.fld', h('span', `Okunan cevaplar (${r.answers.filter(a => a && a !== '*').length}/${N}) — gerekirse düzeltin; * = çift işaret, - = boş`), ans),
          multi ? h('p.small', { style: { color: 'var(--bad)' } }, multi + ' soruda birden çok balon dolu; bunlar yanlış sayılır.') : null,
          h('button.btn.btn-primary.btn-sm', { on: { click: async e => {
            if (!ad.value.trim()) { toast('Öğrenci adını yazın'); return; }
            const a = ans.value.toLocaleUpperCase('tr-TR').split('').slice(0, N).map(c => LETTERS.includes(c) ? c : c === '*' ? 'X' : '');
            while (a.length < N) a.push('');
            await db.put('results', { id: uid(), examId: ex.id, ad: ad.value.trim(), no: no.value.trim(), answers: a, mod: 'optik', kitapcik: r.kit, ...score(ex, a), created: Date.now() });
            saved++; e.target.disabled = true; e.target.textContent = '✓ Kaydedildi'; box.style.opacity = '.6';
          } } }, 'Kaydet'))));
    } catch (err) { box.innerHTML = ''; box.append(h('p', { style: { color: 'var(--bad)' } }, f.name + ': ' + err.message)); }
  }
  let m;
  m = modal('Optik okuma', h('div', { style: { display: 'grid', gap: '10px' } },
    h('p.small.muted', 'Soru Evim’in optik formunu kullanın (“Boş optik yazdır”). Telefonla çekin ya da taranmış görselleri seçin; birden çok fotoğrafı aynı anda seçebilirsiniz. Görüntüler cihazınızdan çıkmaz.'),
    h('div.row', h('button.btn.btn-primary', { on: { click: () => inp.click() } }, '📷 Fotoğraf çek / seç'), inp), out, queue),
    { wide: true, actions: [h('button.btn', { on: { click: () => { m.close(); if (saved) onDone?.(); } } }, 'Bitti')] });
}
