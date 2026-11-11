# Sorunlar, Hatalar ve Kalan Kabul Kontrolleri

> **Güncelleme (11 Kasım 2026 — `dev` / `3723e57` incelemesi → `iyilestirme-ve-test` Çözüm Tamamlama, `b4fbf69` dahil):** Bu belge önce `dev` (`3723e57`) dalında tespit edilen **20 açık hatayı (Blok A–F)** kök nedenleriyle kayıt altına almıştır. Teamwork (M1–M5) çalıştırması ve `b4fbf69` Başvuru Durum İnceleme eklentisi sonrasında **kod ve altyapı düzeyindeki tüm maddeler `iyilestirme-ve-test` (ve `dev`) dalında çözülmüş**; Katman 1 (`check` `47+27+221 = 295`, `e2e` 4/4, `layout` 1/1), Katman 2 (`test:roadmap` 12/12) ve Challenger (`26+12 = 38`) toplam **350/350 doğrulama** yeşile dönmüştür. Ayrıntılı kapanış matrisi, kalan varlık/dış ortam ön koşulları ve tüm 30 maddelik güncel teknik rehber [CANLIYA_CIKIS_KONTROL_LISTESI.md](CANLIYA_CIKIS_KONTROL_LISTESI.md), [MEVCUT_PROJE_DURUMU.md](MEVCUT_PROJE_DURUMU.md) ve [Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md](../Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md) belgelerindedir.

## 0. `iyilestirme-ve-test` Güncel Çözüm Özeti (Blok A–F)

