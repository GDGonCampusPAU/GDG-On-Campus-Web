# İnceleme kapsamı ve kaynak haritası

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

**Güncelleme:** 12 Ekim 2026. Belgeler `feature/participant-verification` çalışma ağacını anlatır. İlk inceleme `d218156` üzerindeydi; özellik dalı yerel dev’in `a582604` commit’inden türedi. Mevcut belgeler yalnız ilk incelemenin arşivi değildir.

## Yapılan doğrulama

- Router, controller, model, middleware, config, seed ve frontend iskeleti kaynak üzerinden incelendi.
- Backend bağımlılıkları kuruldu; `npm test` ile **20 test geçti**. Geçici MongoDB replica set kullanıldı; testler mevcut `.env` veya veri tabanını kullanmadı.
- Testler OTP hash/tek kullanımlılık/eşzamanlı tüketim, expiry/deneme/cooldown, token süresi ve tür ayrımı, yöntem kısıtı, anonim form, doğrulanmış kimlik, tek başvuru ve eşzamanlı kota senaryolarını kapsar.
- Google endpoint başarı testi adapter mock kullanır. Ayrı testlerde resmi kütüphanenin gerçek RSA imza, audience, issuer ve expiry doğrulaması çalışır; yalnız sertifika indirme yerel anahtarlarla değiştirilir.
- Yerel Docker MongoDB 8.0.32, kernel açılış hatasından sonra veri volume’ları korunarak rseq ayarıyla başlatıldı. rs0 primary, restart sayısı 0 ve veri değiştirmeyen okuma transaction kontrolü doğrulandı.

## Doğrulanmayan / açık olanlar

Gerçek Google hesabıyla eksiksiz tarayıcı akışı ve gerçek Brevo teslimatı doğrulanmadı. Kullanıcının tarayıcı denemesinde CORS ve Google origin hataları görüldü. Backend çoklu-origin düzeltmesi ve manuel araç iyileştirmeleri henüz uygulanmadı. Production deployment, frontend build, veri sayıları, tüm canlı indeksler, yedek/geri yükleme ve genel performans testi yapılmadı.

Bu turda yalnız dokümantasyon güncellendi; runtime testleri tekrar çalıştırılmadı. Belge bağlantıları, JSON örnekleri, uç nokta sayısı ve eski iddialar kontrol edildi.

## Kaynak haritası

| Konu | Ana kaynak |
| --- | --- |
| HTTP mount, health, CORS ve rate limit | [`app.js`](../backend/src/app.js) |
| Başlangıç / topology / indeksler | [`server.js`](../backend/src/server.js), [`db.js`](../backend/src/config/db.js) |
| Ekip auth | [`authRoutes.js`](../backend/src/routes/authRoutes.js), [`authController.js`](../backend/src/controllers/authController.js) |
| Katılımcı modülü | [`participantAuth/`](../backend/src/modules/participantAuth/) |
| Token ve OTP env kontrolü | [`config.js`](../backend/src/modules/participantAuth/config.js) |
| Form kimlik kontrolü | [`formParticipantMiddleware.js`](../backend/src/modules/participantAuth/middleware/formParticipantMiddleware.js) |
| Form API / alan doğrulama / export | [`formRoutes.js`](../backend/src/routes/formRoutes.js), [`formController.js`](../backend/src/controllers/formController.js) |
| Form transaction | [`formSubmissionService.js`](../backend/src/services/formSubmissionService.js) |
| İçerik | [`contentController.js`](../backend/src/controllers/contentController.js) |
| Hackathon | [`hackathonController.js`](../backend/src/modules/hackathon/controllers/hackathonController.js) |
| Modeller | [`models/`](../backend/src/models/), [`katılımcı modelleri`](../backend/src/modules/participantAuth/models/) |
| Otomatik testler | [`participant-flow.test.js`](../backend/tests/participant-flow.test.js), [`google-verification.test.js`](../backend/tests/google-verification.test.js) |
| Manuel araçlar | [`participant-auth.html`](../backend/tools/participant-auth.html), [`participant-flow.http`](../backend/tools/participant-flow.http) |
| E-posta / seed | [`emailService.js`](../backend/src/services/emailService.js), [`seed.js`](../backend/src/utils/seed.js) |
| Frontend | [`App.jsx`](../frontend/src/App.jsx) |
