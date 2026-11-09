// Öğretmenin branşı: uygulama yalnızca o branşın derslerini, kazanımlarını ve denemelerini gösterir.
import { h } from './util.js';
import { db } from './db.js';

export const BRANS_LISTESI = [
  { ad: 'Kimya', dersler: ['Kimya'] },
  { ad: 'Fizik', dersler: ['Fizik'] },
  { ad: 'Biyoloji', dersler: ['Biyoloji'] },
  { ad: 'Matematik', dersler: ['Matematik', 'Temel Matematik'] },
  { ad: 'Fen Bilimleri', dersler: ['Fen Bilimleri'] },
  { ad: 'Türkçe', dersler: ['Türkçe'] },
  { ad: 'Türk Dili ve Edebiyatı', dersler: ['Türk Dili ve Edebiyatı'] },
  { ad: 'Sosyal Bilgiler', dersler: ['Sosyal Bilgiler', 'T.C. İnkılap Tarihi ve Atatürkçülük'] },
  { ad: 'Tarih', dersler: ['Tarih', 'T.C. İnkılap Tarihi ve Atatürkçülük', 'Çağdaş Türk ve Dünya Tarihi'] },
  { ad: 'Coğrafya', dersler: ['Coğrafya'] },
  { ad: 'Felsefe', dersler: ['Felsefe', 'Psikoloji', 'Sosyoloji', 'Mantık'] },
  { ad: 'Din Kültürü ve Ahlak Bilgisi', dersler: ['Din Kültürü ve Ahlak Bilgisi', 'Kur’an-ı Kerim', 'Peygamberimizin Hayatı'] },
  { ad: 'İngilizce', dersler: ['İngilizce', 'Yabancı Dil'] },
  { ad: 'Bilişim Teknolojileri', dersler: ['Bilişim Teknolojileri ve Yazılım'] },
  { ad: 'Teknoloji ve Tasarım', dersler: ['Teknoloji ve Tasarım'] },
  { ad: 'Rehber Öğretmen', dersler: null, aciklama: 'Bütün dersler ve genel denemeler (LGS, TYT, AYT)' },
];

let cur = null;
export async function loadBrans() { cur = (await db.kvGet('brans')) || null; return cur; }
export const brans = () => cur;
export const tumDersler = () => !cur || !cur.dersler; // rehber öğretmen ya da seçim yapılmamış
export const dersIzinli = d => tumDersler() || cur.dersler.includes(d);
export const dersSuz = arr => tumDersler() ? arr : arr.filter(dersIzinli);
// Soru: dersi yazılmamışsa da görünür (kendi kırptığı etiketsiz sorular)
export const soruIzinli = q => tumDersler() || !q.ders || cur.dersler.includes(q.ders);
export const anaDers = () => cur?.dersler?.[0] || '';

