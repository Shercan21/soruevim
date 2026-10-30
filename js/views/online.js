// Sunucusuz online sınav: sınav bağlantının içinde gider, sonuç bağlantıyla (WhatsApp) geri gelir.
import { h, toast, modal, confirmBox, uid, LETTERS, download, shuffle, loadImg, readFileAsText } from '../util.js';
import { db, getBrand } from '../db.js';
import { rich, setKatex } from '../render.js';
import { loadQR, loadKatex } from '../design.js';
import { score } from './exams.js';

// ---------- sıkıştırma ----------
const b64u = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
async function pipe(bytes, Stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer()); }
export async function pack(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') return '1' + b64u(await pipe(raw, CompressionStream));
  return '0' + b64u(raw);
}
export async function unpack(str) {
  str = decodeURIComponent(str.trim());
  const kind = str[0], bytes = unb64u(str.slice(1));
  const raw = kind === '1' ? await pipe(bytes, DecompressionStream) : bytes;
  return JSON.parse(new TextDecoder().decode(raw));
}
const baseUrl = () => location.href.split('#')[0];

async function smallImg(src, maxW = 640) {
  if (!src) return '';
  try {
    const im = await loadImg(src); const k = Math.min(1, maxW / im.width);
    const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    const w = c.toDataURL('image/webp', 0.55); return w.startsWith('data:image/webp') ? w : c.toDataURL('image/jpeg', 0.6);
  } catch { return src; }
}

// Öğretmen: sınav paketi (cevap anahtarı İÇERMEZ)
export async function buildPayload(ex, { sure = 0, wa = '', karistir = true, sinif = '' } = {}) {
  const brand = await getBrand();
  const sections = [];
  for (const s of ex.sections) {
    const qs = [];
    for (const q of s.qs) {
      const imgs = q.images?.length ? q.images : q.image ? [q.image] : [];
      qs.push({ y: q.type === 'dy' ? 'dy' : undefined, t: q.text || '', c: (q.choices || []).map(c => c || ''), ci: q.choiceImgs?.some(Boolean) ? await Promise.all(q.choiceImgs.map(x => smallImg(x, 300))) : undefined, i: imgs.length ? await Promise.all(imgs.map(x => smallImg(x))) : undefined, tb: q.tablo?.length ? q.tablo : undefined, n: q.answer === 'E' || (q.choices || []).filter(x => x && x.trim()).length === 5 ? 5 : undefined });
    }
    sections.push({ a: s.name || '', q: qs });
  }
  return { v: 1, id: ex.id, t: ex.title, k: brand.kurum || '', o: brand.ogretmen || '', l: brand.logo ? await smallImg(brand.logo, 160) : '', d: +sure || 0, w: String(wa || '').replace(/\D/g, ''), m: karistir ? 1 : 0, sik: ex.sik || 5, sn: sinif, s: sections };
}

export async function qrImg(text, size = 4) {
  const QR = await loadQR(); if (!QR) return null;
  try { const q = QR(0, 'L'); q.addData(text); q.make(); return h('img', { src: q.createDataURL(size, 2), alt: 'Karekod', style: { imageRendering: 'pixelated', maxWidth: '240px' } }); } catch { return null; }
}

