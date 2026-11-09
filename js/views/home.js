import { h, ICONS, fmtDate, confirmBox, toast, download, readFileAsText, modal } from '../util.js';
import { db, getBrand } from '../db.js';
import { KINDS, kindInfo } from '../render.js';
import { brans, bransSecici } from '../brans.js';
import { iletisimAc } from '../iletisim.js';
import { dinle, baglan, baglantiyiKes, simdiEsitle, hazirMi } from '../bulut.js';

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
        h('div', h('h3', 'Sayfanızı Tasarlayın', brandReady ? h('span.tag', '✓ HAZIR') : null), h('p', 'Şablon, renk, logo ve kurum bilgileriniz ürettiğiniz her belgede görünsün. Bir kez kurmanız yeterli.')),
        h('span.arrow', '→'))),
    h('div.grid.grid-2', { style: { marginTop: '14px' } },
      kindCard('test'), kindCard('tarama'), kindCard('yazili'), kindCard('deneme'), kindCard('foy'), kindCard('banka', 'ÇOK SAYFA')),
    h('div.grid', { style: { marginTop: '14px' } },
      h('a.card.kind-card', { href: '#/havuz', 'data-tour': 'havuz' }, ico('havuz'), h('div', h('h3', 'Soru Deposu', h('span.tag', qs.length + ' SORU')), h('p', 'Kırptığınız ve yazdığınız bütün sorular burada birikir')), h('span.arrow', '→'))),
    docs.length ? h('div', h('div.eyebrow', 'Son belgeler'),
      h('div.grid.grid-2', docs.sort((a, b) => b.updated - a.updated).slice(0, 4).map(docCard))) : null,
    await yedekHatirlat(qs),
    bulutKart(),
    h('div.row', { style: { marginTop: '28px', justifyContent: 'center', gap: '8px' } }, h('span.muted', '🎓 Branş: '), h('b', brans()?.ad || '—'),
      h('button.btn.btn-sm.btn-ghost', { on: { click: async () => { if (await bransSecici()) location.reload(); } } }, 'Değiştir')),
    window.__soruevim ? h('div.row.home-foot', { 'data-tour': 'alt', style: { marginTop: '12px', justifyContent: 'center', gap: '10px' } },
      window.__soruevim.themeSeg(),
      h('button.btn.btn-sm.btn-ghost', { on: { click: window.__soruevim.openFile } }, '📂 Dosyadan aç'),
      h('button.btn.btn-sm.btn-ghost', { title: 'Sorularınız ve belgeleriniz silinmez', on: { click: window.__soruevim.forceUpdate } }, '🔄 Uygulamayı güncelle'),
      h('button.btn.btn-sm.btn-ghost', { on: { click: window.__soruevim.tour } }, '🧭 Tanıtım turu'),
      h('button.btn.btn-sm.btn-ghost', { on: { click: iletisimAc } }, '💬 Bize yazın')) : null,
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

