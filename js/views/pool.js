import { h, toast, modal, confirmBox, readFileAsDataURL, readFileAsText, shrinkImage, uid, LETTERS, trLower, loadImg, download } from '../util.js';
import { db, getBrand } from '../db.js';
import { rich, KINDS } from '../render.js';
import { LAYOUTS } from '../design.js';
import { editImage, trimWhitespace } from './imgtools.js';
import { OGRENME_CIKTILARI, SENARYOLAR, SENARYO_YILI, ciktiMetni } from '../meb.js';

export const QTYPES = { coktan: 'Çoktan seçmeli', dy: 'Doğru / Yanlış', bosluk: 'Boşluk doldurma', klasik: 'Klasik (açık uçlu)' };
export const LEVELS = { 1: 'Kolay', 2: 'Orta', 3: 'Zor' };
export const SINIFLAR = Array.from({ length: 12 }, (_, i) => (i + 1) + '. Sınıf').concat(['Mezun', 'LGS', 'TYT', 'AYT']);
export const DERSLER = ['Kimya', 'Fizik', 'Biyoloji', 'Matematik', 'Türkçe', 'Türk Dili ve Edebiyatı', 'Tarih', 'Coğrafya', 'Felsefe', 'Din Kültürü ve Ahlak Bilgisi', 'İngilizce', 'Fen Bilimleri', 'Sosyal Bilgiler', 'Hayat Bilgisi', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Görsel Sanatlar', 'Müzik', 'Kur’an-ı Kerim', 'Peygamberimizin Hayatı'];
export const HAZIR_PAKETLER = [
  { id: 'kimya9', ad: '9. Sınıf Kimya Soru Bankası', yazar: 'Hasan', adet: 1396, url: './paketler/kimya9.json' },
  { id: 'kimya10', ad: '10. Sınıf Kimya Soru Bankası', yazar: 'Hasan', adet: 1094, url: './paketler/kimya10.json' },
  { id: 'kimya11', ad: '11. Sınıf Kimya Soru Bankası', yazar: 'Hasan', adet: 1358, url: './paketler/kimya11.json' },
];

// ---------- Soru kartı ----------
export function qCard(q, { onClick, selected, actions, compact } = {}) {
  const body = h('div.q-body');
  if (q.text) body.append(h('div.q-text', { html: rich(q.text.length > 320 ? q.text.slice(0, 320) + '…' : q.text) }));
  if (q.tablo?.length && !compact) body.append(h('div.small.muted', '▦ veri tablosu'));
  if (q.image) body.append(h('img', { src: q.image, alt: '', loading: 'lazy' }));
  if (!compact && (q.choices || []).some(c => c && String(c).trim())) body.append(h('div.small', { style: { color: 'var(--muted)', marginTop: '4px' }, html: q.choices.map((c, i) => c ? `<b>${LETTERS[i]})</b> ${rich(c)}` : '').filter(Boolean).join(' &nbsp; ') }));
  body.append(h('div.q-meta',
    q.answer && (q.type === 'coktan' || q.type === 'dy' || !q.type) ? h('span.chip.ans', 'Cevap ' + q.answer) : h('span.chip', { style: { background: '#f8dcd9' } }, 'Cevapsız'),
    q.type && q.type !== 'coktan' ? h('span.chip', QTYPES[q.type]) : null,
    q.sinif ? h('span.chip', q.sinif) : null,
    q.ders ? h('span.chip', q.ders) : null,
    q.konu ? h('span.chip', q.konu) : null,
    q.zorluk ? h('span.chip.lvl' + q.zorluk, LEVELS[q.zorluk]) : null,
    q.kazanim ? h('span.chip', { title: ciktiMetni(q.kazanim) || q.kazanim }, '🎯 ' + q.kazanim) : null,
    q.hazir ? h('span.chip', { title: q.kaynak || '' }, '📘 ' + (q.kitapNo ? '#' + q.kitapNo : 'Hazır')) : null,
    (q.etiketler || []).filter(e => e && !e.includes('•')).slice(0, 3).map(e => h('span.chip', '#' + e))));
  return h('div.q-item' + (selected ? '.selected' : ''), { on: onClick ? { click: onClick } : null, style: onClick ? { cursor: 'pointer' } : null }, body, actions || null);
}

// ---------- Filtre ----------
export function filterBar(allSrc, onChange, preset = {}) {
  const getAll = typeof allSrc === 'function' ? allSrc : () => allSrc;
  const st = { q: '', ders: '', sinif: '', zorluk: '', type: '', kazanim: '', konu: '', cevap: '', kaynak: '', ...preset };
  const sortTr = arr => arr.sort((a, b) => String(a).localeCompare(String(b), 'tr', { numeric: true }));
  const selects = {};
  const fill = (s, label, opts, cur) => { s.innerHTML = ''; s.append(h('option', { value: '' }, label), ...opts.map(([v, l]) => h('option', { value: v }, l))); s.value = cur || ''; return s.value === (cur || ''); };
  const mk = (k, label, opts) => { const s = h('select.inp', { style: { width: 'auto', maxWidth: '240px' }, on: { change: e => { st[k] = e.target.value; if (k === 'sinif' || k === 'ders' || k === 'konu') refreshDeps(); onChange(st); } } }); fill(s, label, opts, st[k]); selects[k] = s; return s; };
  const sub = (useKonu) => getAll().filter(x => (!st.sinif || x.sinif === st.sinif) && (!st.ders || x.ders === st.ders) && (!useKonu || !st.konu || x.konu === st.konu));
  const short = v => v.length > 56 ? v.slice(0, 56) + '…' : v;
  const refreshDeps = () => {
    const all = getAll();
    const sin = sortTr([...new Set(all.map(x => x.sinif).filter(Boolean))]);
    const der = sortTr([...new Set(all.filter(x => !st.sinif || x.sinif === st.sinif).map(x => x.ders).filter(Boolean))]);
    if (!fill(selects.sinif, 'Tüm sınıflar', sin.map(x => [x, x]), st.sinif)) st.sinif = '';
    if (!fill(selects.ders, 'Tüm dersler', der.map(x => [x, x]), st.ders)) st.ders = '';
    const konular = sortTr([...new Set(sub().map(x => x.konu).filter(Boolean))]);
    if (!fill(selects.konu, 'Tüm konular', konular.map(v => [v, short(v)]), st.konu)) st.konu = '';
    const kaz = sortTr([...new Set(sub(true).map(x => x.kazanim).filter(Boolean))]);
    if (!fill(selects.kazanim, 'Tüm kazanımlar', kaz.map(v => [v, short(v + (ciktiMetni(v) ? ' — ' + ciktiMetni(v) : ''))]), st.kazanim)) st.kazanim = '';
  };
  const bar = h('div.row', { style: { margin: '12px 0', gap: '6px' } },
    h('input.inp', { type: 'search', placeholder: 'Soru metni, konu ya da kazanım ara…', value: st.q, style: { flex: '1 1 220px', width: 'auto' }, on: { input: e => { st.q = e.target.value; onChange(st); } } }),
    mk('sinif', 'Tüm sınıflar', []), mk('ders', 'Tüm dersler', []), mk('konu', 'Tüm konular', []), mk('kazanim', 'Tüm kazanımlar', []),
    mk('zorluk', 'Her zorluk', Object.entries(LEVELS)),
    mk('type', 'Her tip', Object.entries(QTYPES)),
    mk('cevap', 'Cevap durumu', [['var', 'Cevaplı'], ['yok', 'Cevapsız']]),
    mk('kaynak', 'Her kaynak', [['hazir', 'Hazır bankalar'], ['benim', 'Kendi sorularım'], ['yazdigim', 'Elle eklenenler'], ['kirpilan', 'Kırpılan sorular']]));
  refreshDeps();
  bar.refresh = refreshDeps;
  return bar;
}
export function applyFilter(all, st) {
  const q = trLower(st.q);
  return all.filter(x => (!st.ders || x.ders === st.ders) && (!st.sinif || x.sinif === st.sinif) && (!st.zorluk || String(x.zorluk) === st.zorluk) && (!st.type || (x.type || 'coktan') === st.type)
    && (!st.konu || x.konu === st.konu) && (!st.kazanim || x.kazanim === st.kazanim)
    && (!st.cevap || (st.cevap === 'var' ? !!x.answer || x.type === 'klasik' : !x.answer && x.type !== 'klasik'))
    && (!st.kaynak || (st.kaynak === 'hazir' ? !!x.hazir : st.kaynak === 'benim' ? !x.hazir : st.kaynak === 'yazdigim' ? !x.hazir && !!x.text && !x.kirpildi : !!x.kirpildi))
    && (!q || trLower([x.text, x.konu, x.kazanim, x.ders, x.kaynak, ...(x.etiketler || []), ...(x.choices || [])].join(' ')).includes(q)));
}

// ---------- Havuz ekranı ----------
export async function poolView(app) {
  let all = (await db.all('questions')).sort((a, b) => b.created - a.created);
  let st = {}; const sel = new Set();
  const list = h('div.q-list');
  const count = h('span.muted');
  const selBar = h('div.card', { style: { position: 'sticky', top: '62px', zIndex: 8, padding: '10px 14px', display: 'none' } });
  let page = 0; const PER = 60;
  const rows = () => applyFilter(all, st);
  let fbar, lastLen = -1;
  const render = () => {
    if (fbar && all.length !== lastLen) { lastLen = all.length; fbar.refresh(); }
    const r = rows();
    count.textContent = r.length === all.length ? `${all.length} soru` : `${r.length} / ${all.length} soru`;
    list.innerHTML = '';
    if (!all.length) { list.append(h('div.card.empty', h('p', 'Havuz boş. Hazır kimya bankalarını ekleyin, soru yazın ya da PDF / görselden kırpın.'), h('div.row', { style: { justifyContent: 'center' } }, hazirBtn(), addBtn(), cropBtn()))); drawSel(); return; }
    if (!r.length) { list.append(h('div.empty', 'Aramaya uyan soru yok.')); drawSel(); return; }
    for (const q of r.slice(0, (page + 1) * PER)) {
      const cb = h('input', { type: 'checkbox', checked: sel.has(q.id), style: { width: '18px', height: '18px', marginTop: '4px' }, on: { change: e => { e.target.checked ? sel.add(q.id) : sel.delete(q.id); drawSel(); } } });
      const quick = h('div.seg', { style: { transform: 'scale(.85)', transformOrigin: 'right' } }, LETTERS.map(L => h('button' + (q.answer === L ? '.on' : ''), { type: 'button', title: L + ' doğru', on: { click: async () => { q.answer = q.answer === L ? '' : L; await db.put('questions', q); render(); } } }, L)));
      const card = qCard(q, { selected: sel.has(q.id), actions: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' } },
        (q.type || 'coktan') === 'coktan' ? quick : null,
        h('button.btn.btn-sm', { on: { click: () => editQuestion(q, saved => { Object.assign(q, saved); render(); }, { list: r }) } }, 'Düzenle'),
        h('button.btn.btn-sm.btn-danger', { on: { click: async () => { if (!await confirmBox('Bu soru depodan silinsin mi?', 'Sil')) return; await db.del('questions', q.id); all = all.filter(x => x !== q); sel.delete(q.id); render(); } } }, 'Sil')) });
      card.prepend(cb);
      list.append(card);
    }
    if (r.length > (page + 1) * PER) list.append(h('button.btn', { style: { justifySelf: 'center' }, on: { click: () => { page++; render(); } } }, `Daha fazla göster (${r.length - (page + 1) * PER} kaldı)`));
    drawSel();
  };
  const drawSel = () => {
    selBar.style.display = sel.size ? 'block' : 'none';
    selBar.innerHTML = '';
    if (!sel.size) return;
    const ids = [...sel];
    selBar.append(h('div.row', h('b', sel.size + ' soru seçili'),
      h('button.btn.btn-sm', { on: { click: () => { sel.clear(); render(); } } }, 'Seçimi bırak'),
      h('button.btn.btn-sm', { on: { click: () => bulkTag(ids, () => render()) } }, '🏷 Etiketle'),
      h('button.btn.btn-sm', { on: { click: () => bulkAnswers(ids, all, () => render()) } }, '🔑 Cevap anahtarı'),
      h('button.btn.btn-sm', { on: { click: () => bulkStamp(ids, all, () => render()) } }, '◉ Damga bas'),
      h('button.btn.btn-sm', { on: { click: () => exportQuestions(ids.map(i => all.find(q => q.id === i))) } }, '⬇ İndir'),
      h('button.btn.btn-sm.btn-danger', { on: { click: async () => { if (!await confirmBox(sel.size + ' soru silinsin mi?', 'Sil')) return; for (const i of ids) await db.del('questions', i); all = all.filter(q => !sel.has(q.id)); sel.clear(); render(); } } }, 'Sil'),
      h('span.spacer'),
      h('button.btn.btn-sm.btn-accent', { on: { click: () => createFrom(ids) } }, 'Oluştur → ' + sel.size + ' seçili soruyla')));
  };
  const addBtn = () => h('button.btn.btn-primary', { on: { click: () => editQuestion(null, q => { all.unshift(q); render(); }) } }, '+ Soru yaz');
  const cropBtn = () => h('button.btn.btn-accent', { on: { click: () => cropTool(qs => { all.unshift(...qs.reverse()); render(); }) } }, '✂ PDF / görselden kırp');
  const hazirBtn = () => h('button.btn', { on: { click: () => hazirModal(async () => { all = (await db.all('questions')).sort((a, b) => b.created - a.created); render(); }) } }, '📘 Hazır soru bankaları');
  const imgsInp = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, on: { change: async e => { const qs = await imagesAsQuestions([...e.target.files]); all.unshift(...qs); render(); toast(qs.length + ' görsel soru olarak eklendi'); e.target.value = ''; } } });
  const backupInp = h('input', { type: 'file', accept: '.json,application/json', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; try { const d = JSON.parse(await readFileAsText(f)); const qs = d.questions || []; for (const q of qs) await db.put('questions', q); toast(qs.length + ' soru yüklendi'); all = (await db.all('questions')).sort((a, b) => b.created - a.created); render(); } catch { toast('Yedek okunamadı'); } } } });

  // Ctrl+V: panodaki görseli soru yap
  const onPaste = async e => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || document.querySelector('.modal-bg')) return;
    const files = [...(e.clipboardData?.items || [])].filter(i => i.type.startsWith('image/')).map(i => i.getAsFile());
    if (!files.length) return;
    e.preventDefault(); const qs = await imagesAsQuestions(files, 'Panodan yapıştırıldı'); all.unshift(...qs); render(); toast('Panodaki görsel depoya eklendi');
  };
  document.addEventListener('paste', onPaste);
  // sürükle-bırak
  const onDrop = async e => { const fs = [...(e.dataTransfer?.files || [])].filter(f => f.type.startsWith('image/')); if (!fs.length) return; e.preventDefault(); const qs = await imagesAsQuestions(fs); all.unshift(...qs); render(); toast(qs.length + ' görsel eklendi'); };
  const onOver = e => { if ([...(e.dataTransfer?.items || [])].some(i => i.kind === 'file')) e.preventDefault(); };
  document.addEventListener('drop', onDrop); document.addEventListener('dragover', onOver);

  const menu = h('details', { style: { position: 'relative' } }, h('summary.btn', { style: { listStyle: 'none' } }, 'Diğer ▾'),
    h('div.card', { style: { position: 'absolute', right: 0, top: '42px', zIndex: 30, width: '300px', display: 'grid', gap: '4px', padding: '8px' } },
      h('button.btn.btn-ghost', { style: { justifyContent: 'flex-start' }, on: { click: () => distributionBuilder(all) } }, '📊 Kazanım tablosuyla seç'),
      h('button.btn.btn-ghost', { style: { justifyContent: 'flex-start' }, on: { click: () => imgsInp.click() } }, '🖼 Görselleri soru olarak ekle'),
      h('button.btn.btn-ghost', { style: { justifyContent: 'flex-start' }, on: { click: () => exportQuestions(all, 'soru-deposu') } }, '💾 Yedek al (bütün depo)'),
      h('button.btn.btn-ghost', { style: { justifyContent: 'flex-start' }, on: { click: () => backupInp.click() } }, '📂 Yedekten aç'),
      h('button.btn.btn-ghost', { style: { justifyContent: 'flex-start' }, on: { click: () => { sel.clear(); rows().forEach(q => sel.add(q.id)); render(); } } }, '☑ Görünenlerin hepsini seç'),
      h('button.btn.btn-ghost.btn-danger', { style: { justifyContent: 'flex-start' }, on: { click: async () => { if (!await confirmBox('Bütün depo silinsin mi? Bu geri alınamaz.', 'Havuzu temizle')) return; await db.clear('questions'); all = []; sel.clear(); render(); } } }, '🗑 Havuzu temizle')));

  fbar = filterBar(() => all, s => { st = s; page = 0; render(); });
  lastLen = all.length;
  app.append(
    h('div.row', h('h1', { style: { margin: 0 } }, 'Soru Deposu'), count, h('span.spacer'), hazirBtn(), addBtn(), cropBtn(), menu, imgsInp, backupInp),
    h('p.muted', 'Bir kez ekleyin, her belgede kullanın. Ekran görüntüsünü Ctrl+V ile yapıştırabilir ya da görselleri sürükleyip bırakabilirsiniz.'),
    fbar,
    selBar, list);
  render();
  return () => { document.removeEventListener('paste', onPaste); document.removeEventListener('drop', onDrop); document.removeEventListener('dragover', onOver); };
}