export function bransSecici({ zorunlu = false } = {}) {
  return new Promise(resolve => {
    const ov = h('div', { style: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,16,40,.55)', display: 'grid', placeItems: 'center', padding: '16px' } });
    const kart = h('div.card', { style: { maxWidth: '640px', width: '100%', maxHeight: '90vh', overflow: 'auto' } },
      h('h2', { style: { margin: '0 0 4px' } }, 'Branşınız nedir?'),
      h('p.muted', { style: { margin: '0 0 14px' } }, 'Uygulama yalnızca seçtiğiniz dersin kazanımlarını, ders seçeneklerini ve denemelerini gösterir. Sonra ana sayfanın altından değiştirebilirsiniz.'),
      h('div.grid.grid-2', { style: { gap: '8px' } }, BRANS_LISTESI.map(b => h('button.btn' + (cur?.ad === b.ad ? '.btn-primary' : ''), {
        type: 'button', style: { justifyContent: 'flex-start', textAlign: 'left', padding: '12px 14px', flexDirection: 'column', alignItems: 'flex-start', gridColumn: b.dersler ? '' : '1 / -1' },
        on: { click: async () => { cur = { ad: b.ad, dersler: b.dersler }; await db.kvSet('brans', cur); ov.remove(); resolve(cur); } } },
        h('b', (b.dersler ? '' : '🧭 ') + b.ad), b.dersler && b.dersler.length > 1 ? h('span.small.muted', b.dersler.join(', ')) : b.aciklama ? h('span.small.muted', b.aciklama) : null))),
      zorunlu ? null : h('div.row', { style: { marginTop: '12px', justifyContent: 'flex-end' } }, h('button.btn.btn-ghost', { type: 'button', on: { click: () => { ov.remove(); resolve(null); } } }, 'Vazgeç')));
    ov.append(kart); document.body.append(ov);
  });
}

// ---------- Öğretmenin kendi kazanımları (listede olmayanlar) ----------
import { OGRENME_CIKTILARI } from './meb.js';
export const OZEL_TEMA = '✎ Kendi kazanımlarım';
let ozel = [];
const yerlestir = () => {
  for (const g of Object.keys(OGRENME_CIKTILARI)) OGRENME_CIKTILARI[g] = OGRENME_CIKTILARI[g].filter(x => !x.ozel);
  for (const k of ozel) (OGRENME_CIKTILARI[k.sinif] ||= []).push({ kod: k.kod, metin: k.metin, tema: OZEL_TEMA, ders: k.ders, ozel: true });
};
export async function loadOzel() { ozel = (await db.kvGet('ozelKazanimlar')) || []; yerlestir(); }
export async function ozelEkle(k) { ozel = ozel.filter(x => !(x.kod === k.kod && x.sinif === k.sinif)); ozel.push(k); await db.kvSet('ozelKazanimlar', ozel); yerlestir(); }
export async function ozelSil(kod, sinif) { ozel = ozel.filter(x => !(x.kod === kod && x.sinif === sinif)); await db.kvSet('ozelKazanimlar', ozel); yerlestir(); }
// Kazanım ekleme penceresi; eklenen kazanımı döndürür
export function ozelKazanimFormu({ sinif = '', ders = '', dersler = [], siniflar = [] } = {}) {
  return new Promise(resolve => {
    const ov = h('div', { style: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,16,40,.55)', display: 'grid', placeItems: 'center', padding: '16px' } });
    const sSel = h('select.inp', siniflar.map(s => h('option', { value: s, selected: s === sinif }, s)));
    const dSel = dersler.length > 1 ? h('select.inp', dersler.map(d => h('option', { value: d, selected: d === ders }, d))) : null;
    const kod = h('input.inp', { placeholder: 'Ör. KİM.9.1.3-a ya da boş bırakın' });
    const metin = h('textarea.inp', { rows: 3, placeholder: 'Kazanım metni — ör. Mol kavramını günlük hayattan örneklerle açıklayabilme' });
    const kapat = v => { ov.remove(); resolve(v); };
    ov.append(h('div.card', { style: { maxWidth: '520px', width: '100%' } },
      h('h3', { style: { margin: '0 0 6px' } }, 'Kendi kazanımınızı ekleyin'),
      h('p.small.muted', { style: { margin: '0 0 10px' } }, 'Listede olmayan bir kazanımı yazın; kazanım listelerinde “' + OZEL_TEMA + '” başlığı altında görünür ve sorularınızı bununla etiketleyebilirsiniz.'),
      h('div', { style: { display: 'grid', gap: '8px' } }, h('label.fld', 'Sınıf', sSel), dSel ? h('label.fld', 'Ders', dSel) : null, h('label.fld', 'Kod (isteğe bağlı)', kod), h('label.fld', 'Kazanım', metin)),
      h('div.row', { style: { marginTop: '12px', justifyContent: 'flex-end', gap: '8px' } },
        h('button.btn.btn-ghost', { type: 'button', on: { click: () => kapat(null) } }, 'Vazgeç'),
        h('button.btn.btn-primary', { type: 'button', on: { click: async () => {
          const m = metin.value.trim(); if (!m) { metin.focus(); return; }
          const s = sSel.value, d = dSel ? dSel.value : (dersler[0] || ders);
          const k = kod.value.trim() || ('ÖZ.' + parseInt(s) + '.' + (ozel.filter(x => x.sinif === s && x.ders === d).length + 1));
          const yeni = { kod: k, metin: m, sinif: s, ders: d };
          await ozelEkle(yeni); kapat(yeni);
        } } }, 'Ekle'))));
    document.body.append(ov); setTimeout(() => metin.focus(), 50);
  });
}
