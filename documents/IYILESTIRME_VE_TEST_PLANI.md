# Proje İyileştirme Yol Haritası ve Test Planı

> **Güncelleme (10 Kasım 2026 — `dev` / `3723e57` incelemesi):** Önceki 21 Ekim belgesinin 1. bölümünde yer alan tarihsel `web/` (206 test) ve `Applications.jsx` lint hatası notları `dev` dalındaki gerçek kodla güncellenmiştir. Bu belge, blok bazlı yeni kod taramasında tespit edilen açık sorunları ([SORUNLAR.md](SORUNLAR.md)) çözmek için **en kritik noktadan (`P0`) en düşük önceliğe (`P3`)** sıralı yol haritasını ve bu yol haritası ile sitenin kalanı için hazırlanan iki katmanlı test mimarisini tanımlar.

---

## 1. Güncel Yapı ve Doğrulama Temeli (`dev` / `3723e57`)

| Parça | Gerçek Sorumluluk | Temel Doğrulama Sonucu (`npm run check` + E2E) |
| --- | --- | --- |
| `backend/` | Ekip auth, katılımcı doğrulama, form/başvuru transaction API'si, sürümlü `EventPage`, `Content` CMS ve legacy hackathon modülü | **37/37** test geçti (`node:test` + `MongoMemoryReplSet` 7.0.24), ESLint **0** hata |
| `frontend/` | Core Team yönetim paneli (Hash tabanlı route: Giriş, Kayıt/OTP, Başvurular, CSV, Özel dosya, Kullanıcı Onayı) | **7/7** test geçti (`Vitest`), build ve ESLint **0** hata |
| `frontend/hackaton/` | Etkinlik vitrin sitesi, çok adımlı başvuru, katılımcı doğrulaması ve `/admin` canlı yayın editörü | **210/210** test geçti (`Vitest`, async `act(...)` stderr uyarılı), build ve ESLint **0** hata |
| `shared/` & `e2e/` | Ortak etkinlik şablonu + şema doğrulayıcısı; Chromium + izole MongoDB `rs0` uçtan uca regresyon | **4/4** Playwright E2E geçti |

### Tarihsel Özet (12 Ekim → 21 Ekim 2026)

12 Ekim ilk incelemesinde tespit edilen ekip `VerificationToken` kırığı, `PENDING` rol reddi, `web/` bağlantısız başvuru formu, statik `/admin` kilidi, public `/uploads` CV sızıntısı ve kök CI eksikliği 21 Ekim güncellemeleriyle (`84d0d21`..`3723e57`) giderilmiştir. Buna karşılık hem ilk fazda belgelenmemiş yeni bug'lar hem de merge sırasında düşen bir DB indeksi tespit edilmiştir.

---

## 2. Önceliklendirilmiş İyileştirme Yol Haritası (`P0 → P3`)

Mimari ilke: Mevcut katman sınırları (`backend/src/{models,controllers,services,modules}`, `shared/`, `frontend/`, `frontend/hackaton/`) korunur; büyük yeniden yazım yerine mevcut modüllere doğrudan oturan, atomik ve test güdümlü düzeltmeler uygulanır.

### P0 — Canlıya Çıkış Engelleri (Veri Bütünlüğü, Güvenlik, Hukuk, Altyapı)

1. **`P0.1` `FormResponse` Partial Unique İndeks Regresyonunun Geri Getirilmesi**
   - **Dosya:** [`backend/src/models/FormResponse.js`](../backend/src/models/FormResponse.js)
   - **Çözüm:** `{ form: 1, singleSubmissionKey: 1 }` alanına `{ unique: true, partialFilterExpression: { singleSubmissionKey: { $type: 'string' } } }` indeksini geri ekleyin; canlı veritabanında indeks oluşturma/migration adımını belgeleyin.
   - **Kabul Kriteri:** `FormResponse.collection.getIndexes()` içinde indeks tanımlı olmalı ve aynı `(form, singleSubmissionKey)` ham DB yazımı `E11000` vermelidir.