// ---------- Tanıtım turu (sayfalar arasında gezer) ----------
const TOUR = [
  { yol: '#/', baslik: 'Soru Evim’e hoş geldiniz 👋', metin: 'Bu kısa turda uygulamanın bütün bölümlerini tek tek göstereceğim. İstediğiniz an “Kapat” diyebilir, sonra ana sayfanın altındaki “🧭 Tanıtım turu” ile yeniden başlatabilirsiniz.' },
  { yol: '#/', sec: '[data-tour="marka"]', baslik: '1. Sayfanızı tasarlayın', metin: 'İlk iş burası (üst menüde “Tasarım”). Okulunuzun adı, logonuz, renginiz ve sayfa şablonunuz bir kez ayarlanır; hazırladığınız her test, yazılı ve föyde kendiliğinden kullanılır.' },
  { yol: '#/', sec: '[data-tour="test"]', baslik: 'Test', metin: 'Tek bir kazanım ya da alt çıktı için çoktan seçmeli test. Kolay/orta/zor yüzdesini verirsiniz, sorular depodan otomatik gelir ya da kendiniz seçersiniz.' },
  { yol: '#/', sec: '[data-tour="tarama"]', baslik: 'Tarama testi', metin: 'Birden fazla kazanımı birlikte yoklayan test. Kazanımları işaretlersiniz, sorular kazanımlara dengeli dağıtılır.' },
  { yol: '#/', sec: '[data-tour="yazili"]', baslik: 'Dönem yazılısı', metin: 'Dönem ve sınavı seçersiniz; MEB senaryosu hazır gelir. Kazanım, soru sayısı, puan ve zorluğu değiştirebilir, kendi senaryonuz olarak saklayabilirsiniz. Sona cevap anahtarı ve puanlama rehberi eklenir.' },
  { yol: '#/', sec: '[data-tour="deneme"]', baslik: 'Deneme', metin: 'TYT, AYT, LGS ya da serbest deneme. Bölümler depodaki sorularla, her kazanımdan en çok kaç soru geleceğine göre dolar.' },
  { yol: '#/', sec: '[data-tour="foy"]', baslik: 'Föy', metin: 'Konu anlatımlı çalışma kâğıdı: başlık, anlatım, NOT/DİKKAT kutuları, örnek ve “Şimdi sen” soruları.' },
  { yol: '#/', sec: '[data-tour="banka"]', baslik: 'Soru bankası', metin: 'Çok sayfalı kitapçık: kapak, içindekiler, konu başlıkları ve cevap anahtarıyla.' },
  { yol: '#/', sec: '[data-tour="havuz"]', baslik: 'Soru Deposu', metin: 'Bütün sorularınız burada birikir. Birazdan içini gezeceğiz.' },
  { yol: '#/', sec: '[data-tour="bulut"]', baslik: 'Google Drive ile eşitleme', metin: 'İsteğe bağlı. Bağlanırsanız sorularınız ve belgeleriniz kendi Drive’ınızda saklanır; telefon ve bilgisayarda aynı depoyu kullanırsınız. Bağlanmazsanız her şey yalnızca bu cihazda kalır.' },
  { yol: '#/', sec: '[data-tour="alt"]', baslik: 'Alt düğmeler', metin: 'Açık/koyu tema, dosyadan belge açma, uygulamayı güncelleme ve bu turu yeniden başlatma burada. Branşınızı da hemen üstünden değiştirebilirsiniz.' },
  { yol: '#/', sec: '#iletisimBtn', baslik: 'Bize yazın', metin: 'Bir hata gördünüz ya da bir özellik mi istiyorsunuz? Buradan yazın; mesajınız doğrudan geliştiriciye ulaşır.' },
  { yol: '#/marka', sec: '[data-tour="sablon"]', baslik: 'Tasarım · Şablon Galerisi', metin: 'Onlarca hazır sayfa tasarımı. Birine tıklayın, sağdaki örnek kâğıt hemen değişir. Beğenmezseniz “Geri al”.' },
  { yol: '#/marka', sec: '[data-tour="renk"]', baslik: 'Renk paleti', metin: 'Seçtiğiniz şablonun rengini buradan değiştirin. Ana renk başlığı ve numaraları, ikinci renk NOT/DİKKAT kutularını boyar.' },
  { yol: '#/marka', sec: '[data-tour="ozel"]', baslik: 'Özel Ayarlar', metin: 'Okul adı, öğretmen adı, logo, imza, damga, başlık ve numara tasarımlarını tek tek ayarlamak için burası.' },
  { yol: '#/havuz', sec: '[data-tour="kirp"]', baslik: 'PDF / görselden kırp', metin: 'Kitabın ya da sınavın PDF’ini açın, soruları fareyle çerçeveleyip depoya ekleyin. Ekran görüntüsünü Ctrl+V ile de yapıştırabilirsiniz.' },
  { yol: '#/havuz', sec: '[data-tour="yaz"]', baslik: 'Soru yaz', metin: 'Kendi sorunuzu yazın: şıklar, cevap, zorluk, kazanım. Açık uçlu sorularda beklenen cevap ve puanlama ölçütü de girilir.' },
  { yol: '#/havuz', sec: '[data-tour="hazir"]', baslik: 'Hazır soru bankaları', metin: 'Branşınıza ait hazır soru paketlerini tek tıkla deponuza ekleyin.' },
  { yol: '#/havuz', sec: '[data-tour="filtre"]', baslik: 'Süzgeçler', metin: 'Sınıf, kazanım, zorluk, tip ya da “hiç kullanılmamış” sorulara göre süzün. Bir belgede kullanılmış sorularda turuncu “📄 kullanıldı” etiketi görünür.' },
  { yol: '#/havuz', sec: '[data-tour="rapor"]', baslik: 'Kazanım raporu', metin: 'Hangi kazanımda kaç kolay, orta, zor sorunuz olduğunu gösterir. Eksik kazanımlar kırmızı ve turuncu işaretlenir; hangi konuya soru eklemeniz gerektiğini görürsünüz.' },
  { yol: '#/havuz', sec: '[data-tour="paylasAl"]', baslik: 'Zümre paylaşımı', metin: 'Soruları kutucuklarından seçip “📤 Zümreyle paylaş” deyin; inen dosyayı meslektaşınıza gönderin. O da bu düğmeyle kendi deposuna ekler.' },
  { yol: '#/yeni/yazili', sec: '[data-tour="kaynakDepo"]', baslik: 'Yazılı hazırlamak', metin: 'Test, tarama, deneme ve yazılıda önce soruların nereden geleceğini seçersiniz: Soru Deposu’ndan…' },
  { yol: '#/yeni/yazili', sec: '[data-tour="kaynakKirp"]', baslik: '…ya da kırparak', metin: 'Boş kâğıt açılır ve kırpma penceresi gelir; soruları doğrudan PDF’ten kırparak dizersiniz.' },
  { yol: '#/yeni/yazili', once: () => document.querySelector('[data-tour="kaynakDepo"]')?.click(), sec: '[data-tour="yz-secim"]', baslik: 'Sınıf · ders · dönem · sınav', metin: 'Hepsi seçimle. Ders, başta seçtiğiniz branşa göre gelir.' },
  { yol: '#/yeni/yazili', sec: '[data-tour="yz-senaryo"]', baslik: 'Senaryo ve seçim şekli', metin: 'MEB senaryoları, kendi kaydettikleriniz ya da “Kendim seçeceğim”. Sorular otomatik gelsin mi, yoksa her kazanım için listeden siz mi seçeceksiniz?' },
  { yol: '#/yeni/yazili', sec: '[data-tour="yz-zorluk"]', baslik: 'Zorluk dağılımı', metin: 'Kolay %30 · orta %50 · zor %20 önerilir. Aynı kazanımdan iki soru varsa ikisi aynı zorlukta olmaz.' },
  { yol: '#/yeni/yazili', sec: '[data-tour="yz-tablo"]', baslik: 'Kazanım tablosu', metin: 'Kazanımları işaretleyin; her birine soru sayısı ve isterseniz soru başına puan verin. “Depoda kaç soru var” da yanında yazar.' },
  { yol: '#/yeni/yazili', sec: '[data-tour="yz-kaydet"]', baslik: 'Kaydet ve yerleştir', metin: 'Tabloyu kendi senaryonuz olarak saklayın ya da paylaşın. “Soruları yerleştir” deyince kâğıt hazır olur; sağdan tasarımı, puanları, kitapçık türünü düzenleyip “Yazdır / PDF” ya da “İndir → Word” ile alırsınız.' },
  { yol: '#/', baslik: 'Hepsi bu kadar 🎉', metin: 'İlk adım olarak “Sayfanızı Tasarlayın”a girip okulunuzu ve şablonunuzu seçin, sonra Soru Deposu’na birkaç soru ekleyin. Takıldığınız yerde “💬 Bize yazın”.' },
];
let turNo = 0;
const bekle = ms => new Promise(r => setTimeout(r, ms));
async function ogeBul(sec) { for (let k = 0; k < 30; k++) { const el = document.querySelector(sec); if (el && el.getBoundingClientRect().width) return el; await bekle(100); } return null; }
export async function startTour(i = 0) {
  const benim = ++turNo;
  document.querySelectorAll('.tour,.tour-bg').forEach(e => e.remove()); document.querySelectorAll('.tour-hl').forEach(e => e.classList.remove('tour-hl'));
  if (i < 0 || i >= TOUR.length) { document.removeEventListener('keydown', turTus); return; }
  const a = TOUR[i];
  if (location.hash !== a.yol && !(a.yol === '#/' && (location.hash === '' || location.hash === '#'))) { location.hash = a.yol; await bekle(500); }
  if (a.once) { a.once(); await bekle(500); }
  if (benim !== turNo) return;
  const el = a.sec ? await ogeBul(a.sec) : null;
  if (benim !== turNo) return;
  if (a.sec && !el) return startTour(i + 1);
  const gen = Math.min(340, innerWidth - 24);
  const box = h('div.tour', { style: { width: gen + 'px', maxWidth: gen + 'px' } },
    h('div', { style: { fontSize: '.78rem', opacity: .7 } }, `${i + 1} / ${TOUR.length}`),
    h('b', { style: { display: 'block', marginTop: '4px', fontSize: '1.02rem' } }, a.baslik),
    h('p', { style: { margin: '6px 0 12px', lineHeight: 1.45 } }, a.metin),
    h('div.row', { style: { gap: '6px' } },
      h('button.btn.btn-sm', { on: { click: () => startTour(-1) } }, 'Kapat'), h('span.spacer'),
      i > 0 ? h('button.btn.btn-sm', { on: { click: () => startTour(i - 1) } }, '← Geri') : null,
      h('button.btn.btn-sm.btn-accent', { on: { click: () => startTour(i + 1) } }, i + 1 < TOUR.length ? 'Sonraki →' : 'Bitir')));
  if (el) {
    el.scrollIntoView({ block: 'center' }); await bekle(250); el.classList.add('tour-hl');
    const r = el.getBoundingClientRect();
    document.body.append(box);
    const bh = box.offsetHeight;
    const alt = r.bottom + 12 + bh < innerHeight, ust = r.top - 12 - bh > 0;
    box.style.left = Math.max(12, Math.min(r.left, innerWidth - gen - 12)) + 'px';
    box.style.top = (alt ? r.bottom + 12 : ust ? r.top - 12 - bh : Math.max(12, innerHeight - bh - 12)) + 'px';
  } else {
    document.body.append(h('div.tour-bg'), box);
    box.style.left = (innerWidth - gen) / 2 + 'px'; box.style.top = Math.max(20, innerHeight / 2 - box.offsetHeight / 2) + 'px';
  }
  turAktif = i; document.addEventListener('keydown', turTus);
}
let turAktif = 0;
function turTus(e) { if (!document.querySelector('.tour')) return; if (e.key === 'Escape') startTour(-1); else if (e.key === 'ArrowRight') startTour(turAktif + 1); else if (e.key === 'ArrowLeft' && turAktif > 0) startTour(turAktif - 1); }

