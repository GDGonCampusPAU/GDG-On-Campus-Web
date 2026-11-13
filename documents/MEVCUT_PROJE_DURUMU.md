# Mevcut Proje Durumu

> **Güncelleme (11 Kasım 2026 — `iyilestirme-ve-test` / Commit `b4fbf69` & Milestone 2):** Bu belge, `iyilestirme-ve-test` dalında `b4fbf69` commit'i ile eklenen Başvuru Durum İnceleme İş Akışı (`PENDING`, `APPROVED`, `REJECTED`, `statusNote`, bilgilendirme e-postaları), Brevo E-posta Gönderici Profilleri ve Core Team paneli inceleme kontrollerinin ardından güncellenmiştir. Projedeki tüm testler (Katman 1: 295 birim/entegrasyon testi, Katman 2: 12 yol haritası kabul kapısı, 38 Challenger testi, 4 E2E senaryosu ve 1 Layout testi olmak üzere **tam 350 test**) eksiksiz olarak geçmektedir. Dokümantasyon haritası, sorun matrisi [SORUNLAR.md](SORUNLAR.md), yol haritası [IYILESTIRME_VE_TEST_PLANI.md](IYILESTIRME_VE_TEST_PLANI.md), canlıya çıkış adımları [CANLIYA_CIKIS_KONTROL_LISTESI.md](CANLIYA_CIKIS_KONTROL_LISTESI.md) ve kapsamlı eksiklik rehberi [Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md](../Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md) dosyalarındadır.

---

## 1. Dizinler ve Güncel Durum (`iyilestirme-ve-test` — Commit `b4fbf69`)

| Dizin / Dosya | Gerçekte Çalışan İşlev | Güncel Durum & Kalan Not |
| --- | --- | --- |
| `backend/` | Express 5 + Mongoose 9 API; ekip auth (`JWT`, `tokenVersion` + `/forgot-password`/`/reset-password`, `VerificationToken`), katılımcı doğrulama (`ParticipantOtp` + Google ID token), `Form` / `FormResponse` (MongoDB transaction + partial unique index + private dosya + streaming CSV/JSON export), başvuru durum inceleme API'leri (`PATCH .../status`), `EventPage`, `Content` CMS, legacy `HackathonApp` | `b4fbf69` ile başvuru durum yönetimi (`PENDING`, `APPROVED`, `REJECTED`), inceleme notu (`statusNote`), `reviewedBy`/`reviewedAt`, Brevo bildirim e-postaları ve e-posta gönderici profilleri (`BREVO_APPLICATION_SENDER_*`) eklendi. Test suite'e `application-status-and-email.test.js` katılarak backend test sayısı 47'ye yükseltildi. |
| `frontend/` | Core Team yönetim paneli (Hash tabanlı route); Giriş, Kayıt, E-posta OTP, rol filtreli (`PENDING`) kullanıcı onay listesi (`Users.jsx`), kart içi başvuru inceleme & durum güncelleme kontrolleri (`app-card__review`), durum filtreleri (`ALL`, `PENDING`, `APPROVED`, `REJECTED`), CSV + güvenli dosya indirme (`Applications.jsx`) | `Applications.jsx` yeni başvuru durum filtreleri, durum rozetleri (`Beklemede`/`Onaylandı`/`Reddedildi`) ve bildirim e-postası onaylı kart içi değerlendirme kontrolleri ile zenginleştirildi; panel test sayısı 27'ye yükseltildi. `Content` ve çoklu `Form` CRUD ekranları Faz 2 genel GDG portalı için backend-ready durumdadır. |
| [`frontend/hackaton/`](../frontend/hackaton/) | Etkinlik vitrin sitesi (`/`, `/program`, `/ekip`, `/kayit`, `/admin`), KVKK onaylı ve 10 alan tipini (`file`, `number`, `radio`, `date` + `FormData`) destekleyen başvuru sihirbazı (`StepForm.jsx`), sunucuya sürümlü yayın yapan `/admin` editörü | `main.jsx` açılış API hatasında Router'ı kilitlemez (uyarı şeridi + fallback); `Admin.jsx` sıfırlama `serverEvent`'e döner, `isEventShape` boş sponsor/jüri/mentor adlarını reddeder. Fontlar alt kümeli `.woff2`, `favicon.svg` ve `og-image.png` (`npm run og-image`) eklendi (13 Kasım 2026). |
| `shared/` | Başlangıç şablonu (`hackathon-event.json`, Step 4 `kvkkConsent` dahil) ve ortak doğrulayıcı (`eventContent.mjs`) | 10 alan türü (`text`, `textarea`, `email`, `tel`, `select`, `checkbox`, `file`, `number`, `radio`, `date`) ve boş isim koruması aktif. |
| `infra & scripts/` | Çok aşamalı üretim [`Dockerfile`](../Dockerfile), [`compose.prod.yaml`](../compose.prod.yaml), [`nginx/nginx.conf`](../nginx/nginx.conf), [`scripts/dev.mjs`](../scripts/dev.mjs), kök [`.env.example`](../.env.example) | Windows `npm.cmd` + `taskkill /T /F` düzeltildi; production Nginx ters proxy ve multi-stage build yapılandırması eklendi. |
| `e2e/` | Playwright + Chromium, geçici MongoDB `rs0`, API + 2 Vite ön yüz ile uçtan uca tarayıcı regresyonu | 4 senaryo geçiyor; gerçek Google OAuth ve gerçek Brevo gönderimi dış ortamda test edilmeyi bekliyor. |

