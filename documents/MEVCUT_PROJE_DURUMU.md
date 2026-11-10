# Mevcut Proje Durumu

> **Güncelleme (10 Kasım 2026 — `dev` / `3723e57` doğrulaması):** Bu belge `dev` dalındaki gerçek kaynak kodun, bağımlılık kurulumunun, tüm otomatik test/lint/build/E2E koşumlarının ve `documents/` altındaki 12 belgenin güncellik taramasının sonuçlarını özetler. Açık hataların kök neden ve çözümleri [SORUNLAR.md](SORUNLAR.md), öncelikli yol haritası ve test matrisi ise [IYILESTIRME_VE_TEST_PLANI.md](IYILESTIRME_VE_TEST_PLANI.md) dosyasındadır.

---

## 1. Dizinler ve Gerçek Sorumluluklar

| Dizin / Dosya | Gerçekte Çalışan İşlev | Not / Kısıt |
| --- | --- | --- |
| `backend/` | Express 5 + Mongoose 9 API; ekip auth (`JWT` + `VerificationToken`), katılımcı doğrulama (`ParticipantOtp` + Google ID token), `Form` / `FormResponse` (MongoDB transaction + private dosya + streaming CSV/JSON export), `EventPage` (revizyon kilidi), `Content` (public upload), `HackathonApp` (legacy modül) | `FormResponse` üzerinde `singleSubmissionKey` partial unique indeksi regresyonla düşmüş durumda; `Content` update/delete eski public dosyayı silmiyor; `Team.js` / `User.permissions` / `LOGIN_2FA` atıl. |
| `frontend/` | Core Team yönetim paneli (Hash tabanlı route); Giriş, Kayıt, E-posta OTP, `PENDING` kullanıcı onay listesi (`Users.jsx`), başvurular + CSV + private dosya indirme (`Applications.jsx`) | `Content` ve çoklu `Form` CRUD API'leri için UI yok; panel tek bir etkinlik formuna (`event-page/hackathon`) veya legacy listeye bakıyor. |
| `frontend/hackaton/` | Etkinlik vitrin sitesi (`/`, `/program`, `/ekip`, `/kayit`, `/admin`), çok adımlı başvuru (`StepForm.jsx`), katılımcı doğrulaması (`ParticipantVerification.jsx`), sunucuya sürümlü yayın yapan `/admin` editörü | `main.jsx` açılışta API hatasında `/admin` dahil tüm siteyi kilitliyor; `/kayit` üzerinde KVKK onayı ve `file`/`number`/`radio`/`date` alan desteği eksik; `.ttf` fontlar (~4,27 MB) ağır ve içerik yer tutucu. |
| `shared/` | Başlangıç şablonu (`hackathon-event.json`) ve ortak şema doğrulayıcısı (`eventContent.mjs`) | Şablon `choices.kind` yalnızca 6 türü (`text`, `textarea`, `email`, `tel`, `select`, `checkbox`) destekliyor. |
| `e2e/` | Playwright + Chromium, geçici MongoDB `rs0`, API + 2 Vite ön yüz ile uçtan uca tarayıcı regresyonu | 4 senaryo geçiyor; gerçek Google OAuth ve gerçek Brevo gönderimi dış ortamda test edilmeyi bekliyor. |

---

## 2. Gözlemlenen Güncel Kalite Metrikleri (`3723e57`)

Doğrudan bu dal üzerinde temiz `npm.cmd run setup` sonrasında çalıştırılan doğrulamalar:

