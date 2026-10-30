import { h, toast, modal, confirmBox, uid, LETTERS, fmtDate, download, shuffle, $ } from '../util.js';
import { db, getBrand } from '../db.js';
import { KINDS, denemeTuru, rich } from '../render.js';

const snap = q => q ? { id: q.id, type: q.type || 'coktan', text: q.text || '', image: q.image || '', images: q.images, tablo: q.tablo, choices: q.choices || [], choiceImgs: q.choiceImgs, answer: q.answer || '', konu: q.konu || '', kazanim: q.kazanim || '', cozum: q.cozum || '' } : { id: uid(), text: '(silinmiş soru)', image: '', choices: [], answer: '' };

export async function createExamFromDoc(doc, qmap) {
  let sections;
  if (doc.kind === 'deneme') sections = doc.sections.map(s => ({ name: s.name, qs: s.qids.map(id => snap(qmap[id])) }));
  else sections = [{ name: '', qs: (doc.items || []).filter(i => i.type !== 'kok').map(i => snap(qmap[i.qid])).filter(q => q.type === 'coktan' || q.type === 'dy') }];
  sections = sections.filter(s => s.qs.length);
  if (!sections.length) { toast('Belgede soru yok'); return null; }
  const missing = sections.flatMap(s => s.qs).filter(q => !q.answer).length;
  if (missing && !await confirmBox(`${missing} sorunun cevabı tanımlı değil; bu sorular puanlanmaz. Devam edilsin mi?`, 'Devam')) return null;
  const ex = { id: uid(), title: doc.title || KINDS[doc.kind].ad, docId: doc.id, kind: 'belge', sections, ceza: doc.kind === 'deneme' ? (denemeTuru(doc.meta?.tur)?.ceza ?? 0) : 0, sik: doc.kind === 'deneme' ? (denemeTuru(doc.meta?.tur)?.sik ?? 5) : 5, karistir: true, created: Date.now() };
  await db.put('exams', ex);
  toast('Sınav oluşturuldu');
  return ex;
}

export const keyOf = ex => ex.sections.flatMap(s => s.qs.map(q => q.answer));

export function score(ex, answers) {
  const key = keyOf(ex);
  let d = 0, y = 0, b = 0;
  key.forEach((k, i) => { const a = answers[i]; if (!k) return; if (!a) b++; else if (a === k) d++; else y++; });
  const net = ex.ceza ? d - y / ex.ceza : d;
  const scored = key.filter(Boolean).length;
  return { d, y, b, net: Math.round(net * 100) / 100, puan: scored ? Math.round(Math.max(0, net) / scored * 1000) / 10 : 0 };
}