export async function imagesAsQuestions(files, kaynak) {
  const meta = (await db.kvGet('lastMeta')) || {};
  const out = [];
  for (const f of files) {
    const q = { id: uid(), type: 'coktan', text: '', image: await shrinkImage(await readFileAsDataURL(f), 1200), choices: ['', '', '', '', ''], answer: '', ders: meta.ders || '', sinif: meta.sinif || '', konu: meta.konu || '', zorluk: 2, created: Date.now() + out.length, kirpildi: true, kaynak: kaynak || f.name || 'Görsel' };
    await db.put('questions', q); out.push(q);
  }
  return out;
}

export function exportQuestions(qs, name = 'sorular') {
  download(new Blob([JSON.stringify({ app: 'soruevim', tip: 'havuz', version: 1, questions: qs })], { type: 'application/json' }), name + '-' + new Date().toISOString().slice(0, 10) + '.json');
}

function createFrom(ids) {
  let m;
  const opt = (kind, label, desc) => h('button.btn', { style: { justifyContent: 'flex-start', flexDirection: 'column', alignItems: 'flex-start' }, on: { click: async () => {
    m.close();
    sessionStorage.setItem('yeniQids', JSON.stringify(ids)); location.hash = '#/yeni/' + kind;
  } } }, h('b', label), h('span.small.muted', desc));
  m = modal(ids.length + ' seçili soruyla oluştur', h('div', { style: { display: 'grid', gap: '8px' } },
    opt('test', 'Tarama Testi', 'İki sütunlu düzen'), opt('yazili', 'Dönem Yazılısı', 'Puanlı, tek sütun'), opt('deneme', 'Deneme Kitapçığı', 'Genel ya da branş'), opt('foy', 'Konu Anlatımı', 'Sorular alıştırma olur'), opt('banka', 'Soru Kitabı', 'Çok sayfalı derleme')));
}