| Blok / Madde | Çözüm Durumu (`iyilestirme-ve-test`) | Özet & Kalan Not |
| --- | --- | --- |
| **Blok A (#1, #2)** | **ÇÖZÜLDÜ** | `FormResponse` `(form, singleSubmissionKey)` partial unique indeksi geri eklendi; atıl `Team.js`, `User.permissions` (`select: false`) ve `LOGIN_2FA` `@deprecated` olarak işaretlendi. |
| **Blok B (#3–#6)** | **ÇÖZÜLDÜ** | `emailService` `escapeHtml` + CRLF temizliği eklendi; `/auth/forgot-password` + `/auth/reset-password` + `tokenVersion` JWT iptali eklendi; `/verify-email` kullanıcı varlığını önceleyecek şekilde düzeltildi; `GET /users` tam 6 alanlı pagination döndürüyor. |
| **Blok C (#7–#9)** | **ÇÖZÜLDÜ** | `Content` güncelleme/silmede eski local `/uploads/public/` görseli `unlink` ediyor, `javascript:` URL ve non-string alanları 400 ile reddediyor; legacy hackathon export `?search=` filtresini uyguluyor; Content/Form CRUD API'lerinin Faz 2 kapsamı belgelendi (`TRUST_PROXY_HOPS` ile TLS arkasında `resolveCoverImageUrl` uyumlu). |
| **Blok D (#10–#15)** | **ANA KISIM ÇÖZÜLDÜ / VARLIK KALDI** | Step 4 zorunlu `kvkkConsent` eklendi (#10), `file`/`number`/`radio`/`date` + `FormData` desteklendi (#11), `main.jsx` API SPOF'u kaldırıldı (#12), `Admin.jsx` `serverEvent` sıfırlama & boş isim reddi eklendi (#13), `index.html` SEO/favicon etiketleri eklendi (#14) ve `act(...)` uyarıları temizlendi (#15). *Kalan canlı ön koşul/cila:* Resmi PAU KVKK link/modalı (#10), opsiyonel 409 auto-reload / `/auth/me` ön kontrolü (#13) ve ~4,31 MB (hackaton) / ~6,48 MB (panel) `.ttf` → `.woff2` dönüşümü + `favicon.svg` / `og-image.png` / gerçek etkinlik copy'si (#14). |
| **Blok E (#16–#17)** | **ÇÖZÜLDÜ** | `Applications.jsx` `tel:undefined` ve boş fikir kutusunu gizliyor, `https://` harici özgeçmişleri güvenli yeni sekmede açıyor, `downloadPrivateFile` `ApiError` fırlatıyor; `Users.jsx` rol filtresi (`PENDING`), boş durum ve tek sayfa pager gizleme uygulandı. |
| **Blok F (#18–#20)** | **KOD HAZIR / DIŞ KONTROL AÇIK** | Windows `npm.cmd` + `taskkill /T /F` uyumu (#18), multi-stage `Dockerfile` + `compose.prod.yaml` + `nginx/nginx.conf` + `.env.example` + `seed.js` hizalaması (#19) tamamlandı. Dış ortam (Google OAuth, Brevo DNS/key, yedek/restore tatbikatı ve `dev`/`main` merge onayı) canlıya çıkış öncesi kullanıcı/operasyon adımındadır (#20). |

---

## 1. 21 Ekim 2026 İtibarıyla Çözülen Alanlar

| Alan | Durum (`dev`) |
| --- | --- |
| Ekip OTP / `PENDING` / yönetici onayı | `VerificationToken` HMAC hash + tek kullanımlılık + `PENDING` rolü + `ADMIN` onay API/paneli tamamlandı |
| Hackathon klasörü | `web/` → `frontend/hackaton/` taşındı; ayrı Vite uygulaması olarak kökten yönetiliyor |
| Yeni site başvuruları | Katılımcı OTP/Google doğrulaması + `FormResponse` transaction kaydı + panel + CSV aynı kanalı kullanıyor |
| Eski başvurular | `HackathonApp` model/API uyumsuzluğu giderildi; panelde kaynak seçiciyle korunuyor |
| İçerik editörü | Gömülü parola kaldırıldı; ekip JWT (`ADMIN`/`ORGANIZER`) + `EventPage` sürümlü kalıcı yayın var |
| CV / form dosyaları | Public `/uploads` sunumu kapatıldı; `/api/v1/files/:filename` staff auth + uzantı/imza/adet/boyut kontrolü var |
| Form bütünlüğü (çekirdek) | Alan türü/seçenek/tarih/regex doğrulama, form silmede transaction ve eski soru etiketiyle CSV export var |
| Çalıştırma / kalite | Kök `npm run setup`, `lint`, `test`, `build`, `check`, GitHub CI ve 4 Playwright E2E testi çalışıyor |

---

## 2. Güncel Kod Tabanında Tespit Edilen Açık Hatalar ve Eksikler (Blok Blok)

### Blok A — Veritabanı ve Modeller (`backend/src/models/`)

1. **`FormResponse` üzerinde `singleSubmissionKey` partial unique indeksi kaybolmuş (Regresyon)**
   - **Konum:** [`backend/src/models/FormResponse.js`](../backend/src/models/FormResponse.js#L59-L103), [`documents/DATABASE.md`](DATABASE.md#L143)
   - **Neden:** 12 Ekim'de `873c05a` commit'inde eklenen `formResponseSchema.index({ form: 1, singleSubmissionKey: 1 }, { unique: true, partialFilterExpression: { singleSubmissionKey: { $type: 'string' } } })` indeksi, 15 Ekim `89be0c3` ("Database update") ve `c58696e` merge'i sırasında model dosyasından düşmüş. Ancak [`formSubmissionService.js`](../backend/src/services/formSubmissionService.js#L32) hâlâ alanı yazıyor ve `DATABASE.md` bu indeksin var olduğunu iddia ediyor.
   - **Etki:** Tekrarlı başvuru koruması yalnızca transaction içindeki `Form` kilidine dayanıyor; DB seviyesinde son savunma (partial unique index) fiilen mevcut değil.
   - **Çözüm:** `FormResponse.js` içine partial unique index tanımını geri ekleyin; `server.js` `init()` sırasında oluştuğunu otomatik testle doğrulayın ve canlı DB'de `syncIndexes()`/migration çalıştırın.

2. **Kullanılmayan (atıl) şema alanları ve modeller kafa karışıklığı yaratıyor**
   - **Konum:** [`backend/src/models/Team.js`](../backend/src/models/Team.js), [`User.js`](../backend/src/models/User.js#L8-L56) (`permissions`), [`VerificationToken.js`](../backend/src/models/VerificationToken.js#L39) (`LOGIN_2FA`)
   - **Neden:** Eski tasarım taslaklarından kalan `Team` koleksiyonu, `User.permissions` nesnesi ve `LOGIN_2FA` enum'ı hiçbir controller veya frontend tarafından okunmuyor/kullanılmıyor.
   - **Çözüm:** Kapsam dışı bırakıldıysa kaldırın; ileride kullanılacaksa `DATABASE.md` içinde açıkça "planlanan / henüz aktif değil" olarak işaretleyin.

---

### Blok B — Kimlik Doğrulama, OTP, E-posta ve Yetkilendirme (`backend/src/controllers/authController.js`, `services/`, `routes/userRoutes.js`)

3. **OTP e-posta şablonunda HTML / Phishing enjeksiyonu riski**
   - **Konum:** [`backend/src/services/emailService.js`](../backend/src/services/emailService.js#L78-L172), `POST /api/v1/hackathon/send-verification`, `POST /api/v1/auth/send-otp`
   - **Neden:** `generateOtpTemplate`, `sendRegistrationOtpEmail` ve `sendHackathonOtpEmail`; kullanıcıdan gelen `teamName`, `leaderName` ve `fullName` değerlerini HTML escape etmeden doğrudan `${greeting}` ve `${message}` içine yerleştiriyor. Her iki OTP endpoint'i de kimlik doğrulamasız (`Public`) ve `/hackathon/send-verification` herhangi bir e-posta domain kısıtı olmadan çağrılabiliyor.
   - **Etki:** Saldırgan, GDG'nin doğrulanmış Brevo gönderici adresi üzerinden hedef e-postalara `<a href="https://...">` içeren oltalama (phishing) HTML içerikli e-posta gönderebilir.
   - **Çözüm:** `emailService.js` içinde tüm dinamik metinlere sıkı `escapeHtml` uygulayın (`& < > " '`), `subject` için `\r\n` temizliği yapın.

4. **Ekip hesabında şifre sıfırlama (`forgot-password` / `reset-password`) ve token iptal akışı yok**
   - **Konum:** [`backend/src/controllers/authController.js`](../backend/src/controllers/authController.js), [`authRoutes.js`](../backend/src/routes/authRoutes.js)
   - **Neden:** Bu özellikler henüz eklenmemiş; `VerificationToken` yalnız `REGISTER`, `LOGIN_2FA`, `HACKATHON_APPLY` amaçlarını taşıyor ve `/auth/logout` yalnızca tarayıcı `localStorage` siliyor.
   - **Çözüm:** E-posta OTP tabanlı `PASSWORD_RESET` amacı + `/auth/forgot-password` & `/auth/reset-password` endpoint'lerini ekleyin; `User` modeline `tokenVersion` ekleyip şifre değişiminde veya rol düşürmede eski JWT'leri geçersiz kılın.

5. **`POST /api/v1/auth/verify-email` kullanıcı yokken OTP kodunu tüketiyor**
   - **Konum:** [`backend/src/controllers/authController.js`](../backend/src/controllers/authController.js#L161-L170)
   - **Neden:** `VerificationToken.verifyOtp` çağrısı `User.findOne` kontrolünden önce çalışıp kodu siliyor; ardından kullanıcı bulunamazsa `404` dönüyor (kayıt tamamlamadan önce yanlışlıkla `/verify-email` çağıran kullanıcının kodu yanıyor).
   - **Çözüm:** Önce `User.findOne({ email: normalizedEmail })` kontrolü yapıp kullanıcı yoksa 404 döndükten sonra `verifyOtp` çalıştırın (ve zaten `isEmailVerified === true` ise kodu tüketmeden yanıt verin).

6. **`GET /api/v1/users` sayfalama zarfı diğer API'lerle uyumsuz**
   - **Konum:** [`backend/src/routes/userRoutes.js`](../backend/src/routes/userRoutes.js#L19)
   - **Neden:** Yanıtta yalnız `{ currentPage, totalPages }` döndürülüyor; `totalItems`, `limit`, `hasNextPage`, `hasPrevPage` eksik (oysa `API.md` ve `content`/`forms`/`hackathon` hepsini döndürüyor).
   - **Çözüm:** Standart sayfalama nesnesini ekleyin.

---

### Blok C — Form, İçerik, Dosya ve Legacy Hackathon API (`backend/src/controllers/`)

7. **`Content` güncelleme/silme işlemlerinde eski kapak görselleri diskte yetim kalıyor ve URL doğrulaması yok**
   - **Konum:** [`backend/src/controllers/contentController.js`](../backend/src/controllers/contentController.js#L8-L210)
   - **Neden:**
     - `updateContent` yeni dosya yüklendiğinde ya da `deleteContent` içerik sildiğinde önceki `/uploads/public/<dosya>` dosyasını silmiyor.
     - `coverImageUrl` ve `bevyLink` için şema doğrulaması yok (`javascript:alert(1)` kabul ediliyor).
     - `resolveCoverImageUrl` tam URL üretirken `${req.protocol}://${req.get('host')}` kullanıyor; `TRUST_PROXY_HOPS` ayarlanmamış TLS reverse proxy arkasında `http://` karma içerik (mixed content) URL'i üretebilir.
     - `bevyLink ? bevyLink.trim() : null` ve `type.toUpperCase()` gibi alanlarda `typeof === 'string'` kontrolü eksik; nesne/sayı gönderilirse `TypeError` ile `500` üretir. Benzer tip eksikliği [`formController.js`](../backend/src/controllers/formController.js#L90-L93) içinde `description`, `category`, `slug`, `updateForm` alanlarında da var.
   - **Çözüm:** Yerel `/uploads/public/` dosyalarını güncelleme/silmede `unlink` edin, göreli path `/uploads/public/<filename>` saklayın, `http(s):` URL doğrulaması ekleyin ve string olmayan gövde alanlarını `400` ile reddedin.

8. **Legacy `GET /api/v1/hackathon/applications/export` arama filtresini yok sayıyor**
   - **Konum:** [`backend/src/modules/hackathon/controllers/hackathonController.js`](../backend/src/modules/hackathon/controllers/hackathonController.js#L205-L210)
   - **Neden:** `getApplications` (`?search=`) filtreleme yaparken, `exportApplications` `HackathonApp.find()` ile tüm kayıtları indiriyor. Panel (`Applications.jsx` `source === 'legacy'`) kullanıcıya filtrelenmiş liste gösterip CSV'de tüm tabloyu indirmiş oluyor (ayrıca CSV dışında `?format=xml` gibi geçersiz değer 400 ile engelleniyor ama `search` hiç uygulanmıyor).
   - **Çözüm:** `formController.exportFormResponses` ile paralel olarak `req.query.search` üzerinden `literalSearch` filtresi uygulayın.

9. **`Content` ve Dinamik Form CRUD API'lerinin ön yüzde hiçbir arayüzü yok (Yetim Backend Modülleri)**
   - **Konum:** [`contentRoutes.js`](../backend/src/routes/contentRoutes.js), [`formRoutes.js`](../backend/src/routes/formRoutes.js#L21-L26)
   - **Neden:** Backend'de GDG duyuru/etkinlik CMS'i (`POST/GET/PUT/DELETE /content`) ve çoklu dinamik form yönetimi (`POST/GET/PUT/PATCH/DELETE /forms`) mevcut; ancak ne `frontend/` panelinde ne de `frontend/hackaton/` sitesinde bu endpoint'leri çağıran bir ekran var. Panel yalnızca `event-page/hackathon`'un tek `formId`'sine bağlı.
   - **Çözüm:** Genel GDG ana sitesi (`proje_taslagi_v2.md`) yapılacaksa `frontend/` paneline İçerik & Çoklu Form yönetimi eklenmeli; sadece hackathon çıkılacaksa `Content` ve genel form oluşturma kapsamı geçici olarak dondurulup belgelenmelidir.

---

### Blok D — Etkinlik Sitesi (`frontend/hackaton/` & `shared/`)

10. **`/kayit` formunda KVKK Aydınlatma Metni ve Açık Rıza onayı yok**
    - **Konum:** [`shared/hackathon-event.json`](../shared/hackathon-event.json), [`StepForm.jsx`](../frontend/hackaton/src/components/StepForm.jsx)
    - **Neden:** Tasarım spesifikasyonunda (§4.2) zorunlu tutulan KVKK onayı kayıt adımlarına eklenmemiş; buna karşın sunucu katılımcı ad-soyad, e-posta, telefon, ekip bilgileri, **IP adresi**, **User-Agent** ve ek dosyaları kaydediyor.
    - **Çözüm:** `register.steps` sonuna (veya Onay adımına) aydınlatma linki + zorunlu onay kutusu (`kvkkConsent`) ekleyin; onay alınmadan gönderimi engelleyin.

11. **`StepForm` ve editör `file`, `number`, `radio`, `date` alanlarını desteklemiyor**
    - **Konum:** [`shared/eventContent.mjs`](../shared/eventContent.mjs#L15), [`registration.js`](../frontend/hackaton/src/lib/registration.js), [`StepForm.jsx`](../frontend/hackaton/src/components/StepForm.jsx), [`Admin.jsx`](../frontend/hackaton/src/pages/Admin.jsx#L87-L93)
    - **Neden:** Backend [`formController.js`](../backend/src/controllers/formController.js) 10 alan tipini ve `uploadFormFiles` ile `FormData` yüklemesini destekliyor, panel [`Applications.jsx`](../frontend/src/pages/Applications.jsx#L185) ise `uploadedFiles` indirme butonlarını çiziyor; ancak etkinlik sitesi şeması yalnızca `text|textarea|email|tel|select|checkbox` 6 türünü destekliyor ve JSON gönderiyor.
    - **Çözüm:** `eventContent.mjs` `choices.kind` içine `file`, `number`, `radio`, `date` ekleyin; `StepForm.jsx` içinde `<input type="file">`, `registration.js` içinde dosya varsa `FormData` (`answers` JSON + dosya alanları) ile gönderim desteği ekleyin.

12. **`main.jsx` açılışta API hatasında `/admin` dahil bütün siteyi kilitliyor (SPOF)**
    - **Konum:** [`frontend/hackaton/src/main.jsx`](../frontend/hackaton/src/main.jsx#L11-L24)
    - **Neden:** React Router bağlanmadan önce `await loadEvent()` çağrılıyor. Backend soğuk başlatmada veya geçici kesintideyken `/` , `/program`, `/ekip`, `/kayit` yanında `/admin` editörü de açılmaz ve "Etkinlik bilgileri yüklenemedi" ekranında kalır.
    - **Çözüm:** Uygulamayı `base` fallback veya React state içinde yükleyin; en azından `/admin` rotasını API blokajından kurtarın ve iç sayfalarda yeniden deneme banner'ı gösterin.

13. **`Admin.jsx` sıfırlama, 409 çakışma yenileme, form kota/tarih ayarı ve sahte boş validation açıkları**
    - **Konum:** [`frontend/hackaton/src/pages/Admin.jsx`](../frontend/hackaton/src/pages/Admin.jsx#L108-L325), [`shared/eventContent.mjs`](../shared/eventContent.mjs#L28-L58)
    - **Neden:**
      - `reset()` (`Admin.jsx:323`), yayınlanan son sunucu içeriğine (`page.event`) dönmek yerine derleme anındaki statik `base` (`hackathon-event.json`) verisine sıfırlıyor.
      - `publish()` `409 Conflict` aldığında güncel `revision` alınmıyor; editör sayfayı yenilemek zorunda kalıyor.
      - `Gate` önceki sekme içi `sessionStorage` token'ını (`/auth/me` ile) doğrulamadan editörü açıyor; süresi dolmuş token yalnızca `Yayınla`ya basılınca fark ediliyor.
      - Editörde form kotası (`maxSubmissions`), tarih aralığı (`startDate`/`endDate`), `allowMultipleSubmissions` ve `verificationMethods` ayarlanamıyor; ayrıca `Admin.jsx:108`'de güncelliğini yitirmiş eski `UNLOCK_KEY = 'hackathon-admin-unlocked'` yorumu duruyor.
      - `isEventShape`, sponsor `name`, jüri/mentor `name` veya program `label` için boş string (`""`) kabul ediyor.
    - **Çözüm:** `serverEvent` state'ini tutup `reset()`'i buna döndürün; `/admin` açılışında `/auth/me` doğrulayın; 409'da güncel revision senkronu sunun; form ayarları için API/UI bağlantısı ekleyin ve kritik yayın alanlarında boş metin doğrulaması ekleyin.

14. **Ağır font dosyaları, eksik SEO/ikon varlıkları ve yer tutucu içerik**
    - **Konum:** [`frontend/hackaton/public/fonts/`](../frontend/hackaton/public/fonts/), [`frontend/hackaton/index.html`](../frontend/hackaton/index.html), [`shared/hackathon-event.json`](../shared/hackathon-event.json)
    - **Neden:** İki `.ttf` dosyası toplam ~4.27 MB (`GoogleSans-Regular.ttf` + `Bold.ttf`) ağırlığında; `.woff2` yok. `index.html` içinde favicon ve `og:image` eksik. `shared/hackathon-event.json` tamamen yer tutucu verilerden oluşuyor ve sponsor logoları / kişi fotoğrafları için yükleme arayüzü yok (yalnızca harici URL).
    - **Çözüm:** Fontları `.woff2` alt kümesine dönüştürün, favicon & `og:image` ekleyin, gerçek etkinlik/sponsor verilerini girin.

15. **Etkinlik sitesi testlerinde React `act(...)` uyarıları**
    - **Konum:** [`Admin.test.jsx`](../frontend/hackaton/src/pages/Admin.test.jsx), [`ParticipantVerification.test.jsx`](../frontend/hackaton/src/components/ParticipantVerification.test.jsx)
    - **Neden:** `Editor` ve `ParticipantVerification` mount `useEffect` içindeki async API promise'leri test assertions'ları bittikten sonra çözüldüğü için stderr'e `Warning: An update ... was not wrapped in act(...)` basılıyor.
    - **Çözüm:** Testlerde async mount etkilerinin (`await screen.findBy...` / `waitFor`) tamamlanmasını bekleyin.

---

### Blok E — Core Team Yönetim Paneli (`frontend/`)

16. **`Applications.jsx` dinamik form alanları değişince bozuk link (`tel:undefined`) ve boş alan kutusu gösteriyor**
    - **Konum:** [`frontend/src/pages/Applications.jsx`](../frontend/src/pages/Applications.jsx#L158-L185)
    - **Neden:** Kart görünümü `answers.phone` yoksa `<a href="tel:undefined"></a>` üretiyor; `motivation`/`projectIdea` yoksa boş `<details>Proje fikri</details>` basıyor. Ayrıca legacy kayıtta `app.resumeUrl` harici `https://` URL ise `downloadPrivateFile` bunu `"Dosya adresi geçersiz."` diyerek reddediyor; geçersiz/boş URL'de ise `new URL(...)` Türkçe `ApiError` yerine ham tarayıcı `TypeError`'ı fırlatıyor.
    - **Çözüm:** `phone` ve `projectIdea` yokken ilgili DOM düğümlerini gizleyin; `downloadPrivateFile` içinde URL ayrıştırmasını `try/catch` ile `ApiError`'a sarın ve `https://` harici legacy linkleri yeni sekmede güvenli (`rel="noopener noreferrer"`) açın.

17. **`Users.jsx` filtreleme, boş durum ve sayfalama eksikleri; panelde geçici hash routing**
    - **Konum:** [`frontend/src/pages/Users.jsx`](../frontend/src/pages/Users.jsx#L30-L56), [`frontend/src/App.jsx`](../frontend/src/App.jsx#L11-L37)
    - **Neden:** Backend `GET /users?role=PENDING` filtresini desteklemesine rağmen `Users.jsx` bunu kullanmıyor; 0 üye durumu için boş mesaj yok; tek sayfada (`1 / 1`) sayfalama düğmeleri her zaman gösteriliyor. Panel geçici `window.location.hash` yönlendirmesi ve statik başlık menüsü kullanıyor (`PanelLayout.jsx` aktif sayfa vurgusu yok).
    - **Çözüm:** Rol filtre seçicisi + boş liste metni + `totalPages > 1` sayfalama kontrolü ekleyin; panel genişletilirken `react-router-dom` yapısına geçin.

---

### Blok F — Geliştirme Ortamı, Scriptler, Docker, Env ve Git Yayın Süreci

18. **`scripts/dev.mjs` ve `check-layout.mjs` Windows uyumlu değil**
    - **Konum:** [`scripts/dev.mjs`](../scripts/dev.mjs#L3-L13), [`frontend/hackaton/scripts/check-layout.mjs`](../frontend/hackaton/scripts/check-layout.mjs#L5)
    - **Neden:** `spawn('npm', ...)` Windows PowerShell'de `npm.cmd` uzantısı olmadan ya da `shell: true` olmadan `ENOENT` hatası verir. Ayrıca `scripts/dev.mjs` kapatmada POSIX süreç grubu (`process.kill(-child.pid, 'SIGTERM')`) kullanıyor ve Windows'ta alt süreç ağaçlarını sonlandıramıyor. (Aynı şekilde PowerShell execution policy kısıtında `npm.ps1` yerine `npm.cmd` gerekir.)
    - **Çözüm:** Platforma göre `process.platform === 'win32' ? 'npm.cmd' : 'npm'` seçin ve Windows kapatmada `taskkill /pid <pid> /T /F` veya uygun tree kill kullanın.

19. **Docker yapılandırması sadece geliştirme amaçlı ve yerel `backend/.env` uyumsuz**
    - **Konum:** [`Dockerfile`](../Dockerfile), [`compose.yaml`](../compose.yaml), `backend/.env` (yerel dosya)
    - **Neden:** `Dockerfile` üretim build'i (`vite build` + statik sunucu / Nginx + `node src/server.js`) yerine `nodemon` ve `vite` dev sunucuları çalıştırıyor; üretim ters proxy (HTTPS, `/api/v1` proxy, SPA fallback) yapılandırması yok. Yerel `backend/.env` içinde `MONGO_URI` replica set parametresiz, `CLIENT_URL` tek origin'li, `DEFAULT_ADMIN_PASSWORD=Admin123456!` (`seedAdminService` tarafından reddediliyor) ve `BREVO_API_KEY` yer tutucu. Ayrıca `backend/src/utils/seed.js` ile `server.js` (`ensureHackathonPage`) farklı form slug'ları (`hackathon-2026-basvuru` vs `hackathon-katilim`) üretiyor ve `seed.js` Unsplash dış URL'leri kullanıyor.
    - **Çözüm:** Production multi-stage `Dockerfile` + `compose.prod.yaml` (veya PaaS build/reverse proxy tarifi) hazırlayın; `seed.js`'yi `ensureHackathonPage` ile hizalayın.

20. **`main` dalı `dev` dalının 35 commit gerisinde ve canlıya çıkış dış kabul kontrolleri açık**
    - **Konum:** Git `main` (`d218156`) vs `dev` (`3723e57`)
    - **Neden:** 21 Ekim düzeltmeleri ve Docker Compose eklemeleri yalnız `dev` üzerinde; `main` hâlâ kırık ilk sürümde. Ek olarak gerçek Google OAuth Web Client ID & authorized origins, doğrulanmış Brevo alan adı + DKIM/SPF, kalıcı `uploads/` diski + senkron DB/dosya yedek geri yükleme denemesi henüz canlı ortamda doğrulanmadı.
    - **Çözüm:** P0/P1 düzeltmeleri ve tam test geçidinden sonra kullanıcı onayıyla `main` güncellenmeli; staging ortamında gerçek Google + Brevo + yedek/restore kabul kontrolü tamamlanmalıdır.
