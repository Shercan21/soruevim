// Görünüm sistemi: seçenek listeleri ve hazır tasarımlar.

export const BODY_FONTS = {
  akademik: { ad: 'Kitap (serifli)', css: '"Source Serif 4","Cambria","Georgia",serif' },
  yayinevi: { ad: 'Temiz (Inter)', css: '"Inter","Segoe UI",Roboto,Arial,sans-serif' },
  kitapcik: { ad: 'Klasik (Arial)', css: 'Arial,"Helvetica Neue",Helvetica,sans-serif' },
  modern: { ad: 'Yumuşak (Nunito)', css: '"Nunito Sans","Nunito","Segoe UI",sans-serif' },
  geometrik: { ad: 'Okunaklı (Lexend)', css: '"Lexend","Century Gothic","Avenir",sans-serif' },
  daktilo: { ad: 'Daktilo (Courier)', css: '"Courier Prime","Courier New",monospace' },
};
export const TITLE_FONTS = {
  grotesk: { ad: 'Dar ve kalın', css: '"Archivo","Archivo Narrow","Arial Narrow",Arial,sans-serif' },
  serif: { ad: 'Serifli', css: '"Merriweather","Georgia",serif' },
  el: { ad: 'Kalem', css: '"Kalam","Segoe Print","Comic Sans MS",cursive' },
  geometrik: { ad: 'Yuvarlak', css: '"Lexend","Century Gothic",sans-serif' },
};
export const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=Courier+Prime:wght@400;700&family=Inter:wght@400;600;800&family=Kalam:wght@400;700&family=Lexend:wght@400;600;800&family=Merriweather:wght@400;700;900&family=Nunito+Sans:wght@400;700;800&family=Source+Serif+4:wght@400;600;700&family=Playpen+Sans:wght@400;700&family=Pacifico&family=Kaushan+Script&display=swap';

export const HEADERS = {
  klasik: 'Çerçeveli kutu', serit: 'Düz bant', minimal: 'Tek çizgi', amblem: 'Logo solda', akademi: 'Üniversite',
  kusak: 'Kemer', egim: 'Rampa', dalga: 'Kıvrım', sekme: 'Klasör kulağı', ciftton: 'İki renk', defter: 'Spiral',
  sertifika: 'Belge', daire: 'Madalya', gece: 'Koyu zemin', kose: 'Köşebent', meb: 'Resmî tablo (3 sütun)',
  bulut: 'Pamuk', petek: 'Bal peteği', grafik: 'Kareli zemin', poster: 'Afiş',
};
export const TEMPLATES = { klasik: 'Üst ve alt çizgi', serit: 'Kenar bandı', lcerceve: 'L kenar', kosebent: 'Alt köşe', tam: 'Dört kenar', yok: 'Kenarsız' };
export const PAGE_NUMS = { yok: 'Yok', sade: 'Sade', daire: 'Dolu daire', halka: 'Halka', kare: 'Kutu', golge: 'Gölgeli kutu', elmas: 'Elmas', yildiz: 'Yıldız', kalkan: 'Arma', ok: 'Ok', kesik: 'Tire', sekme: 'Klasör kulağı' };
export const Q_NUMS = {
  dolu: 'Yuvarlak dolu', cizgili: 'Yuvarlak boş', iri: 'Büyük rakam', el: 'Kalemle', el2: 'Kalemle — yuvarlak', kart: 'Renk geçişli kart',
  madalyon: 'Rozet', kontur: 'Dış hatlı', kare: 'Kare', nokta: 'Nokta (7.)', parantez: 'Parantez (7))', koseli: 'Köşeli ([7])',
  altigen: 'Altıgen', yaprak: 'Yaprak', bayrak: 'Flama', golgeli: 'Gölgeli kare', cift: 'İki halka', damla: 'Damla', fosfor: 'İşaret kalemi', yildiz: 'Yıldız', yok: 'Numarasız',
};
export const FOOTERS = { klasik: 'Sade', logolu: 'Logo ile', kutu: 'Ortada kutu', cift: 'İki çizgi', oklar: 'Ok uçları' };
export const SIZES = { lise: { ad: '6. sınıf ve üstü (11 pt)', pt: 11 }, bes: { ad: 'Büyük (12 pt)', pt: 12 }, ucdort: { ad: 'Daha büyük (14 pt)', pt: 14 }, birki: { ad: 'En büyük (20 pt)', pt: 20 } };
export const SOZLER = ['İyi çalışmalar.', 'Hepinize başarılar!', 'Acele etme, dikkatli oku.', 'Sana güveniyorum!', 'Her soru bir adım.', 'Zamanını iyi kullan.', ''];
export const SIMGELER = { '': 'Yok', '★': 'Yıldız', '✎': 'Kalem', '♥': 'Kalp', '✓': 'Onay', '☺': 'Gülümseme', '✿': 'Çiçek', '➜': 'Ok' };
export const PAPERS = { A4: [210, 297], A5: [148, 210], A3: [297, 420], Letter: [216, 279], Legal: [216, 356] };
export const LAYOUTS = { auto: 'Otomatik', alt: 'Alt alta', iki: 'İki sütun', uc: 'Üç sütun', k32: '3 üstte 2 altta', yan: 'Tek satır', dort: '2×2 tablo' };

