import { h, ICONS, fmtDate, confirmBox, toast, download, readFileAsText, modal } from '../util.js';
import { db, getBrand } from '../db.js';
import { KINDS } from '../render.js';

const ico = name => h('div.ico', { html: ICONS[name] });

export async function homeView(app) {
  const [brand, docs, qs] = await Promise.all([getBrand(), db.all('documents'), db.all('questions')]);
  const brandReady = !!(brand.kurum || brand.logo || brand.ogretmen);

  const kindCard = (kind, tag) => h('a.card.kind-card', { href: '#/yeni/' + kind },
    ico(kind), h('div', h('h3', KINDS[kind].ad, tag ? h('span.tag', tag) : null), h('p', KINDS[kind].aciklama)), h('span.arrow', '→'));

  app.append(...[
    h('section.hero',
      h('h1', 'Ne oluşturmak ', h('span.hl', 'istiyorsunuz?')),
      h('p.muted', 'Seçtiğiniz türe göre sayfa düzeni, bölümler ve puanlama hazır gelir.')),
    h('div.grid', { style: { marginTop: '18px' } },
      h('a.card.kind-card', { href: '#/marka', style: brandReady ? null : { borderColor: 'var(--orange)' } },
        ico('marka'),
        h('div', h('h3', 'Marka Kimliğini Oluştur', brandReady ? h('span.tag', '✓ HAZIR') : null), h('p', 'Logonuz, renginiz ve iletişiminiz ürettiğiniz her belgede görünsün. Bir kez kurmanız yeterli.')),
        h('span.arrow', '→'))),
    h('div.grid.grid-2', { style: { marginTop: '14px' } },
      kindCard('foy'), kindCard('test'), kindCard('yazili'), kindCard('deneme'), kindCard('banka', 'ÇOK SAYFA')),
    h('div.grid', { style: { marginTop: '14px' } },
      h('a.card.kind-card', { href: '#/havuz' }, ico('havuz'), h('div', h('h3', 'Soru Havuzum', h('span.tag', qs.length + ' SORU')), h('p', 'Kırptığınız soruların havuzu — belge değil, depo')), h('span.arrow', '→')),
      h('a.card.kind-card', { href: '#/sinavlar' }, ico('sinav'), h('div', h('h3', 'Sınavlarım'), h('p', 'Ekrandan sınav, cevap girişiyle yüz yüze sınav, sonuçlar ve karneler')), h('span.arrow', '→'))),
    docs.length ? h('div', h('div.eyebrow', 'Son belgeler'),
      h('div.grid.grid-2', docs.sort((a, b) => b.updated - a.updated).slice(0, 4).map(docCard))) : null,
    h('div.eyebrow', 'Hangi belgeyi seçerseniz seçin'),
    h('div.feature', h('h4', 'Bir kez kurun, her belgede görünsün'), h('p', 'Logonuz, renginiz ve iletişim satırınız beş belgenin hepsinde aynı yerde basılır.')),
    h('div.feature', h('h4', 'Sorularınız birikir'), h('p', 'PDF\'ten kırptığınız sorular havuzda kalır; sonraki testte, denemede, bankada yeniden kullanılır.')),
    h('div.feature', h('h4', 'Çıktı baskıya hazır'), h('p', 'Sayfa sonları, sütunlar ve numaralandırma A4 düzenine göre hesaplanır — kırpılan satır olmaz.')),
    h('div.feature', h('h4', 'İnternet olmadan da çalışır'), h('p', 'Uygulamayı ana ekrana ekleyin; her şey cihazınızda saklanır, çevrimdışıyken de belge hazırlarsınız.')),
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
    try { await db.importAll(JSON.parse(await readFileAsText(f))); toast('Yedek içe aktarıldı'); location.reload(); }
    catch (err) { toast(err.message || 'Dosya okunamadı'); }
  } } });

  app.append(
    h('div.row', { style: { marginBottom: '16px' } },
      h('h1', { style: { margin: 0 } }, 'Belgelerim'), h('span.spacer'),
      h('button.btn', { on: { click: async () => { const data = await db.exportAll(); download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'soruevim-yedek-' + new Date().toISOString().slice(0, 10) + '.json'); } } }, 'Tümünü yedekle'),
      h('button.btn', { on: { click: () => importInp.click() } }, 'Yedeği aç'), importInp,
      h('a.btn.btn-primary', { href: '#/' }, '+ Yeni belge')),
    h('p.muted.small', 'Yedek dosyasını başka bir bilgisayarda açarak okulda başladığınız işi evde bitirebilirsiniz.'),
    list);
}

function countOf(d) {
  if (d.kind === 'foy') return (d.blocks || []).length + ' blok';
  if (d.kind === 'deneme') return (d.sections || []).reduce((a, s) => a + (s.qids || []).length, 0) + ' soru';
  return (d.items || []).length + ' soru';
}