// ---------- Hazır bankalar ----------
async function hazirModal(onDone) {
  const have = new Set((await db.all('questions')).map(q => q.hazir).filter(Boolean));
  let m;
  const rows = HAZIR_PAKETLER.map(p => {
    const st = h('span.small.muted', have.has(p.id) ? '✓ Depoda' : p.adet + ' soru');
    const btn = h('button.btn.btn-sm' + (have.has(p.id) ? '' : '.btn-primary'), { on: { click: async () => {
      btn.disabled = true; st.textContent = 'İndiriliyor…';
      try {
        const res = await fetch(p.url); if (!res.ok) throw new Error(res.status);
        const pkg = await res.json();
        st.textContent = 'Ekleniyor…';
        let n = 0; for (const q of pkg.questions) { await db.put('questions', q); n++; if (n % 200 === 0) st.textContent = `Ekleniyor… ${n}/${pkg.questions.length}`; }
        st.textContent = '✓ ' + n + ' soru depoda'; toast(p.ad + ' depoya eklendi'); onDone?.();
      } catch (e) { st.textContent = navigator.onLine ? 'İndirilemedi' : 'İnternet gerekli'; btn.disabled = false; }
    } } }, have.has(p.id) ? 'Yeniden yükle' : 'Depoya ekle');
    const del = have.has(p.id) ? h('button.btn.btn-sm.btn-ghost.btn-danger', { on: { click: async () => { if (!await confirmBox(p.ad + ' depodan çıkarılsın mı? (Kendi sorularınız etkilenmez)', 'Çıkar')) return; for (const q of await db.all('questions')) if (q.hazir === p.id) await db.del('questions', q.id); m.close(); toast('Çıkarıldı'); onDone?.(); } } }, 'Çıkar') : null;
    return h('div.item-row', { style: { padding: '12px' } }, h('div.ico', { style: { fontSize: '1.6rem' } }, '📘'), h('div', { style: { flex: 1 } }, h('b', p.ad), h('div.small.muted', 'Yazar: ' + p.yazar + ' · Maarif Modeli kazanımlarıyla etiketli, cevaplı ve kısa çözümlü')), st, btn, del);
  });
  m = modal('Hazır soru bankaları', h('div', { style: { display: 'grid', gap: '8px' } }, h('p.small.muted', 'Sorular sınıf, konu, kazanım, zorluk ve kısa çözümle birlikte deponuza eklenir; düzenleyebilir, belgelerde kullanabilirsiniz. Diğer branşlar yakında.'), ...rows));
}

// ---------- Toplu işlemler ----------
function bulkTag(ids, onDone) {
  const f = { sinif: '', ders: '', unite: '', kazanim: '', konu: '', zorluk: '', ekle: '', cikar: '' };
  const inp = (k, ph, list) => h('input.inp', { placeholder: ph, list, on: { input: e => { f[k] = e.target.value; } } });
  let m;
  m = modal(`Toplu etiketle (${ids.length} soru)`, h('div', { style: { display: 'grid', gap: '10px' } }, h('p.small.muted', 'Boş bıraktığınız alanlar değişmez.'),
    h('div.form-grid',
      h('label.fld', 'Sınıf', h('select.inp', { on: { change: e => { f.sinif = e.target.value; } } }, h('option', { value: '' }, '— Değiştirme —'), SINIFLAR.map(s => h('option', { value: s }, s)))),
      h('label.fld', 'Ders', h('select.inp', { on: { change: e => { f.ders = e.target.value; } } }, h('option', { value: '' }, '— Değiştirme —'), DERSLER.map(s => h('option', { value: s }, s)))),
      h('label.fld', 'Tema / ünite', inp('unite', 'Ör. 1.2')),
      h('label.fld', 'Zorluk', h('select.inp', { on: { change: e => { f.zorluk = e.target.value; } } }, h('option', { value: '' }, '— Değiştirme —'), Object.entries(LEVELS).map(([v, l]) => h('option', { value: v }, l))))),
    h('label.fld', 'Öğrenme çıktısı', inp('kazanim', 'Ör. KİM.9.1.3')),
    h('label.fld', 'Konu (serbest metin)', inp('konu', '')),
    h('label.fld', 'Eklenecek etiket(ler)', inp('ekle', 'Virgülle ayırın')),
    h('label.fld', 'Çıkarılacak etiket(ler)', inp('cikar', 'Virgülle ayırın'))),
    { actions: [h('button.btn', { on: { click: () => m.close() } }, 'İptal'), h('button.btn.btn-primary', { on: { click: async () => {
      const add = f.ekle.split(',').map(s => s.trim()).filter(Boolean), rem = new Set(f.cikar.split(',').map(s => s.trim()).filter(Boolean));
      for (const id of ids) { const q = await db.get('questions', id); if (!q) continue;
        for (const k of ['sinif', 'ders', 'unite', 'kazanim', 'konu']) if (f[k]) q[k] = f[k];
        if (f.zorluk) q.zorluk = +f.zorluk;
        q.etiketler = [...new Set([...(q.etiketler || []).filter(e => !rem.has(e)), ...add])];
        await db.put('questions', q); }
      m.close(); toast(ids.length + ' soru etiketlendi'); location.reload();
    } } }, `Uygula (${ids.length} soru)`)] });
}

function bulkAnswers(ids, all, onDone) {
  const qs = ids.map(i => all.find(q => q.id === i)).filter(Boolean);
  const ta = h('textarea.inp', { rows: 3, placeholder: 'Ör. ABCDA BCDEA… (sırayla, boşluk ve tireler yok sayılır)', value: qs.map(q => q.answer || '-').join('') });
  let m;
  m = modal('Cevap anahtarı yaz', h('div', { style: { display: 'grid', gap: '8px' } }, h('p.small.muted', `Seçili ${qs.length} sorunun cevaplarını sırayla yazın. Boş bırakmak için “-”.`), ta),
    { actions: [h('button.btn.btn-primary', { on: { click: async () => {
      const ks = ta.value.toLocaleUpperCase('tr-TR').replace(/[^A-E\-_.]/g, '').split('');
      for (let i = 0; i < qs.length; i++) { const k = ks[i]; if (k === undefined) break; qs[i].answer = LETTERS.includes(k) ? k : ''; await db.put('questions', qs[i]); }
      m.close(); toast('Cevaplar yazıldı'); onDone();
    } } }, 'Kaydet')] });
}

