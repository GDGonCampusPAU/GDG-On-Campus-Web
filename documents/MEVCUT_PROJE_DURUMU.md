# Mevcut proje durumu

21 Ekim 2026. Bu belge önceki 12 Ekim incelemesinin yerine güncel durumu anlatır.

| Dizin | Sorumluluk |
| --- | --- |
| `frontend/` | Ekip kaydı, OTP, giriş, yönetici onayı, başvuru listesi ve CSV |
| `frontend/hackaton/` | Etkinlik sitesi, katılımcı doğrulaması, başvuru ve yetkili içerik editörü |
| `backend/` | Ekip/katılımcı kimlikleri, içerik ve form API'si, kota ve dosyalar |
| `shared/` | Başlangıç etkinlik şablonu ve istemci/sunucu ortak içerik doğrulayıcısı |
| `e2e/` | Gerçek Chromium, izole API ve geçici replica set ile tarayıcı regresyonları |

Eski `web/` taşındı. Yeni başvurular `FormResponse` içinde, eski takım başvuruları `HackathonApp` içinde kalır. Panel kaynak seçimiyle ikisini de gösterebilir; canlı veride toplu taşıma/silme yapılmadı.

Düzeltildi: eksik ekip/hackathon OTP metotları, hash/tek kullanımlılık/deneme/cooldown, PENDING şema uyumsuzluğu, eski hackathon şema/API uyumsuzluğu, admin onay API ve ekranı, güvenli seed, çoklu-origin CORS, özel dosya indirme ve upload doğrulaması, form alan doğrulaması, transaction ile silme, şema değişse de export, CSV/arama korumaları, cursor export, gerçek katılımcı form entegrasyonu, sunucuda yetkili ve sürümlü içerik yayını, panel lint hatası ve font dosyaları.

Yerel doğrulama:

- `npm run check`: üç paketin lint kontrolü, 37 backend testi, 7 panel testi, 210 etkinlik sitesi testi ve iki üretim build'i geçti.
- `npm run test:e2e`: doğrulanmış başvuru → panel → CSV, ekip kaydı → admin onayı → giriş, içerik yayınının ikinci sekmede görünmesi ve 3 ekran boyutunda layout olmak üzere 4 Chromium testi geçti.
- `docker compose up -d --build --wait`: dört servis izole test projesinde sağlıklı başladı. Chromium ile API/CORS, panel, hackaton kayıt ve admin ekranları doğrulandı. MongoDB 8.0.34 rs0 primary; per-CPU cache kapalı ve restart sayısı 0. Gerçek mevcut veritabanına seed/migration uygulanmadı.
- Testler gerçek `.env`, gerçek veri tabanı ve e-posta/Google hesaplarından ayrıdır.

Dış ortamda tamamlanacak kabul kontrolleri: gerçek Google hesabıyla origin/client ID eşleşmesi, gerçek Brevo teslimatı, deployment origin/proxy/SPA ayarları, gerçek içerikler ve organizasyonun veri metinleri, DB + upload yedeğinin ayrı test ortamına geri yüklenmesi. Lokal test başarısı bu kontrollerin yerine geçmez.

Başlangıç: [kök README](../README.md), [kurulum](KURULUM.md), [API](API.md), [mimari](architecture.md), [güvenlik ve dosyalar](GUVENLIK_VE_DOSYALAR.md). İlk inceleme ve aşamalar [test planında](IYILESTIRME_VE_TEST_PLANI.md) korunur.
