# Mevcut Proje Durumu

> **Güncelleme (10 Kasım 2026 — `iyilestirme-ve-test` / Teamwork M1–M5 sonrası doğrulama):** Bu belge, önce `dev` (`3723e57`) üzerinde yapılan tam denetimi, ardından `iyilestirme-ve-test` dalında Teamwork M1–M5 ekiplerinin çözdüğü Blok A–F düzeltmelerini ve doğrudan çalıştırılan iki katmanlı test/build/E2E koşumlarının güncel sonuçlarını özetler. Çözülen maddelerin matrisi [SORUNLAR.md](SORUNLAR.md), yol haritası ve test suite yapısı [IYILESTIRME_VE_TEST_PLANI.md](IYILESTIRME_VE_TEST_PLANI.md), canlıya geçiş adımları ise [CANLIYA_CIKIS_KONTROL_LISTESI.md](CANLIYA_CIKIS_KONTROL_LISTESI.md) dosyasındadır.

---

## 1. Dizinler ve Güncel Durum (`iyilestirme-ve-test`)

| Dizin / Dosya | Gerçekte Çalışan İşlev | Güncel Durum & Kalan Not |
| --- | --- | --- |
| `backend/` | Express 5 + Mongoose 9 API; ekip auth (`JWT`, `tokenVersion` + `/forgot-password`/`/reset-password`, `VerificationToken`), katılımcı doğrulama (`ParticipantOtp` + Google ID token), `Form` / `FormResponse` (MongoDB transaction + partial unique index + private dosya + streaming CSV/JSON export), `EventPage`, `Content` CMS, legacy `HackathonApp` | `FormResponse` partial unique indeksi geri eklendi; `emailService` HTML/CRLF kaçışı, `Content` yerel görsel `unlink` & URL/tip doğrulaması, `GET /users` tam sayfalama, `/verify-email` sıra düzeltmesi, legacy export `?search=` ve `seed.js` hizalaması tamamlandı. `Team.js`, `User.permissions`, `LOGIN_2FA` geriye dönük uyumlu `@deprecated` bırakıldı. |
| `frontend/` | Core Team yönetim paneli (Hash tabanlı route); Giriş, Kayıt, E-posta OTP, rol filtreli (`PENDING`) kullanıcı onay listesi (`Users.jsx`), dinamik + legacy başvurular, CSV + güvenli private/external dosya indirme (`Applications.jsx`) | `tel:undefined`/boş fikir kutusu gizlendi, `downloadPrivateFile` `ApiError` sarmalandı, `Users.jsx` boş durum + tek sayfa pager düzeltildi. `Content` ve çoklu `Form` CRUD ekranları Faz 2 genel GDG portalı için backend-ready olarak bekler. |
| `frontend/hackaton/` | Etkinlik vitrin sitesi (`/`, `/program`, `/ekip`, `/kayit`, `/admin`), KVKK onaylı ve 10 alan tipini (`file`, `number`, `radio`, `date` + `FormData`) destekleyen başvuru sihirbazı (`StepForm.jsx`), sunucuya sürümlü yayın yapan `/admin` editörü | `main.jsx` açılış API hatasında Router'ı kilitlemez (uyarı şeridi + fallback); `Admin.jsx` sıfırlama `serverEvent`'e döner, `isEventShape` boş sponsor/jüri/mentor adlarını reddeder. `public/fonts/` hâlâ ~4,27 MB `.ttf` taşır; `index.html` `/favicon.svg` + `og:*` meta ekli olsa da nihai `favicon.svg`/`og-image.png`/`.woff2` varlıkları ve gerçek etkinlik copy'si canlı öncesi tamamlanmalıdır. |
| `shared/` | Başlangıç şablonu (`hackathon-event.json`, Step 4 `kvkkConsent` dahil) ve ortak doğrulayıcı (`eventContent.mjs`) | 10 alan türü (`text`, `textarea`, `email`, `tel`, `select`, `checkbox`, `file`, `number`, `radio`, `date`) ve boş isim koruması aktif. |
| `infra & scripts/` | Çok aşamalı üretim [`Dockerfile`](../Dockerfile), [`compose.prod.yaml`](../compose.prod.yaml), [`nginx/nginx.conf`](../nginx/nginx.conf), [`scripts/dev.mjs`](../scripts/dev.mjs), kök [`.env.example`](../.env.example) | Windows `npm.cmd` + `taskkill /T /F` düzeltildi; production Nginx ters proxy ve multi-stage build yapılandırması eklendi. |
| `e2e/` | Playwright + Chromium, geçici MongoDB `rs0`, API + 2 Vite ön yüz ile uçtan uca tarayıcı regresyonu | 4 senaryo geçiyor; gerçek Google OAuth ve gerçek Brevo gönderimi dış ortamda test edilmeyi bekliyor. |

---

## 2. Gözlemlenen Güncel Kalite Metrikleri (`iyilestirme-ve-test`)