// Drive'a bağlı değilse ayda bir yedek hatırlatması
async function yedekHatirlat(qs) {
  const GUN = 864e5, simdi = Date.now();
  if (await db.kvGet('bulutBagli')) return null;
  let ilk = await db.kvGet('ilkKullanim'); if (!ilk) { ilk = simdi; await db.kvSet('ilkKullanim', ilk); }
  const kendi = qs.filter(q => !q.hazir).length;
  const son = (await db.kvGet('sonYedek')) || ilk, ertele = (await db.kvGet('yedekErtele')) || 0;
  if (kendi < 10 || simdi - son < 30 * GUN || simdi < ertele) return null;
  const gun = Math.floor((simdi - son) / GUN);
  const kart = h('div.card', { style: { marginTop: '18px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', borderColor: 'var(--orange)' } },
    h('div', { style: { fontSize: '1.8rem' } }, '💾'),
    h('div', { style: { flex: '1 1 260px' } }, h('b', 'Yedek alma zamanı'),
      h('div.small.muted', `${kendi} kendi sorunuz ve belgeleriniz yalnızca bu tarayıcıda duruyor` + (gun < 3650 ? ` (son yedekten bu yana ${gun} gün geçti)` : '') + '. Tarayıcı verileri silinirse kaybolabilir. Bir yedek dosyası indirin ya da Google Drive ile eşitlemeyi açın.')),
    h('div.row', { style: { gap: '6px' } },
      h('button.btn.btn-primary', { on: { click: async () => { const data = await db.exportAll(); download(new Blob([JSON.stringify(data)], { type: 'application/json' }), 'soruevim-yedek-' + new Date().toISOString().slice(0, 10) + '.json'); toast('Yedek indirildi'); kart.remove(); } } }, '💾 Yedeği indir'),
      h('button.btn.btn-ghost', { on: { click: async () => { await db.kvSet('yedekErtele', simdi + 7 * GUN); kart.remove(); } } }, 'Bir hafta sonra hatırlat')));
  return kart;
}

