import { h, ICONS, fmtDate, confirmBox, toast, download, readFileAsText, modal } from '../util.js';
import { db, getBrand } from '../db.js';
import { KINDS, kindInfo } from '../render.js';

const ico = name => h('div.ico', { html: ICONS[name] });

export async function homeView(app) {
  const [brand, docs, qs] = await Promise.all([getBrand(), db.all('documents'), db.all('questions')]);
  const brandReady = !!(brand.kurum || brand.logo || brand.ogretmen);

  const sonId = await db.kvGet('sonBelge'); const son = sonId ? docs.find(d => d.id === sonId) : docs.sort((a, b) => b.updated - a.updated)[0];
  const kindCard = (kind, tag) => h('a.card.kind-card', { href: '#/yeni/' + kind, 'data-tour': kind },
    ico(ICONS[kind] ? kind : 'test'), h('div', h('h3', kindInfo(kind).ad, tag ? h('span.tag', tag) : null), h('p', kindInfo(kind).aciklama)), h('span.arrow', '→'));

  app.append(...[
    h('section.hero',
      h('h1', 'Bugün ne ', h('span.hl', 'hazırlıyoruz?')),
      h('p.muted', 'Seçtiğiniz türe göre sayfa düzeni, bölümler ve puanlama hazır gelir.')),
    son ? h('a.card.kind-card', { href: '#/belge/' + son.id, style: { marginTop: '14px', background: 'linear-gradient(90deg,var(--card),color-mix(in srgb,var(--orange) 10%,var(--card)))' } }, h('div.ico', { html: ICONS[son.kind] }), h('div', h('h3', 'Son çalıştığınız dosya'), h('p', (son.title || KINDS[son.kind].ad) + ' · ' + countOf(son))), h('span.arrow', '→')) : null,
    h('div.grid', { style: { marginTop: '18px' } },
      h('a.card.kind-card', { href: '#/marka', 'data-tour': 'marka', style: brandReady ? null : { borderColor: 'var(--orange)' } },
        ico('marka'),
        h('div', h('h3', 'Kurum Kimliğinizi Hazırlayın', brandReady ? h('span.tag', '✓ HAZIR') : null), h('p', 'Logonuz, renginiz ve iletişiminiz ürettiğiniz her belgede görünsün. Bir kez kurmanız yeterli.')),
        h('span.arrow', '→'))),
    h('div.grid.grid-2', { style: { marginTop: '14px' } },
      kindCard('test'), kindCard('tarama'), kindCard('yazili'), kindCard('deneme'), kindCard('foy'), kindCard('banka', 'ÇOK SAYFA')),
    h('div.grid', { style: { marginTop: '14px' } },
      h('a.card.kind-card', { href: '#/havuz', 'data-tour': 'havuz' }, ico('havuz'), h('div', h('h3', 'Soru Deposu', h('span.tag', qs.length + ' SORU')), h('p', 'Kırptığınız ve yazdığınız bütün sorular burada birikir')), h('span.arrow', '→'))),
    docs.length ? h('div', h('div.eyebrow', 'Son belgeler'),
      h('div.grid.grid-2', docs.sort((a, b) => b.updated - a.updated).slice(0, 4).map(docCard))) : null,
    window.__soruevim ? h('div.row.home-foot', { style: { marginTop: '36px', justifyContent: 'center', gap: '10px' } },
      window.__soruevim.themeSeg(),
      h('button.btn.btn-sm.btn-ghost', { on: { click: window.__soruevim.openFile } }, '📂 Dosyadan aç'),
      h('button.btn.btn-sm.btn-ghost', { title: 'Sorularınız ve belgeleriniz silinmez', on: { click: window.__soruevim.forceUpdate } }, '🔄 Uygulamayı güncelle'),
      h('button.btn.btn-sm.btn-ghost', { on: { click: window.__soruevim.tour } }, '🧭 Tanıtım turu')) : null,
  ].filter(Boolean));
}

function docCard(d) {
  return h('a.card.kind-card', { href: '#/belge/' + d.id },
    h('div.ico', { html: ICONS[d.kind] }),
    h('div', h('h3', d.title || KINDS[d.kind].ad), h('p', KINDS[d.kind].kisa + ' · ' + fmtDate(d.updated))),
    h('span.arrow', '→'));
}