---

## 2. Gözlemlenen Güncel Kalite Metrikleri (`iyilestirme-ve-test`)

Doğrudan bu dal üzerinde çalıştırılan doğrulamalar:

| Kontrol Komutu | Kapsam | Gözlemlenen Sonuç |
| --- | --- | --- |
| `npm.cmd run check` (Lint) | `backend` + `frontend` + `frontend/hackaton` ESLint | **0 hata, 0 uyarı** (geçti) |
| `npm.cmd run check` (Backend) | `backend/tests/*.test.js` (`MongoMemoryReplSet` v7.0.24) | **47/47 geçti** (8 test dosyası) |
| `npm.cmd run check` (Panel) | `frontend/src/**/*.test.{js,jsx}` (Vitest) | **27/27 geçti** (5 test dosyası) |
| `npm.cmd run check` (Hackaton) | `frontend/hackaton/src/**/*.test.{js,jsx}` (Vitest) | **221/221 geçti** (27 dosya; 0 `act(...)` uyarısı) |
| `npm.cmd run check` (Build) | `frontend` ve `frontend/hackaton` Vite üretim build + `404.html` | **İki build de geçti** |
| `npm.cmd run test:roadmap` | **Katman 2 Yol Haritası Kabul Kapıları** (5 Backend + 3 Panel + 4 Hackaton) | **12/12 geçti (%100 yeşil)** |
| `node --test --test-concurrency=1 backend/tests/challenger/*.test.js` | M1/M2/M5 Challenger stres ve sınır testleri | **26/26 geçti** |
| `npm.cmd exec --prefix frontend -- vitest run tests/challenger/m4-challenge.test.jsx` | M4 Panel Challenger sınır testleri | **12/12 geçti** |
| `npm.cmd run test:e2e` | `e2e/flows.spec.cjs` (Chromium headless) | **4/4 geçti** (16.1s) |
| `npm.cmd run check:layout --prefix frontend/hackaton` | Responsive taşma / footer yerleşim doğrulaması | **1/1 geçti** |

> **Genel Test Özeti (Commit `b4fbf69`):** Projede Katman 1 (`47 + 27 + 221 = 295`), Katman 2 (`12`), Challenger (`26 + 12 = 38`), E2E (`4`) ve Layout (`1`) olmak üzere **tam 350 test** mevcuttur ve %100 oranında geçmektedir.

---

## 3. Modül Durumu, Çözülenler ve Kalan Harici Ön Koşullar

- **Tamamlanmış ve Doğrulanmış Çekirdek + İyileştirme Akışları:**
  - Ekip kayıt/OTP/`PENDING`/onay/giriş + şifre sıfırlama (`forgot-password`/`reset-password`) + `tokenVersion` ile oturum iptali.
  - Katılımcı E-posta OTP & Google OAuth doğrulama; HTML/CRLF enjeksiyonuna kapalı Brevo şablonları; `FormResponse` `(form, singleSubmissionKey)` partial unique index & transaction + kota kontrolü.
  - **Başvuru Durum İnceleme İş Akışı (Commit `b4fbf69`):** Hem dinamik form yanıtları (`PATCH /api/v1/forms/:id/responses/:responseId/status`) hem de hackathon başvuruları (`PATCH /api/v1/hackathon/applications/:id/status`) için `PENDING`, `APPROVED`, `REJECTED` durum geçişleri, `statusNote`, `reviewedBy`, `reviewedAt` takibi ve özelleştirilebilir e-posta gönderici profilleriyle adaya anlık bildirim iletimi.
  - `EventPage` + `Form` senkron yayını; `/kayit` üzerinde KVKK rıza alanı, 10 alan türü (`file`, `number`, `radio`, `date` dahil) ve `FormData` yükleme; `main.jsx` açılışta API SPOF koruması; `Admin.jsx` son sunucu içeriğine sıfırlama ve boş sponsor/jüri/mentor adı reddi.
  - `Content` eski yerel kapak görseli temizliği & URL/tip doğrulaması; CSV/JSON export'ta `?status=` ve `?search=` filtreleri; `Applications.jsx` & `Users.jsx` UI/filtre/pager/dosya indirme sertleştirmesi.
  - Windows `scripts/dev.mjs` + `check-layout.mjs` uyumu; üretim multi-stage `Dockerfile` + `compose.prod.yaml` + `nginx/nginx.conf` + `.env.example` + `seed.js` hizalaması.