Doğrudan bu dal üzerinde çalıştırılan doğrulamalar:

| Kontrol Komutu | Kapsam | Gözlemlenen Sonuç |
| --- | --- | --- |
| `npm.cmd run check` (Lint) | `backend` + `frontend` + `frontend/hackaton` ESLint | **0 hata, 0 uyarı** (geçti) |
| `npm.cmd run check` (Backend) | `backend/tests/*.test.js` (`MongoMemoryReplSet` v7.0.24) | **44/44 geçti** (7 dosya) |
| `npm.cmd run check` (Panel) | `frontend/src/**/*.test.{js,jsx}` (Vitest) | **24/24 geçti** (5 dosya) |
| `npm.cmd run check` (Hackaton) | `frontend/hackaton/src/**/*.test.{js,jsx}` (Vitest) | **221/221 geçti** (27 dosya; 0 `act(...)` uyarısı) |
| `npm.cmd run check` (Build) | `frontend` ve `frontend/hackaton` Vite üretim build + `404.html` | **İki build de geçti** |
| `npm.cmd run test:roadmap` | **Katman 2 Yol Haritası Kabul Kapıları** (5 Backend + 3 Panel + 4 Hackaton) | **12/12 geçti (%100 yeşil)** |
| `node --test --test-concurrency=1 backend/tests/challenger/*.test.js` | M1/M2/M5 Challenger stres ve sınır testleri | **26/26 geçti** |
| `npm.cmd exec --prefix frontend -- vitest run tests/challenger/m4-challenge.test.jsx` | M4 Panel Challenger sınır testleri | **12/12 geçti** |
| `npm.cmd run test:e2e` | `e2e/flows.spec.cjs` (Chromium headless) | **4/4 geçti** (13.0s) |
| `npm.cmd run check:layout --prefix frontend/hackaton` | Responsive taşma / footer yerleşim doğrulaması | **1/1 geçti** |

> **Tarihsel Karşılaştırma (`dev` `3723e57` → `iyilestirme-ve-test`):** `dev` dalındaki ilk `37/7/210` test yapısı yeni hataları kapsamıyordu. Bu dalda önce Katman 1 (`44/24/221`) + Katman 2 (`12` fail kapısı) kuruldu; ardından Teamwork M1–M5 düzeltmeleriyle **12/12 yol haritası kapısı ve 38 Challenger testi** dahil tamamı yeşile geçirildi.

---

## 3. Modül Durumu, Çözülenler ve Kalan Harici Ön Koşullar

- **Tamamlanmış ve Doğrulanmış Çekirdek + İyileştirme Akışları (Blok A–F):**
  - Ekip kayıt/OTP/`PENDING`/onay/giriş + şifre sıfırlama (`forgot-password`/`reset-password`) + `tokenVersion` ile oturum iptali.
  - Katılımcı E-posta OTP & Google OAuth doğrulama; HTML/CRLF enjeksiyonuna kapalı Brevo şablonları; `FormResponse` `(form, singleSubmissionKey)` partial unique index & transaction + kota kontrolü.
  - `EventPage` + `Form` senkron yayını; `/kayit` üzerinde KVKK rıza alanı, 10 alan türü (`file`, `number`, `radio`, `date` dahil) ve `FormData` yükleme; `main.jsx` açılışta API SPOF koruması; `Admin.jsx` son sunucu içeriğine sıfırlama ve boş sponsor/jüri/mentor adı reddi.
  - `Content` eski yerel kapak görseli temizliği & URL/tip doğrulaması; legacy CSV/JSON export'ta `?search=` filtresi; `Applications.jsx` & `Users.jsx` UI/filtre/pager/dosya indirme sertleştirmesi.
  - Windows `scripts/dev.mjs` + `check-layout.mjs` uyumu; üretim multi-stage `Dockerfile` + `compose.prod.yaml` + `nginx/nginx.conf` + `.env.example` + `seed.js` hizalaması.
- **Kapsam Sınırı / Faz 2 Olarak Korunanlar:**
  - **Backend-Hazır Modüller (P2.3 / C9):** `Content` (`/api/v1/content`) ve çoklu `Form` (`/api/v1/forms`) CRUD API'leri backend tarafında tam hazır ve testlidir; ön yüz panelleri Faz 2 genel kulüp sitesi genişlemesi için ayrılmıştır.
  - **Opsiyonel `/admin` Cila Kalemleri (Blok D.13 devamı):** `409 Conflict` sonrası otomatik revision yenileme, `/admin` açılışında `/auth/me` oturum ön kontrolü ve `Form` kota/tarih düzenleme kontrolleri henüz ayrı bir ekran olarak eklenmemiştir.