2. **`P0.2` E-posta OTP Şablonlarında HTML / Phishing Enjeksiyonunun Kapatılması**
   - **Dosya:** [`backend/src/services/emailService.js`](../backend/src/services/emailService.js)
   - **Çözüm:** `generateOtpTemplate`, `sendRegistrationOtpEmail` ve `sendHackathonOtpEmail` içindeki `fullName`, `teamName`, `leaderName` değerlerini strict `escapeHtml` ile kaçışlayın; e-posta `subject` alanından `\r\n` temizleyin.
   - **Kabul Kriteri:** `<a href=...>` veya `<script>` içeren kullanıcı girdisi e-posta gövdesinde işlenmeden (`&lt;`) metin olarak yer almalıdır.

3. **`P0.3` `/kayit` Formuna KVKK Aydınlatma ve Açık Rıza Onayı Eklenmesi**
   - **Dosyalar:** [`shared/hackathon-event.json`](../shared/hackathon-event.json), [`frontend/hackaton/src/data/base.js`](../frontend/hackaton/src/data/base.js), [`frontend/hackaton/src/components/StepForm.jsx`](../frontend/hackaton/src/components/StepForm.jsx)
   - **Çözüm:** Başvuru adımlarının sonuna (veya Onay adımına) aydınlatma metni bağlantılı zorunlu `kvkkConsent` checkbox alanı ve sunucu doğrulaması ekleyin; onaysız gönderimi reddedin.
   - **Kabul Kriteri:** KVKK onayı işaretlenmeden form gönderimi engellenmeli, işaretlendiğinde rıza cevabı `FormResponse` içinde saklanmalıdır.

4. **`P0.4` Production Dağıtım Altyapısı, Gerçek İçerik ve Dış Kabul Kontrolleri**
   - **Dosyalar:** Production `Dockerfile` + reverse proxy (`Nginx`/PaaS), gerçek `.env`, [`shared/hackathon-event.json`](../shared/hackathon-event.json), Git `main` ↔ `dev` senkronizasyonu.
   - **Çözüm:** Geliştirme odaklı `nodemon`/`vite` imajı yerine multi-stage statik build + `node src/server.js` üretim imajı kurun; yerel `.env` şablonunu düzeltin; gerçek etkinlik içeriği + gerçek Google Web Client ID + doğrulanmış Brevo domain + DB & `uploads/` yedek/geri yükleme tatbikatını tamamlayın; kullanıcı onayıyla `main` dalını güncelleyin.

---

### P1 — Çekirdek Ürün Özellikleri ve Backend Sağlamlaştırma

5. **`P1.1` Etkinlik Başvuru Formunun `file`, `number`, `radio`, `date` Alanlarını Desteklemesi**
   - **Dosyalar:** [`shared/eventContent.mjs`](../shared/eventContent.mjs), [`frontend/hackaton/src/components/Field.jsx`](../frontend/hackaton/src/components/Field.jsx), [`frontend/hackaton/src/components/StepForm.jsx`](../frontend/hackaton/src/components/StepForm.jsx), [`frontend/hackaton/src/lib/registration.js`](../frontend/hackaton/src/lib/registration.js), [`frontend/hackaton/src/pages/Admin.jsx`](../frontend/hackaton/src/pages/Admin.jsx)
   - **Çözüm:** `choices.kind` içine backend'deki `formFieldTypeMap` ile uyumlu türleri ekleyin; dosya varsa `registration.js` içinde `FormData` (`answers` + dosya field'ları) oluşturun.

