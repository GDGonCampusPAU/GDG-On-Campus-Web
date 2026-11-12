# GDG On Campus Pamukkale Web Platformu — Canlıya Çıkış Kontrol Listesi ve Sürüm Kabul Raporu

**Tarih:** 11 Kasım 2026  
**Dal (Branch):** `iyilestirme-ve-test` & `dev` (`b4fbf69` Başvuru Durum Yönetimi dahil; `main` henüz merge edilmedi)  
**Durum:** KOD & TEST KAPILARI HAZIR — Harici Ortam, Docker/Nginx ve Varlık Kontrolleri Aşağıda Listelenmiştir

---

## 1. Yönetici Özeti ve Sürüm Durumu

Bu belge, [`docs/SORUNLAR.md`](SORUNLAR.md) ve [`docs/IYILESTIRME_VE_TEST_PLANI.md`](IYILESTIRME_VE_TEST_PLANI.md) belgelerinde yer alan **Blok A–F arası 20 maddenin** (`cb8880b`) ve **Başvuru Durum İnceleme İş Akışı + Brevo E-posta Profil Yönlendirmesinin** (`b4fbf69`) `iyilestirme-ve-test` dalında nasıl çözüldüğünü, doğrulanan test sonuçlarını ve canlı ortama (Production) çıkmadan önce tamamlanması gereken **Docker/Nginx, Cloudflare/DNS, Brevo/Google OAuth ve statik varlık ön koşullarını** belgeler.

Tüm teknik eksiklikler ve düzeltme tarifleri ayrıntılı olarak [`docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md`](EKSIKLIKLER_VE_DUZELTME_REHBERI.md) belgesinde toplanmıştır; `main` dalına kullanıcı son onayı olmadan merge yapılmaz.

---

## 2. Çözülen 20 Madde Matrisi (Blok A–F — Doğrulanmış Kod Durumu)