async function bulkStamp(ids, all, onDone) {
  const b = await getBrand();
  if (!(b.damgalar || []).length) { toast('Önce Kurum Kimliği → Mühürlerim’den mühür oluşturun'); return; }
  let m;
  m = modal('Seçili sorulara damga bas', h('div.row', [...b.damgalar.map(d => h('button', { style: { border: '1px solid var(--line)', borderRadius: '8px', background: '#fff', padding: '6px', cursor: 'pointer' }, on: { click: async () => { for (const id of ids) { const q = all.find(x => x.id === id); q.damga = d.id; await db.put('questions', q); } m.close(); toast('Damga basıldı'); onDone(); } } }, h('img', { src: d.img, style: { width: '64px' } }))),
    h('button.btn', { on: { click: async () => { for (const id of ids) { const q = all.find(x => x.id === id); delete q.damga; await db.put('questions', q); } m.close(); onDone(); } } }, 'Damgayı kaldır')]));
}

// ---------- Dağılım tablosuyla sınav ----------
function distributionBuilder(all) {
  let sinif = '', ders = '';
  const box = h('div');
  const counts = {};
  const draw = () => {
    box.innerHTML = '';
    const pool = all.filter(q => (!sinif || q.sinif === sinif) && (!ders || q.ders === ders) && q.kazanim);
    const groups = {}; pool.forEach(q => (groups[q.kazanim] ||= []).push(q));
    const meb = ders ? (OGRENME_CIKTILARI[sinif] || []).filter(o => o.ders === ders).map(o => o.kod) : [];
    const keys = [...new Set([...Object.keys(groups), ...meb, ...Object.keys(counts).filter(k => counts[k])])].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
    const sen = ders && SENARYOLAR[sinif]?.[ders];
    if (sen) box.append(h('div.row', { style: { marginBottom: '8px' } }, h('b.small', `MEB ${SENARYO_YILI} senaryosu:`),
      ...Object.entries(sen).filter(([, list]) => Array.isArray(list)).map(([yz, list]) => h('select.inp', { style: { width: 'auto' }, on: { change: e => { if (e.target.value === '') return; for (const k in counts) delete counts[k]; Object.assign(counts, list[+e.target.value].d); draw(); } } }, h('option', { value: '' }, yz), list.map((x, i) => h('option', { value: i }, `${x.ad} (${Object.values(x.d).reduce((a, b) => a + b, 0)} soru)`))))));
    if (!keys.length) { box.append(h('p.muted', 'Bu sınıf/derste kazanımla etiketli soru yok.')); return; }
    const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
    box.append(h('table.table', h('tr', h('th', 'Öğrenme çıktısı'), h('th', 'Depoda'), h('th', 'Soru sayısı')), keys.map(k => { const n = groups[k]?.length || 0; return h('tr', h('td', h('b', k), h('div.small.muted', ciktiMetni(k) || groups[k]?.[0]?.konu || '')), h('td', { style: { color: (counts[k] || 0) > n ? 'var(--bad)' : null } }, String(n)), h('td', h('input.inp', { type: 'number', min: 0, value: counts[k] || 0, style: { width: '70px' }, on: { input: e => { counts[k] = +e.target.value; } } }))); }), h('tr', h('td', h('b', 'Toplam')), h('td'), h('td', h('b', String(total))))));
  };
  const sinifs = [...new Set([...all.map(q => q.sinif).filter(Boolean), ...Object.keys(OGRENME_CIKTILARI)])].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  const derss = [...new Set([...all.map(q => q.ders).filter(Boolean), ...Object.values(SENARYOLAR).flatMap(x => Object.keys(x))])].sort((a, b) => a.localeCompare(b, 'tr'));
  let m;
  m = modal('Kazanım tablosuyla soru seç', h('div', { style: { display: 'grid', gap: '10px' } }, h('p.small.muted', 'Öğrenme çıktısı başına kaç soru istediğinizi yazın; sorular depodan rastgele seçilir.'),
    h('div.row', h('select.inp', { style: { width: 'auto' }, on: { change: e => { sinif = e.target.value; draw(); } } }, h('option', { value: '' }, 'Sınıf'), sinifs.map(s => h('option', { value: s }, s))), h('select.inp', { style: { width: 'auto' }, on: { change: e => { ders = e.target.value; draw(); } } }, h('option', { value: '' }, 'Ders'), derss.map(s => h('option', { value: s }, s)))), box),
    { wide: true, actions: ['test', 'yazili'].map(kind => h('button.btn.btn-primary', { on: { click: () => {
      const ids = [];
      const eksik = [];
      for (const [k, n] of Object.entries(counts)) { if (!n) continue; const pool = all.filter(q => q.kazanim === k && (!sinif || q.sinif === sinif) && (!ders || q.ders === ders)).sort(() => Math.random() - .5); ids.push(...pool.slice(0, n).map(q => q.id)); if (pool.length < n) eksik.push(k + ' (' + (n - pool.length) + ')'); }
      if (eksik.length) toast('Depoda yetmeyen: ' + eksik.join(', '));
      if (!ids.length) { toast('Soru sayısı girin'); return; }
      m.close(); sessionStorage.setItem('yeniQids', JSON.stringify(ids)); location.hash = '#/yeni/' + kind;
    } } }, KINDS[kind].kisa + ' oluştur')) });
  draw();
}