6. **`P1.2` `Content` CMS Dosya Sızıntısı, XSS URL Kontrolü ve Tip Doğrulaması**
   - **Dosyalar:** [`backend/src/controllers/contentController.js`](../backend/src/controllers/contentController.js), [`backend/src/controllers/formController.js`](../backend/src/controllers/formController.js)
   - **Çözüm:** `updateContent` ve `deleteContent` sırasında eski `/uploads/public/<dosya>` varlıklarını diskten silin; göreli `/uploads/public/...` veya geçerli `https?://` dışındaki (`javascript:`) `coverImageUrl` / `bevyLink` değerlerini `400` ile reddedin; string olmayan opsiyonel alanlarda `500 TypeError` yerine `400` döndürün.

7. **`P1.3` `main.jsx` Açılış SPOF'unun Kaldırılması**
   - **Dosya:** [`frontend/hackaton/src/main.jsx`](../frontend/hackaton/src/main.jsx)
   - **Çözüm:** `/admin` rotasını ilk `loadEvent()` isteğine bağımlı olmaktan çıkarın; API erişilemediğinde `base` veya kurtarma uyarılı rota bağlayarak editör erişimini ve yeniden deneme akışını koruyun.

8. **`P1.4` Legacy Hackathon Export Arama Filtresinin Uygulanması**
   - **Dosya:** [`backend/src/modules/hackathon/controllers/hackathonController.js`](../backend/src/modules/hackathon/controllers/hackathonController.js)
   - **Çözüm:** `exportApplications` içinde `req.query.search` parametresini `getApplications` ve `formController.exportFormResponses` ile aynı `literalSearch` filtresi üzerinden çalıştırın.

9. **`P1.5` Auth, Kullanıcı Sayfalama ve Seed Tutarlılığı**
   - **Dosyalar:** [`backend/src/controllers/authController.js`](../backend/src/controllers/authController.js), [`backend/src/routes/userRoutes.js`](../backend/src/routes/userRoutes.js), [`backend/src/utils/seed.js`](../backend/src/utils/seed.js)
   - **Çözüm:** `/auth/verify-email` içinde önce kullanıcı varlığını doğrulayıp sonra `verifyOtp` çağırın; `GET /users` pagination zarfına `totalItems`, `limit`, `hasNextPage`, `hasPrevPage` ekleyin; `PASSWORD_RESET` + `tokenVersion` ekleyin ve `seed.js` akışını `ensureHackathonPage` ile hizalayın.

---

### P2 — Yönetici / Core Team UX ve Yetim Modüllerin Netleştirilmesi

10. **`P2.1` `/admin` Editör Güvenirliği ve Şema Sıkılaştırması**
    - **Dosyalar:** [`frontend/hackaton/src/pages/Admin.jsx`](../frontend/hackaton/src/pages/Admin.jsx), [`shared/eventContent.mjs`](../shared/eventContent.mjs)
    - **Çözüm:** `serverEvent` durumunu koruyarak `Taslağı sıfırla` işlemini son yayınlanan sunucu sürümüne bağlayın; `409 Conflict` yanıtında güncel `revision`'ı yeniden yükleme akışı sunun; açılışta `/auth/me` doğrulayın; sponsor/jüri/mentor adlarında boş string (`""`) reddini ekleyin; eski `UNLOCK_KEY` yorumunu temizleyin ve form kota/tarih ayarlarını bağlayın.

11. **`P2.2` Core Team Paneli UI/UX Düzeltmeleri (`Applications.jsx`, `Users.jsx`, `api.js`)**
    - **Dosyalar:** [`frontend/src/pages/Applications.jsx`](../frontend/src/pages/Applications.jsx), [`frontend/src/pages/Users.jsx`](../frontend/src/pages/Users.jsx), [`frontend/src/lib/api.js`](../frontend/src/lib/api.js)
    - **Çözüm:** Dinamik formda `phone` yoksa `tel:undefined` linkini, `projectIdea` yoksa boş `<details>` kutusunu gizleyin; `downloadPrivateFile` içinde geçersiz URL ayrıştırmasını `ApiError`'a sarın ve legacy harici `https://` özgeçmiş linklerini güvenli şekilde açın; `Users.jsx` içine `?role=PENDING` filtresi + boş durum mesajı + `totalPages > 1` sayfalama kontrolü ekleyin.

