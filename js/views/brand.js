import { h, toast, readFileAsDataURL, shrinkImage, uid, modal, loadImg, renkSec } from '../util.js';
import { db, getBrand } from '../db.js';
import { renderDoc } from '../render.js';
import { PRESETS, PRESET_CATS, HEADERS, TEMPLATES, PAGE_NUMS, Q_NUMS, BODY_FONTS, TITLE_FONTS, FOOTERS, SIZES, SOZLER, SIMGELER, DEFAULT_LOOK, ensureFonts } from '../design.js';

export const SAMPLE_Q = {
  s1: { id: 's1', type: 'coktan', text: 'Aşağıdakilerden hangisi bir **kimyasal** değişimdir?', choices: ['Buzun erimesi', 'Kâğıdın yanması', 'Şekerin çözünmesi', 'Camın kırılması', 'Suyun buharlaşması'], answer: 'B' },
  s2: { id: 's2', type: 'coktan', text: 'CaCO_{3} bileşiğindeki Ca^{2+} iyonunun elektron sayısı kaçtır? (_{20}Ca)', choices: ['18', '20', '22', '16', '2'], answer: 'A' },
  s3: { id: 's3', type: 'coktan', text: 'Hangisi !!değildir!!: ==homojen karışım==?', choices: ['Tuzlu su', 'Hava', 'Kolonya', 'Ayran', 'Şekerli su'], answer: 'D' },
};
const SAMPLE_DOC = { kind: 'test', title: 'Tarama Testi', meta: { sinif: '9. Sınıf', ders: 'Kimya' }, items: [{ qid: 's1' }, { qid: 's2' }, { qid: 's3' }], ayar: { anahtar: false, ogrenci: { ad: true, sinif: true, no: true, veli: true } } };

