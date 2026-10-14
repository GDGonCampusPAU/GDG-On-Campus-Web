# GDG On Campus PAU Hackathon Sitesi

React 18 + Vite. Türkçe, düz CSS.

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu
npm test         # birim testleri
npm run build    # üretim derlemesi (dist/)
npm run check:layout  # derlemeyi gerçek Chrome'da 3 boyutta ölçer (hero düzeni, boşluk, yatay taşma)
```

## İçeriği değiştirme

Etkinlik adı, tarih, ödül, program, jüri/mentor ve sponsorlar yalnızca `src/data/event.js` içindedir.

## Font ve logo dosyaları

- Google Sans ve Google Sans Mono dosyalarını brand guide'daki Download bağlantılarından indirip
  `public/fonts/` içine şu adlarla koy: `GoogleSans-Regular.woff2`, `GoogleSans-Bold.woff2`,
  `GoogleSansMono-Regular.woff2`, `GoogleSansMono-Bold.woff2`. Yoksa `system-ui` / `ui-monospace` kullanılır.
- Sponsor logolarını `public/logos/` içine koyup `event.js` içindeki `logo: '/logos/dosya.png'` alanına yaz.
- Kişi fotoğrafları için `photo: '/logos/kisi.jpg'` benzeri bir yol kullan.

## Kayıt formu

`.env` dosyasında `VITE_REGISTER_ENDPOINT` tanımlıysa form JSON POST eder (gövde: normalize edilmiş form alanları).
Geliştirme sunucusunda tanımlı değilse istek atılmaz ve başarı ekranı gösterilir; üretim derlemesinde tanımlı değilse form hata gösterir (kayıt sessizce kaybolmaz).

### Backend sözleşmesi

Backend yazılırken form şu isteği atar. Adres `VITE_REGISTER_ENDPOINT` ile verilir, başka bir ayar gerekmez.

- `POST`, `Content-Type: application/json`, `Accept: application/json`, 15 saniye zaman aşımı.
- Gövde alanları. Hepsi string, `interests` dizi. Değerleri `src/lib/registration.js` içindeki seçenek listelerinden gelir.
  - `fullName`, `email` (küçük harf), `phone` (boşluksuz, `+` ve rakam), `department`
  - `year`: `prep`, `1`, `2`, `3`, `4`, `grad`
  - `teamRole`: `founder`, `member`, `looking`
  - `teamName` (`teamRole` `looking` ise boş olabilir), `teammates` (serbest metin, boş olabilir)
  - `interests`: `web`, `mobile`, `ai`, `game`, `cloud` değerlerinden en az biri
  - `level`: `beginner`, `intermediate`, `advanced`
- Başarı için herhangi bir 2xx yeterlidir, gövde okunmaz. Başka durumda form "Sunucu hatası (kod)" gösterir ve kullanıcı yeniden dener.
- Aynı e-posta ikinci kez gelirse backend karar verir. Form çift tıklamayı engeller ama sayfa yenilenince yeniden gönderebilir.

## Yayına almadan önce

- Barındırma sağlayıcısının derleme ortamında `VITE_REGISTER_ENDPOINT` tanımla. Tanımlı değilse form
  "Kayıt şu an alınamıyor" hatası verir.
- Endpoint `Content-Type: application/json` kabul etmeli ve site origin'inden gelen CORS isteklerine izin vermelidir.
  İstek `Accept: application/json` başlığını ve 15 saniyelik zaman aşımını içerir (Formspree bu başlığı ister).
- Vite `.env` dosyasını geliştirme sunucusu başlarken ve derleme sırasında okur; değiştirdikten sonra yeniden başlat.

## Yayınlama notu

Uygulama `BrowserRouter` kullanır; statik barındırmada tüm rotaların `index.html`'e düşmesi (SPA fallback) gerekir.
Üç yaygın barındırıcı için hazır gelir.

- Netlify ve Cloudflare Pages `public/_redirects` dosyasını okur.
- Vercel `vercel.json` içindeki `rewrites` kuralını okur.
- GitHub Pages rewrite bilmez, `npm run build` `dist/index.html` dosyasını `dist/404.html` olarak da kopyalar.

## Açık sorular

- **KVKK.** Kayıt formunda şu an onay kutusu ve aydınlatma metni yok (bilinçli olarak kaldırıldı). Katılımcıdan kişisel veri
  (ad, e-posta, telefon) toplanıyor. Gerçek kayıt açılmadan önce aydınlatma metni ve açık rıza gerekip gerekmediğine karar verilmeli.