12. **`P2.3` Atıl/Yetim Backend Modülleri Kararı (`Content`, Çoklu Form, `Team.js`)**
    - **Çözüm:** Ürün kararı netleştirilir: genel GDG portalına geçilecekse `frontend/` paneline `react-router-dom` + İçerik/Form yönetimi eklenir; sadece hackathon yayını yapılacaksa `Team.js` / `User.permissions` / `LOGIN_2FA` atıl şemaları temizlenir.

---

### P3 — Performans, DX ve Varlık Cilası

13. **`P3.1` Windows Geliştirici Komutlarının Düzeltilmesi**
    - **Dosyalar:** [`scripts/dev.mjs`](../scripts/dev.mjs), [`frontend/hackaton/scripts/check-layout.mjs`](../frontend/hackaton/scripts/check-layout.mjs)
    - **Çözüm:** `process.platform === 'win32' ? 'npm.cmd' : 'npm'` seçimi ve Windows alt süreç ağacı sonlandırma (`taskkill /pid <pid> /T /F`) ekleyin.

14. **`P3.2` Statik Varlık ve SEO İyileştirmeleri**
    - **Dosyalar:** [`frontend/hackaton/public/fonts/`](../frontend/hackaton/public/fonts/), [`frontend/hackaton/index.html`](../frontend/hackaton/index.html)
    - **Çözüm:** 4,27 MB ham `.ttf` fontlarını alt kümeli `.woff2` formatına indirin; favicon ve `og:image` ekleyin.

---

## 3. İki Katmanlı Test Stratejisi ve Test Matrisi

Bu incelemede yalnızca düzeltilen kısımları değil, sitenin tamamını ve yol haritasının kabul kriterlerini ölçen **iki katmanlı** gerçek/işlevsel test suite'i kurulmuştur:

### Katman 1 — Regresyon ve Site Kapsam Paketi (`npm run check`)

Her commit ve CI koşumunda çalışması beklenen, mevcut davranışları ve yeni kapatılan boşlukları doğrulayan **geçer durumda** testler (`44` backend + `24` panel + `221` etkinlik sitesi, `0` ESLint/build/`act` uyarısı + `4` E2E):

| Paket | Yeni / Genişletilen Dosyalar | Test Edilen Gerçek Davranışlar |
| --- | --- | --- |
| `backend/` | `tests/content-and-forms-lifecycle.test.js`<br>`tests/auth-users-and-hackathon-edges.test.js` | `Content` CRUD, public PNG upload + imza/SVG reddi + disk temizliği, `Form` CRUD (`slug` tekilleştirme, tarih/sayı sınırları, 403/404/409 durumları, dosya yüklerken 400/409 disk temizliği), `/files/:filename` traversal/dotfile/cache headers, `export` format validation & JSON stream, `verify-email` akışı, `MEMBER`/`ORGANIZER`/`ADMIN` RBAC sınırları, `ENABLE_HACKATHON_MODULE=false` izolasyonu, legacy başvuru/export CSV formül kaçışı |
| `frontend/` | `src/App.test.jsx`<br>`src/lib/api.test.js`<br>`src/lib/validation.test.js`<br>`src/pages/Applications.test.jsx`<br>`src/pages/Auth.test.jsx` | Hash yönlendirme & `ADMIN`/`ORGANIZER`/`MEMBER` yetki yönlendirmeleri, `downloadPrivateFile` cross-origin token sızıntı engeli (SSRF/path koruma), `getHackathonApplications` `formId` zinciri, 350ms arama debounce yarışı & sayfa sıfırlama, CSV blob indirme & hata mesajları, `Login` doğrulanmamış hesap → `OtpForm` → giriş, `Register` istemci doğrulama & odaklanma & cooldown, `Users` self-select engeli |
| `frontend/hackaton/` | `src/lib/eventApi.test.js`<br>`src/pages/NotFound.test.jsx`<br>`src/components/Field.test.jsx`<br>`src/components/StickyCta.test.jsx`<br>`src/pages/Register.test.jsx`<br>`src/components/ParticipantVerification.test.jsx`<br>`src/pages/Admin.test.jsx` | `loadEvent` şema bozulmalarında red, `loginEditor` `MEMBER`/`PENDING` reddi, `Register` 401 sonrası tekrar doğrulamada `draftValues` korunması, `ParticipantVerification` şema yükleme hatası/yeniden dene, e-posta değiştirme, çift tıklama kilidi, eksik Google Client ID mesajı; `Admin` canlı yayın → revizyon artışı/taslak temizliği, `409` çakışması, `401` oturum kilitleme, yükleme hatasında `Yayınla` devre dışı kalması (ve `act(...)` uyarılarının giderilmesi) |

