# Core Team yönetim paneli

Node 24 + React/Vite. `frontend/` yönetim paneli, `frontend/hackaton/` ayrı etkinlik uygulamasıdır. Kök dizindeki `npm run setup` bütün bağımlılıkları kurar; `npm run dev` API ve iki ön yüzü birlikte başlatır.

Bu dizinde `npm run dev` paneli http://localhost:5174 adresinde açar. `.env.example` içindeki `VITE_API_URL` API kök adresidir; `/api/v1` eklemeyin. Üretimde ayrı API origin'i kullanılıyorsa build ortamında tanımlanmalı; aynı origin kullanımında sunucu `/api/v1` isteklerini API'ye yönlendirmeli.

- Ekip kaydı e-posta OTP ve ADMIN onayı ister. Kayıt ve katılımcı hesabı birbirinden ayrıdır.
- ADMIN, `#/users` üzerinden üyeleri sayfalayabilir ve rol/onay verebilir. Kendi rolünü değiştiremez.
- ADMIN/ORGANIZER `#/applications` üzerinden yeni site başvurularını görür, arar ve CSV indirir. Kaynak seçimiyle eski takım başvurularına ulaşır.
- Özel dosyalar Authorization başlığıyla indirilir; token dış origin'lere gönderilmez.
- MEMBER hesabı giriş yapabilir, yönetim listelerine erişemez. API, arayüzden bağımsız yetki kontrolü uygular.

`npm test`, `npm run lint`, `npm run build` komutları vardır. Panel testleri API mock kullanır; kökteki Playwright testleri gerçek tarayıcı ve izole API/veritabanıyla bütün akışı doğrular.