// ---------- Soru düzenleyici ----------
export async function editQuestion(q, onSaved, { preset = {}, list = null } = {}) {
  const defaults = { ...((await db.kvGet('lastMeta')) || {}), ...Object.fromEntries(Object.entries(preset).filter(([, v]) => v)) };
  const brand = await getBrand();
  const d = q ? structuredClone(q) : { id: uid(), type: 'coktan', text: '', image: '', choices: ['', '', '', '', ''], answer: '', ders: defaults.ders || '', sinif: defaults.sinif || '', konu: defaults.konu || '', kazanim: '', zorluk: 2, cozum: '', created: Date.now() };
  d.choices ||= ['', '', '', '', '']; d.choiceImgs ||= [];
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
        h('div', { style: { display: 'grid', gap: '6px' } }, LETTERS.map((L, i) => {
          const ci = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; d.choiceImgs[i] = await shrinkImage(await readFileAsDataURL(f), 600); drawType(); } } });
          const ti = h('input.inp', { value: d.choices[i] || '', placeholder: i < 4 ? 'Şık ' + L + ' — görsel için yapıştırın' : 'Şık E (isteğe bağlı)', on: { input: e => { d.choices[i] = e.target.value; }, paste: async e => { const it = [...(e.clipboardData?.items || [])].find(x => x.type.startsWith('image/')); if (it) { e.preventDefault(); d.choiceImgs[i] = await shrinkImage(await readFileAsDataURL(it.getAsFile()), 600); drawType(); } } } });
          return h('div.row', { style: { flexWrap: 'nowrap' } }, h('b', { style: { width: '22px' } }, L + ')'), d.choiceImgs[i] ? h('img', { src: d.choiceImgs[i], style: { maxHeight: '40px', border: '1px solid var(--line)' } }) : ti,
            h('button.icon-btn', { title: 'Şık görseli', on: { click: () => d.choiceImgs[i] ? (d.choiceImgs[i] = '', drawType()) : ci.click() } }, d.choiceImgs[i] ? '✕' : '🖼'), ci);
        })),
        h('p.small.muted', { style: { margin: '6px 0' } }, 'Şıklar görselin içindeyse boş bırakın.'),
        h('div.row', h('b.small', 'Doğru cevap:'), ansSeg, h('span.spacer'),
          h('label.fld', { style: { flexDirection: 'row', alignItems: 'center', gap: '6px' } }, 'Şık dizilimi', h('select.inp', { value: d.layout || 'auto', style: { width: 'auto' }, on: { change: e => { d.layout = e.target.value; } } }, Object.entries(LAYOUTS).map(([v, l]) => h('option', { value: v }, l))))),
        h('label.check', h('input', { type: 'checkbox', checked: !!d.sabitSik, on: { change: e => { d.sabitSik = e.target.checked; } } }), 'B kitapçığında şıkları karıştırma'));
    } else if (d.type === 'dy') {
      const seg = h('div.seg', [['D', 'Doğru'], ['Y', 'Yanlış']].map(([v, l]) => h('button' + (d.answer === v ? '.on' : ''), { type: 'button', on: { click: e => { d.answer = v; [...seg.children].forEach(b => b.classList.toggle('on', b === e.target)); } } }, l)));
      typeSpecific.append(h('div.row', h('b.small', 'Cevap:'), seg));
    } else {
      typeSpecific.append(h('div.form-grid',
        h('label.fld', { style: { gridColumn: '1/-1' } }, 'Beklenen cevap', h('textarea', { value: d.cevapMetni || '', rows: 2, on: { input: e => { d.cevapMetni = e.target.value; } } })),
        d.type === 'klasik' ? h('label.fld', 'Cevap boşluğu (satır)', h('input', { type: 'number', min: 0, max: 30, value: d.bosluk || '', placeholder: 'Belge ayarı', on: { input: e => { d.bosluk = +e.target.value || 0; } } })) : null));
    }
  };
  drawType();

  const typeSel = h('select.inp', { value: d.type, on: { change: e => { d.type = e.target.value; d.answer = ''; drawType(); } } }, Object.entries(QTYPES).map(([v, l]) => h('option', { value: v }, l)));
  const ta = h('textarea.inp', { value: d.text, rows: 4, placeholder: 'Soru kökü. **kalın**, !!uyarı!!, ==vurgu==, ++ikinci vurgu++, x^2, H_2O, $\\frac{a}{b}$ — görseli Ctrl+V ile yapıştırabilirsiniz.' });
  const pv = h('div.q-text', { style: { background: '#fff', border: '1px dashed var(--line)', borderRadius: '8px', padding: '8px 10px', minHeight: '28px' } });
  const upd = () => { pv.innerHTML = rich(d.text) || '<span class="muted small">Önizleme</span>'; };
  ta.addEventListener('input', () => { d.text = ta.value; upd(); }); upd();
  ta.addEventListener('paste', async e => {
    const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); setImage(await readFileAsDataURL(item.getAsFile())); toast('Görsel eklendi'); }
  });
  const fmt = (pre, post = pre) => () => { const s = ta.selectionStart, e = ta.selectionEnd; ta.setRangeText(pre + ta.value.slice(s, e) + post, s, e, 'end'); ta.focus(); d.text = ta.value; upd(); };
  const fmtBar = h('div.row', { style: { gap: '4px' } },
    h('button.btn.btn-sm', { title: 'Kalın (**)', on: { click: fmt('**') } }, h('b', 'K')),
    h('button.btn.btn-sm', { title: 'Uyarı — kırmızı kalın (!!)', on: { click: fmt('!!') }, style: { color: '#c1121f', fontWeight: 800 } }, '!'),
    h('button.btn.btn-sm', { title: 'Vurgu — yeşil zemin (==)', on: { click: fmt('==') }, style: { background: '#c7f0c2' } }, 'V'),
    h('button.btn.btn-sm', { title: 'İkinci vurgu — turuncu zemin (++)', on: { click: fmt('++') }, style: { background: '#ffd8a8' } }, 'V2'),
    h('button.btn.btn-sm', { title: 'Üst simge', on: { click: fmt('^{', '}') } }, 'x²'),
    h('button.btn.btn-sm', { title: 'Alt simge', on: { click: fmt('_{', '}') } }, 'x₂'),
    h('button.btn.btn-sm', { title: 'Formül (LaTeX)', on: { click: fmt('$', '$') } }, '∑'),
    ...['→', '⇌', '°', '·', '×', '÷', '≤', '≥', '≠', '±', 'Δ', '√', 'π', 'α', 'β', 'γ', 'λ', '−'].map(sym => h('button.btn.btn-sm', { style: { padding: '4px 7px' }, on: { click: () => { ta.setRangeText(sym, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); d.text = ta.value; upd(); } } }, sym)));
  const fld = (label, key, attrs = {}) => h('label.fld', label, h('input.inp', { value: d[key] ?? '', ...attrs, on: { input: e => { d[key] = e.target.value; } } }));
  const cozImg = h('img', { src: d.cozumImg || '', style: { maxHeight: '120px', display: d.cozumImg ? 'block' : 'none' } });
  const cozInp = h('input', { type: 'file', accept: 'image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; if (!f) return; d.cozumImg = await shrinkImage(await readFileAsDataURL(f)); cozImg.src = d.cozumImg; cozImg.style.display = 'block'; } } });
  // kullanım geçmişi
  const usage = h('div.small.muted', 'Kullanıldığı belgeler yükleniyor…');
  db.all('documents').then(docs => {
    const used = docs.filter(x => (x.items || []).some(i => i.qid === d.id) || (x.sections || []).some(s => s.qids.includes(d.id)) || (x.blocks || []).some(b => b.qid === d.id));
    usage.innerHTML = '';
    usage.append(h('b', `Kullanıldığı belgeler (${used.length})`), used.length ? h('div', used.map(x => h('a', { href: '#/belge/' + x.id, style: { display: 'block' } }, '• ' + (x.title || KINDS[x.kind].ad)))) : h('div', 'Bu soru henüz hiçbir belgede kullanılmadı.'));
  });

  let m;
  const saveBtn = h('button.btn.btn-primary', { on: { click: async () => {
    if (!d.text.trim() && !d.image) { toast('Soru metni ya da görsel gerekli'); return; }
    if (d.type === 'coktan' && !d.answer) { if (!await confirmBox('Doğru cevap seçilmedi. Yine de kaydedilsin mi?', 'Kaydet')) return; }
    d.updated = Date.now();
    d.etiketler = String(d._etiket ?? (d.etiketler || []).join(', ')).split(',').map(s => s.trim()).filter(Boolean); delete d._etiket;
    await db.put('questions', d);
    await db.kvSet('lastMeta', { ders: d.ders, sinif: d.sinif, konu: d.konu });
    m.close(); toast('Soru kaydedildi'); onSaved?.(d);
  } } }, 'Kaydet');
  const idx = list ? list.findIndex(x => x.id === d.id) : -1;
  const nav = idx >= 0 ? h('div.row', h('button.btn.btn-sm', { disabled: idx <= 0, on: { click: () => { m.close(); editQuestion(list[idx - 1], onSaved, { list }); } } }, '‹ Önceki'), h('span.small.muted', `${idx + 1} / ${list.length}`), h('button.btn.btn-sm', { disabled: idx >= list.length - 1, on: { click: () => { m.close(); editQuestion(list[idx + 1], onSaved, { list }); } } }, 'Sonraki ›')) : null;

  m = modal(q ? 'Soruyu düzenle' : 'Yeni soru', h('div', { style: { display: 'grid', gap: '12px' } },
    nav,
    h('div.row', h('label.fld', { style: { flex: 1 } }, 'Soru tipi', typeSel), h('label.fld', { style: { flex: 1 } }, 'Süreç / bağlam etiketi', h('input.inp', { value: d.surec || '', placeholder: 'Ör. Bağlam, Klasik', on: { input: e => { d.surec = e.target.value; } } }))),
    fmtBar, ta, pv,
    d.tablo?.length ? h('div.small.muted', '▦ Bu soruda ' + d.tablo.length + ' veri tablosu var (kâğıtta basılır).') : null,
    h('div.row', h('button.btn.btn-sm', { on: { click: () => fileInp.click() } }, '🖼 Görsel ekle'), h('button.btn.btn-sm', { on: { click: () => d.image ? editImage(d.image, async u => { d.image = u; img.src = u; img.style.display = 'block'; }) : toast('Önce görsel ekleyin') } }, '🛠 Görseli düzelt'), h('button.btn.btn-sm.btn-ghost', { on: { click: () => setImage('') } }, 'Görseli kaldır'), fileInp,
      h('label.fld', { style: { flexDirection: 'row', alignItems: 'center', gap: '6px' } }, 'Genişlik %', h('input.inp', { type: 'number', min: 20, max: 100, value: d.imgW || '', placeholder: '100', style: { width: '70px' }, on: { input: e => { d.imgW = +e.target.value || undefined; } } }))),
    img, typeSpecific,
    h('div.form-grid',
      h('label.fld', 'Sınıf', h('select.inp', { value: d.sinif, on: { change: e => { d.sinif = e.target.value; } } }, h('option', { value: '' }, '—'), SINIFLAR.map(s => h('option', { value: s }, s)))),
      h('label.fld', 'Ders', h('input.inp', { value: d.ders || '', list: 'dersList', on: { input: e => { d.ders = e.target.value; } } })),
      fld('Tema / ünite', 'unite', { placeholder: 'Ör. 1.2' }),
      fld('Konu', 'konu', { placeholder: 'Mol kavramı' }),
      h('label.fld', 'Zorluk', h('select.inp', { value: String(d.zorluk || 2), on: { change: e => { d.zorluk = +e.target.value; } } }, Object.entries(LEVELS).map(([v, l]) => h('option', { value: v }, l)))),
      fld('Kitaptaki no', 'kitapNo', { placeholder: 'Ör. 12' })),
    h('datalist#dersList', DERSLER.map(x => h('option', { value: x }))),
    fld('Öğrenme çıktısı / kazanım', 'kazanim', { placeholder: 'Ör. KİM.9.1.3 — yazmaya başlayın', list: 'mebOC' }),
    h('datalist#mebOC', Object.values(OGRENME_CIKTILARI).flat().map(o => h('option', { value: o.kod, label: o.metin }))),
    h('div.form-grid', fld('Kaynak', 'kaynak', { placeholder: 'Kitap / yayın adı' }), h('label.fld', 'Etiketler', h('input.inp', { value: (d.etiketler || []).join(', '), placeholder: 'Virgülle ayırın', on: { input: e => { d._etiket = e.target.value; } } }))),
    (brand.damgalar || []).length ? h('div.row', h('b.small', 'Damga:'), h('button.btn.btn-sm' + (!d.damga ? '.btn-primary' : ''), { on: { click: e => { delete d.damga; e.target.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('btn-primary')); e.target.classList.add('btn-primary'); } } }, 'Yok'), brand.damgalar.map(s => h('button.btn.btn-sm' + (d.damga === s.id ? '.btn-primary' : ''), { on: { click: e => { d.damga = s.id; e.currentTarget.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('btn-primary')); e.currentTarget.classList.add('btn-primary'); } } }, h('img', { src: s.img, style: { width: '28px', height: '28px' } })))) : null,
    h('label.fld', 'Çözüm ve not (öğretmen sürümünde görünür)', h('textarea.inp', { value: d.cozum || '', rows: 2, on: { input: e => { d.cozum = e.target.value; } } })),
    h('div.row', h('button.btn.btn-sm', { on: { click: () => cozInp.click() } }, '🖼 Çözüm görseli'), h('button.btn.btn-sm.btn-ghost', { on: { click: () => { d.cozumImg = ''; cozImg.style.display = 'none'; } } }, 'Kaldır'), cozInp), cozImg,
    q ? usage : null,
  ), { wide: true, actions: [q ? h('button.btn.btn-danger', { on: { click: async () => { if (!await confirmBox('Soru silinsin mi?', 'Sil')) return; await db.del('questions', d.id); m.close(); toast('Silindi'); onSaved?.(null); } } }, 'Soruyu sil') : null, h('span.spacer'), h('button.btn', { on: { click: () => m.close() } }, 'Vazgeç'), saveBtn].filter(Boolean) });
  setTimeout(() => ta.focus(), 50);
}