### Katman 2 — Yol Haritası Kabul Kapıları (`npm run test:roadmap`)

Yol haritasındaki **P0 → P2** maddeleri için **TDD / Kabul Testi** olarak yazılmıştır (`5` backend + `3` panel + `4` etkinlik sitesi = **12 kabul kapısı**). Uygulama kodundaki açık bug'lar nedeniyle **`dev` üzerinde fail vermeleri beklenir**; ilgili yol haritası adımı kodlandığında bu kapılar otomatik olarak **pass** durumuna geçmelidir:

| Kapı | Test Konumu | Doğrulanan Bug / Yol Haritası Gereksinimi |
| --- | --- | --- |
| `P0.1` | `backend/tests/roadmap/p0-p3-roadmap.roadmap.test.js` | `FormResponse` üzerinde `singleSubmissionKey` partial unique indeksi ve DB `E11000` koruması |
| `P0.2` | `backend/tests/roadmap/p0-p3-roadmap.roadmap.test.js` | `emailService` HTML template enjeksiyon kaçışı |
| `P1.2` | `backend/tests/roadmap/p0-p3-roadmap.roadmap.test.js` | `Content` güncelleme/silmede eski local dosya `unlink`, `javascript:` URL reddi, non-string tip kontrolü |
| `P1.4` | `backend/tests/roadmap/p0-p3-roadmap.roadmap.test.js` | Legacy `GET /hackathon/applications/export?search=...` arama filtresi |
| `P1.5` | `backend/tests/roadmap/p0-p3-roadmap.roadmap.test.js` | `GET /users` tam sayfalama nesnesi (`totalItems`, `limit`, `hasNextPage`, `hasPrevPage`) & `/verify-email` 404 öncesi OTP koruma |
| `P0.3` & `P1.1` & `P2.1` | `frontend/hackaton/roadmap-tests/hackaton.roadmap-test.jsx` | `/kayit` zorunlu KVKK rıza kutusu, `file`/`number` alan desteği, `Admin` `Taslağı sıfırla`'nın sunucu verisine dönmesi ve `isEventShape` boş isim reddi |
| `P2.2` | `frontend/roadmap-tests/panel.roadmap-test.jsx` | `Applications.jsx` `tel:undefined` ve boş `Proje fikri` gizleme; `Users.jsx` rol filtresi, boş durum ve tek sayfa pager kontrolü; `downloadPrivateFile` temiz `ApiError` |

### Hedef Ölçüt

- `npm run check` ve `npm run test:e2e` **her zaman yeşil** kalır (sıfır regresyon).
- Her yol haritası görevi tamamlandıkça ilgili `test:roadmap` kapısı kırmızıdan yeşile çevrilir; tüm `P0` ve `P1` kapıları yeşil olmadan ve dış kabul kontrolleri imzalanmadan canlıya (`main`) çıkılmaz.