export async function shareExamModal(ex) {
  const sure = h('input.inp', { type: 'number', min: 0, value: ex.online?.sure ?? 40, style: { width: '90px' } });
  const wa = h('input.inp', { placeholder: '05xx xxx xx xx', value: ex.online?.wa || '' });
  const sinif = h('input.inp', { placeholder: 'Ör. 9-A', value: ex.online?.sinif || '' });
  const mix = h('input', { type: 'checkbox', checked: ex.online?.karistir ?? true });
  const out = h('div', { style: { display: 'grid', gap: '10px' } });
  const make = async () => {
    ex.online = { sure: +sure.value || 0, wa: wa.value, sinif: sinif.value, karistir: mix.checked };
    await db.put('exams', ex);
    out.innerHTML = ''; out.append(h('p.small.muted', 'Hazırlanıyor…'));
    const payload = await buildPayload(ex, ex.online);
    const code = await pack(payload);
    const link = baseUrl() + '#/online/' + code;
    out.innerHTML = '';
    const kb = Math.round(link.length / 1024);
    const msg = `${ex.title} sınavı${payload.d ? ' (' + payload.d + ' dk)' : ''}. Bağlantıya dokunup adını yaz ve çöz; bitince sonucu bana WhatsApp'tan gönder:\n`;
    const fileBtn = h('button.btn', { on: { click: () => { download(new Blob([JSON.stringify({ app: 'soruevim', tip: 'online', kod: code })], { type: 'application/json' }), (ex.title || 'sinav').replace(/[\\/:*?"<>|]/g, '') + '.soruevim'); toast('Sınav dosyası indirildi'); } } }, '⬇ Sınav dosyası (.soruevim)');
    if (link.length < 60000) {
      const linkInp = h('textarea.inp', { rows: 3, readOnly: true }, link);
      out.append(h('p.small', `Bağlantı hazır (${kb} KB). Öğrenciler internet olmadan da çözebilir; sonuçlarını size bağlantı olarak gönderirler.`), linkInp,
        h('div.row', h('button.btn.btn-primary', { on: { click: async () => { await navigator.clipboard?.writeText(link); toast('Bağlantı kopyalandı'); } } }, '📋 Kopyala'),
          h('a.btn', { href: 'https://wa.me/?text=' + encodeURIComponent(msg + link), target: '_blank', rel: 'noopener' }, '🟢 WhatsApp’ta paylaş'),
          navigator.share ? h('button.btn', { on: { click: () => navigator.share({ title: ex.title, text: msg, url: link }).catch(() => { }) } }, '↗ Paylaş') : null, fileBtn));
      if (link.length < 2300) { const q = await qrImg(link, 3); if (q) out.append(h('div', { style: { textAlign: 'center' } }, q, h('div.small.muted', 'Tahtaya yansıtıp okutabilirsiniz'))); }
      else out.append(h('p.small.muted', 'Görselli sınavlarda bağlantı uzun olduğu için karekod gösterilmiyor.'));
    } else {
      out.append(h('p.small', `Sınav çok görselli (${kb} KB); bağlantı yerine dosya gönderin. Öğrenci dosyayı WhatsApp’tan indirir, “${baseUrl()}#/online/dosya” adresinde açar.`),
        h('div.row', fileBtn, h('a.btn', { href: 'https://wa.me/?text=' + encodeURIComponent(msg + baseUrl() + '#/online/dosya'), target: '_blank', rel: 'noopener' }, '🟢 Açma bağlantısını gönder')));
    }
  };
  modal('Online sınav — bağlantıyla gönder', h('div', { style: { display: 'grid', gap: '10px' } },
    h('p.small.muted', 'Sınav bağlantının içine gömülür; sunucu ya da üyelik gerekmez. Cevap anahtarı bağlantıda yoktur, puanlama sizin cihazınızda yapılır.'),
    h('div.row', h('label.fld', 'Süre (dk, 0 = süresiz)', sure), h('label.fld', 'Sınıf', sinif)),
    h('label.fld', 'Sonuçların geleceği WhatsApp numaranız (isteğe bağlı)', wa),
    h('label.check', mix, 'Soru sırası her öğrencide farklı olsun'),
    h('button.btn.btn-primary', { on: { click: make } }, 'Bağlantıyı oluştur'), out), { wide: true });
}

// ---------- Öğrenci ekranı ----------
export async function onlineSolveView(app, param) {
  document.body.classList.add('student-mode');
  let P;
  if (param === 'dosya') {
    const inp = h('input', { type: 'file', accept: '.soruevim,application/json', on: { change: async e => { try { const j = JSON.parse(await readFileAsText(e.target.files[0])); if (j.tip !== 'online') throw 0; location.hash = '#/online/' + j.kod; } catch { toast('Bu bir sınav dosyası değil'); } } } });
    app.append(h('div.solve', h('div.card', { style: { textAlign: 'center' } }, h('h1', 'Sınav dosyasını aç'), h('p.muted', 'Öğretmeninizin gönderdiği .soruevim dosyasını seçin.'), inp)));
    return;
  }
  try { P = await unpack(param); } catch (e) { app.append(h('div.solve', h('div.card', h('h2', 'Bağlantı açılamadı'), h('p.muted', 'Bağlantı eksik kopyalanmış olabilir. Öğretmeninizden yeniden isteyin.')))); return; }
  if (JSON.stringify(P).includes('$')) { try { setKatex(await loadKatex()); } catch { } }
  const flat = P.s.flatMap((s, si) => s.q.map(q => ({ q, si })));
  flat.forEach((x, i) => x.idx = i);
  const saveKey = 'online:' + P.id;
  let st = null; try { st = JSON.parse(localStorage.getItem(saveKey) || 'null'); } catch { }
  if (st?.bitti) return doneScreen(st);

  const name = h('input.inp', { placeholder: 'Adın Soyadın', value: st?.ad || '' });
  const no = h('input.inp', { placeholder: 'Numaran', value: st?.no || '' });
  const sn = h('input.inp', { placeholder: 'Sınıfın', value: st?.sn || P.sn || '' });
  app.append(h('div.solve', h('div.card', { style: { textAlign: 'center' } },
    P.l ? h('img', { src: P.l, style: { maxHeight: '60px' } }) : null,
    P.k ? h('div.muted', P.k) : null,
    h('h1', P.t), h('p.muted', `${flat.length} soru${P.d ? ' · ' + P.d + ' dakika' : ''}${P.o ? ' · ' + P.o : ''}`),
    h('div', { style: { display: 'grid', gap: '10px', maxWidth: '360px', margin: '0 auto' } }, name, h('div.row', no, sn),
      h('button.btn.btn-primary', { on: { click: () => { if (!name.value.trim()) { toast('Adını yaz'); return; } begin(); } } }, st ? 'Kaldığın yerden devam et' : 'Başla'),
      h('p.small.muted', 'İnternet kesilse de çözmeye devam edebilirsin; cevapların bu cihazda saklanır.')))));

  function begin() {
    st ||= { ad: '', no: '', sn: '', answers: Array(flat.length).fill(''), start: Date.now(), seed: Date.now() & 0xffffff };
    Object.assign(st, { ad: name.value.trim(), no: no.value.trim(), sn: sn.value.trim() });
    const persist = () => localStorage.setItem(saveKey, JSON.stringify(st));
    persist();
    const order = P.m ? shuffle(flat, st.seed) : flat;
    app.innerHTML = '';
    const prog = h('span.muted'), clock = h('b.board-time', { hidden: !P.d, style: { fontSize: '1.1rem', color: '#fff' } });
    const upd = () => { prog.textContent = st.answers.filter(Boolean).length + ' / ' + flat.length; };
    let timer;
    const finish = async (force) => {
      const empty = st.answers.filter(a => !a).length;
      if (!force && empty && !await confirmBox(`${empty} soru boş. Bitirmek istiyor musun?`, 'Bitir')) return;
      clearInterval(timer);
      st.bitti = true; st.end = Date.now(); persist();
      doneScreen(st);
    };
    if (P.d) {
      const tick = () => { const left = Math.round((st.start + P.d * 60000 - Date.now()) / 1000); if (left <= 0) { clock.textContent = '0:00'; toast('Süre bitti'); finish(true); return; } clock.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
      tick(); timer = setInterval(tick, 1000);
    }
    const body = h('div.solve', h('div.row', { style: { position: 'sticky', top: '0', background: 'var(--cream)', padding: '8px 0', zIndex: 5 } }, h('b', st.ad), prog, clock, h('span.spacer'), h('button.btn.btn-primary', { on: { click: () => finish() } }, 'Bitir')));
    let lastSec = -1;
    order.forEach((x, n) => {
      if (!P.m && x.si !== lastSec && P.s[x.si].a) { body.append(h('h3', P.s[x.si].a)); lastSec = x.si; }
      const q = x.q;
      const isDy = q.y === 'dy';
      const filled = q.c.filter(c => c && c.trim()).length;
      const nCh = isDy ? 0 : q.n || (P.sik === 4 || filled === 4 ? 4 : 5);
      const labels = isDy ? [['D', 'Doğru'], ['Y', 'Yanlış']] : LETTERS.slice(0, nCh).map(L => [L, L]);
      const opts = h('div.opts', labels.map(([v, l]) => h('button' + (st.answers[x.idx] === v ? '.on' : ''), { 'data-v': v, on: { click: () => { st.answers[x.idx] = st.answers[x.idx] === v ? '' : v; [...opts.children].forEach(b => b.classList.toggle('on', b.dataset.v === st.answers[x.idx])); persist(); upd(); } } }, l)));
      body.append(h('div.solve-q',
        h('b', (n + 1) + '. '),
        q.t ? h('div.q-text', { style: { whiteSpace: 'pre-wrap', display: 'inline' }, html: rich(q.t) }) : null,
        ...(q.tb || []).map(tb => h('table.table', { style: { margin: '8px 0', width: 'auto' } }, tb.map(r => h('tr', r.map(c => h('td', { html: rich(c) })))))),
        ...(q.i || []).map(src => h('img', { src, alt: '' })),
        q.c.some((c, i) => (c && c.trim()) || q.ci?.[i]) ? h('div', { style: { marginTop: '8px', display: 'grid', gap: '4px' } }, q.c.map((c, i) => (c && c.trim()) || q.ci?.[i] ? h('div', h('b', LETTERS[i] + ') '), q.ci?.[i] ? h('img', { src: q.ci[i], style: { maxWidth: '200px', verticalAlign: 'middle' } }) : null, h('span', { html: rich(c) })) : null)) : null,
        opts));
    });
    body.append(h('div.row', { style: { justifyContent: 'center', margin: '20px 0' } }, h('button.btn.btn-primary', { on: { click: () => finish() } }, 'Sınavı bitir')));
    app.append(body); upd(); scrollTo(0, 0);
  }

  async function doneScreen(st) {
    app.innerHTML = '';
    const res = { e: P.id, n: st.ad, no: st.no, sn: st.sn, a: st.answers.map(a => a || '-').join(''), sur: Math.round(((st.end || Date.now()) - st.start) / 1000), ts: st.end || Date.now() };
    const link = baseUrl() + '#/sonuc/' + await pack(res);
    const text = `${st.ad}${st.no ? ' (' + st.no + ')' : ''} — ${P.t} sonucum:\n${link}`;
    const waUrl = (P.w ? 'https://wa.me/' + (P.w.startsWith('0') ? '9' + P.w : P.w) : 'https://wa.me/') + '?text=' + encodeURIComponent(text);
    const qr = await qrImg(link, 4);
    app.append(h('div.solve', h('div.card', { style: { textAlign: 'center' } },
      h('h1', 'Tebrikler, ' + st.ad + '!'),
      h('p', `${st.answers.filter(Boolean).length} / ${st.answers.length} soruyu cevapladın.`),
      h('p.muted', 'Son adım: sonucunu öğretmenine gönder. Gönderilmeyen sonuç değerlendirilmez.'),
      h('div.row', { style: { justifyContent: 'center' } },
        h('a.btn.btn-primary', { href: waUrl, target: '_blank', rel: 'noopener' }, '🟢 WhatsApp ile öğretmene gönder'),
        h('button.btn', { on: { click: async () => { await navigator.clipboard?.writeText(text); toast('Kopyalandı'); } } }, '📋 Kopyala')),
      qr ? h('div', { style: { marginTop: '14px' } }, qr, h('div.small.muted', 'Öğretmenin bu karekodu okutarak da alabilir')) : null)));
    scrollTo(0, 0);
  }
}

// ---------- Öğretmen: sonucu içe al ----------
export async function importResultCode(code) {
  const r = await unpack(code);
  const ex = await db.get('exams', r.e);
  if (!ex) return { ok: false, msg: 'Bu sonuç bu cihazdaki sınavlardan birine ait değil. Sınavı oluşturduğunuz cihazda açın.' };
  const answers = r.a.split('').map(c => c === '-' ? '' : c);
  const rid = 'on-' + r.e.slice(0, 6) + '-' + r.ts + '-' + (r.n || '').replace(/\W/g, '').slice(0, 10);
  const exists = await db.get('results', rid);
  const rec = { id: rid, examId: ex.id, ad: r.n, no: r.no || '', sinif: r.sn || '', answers, mod: 'online', sure: r.sur, ...score(ex, answers), created: r.ts };
  await db.put('results', rec);
  return { ok: true, ex, rec, exists: !!exists };
}

export async function resultImportView(app, code) {
  let res;
  try { res = await importResultCode(code); } catch { res = { ok: false, msg: 'Sonuç bağlantısı bozuk ya da eksik kopyalanmış.' }; }
  if (!res.ok) { app.append(h('div.card', h('h2', 'Sonuç alınamadı'), h('p.muted', res.msg), h('a.btn', { href: '#/sinavlar' }, 'Sınavlarım'))); return; }
  const { ex, rec } = res;
  app.append(h('div.card', { style: { maxWidth: '560px', margin: '20px auto', textAlign: 'center' } },
    h('div.small.muted', ex.title), h('h1', rec.ad + (rec.no ? ' · ' + rec.no : '')),
    h('div.row', { style: { justifyContent: 'center', gap: '24px', margin: '12px 0' } }, ...[['Doğru', rec.d], ['Yanlış', rec.y], ['Boş', rec.b], ['Net', rec.net], ['Puan', rec.puan]].map(([l, v]) => h('div', h('div.stat', String(v)), h('div.small.muted', l)))),
    h('p.small.muted', res.exists ? 'Bu sonuç daha önce alınmıştı; güncellendi.' : 'Sonuç sınavınıza eklendi.'),
    h('a.btn.btn-primary', { href: '#/sinav/' + ex.id }, 'Sınav sonuçlarına git')));
}

// Çok sayıda sonuç bağlantısını birden yapıştırma
export function bulkResultImport(onDone) {
  const ta = h('textarea.inp', { rows: 8, placeholder: 'WhatsApp’tan gelen mesajları buraya yapıştırın (birden çok olabilir).' });
  let m;
  m = modal('Online sonuçları içe al', h('div', { style: { display: 'grid', gap: '8px' } }, h('p.small.muted', 'Mesajların tamamını yapıştırabilirsiniz; içindeki sonuç bağlantıları bulunur.'), ta), {
    actions: [h('button.btn.btn-primary', { on: { click: async () => {
      const codes = [...ta.value.matchAll(/#\/sonuc\/([0-9A-Za-z_\-%]+)/g)].map(x => x[1]);
      if (!codes.length) { toast('Sonuç bağlantısı bulunamadı'); return; }
      let ok = 0, bad = 0; for (const c of codes) { try { (await importResultCode(c)).ok ? ok++ : bad++; } catch { bad++; } }
      toast(`${ok} sonuç alındı${bad ? ', ' + bad + ' alınamadı' : ''}`); m.close(); onDone?.();
    } } }, 'İçe al')] });
}
