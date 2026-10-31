// Sınıf bazlı değerlendirme: konu/kazanım raporu, şube karşılaştırması, soru analizi, öğrenci–konu tablosu
import { h, LETTERS, $ } from '../util.js';
import { getBrand } from '../db.js';
import { ciktiMetni } from '../meb.js';

const yuzde = x => Math.round(x * 100);
const renk = p => p >= 70 ? '#16a34a' : p >= 40 ? '#f59e0b' : '#dc2626';
const durum = p => p >= 70 ? 'Kazanılmış' : p >= 40 ? 'Kısmen' : 'Tekrar edilmeli';
const bar = p => h('div.rp-bar', h('div', { style: { width: Math.max(2, p) + '%', background: renk(p) } }), h('span', '%' + p));
const subeOf = r => (r.sinif || '').trim() || 'Belirtilmemiş';

export function sinifRaporu(ex, allResults) {
  const qs = ex.sections.flatMap(s => s.qs);
  const N = qs.length;
  const subeler = [...new Set(allResults.map(subeOf))].sort((a, b) => a.localeCompare(b, 'tr', { numeric: true }));
  const st = { sube: '', grup: qs.some(q => q.kazanim) ? 'kazanim' : 'konu' };
  const box = h('div');

  const analiz = results => {
    const n = results.length || 1;
    const soru = qs.map((q, i) => {
      const cnt = { A: 0, B: 0, C: 0, D: 0, E: 0, '': 0, X: 0 };
      results.forEach(r => { const a = r.answers[i] || ''; cnt[a in cnt ? a : 'X']++; });
      return { i, q, k: q.answer, cnt, dogru: q.answer ? cnt[q.answer] / n : null, bos: cnt[''] / n };
    });
    const grupKey = q => st.grup === 'kazanim' ? (q.kazanim || q.konu || '(etiketsiz)') : (q.konu || q.kazanim || '(etiketsiz)');
    const gruplar = new Map();
    soru.forEach(s => { if (s.dogru == null) return; const g = grupKey(s.q); if (!gruplar.has(g)) gruplar.set(g, { ad: g, sorular: [], toplam: 0 }); const o = gruplar.get(g); o.sorular.push(s.i + 1); o.toplam += s.dogru; });
    const konular = [...gruplar.values()].map(o => ({ ...o, oran: o.toplam / o.sorular.length })).sort((a, b) => a.oran - b.oran);
    // öğrenci × konu
    const ogr = results.map(r => ({ r, k: konular.map(o => { const idx = o.sorular.map(x => x - 1); const d = idx.filter(i => r.answers[i] && r.answers[i] === qs[i].answer).length; return d / idx.length; }) }));
    return { soru, konular, ogr };
  };

  const draw = () => {
    box.innerHTML = '';
    const results = st.sube ? allResults.filter(r => subeOf(r) === st.sube) : allResults;
    if (!results.length) { box.append(h('p.muted', 'Bu şubede sonuç yok.')); return; }
    const { soru, konular, ogr } = analiz(results);
    const ort = results.reduce((a, r) => a + r.puan, 0) / results.length;
    const netOrt = results.reduce((a, r) => a + r.net, 0) / results.length;

    // Üst özet
    box.append(h('div.rp-ozet',
      ...[['Öğrenci', results.length], ['Ortalama puan', ort.toFixed(1)], ['Ortalama net', netOrt.toFixed(2)], ['En yüksek', Math.max(...results.map(r => r.puan))], ['En düşük', Math.min(...results.map(r => r.puan))],
        ['Başarılı (≥50)', '%' + yuzde(results.filter(r => r.puan >= 50).length / results.length)]].map(([l, v]) => h('div', h('b', String(v)), h('span', l)))));

    // Şube karşılaştırması
    if (!st.sube && subeler.length > 1) {
      const rows = subeler.map(s => { const rs = allResults.filter(r => subeOf(r) === s); const o = rs.reduce((a, r) => a + r.puan, 0) / rs.length; return { s, n: rs.length, o, net: rs.reduce((a, r) => a + r.net, 0) / rs.length }; }).sort((a, b) => b.o - a.o);
      box.append(h('h3.rp-h', 'Şube karşılaştırması'),
        h('table.table', h('tr', ['Şube', 'Öğrenci', 'Ortalama puan', 'Ortalama net', ''].map(t => h('th', t))),
          rows.map((x, i) => h('tr', h('td', h('b', x.s)), h('td', String(x.n)), h('td', x.o.toFixed(1)), h('td', x.net.toFixed(2)), h('td', { style: { minWidth: '160px' } }, bar(Math.round(x.o)), i === 0 ? h('span.chip', '🏆') : null)))));
    }

    // Konu / kazanım raporu
    const zayif = konular.filter(k => yuzde(k.oran) < 40);
    box.append(h('h3.rp-h', st.grup === 'kazanim' ? 'Kazanım bazlı başarı' : 'Konu bazlı başarı'),
      zayif.length ? h('div.rp-uyari', h('b', `Tekrar edilmesi önerilen ${zayif.length} ${st.grup === 'kazanim' ? 'kazanım' : 'konu'}: `), zayif.map(k => k.ad).join(' · ')) : h('div.rp-iyi', 'Sınıfın %40’ın altında kaldığı konu yok.'),
      konular.length ? h('table.table.rp-konu', h('tr', ['', 'Sorular', 'Sınıf başarısı', 'Durum'].map(t => h('th', t))),
        konular.map(k => { const p = yuzde(k.oran); return h('tr', h('td', h('b', k.ad), ciktiMetni(k.ad) ? h('div.small.muted', ciktiMetni(k.ad)) : null), h('td.small', k.sorular.join(', ')), h('td', { style: { minWidth: '170px' } }, bar(p)), h('td', h('span.rp-durum', { style: { color: renk(p), borderColor: renk(p) } }, durum(p)))); })) :
        h('p.muted.small', 'Sorularda konu ya da kazanım bilgisi yok. Soru Deposu’nda soruları etiketlerseniz bu rapor dolar.'));

    // Öğrenci × konu tablosu
    if (konular.length > 1 && konular.length <= 30) {
      box.append(h('h3.rp-h', 'Öğrenci – konu tablosu'),
        h('div', { style: { overflowX: 'auto' } }, h('table.table.rp-isi',
          h('tr', h('th', 'Öğrenci'), ...konular.map((k, i) => h('th', { title: k.ad + (ciktiMetni(k.ad) ? ' — ' + ciktiMetni(k.ad) : '') }, (i + 1) + '')), h('th', 'Puan')),
          ogr.sort((a, b) => b.r.puan - a.r.puan).map(o => h('tr', h('td', o.r.ad), ...o.k.map(v => { const p = yuzde(v); return h('td', { style: { background: renk(p) + '33', color: renk(p), fontWeight: 700, textAlign: 'center' } }, p); }), h('td', h('b', String(o.r.puan))))))),
        h('p.small.muted', 'Sütun numaraları yukarıdaki tablo sırasındaki konulardır: ' + konular.map((k, i) => (i + 1) + ') ' + k.ad).join('  ')));
    }

    // Soru analizi
    const sikSay = Math.max(4, ...qs.map(q => (q.choices || []).filter(Boolean).length), ...qs.map(q => q.answer === 'E' ? 5 : 0), ...results.flatMap(r => r.answers).map(a => a === 'E' ? 5 : 0));
    const harfler = LETTERS.slice(0, sikSay > 4 ? 5 : 4);
    box.append(h('h3.rp-h', 'Soru analizi'),
      h('div', { style: { overflowX: 'auto' } }, h('table.table.rp-soru',
        h('tr', h('th', 'Soru'), h('th', 'Konu'), h('th', 'Cevap'), ...harfler.map(L => h('th', L)), h('th', 'Boş'), h('th', 'Doğru')),
        soru.map(s => h('tr', h('td', h('b', String(s.i + 1))), h('td.small', s.q.konu || s.q.kazanim || ''), h('td', h('b', s.k || '—')),
          ...harfler.map(L => h('td', { style: L === s.k ? { color: '#16a34a', fontWeight: 800 } : s.cnt[L] && s.cnt[L] === Math.max(...harfler.filter(x => x !== s.k).map(x => s.cnt[x])) ? { color: '#dc2626', fontWeight: 700 } : null }, String(s.cnt[L]))),
          h('td', String(s.cnt[''])), h('td', { style: { minWidth: '130px' } }, s.dogru == null ? '—' : bar(yuzde(s.dogru))))))),
      h('p.small.muted', 'Yeşil: doğru şık. Kırmızı: en çok işaretlenen yanlış şık (çeldirici). Doğru oranı %40’ın altındaki sorular yeniden anlatılmaya adaydır.'));
  };

  const subeSel = h('select.inp', { style: { width: 'auto' }, on: { change: e => { st.sube = e.target.value; draw(); } } }, h('option', { value: '' }, 'Tüm şubeler'), subeler.map(s => h('option', { value: s }, s)));
  const grupSeg = h('div.seg', [['kazanim', 'Kazanım'], ['konu', 'Konu']].map(([v, l]) => h('button' + (st.grup === v ? '.on' : ''), { type: 'button', on: { click: e => { st.grup = v; [...grupSeg.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); draw(); } } }, l)));
  draw();
  const yazdir = async () => {
    const brand = await getBrand();
    const root = $('#printRoot'); root.innerHTML = '';
    root.append(h('div.rp-print', { style: { '--acc': brand.renk || '#4f46e5' } }, h('div.rp-print-head', brand.logo ? h('img', { src: brand.logo }) : null, h('div', h('div.small', brand.kurum || ''), h('h2', 'Sınıf Değerlendirme Raporu'), h('div', ex.title + (st.sube ? ' · ' + st.sube : '')))), box.cloneNode(true)));
    let ps = document.getElementById('pageSize'); if (!ps) { ps = h('style#pageSize'); document.head.append(ps); }
    ps.textContent = '@page{size:210mm 297mm;margin:12mm}';
    const done = () => { root.innerHTML = ''; removeEventListener('afterprint', done); }; addEventListener('afterprint', done);
    setTimeout(() => print(), 80);
  };
  return h('div.card.rp', { style: { marginTop: '14px' } },
    h('div.row', h('h3', { style: { margin: 0 } }, '📊 Sınıf değerlendirmesi'), h('span.spacer'), subeler.length > 1 ? subeSel : null, grupSeg, h('button.btn.btn-sm', { on: { click: yazdir } }, '🖨 Raporu yazdır')),
    box);
}