- **Canlıya Çıkış İçin Kalan Varlık & Dış Ortam Ön Koşulları (BKZ: [`CANLIYA_CIKIS_KONTROL_LISTESI.md`](CANLIYA_CIKIS_KONTROL_LISTESI.md)):**
  1. `frontend/hackaton/public/fonts/` altındaki ~4,27 MB `.ttf` fontlarının `.woff2` alt kümesine düşürülmesi, gerçek `favicon.svg` + `og-image.png` görsellerinin ve organizasyonun gerçek hackathon içeriklerinin/resmi KVKK metni linkinin yerleştirilmesi.
  2. Gerçek Google Cloud Web Client ID & Authorized JavaScript Origins eşleşmesi.
  3. Gerçek Brevo API anahtarı + PAU domain SPF/DKIM teslimat doğrulaması.
  4. Kalıcı `uploads/` + MongoDB replica set (`rs0`) yedek/geri yükleme tatbikatı ve kullanıcı onayıyla `iyilestirme-ve-test` → `dev` → `main` yayın birleştirmesi.

---

## 4. `documents/` Klasörü Güncellik Denetim Matrisi

| Belge | Güncellik Durumu | Tespit Edilen Çelişki / Eksik |
| --- | --- | --- |
| [`SORUNLAR.md`](SORUNLAR.md) | **Güncellendi (10 Kasım)** | `dev` kod taramasında çıkan 20 açık bug/regresyon/canlıya çıkış engeli blok blok eklendi. |
| [`MEVCUT_PROJE_DURUMU.md`](MEVCUT_PROJE_DURUMU.md) | **Güncellendi (10 Kasım)** | Gözlemlenen test metrikleri, modül envanteri ve belge güncellik matrisi eklendi. |
| [`IYILESTIRME_VE_TEST_PLANI.md`](IYILESTIRME_VE_TEST_PLANI.md) | **Güncellendi (10 Kasım)** | Eski 12 Ekim bölüm tablosu düzeltildi; P0→P3 yol haritası ve 2 katmanlı test stratejisi eklendi. |
| [`API.md`](API.md) | **Kısmen Bayat (12 Ekim gövdesi)** | Başlık 21 Ekim uyarısı taşısa da gövdede "29 endpoint" diyor (gerçekte 34), `PATCH /users/:id/role` belgesiz, 5. OTP denemesi silme davranışı kodla tam örtüşmüyor, legacy/form upload kuralları eski kalmış. |
| [`DATABASE.md`](DATABASE.md) | **Bayat / Çelişkili (12 Ekim gövdesi)** | `VerificationToken` plaintext (`dev`'de hash'li), `User.role` `PENDING` yok (`dev`'de var), `Participant`/`ParticipantOtp`/`EventPage` yok, **ve 143. satır `FormResponse` partial unique indeksinin var olduğunu iddia etmesine rağmen kodda yok**. |
| [`INCELEME_KAPSAMI.md`](INCELEME_KAPSAMI.md) | **Bayat (12 Ekim anlık görüntüsü)** | Kaldırılan `web/` klasörünü ve eski "20 backend testi" sayısını anlatıyor; `frontend/hackaton/`, `frontend/` testleri ve `e2e/` kapsam dışı. |
| [`KATILIMCI_DOGRULAMA.md`](KATILIMCI_DOGRULAMA.md) | **Güncelliğini Yitirmiş (Tasarı döneminden)** | Güvenlik sorunları çözüldüğü halde body kısmı hâlâ public `/uploads`, tek `CLIENT_URL` ve zayıf seed uyarısı anlatıyor; buna karşın yeni OTP HTML injection ve KVKK eksikliğinden söz etmiyor. |
| [`KURULUM.md`](KURULUM.md) | **Büyük Ölçüde Güncel (Küçük eksikler var)** | Kurulum/Docker adımları çalışıyor; ancak Windows `scripts/dev.mjs` uyumsuzluğu, `npm.cmd` PowerShell kısıtı ve `seed.js` vs `ensureHackathonPage` form ayrımı eksik. |
| [`architecture.md`](architecture.md) | **Büyük Ölçüde Güncel** | İki ön yüz + shared yapı doğru anlatılmış; `Content`/Form UI yetimliği, atıl `Team.js` ve `main.jsx` SPOF davranışı eksik. |
| [`GUVENLIK_VE_DOSYALAR.md`](GUVENLIK_VE_DOSYALAR.md) | **Büyük Ölçüde Güncel** | Private/public upload ayrımı doğru; `Content` eski dosya sızıntısı ve OTP HTML enjeksiyonu riskini henüz kapsamıyor. |
| [`proje_taslagi_v2.md`](proje_taslagi_v2.md) | **Tarihsel Tasarım Brifi** | Genel GDG kulüp sitesi + KVKK + Hackathon vizyonunu anlatır; şu an sadece Hackathon ayağı kuruldu, KVKK ise atlandı. |
| [`gdg_guideline_instructions.md`](gdg_guideline_instructions.md) | **Tarihsel Tasarım Kılavuzu** | UI/kimlik kuralları için referans doküman; güncel teknik gerçekliği içermez. |