// ---------- Liste ----------
export async function examsView(app) {
  const [exams, results, docs] = await Promise.all([db.all('exams'), db.all('results'), db.all('documents')]);
  exams.sort((a, b) => b.created - a.created);
  const usable = docs.filter(d => ['test', 'deneme'].includes(d.kind));

  const fromDoc = () => {
    if (!usable.length) { toast('Önce bir yaprak test ya da deneme hazırlayın'); return; }
    const m = modal('Hangi belgeyle sınav yapılsın?', h('div', { style: { display: 'grid', gap: '8px' } }, usable.sort((a, b) => b.updated - a.updated).map(d => h('button.btn', { style: { justifyContent: 'flex-start' }, on: { click: async () => {
      const qmap = Object.fromEntries((await db.all('questions')).map(q => [q.id, q]));
      m.close(); const ex = await createExamFromDoc(d, qmap); if (ex) location.hash = '#/sinav/' + ex.id;
    } } }, KINDS[d.kind].kisa + ' — ' + (d.title || '')))));
  };
  const keyOnly = () => {
    const title = h('input.inp', { placeholder: 'Ör. 3D Yayınları Deneme 4' });
    const key = h('textarea.inp', { rows: 3, placeholder: 'Cevap anahtarı, ör. ABCDA BCDEA… (boşluk ve tireler yok sayılır)' });
    const ceza = h('select.inp', h('option', { value: '0' }, 'Yanlış doğruyu götürmez'), h('option', { value: '3' }, '3 yanlış 1 doğru (LGS)'), h('option', { value: '4' }, '4 yanlış 1 doğru (YKS)'));
    let m;
    m = modal('Yayınevi kitapçığıyla sınav', h('div', { style: { display: 'grid', gap: '10px' } },
      h('p.small.muted', 'Soruları kâğıttan yaptınız; burada yalnız cevap anahtarını yazın, sonra öğrenci cevaplarını girip puanlayın.'),
      h('label.fld', 'Sınav adı', title), h('label.fld', 'Cevap anahtarı', key), h('label.fld', 'Net hesabı', ceza)),
      { actions: [h('button.btn.btn-primary', { on: { click: async () => {
        const k = key.value.toLocaleUpperCase('tr-TR').replace(/[^A-E]/g, '').split('');
        if (!k.length) { toast('Cevap anahtarı girin'); return; }
        const ex = { id: uid(), title: title.value || 'Kitapçık sınavı', kind: 'anahtar', sections: [{ name: '', qs: k.map(a => ({ id: uid(), answer: a, text: '', choices: [] })) }], ceza: +ceza.value, created: Date.now() };
        await db.put('exams', ex); m.close(); location.hash = '#/sinav/' + ex.id;
      } } }, 'Oluştur')] });
  };

  app.append(
    h('div.row', h('h1', { style: { margin: 0 } }, 'Sınavlarım'), h('span.spacer'),
      h('button.btn', { on: { click: keyOnly } }, 'Kitapçık cevap anahtarıyla'),
      h('button.btn.btn-primary', { on: { click: fromDoc } }, '+ Belgeden sınav')),
    h('p.muted', 'Testi ekrandan çözdürün (tablet, akıllı tahta, okul bilgisayarı) ya da kâğıtla yapıp cevapları girin; sonuçlar ve karneler burada toplanır.'),
    exams.length ? h('div.grid', exams.map(ex => {
      const rs = results.filter(r => r.examId === ex.id);
      const avg = rs.length ? (rs.reduce((a, r) => a + r.puan, 0) / rs.length).toFixed(1) : '—';
      return h('a.card.kind-card', { href: '#/sinav/' + ex.id },
        h('div', { style: { flex: 1 } }, h('h3', ex.title), h('p', `${keyOf(ex).length} soru · ${rs.length} öğrenci · ortalama ${avg} · ${fmtDate(ex.created)}`)),
        h('span.arrow', '→'));
    })) : h('div.card.empty', 'Henüz sınav yok. Bir yaprak test ya da denemeden sınav oluşturun.'));
}