// ---------- Havuzdan seçici ----------
export async function pickQuestions({ exclude = [], title = 'Depodan soru seç', filter, preset = {}, max = 0, tekKazanim = false, kazanimMax = tekKazanim ? 1 : 0 } = {}) {
  let all = (await db.all('questions')).sort((a, b) => b.created - a.created);
  if (filter) all = all.filter(filter);
  const ex = new Set(exclude);
  const chosen = [];
  let st = { ...preset };
  let lim = 80;
  return new Promise(resolve => {
    const list = h('div.q-list', { style: { maxHeight: '56vh', overflow: 'auto' } });
    const cnt = h('b', max ? '0 / ' + max : '0');
    const byId = Object.fromEntries(all.map(q => [q.id, q]));
    const kzOf = q => q.kazanim || ('konu:' + (q.konu || q.id));
    const kural = !!(max || kazanimMax);
    const pasifMi = q => {
      if (chosen.includes(q.id)) return '';
      if (max && chosen.length >= max) return `En çok ${max} soru seçebilirsiniz`;
      if (kazanimMax && chosen.filter(id => kzOf(byId[id]) === kzOf(q)).length >= kazanimMax) return kazanimMax === 1 ? 'Bu kazanımdan zaten bir soru seçtiniz' : `Bu kazanımdan en çok ${kazanimMax} soru seçebilirsiniz`;
      return '';
    };
    const render = () => {
      const top = list.scrollTop;
      list.innerHTML = '';
      setTimeout(() => { list.scrollTop = top; });
      const rows = applyFilter(all, st).filter(q => !ex.has(q.id));
      if (!rows.length) list.append(h('div.empty', all.length ? 'Uygun soru yok. Üstteki süzgeçleri gevşetin.' : 'Havuz boş. Önce Soru Deposu’na soru ekleyin ya da hazır bankaları yükleyin.'));
      for (const q of rows.slice(0, lim)) {
        const neden = kural ? pasifMi(q) : '';
        const el = qCard(q, { selected: chosen.includes(q.id), onClick: () => {
          if (neden) { toast(neden); return; }
          const i = chosen.indexOf(q.id); i < 0 ? chosen.push(q.id) : chosen.splice(i, 1);
          cnt.textContent = max ? chosen.length + ' / ' + max : chosen.length;
          if (kural) render(); else el.classList.toggle('selected');
        } });
        if (neden) { el.classList.add('pasif'); el.title = neden; }
        list.append(el);
      }
      if (rows.length > lim) list.append(h('button.btn', { on: { click: () => { lim += 120; render(); } } }, `Daha fazla (${rows.length - lim})`));
    };
    let done = false;
    const finish = v => { if (done) return; done = true; m.close(); resolve(v); };
    const m = modal(title, h('div',
      filterBar(all, s => { st = s; render(); }, preset),
      kural ? h('p.small.muted', { style: { margin: '0 0 8px' } }, [max ? `En çok ${max} soru seçebilirsiniz.` : '', kazanimMax ? (kazanimMax === 1 ? 'Bir kazanımdan soru seçince aynı kazanımın diğer soruları soluklaşır.' : `Bir kazanımdan ${kazanimMax} soru seçince o kazanımın diğer soruları soluklaşır.`) : ''].filter(Boolean).join(' ')) : null,
      kural ? null : h('div.row', { style: { marginBottom: '8px' } },
        h('button.btn.btn-sm', { on: { click: () => { applyFilter(all, st).filter(q => !ex.has(q.id) && !chosen.includes(q.id)).forEach(q => chosen.push(q.id)); cnt.textContent = chosen.length; render(); } } }, 'Görünenlerin hepsini seç'),
        h('label.row.small', 'Rastgele ', h('input.inp', { type: 'number', min: 1, value: 10, style: { width: '64px' }, id: 'rndN' }), h('button.btn.btn-sm', { on: { click: () => { const n = +document.getElementById('rndN').value || 10; const pool = applyFilter(all, st).filter(q => !ex.has(q.id) && !chosen.includes(q.id)).sort(() => Math.random() - .5).slice(0, n); pool.forEach(q => chosen.push(q.id)); cnt.textContent = chosen.length; render(); } } }, 'seç')),
        h('button.btn.btn-sm.btn-accent', { on: { click: () => { finish(null); cropTool(() => toast('Kırpılan sorular depoya eklendi; tekrar seçiciyi açın.')); } } }, '✂ Yeni kırp')),
      list), { wide: true, actions: [h('span.muted', 'Seçili: ', cnt), h('span.spacer'), h('button.btn', { on: { click: () => finish([]) } }, 'Vazgeç'), h('button.btn.btn-primary', { on: { click: () => finish(chosen.slice()) } }, 'Ekle')] });
    const obs = new MutationObserver(() => { if (!m.box.isConnected) { obs.disconnect(); finish([]); } });
    obs.observe(document.body, { childList: true });
    render();
  });
}

// ---------- PDF / görselden kırpma ----------
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
let pdfjsP;
export async function loadPdfJs() {
  pdfjsP ||= import(PDFJS).then(m => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; });
  return pdfjsP;
}

// Sayfa metninden cevap anahtarı çıkar: "1. A  2-B  3)C" vb.
export function parseAnswerKey(text) {
  const map = {};
  const re = /(?:^|[^\d])(\d{1,3})\s*[.)\-:]?\s*([A-E])(?![a-zçğıöşü])/g;
  let m; while ((m = re.exec(text))) { const n = +m[1]; if (!map[n]) map[n] = m[2]; }
  return map;
}