export async function docsView(app) {
  const docs = (await db.all('documents')).sort((a, b) => b.updated - a.updated);
  const list = h('div.grid');
  const render = () => {
    list.innerHTML = '';
    if (!docs.length) { list.append(h('div.card.empty', 'Henüz belge yok. ', h('a', { href: '#/' }, 'İlk belgenizi oluşturun →'))); return; }
    for (const d of docs) {
      list.append(h('div.card.row',
        h('div.ico', { html: ICONS[d.kind], style: { width: '40px', height: '40px', display: 'grid', placeItems: 'center', background: 'var(--cream-2)', borderRadius: '10px', color: 'var(--navy)' } }),
        h('div', { style: { flex: 1, minWidth: '160px' } }, h('b', d.title || KINDS[d.kind].ad), h('div.small.muted', KINDS[d.kind].kisa + ' · ' + countOf(d) + ' · ' + fmtDate(d.updated))),
        h('a.btn.btn-sm.btn-primary', { href: '#/belge/' + d.id }, 'Aç'),
        h('button.btn.btn-sm', { on: { click: async () => { const c = structuredClone(d); c.id = crypto.randomUUID(); c.title = (d.title || '') + ' (kopya)'; c.updated = Date.now(); await db.put('documents', c); docs.unshift(c); render(); toast('Kopyalandı'); } } }, 'Kopyala'),
        h('button.btn.btn-sm.btn-danger', { on: { click: async () => { if (!await confirmBox('“' + (d.title || 'Belge') + '” silinsin mi?', 'Sil')) return; await db.del('documents', d.id); docs.splice(docs.indexOf(d), 1); render(); } } }, 'Sil')));
    }
  };
  render();

  const importInp = h('input', { type: 'file', accept: '.json,.soruevim,application/json', hidden: true, on: { change: async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await readFileAsText(f));
      if (d.tip === 'belge' && d.belge) { for (const q of d.questions || []) await db.put('questions', q); const doc = { ...d.belge, updated: Date.now() }; if (await db.get('documents', doc.id)) doc.id = crypto.randomUUID(); await db.put('documents', doc); location.hash = '#/belge/' + doc.id; return; }
      await db.importAll(d); toast('Yedek içe aktarıldı'); location.reload();
    } catch (err) { toast(err.message || 'Dosya okunamadı'); }
  } } });

  app.append(
    h('div.row', { style: { marginBottom: '16px' } },
      h('h1', { style: { margin: 0 } }, 'Dosyalarım'), h('span.spacer'),
      h('button.btn', { on: { click: async () => { const data = await db.exportAll(); download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'soruevim-yedek-' + new Date().toISOString().slice(0, 10) + '.json'); } } }, 'Tümünü yedekle'),
      h('button.btn', { on: { click: () => importInp.click() } }, 'Yedeği aç'), importInp,
      h('a.btn.btn-primary', { href: '#/' }, '+ Yeni oluştur')),
    h('p.muted.small', 'Yedek dosyasını başka bir bilgisayarda açarak okulda başladığınız işi evde bitirebilirsiniz.'),
    list);
}

function countOf(d) {
  if (d.kind === 'foy') return (d.blocks || []).length + ' blok';
  if (d.kind === 'deneme') return (d.sections || []).reduce((a, s) => a + (s.qids || []).length, 0) + ' soru';
  return (d.items || []).length + ' soru';
}

// ---------- Kısa tur ----------
const TOUR = [
  ['marka', 'Önce kurum kimliğinizi hazırlayın: logo, renk, şablon galerisi. Her dosyada kendiliğinden uygulanır.'],
  ['havuz', 'Soru deposu: hazır kimya bankalarını ekleyin, PDF’ten kırpın ya da kendi sorunuzu yazın.'],
  ['test', 'Ne hazırlayacağınızı seçin; sorular depodan gelir, sayfa düzeni A4’e göre kendiliğinden kurulur.'],
];
export function startTour(i = 0) {
  document.querySelectorAll('.tour,.tour-hl').forEach(e => e.classList?.contains('tour') ? e.remove() : e.classList.remove('tour-hl'));
  if (i >= TOUR.length) return;
  const [key, text] = TOUR[i];
  const el = document.querySelector(`[data-tour="${key}"]`); if (!el) return;
  el.scrollIntoView({ block: 'center' }); el.classList.add('tour-hl');
  const r = el.getBoundingClientRect();
  const box = h('div.tour', { style: { left: Math.min(r.left, innerWidth - 340) + 'px', top: (r.bottom + 12 + 160 > innerHeight ? r.top - 150 : r.bottom + 12) + 'px' } },
    h('div', { style: { fontSize: '.8rem', opacity: .7 } }, `${i + 1} / ${TOUR.length}`), h('p', { style: { margin: '6px 0 10px' } }, text),
    h('div.row', h('button.btn.btn-sm', { on: { click: () => startTour(99) } }, 'Kapat'), h('span.spacer'), h('button.btn.btn-sm.btn-accent', { on: { click: () => startTour(i + 1) } }, i + 1 < TOUR.length ? 'Sonraki →' : 'Bitir')));
  document.body.append(box);
}