// ---------- Sınav detayı ----------
export async function examDetailView(app, id) {
  const ex = await db.get('exams', id);
  if (!ex) { app.append(h('div.card', 'Sınav bulunamadı.')); return; }
  const results = (await db.all('results')).filter(r => r.examId === id).sort((a, b) => b.puan - a.puan);
  const key = keyOf(ex);
  const N = key.length;

  const entry = () => {
    const name = h('input.inp', { placeholder: 'Adı Soyadı' });
    const no = h('input.inp', { placeholder: 'Numara' });
    const ans = h('textarea.inp', { rows: 3, placeholder: `${N} cevap. Boş için - ya da boşluk yazın. Ör. AB-DC…` });
    const info = h('p.small.muted', '');
    ans.addEventListener('input', () => { info.textContent = parse(ans.value).filter((x, i) => i < N).length + ' / ' + N + ' cevap'; });
    const parse = v => v.toLocaleUpperCase('tr-TR').replace(/[^A-E\-_. ]/g, '').split('').map(c => LETTERS.includes(c) ? c : '');
    let m;
    const saveOne = async (again) => {
      if (!name.value.trim()) { toast('Öğrenci adı gerekli'); return; }
      const a = parse(ans.value).slice(0, N); while (a.length < N) a.push('');
      await db.put('results', { id: uid(), examId: id, ad: name.value.trim(), no: no.value.trim(), answers: a, mod: 'kağıt', ...score(ex, a), created: Date.now() });
      toast(name.value + ' kaydedildi');
      if (again) { name.value = ''; no.value = ''; ans.value = ''; info.textContent = ''; name.focus(); } else { m.close(); location.reload(); }
    };
    m = modal('Kâğıt sınav — cevap girişi', h('div', { style: { display: 'grid', gap: '10px' } }, h('div.row', name, no), ans, info),
      { actions: [h('button.btn', { on: { click: () => { m.close(); location.reload(); } } }, 'Bitir'), h('button.btn', { on: { click: () => saveOne(true) } }, 'Kaydet ve sıradaki'), h('button.btn.btn-primary', { on: { click: () => saveOne(false) } }, 'Kaydet')] });
    setTimeout(() => name.focus(), 50);
  };

  // İstatistik
  const qStats = key.map((k, i) => {
    const cnt = { A: 0, B: 0, C: 0, D: 0, E: 0, '': 0 };
    results.forEach(r => { cnt[r.answers[i] || '']++; });
    const correct = k ? cnt[k] : 0;
    const wrongs = LETTERS.filter(L => L !== k).sort((a, b) => cnt[b] - cnt[a]);
    return { i, k, rate: results.length ? correct / results.length : 0, topWrong: cnt[wrongs[0]] ? wrongs[0] : '' };
  });
  const avg = results.length ? results.reduce((a, r) => a + r.puan, 0) / results.length : 0;
  const hardest = qStats.filter(s => s.k).sort((a, b) => a.rate - b.rate).slice(0, 5);

  const csv = () => {
    const rows = [['Sıra', 'Ad Soyad', 'No', 'Doğru', 'Yanlış', 'Boş', 'Net', 'Puan', 'Mod', ...key.map((_, i) => 'S' + (i + 1))]];
    results.forEach((r, i) => rows.push([i + 1, r.ad, r.no, r.d, r.y, r.b, String(r.net).replace('.', ','), String(r.puan).replace('.', ','), r.mod, ...r.answers]));
    const text = '﻿' + rows.map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
    download(new Blob([text], { type: 'text/csv;charset=utf-8' }), (ex.title || 'sinav') + '-sonuclar.csv');
  };

  app.append(...[
    h('div.row', { style: { marginBottom: '8px' } }, h('a.btn.btn-sm.btn-ghost', { href: '#/sinavlar' }, '← Sınavlarım'), h('h1', { style: { margin: 0, fontSize: '1.4rem' } }, ex.title)),
    h('div.grid.grid-2',
      h('div.card', h('h3', 'Ekrandan sınav'),
        ex.kind === 'anahtar' ? h('p.muted.small', 'Bu sınav yalnız cevap anahtarıyla oluşturuldu; sorular kâğıtta. Cevap girişini kullanın.') :
          h('div', h('p.muted.small', 'Öğrenci bu cihazda adını yazıp testi çözer; cevap anahtarı öğrenciye gösterilmez. Sırayla birden çok öğrenci çözebilir.'),
            h('label.check', { style: { marginBottom: '10px' } }, h('input', { type: 'checkbox', checked: ex.karistir !== false, on: { change: async e => { ex.karistir = e.target.checked; await db.put('exams', ex); } } }), 'Soru sırası her öğrencide farklı olsun'),
            h('a.btn.btn-primary', { href: '#/coz/' + ex.id }, '▶ Sınavı başlat'))),
      h('div.card', h('h3', 'Yüz yüze (kâğıt) sınav'), h('p.muted.small', 'Optik ya da kâğıttaki cevapları yazın; puan ve net otomatik hesaplanır.'),
        h('button.btn', { on: { click: entry } }, '✎ Cevap gir'))),
    h('div.grid.grid-2', { style: { marginTop: '14px' } },
      ex.kind === 'anahtar' ? null : h('div.card', h('h3', '🌐 Online sınav (bağlantıyla)'), h('p.muted.small', 'Sınavı WhatsApp’tan bağlantı olarak gönderin; öğrenciler kendi telefonlarında çözer, sonuç bağlantısını size geri gönderir. Sunucu ya da üyelik gerekmez.'),
        h('div.row', h('button.btn.btn-primary', { on: { click: async () => (await import('./online.js')).shareExamModal(ex) } }, '🔗 Bağlantı oluştur'),
          h('button.btn', { on: { click: async () => (await import('./online.js')).bulkResultImport(() => location.reload()) } }, '📥 Gelen sonuçları yapıştır'))),
      h('div.card', h('h3', '🧾 Optik form'), h('p.muted.small', 'Boş optik formu yazdırın; doldurulan formları telefonla çekip okutun. Yayınevi kitapçıklarıyla da kullanılabilir.'),
        h('div.row', h('button.btn', { on: { click: async () => { const n = +prompt('Kaç kopya yazdırılsın?', '1') || 0; if (n > 0) (await import('./optik.js')).printOptik(ex, Math.min(n, 60)); } } }, '🖨 Boş optik yazdır'),
          h('button.btn.btn-primary', { on: { click: async () => (await import('./optik.js')).optikReaderModal(ex, score, () => location.reload()) } }, '📷 Kameradan oku')))),
    h('div.grid.grid-2', { style: { marginTop: '14px' } },
      h('div.card', h('div.small.muted', 'Öğrenci'), h('div.stat', String(results.length))),
      h('div.card', h('div.small.muted', 'Ortalama puan'), h('div.stat', avg.toFixed(1)))),
    results.length > 1 ? h('div.card', { style: { marginTop: '14px' } }, h('h3', 'Puan dağılımı'), distChart(results)) : null,
    h('div.card', { style: { marginTop: '14px', overflowX: 'auto' } },
      h('div.row', h('h3', { style: { margin: 0 } }, 'Sonuçlar'), h('span.spacer'), results.length ? h('button.btn.btn-sm', { on: { click: () => printAllKarne(ex, results, qStats) } }, '🖨 Tüm karneler') : null, results.length ? h('button.btn.btn-sm', { on: { click: csv } }, 'Excel\'e aktar (CSV)') : null),
      results.length ? h('table.table', h('tr', ['#', 'Ad Soyad', 'No', 'D', 'Y', 'B', 'Net', 'Puan', 'Mod', ''].map(t => h('th', t))),
        results.map((r, i) => h('tr', h('td', String(i + 1)), h('td', r.ad), h('td', r.no || ''), h('td', String(r.d)), h('td', String(r.y)), h('td', String(r.b)), h('td', String(r.net)), h('td', h('b', String(r.puan))), h('td.small.muted', r.mod),
          h('td', h('button.btn.btn-sm', { on: { click: () => karne(ex, r, results, qStats) } }, 'Karne'), ' ',
            h('button.icon-btn', { title: 'Sil', on: { click: async () => { if (await confirmBox(r.ad + ' sonucu silinsin mi?', 'Sil')) { await db.del('results', r.id); location.reload(); } } } }, '✕'))))) :
        h('p.muted', 'Henüz sonuç yok.')),
    results.length ? h('div.card', { style: { marginTop: '14px' } }, h('h3', 'Sınıf raporu — en zor sorular'),
      h('table.table', h('tr', h('th', 'Soru'), h('th', 'Cevap'), h('th', 'Doğru oranı'), h('th', 'En çok işaretlenen yanlış')),
        hardest.map(s => h('tr', h('td', String(s.i + 1)), h('td', s.k), h('td', '%' + Math.round(s.rate * 100)), h('td', s.topWrong || '—'))))) : null,
    h('div.row', { style: { marginTop: '14px' } }, h('span.spacer'), h('button.btn.btn-sm.btn-danger', { on: { click: async () => {
      if (!await confirmBox('Sınav ve bütün sonuçları silinsin mi?', 'Sil')) return;
      for (const r of results) await db.del('results', r.id);
      await db.del('exams', id); location.hash = '#/sinavlar';
    } } }, 'Sınavı sil'))].filter(Boolean));
}

