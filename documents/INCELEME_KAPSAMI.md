# İnceleme kapsamı ve kaynak haritası

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Kaynak kod incelemesi: 11 Ekim 2026, sürüm `d218156`. Canlı API ve veritabanı testi yapılmadı. Belgelerin ayrılması: 12 Ekim 2026.

İncelemede bütün router'lar, controller'lar, modeller, middleware'ler, seed, e-posta servisi, app/server, frontend başlangıç ekranı ve package dosyaları okundu. API bilgileri README ile sınırlı bırakılmadı; route mount ve controller davranışı esas alındı.

Runtime/API/DB entegrasyon testi yapılmadı. İnceleme ortamında proje dizinlerinde `node_modules` yoktu; bağımlılık kurulumu, seed, gerçek e-posta ve veri yazma işlemi yapılmadı. Belge hazırlama sırasında kaynak uygulama değiştirilmedi.

| Konu | Ana kaynak |
| --- | --- |
| HTTP mount, health, CORS ve rate limit | [`app.js`](../backend/src/app.js) |
| Başlangıç ve DB bağlantısı | [`server.js`](../backend/src/server.js), [`db.js`](../backend/src/config/db.js) |
| Auth yolları ve davranışı | [`authRoutes.js`](../backend/src/routes/authRoutes.js), [`authController.js`](../backend/src/controllers/authController.js) |
| İçerik API'si | [`contentRoutes.js`](../backend/src/routes/contentRoutes.js), [`contentController.js`](../backend/src/controllers/contentController.js) |
| Form API'si | [`formRoutes.js`](../backend/src/routes/formRoutes.js), [`formController.js`](../backend/src/controllers/formController.js) |
| Hackathon API'si | [`hackathonRoutes.js`](../backend/src/modules/hackathon/routes/hackathonRoutes.js), [`hackathonController.js`](../backend/src/modules/hackathon/controllers/hackathonController.js) |
| Şemalar | [`models/`](../backend/src/models/), [`HackathonApp.js`](../backend/src/modules/hackathon/models/HackathonApp.js) |
| Auth / rol / upload / hata | [`middleware/`](../backend/src/middleware/) |
| OTP e-posta servisi | [`emailService.js`](../backend/src/services/emailService.js) |
| Seed | [`seed.js`](../backend/src/utils/seed.js) |
| Frontend'in mevcut ekranı | [`App.jsx`](../frontend/src/App.jsx) |
| Hedefler ve taslak kararlar | [`proje_taslagi_v2.md`](proje_taslagi_v2.md) |