export async function cropTool(onDone) {
  const meta = (await db.kvGet('lastMeta')) || {};
  const added = [];
  let pdf = null, pageNo = 1, pageCount = 1, fileName = '', curFileId = null;
  let canvas = h('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  let rect = null, drag = null, mode = 'crop', viewScale = 1, renderScale = 2.2;
  let detected = [];
  const rectEl = h('div.crop-rect', { hidden: true });
  const detLayer = h('div', { style: { position: 'absolute', inset: 0, pointerEvents: 'none' } });
  const stage = h('div.crop-stage', canvas, detLayer, rectEl);
  const pageLbl = h('span.small.muted', '');
  const thumbs = h('div', { style: { display: 'grid', gap: '6px', maxHeight: '26vh', overflow: 'auto' } });
  const preview = h('img.thumb', { hidden: true });
  const status = h('p.small.muted', 'Raftan bir dosya seçin ya da yeni PDF / sayfa görseli yükleyin.');
  const lib = h('div', { style: { display: 'grid', gap: '4px', maxHeight: '22vh', overflow: 'auto' } });

  const drawLib = async () => {
    const files = (await db.all('files')).sort((a, b) => b.added - a.added);
    lib.innerHTML = '';
    if (!files.length) lib.append(h('div.small.muted', 'Raf boş.'));
    files.forEach(f => lib.append(h('div.item-row', { style: { padding: '4px 6px', background: f.id === curFileId ? 'var(--cream-2)' : null } },
      h('span.txt', { title: f.name, style: { cursor: 'pointer' }, on: { click: () => openStored(f) } }, (f.type === 'pdf' ? '📄 ' : '🖼 ') + f.name),
      h('button.icon-btn', { title: 'Raftan kaldır', on: { click: async () => { await db.del('files', f.id); drawLib(); } } }, '✕'))));
  };
  const fileInp = h('input', { type: 'file', accept: 'application/pdf,image/*', hidden: true, on: { change: async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; const rec = { id: uid(), name: f.name, type: /pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? 'pdf' : 'img', blob: f, added: Date.now(), page: 1 }; try { await db.put('files', rec); } catch { } curFileId = rec.id; drawLib(); openFile(rec.blob, rec.type, rec.name, 1); } } });
  const openStored = rec => { curFileId = rec.id; drawLib(); openFile(rec.blob, rec.type, rec.name, rec.page || 1); };

  async function openFile(blob, type, name, startPage = 1) {
    status.textContent = 'Açılıyor…'; fileName = name;
    try {
      if (type === 'pdf') {
        const lib = await loadPdfJs();
        pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        pageCount = pdf.numPages; pageNo = Math.min(startPage, pageCount);
        await drawPdfPage();
      } else {
        pdf = null; pageCount = 1; pageNo = 1;
        const im = await loadImg(await readFileAsDataURL(blob));
        canvas.width = im.width; canvas.height = im.height; renderScale = 1;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, im.width, im.height); ctx.drawImage(im, 0, 0);
        fitCanvas();
      }
      status.textContent = 'Sorunun çevresine çerçeve çizin, sonra cevabın harfine basın (klavyede A–E). “Soruları otomatik çerçevele” düğmesi bunu kendisi yapar.';
    } catch (err) {
      console.error(err);
      status.textContent = navigator.onLine ? 'Dosya açılamadı: ' + err.message : 'PDF okuyucu ilk kez internet gerektirir. Bir kez çevrimiçiyken açın, sonra çevrimdışı da çalışır.';
    }
  }
  let pageText = null;
  async function drawPdfPage() {
    const page = await pdf.getPage(pageNo);
    renderScale = 2.2;
    const vp = page.getViewport({ scale: renderScale });
    canvas.width = vp.width; canvas.height = vp.height;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, vp.width, vp.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const tc = await page.getTextContent();
    pageText = tc.items.map(it => { const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]); return { s: it.str, x, y, w: it.width * renderScale, h: (it.height || 10) * renderScale }; }).filter(t => t.s.trim());
    if (curFileId) { const r = await db.get('files', curFileId); if (r) { r.page = pageNo; db.put('files', r); } }
    fitCanvas();
  }
  function fitCanvas() {
    const w = stage.clientWidth || 700;
    viewScale = Math.min(1, w / canvas.width);
    canvas.style.width = canvas.width * viewScale + 'px';
    canvas.style.height = canvas.height * viewScale + 'px';
    rect = null; rectEl.hidden = true; preview.hidden = true; detected = []; drawDetected();
    pageLbl.textContent = pdf ? `Sayfa ${pageNo} / ${pageCount}` : '';
    if (!pdf) pageText = null;
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
  const cropRect = (r) => {
    const c = document.createElement('canvas');
    const pad = 6;
    const x = Math.max(0, r.x - pad), y = Math.max(0, r.y - pad);
    c.width = Math.min(canvas.width - x, r.w + pad * 2); c.height = Math.min(canvas.height - y, r.h + pad * 2);
    const cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(canvas, x, y, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  };
  const cropData = () => cropRect(rect).toDataURL('image/png');
  const showPreview = () => { drawRect(); preview.src = cropData(); preview.hidden = false; };

  // --- Otomatik soru bulma ---
  function drawDetected() {
    detLayer.innerHTML = '';
    detected.forEach((d, i) => detLayer.append(h('div', { style: { position: 'absolute', left: d.x * viewScale + 'px', top: d.y * viewScale + 'px', width: d.w * viewScale + 'px', height: d.h * viewScale + 'px', border: '2px dashed ' + (d.done ? '#2f8a57' : '#1B4B7F'), background: d.done ? 'rgba(47,138,87,.08)' : 'rgba(27,75,127,.06)', pointerEvents: 'auto', cursor: 'pointer' }, on: { click: () => { rect = { x: d.x, y: d.y, w: d.w, h: d.h }; detected.cur = i; showPreview(); } } },
      h('span', { style: { position: 'absolute', left: 0, top: '-18px', background: d.done ? '#2f8a57' : '#4C3BB5', color: '#fff', fontSize: '11px', padding: '1px 6px', borderRadius: '4px' } }, (d.no ? '#' + d.no : '#' + (i + 1)) + (d.ans ? ' · ' + d.ans : '')))));
  }
  function detect() {
    if (!canvas.width) { toast('Önce bir sayfa açın'); return; }
    const W = canvas.width, H = canvas.height;
    const id = ctx.getImageData(0, 0, W, H).data;
    const ink = (x, y) => { const i = (y * W + x) * 4; return id[i] < 200 || id[i + 1] < 200 || id[i + 2] < 200; };
    // sütun ayrımı: orta bölgede boş dikey şerit
    let split = null;
    for (let x = Math.floor(W * .42); x < W * .58; x += 2) { let n = 0; for (let y = Math.floor(H * .08); y < H * .92; y += 3) if (ink(x, y)) n++; if (n < 3) { split = x; break; } }
    const cols = split ? [[0, split], [split, W]] : [[0, W]];
    const out = [];
    if (pageText?.length) {
      // metin katmanı: satır başındaki soru numaraları
      for (const [cx0, cx1] of cols) {
        const inCol = pageText.filter(t => t.x >= cx0 && t.x < cx1);
        const left = Math.min(...inCol.map(t => t.x));
        const starts = inCol.filter(t => /^\s*\d{1,3}\s*[.)]\s*/.test(t.s) && t.x < left + (cx1 - cx0) * .12).sort((a, b) => a.y - b.y);
        starts.forEach((s, i) => {
          const top = s.y - s.h - 6; const next = starts[i + 1];
          let bottom = next ? next.y - next.h - 10 : H * .95;
          // altbilgiyi dışarıda bırak
          const below = inCol.filter(t => t.y > s.y && t.y < bottom); if (below.length) bottom = Math.min(bottom, Math.max(...below.map(t => t.y)) + 14);
          out.push({ x: cx0 + 4, y: Math.max(0, top), w: cx1 - cx0 - 8, h: Math.max(30, bottom - top), no: +s.s.match(/\d+/)[0] });
        });
      }
    }
    if (!out.length) {
      // görsel: boşluk analizi
      for (const [cx0, cx1] of cols) {
        const rows = []; for (let y = 0; y < H; y++) { let n = 0; for (let x = cx0; x < cx1; x += 3) if (ink(x, y)) { n++; if (n > 2) break; } rows.push(n > 2); }
        const gap = Math.round(H * .022); let y = 0;
        while (y < H) { while (y < H && !rows[y]) y++; if (y >= H) break; let s = y, last = y, blank = 0; while (y < H && blank < gap) { if (rows[y]) { last = y; blank = 0; } else blank++; y++; } if (last - s > H * .03) out.push({ x: cx0 + 4, y: s - 6, w: cx1 - cx0 - 8, h: last - s + 12 }); }
      }
    }
    detected = out.filter(d => d.h > 25);
    if (detected.length > 40) detected = [];
    drawDetected();
    status.textContent = detected.length ? `${detected.length} soru bulundu. Bir çerçeveye tıklayıp harfe basın ya da “Bulunanların hepsini ekle” deyin.` : 'Bu sayfada soru bulunamadı; elle çerçeveleyin.';
  }
  async function addAllDetected() {
    if (!detected.length) { toast('Önce “Soruları otomatik çerçevele”'); return; }
    let n = 0; for (const d of detected) { if (d.done) continue; rect = { x: d.x, y: d.y, w: d.w, h: d.h }; await commit(d.ans || '', d.no); d.done = true; n++; }
    drawDetected(); toast(n + ' soru depoya eklendi');
  }
  async function readKey() {
    let text = pageText ? pageText.map(t => t.s).join(' ') : '';
    if (!text.trim()) { toast('Bu sayfada okunabilir metin yok (taranmış sayfa). Cevapları “Cevap anahtarı” ile elle yazabilirsiniz.'); return; }
    const map = parseAnswerKey(text);
    const keys = Object.keys(map); if (!keys.length) { toast('Sayfada cevap anahtarı bulunamadı'); return; }
    let n = 0;
    for (const q of added) { const k = q.kitapNo && map[q.kitapNo]; if (k && !q.answer) { q.answer = k; await db.put('questions', q); n++; } }
    detected.forEach(d => { if (d.no && map[d.no]) d.ans = map[d.no]; }); drawDetected();
    redrawThumbs();
    status.textContent = `Anahtarda ${keys.length} cevap okundu; ${n} kırpılmış soruya yazıldı. Henüz kırpılmamış sorular, numarasına göre eklenince cevabını alır.`;
    keyMap = { ...keyMap, ...map };
  }
  let keyMap = {};
  const redrawThumbs = () => { thumbs.innerHTML = ''; added.slice().reverse().forEach(q => thumbs.append(h('div.row', { style: { flexWrap: 'nowrap' } }, h('img', { src: q.image, style: { width: '110px', border: '1px solid var(--line)', borderRadius: '6px', background: '#fff' } }), h('span.chip.ans', q.answer ? 'Cevap ' + q.answer : 'Cevapsız'), q.kitapNo ? h('span.chip', '#' + q.kitapNo) : null))); };

  async function commit(answer, no) {
    if (!rect || rect.w < 10) { toast('Önce sorunun çevresine çerçeve çizin'); return; }
    const kn = no || (detected.cur != null ? detected[detected.cur]?.no : undefined);
    const q = { kirpildi: true, id: uid(), type: 'coktan', text: '', image: await shrinkImage(cropData(), 1200), choices: ['', '', '', '', ''], answer: answer || (kn && keyMap[kn]) || '', ders: metaInputs.ders.value, sinif: metaInputs.sinif.value, konu: metaInputs.konu.value, zorluk: 2, kazanim: '', cozum: '', created: Date.now() + added.length, kaynak: (fileName || 'Görsel') + (pdf ? ' · s.' + pageNo : ''), kitapNo: kn || undefined };
    await db.put('questions', q);
    added.push(q);
    await db.kvSet('lastMeta', { ders: q.ders, sinif: q.sinif, konu: q.konu });
    if (detected.cur != null && detected[detected.cur]) { detected[detected.cur].done = true; detected.cur = null; drawDetected(); }
    redrawThumbs();
    ctx.save(); ctx.fillStyle = 'rgba(27,75,127,.08)'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h); ctx.restore();
    rect = null; rectEl.hidden = true; preview.hidden = true;
    status.textContent = `${added.length} soru depoya eklendi. Sıradakini çerçeveleyin.`;
  }

  const metaInputs = {
    ders: h('input.inp', { value: meta.ders || '', placeholder: 'Ders', list: 'dersList2' }),
    sinif: h('input.inp', { value: meta.sinif || '', placeholder: 'Sınıf' }),
    konu: h('input.inp', { value: meta.konu || '', placeholder: 'Konu' }),
  };
  const modeSeg = h('div.seg', [['crop', '✂ Kırp'], ['tippex', '🩹 Ört']].map(([v, l]) => h('button' + (v === mode ? '.on' : ''), { type: 'button', on: { click: e => { mode = v; [...modeSeg.children].forEach(b => b.classList.toggle('on', b === e.target)); stage.style.cursor = v === 'tippex' ? 'cell' : 'crosshair'; } } }, l)));
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
  const onPaste = async e => { const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/')); if (!it || e.target.tagName === 'INPUT') return; e.preventDefault(); openFile(it.getAsFile(), 'img', 'Panodan yapıştırıldı'); };
  document.addEventListener('paste', onPaste);
  const goto = h('input.inp', { type: 'number', min: 1, style: { width: '64px' }, placeholder: 'sayfa', on: { change: async e => { const n = +e.target.value; if (pdf && n >= 1 && n <= pageCount) { pageNo = n; await drawPdfPage(); } } } });

  const m = modal('PDF / görselden soru kırp', h('div.crop-wrap',
    h('div',
      h('div.row', { style: { marginBottom: '8px' } },
        h('button.btn.btn-primary.btn-sm', { on: { click: () => fileInp.click() } }, 'Dosya yükle'), fileInp,
        h('button.btn.btn-sm', { on: { click: async () => { if (pdf && pageNo > 1) { pageNo--; await drawPdfPage(); } } } }, '‹'),
        pageLbl, goto,
        h('button.btn.btn-sm', { on: { click: async () => { if (pdf && pageNo < pageCount) { pageNo++; await drawPdfPage(); } } } }, '›'),
        h('span.spacer'), modeSeg),
      h('div.row', { style: { marginBottom: '8px', gap: '6px' } },
        h('button.btn.btn-sm.btn-accent', { on: { click: detect } }, '🔎 Soruları otomatik çerçevele'),
        h('button.btn.btn-sm', { on: { click: addAllDetected } }, '＋ Bulunanların hepsini ekle'),
        h('button.btn.btn-sm', { title: 'Açık sayfa cevap anahtarıysa okuyup sorulara yazar', on: { click: readKey } }, '🔑 Bu sayfadaki anahtarı oku')),
      stage, status),
    h('div.crop-side', { style: { display: 'grid', gap: '10px', alignContent: 'start' } },
      h('b', 'Dosya rafı'), lib,
      h('b', 'Etiketler (sonraki sorulara da uygulanır)'),
      metaInputs.sinif, metaInputs.ders, metaInputs.konu, h('datalist#dersList2', DERSLER.map(x => h('option', { value: x }))),
      preview,
      h('b', 'Cevap harfine basın:'),
      h('div.ans-keys', LETTERS.map(L => h('button', { on: { click: () => commit(L) } }, L))),
      h('button.btn.btn-sm', { on: { click: () => commit('') } }, 'Cevapsız kaydet (Enter)'),
      h('b', { style: { marginTop: '6px' } }, 'Bu oturumda eklenenler'),
      thumbs)
  ), { wide: true, actions: [h('button.btn.btn-primary', { on: { click: () => m.close() } }, 'Bitti')] });

  const obs = new MutationObserver(() => { if (!m.box.isConnected) { obs.disconnect(); document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); if (added.length) { toast(added.length + ' soru depoya eklendi'); onDone?.(added); } } });
  obs.observe(document.body, { childList: true });
  stage.addEventListener('dragover', e => e.preventDefault());
  stage.addEventListener('drop', async e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; const rec = { id: uid(), name: f.name, type: /pdf/i.test(f.type) ? 'pdf' : 'img', blob: f, added: Date.now(), page: 1 }; try { await db.put('files', rec); } catch { } curFileId = rec.id; drawLib(); openFile(f, rec.type, f.name); });
  canvas.width = 0;
  await drawLib();
  const files = await db.all('files');
  if (!files.length) setTimeout(() => fileInp.click(), 60);
  else { const last = files.sort((a, b) => b.added - a.added)[0]; openStored(last); }
}