| Blok & No | Kod | Öncelik | Gerçekleştirilen Çözüm ve Kalan Not | Durum |
| :--- | :--- | :--- | :--- | :--- |
| **A.1** | P0.1 | **P0** | [`FormResponse.js`](../backend/src/models/FormResponse.js) üzerinde `(form, singleSubmissionKey)` partial unique indeksi geri eklendi; ham mükerrer eklemeler MongoDB `E11000` ile engellendi. | **TAMAMLANDI** |
| **A.2** | P2.3 | **P2** | Geriye dönük uyumluluk korunarak [`Team.js`](../backend/src/models/Team.js) `@deprecated` işaretlendi, [`User.js`](../backend/src/models/User.js) içindeki `permissions` alanı `@deprecated` + `select: false` yapıldı ve [`VerificationToken.js`](../backend/src/models/VerificationToken.js) içindeki `LOGIN_2FA` ayrılmış/legacy olarak belgelendi. | **TAMAMLANDI** |
| **B.3** | P0.2 | **P0** | [`emailService.js`](../backend/src/services/emailService.js) içine `escapeHtml` ve `sanitizeHeader` (CRLF koruması) eklendi; OTP e-postalarındaki kullanıcı adları/takım adları kaçışlandı, `subject` ve `toName` CRLF temizliğine alındı. | **TAMAMLANDI** |
| **B.4** | P1.5 | **P1** | [`authController.js`](../backend/src/controllers/authController.js) ve [`authRoutes.js`](../backend/src/routes/authRoutes.js) içine `/auth/forgot-password`, `/auth/reset-password` akışı ve `User.tokenVersion` + [`authMiddleware.js`](../backend/src/middleware/authMiddleware.js) üzerinden anlık JWT geçersiz kılma mekanizması kuruldu. | **TAMAMLANDI** |
| **B.5** | P1.5 | **P1** | `/auth/verify-email` rotasında OTP doğrulamasından önce `User` varlığı ve `isEmailVerified` durumu kontrol edilerek olmayan kullanıcılar için OTP'nin boşa yanması engellendi. | **TAMAMLANDI** |
| **B.6** | P1.5 | **P1** | [`userRoutes.js`](../backend/src/routes/userRoutes.js) içindeki `GET /api/v1/users` yanıtı standart 6 alanlı sayfalama zarfına (`totalItems`, `totalPages`, `currentPage`, `limit`, `hasNextPage`, `hasPrevPage`) kavuşturuldu. | **TAMAMLANDI** |
| **C.7** | P1.2 | **P1** | [`contentController.js`](../backend/src/controllers/contentController.js) güncelleme ve silmede eski yerel `/uploads/public/...` görsellerini `unlink` edecek şekilde güncellendi; `javascript:` URL'ler, traversal yolları ve [`formController.js`](../backend/src/controllers/formController.js) dahil string olmayan alanlar `400` ile engellendi. | **TAMAMLANDI** |
| **C.8** | P1.4 | **P1** | Legacy `GET /api/v1/hackathon/applications/export` ve panel [`api.js`](../frontend/src/lib/api.js) arama filtresini (`?search=`) CSV/JSON export'a aktaracak şekilde güncellendi. | **TAMAMLANDI** |
| **C.9** | P2.3 | **P2** | `Content` (`/api/v1/content`) ve çoklu `Form` (`/api/v1/forms`) API'lerinin kapsam sınırı `MEVCUT_PROJE_DURUMU.md` içinde "Faz 2 kulüp portalı için backend-ready" olarak belgelendi. | **TAMAMLANDI (KAPSAM KARARI)** |
| **D.10** | P0.3 | **P0** | [`shared/hackathon-event.json`](../shared/hackathon-event.json) 4. adıma zorunlu `kvkkConsent` onay kutusu eklendi ve gönderimde doğrulandı. *Canlı öncesi not:* Hint metni `"Detaylı metin için tıklayınız."` içindir; PAU resmi KVKK Aydınlatma Metni URL'i/modalı yayın içeriğiyle bağlanmalıdır. | **KOD HAZIR / HUKUKİ METİN BEKLENİYOR** |
| **D.11** | P1.1 | **P1** | [`shared/eventContent.mjs`](../shared/eventContent.mjs), [`StepForm.jsx`](../frontend/hackaton/src/components/StepForm.jsx), [`registration.js`](../frontend/hackaton/src/lib/registration.js) ve [`Admin.jsx`](../frontend/hackaton/src/pages/Admin.jsx) `file`, `number`, `radio`, `date` türlerini ve dosya ekli `FormData` gönderimini destekleyecek şekilde güncellendi. | **TAMAMLANDI** |
| **D.12** | P1.3 | **P1** | [`main.jsx`](../frontend/hackaton/src/main.jsx) `loadEvent()` hatasını yakalayıp Router kilidini kaldırdı; API erişilemezken de yedek içerik ve uyarı şeridiyle tüm rotalar (`/admin` dahil) açılır. | **TAMAMLANDI** |
| **D.13** | P2.1 | **P2** | `Admin.jsx` içinde `Taslağı sıfırla` son yayınlanan sunucu verisine (`serverEvent`) bağlandı ve `isEventShape` boş sponsor/jüri/mentor adlarını reddedecek şekilde sıkılaştırıldı. *(Opsiyonel cila: 409'da otomatik revision tazeleme, açılışta `/auth/me` kontrolü ve form kota/tarih düzenleme arayüzü Faz 2'ye bırakılabilir).* | **ANA KISIM TAMAMLANDI** |
| **D.14** | P3.2 | **P3** | [`frontend/hackaton/index.html`](../frontend/hackaton/index.html) içine SEO (`description`, `og:*`, `twitter:*`) meta etiketleri ve `<link rel="icon" href="/favicon.svg">` eklendi. *Canlı öncesi not:* [`frontend/hackaton/public/fonts/`](../frontend/hackaton/public/fonts/) altında 4 ham `.ttf` dosyası (~4,31 MB), [`frontend/public/fonts/`](../frontend/public/fonts/) altında ise 5 ham `.ttf` dosyası (~6,48 MB) bulunur; `.woff2` dönüşümü, `favicon.svg`/`og-image.png` görselleri ve gerçek etkinlik/sponsor içerikleri canlı varlık hazırlığında eklenmelidir. | **META EKLENDİ / VARLIK & İÇERİK BEKLENİYOR** |
| **D.15** | P3.0 | **P3** | Etkinlik sitesi testlerindeki async `act(...)` stderr uyarıları giderildi. | **TAMAMLANDI** |
| **E.16** | P2.2 | **P2** | [`Applications.jsx`](../frontend/src/pages/Applications.jsx) eksik telefon/fikir alanlarında bozuk `tel:undefined` ve boş kutu gizlendi; harici `https://` özgeçmiş linkleri güvenli yeni sekmede açıldı; [`api.js`](../frontend/src/lib/api.js) `downloadPrivateFile` geçersiz URL'leri `ApiError` ile sardı. | **TAMAMLANDI** |
| **E.17** | P2.2 | **P2** | [`Users.jsx`](../frontend/src/pages/Users.jsx) içine rol filtresi (`ALL`, `PENDING`, `MEMBER`, `ORGANIZER`, `ADMIN`), boş durum mesajı ve tek sayfada (`totalPages <= 1`) pager gizleme eklendi. | **TAMAMLANDI** |
| **F.18** | P3.1 | **P3** | [`scripts/dev.mjs`](../scripts/dev.mjs) ve [`check-layout.mjs`](../frontend/hackaton/scripts/check-layout.mjs) platforma duyarlı `npm.cmd`/`npm` seçer hale getirildi; Windows kapanışında native `taskkill /pid <pid> /T /F` ağaç sonlandırma eklendi. | **TAMAMLANDI** |
| **F.19** | P0.4 | **P0** | Çok aşamalı üretim [`Dockerfile`](../Dockerfile), Nginx ters proxy'li [`compose.prod.yaml`](../compose.prod.yaml), [`nginx/nginx.conf`](../nginx/nginx.conf), kök [`.env.example`](../.env.example), güncel [`backend/.env.example`](../backend/.env.example) ve `ensureHackathonPage` hizalı [`seed.js`](../backend/src/utils/seed.js) hazırlandı. *Canlı öncesi not:* [`Dockerfile`](../Dockerfile) (`frontend-builder`) + [`compose.prod.yaml`](../compose.prod.yaml) içine `ARG VITE_GOOGLE_CLIENT_ID` ve [`nginx/nginx.conf`](../nginx/nginx.conf) içine `:443` SSL + `gdgocpamukkale.com` / `panel.gdgocpamukkale.com` sanal host yönlendirmeleri eklenmelidir. | **KOD HAZIR / PROD BUILD-ARG & TLS AÇIK** |
| **F.20** | P0.4 | **P0** | `iyilestirme-ve-test` → `dev` merge edildi; `main` (`d218156`) canlı onayına kadar korundu. Canlıya çıkmadan önce Bölüm 3'teki Google OAuth, Brevo DNS/key (`gdgocpamukkale.com`), Cloudflare NS/A kayıtları, yedek/geri yükleme tatbikatı ve kullanıcı `main` merge onayı tamamlanmalıdır. | **DEV MERGE TAMAM / DIŞ KONTROLLER AÇIK** |

