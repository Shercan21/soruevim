// Görünüm sistemi: seçenek listeleri ve hazır tasarımlar.

export const BODY_FONTS = {
  akademik: { ad: 'Akademik (Tırnaklı)', css: '"Source Serif 4","Cambria","Georgia",serif' },
  yayinevi: { ad: 'Yayınevi (Sans)', css: '"Inter","Segoe UI",Roboto,Arial,sans-serif' },
  kitapcik: { ad: 'Kitapçık (Arial)', css: 'Arial,"Helvetica Neue",Helvetica,sans-serif' },
  modern: { ad: 'Modern (Düz)', css: '"Nunito Sans","Nunito","Segoe UI",sans-serif' },
  geometrik: { ad: 'Sistem (Geometrik)', css: '"Lexend","Century Gothic","Avenir",sans-serif' },
  daktilo: { ad: 'Dizgi (Daktilo)', css: '"Courier Prime","Courier New",monospace' },
};
export const TITLE_FONTS = {
  grotesk: { ad: 'Grotesk', css: '"Archivo","Archivo Narrow","Arial Narrow",Arial,sans-serif' },
  serif: { ad: 'Serif', css: '"Merriweather","Georgia",serif' },
  el: { ad: 'El Yazısı', css: '"Kalam","Segoe Print","Comic Sans MS",cursive' },
  geometrik: { ad: 'Geometrik', css: '"Lexend","Century Gothic",sans-serif' },
};
export const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Courier+Prime:wght@400;700&family=Inter:wght@400;600;800&family=Kalam:wght@400;700&family=Lexend:wght@400;600;800&family=Merriweather:wght@400;700;900&family=Nunito+Sans:wght@400;700;800&family=Source+Serif+4:wght@400;600;700&family=Playpen+Sans:wght@400;700&family=Pacifico&family=Kaushan+Script&display=swap';

export const HEADERS = {
  klasik: 'Klasik çerçeve', serit: 'Renkli şerit', minimal: 'Minimal çizgi', amblem: 'Sol amblem', akademi: 'Akademi',
  kusak: 'Kuşak', egim: 'Eğim', dalga: 'Dalga', sekme: 'Dosya sekmesi', ciftton: 'Çift ton', defter: 'Defter',
  sertifika: 'Sertifika', daire: 'Büyük daire', gece: 'Gece', kose: 'Köşe çizgisi', meb: 'MEB kutusu (3 sütun)',
  bulut: 'Bulut', petek: 'Petek', grafik: 'Grafik kâğıdı', poster: 'Poster',
};
export const TEMPLATES = { klasik: 'Klasik', serit: 'Sol şerit', lcerceve: 'İnce L çerçeve', kosebent: 'Alt köşebent', tam: 'Tam çerçeve', yok: 'Çerçevesiz' };
export const PAGE_NUMS = { yok: 'Yok', sade: 'Sade', daire: 'Dolu daire', halka: 'Kalın daire', kare: 'Dolu kutu', golge: 'Kare ve gölge', elmas: 'Elmas', yildiz: 'Yıldız', kalkan: 'Kalkan', ok: 'Ok şekli', kesik: 'Kesik çizgi', sekme: 'Dosya sekmesi' };
export const Q_NUMS = {
  dolu: 'Daire (dolu)', cizgili: 'Daire (çizgili)', iri: 'İri rakam', el: 'El yazısı', el2: 'El yazısı — yuvarlak', kart: 'Kart (geçişli)',
  madalyon: 'Madalyon', kontur: 'Konturlu', kare: 'Kare', nokta: 'Nokta (7.)', parantez: 'Parantez (7))', koseli: 'Köşeli ([7])',
  altigen: 'Altıgen', yaprak: 'Yaprak', bayrak: 'Bayrak', golgeli: 'Gölgeli kutu', cift: 'Çift halka', damla: 'Damla', fosfor: 'Fosforlu kalem', yildiz: 'Yıldız', yok: 'Numarasız',
};
export const FOOTERS = { klasik: 'Klasik', logolu: 'Logolu', kutu: 'Merkez kutu', cift: 'Çift çizgili', oklar: 'Karşılıklı oklar' };
export const SIZES = { lise: { ad: 'Ortaokul ve lise (11 pt)', pt: 11 }, bes: { ad: '5. sınıf (12 pt)', pt: 12 }, ucdort: { ad: '3–4. sınıf (14 pt)', pt: 14 }, birki: { ad: '1–2. sınıf (20 pt)', pt: 20 } };
export const SOZLER = ['Başarılar dileriz.', 'Bol şans!', 'Kolay gelsin.', 'Sen yaparsın!', 'Hedefe bir adım daha.', 'Emeğine sağlık.', ''];
export const SIMGELER = { '': 'Yok', '★': 'Yıldız', '✎': 'Kalem', '♥': 'Kalp', '✓': 'Onay', '☺': 'Gülümseme', '✿': 'Çiçek', '➜': 'Ok' };
export const PAPERS = { A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [216, 279], Legal: [216, 356] };
export const LAYOUTS = { auto: 'Otomatik', alt: 'Alt alta', iki: 'İki sütun', uc: 'Üç sütun', k32: '3+2 kademeli', yan: 'Yan yana', dort: 'Dörtlü sıra' };