- **Kapsam Sınırı / Faz 2 Olarak Korunanlar:**
  - **Backend-Hazır Modüller (P2.3 / C9):** `Content` (`/api/v1/content`) ve çoklu `Form` (`/api/v1/forms`) CRUD API'leri backend tarafında tam hazır ve testlidir; ön yüz panelleri Faz 2 genel kulüp sitesi genişlemesi için ayrılmıştır.
  - **Opsiyonel `/admin` Cila Kalemleri:** `409 Conflict` sonrası otomatik revision yenileme ve açılışta `/auth/me` kontrolü opsiyonel cila olarak korunmaktadır.
- **Canlıya Çıkış İçin Kalan Varlık & Dış Ortam Ön Koşulları (BKZ: [`CANLIYA_CIKIS_KONTROL_LISTESI.md`](CANLIYA_CIKIS_KONTROL_LISTESI.md) ve [`Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md`](../Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md)):**
  1. ~~`.ttf` fontlarının `.woff2` alt kümesine düşürülmesi, `favicon.svg` ve `og-image.png` varlıklarının eklenmesi.~~ Tamamlandı (13 Kasım 2026); gerçek içerik girilince `og-image.png` yeniden üretilmeli.
  2. Gerçek Google Cloud Web Client ID & Authorized JavaScript Origins eşleşmesi.
  3. Gerçek Brevo API anahtarı + PAU domain SPF/DKIM teslimat doğrulaması.
  4. Kalıcı `uploads/` + MongoDB replica set (`rs0`) yedek/geri yükleme tatbikatı ve `iyilestirme-ve-test` dalının pushlanıp `dev` dalına merge edilmesi.

---

## 4. `documents/` Klasörü Güncellik Denetim Matrisi

| Belge | Güncellik Durumu | Açıklama |
| --- | --- | --- |
| [`Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md`](../Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md) | **Yeni Oluşturuldu (11 Kasım)** | Tüm tespit edilen eksiklikler (30 madde), kök neden analizi ve adım adım düzeltme rehberi. |
| [`API.md`](API.md) | **Güncellendi (11 Kasım)** | Toplam 40 HTTP uç noktası (37 `/api/v1` + `/health`, `/ready`, `/uploads/:filename`), durum inceleme API'leri, şifre sıfırlama, e-posta profilleri ve request/response modelleri. |
| [`DATABASE.md`](DATABASE.md) | **Güncellendi (11 Kasım)** | `FormResponse` ve `HackathonApp` inceleme alanları, `crypto.randomInt` + HMAC düzeltmesi, `roleChangeVersion` ve güncel indeksler. |
| [`MEVCUT_PROJE_DURUMU.md`](MEVCUT_PROJE_DURUMU.md) | **Güncellendi (11 Kasım)** | Commit `b4fbf69`, 350 testlik güncel metrikler ve modül durumu. |
| [`CANLIYA_CIKIS_KONTROL_LISTESI.md`](CANLIYA_CIKIS_KONTROL_LISTESI.md) | **Güncellendi (11 Kasım)** | Test sayıları senkronize edildi, Brevo sender profile ortam değişkenleri eklendi. |
| [`IYILESTIRME_VE_TEST_PLANI.md`](IYILESTIRME_VE_TEST_PLANI.md) | **Güncellendi (11 Kasım)** | Test metrikleri güncellendi (47 backend, 27 panel, 221 hackaton, 350 toplam test). |
| [`KURULUM.md`](KURULUM.md) | **Güncellendi (11 Kasım)** | Windows PowerShell `npm.cmd` yönergesi ve `compose.prod.yaml` bilgileri eklendi. |
| [`SORUNLAR.md`](SORUNLAR.md) | **Güncel** | 20 açık bug ve çözüm dökümü. |
| [`architecture.md`](architecture.md) | **Büyük Ölçüde Güncel** | İki ön yüz + shared yapı ve servis sınırları. |
| [`GUVENLIK_VE_DOSYALAR.md`](GUVENLIK_VE_DOSYALAR.md) | **Büyük Ölçüde Güncel** | Private/public upload ayrımı ve güvenlik modeli. |
