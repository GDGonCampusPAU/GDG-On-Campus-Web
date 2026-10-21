# Hackathon etkinlik sitesi

Eski `web/` uygulaması bu dizine taşındı. Node 24, React 18 ve Vite kullanır. Kökten `npm run dev:hackaton` veya bu dizinde `npm run dev` ile http://localhost:5173 adresinde çalışır. Panel http://localhost:5174, API http://localhost:5000 adresindedir.

İlk kurulumda `.env.example` değerlerini yerel `.env` dosyasına alın. `VITE_API_URL` API köküdür; üretimde aynı origin proxy'si yoksa build sırasında açıkça tanımlanmalıdır. `VITE_GOOGLE_CLIENT_ID` backend `GOOGLE_CLIENT_ID` ile eşleşir; Google Console authorized JavaScript origins ayrıca ayarlanır. E-posta OTP, Google ayarı olmadan kullanılabilir. Google entegrasyonu [resmi JavaScript referansındaki](https://developers.google.com/identity/gsi/web/reference/js-reference) `initialize` ve `renderButton` akışını kullanır.

Site içerikleri `/api/v1/event-page/hackathon` üzerinden yüklenir. İlk kurulum şablonu `shared/hackathon-event.json` dosyasıdır. Sunucu mevcut yayın varsa şablonla üzerine yazmaz. API kapalıysa site hata ve tekrar deneme ekranı gösterir.

`/kayit` katılımcı e-posta/Google doğrulamasından sonra formu açar. E-posta alanı doğrulanmış adresten doldurulur. Başvuru `hackathon-katilim` formuna Bearer token ile gider; başarı için API kayıt kimliği beklenir. Adres/token olmadan geliştirmede de sahte başarı gösterilmez. Oturum süresi dolarsa yeniden doğrulama istenir; girilmiş form değerleri bellekte korunur.

`/admin` gerçek Core Team ADMIN/ORGANIZER hesabıyla açılır. Kaydet yerel taslak saklar; Yayınla sunucuya kalıcı yazar ve form alanlarını aynı transaction'da günceller. Başka editör değişiklik yaptıysa eski sürümün yayını 409 ile reddedilir. Tarayıcıya gömülü yönetici parolası yoktur.

Fontlar repodaki mevcut TTF dosyalarından `public/fonts/` altına alındı. Sponsor logoları ve kişi fotoğrafları editörden URL verilerek eklenir; mevcut yer tutucu içerikler etkinlik ekibi tarafından gerçek içerikle değiştirilmelidir.

Komutlar: `npm test`, `npm run lint`, `npm run build`. Build `dist/` ve SPA fallback `404.html` üretir. Netlify/Cloudflare `_redirects`, Vercel rewrite dosyası korunur. Yayında `/kayit`, `/admin` gibi rotaları yenilemenin çalıştığını ayrıca doğrulayın. `npm run check:layout` mevcut özel layout aracıdır; canlı API bağlantısı ve Chrome gerektirir. Asıl tarayıcı regresyon testleri kökten `npm run test:e2e` ile çalışır.

Kişisel veri metinleri, gerçek sponsorlar/tarih ve kayıtların saklama süresi organizasyonun yayın öncesi içerik kararlarıdır.