*Eklenen Özelliğin Özeti (`b4fbf69` — Başvuru Durum İnceleme ve E-posta Profilleri):* [`applicationStatusService.js`](../backend/src/services/applicationStatusService.js), `PATCH /api/v1/forms/:id/responses/:responseId/status`, `PATCH /api/v1/hackathon/applications/:id/status`, [`emailService.js`](../backend/src/services/emailService.js) profil yönlendirmesi (`default` / `applicationStatus`), rollback koruması ve [`Applications.jsx`](../frontend/src/pages/Applications.jsx) onay/red/bekletme inceleme arayüzü tamamlanıp 350 testlik pakete dahil edildi.

---

## 3. Canlıya Çıkış Ön Koşulları (Production Prerequisites)

### 3.1. Google OAuth Web Client ID Yapılandırması (Redirect URI Boş)
1. **Google Cloud Console:** `https://console.cloud.google.com` -> *Google Auth Platform / APIs & Services* -> *Credentials* -> **Web application** türünde OAuth Client ID oluşturulur (veya güncellenir); **Audience** ekranı *Publish App* (Üretim) durumuna alınır.
2. **Authorized JavaScript Origins (Yetkilendirilmiş JavaScript Kaynakları):**
   - Üretim ve test ortamında kullanılan tam origin'ler (protokol + domain, sondaki `/` olmadan) eklenir:
     - `https://gdgocpamukkale.com` (gerekirse `https://www.gdgocpamukkale.com`)
     - `https://panel.gdgocpamukkale.com`
     - Test için yerelde: `http://localhost:5173`
