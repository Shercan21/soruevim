// İletişim: hata / eksik / istek bildirimi — kullanıcının e-posta uygulamasıyla geliştiriciye gönderilir.
import { h, modal, toast } from './util.js';
import { brans } from './brans.js';

export const ADRES = 'ercanseyithasan@gmail.com';

// Son hataları sessizce tut (bildirime eklenir)
const HATA_KEY = 'soruevim-son-hatalar';
function hataKaydet(m) {
  try {
    const l = JSON.parse(localStorage.getItem(HATA_KEY) || '[]');
    l.push(new Date().toLocaleString('tr-TR') + ' — ' + String(m).slice(0, 300));
    localStorage.setItem(HATA_KEY, JSON.stringify(l.slice(-5)));
  } catch { }
}
window.addEventListener('error', e => hataKaydet(e.message + (e.filename ? ' @' + e.filename.split('/').pop() + ':' + e.lineno : '')));
window.addEventListener('unhandledrejection', e => hataKaydet('Promise: ' + (e.reason?.message || e.reason)));

async function surum() {
  try { return (await (await fetch('./sw.js')).text()).match(/VERSION = '([^']+)'/)[1]; } catch { return '?'; }
}

const TURLER = [['hata', '🐞 Hata'], ['eksik', '🧩 Eksik özellik'], ['istek', '💡 İstek / öneri'], ['diger', '✉️ Diğer']];

export async function iletisimAc() {
  let tur = 'hata';
  const segs = h('div.row', { style: { gap: '6px', flexWrap: 'wrap' } });
  const cizSeg = () => { segs.innerHTML = ''; segs.append(...TURLER.map(([k, ad]) => h('button.btn.btn-sm' + (k === tur ? '.btn-primary' : ''), { type: 'button', on: { click: () => { tur = k; cizSeg(); } } }, ad))); };
  cizSeg();
  const mesaj = h('textarea', { rows: 6, placeholder: 'Ne oldu, ne istiyorsunuz? Hata ise hangi ekranda, ne yaparken oldu?', style: { width: '100%' } });
  const ad = h('input', { type: 'text', placeholder: 'Adınız (isteğe bağlı)', style: { width: '100%' } });
  const ekle = h('input', { type: 'checkbox', checked: true });

  const metin = async () => {
    const lbl = TURLER.find(t => t[0] === tur)[1].replace(/^\S+\s/, '');
    const satir = [mesaj.value.trim(), '', '—', ad.value.trim() ? 'Gönderen: ' + ad.value.trim() : null];
    if (ekle.checked) {
      let hatalar = []; try { hatalar = JSON.parse(localStorage.getItem(HATA_KEY) || '[]'); } catch { }
      satir.push('Sürüm: ' + await surum(), 'Branş: ' + (brans()?.ad || '—'), 'Ekran: ' + location.hash, 'Cihaz: ' + navigator.userAgent);
      if (hatalar.length) satir.push('Son hatalar:', ...hatalar);
    }
    return { konu: 'Soru Evim — ' + lbl, govde: satir.filter(x => x !== null).join('\n') };
  };

  const gonder = h('button.btn.btn-primary', { on: { click: async () => {
    if (!mesaj.value.trim()) { toast('Lütfen bir mesaj yazın'); mesaj.focus(); return; }
    const { konu, govde } = await metin();
    location.href = 'mailto:' + ADRES + '?subject=' + encodeURIComponent(konu) + '&body=' + encodeURIComponent(govde);
    toast('E-posta uygulamanız açılıyor — orada Gönder’e basın');
    setTimeout(() => m.close(), 800);
  } } }, '✉️ E-posta ile gönder');
  const kopya = h('button.btn.btn-ghost', { on: { click: async () => {
    if (!mesaj.value.trim()) { toast('Lütfen bir mesaj yazın'); return; }
    const { konu, govde } = await metin();
    try { await navigator.clipboard.writeText(konu + '\n\n' + govde); toast('Kopyalandı — ' + ADRES + ' adresine yapıştırıp gönderebilirsiniz', 4000); } catch { toast('Kopyalanamadı'); }
  } } }, '📋 Metni kopyala');

  const m = modal('Bize yazın', h('div', { style: { display: 'grid', gap: '12px' } },
    h('p.muted.small', 'Bir hata mı buldunuz, bir şey mi eksik, yeni bir özellik mi istiyorsunuz? Yazın, doğrudan geliştiriciye ulaşsın.'),
    segs, mesaj, ad,
    h('label.row.small', { style: { gap: '6px' } }, ekle, 'Sürüm ve cihaz bilgisini ekle (hataları çözmeye yardımcı olur, soru ve belgeleriniz gönderilmez)'),
    h('p.small.muted', 'Gönder’e basınca e-posta uygulamanız hazır mesajla açılır. Açılmazsa metni kopyalayıp ', h('b', ADRES), ' adresine gönderin.')),
    { actions: [kopya, gonder] });
  setTimeout(() => mesaj.focus(), 50);
}