export async function brandView(app, { inModal = false } = {}) {
  ensureFonts();
  let b = await getBrand();
  b.look = { ...DEFAULT_LOOK, ...(b.look || {}) };
  let undoStack = [];
  const save = async () => { await db.kvSet('brand', b); };

  // Önizleme
  const preview = h('div'); const scaleBox = h('div.preview-scale', preview); const area = h('div.preview-area', scaleBox);
  let t;
  const fitScale = () => {
    const s = Math.min(1, (area.clientWidth - 36) / 794);
    scaleBox.style.transform = `scale(${s})`; scaleBox.style.width = '794px';
    const first = preview.querySelector('.sheet'); area.style.height = first ? (first.offsetHeight * s + 36) + 'px' : '';
  };
  const refresh = () => { clearTimeout(t); t = setTimeout(async () => { await renderDoc(preview, SAMPLE_DOC, SAMPLE_Q, b); preview.querySelectorAll('.sheet:not(:first-child)').forEach(x => x.remove()); fitScale(); }, 100); };
  window.addEventListener('resize', fitScale);
  const changed = () => { save(); refresh(); };

  // --- Sekmeler ---
  const tabHazir = h('button.on', { type: 'button', 'data-tour': 'sablon' }, 'Şablon Galerisi');
  const tabKendim = h('button', { type: 'button', 'data-tour': 'ozel' }, 'Özel Ayarlar');
  const pane = h('div');
  const tabs = h('div.seg', { style: { width: '100%', display: 'flex' } }, tabHazir, tabKendim);
  [tabHazir, tabKendim].forEach(x => x.style.flex = '1');
  tabHazir.onclick = () => { tabHazir.classList.add('on'); tabKendim.classList.remove('on'); drawHazir(); };
  tabKendim.onclick = () => { tabKendim.classList.add('on'); tabHazir.classList.remove('on'); drawKendim(); };

  function drawHazir() {
    pane.innerHTML = '';
    let cat = 'Hepsi';
    const undoBtn = h('button.btn.btn-sm', { disabled: !undoStack.length, on: { click: () => { const prev = undoStack.pop(); if (!prev) return; b = prev; changed(); drawHazir(); toast('Önceki tasarıma dönüldü'); } } }, '↶ Geri al');
    const chips = h('div.row', { style: { gap: '6px', margin: '8px 0' } });
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '10px' } });
    const drawChips = () => { chips.innerHTML = ''; ['Hepsi', ...PRESET_CATS].forEach(c => chips.append(h('button.chip', { style: { cursor: 'pointer', border: c === cat ? '1px solid var(--navy)' : '1px solid transparent', padding: '4px 10px' }, on: { click: () => { cat = c; drawChips(); drawGrid(); } } }, c + ' ' + (c === 'Hepsi' ? PRESETS.length : PRESETS.filter(p => p.kat === c).length)))); };
    const io = new IntersectionObserver(ents => ents.forEach(async e => { if (!e.isIntersecting) return; io.unobserve(e.target); const p = PRESETS[+e.target.dataset.i]; const pv = e.target.querySelector('.pv'); const host = h('div', { style: { transform: `scale(${(pv.clientWidth || 150) / 794})`, transformOrigin: 'top left', width: '794px', position: 'absolute', left: 0, top: 0 } }); pv.append(host); await renderDoc(host, SAMPLE_DOC, SAMPLE_Q, { ...b, renk: p.renk, renk2: p.renk2, look: p.look }, { small: true }); host.querySelectorAll('.sheet:not(:first-child)').forEach(x => x.remove()); }), { rootMargin: '200px' });
    const drawGrid = () => {
      grid.innerHTML = '';
      PRESETS.forEach((p, i) => {
        if (cat !== 'Hepsi' && p.kat !== cat) return;
        const active = b.renk === p.renk && b.look.baslik === p.look.baslik && b.look.soruNo === p.look.soruNo;
        const card = h('button', { 'data-i': i, type: 'button', style: { border: active ? '2px solid var(--orange)' : '1px solid var(--line)', borderRadius: '10px', background: '#fff', padding: '6px', cursor: 'pointer', textAlign: 'left' }, on: { click: () => {
          undoStack.push(structuredClone(b));
          b.renk = p.renk; b.renk2 = p.renk2; b.look = { ...p.look }; changed(); drawGrid(); renkCiz(); undoBtn.disabled = false; toast(p.ad + ' uygulandı');
        } } },
          h('div.pv', { style: { height: '150px', overflow: 'hidden', borderRadius: '6px', background: '#eee', position: 'relative' } }),
          h('div', { style: { fontWeight: 700, fontSize: '.85rem', marginTop: '4px' } }, p.ad),
          h('div.small.muted', p.kat));
        card.querySelector('.pv').style.cssText += ';--z:.19';
        grid.append(card); io.observe(card);
      });
    };
    drawChips(); drawGrid();
    const renkler = h('div.row', { 'data-tour': 'renk', style: { gap: '12px', flexWrap: 'wrap', alignItems: 'center' } });
    const renkCiz = () => { renkler.innerHTML = ''; renkler.append(
      h('b.small', '🎨 Şablonun rengi:'),
      h('span.small.muted', 'Ana'), renkSec(b.renk || '', c => { undoStack.push(structuredClone(b)); b.renk = c; changed(); undoBtn.disabled = false; }, { baslik: 'Ana renk — başlık, numaralar' }),
      h('span.small.muted', 'İkinci'), renkSec(b.renk2 || '', c => { undoStack.push(structuredClone(b)); b.renk2 = c; changed(); undoBtn.disabled = false; }, { baslik: 'İkinci renk — NOT/DİKKAT kutuları' })); };
    renkCiz();
    pane.append(h('p.muted.small', 'Birine tıklayın, kâğıdınız hemen değişir. Logonuz, kurum adınız ve sorularınız olduğu gibi kalır. Beğendiğiniz şablonun rengini aşağıdaki paletten değiştirebilirsiniz.'), h('div.row', undoBtn), renkler, chips, grid);
  }

  const mkSel = (obj, key, opts, after) => { const s = h('select.inp', { value: obj[key] ?? '', on: { change: e => { obj[key] = e.target.value; changed(); after?.(); } } }, Object.entries(opts).map(([v, l]) => h('option', { value: v }, typeof l === 'string' ? l : l.ad))); return s; };
  const inp = (key, ph) => h('input.inp', { value: b[key] || '', placeholder: ph, on: { input: e => { b[key] = e.target.value; changed(); } } });
  const imgPicker = (key, label, max = 700) => {
    const img = h('img', { src: b[key] || '', style: { maxHeight: '60px', maxWidth: '160px', display: b[key] ? 'block' : 'none', background: '#fff', border: '1px solid var(--line)', borderRadius: '6px', padding: '3px' } });
    const fi = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; b[key] = await shrinkImage(await readFileAsDataURL(f), max); img.src = b[key]; img.style.display = 'block'; changed(); } } });
    return h('div.row', img, h('button.btn.btn-sm', { on: { click: () => fi.click() } }, label), h('button.btn.btn-sm.btn-ghost', { on: { click: () => { b[key] = ''; img.style.display = 'none'; changed(); } } }, 'Kaldır'), fi);
  };
  const section = (title, ...kids) => h('div.card', { style: { padding: '14px 16px' } }, h('h3', { style: { fontSize: '.95rem', textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--orange)' } }, title), h('div', { style: { display: 'grid', gap: '10px' } }, kids));
  const fld = (label, el, hint) => h('label.fld', label, el, hint ? h('span.small.muted', { style: { fontWeight: 400 } }, hint) : null);

  function drawKendim() {
    pane.innerHTML = '';
    const colorRow = (key) => renkSec(b[key] || '', c => { b[key] = c; changed(); });
    const _eskiColorRow = (key, presets) => h('div.row', h('input', { type: 'color', value: b[key] || b.renk, style: { width: '52px', height: '36px', padding: '2px' }, on: { input: e => { b[key] = e.target.value; changed(); } } }),
      ...presets.map(c => h('button', { title: c, style: { width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px var(--line)', background: c, cursor: 'pointer' }, on: { click: () => { b[key] = c; changed(); drawKendim(); } } })));
    const damgaList = h('div.row');
    const drawDamgalar = () => { damgaList.innerHTML = ''; (b.damgalar || []).forEach(d => damgaList.append(h('div', { style: { position: 'relative' } }, h('img', { src: d.img, style: { width: '64px', height: '64px', objectFit: 'contain', background: '#fff', border: '1px solid var(--line)', borderRadius: '8px' } }), h('button.icon-btn', { style: { position: 'absolute', top: '-6px', right: '-6px', background: '#fff', borderRadius: '50%' }, on: { click: () => { b.damgalar = b.damgalar.filter(x => x !== d); changed(); drawDamgalar(); } } }, '✕')))); };
    drawDamgalar();
    pane.append(
      h('p.muted.small', 'Sabit bilgileriniz beş belge türünde de aynı kalır. Görünüm ayarları varsayılan olur; her belgede ayrıca değiştirebilirsiniz.'),
      section('Sabit bilgiler',
        fld('Logo', imgPicker('logo', 'Logo yükle', 600)),
        fld('Kurum / okul adı', inp('kurum', 'Ör. Atatürk Anadolu Lisesi')),
        fld('Öğretmen adı', inp('ogretmen', 'Ör. Hasan Öğretmen')),
        fld('İletişim (isteğe bağlı)', inp('iletisim', 'Adres, telefon, sosyal medya'), 'Her sayfanın en altına küçük ve ortalı basılır. Boşsa satır açılmaz.'),
        fld('Alt bilgi sözü', mkSel(b, 'soz', Object.fromEntries(SOZLER.map(s => [s, s || 'Boş bırak'])))),
        fld('Simge (sözün yanında)', mkSel(b, 'simge', SIMGELER)),
        fld('Vurgu rengi', colorRow('renk', ['#4C3BB5', '#1B4B7F', '#C0392B', '#1E7B4F', '#6C3FA0', '#D9771E', '#222831', '#0077B6']), 'Başlık, kapak, sayfa ve soru numarası bu renkte basılır. Gövde yazısı siyah kalır.'),
        fld('İkincil renk', colorRow('renk2', ['#C2418F', '#2E6DB4', '#E8892B', '#08A045', '#9D4EDD', '#E63946', '#5BC0BE']), 'NOT, DİKKAT ve ÖRNEK kutuları bu renkte basılır.'),
        h('label.check', h('input', { type: 'checkbox', checked: !!b.filigran, on: { change: e => { b.filigran = e.target.checked; changed(); } } }), 'Filigranı kâğıda bas (logo, yoksa metin)'),
        fld('Metin filigranı (logonuz yoksa)', inp('metinFiligran', 'Ör. Soru Evim'), 'Kâğıdın ortasına büyük, silik ve çapraz basılır.'),
        fld('Mühürlerim', h('div', { style: { display: 'grid', gap: '6px' } }, damgaList, h('button.btn.btn-sm', { on: { click: () => stampMaker(b, d => { (b.damgalar ||= []).push(d); changed(); drawDamgalar(); }) } }, '+ Damga oluştur')), 'Soruya ya da sayfaya soluk bir mühür olarak basılır.'),
        fld('Kapak görseli', imgPicker('kapakGorsel', 'Kapak yükle', 1600), 'Yüklerseniz kapak bu görselin tamamı olur. Yüklemezseniz marka renginden desenli kapak basılır.'),
      ),
      section('Varsayılan görünüm',
        fld('Başlık tasarımı', mkSel(b.look, 'baslik', HEADERS)),
        fld('Sayfa şablonu', mkSel(b.look, 'sablon', TEMPLATES)),
        fld('Soru numarası stili', mkSel(b.look, 'soruNo', Q_NUMS)),
        fld('Sayfa numarası stili', mkSel(b.look, 'sayfaNo', PAGE_NUMS)),
        fld('Gövde yazı tipi', mkSel(b.look, 'govdeFont', BODY_FONTS)),
        fld('Başlık yazı tipi', mkSel(b.look, 'baslikFont', TITLE_FONTS)),
        fld('Alt bilgi düzeni', mkSel(b.look, 'altBilgi', FOOTERS)),
        fld('Yazı boyutu', mkSel(b.look, 'boyut', SIZES), 'Bütün yazı boyutları birlikte ölçeklenir; sayfa düzeni yeniden hesaplanır.'),
      ));
  }

  drawHazir();
  const side = h('div.editor-side', h('div.card', h('h2', 'Sayfanız'), tabs), pane, inModal ? null : h('a.btn.btn-primary', { href: '#/' }, 'Tamam, belge oluşturmaya geç →'));
  app.append(h('div.editor', side, area));
  refresh();
  return () => window.removeEventListener('resize', fitScale);
}

// Damga oluşturucu: yuvarlak mühür (çevrede yazı, ortada logo ya da görsel)
export function stampMaker(b, onDone) {
  const c = h('canvas', { width: 400, height: 400, style: { width: '200px', height: '200px', background: 'repeating-conic-gradient(#eee 0 25%,#fff 0 50%) 0 0/16px 16px', borderRadius: '8px' } });
  const st = { text: (b.kurum || 'SORU EVİM').toLocaleUpperCase('tr-TR'), alt: '★ ONAYLANDI ★', color: b.renk || '#1B4B7F', img: b.logo || '', shape: 'daire' };
  const draw = async () => {
    const x = c.getContext('2d'); x.clearRect(0, 0, 400, 400); x.strokeStyle = x.fillStyle = st.color;
    if (st.shape === 'gorsel' && st.img) { const im = await loadImg(st.img); const r = Math.min(380 / im.width, 380 / im.height); x.drawImage(im, 200 - im.width * r / 2, 200 - im.height * r / 2, im.width * r, im.height * r); return; }
    x.lineWidth = 14; x.beginPath(); x.arc(200, 200, 186, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 4; x.beginPath(); x.arc(200, 200, 160, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(200, 200, 110, 0, Math.PI * 2); x.stroke();
    const ring = (txt, top) => { x.save(); x.translate(200, 200); x.font = 'bold 30px Arial'; const chars = [...txt]; const ang = Math.min(Math.PI * .9, chars.length * .13); chars.forEach((ch, i) => { const a = (top ? -Math.PI / 2 - ang / 2 : Math.PI / 2 + ang / 2) + (top ? 1 : -1) * ang * (i + .5) / chars.length; x.save(); x.rotate(a + (top ? Math.PI / 2 : -Math.PI / 2)); x.textAlign = 'center'; x.fillText(ch, 0, top ? -126 : 147); x.restore(); }); x.restore(); };
    ring(st.text, true); ring(st.alt, false);
    if (st.img) { const im = await loadImg(st.img); const r = Math.min(150 / im.width, 150 / im.height); x.save(); x.beginPath(); x.arc(200, 200, 100, 0, Math.PI * 2); x.clip(); x.drawImage(im, 200 - im.width * r / 2, 200 - im.height * r / 2, im.width * r, im.height * r); x.restore(); }
    else { x.font = 'bold 60px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('✓', 200, 200); }
  };
  const fi = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; st.img = await shrinkImage(await readFileAsDataURL(f), 500); draw(); } } });
  let m;
  m = modal('Damga oluştur', h('div.row', { style: { alignItems: 'flex-start', gap: '16px' } }, c,
    h('div', { style: { display: 'grid', gap: '8px', flex: 1, minWidth: '220px' } },
      h('label.fld', 'Biçim', h('select.inp', { on: { change: e => { st.shape = e.target.value; draw(); } } }, h('option', { value: 'daire' }, 'Yuvarlak mühür'), h('option', { value: 'gorsel' }, 'Yalnız görsel'))),
      h('label.fld', 'Üst yazı', h('input.inp', { value: st.text, on: { input: e => { st.text = e.target.value; draw(); } } })),
      h('label.fld', 'Alt yazı', h('input.inp', { value: st.alt, on: { input: e => { st.alt = e.target.value; draw(); } } })),
      h('label.fld', 'Renk', h('input', { type: 'color', value: st.color, on: { input: e => { st.color = e.target.value; draw(); } } })),
      h('div.row', h('button.btn.btn-sm', { on: { click: () => fi.click() } }, 'Görsel seç'), h('button.btn.btn-sm.btn-ghost', { on: { click: () => { st.img = b.logo || ''; draw(); } } }, 'Logoyu kullan'), fi))),
    { actions: [h('button.btn', { on: { click: () => m.close() } }, 'Vazgeç'), h('button.btn.btn-primary', { on: { click: () => { onDone({ id: uid(), img: c.toDataURL('image/png') }); m.close(); toast('Damga eklendi'); } } }, 'Kaydet')] });
  draw();
}