export const DEFAULT_LOOK = {
  baslik: 'serit', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'yayinevi', baslikFont: 'grotesk', altBilgi: 'klasik', boyut: 'lise',
};

// Hazır tasarımlar — her biri renk + görünüm demeti.
const P = (ad, kat, renk, renk2, look) => ({ ad, kat, renk, renk2, look: { ...DEFAULT_LOOK, ...look } });
export const PRESETS = [
  // Fotokopi dostu
  P('Grafit Uç', 'Fotokopi dostu', '#222222', '#555555', { baslik: 'minimal', sablon: 'yok', sayfaNo: 'sade', soruNo: 'nokta', govdeFont: 'kitapcik', baslikFont: 'grotesk', altBilgi: 'klasik' }),
  P('Dilekçe', 'Fotokopi dostu', '#1f1f1f', '#444444', { baslik: 'klasik', sablon: 'tam', sayfaNo: 'sade', soruNo: 'parantez', govdeFont: 'akademik', baslikFont: 'serif', altBilgi: 'cift' }),
  P('Tel Çizgi', 'Fotokopi dostu', '#333333', '#666666', { baslik: 'kose', sablon: 'lcerceve', sayfaNo: 'kesik', soruNo: 'iri', govdeFont: 'yayinevi' }),
  P('Duman', 'Fotokopi dostu', '#4a4a4a', '#7a7a7a', { baslik: 'ciftton', sablon: 'klasik', sayfaNo: 'kare', soruNo: 'kare' }),
  P('Matbaa', 'Fotokopi dostu', '#2b2b2b', '#5a5a5a', { baslik: 'defter', sablon: 'yok', sayfaNo: 'sade', soruNo: 'koseli', govdeFont: 'daktilo', baslikFont: 'serif' }),
  P('Ajanda', 'Fotokopi dostu', '#3b3b3b', '#777777', { baslik: 'defter', sablon: 'serit', sayfaNo: 'halka', soruNo: 'cizgili', baslikFont: 'el' }),
  // Klasik okul
  P('Okul Lacivert', 'Okul resmi', '#1B4B7F', '#2E6DB4', { baslik: 'serit', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu' }),
  P('Vişne', 'Okul resmi', '#7A1F2B', '#A3394A', { baslik: 'akademi', sablon: 'tam', sayfaNo: 'kalkan', soruNo: 'madalyon', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Yeşil Pano', 'Okul resmi', '#1E3B2F', '#2F6B4F', { baslik: 'gece', sablon: 'klasik', sayfaNo: 'kare', soruNo: 'kare', baslikFont: 'el' }),
  P('Atlas', 'Okul resmi', '#0E5C8A', '#E8892B', { baslik: 'meb', sablon: 'tam', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'akademik' }),
  P('Bayrak Kırmızısı', 'Okul resmi', '#C8102E', '#8E0B20', { baslik: 'kusak', sablon: 'klasik', sayfaNo: 'yildiz', soruNo: 'dolu' }),
  P('Arşiv', 'Okul resmi', '#3D5A80', '#98C1D9', { baslik: 'sekme', sablon: 'serit', sayfaNo: 'sekme', soruNo: 'golgeli' }),
  // Modern
  P('Derin Mavi', 'Çağdaş', '#006D77', '#83C5BE', { baslik: 'dalga', sablon: 'yok', sayfaNo: 'daire', soruNo: 'kart', govdeFont: 'modern', baslikFont: 'geometrik' }),
  P('Gece Yarısı', 'Çağdaş', '#14213D', '#FCA311', { baslik: 'gece', sablon: 'lcerceve', sayfaNo: 'golge', soruNo: 'kare', govdeFont: 'modern' }),
  P('Kömür ve Amber', 'Çağdaş', '#2B2D42', '#EF8354', { baslik: 'egim', sablon: 'kosebent', sayfaNo: 'ok', soruNo: 'bayrak', baslikFont: 'geometrik' }),
  P('Patlıcan', 'Çağdaş', '#5A189A', '#9D4EDD', { baslik: 'egim', sablon: 'serit', sayfaNo: 'elmas', soruNo: 'altigen', baslikFont: 'geometrik' }),
  P('Nane Yeşili', 'Çağdaş', '#0B6E4F', '#08A045', { baslik: 'amblem', sablon: 'klasik', sayfaNo: 'halka', soruNo: 'cift' }),
  P('Fiyort', 'Çağdaş', '#3A506B', '#5BC0BE', { baslik: 'minimal', sablon: 'yok', sayfaNo: 'sade', soruNo: 'iri', govdeFont: 'geometrik', baslikFont: 'geometrik' }),
  // Renkli ve canlı
  P('Neon', 'Rengârenk', '#3A0CA3', '#F72585', { baslik: 'poster', sablon: 'serit', sayfaNo: 'yildiz', soruNo: 'kart', baslikFont: 'geometrik' }),
  P('Kiremit', 'Rengârenk', '#E76F51', '#F4A261', { baslik: 'dalga', sablon: 'kosebent', sayfaNo: 'daire', soruNo: 'damla' }),
  P('Lunapark', 'Rengârenk', '#D62828', '#F77F00', { baslik: 'petek', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'yildiz', baslikFont: 'el' }),
  P('Fıstık', 'Rengârenk', '#5F7A00', '#C9D600', { baslik: 'bulut', sablon: 'yok', sayfaNo: 'daire', soruNo: 'fosfor' }),
  P('Nar', 'Rengârenk', '#E63946', '#457B9D', { baslik: 'daire', sablon: 'klasik', sayfaNo: 'kalkan', soruNo: 'dolu' }),
  P('Ege', 'Rengârenk', '#0077B6', '#00B4D8', { baslik: 'kusak', sablon: 'lcerceve', sayfaNo: 'golge', soruNo: 'kart' }),
  // İlkokul
  P('Peri', 'Minikler', '#7B2CBF', '#FF9E00', { baslik: 'bulut', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'el2', govdeFont: 'modern', baslikFont: 'el', boyut: 'ucdort' }),
  P('Balon', 'Minikler', '#0081A7', '#F07167', { baslik: 'daire', sablon: 'yok', sayfaNo: 'daire', soruNo: 'damla', govdeFont: 'modern', baslikFont: 'el', boyut: 'ucdort' }),
  P('Lale', 'Minikler', '#C9184A', '#80B918', { baslik: 'bulut', sablon: 'kosebent', sayfaNo: 'halka', soruNo: 'yaprak', govdeFont: 'modern', baslikFont: 'el', boyut: 'ucdort' }),
  P('Alfabe', 'Minikler', '#1D3557', '#E63946', { baslik: 'defter', sablon: 'tam', sayfaNo: 'kare', soruNo: 'el', govdeFont: 'modern', baslikFont: 'el', boyut: 'birki' }),
  P('Portakal', 'Minikler', '#E85D04', '#FFBA08', { baslik: 'daire', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'yildiz', govdeFont: 'modern', baslikFont: 'el', boyut: 'bes' }),
  // Sınav kitapçığı
  P('Salon', 'Sınav salonu', '#003049', '#D62828', { baslik: 'klasik', sablon: 'tam', sayfaNo: 'kare', soruNo: 'nokta', govdeFont: 'kitapcik', baslikFont: 'grotesk', altBilgi: 'cift' }),
  P('Son Düzlük', 'Sınav salonu', '#22223B', '#9A8C98', { baslik: 'akademi', sablon: 'klasik', sayfaNo: 'sade', soruNo: 'kare', govdeFont: 'kitapcik' }),
  P('Düzeltme', 'Sınav salonu', '#B00020', '#B00020', { baslik: 'minimal', sablon: 'lcerceve', sayfaNo: 'kesik', soruNo: 'iri', govdeFont: 'kitapcik' }),
  P('Nişan', 'Sınav salonu', '#1D3557', '#E63946', { baslik: 'egim', sablon: 'tam', sayfaNo: 'ok', soruNo: 'dolu', govdeFont: 'kitapcik' }),
  P('Kronometre', 'Sınav salonu', '#264653', '#2A9D8F', { baslik: 'serit', sablon: 'serit', sayfaNo: 'golge', soruNo: 'kare', govdeFont: 'kitapcik' }),
  // Zarif
  P('Sepya', 'Şık', '#5C4033', '#A47148', { baslik: 'sertifika', sablon: 'tam', sayfaNo: 'elmas', soruNo: 'cift', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Haki', 'Şık', '#556B2F', '#8F9779', { baslik: 'sertifika', sablon: 'klasik', sayfaNo: 'halka', soruNo: 'madalyon', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Tarçın', 'Şık', '#4E342E', '#8D6E63', { baslik: 'akademi', sablon: 'lcerceve', sayfaNo: 'sade', soruNo: 'parantez', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Leylak', 'Şık', '#5E548E', '#9F86C0', { baslik: 'minimal', sablon: 'yok', sayfaNo: 'elmas', soruNo: 'cizgili', govdeFont: 'akademik', baslikFont: 'serif' }),
  P('Divit', 'Şık', '#1A365D', '#2C5282', { baslik: 'kose', sablon: 'klasik', sayfaNo: 'kalkan', soruNo: 'kontur', govdeFont: 'akademik', baslikFont: 'serif' }),
  // Bilim ve teknik
  P('Deney Tüpü', 'Fen ve teknoloji', '#0F4C5C', '#5F0F40', { baslik: 'grafik', sablon: 'tam', sayfaNo: 'kare', soruNo: 'altigen', govdeFont: 'geometrik', baslikFont: 'geometrik' }),
  P('Pil', 'Fen ve teknoloji', '#1B998B', '#2D3047', { baslik: 'grafik', sablon: 'kosebent', sayfaNo: 'golge', soruNo: 'kare', govdeFont: 'geometrik' }),
  P('Molekül', 'Fen ve teknoloji', '#3D348B', '#7678ED', { baslik: 'petek', sablon: 'serit', sayfaNo: 'halka', soruNo: 'cift', baslikFont: 'geometrik' }),
  P('Milimetrik', 'Fen ve teknoloji', '#2C3E50', '#E67E22', { baslik: 'grafik', sablon: 'yok', sayfaNo: 'sade', soruNo: 'kare', govdeFont: 'modern', baslikFont: 'el' }),
  P('Galaksi', 'Fen ve teknoloji', '#10002B', '#7B2CBF', { baslik: 'gece', sablon: 'tam', sayfaNo: 'yildiz', soruNo: 'yildiz', baslikFont: 'geometrik' }),
  P('Denklem', 'Fen ve teknoloji', '#1B4332', '#40916C', { baslik: 'meb', sablon: 'klasik', sayfaNo: 'daire', soruNo: 'dolu', govdeFont: 'akademik' }),
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