// Google Drive eşitleme kartı
function bulutKart() {
  const kart = h('div.card', { 'data-tour': 'bulut', style: { marginTop: '18px', display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' } });
  const saat = t => t ? new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
  const ciz = d => {
    kart.innerHTML = '';
    kart.append(h('div', { style: { fontSize: '1.8rem' } }, '☁️'),
      h('div', { style: { flex: '1 1 260px' } },
        h('b', d.bagli ? 'Google Drive ile eşitleniyor' : 'Google Drive ile eşitle', d.bagli && d.eposta ? h('span.small.muted', ' · ' + d.eposta) : null),
        h('div.small.muted', d.bagli
          ? (d.calisiyor ? 'Eşitleniyor…' : d.hata ? '⚠ ' + d.hata : 'Son eşitleme: ' + saat(d.son))
          : 'İsteğe bağlı. Sorularınız ve belgeleriniz kendi Google Drive’ınızda saklanır; telefon ve bilgisayarda aynı depoyu kullanırsınız. Giriş yapmazsanız her şey yalnızca bu cihazda kalır.')),
      d.bagli
        ? h('div.row', { style: { gap: '6px' } },
            h('button.btn.btn-sm', { disabled: d.calisiyor, on: { click: () => simdiEsitle({ sessiz: false }) } }, d.hata ? '🔑 Yeniden bağlan' : '🔄 Şimdi eşitle'),
            h('button.btn.btn-sm.btn-ghost', { on: { click: () => baglantiyiKes() } }, 'Bağlantıyı kes'))
        : h('button.btn.btn-primary', { disabled: d.calisiyor || !hazirMi(), title: hazirMi() ? '' : 'Yakında', on: { click: () => baglan() } }, d.calisiyor ? 'Bağlanıyor…' : 'Google ile bağlan'));
  };
  const kapat = dinle(ciz);
  setTimeout(() => { const t = setInterval(() => { if (!kart.isConnected) { kapat(); clearInterval(t); } }, 5000); }, 1000);
  return kart;
}