3. **Authorized Redirect URIs (Yetkilendirilmiş Yönlendirme URI'leri):**
   - **Tamamen boş bırakılmalıdır.** Uygulama Google Identity Services (`gsi/client` popup/One Tap credential -> `POST /api/v1/participant-auth/google`) kullandığı için redirect URI kullanmaz.
4. **Ortam Değişkenleri ve Docker Build Argümanı:**
   - Sunucu tarafında `backend/.env` içine `GOOGLE_CLIENT_ID=<istemci_kimligi>.apps.googleusercontent.com` tanımlanır (`Client Secret` gerekmez).
   - İstemci tarafında derleme (`vite build`) öncesinde `frontend/hackaton/.env` (ve Docker üretim derlemesi için `Dockerfile` + `compose.prod.yaml` build `ARG` olarak) `VITE_GOOGLE_CLIENT_ID=<istemci_kimligi>.apps.googleusercontent.com` geçirilir.

### 3.2. Brevo (Sendinblue) API İzni, Domain Doğrulaması ve Gönderici Profilleri
1. **API Anahtarı İzni:** Brevo panelinde *SMTP & API -> API Keys* altından üretilen anahtarda yalnızca **`Transactional email: All`** açık olmalı; diğer tüm 17 izin grubu **`None`** bırakılmalıdır (`BREVO_API_KEY`).
2. **Domain & Gönderici / Reply-To Ayrımı (DMARC Koruması):**
   - `gdgocpau@gmail.com` ücretsiz Gmail adresi DMARC politikası nedeniyle `From` (`BREVO_SENDER_EMAIL`) olarak kullanılmamalıdır; aksine spam klasörüne düşme/ret riski oluşur.
   - Bunun yerine canlı alan adı (`gdgocpamukkale.com`) Brevo *Senders & Domains* altında **SPF ve DKIM** DNS kayıtlarıyla doğrulanıp `BREVO_SENDER_EMAIL=noreply@gdgocpamukkale.com` (gerekirse `BREVO_APPLICATION_SENDER_EMAIL` ile ayrıştırılmış adres) kullanılmalı; katılımcı yanıtlarının kulüp posta kutusuna gelmesi için **`BREVO_REPLY_TO=gdgocpau@gmail.com`** / **`BREVO_APPLICATION_REPLY_TO=gdgocpau@gmail.com`** tanımlanmalıdır.
3. **Üretim Güvenliği:**
   - `NODE_ENV=production` modunda simülasyon modu tamamen kapalıdır; geçersiz veya eksik API anahtarında `503`/`502` döner ve başvuru durum güncellemelerinde DB kaydı otomatik geri alınır (rollback).

### 3.3. MongoDB Replica Set ve Transaction Desteği
1. **Gereksinim:** Form başvuruları, mükerrer kontrolü ve kota yönetiminde veri tutarlılığı için MongoDB `replicaSet` desteği zorunludur. Standalone (tekil) modda çalışan MongoDB `Form.create` ve `FormResponse.create` transaction'larını reddeder.
2. **Konteynerli Kurulum:**
   - `compose.prod.yaml` içinde tanımlanan MongoDB 8 servisi tek düğümlü `rs0` replica set'ini sağlık kontrolü (healthcheck) anında otomatik başlatır:
     ```yaml
     mongod --replSet rs0 --bind_ip_all
     ```
3. **Harici / Yönetilen MongoDB (MongoDB Atlas / Cloud):**
   - Atlas veya bağımsız küme kullanılıyorsa bağlantı dizesinde replica set adı belirtilmelidir:
     `MONGO_URI=mongodb+srv://<kullanici>:<sifre>@cluster.mongodb.net/gdg_pau?retryWrites=true&w=majority`

### 3.4. Kalıcı Depolama Alanı (`uploads/`) ve Yedekleme Prosedürü
1. **Dizin Ayrımı:**
   - `/uploads/public`: Etkinlik ve duyuru kapak görselleri.
   - `/uploads/private`: Katılımcı CV, portfolyo ve form ekleri.
2. **Güvenlik Kısıtları:**
   - Private dosyalara doğrudan web sunucusundan erişilemez; indirme işlemi yalnızca `ADMIN` veya `ORGANIZER` JWT token'ı ile `/api/v1/files/:filename` üzerinden yetkilendirilir.
3. **Senkron Yedekleme & Geri Yükleme Prosedürü (Backup & Restore):**
   - **Yedek Alma:** Veri tabanı ve dosya dizini aynı bakım penceresinde (mümkünse API yazmaları anlık durdurularak) birlikte yedeklenmelidir:
     ```bash
     # 1. MongoDB Dump
     mongodump --uri="mongodb://localhost:27017/gdg_pau?replicaSet=rs0" --archive="backup_$(date +%Y%m%d_%H%M%S).archive" --gzip
     # 2. Uploads Arşivi
     tar -czvf "uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz" backend/uploads/
     ```
   - **Geri Yükleme Doğrulaması:** Canlı sisteme yüklemeden önce izole bir test ortamında `mongorestore` ve dosya açma işlemi gerçekleştirilmeli, kayıt sayıları ve `/api/v1/files` erişimi test edilmelidir.

---

## 4. Test ve Kalite Kapıları Doğrulama Özeti

Proje iki katmanlı test mimarisiyle %100 oranında doğrulanmıştır:

### Katman 1: Kod Standartları, Birim/Entegrasyon Testleri ve Derleme
- **Lint Kontrolü:** `npm.cmd run lint` -> **0 Hata, 0 Uyarı** (Backend, Frontend Panel ve Hackathon Sitesi).
- **Birim ve Entegrasyon Testleri:** `npm.cmd test` -> **295/295 Test Başarılı:**
  - `backend`: 47 test başarılı (commit `b4fbf69` ile eklenen `application-status-and-email.test.js` dahil).
  - `frontend` (Panel): 27 test başarılı (yeni başvuru durum inceleme testleri dahil).
  - `frontend/hackaton` (Etkinlik Sitesi): 221 test başarılı.
  - *Not:* Katman 2 kabul kapıları (12), Challenger testleri (38), E2E testleri (4) ve Layout testi (1) ile birlikte projede **tam 350 test** mevcuttur ve tümü yeşildir.
- **Üretim Derlemeleri (Production Builds):** `npm.cmd run build` -> **2/2 Başarılı:**
  - Panel Vite derlemesi: `dist/` çıktıları üretildi.
  - Hackathon Vite derlemesi: `dist/` çıktıları ve `404.html` üretildi.
- **Uçtan Uca Testler (E2E):** `npm.cmd run test:e2e` -> **4/4 Playwright Testi Başarılı:**
  1. Doğrulanmış katılımcı başvurusunun panele düşmesi ve CSV export akışı.
  2. Yeni ekip hesabının yönetici onayından (`PENDING` -> `ORGANIZER`) sonra giriş yapabilmesi.
  3. İçerik yöneticisinin yayınladığı duyuru/etkinliğin diğer tarayıcıda canlı görünmesi.
  4. Duyarlı (responsive) mobil düzen kontrolleri ve taşma (overflow) denetimleri.

### Katman 2: Yol Haritası Kabul Testleri (Roadmap Acceptance Tests)
- **Komut:** `npm.cmd run test:roadmap` -> **12/12 Kabul Kapısı Eksiksiz Yeşil:**
  - Backend (`backend/tests/roadmap/p0-p3-roadmap.roadmap.test.js` — 5 Kapı):
    - `[P0.1]` `FormResponse` partial unique index (form, singleSubmissionKey) koruması.
    - `[P0.2]` `emailService` HTML enjeksiyon filtrelemesi.
    - `[P1.2]` `Content` görsel temizliği, URL doğrulaması ve güvenli tip kontrolü.
    - `[P1.4]` Legacy hackathon CSV export `?search=` arama filtresi.
    - `[P1.5]` `GET /users` standart sayfalama ve güvenli OTP tüketim sırası.
  - Panel (`frontend/roadmap-tests/panel.roadmap-test.jsx` — 3 Kapı):
    - `[P2.2a]` Eksik telefon/fikir alanlarında bozuk DOM düğümlerinin gizlenmesi.
    - `[P2.2b]` Kullanıcı listesi rol filtresi (`PENDING`), boş liste ve tek sayfa pager kontrolü.
    - `[P2.2c]` `downloadPrivateFile` malformed URL'de `ApiError` sarmalama kontrolü.
  - Hackathon Sitesi (`frontend/hackaton/roadmap-tests/hackaton.roadmap-test.jsx` — 4 Kapı):
    - `[P0.3]` Şemada zorunlu KVKK açık rıza onay kutusu.
    - `[P1.1]` Şemada `file`, `number`, `date` alan türleri desteği.
    - `[P2.1a]` `Admin.jsx` son sunucu içeriğine sıfırlama.
    - `[P2.1b]` `isEventShape` boş sponsor adlarını reddetmesi.

### Ek Dayanıklılık (Challenger) & Yerleşim Kontrolleri
- **Backend Challenger (`node --test --test-concurrency=1 backend/tests/challenger/*.test.js`):** **26/26 geçti** (M1/M2/M5 sınır & enjeksiyon testleri: XSS/CRLF, E11000, OTP tüketim sırası, `tokenVersion` ile JWT iptali, path traversal, ReDoS, Türkçe CSV search, Dockerfile/Nginx/compose/seed doğrulamaları).
- **Panel Challenger (`npm.cmd exec --prefix frontend -- vitest run tests/challenger/m4-challenge.test.jsx`):** **12/12 geçti** (`Applications.jsx`, `Users.jsx`, `downloadPrivateFile` sınır durumları).
- **Responsive Layout (`npm.cmd run check:layout --prefix frontend/hackaton`):** **1/1 geçti** (`1440x900`, `1024x768`, `390x844`).

---

## 5. Canlı Ortama Alma (Deployment) Adımları

1. **Docker Compose ile Dağıtım (Önerilen):**
   ```bash
   # 1. Ortam değişkenlerini yapılandırın (`compose.prod.yaml` portlar için kök `.env`, API için `backend/.env` okur)
   cp .env.example .env
   cp backend/.env.example backend/.env
   # `backend/.env` içerisindeki JWT_SECRET, PARTICIPANT_JWT_SECRET, BREVO_API_KEY, GOOGLE_CLIENT_ID, CLIENT_URLS ve DEFAULT_ADMIN_PASSWORD değerlerini güncelleyin.

   # 2. Üretim konteynerlerini derleyip ayağa kaldırın
   docker compose -f compose.prod.yaml up -d --build

   # 3. İlk yönetici kullanıcısını oluşturun ve şablon verileri yükleyin
   docker compose -f compose.prod.yaml exec backend npm run seed
   ```

2. **Ters Proxy, Domain & TLS Yönlendirmeleri (Cloudflare + Nginx):**
   - Mevcut [`nginx/nginx.conf`](../nginx/nginx.conf) şu an yalnızca `80` (Hackathon sitesi) ve `8080` (Core Team Panel) HTTP portlarını dinler.
   - Cloudflare Proxy (`Orange Cloud`) `:8080` portunu desteklemediğinden canlıya çıkmadan önce `nginx/nginx.conf` içine `gdgocpamukkale.com` (Hackathon) ve `panel.gdgocpamukkale.com` (Core Team Panel) `server_name` blokları ile `:443` TLS (Cloudflare Full Strict / Origin Certificate) eklenmeli, [`Dockerfile`](../Dockerfile) + [`compose.prod.yaml`](../compose.prod.yaml) build `ARG VITE_GOOGLE_CLIENT_ID` ile güncellenmelidir.
   - Nginx `/api/` (`/api/v1`), `/uploads/`, `/health` ve `/ready` isteklerini `backend:5000` servisine yönlendirir (`TRUST_PROXY_HOPS=1`).

---

## 6. Geri Alma (Rollback) Planı

Olası bir canlı ortam kesintisi veya kritik hata durumunda:
1. `docker compose -f compose.prod.yaml down` ile çalışan üretim servisleri durdurulur.
2. Veritabanında bozulma şüphesi varsa son geçerli yedekten geri yüklenir:
   ```bash
   mongorestore --uri="mongodb://localhost:27017/gdg_pau?replicaSet=rs0" --archive="backup_XXXXX.archive" --gzip --drop
   ```
3. Son çalışan kararlı Docker imajı veya Git commit etiketi yeniden dağıtılır.