function distChart(results) {
  const bins = Array(10).fill(0); results.forEach(r => bins[Math.min(9, Math.floor((r.puan || 0) / 10))]++);
  const mx = Math.max(...bins, 1);
  return h('div', { style: { display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', padding: '6px 0' } }, bins.map((n, i) => h('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' } },
    h('span.small', n ? String(n) : ''), h('div', { title: `${i * 10}–${i * 10 + 10}: ${n} öğrenci`, style: { width: '100%', height: (n / mx * 100) + '%', minHeight: n ? '4px' : '0', background: 'var(--accent, #2E6DB4)', borderRadius: '4px 4px 0 0' } }), h('span.small.muted', String(i * 10)))));
}

async function printAllKarne(ex, results, qStats) {
  const brand = await getBrand(); const allRes = await db.all('results'); const exams = await db.all('exams');
  const root = $('#printRoot'); root.innerHTML = '';
  for (const r of results) root.append(karneBox(ex, r, results, brand, allRes, exams));
  let ps = document.getElementById('pageSize'); if (!ps) { ps = h('style#pageSize'); document.head.append(ps); }
  ps.textContent = '@page{size:210mm 297mm;margin:0}';
  const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 80);
}

function karneBox(ex, r, all, brand, allRes, exams) {
  const rank = all.indexOf(r) + 1;
  const key = keyOf(ex);
  const byKonu = {};
  ex.sections.flatMap(s => s.qs).forEach((q, i) => { const k = q.konu || q.kazanim; if (!k) return; (byKonu[k] ||= { d: 0, n: 0 }); byKonu[k].n++; if (r.answers[i] === q.answer) byKonu[k].d++; });
  const norm = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
  const exMap = Object.fromEntries(exams.map(e => [e.id, e]));
  const gelisim = allRes.filter(x => exMap[x.examId] && (r.no ? x.no === r.no : norm(x.ad) === norm(r.ad)) && norm(x.ad) === norm(r.ad)).sort((a, b) => a.created - b.created);
  const avg = all.reduce((a, x) => a + x.puan, 0) / all.length;
  return h('div.sheet', { style: { '--acc': brand.renk || '#1B4B7F', boxShadow: 'none' } },
    h('div.pg-in',
      h('div.pg-head', h('div', { style: { display: 'flex', alignItems: 'center', gap: '4mm', borderBottom: '.6mm solid var(--acc)', paddingBottom: '2mm' } }, brand.logo ? h('img', { src: brand.logo, style: { height: '14mm' } }) : null, h('div', h('div', { style: { fontSize: '.85em', color: '#555' } }, brand.kurum || ''), h('div', { style: { fontSize: '1.5em', fontWeight: 800, color: 'var(--acc)' } }, 'Sınav Karnesi'), h('div', ex.title)))),
      h('div', { style: { flex: 1 } },
        h('h2', { style: { margin: '6mm 0 2mm' } }, r.ad + (r.no ? ' · No ' + r.no : '') + (r.sinif ? ' · ' + r.sinif : '')),
        h('table.table', h('tr', ['Doğru', 'Yanlış', 'Boş', 'Net', 'Puan', 'Sıra', 'Sınıf ort.'].map(t => h('th', t))), h('tr', [r.d, r.y, r.b, r.net, r.puan, rank + ' / ' + all.length, avg.toFixed(1)].map(v => h('td', h('b', String(v)))))),
        Object.keys(byKonu).length ? h('div', h('h3', { style: { marginTop: '6mm' } }, 'Konulara göre başarı'), h('table.table', h('tr', h('th', 'Konu / öğrenme çıktısı'), h('th', 'Doğru'), h('th', 'Başarı')), Object.entries(byKonu).map(([k, v]) => { const p = Math.round(v.d / v.n * 100); return h('tr', h('td', k), h('td', v.d + ' / ' + v.n), h('td', h('div', { style: { display: 'flex', alignItems: 'center', gap: '2mm' } }, h('div', { style: { width: '30mm', height: '3mm', background: '#eee', borderRadius: '2mm', overflow: 'hidden' } }, h('div', { style: { width: p + '%', height: '100%', background: p >= 70 ? '#1d8a4e' : p >= 40 ? '#d68b1f' : '#c0392b' } })), '%' + p))); }))) : null,
        gelisim.length > 1 ? h('div', h('h3', { style: { marginTop: '6mm' } }, 'Gelişim'), h('table.table', h('tr', h('th', 'Sınav'), h('th', 'Net'), h('th', 'Puan')), gelisim.slice(-8).map(x => h('tr', x === r ? { style: { fontWeight: 700 } } : null, h('td', exMap[x.examId].title), h('td', String(x.net)), h('td', String(x.puan)))))) : null,
        h('h3', { style: { marginTop: '6mm' } }, 'Soru soru'),
        h('div.key-grid', key.map((k, i) => h('div', h('b', (i + 1) + '.'), h('span', { style: { color: !r.answers[i] ? '#888' : r.answers[i] === k ? 'var(--ok)' : 'var(--bad)' } }, (r.answers[i] || '—') + (k && r.answers[i] !== k ? ' (' + k + ')' : '')))))),
      h('div.pg-foot', { style: { fontSize: '.8em', color: '#666', borderTop: '.3mm solid #ccc', paddingTop: '1.5mm' } }, h('span', [brand.ogretmen, brand.iletisim].filter(Boolean).join(' · ')))));
}