| Kontrol Komutu | Kapsam | Gözlemlenen Sonuç |
| --- | --- | --- |
| `npm.cmd run lint` | `backend` + `frontend` + `frontend/hackaton` ESLint | **0 hata, 0 uyarı** (geçti) |
| `npm.cmd test --prefix backend` | `tests/*.test.js` (`MongoMemoryReplSet` v7.0.24) | **37/37 geçti** (5 dosya) |
| `npm.cmd test --prefix frontend` | `src/**/*.test.{js,jsx}` (Vitest) | **7/7 geçti** (2 dosya) |
| `npm.cmd test --prefix frontend/hackaton` | `src/**/*.test.{js,jsx}` (Vitest) | **210/210 geçti** (24 dosya; `ParticipantVerification.test.jsx` ve `Admin.test.jsx` içinde async `act(...)` stderr uyarısı vardı) |
| `npm.cmd run build` | `frontend` ve `frontend/hackaton` Vite üretim build + `404.html` | **İki build de geçti** |
| `npm.cmd run test:e2e` | `e2e/flows.spec.cjs` (Chromium headless) | **4/4 geçti** (16.7s) |

> **Önemli Fark (`iyilestirme-ve-test` Test Genişletmesi):** `dev` (`3723e57`) üzerindeki ilk 37/7/210 tablosu yeni tespit edilen regresyon/eksikleri yakalamıyordu. `iyilestirme-ve-test` dalında iki katmanlı suite kuruldu:
> - **Katman 1 (`npm run check`):** Backend **44/44**, Yönetim Paneli **24/24**, Etkinlik Sitesi **221/221** (tüm React `act(...)` uyarıları temizlendi), ESLint **0**, Build **2/2** ve Playwright E2E **4/4** geçiyor.
> - **Katman 2 (`npm run test:roadmap`):** `P0`–`P2` açık bug ve eksiklerini yakalayan **12 yol haritası kabul kapısı** (`5` backend, `3` panel, `4` etkinlik sitesi) şu anda `dev` üzerindeki açık hatalar nedeniyle beklenen şekilde kırmızı (fail) durumdadır.

---

## 3. Modül ve Özellik Durum Özeti (Aktif vs Yarım/Atıl vs Eksik)

- **Tamamlanmış Çekirdek Akışlar:** Ekip kayıt/OTP/`PENDING`/onay/giriş; katılımcı E-posta OTP & Google OAuth doğrulama; `EventPage` + `Form` senkron yayını; `FormResponse` transaction + kota kontrolü; private dosya upload/imza kontrolü/yetkili indirme; `Applications.jsx` dinamik + legacy kaynak seçimi & CSV indirme.
- **Yarım veya Uyumsuz Kısımlar:**
  - `Content` CMS ve çoklu `Form` CRUD endpoint'leri backend'de çalışır durumda ancak ön yüzde ekranı yok.
  - `/kayit` sihirbazı `Form` modelinin desteklediği `file`, `number`, `radio`, `date` alanlarını desteklemiyor; yalnızca JSON gönderiyor (`FormData` göndermiyor).
  - `/admin` editöründe kota/tarih/doğrulama yöntemi ayarı, 409 sonrası revision tazeleme, sunucu verisine sıfırlama ve açılışta `/auth/me` oturum doğrulaması eksik.
  - `Users.jsx` tarafında `PENDING` rol filtresi ve boş liste durumu yok.
  - `seed.js` (`hackathon-2026-basvuru`) ile `ensureHackathonPage` (`hackathon-katilim`) farklı formlar oluşturuyor.
- **Atıl (Kullanılmayan) Yapılar:** [`backend/src/models/Team.js`](../backend/src/models/Team.js), `User.permissions`, `VerificationToken` `LOGIN_2FA` enum değeri.
- **Canlıya Çıkış Engelleri (P0):**
  1. `FormResponse` üzerinde `singleSubmissionKey` partial unique indeksi eksik.
  2. OTP e-postalarında unescaped kullanıcı verisi kaynaklı HTML/Phishing enjeksiyonu riski.
  3. `/kayit` üzerinde KVKK Aydınlatma ve Açık Rıza onayı yok.
  4. Üretim Dockerfile / reverse proxy yapılandırması yok (yalnızca dev `nodemon` + `vite` var), `main` dalı `dev`'in 35 commit gerisinde ve dış ortam (gerçek Google OAuth origin, doğrulanmış Brevo alan adı, kalıcı `uploads/` + DB yedek/geri yükleme, gerçek etkinlik içeriği) kabul kontrolleri tamamlanmadı.

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
