// Görsel düzeltme: döndür, boşlukları kes, filigran sil, koyuluk, silgi, kalem
import { h, modal, loadImg, toast } from '../util.js';

export function trimWhitespace(canvas, thr = 235, pad = 6) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width: w, height: hh } = canvas; const d = ctx.getImageData(0, 0, w, hh).data;
  let x0 = w, y0 = hh, x1 = -1, y1 = -1;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (d[i] < thr || d[i + 1] < thr || d[i + 2] < thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  if (x1 < 0) return canvas;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(hh - 1, y1 + pad);
  const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

export async function editImage(src, onSave) {
  const im = await loadImg(src);
  let base = document.createElement('canvas'); base.width = im.width; base.height = im.height;
  const b0 = base.getContext('2d'); b0.fillStyle = '#fff'; b0.fillRect(0, 0, im.width, im.height); b0.drawImage(im, 0, 0);
  const view = h('canvas', { style: { maxWidth: '100%', maxHeight: '60vh', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px', touchAction: 'none' } });
  const hist = [];
  let tool = 'none', brush = 14, koyu = 100, filigran = 255;
  const work = () => { const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; c.getContext('2d').drawImage(base, 0, 0); return c; };
  const draw = () => {
    view.width = base.width; view.height = base.height;
    const ctx = view.getContext('2d', { willReadFrequently: true }); ctx.drawImage(base, 0, 0);
    if (koyu !== 100 || filigran < 255) {
      const id = ctx.getImageData(0, 0, view.width, view.height); const d = id.data; const k = koyu / 100;
      for (let i = 0; i < d.length; i += 4) {
        const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
        if (l >= filigran) { d[i] = d[i + 1] = d[i + 2] = 255; continue; }
        if (k !== 1) for (let j = 0; j < 3; j++) d[i + j] = Math.max(0, Math.min(255, 255 - (255 - d[i + j]) * k));
      }
      ctx.putImageData(id, 0, 0);
    }
  };
  const commitView = () => { hist.push(work()); base = work(); const c = base.getContext('2d'); c.drawImage(view, 0, 0); koyu = 100; filigran = 255; sliders(); };
  const push = () => hist.push(work());
  const rotate = deg => { push(); const c = document.createElement('canvas'); const r = deg % 180 !== 0; c.width = r ? base.height : base.width; c.height = r ? base.width : base.height; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.translate(c.width / 2, c.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(base, -base.width / 2, -base.height / 2); base = c; draw(); };
  // fırça
  let drawing = false;
  const pos = e => { const r = view.getBoundingClientRect(); return [(e.clientX - r.left) * view.width / r.width, (e.clientY - r.top) * view.height / r.height]; };
  view.addEventListener('pointerdown', e => { if (tool === 'none') return; drawing = true; view.setPointerCapture(e.pointerId); push(); paint(e); });
  view.addEventListener('pointermove', e => { if (drawing) paint(e); });
  view.addEventListener('pointerup', () => { drawing = false; });
  const paint = e => { const [x, y] = pos(e); const c = base.getContext('2d'); c.fillStyle = tool === 'silgi' ? '#fff' : '#111'; c.beginPath(); c.arc(x, y, tool === 'silgi' ? brush : Math.max(1.5, brush / 5), 0, Math.PI * 2); c.fill(); draw(); };

  const toolSeg = h('div.seg', [['none', '✋ Seç'], ['silgi', '🩹 Silgi'], ['kalem', '✏ Kalem']].map(([v, l]) => h('button' + (v === tool ? '.on' : ''), { type: 'button', on: { click: e => { tool = v; [...toolSeg.children].forEach(b => b.classList.toggle('on', b === e.target)); view.style.cursor = v === 'none' ? '' : 'crosshair'; } } }, l)));
  const sl = h('div', { style: { display: 'grid', gap: '6px' } });
  const sliders = () => {
    sl.innerHTML = '';
    const r = (label, val, min, max, set) => { const out = h('b', String(val)); return h('label.fld', h('span', label, ': ', out), h('input', { type: 'range', min, max, value: val, on: { input: e => { set(+e.target.value); out.textContent = e.target.value; draw(); } } })); };
    sl.append(r('Koyuluk %', koyu, 50, 250, v => koyu = v), r('Filigran sil (açık tonları beyazla)', filigran, 120, 255, v => filigran = v), r('Fırça boyu', brush, 4, 60, v => brush = v));
  };
  sliders(); draw();
  let m;
  m = modal('Görseli düzelt', h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 260px', gap: '14px' } },
    h('div', { style: { display: 'grid', placeItems: 'center', background: 'repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px', borderRadius: '10px', padding: '8px' } }, view),
    h('div', { style: { display: 'grid', gap: '10px', alignContent: 'start' } },
      h('div.row', h('button.btn.btn-sm', { on: { click: () => rotate(-90) } }, '⟲ Döndür'), h('button.btn.btn-sm', { on: { click: () => rotate(90) } }, '⟳'), h('button.btn.btn-sm', { on: { click: () => rotate(180) } }, '↕')),
      h('button.btn.btn-sm', { on: { click: () => { commitView(); base = trimWhitespace(base); draw(); toast('Boşluklar kesildi'); } } }, '✂ Boşlukları kes'),
      toolSeg, sl,
      h('button.btn.btn-sm', { on: { click: () => { const p = hist.pop(); if (p) { base = p; draw(); } } } }, '↶ Geri al'))),
    { wide: true, actions: [h('button.btn', { on: { click: () => m.close() } }, 'Vazgeç'), h('button.btn.btn-primary', { on: { click: () => { draw(); onSave(view.toDataURL('image/png')); m.close(); } } }, 'Uygula')] });
}
