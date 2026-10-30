import { h, toast, readFileAsDataURL, shrinkImage } from '../util.js';
import { db, getBrand } from '../db.js';
import { FONTS, HEADERS, NUMBERS, renderDoc } from '../render.js';

const SAMPLE_Q = {
  s1: { id: 's1', type: 'coktan', text: 'Aşağıdakilerden hangisi bir kimyasal değişimdir?', choices: ['Buzun erimesi', 'Kâğıdın yanması', 'Şekerin suda çözünmesi', 'Camın kırılması', 'Suyun buharlaşması'], answer: 'B' },
  s2: { id: 's2', type: 'coktan', text: '3x + 7 = 22 denkleminde x kaçtır?', choices: ['3', '4', '5', '6', '7'], answer: 'C' },
};

export async function brandView(app) {
  const b = await getBrand();
  const preview = h('div');
  const scaleBox = h('div.preview-scale', preview);
  const area = h('div.preview-area', scaleBox);

  let t;
  const refresh = () => { clearTimeout(t); t = setTimeout(async () => {
    await renderDoc(preview, { kind: 'test', title: 'Örnek Yaprak Test', meta: { sinif: '9. Sınıf', ders: 'Fen' }, items: [{ qid: 's1' }, { qid: 's2' }], options: { anahtar: false } }, SAMPLE_Q, b);
    fitScale();
  }, 120); };
  const fitScale = () => {
    const w = area.clientWidth - 36; const pw = 794;
    const s = Math.min(1, w / pw);
    scaleBox.style.transform = `scale(${s})`;
    scaleBox.style.width = pw + 'px';
    const first = preview.querySelector('.sheet');
    area.style.height = first ? (first.offsetHeight * s + 36) + 'px' : '';
  };
  window.addEventListener('resize', fitScale);

  const save = async () => { await db.kvSet('brand', b); };
  const bind = (key, el, prop = 'value') => { el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => { b[key] = el[prop]; save(); refresh(); }); return el; };
  const mkSel = (key, opts) => { const s = h('select', { value: b[key] }, Object.entries(opts).map(([v, l]) => h('option', { value: v }, typeof l === 'string' ? l : l.ad))); return bind(key, s); };

  const logoImg = h('img', { src: b.logo || '', alt: '', style: { maxHeight: '64px', maxWidth: '180px', display: b.logo ? 'block' : 'none', background: '#fff', borderRadius: '8px', padding: '4px', border: '1px solid var(--line)' } });
  const logoInp = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => {
    const f = e.target.files[0]; if (!f) return;
    b.logo = await shrinkImage(await readFileAsDataURL(f), 600);
    logoImg.src = b.logo; logoImg.style.display = 'block'; await save(); refresh(); toast('Logo eklendi');
  } } });

  app.append(
    h('div.editor',
      h('div.editor-side',
        h('div.card',
          h('h2', 'Marka kimliği'),
          h('p.muted.small', 'Bir kez kurun; bütün belgelerin başlığında, alt bilgisinde ve renklerinde kendiliğinden uygulanır.'),
          h('div', { style: { display: 'grid', gap: '12px' } },
            h('div.row', logoImg, h('button.btn.btn-sm', { on: { click: () => logoInp.click() } }, b.logo ? 'Logoyu değiştir' : 'Logo yükle'),
              h('button.btn.btn-sm.btn-ghost', { on: { click: async () => { b.logo = ''; logoImg.style.display = 'none'; await save(); refresh(); } } }, 'Kaldır'), logoInp),
            h('label.fld', 'Kurum / yayın adı', bind('kurum', h('input', { value: b.kurum, placeholder: 'Ör. Yıldız Kimya Akademi' }))),
            h('label.fld', 'Öğretmen adı', bind('ogretmen', h('input', { value: b.ogretmen, placeholder: 'Ör. Hasan Öğretmen' }))),
            h('label.fld', 'İletişim satırı', bind('iletisim', h('input', { value: b.iletisim, placeholder: 'Telefon, Instagram, web' }))),
            h('label.fld', 'Vurgu rengi', h('div.row', bind('renk', h('input', { type: 'color', value: b.renk, style: { width: '56px', height: '38px', padding: '2px' } })),
              ...['#1B4B7F', '#C0392B', '#1E7B4F', '#6C3FA0', '#D9771E', '#222831'].map(c => h('button', { title: c, style: { width: '26px', height: '26px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px var(--line)', background: c, cursor: 'pointer' }, on: { click: () => { b.renk = c; app.querySelector('input[type=color]').value = c; save(); refresh(); } } })))),
          )),
        h('div.card',
          h('h3', 'Sayfa tasarımı'),
          h('div', { style: { display: 'grid', gap: '12px' } },
            h('label.fld', 'Yazı tipi', mkSel('font', FONTS)),
            h('label.fld', 'Başlık tasarımı', mkSel('baslik', HEADERS)),
            h('label.fld', 'Soru numarası stili', mkSel('numara', NUMBERS)),
            h('label.check', bind('cerceve', h('input', { type: 'checkbox', checked: b.cerceve }), 'checked'), 'Sayfa kenarlığı'),
            h('label.check', bind('filigran', h('input', { type: 'checkbox', checked: b.filigran }), 'checked'), 'Logoyu silik filigran olarak bas'),
          )),
        h('a.btn.btn-primary', { href: '#/' }, 'Tamam, belge oluşturmaya geç →')),
      area));
  refresh();
  return () => window.removeEventListener('resize', fitScale);
}
