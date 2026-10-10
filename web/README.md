# GDG On Campus PAU Hackathon Sitesi

React 18 + Vite. Türkçe, düz CSS.

## Çalıştırma

```bash
npm install
npm run dev      # geliştirme sunucusu
npm test         # birim testleri
npm run build    # üretim derlemesi (dist/)
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
Tanımlı değilse istek atılmaz ve başarı ekranı gösterilir.

## Yayına almadan önce

- Barındırma sağlayıcısının derleme ortamında `VITE_REGISTER_ENDPOINT` tanımla. Tanımlı değilse kayıtlar
  hiçbir yere gönderilmez, ancak kullanıcı yine de başarı ekranını görür.
- Endpoint `Content-Type: application/json` kabul etmeli ve site origin'inden gelen CORS isteklerine izin vermelidir.
  Formspree ayrıca `Accept: application/json` başlığı ister; mevcut kod bu başlığı göndermez, seçmeden önce kontrol et.
- KVKK onay metninin bağlı bir aydınlatma metni henüz yok. Gerçek veri toplamadan önce gerçek metni ekle.
- Vite `.env` dosyasını geliştirme sunucusu başlarken ve derleme sırasında okur; değiştirdikten sonra yeniden başlat.

## Yayınlama notu

Uygulama `BrowserRouter` kullanır; statik barındırmada tüm rotaların `index.html`'e düşmesi (SPA fallback) gerekir.