export const DEFAULT_LOOK = {
  baslik: 'serit', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'yayinevi', baslikFont: 'grotesk', altBilgi: 'klasik', boyut: 'lise',
};

// Hazır tasarımlar — her biri renk + görünüm demeti.
const P = (ad, kat, renk, renk2, look) => ({ ad, kat, renk, renk2, look: { ...DEFAULT_LOOK, ...look } });
export const PRESETS = [
  // Sade ve ekonomik (fotokopi dostu)
  P('Kurşun', 'Sade ve Ekonomik', '#222222', '#555555', { baslik: 'minimal', sablon: 'yok', sayfaNo: 'sade', soruNo: 'nokta', govdeFont: 'kitapcik', baslikFont: 'grotesk', altBilgi: 'klasik' }),
  P('Resmî', 'Sade ve Ekonomik', '#1f1f1f', '#444444', { baslik: 'klasik', sablon: 'tam', sayfaNo: 'sade', soruNo: 'parantez', govdeFont: 'akademik', baslikFont: 'serif', altBilgi: 'cift' }),
  P('İnce Çizgi', 'Sade ve Ekonomik', '#333333', '#666666', { baslik: 'kose', sablon: 'lcerceve', sayfaNo: 'kesik', soruNo: 'iri', govdeFont: 'yayinevi' }),
  P('Gri Ton', 'Sade ve Ekonomik', '#4a4a4a', '#7a7a7a', { baslik: 'ciftton', sablon: 'klasik', sayfaNo: 'kare', soruNo: 'kare' }),
  P('Daktilo', 'Sade ve Ekonomik', '#2b2b2b', '#5a5a5a', { baslik: 'defter', sablon: 'yok', sayfaNo: 'sade', soruNo: 'koseli', govdeFont: 'daktilo', baslikFont: 'serif' }),
  P('Not Kâğıdı', 'Sade ve Ekonomik', '#3b3b3b', '#777777', { baslik: 'defter', sablon: 'serit', sayfaNo: 'halka', soruNo: 'cizgili', baslikFont: 'el' }),
  // Klasik okul
  P('Lacivert Okul', 'Klasik Okul', '#1B4B7F', '#2E6DB4', { baslik: 'serit', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu' }),
  P('Bordo Kitap', 'Klasik Okul', '#7A1F2B', '#A3394A', { baslik: 'akademi', sablon: 'tam', sayfaNo: 'kalkan', soruNo: 'madalyon', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Kara Tahta', 'Klasik Okul', '#1E3B2F', '#2F6B4F', { baslik: 'gece', sablon: 'klasik', sayfaNo: 'kare', soruNo: 'kare', baslikFont: 'el' }),
  P('Ders Kitabı', 'Klasik Okul', '#0E5C8A', '#E8892B', { baslik: 'meb', sablon: 'tam', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'akademik' }),
  P('Ay Yıldız', 'Klasik Okul', '#C8102E', '#8E0B20', { baslik: 'kusak', sablon: 'klasik', sayfaNo: 'yildiz', soruNo: 'dolu' }),
  P('Okul Dosyası', 'Klasik Okul', '#3D5A80', '#98C1D9', { baslik: 'sekme', sablon: 'serit', sayfaNo: 'sekme', soruNo: 'golgeli' }),
  // Modern
  P('Okyanus', 'Modern', '#006D77', '#83C5BE', { baslik: 'dalga', sablon: 'yok', sayfaNo: 'daire', soruNo: 'kart', govdeFont: 'modern', baslikFont: 'geometrik' }),
  P('Gece Mavisi', 'Modern', '#14213D', '#FCA311', { baslik: 'gece', sablon: 'lcerceve', sayfaNo: 'golge', soruNo: 'kare', govdeFont: 'modern' }),
  P('Grafit ve Turuncu', 'Modern', '#2B2D42', '#EF8354', { baslik: 'egim', sablon: 'kosebent', sayfaNo: 'ok', soruNo: 'bayrak', baslikFont: 'geometrik' }),
  P('Mor Ötesi', 'Modern', '#5A189A', '#9D4EDD', { baslik: 'egim', sablon: 'serit', sayfaNo: 'elmas', soruNo: 'altigen', baslikFont: 'geometrik' }),
  P('Zümrüt', 'Modern', '#0B6E4F', '#08A045', { baslik: 'amblem', sablon: 'klasik', sayfaNo: 'halka', soruNo: 'cift' }),
  P('İskandinav', 'Modern', '#3A506B', '#5BC0BE', { baslik: 'minimal', sablon: 'yok', sayfaNo: 'sade', soruNo: 'iri', govdeFont: 'geometrik', baslikFont: 'geometrik' }),
  // Renkli ve canlı
  P('Elektrik', 'Renkli ve Canlı', '#3A0CA3', '#F72585', { baslik: 'poster', sablon: 'serit', sayfaNo: 'yildiz', soruNo: 'kart', baslikFont: 'geometrik' }),
  P('Gün Batımı', 'Renkli ve Canlı', '#E76F51', '#F4A261', { baslik: 'dalga', sablon: 'kosebent', sayfaNo: 'daire', soruNo: 'damla' }),
  P('Karnaval', 'Renkli ve Canlı', '#D62828', '#F77F00', { baslik: 'petek', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'yildiz', baslikFont: 'el' }),
  P('Limon', 'Renkli ve Canlı', '#5F7A00', '#C9D600', { baslik: 'bulut', sablon: 'yok', sayfaNo: 'daire', soruNo: 'fosfor' }),
  P('Mercan', 'Renkli ve Canlı', '#E63946', '#457B9D', { baslik: 'daire', sablon: 'klasik', sayfaNo: 'kalkan', soruNo: 'dolu' }),
  P('Turkuaz', 'Renkli ve Canlı', '#0077B6', '#00B4D8', { baslik: 'kusak', sablon: 'lcerceve', sayfaNo: 'golge', soruNo: 'kart' }),
  // İlkokul
  P('Masal', 'İlkokul', '#7B2CBF', '#FF9E00', { baslik: 'bulut', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'el2', govdeFont: 'modern', baslikFont: 'el', boyut: 'ucdort' }),
  P('Uçurtma', 'İlkokul', '#0081A7', '#F07167', { baslik: 'daire', sablon: 'yok', sayfaNo: 'daire', soruNo: 'damla', govdeFont: 'modern', baslikFont: 'el', boyut: 'ucdort' }),
  P('Çiçek Bahçesi', 'İlkokul', '#C9184A', '#80B918', { baslik: 'bulut', sablon: 'kosebent', sayfaNo: 'halka', soruNo: 'yaprak', govdeFont: 'modern', baslikFont: 'el', boyut: 'ucdort' }),
  P('İlk Harfler', 'İlkokul', '#1D3557', '#E63946', { baslik: 'defter', sablon: 'tam', sayfaNo: 'kare', soruNo: 'el', govdeFont: 'modern', baslikFont: 'el', boyut: 'birki' }),
  P('Güneşli Gün', 'İlkokul', '#E85D04', '#FFBA08', { baslik: 'daire', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'yildiz', govdeFont: 'modern', baslikFont: 'el', boyut: 'bes' }),
  // Sınav kitapçığı
  P('Kitapçık A', 'Sınav Kitapçığı', '#003049', '#D62828', { baslik: 'klasik', sablon: 'tam', sayfaNo: 'kare', soruNo: 'nokta', govdeFont: 'kitapcik', baslikFont: 'grotesk', altBilgi: 'cift' }),
  P('Final', 'Sınav Kitapçığı', '#22223B', '#9A8C98', { baslik: 'akademi', sablon: 'klasik', sayfaNo: 'sade', soruNo: 'kare', govdeFont: 'kitapcik' }),
  P('Kırmızı Kalem', 'Sınav Kitapçığı', '#B00020', '#B00020', { baslik: 'minimal', sablon: 'lcerceve', sayfaNo: 'kesik', soruNo: 'iri', govdeFont: 'kitapcik' }),
  P('Hedef', 'Sınav Kitapçığı', '#1D3557', '#E63946', { baslik: 'egim', sablon: 'tam', sayfaNo: 'ok', soruNo: 'dolu', govdeFont: 'kitapcik' }),
  P('Maraton', 'Sınav Kitapçığı', '#264653', '#2A9D8F', { baslik: 'serit', sablon: 'serit', sayfaNo: 'golge', soruNo: 'kare', govdeFont: 'kitapcik' }),
  // Zarif
  P('Antika', 'Zarif', '#5C4033', '#A47148', { baslik: 'sertifika', sablon: 'tam', sayfaNo: 'elmas', soruNo: 'cift', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Zeytin Dalı', 'Zarif', '#556B2F', '#8F9779', { baslik: 'sertifika', sablon: 'klasik', sayfaNo: 'halka', soruNo: 'madalyon', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Kahve', 'Zarif', '#4E342E', '#8D6E63', { baslik: 'akademi', sablon: 'lcerceve', sayfaNo: 'sade', soruNo: 'parantez', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Lavanta', 'Zarif', '#5E548E', '#9F86C0', { baslik: 'minimal', sablon: 'yok', sayfaNo: 'elmas', soruNo: 'cizgili', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Mürekkep', 'Zarif', '#1A365D', '#2C5282', { baslik: 'kose', sablon: 'klasik', sayfaNo: 'kalkan', soruNo: 'kontur', govdeFont: 'akademik', baslikFont: 'serif' }),
  // Bilim ve teknik
  P('Laboratuvar', 'Bilim ve Teknik', '#0F4C5C', '#5F0F40', { baslik: 'grafik', sablon: 'tam', sayfaNo: 'kare', soruNo: 'altigen', govdeFont: 'geometrik', baslikFont: 'geometrik' }),
  P('Devre', 'Bilim ve Teknik', '#1B998B', '#2D3047', { baslik: 'grafik', sablon: 'kosebent', sayfaNo: 'golge', soruNo: 'kare', govdeFont: 'geometrik' }),
  P('Atom', 'Bilim ve Teknik', '#3D348B', '#7678ED', { baslik: 'petek', sablon: 'serit', sayfaNo: 'halka', soruNo: 'cift', baslikFont: 'geometrik' }),
  P('Kareli Defter', 'Bilim ve Teknik', '#2C3E50', '#E67E22', { baslik: 'grafik', sablon: 'yok', sayfaNo: 'sade', soruNo: 'kare', govdeFont: 'modern', baslikFont: 'el' }),
  P('Uzay', 'Bilim ve Teknik', '#10002B', '#7B2CBF', { baslik: 'gece', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'yildiz', baslikFont: 'geometrik' }),
  P('Formül', 'Bilim ve Teknik', '#1B4332', '#40916C', { baslik: 'meb', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'akademik' }),
];
export const PRESET_CATS = [...new Set(PRESETS.map(p => p.kat))];

// Yazdırılan yazı tipi bağlantısı (bir kez)
let fontsLinked = false;
export function ensureFonts() {
  if (fontsLinked) return; fontsLinked = true;
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_CSS_URL; document.head.append(l);
}

// Kalıcı dosyalar: KaTeX ve QR (ilk kullanımda indirilir, SW önbelleğe alır)
const KATEX_CSS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
const KATEX_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.mjs';
let katexP;
export function loadKatex() {
  if (!katexP) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = KATEX_CSS; document.head.append(l);
    katexP = import(KATEX_JS).then(m => m.default || m).catch(() => null);
  }
  return katexP;
}
let qrP;
export function loadQR() {
  qrP ||= import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm').then(m => m.default || m).catch(() => null);
  return qrP;
}