async function karne(ex, r, all, qStats) {
  const brand = await getBrand();
  const box = karneBox(ex, r, all, brand, await db.all('results'), await db.all('exams'));
  const rank = all.indexOf(r) + 1;
  const print = () => { const root = $('#printRoot'); root.innerHTML = ''; root.append(box.cloneNode(true)); const done = () => { root.innerHTML = ''; window.removeEventListener('afterprint', done); }; window.addEventListener('afterprint', done); window.print(); };
  const wa = 'https://wa.me/?text=' + encodeURIComponent(`${r.ad} — ${ex.title}\nDoğru: ${r.d}, Yanlış: ${r.y}, Boş: ${r.b}\nNet: ${r.net}, Puan: ${r.puan}\nSınıf sırası: ${rank}/${all.length}` + (brand.kurum ? '\n' + brand.kurum : ''));
  const wrap = h('div', { style: { overflow: 'auto', background: '#cfc6b4', padding: '12px', borderRadius: '12px' } }, h('div', { style: { transform: 'scale(.62)', transformOrigin: 'top left', width: '794px', height: '700px' } }, box));
  modal('Karne — ' + r.ad, wrap, { wide: true, actions: [h('a.btn', { href: wa, target: '_blank', rel: 'noopener' }, 'WhatsApp ile veliye gönder'), h('button.btn.btn-primary', { on: { click: print } }, 'Yazdır / PDF')] });
}

