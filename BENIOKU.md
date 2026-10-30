# Soru Evim PWA

Derleme gerektirmeyen, tek klasörlük bir PWA. Bütün veriler kullanıcının tarayıcısında (IndexedDB) saklanır.

## Yayına alma
1. Klasörün içeriğini herhangi bir statik sunucuya yükleyin (Cloudflare Pages, Netlify, cPanel `public_html`, GitHub Pages…).
2. Adres **HTTPS** olmalı. Service worker ve "Uygulamayı yükle" yalnız HTTPS'te (ya da localhost'ta) çalışır.
3. Alt klasörde de çalışır (ör. `site.com/foy/`), çünkü bütün yollar göreli.

Yerelde denemek için: `python -m http.server 8080` → http://localhost:8080

## Güncelleme
Dosyaları değiştirdikten sonra `sw.js` içindeki `VERSION` değerini artırın (ör. `v1.0.1`). Açık uygulamada "Yeni sürüm hazır → Yenile" bildirimi çıkar.

## Dosyalar
- `index.html`, `css/app.css`: kabuk ve stiller (A4 baskı stilleri dahil)
- `js/render.js`: A4 sayfa motoru. Önizleme ve baskı aynı sayfaları kullanır.
- `js/views/`: başla, marka, soru havuzu (PDF kırpma), belge editörü, sınavlar
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA parçaları

## Notlar
- PDF'ten kırpma pdf.js'i ilk kullanımda jsDelivr'dan indirir, sonra çevrimdışı da çalışır. Görsel dosyalar her zaman açılır.
- Sitede sıkı bir CSP varsa `script-src` ve `connect-src`'ye `https://cdn.jsdelivr.net` ekleyin.
- "Ekrandan sınav" aynı cihazda çalışır (tablet, akıllı tahta, okul bilgisayarı). Öğrencilerin kendi telefonlarından girmesi için bir sunucu gerekir.
- Yedekleme: Belgelerim → "Tümünü yedekle" ile alınan JSON dosyası başka cihazda "Yedeği aç" ile yüklenir.