// ---------- Öğrenci ekranı ----------
export async function solveView(app, id) {
  const ex = await db.get('exams', id);
  if (!ex || ex.kind === 'anahtar') { app.append(h('div.card', 'Bu sınav ekrandan çözülemez.')); return; }
  const brand = await getBrand();
  const flat = ex.sections.flatMap((s, si) => s.qs.map((q, qi) => ({ q, si, idx: null })));
  flat.forEach((x, i) => x.idx = i);

  const start = h('div.solve', h('div.card', { style: { textAlign: 'center' } },
    brand.logo ? h('img', { src: brand.logo, style: { maxHeight: '60px' } }) : null,
    h('h1', ex.title), h('p.muted', flat.length + ' soru'),
    h('div', { style: { display: 'grid', gap: '10px', maxWidth: '360px', margin: '0 auto' } },
      h('input.inp#stuName', { placeholder: 'Adın Soyadın' }), h('input.inp#stuNo', { placeholder: 'Numaran (isteğe bağlı)' }),
      h('button.btn.btn-primary', { on: { click: () => {
        const ad = $('#stuName').value.trim(); if (!ad) { toast('Adını yaz'); return; }
        begin(ad, $('#stuNo').value.trim());
      } } }, 'Başla'))));
  app.append(start);

  function begin(ad, no) {
    const order = ex.karistir !== false ? shuffle(flat, Date.now() & 0xffffff) : flat;
    const answers = Array(flat.length).fill('');
    app.innerHTML = '';
    const prog = h('span.muted');
    const upd = () => { prog.textContent = answers.filter(Boolean).length + ' / ' + flat.length + ' cevaplandı'; };
    const finish = async () => {
      const empty = answers.filter(a => !a).length;
      if (empty && !await confirmBox(`${empty} soru boş. Sınavı bitirmek istiyor musun?`, 'Bitir')) return;
      const s = score(ex, answers);
      await db.put('results', { id: uid(), examId: ex.id, ad, no, answers, mod: 'ekran', ...s, created: Date.now() });
      app.innerHTML = '';
      app.append(h('div.solve', h('div.card', { style: { textAlign: 'center' } },
        h('h1', 'Teşekkürler, ' + ad + '!'), h('p', 'Sınavın kaydedildi.'),
        h('div.row', { style: { justifyContent: 'center', gap: '24px', margin: '16px 0' } },
          h('div', h('div.stat', String(s.d)), h('div.small.muted', 'Doğru')), h('div', h('div.stat', String(s.y)), h('div.small.muted', 'Yanlış')), h('div', h('div.stat', String(s.b)), h('div.small.muted', 'Boş')), h('div', h('div.stat', String(s.puan)), h('div.small.muted', 'Puan'))),
        h('div.row', { style: { justifyContent: 'center' } }, h('a.btn.btn-primary', { href: '#/coz/' + ex.id, on: { click: () => setTimeout(() => location.reload(), 10) } }, 'Sıradaki öğrenci'), h('a.btn', { href: '#/sinav/' + ex.id }, 'Öğretmen paneli')))));
      window.scrollTo(0, 0);
    };
    let lastSec = -1;
    const body = h('div.solve',
      h('div.row', { style: { position: 'sticky', top: '64px', background: 'var(--cream)', padding: '8px 0', zIndex: 5 } }, h('b', ad), prog, h('span.spacer'), h('button.btn.btn-primary', { on: { click: finish } }, 'Sınavı bitir')));
    order.forEach((x, n) => {
      if (ex.karistir === false && x.si !== lastSec && ex.sections[x.si].name) { body.append(h('h3', ex.sections[x.si].name)); lastSec = x.si; }
      const q = x.q;
      const filled = (q.choices || []).filter(c => c && c.trim()).length;
      const nCh = q.answer === 'E' || filled === 5 ? 5 : (ex.ceza === 3 || filled === 4 ? 4 : 5);
      const opts = h('div.opts', LETTERS.slice(0, nCh).map(L => h('button', { on: { click: e => {
        answers[x.idx] = answers[x.idx] === L ? '' : L;
        [...opts.children].forEach(b => b.classList.toggle('on', b.textContent === answers[x.idx]));
        upd();
      } } }, L)));
      body.append(h('div.solve-q',
        h('b', (n + 1) + '. '),
        q.text ? h('div.q-text', { style: { whiteSpace: 'pre-wrap', display: 'inline' }, html: rich(q.text) }) : null,
        ...(q.tablo || []).map(tb => h('table.table', { style: { margin: '8px 0', width: 'auto' } }, tb.map(r => h('tr', r.map(c => h('td', { html: rich(c) })))))),
        q.image ? h('img', { src: q.image, alt: '' }) : null,
        (q.choices || []).some(c => c && c.trim()) ? h('div', { style: { marginTop: '8px', display: 'grid', gap: '4px' } }, q.choices.map((c, i) => c && c.trim() ? h('div', h('b', LETTERS[i] + ') '), h('span', { html: rich(c) })) : null)) : null,
        opts));
    });
    body.append(h('div.row', { style: { justifyContent: 'center', margin: '20px 0' } }, h('button.btn.btn-primary', { on: { click: finish } }, 'Sınavı bitir')));
    app.append(body); upd(); window.scrollTo(0, 0);
  }
}
