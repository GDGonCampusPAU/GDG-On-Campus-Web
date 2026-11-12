# GDG On Campus Pamukkale — Kapsamlı Proje Eksiklikleri ve Düzeltme Rehberi

**Tarih:** 11 Kasım 2026  
**Hazırlayan:** Teknik Denetim ve Dokümantasyon Ekibi  
**Kapsam:** GDG On Campus Pamukkale Üniversitesi Web Platformu (Kök Yapı, Backend REST API, Core Team Yönetim Paneli, Hackathon Vitrin ve Başvuru Sitesi, Paylaşılan Modüller, Docker/Nginx Altyapısı, Dış Servisler, Test & CI/CD)  
**Çalışma Dalı (Branch):** `iyilestirme-ve-test` (`b4fbf69` + `d53b4e2` dokümantasyon/audit senkronizasyonu -> `dev` dalına fast-forward merge; `main` kullanıcı onayına kadar dokunulmaz)  
**Güncelleme (12 Kasım 2026):** `fix/security-hardening` dalında bu rehberde **yer almayan** 9 ek güvenlik bulgusu (SEC-01 – SEC-09) giderildi ve `DEF-17` kısmen çözüldü; ayrıntılar [Bölüm 5](#5-ek-güvenlik-sertleştirmesi-sec-01--sec-09). Diğer 29 madde açıktır. Bu dalda backend testi 47 → 55'e çıktı.  
**Doğrulama Durumu:** **350/350 Test Başarılı** (`47` Backend + `27` Panel + `221` Hackaton + `12` Yol Haritası + `38` Challenger + `4` E2E + `1` Layout), **0 ESLint Hatası**, **2 Vite Derlemesi Başarılı**

---

## 1. Giriş ve Yönetici Özeti

Bu doküman, Google Developer Groups On Campus Pamukkale Üniversitesi web platformunun uçtan uca teknik denetimi sonucunda tespit edilen **30 eksiklik, mimari darboğaz, güvenlik/bağımlılık riski, üretim dağıtım (Docker/Nginx/Cloudflare/Brevo/Google OAuth) boşluğu ve UX eksikliğini** ayrıntı atlamadan belgelemektedir.

Platform; Express 5 + Mongoose 9 tabanlı REST API (`backend/` — toplam 40 HTTP uç noktası), React 19 + Vite tabanlı Core Team Paneli (`frontend/`), React 18 + React Router 7 + Vite tabanlı Hackathon Vitrin ve Başvuru Sitesi (`frontend/hackaton/`) ile Playwright E2E test takımından oluşmaktadır. Fonksiyonel kalite kapılarının tamamı (**350/350 test**) geçmekle birlikte; **11 adet P0 (Canlıya Çıkış Engeli)**, **13 adet P1 (Orta / Mimari & Ürün Tamlığı)** ve **6 adet P2 (Düşük / Hijyen, Dil & İkincil Dokümanlar)** olmak üzere **30 maddenin** canlıya çıkış (`main` merge ve `gdgocpamukkale.com` yayını) öncesinde ve Faz 2 sürecinde ele alınması gerekmektedir.

---

## 2. Önceliklendirilmiş Eksiklik Matrisi (30 Madde: 11 P0 / 13 P1 / 6 P2)

| No | Kategori | Eksiklik Tanımı | Konum | Seviye | Öncelik |
|---|---|---|---|---|---|
| **DEF-07** | Arayüz & Varlıklar | Hackathon Vitrininde Eksik `favicon.svg` ve Kırık `og-image.png` (HTTP 404) | `frontend/hackaton/index.html:7,13,17`, `public/` | High | **P0** |
| **DEF-08** | Arayüz & Varlıklar | Optimize Edilmemiş Ham TTF Font Yükü (~4,31 MB Hackaton + ~6,48 MB Panel) | `frontend/hackaton/public/fonts/`, `frontend/public/fonts/` | High | **P0** |
| **DEF-10** | Arayüz & İçerik | Etkinlik Vitrini Yer Tutucu Verileri & Kök Sosyal Medya Bağlantıları (`label`/`url`) | `shared/hackathon-event.json:7,34-53,104-154,444-457` | High | **P0** |
| **DEF-11** | Hukuk & KVKK | Formda Tıklanabilir KVKK Aydınlatma Bağlantısı / Modalının Olmaması | `StepForm.jsx:154,177`, `Field.jsx:8-12`, `hackathon-event.json:432` | High | **P0** |
| **DEF-14** | Mimari & Durum | Etkinlik Vitrininde Reaktif Olmayan Modül Değişkeni (`let event = base`) | `frontend/hackaton/src/data/event.js:9-16`, `main.jsx:11-41` | High | **P0** |
| **DEF-17** | Ortam & Dağıtım | Ortam Değişkeni Şablonlarının Parçalı Olması (`.env.example` vs `.env.docker.example` vs `compose.prod.yaml`) — **Kısmen çözüldü** (`9488de3`) | `.env.example`, `.env.docker.example`, `compose.prod.yaml` | High | **P0** |
| **DEF-21** | Test & CI/CD | Challenger Güvenlik Testlerinin (26 Backend + 12 Panel = 38 Test) Varsayılan `npm test` Dışında Kalması | `backend/package.json:10`, `frontend/vitest.config.js:5` | High | **P0** |
| **DEF-23** | Güvenlik & Paket | Bağımlılık Güvenlik Açıkları (`backend --omit=dev` 5 üretim açığı dahil toplam 18 audit uyarısı) | `backend/package.json`, `frontend/`, `hackaton/`, kök | High | **P0** |
| **DEF-26** | Ortam & Dağıtım | Production `Dockerfile` & `compose.prod.yaml` İçinde `VITE_GOOGLE_CLIENT_ID` Build Argümanı Eksikliği | `Dockerfile:44-61`, `compose.prod.yaml:63-70` | High | **P0** |
| **DEF-27** | Ortam & Dağıtım | `nginx/nginx.conf` İçinde `:443` TLS & Host Yönlendirmesi Eksikliği (Cloudflare `:8080` Engeli) | `nginx/nginx.conf:6-134`, `compose.prod.yaml:63-70` | High | **P0** |
| **DEF-28** | Canlı Operasyon | Dış Ortam Ön Koşulları (Cloudflare DNS, Brevo SPF/DKIM/Key, Google OAuth, Üretim Sırları, Backup Tatbikatı) | Dış servisler & sunucu ortamı | High | **P0** |
| **DEF-02** | Mimari & Dizin | Dokümantasyon Klasör Çift Başlılığı (`documents/` vs `Docs/`) | Kök dizin (`documents/`, `Docs/`) | Medium | **P1** |
| **DEF-04** | Mimari & Paket | Kök Dizin Paket Yönetiminde `workspaces` Tanımının Bulunmaması (`e2e/server.cjs` kırılgan importları) | `package.json:1-27`, `e2e/server.cjs:12-15` | Medium | **P1** |
| **DEF-05** | Mimari & Durum | Ön Yüzler Arasında React Sürüm Uyumsuzluğu (Panel React 19 vs Hackaton React 18) | `frontend/package.json:15` vs `hackaton/package.json:20` | Medium | **P1** |
| **DEF-06** | Mimari & Durum | Core Team Panelinde İlkel Hash Tabanlı Yönlendirme (`window.location.hash`) | `frontend/src/App.jsx:11-37` | Medium | **P1** |
| **DEF-09** | Arayüz & A11y | `PersonCard.jsx:19` Boş `alt=""` Özelliği ile `PersonCard`/`SponsorGrid` Tembel Yükleme Eksikliği | `PersonCard.jsx:19`, `SponsorGrid.jsx:5` | Medium | **P1** |
| **DEF-15** | Kod Kalitesi | Atıl Şema Kalıntıları ve Legacy/Dinamik Çift Başvuru Akışı Kararı (`Team.js`, `HackathonApp.js` shim) | `Team.js`, `HackathonApp.js`, `User.js`, `VerificationToken.js` | Medium | **P1** |
| **DEF-16** | Kod Kalitesi | Proje Genelinde Statik Tip Kontrolünün (`TypeScript` / `jsconfig checkJs`) Bulunmaması | Tüm `src/**/*.js`, `src/**/*.jsx` | Medium | **P1** |
| **DEF-18** | Ortam & DX | Windows PowerShell `ExecutionPolicy` (`npm.ps1`) Kısıtı & Alt Proje Kullanım Notları | Alt `*/README.md` dosyaları | Medium | **P1** |
| **DEF-19** | Ortam & Dağıtım | Aşırı Dar Node.js Motor Sürümü Kuralı (`>=24.15.0 <25`) | Tüm `package.json` dosyaları | Medium | **P1** |
| **DEF-20** | Performans | Ön Yüz Paketlerinde Kod Bölümleme (`React.lazy` & `manualChunks`) Eksikliği (~248 KB & ~230 KB Bundle) | `frontend/vite.config.js`, `hackaton/vite.config.js`, `App.jsx` | Medium | **P1** |
| **DEF-22** | Test & CI/CD | CI İş Akışının Tek Seri İş Olması, Playwright Cache Eksikliği & Apt Geçici DNS Hatası Kırılganlığı | `.github/workflows/check.yml:1-20` | Medium | **P1** |
| **DEF-24** | Güvenlik | Canlıda (`NODE_ENV=production`) `CLIENT_URLS` Tanımsızsa `localhost` Fallback'ine Düşülmesi | `backend/src/app.js:33-40` | Medium | **P1** |
| **DEF-29** | Ürün & UX Tamlığı | Panelde Şifre Sıfırlama / Faz 2 CMS UI Eksikliği & `/admin` Cila Eksikleri (409/`/auth/me`/Kota) | `Login.jsx`, `App.jsx`, `Admin.jsx`, `eventApi.js`, `Users.jsx` | Medium | **P1** |
| **DEF-01** | Mimari & Dizin | Klasör İsminde Boşluk Karakteri ve Büyük Ham Tasarım Varlıkları (`design folders/` — ~26,2 MB) | `design folders/` (20 dosya) | Low | **P2** |
| **DEF-03** | Mimari & Dizin | Dizin Yazım Uyumsuzluğu (`frontend/hackaton/` vs `backend/src/modules/hackathon/`) | `frontend/hackaton/` | Low | **P2** |
| **DEF-12** | Güvenlik & SEO | Core Team Panelinde `robots` Meta Etiketi (ve `X-Robots-Tag`) Eksikliği | `frontend/index.html:1-13` | Low | **P2** |
| **DEF-13** | Arayüz & Dil | Ön Yüz ve Hata Mesajlarında Türkçe / İngilizce Dil Tutarsızlıkları | `Users.jsx`, `roleMiddleware.js:24`, `authController.js:248` | Low | **P2** |
| **DEF-25** | Dokümantasyon | İkincil Rehberlerin (`architecture.md`, `KATILIMCI_DOGRULAMA.md`, alt `README.md`) Senkronizasyonu | İkincil dokümanlar & alt README'ler | Low | **P2** |
| **DEF-30** | Test & Git Hijyeni | E2E Negatif/Geri Alma & Reset Kapsamı Eksikliği, Açık `PR #7` ve `main` Dalı Senkronu | `e2e/flows.spec.cjs`, GitHub `PR #7`, `main` (`d218156`) | Low | **P2** |

---

## 3. Sekiz Kategori Altında 30 Kusurun Ayrıntılı Analizi ve Çözüm Rehberi

---

### KATEGORİ 1: Mimari, Dizin Yapısı ve Durum Yönetimi

#### DEF-01: Boşluk İçeren Dizin İsmi ve ~26,2 MB Ham Tasarım Dosyaları (`design folders/`)
- **Dosya / Kod Konumu:** `design folders/` (Proje kök dizini — toplam 20 dosya, ~26.235.064 bayt / ~26,2 MB)
- **Öncelik / Ciddiyet:** **P2 — Düşük (Low)**
- **Sorun Tanımı ve Etkisi:** Dizin adında boşluk bulunması tırnak işareti unutulan kabuk betiklerini ve Linux CI/Docker kopyalama komutlarını kırabilir; ayrıca ağırlıklı olarak ham font varyantlarından oluşan ~26,2 MB veri Git deposu geçmişini gereksiz büyütmektedir.
- **Kök Neden:** Tasarım teslim paketinin doğrudan masaüstü klasör adıyla repoya eklenmesi.
- **Adım Adım Çözüm:**
  1. Dizin adını kebab-case formatına taşıyın:
     ```bash
     git mv "design folders" design-assets
     ```
  2. `.gitignore` içine büyük ham tasarım paketleri için kural ekleyin ve üretimde kullanılmayan italik/ham font varyantlarını ayrıştırın:
     ```gitignore
     design-assets/*.zip
     design-assets/raw-exports/
     ```

---

#### DEF-02: Dokümantasyon Klasör Çift Başlılığı (`documents/` vs `Docs/`)
- **Dosya / Kod Konumu:** Kök dizinde `documents/` ve `Docs/` (`Docs/superpowers/`, `Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md`)
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Windows NTFS büyük/küçük harfe duyarsızken (`Docs` = `docs`), Linux ve GitHub harfe duyarlıdır. Platformda hem `documents/` hem de büyük `D` ile `Docs/` bulunması bağlantı karmaşası oluşturur.
- **Kök Neden:** Önceki plan dosyalarının `Docs/`, ana dokümantasyonun ise `documents/` altında tutulması.
- **Adım Adım Çözüm:**
  1. Uygun bir temizlik dalında tek bir küçük harfli `docs/` dizininde birleştirin (iki aşamalı `git mv` Linux/Windows git indeksini sorunsuz günceller):
     ```bash
     git mv documents docs-tmp
     git mv Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md docs-tmp/
     git mv Docs/superpowers docs-tmp/superpowers
     git mv docs-tmp docs
     ```
  2. `README.md` ve tüm çapraz bağlantıları `docs/` altına güncelleyin.

---

#### DEF-03: Dizin Yazım Uyumsuzluğu (`frontend/hackaton/` vs `backend/src/modules/hackathon/`)
- **Dosya / Kod Konumu:** `frontend/hackaton/` ve `backend/src/modules/hackathon/`
- **Öncelik / Ciddiyet:** **P2 — Düşük (Low)**
- **Sorun Tanımı ve Etkisi:** Backend modülü ve paket adı (`gdg-pau-hackathon`) doğru "hackathon" yazımını kullanırken ön yüz dizininde "h" harfi eksiktir.
- **Kök Neden:** Eski `web/` dizininin taşınması sırasındaki adlandırma.
- **Adım Adım Çözüm:**
  - *Seçenek A (Karar olarak belgelemek):* Mevcut script, CI ve E2E yollarını bozmamak için adı koruyup `docs/architecture.md` içinde açıkça belgeleyin.
  - *Seçenek B (Yeniden adlandırmak):* `git mv frontend/hackaton frontend/hackathon` sonrasında root `package.json`, `Dockerfile`, `compose.yaml`, `nginx/nginx.conf`, `.github/workflows/check.yml`, `e2e/` ve `playwright.config.cjs` yollarını eşzamanlı güncelleyin.

---

#### DEF-04: Kök Dizin Paket Yönetiminde `workspaces` Tanımının Olmaması
- **Dosya / Kod Konumu:** `package.json:1-27` ve `e2e/server.cjs:12-15`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** 4 ayrı `package-lock.json` ile bağımsız kurulum yapılmaktadır. `e2e/server.cjs:12-15` dosyası bağımlılıkları çözümleyebilmek için `require('../backend/node_modules/express')`, `mongoose`, `bcryptjs`, `mongodb-memory-server` yollarına doğrudan müdahale etmektedir. Ayrıca `npm audit` ve CI önbelleklemesi 4 paket arasında bölünmektedir.
- **Kök Neden:** Bağımsız alt paketlerin monorepo kökünden `workspaces` ile yönetilmemesi.
- **Adım Adım Çözüm:**
  1. Kök `package.json` içine `"workspaces": ["backend", "frontend", "frontend/hackaton"]` ekleyin (`Dockerfile` `COPY */package-lock.json` katmanlarını ve `check.yml` `npm ci` adımlarını aynı PR'da güncelleyin).
  2. `e2e/server.cjs` içindeki kırılgan `../backend/node_modules/...` yollarını doğrudan paket adlarıyla değiştirin.

---

#### DEF-05: Ön Yüzler Arasında React Sürüm Uyumsuzluğu (Panel React 19 vs Hackaton React 18)
- **Dosya / Kod Konumu:** `frontend/package.json:15-16` (`"react": "^19.2.8"`) vs `frontend/hackaton/package.json:20-21` (`"react": "^18.3.1"`)
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** İki frontend uygulaması aynı `shared/` veya ortak UI/hook katmanını paylaşmak istediğinde veya `workspaces` ile hoist edildiğinde farklı React major sürümleri `Invalid hook call` / çift React kopyası riski doğurur.
- **Kök Neden:** İki uygulamanın farklı tarihlerde farklı şablonlarla kurulması.
- **Adım Adım Çözüm:**
  1. `frontend/hackaton/package.json` bağımlılıklarını React 19 ile eşitleyin (`react`, `react-dom` `^19.2.8` ve `@vitejs/plugin-react` uyumu).
  2. `npm.cmd test --prefix frontend/hackaton` (221 + 4 test) ve `npm.cmd run test:e2e` ile tüm vitrin testlerini doğrulayın.

---

#### DEF-06: Core Team Panelinde İlkel Hash Tabanlı Yönlendirme (`window.location.hash`)
- **Dosya / Kod Konumu:** `frontend/src/App.jsx:9-37`, `frontend/src/components/layout/PanelLayout.jsx`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Panel `#/login`, `#/register`, `#/applications`, `#/users` rotalarını `window.location.hash` ile elle yönetmektedir; `/users` yalnız `ADMIN` rolüne açık (`App.jsx:31`, `userRoutes.js:7`), `MEMBER` rolü ise salt bilgilendirme kartı görmektedir (`App.jsx:55-57`). Tarayıcı geçmişi, derin URL parametreleri (`/applications?status=APPROVED`) ve Faz 2 alt rotaları (`Content`, `Forms`) kırılgan kalmaktadır.
- **Kök Neden:** İlk fazda router kütüphanesi eklenmeden tek dosya durum anahtarlaması yapılması.
- **Adım Adım Çözüm:**
  1. `npm.cmd install react-router-dom --prefix frontend` kurun (Hackaton tarafında zaten `7.18.4` mevcuttur).
  2. `App.jsx` içinde `ADMIN`/`ORGANIZER`/`MEMBER` yetki sınırlarını birebir koruyarak rota ağacını kurun (`/users` **yalnız `ADMIN`**):
     ```jsx
     <Route path="/login" element={<Login />} />
     <Route path="/register" element={<Register />} />
     <Route path="/forgot-password" element={<ForgotPassword />} />
     <Route path="/applications" element={
       <ProtectedRoute allowedRoles={['ORGANIZER', 'ADMIN']}><Applications /></ProtectedRoute>
     } />
     <Route path="/users" element={
       <ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>
     } />
     ```
  3. Nginx `nginx/nginx.conf:129-133` zaten panel için SPA fallback (`try_files $uri $uri/ /index.html;`) içerdiğinden `BrowserRouter` üretimde güvenle çalışır; `App.test.jsx` ve `e2e/flows.spec.cjs:46` (`/#/register`) testlerini yeni rotalara güncelleyin.

---

#### DEF-14: Etkinlik Vitrininde Reaktif Olmayan Modül Değişkeni (`let event = base`)
- **Dosya / Kod Konumu:** `frontend/hackaton/src/data/event.js:9-16`, `frontend/hackaton/src/main.jsx:11-41`, `Footer.jsx:1`, `Register.jsx:4`, `Home.jsx`, `Schedule.jsx`, `Team.jsx`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Kritik Mimari Sorun)**
- **Sorun Tanımı ve Etkisi:** Etkinlik verisi ES modülü düzeyinde mutable bir `let event = base` değişkeninde tutulmaktadır. JavaScript modül değişkenini yeniden atamak React'ı tetiklemez; `/admin` sayfasında `Yayınla` tıklandığında `<App />` içinde başka sayfalara geçilse bile kullanıcı sayfayı F5 ile yenilemeden güncel içeriği veya güncellenmiş başvuru form adımlarını göremez.
- **Kök Neden:** Başlangıçtaki statik JSON import yapısının React Context yerine modül seviyesi mutasyonla yamalanması.
- **Adım Adım Çözüm:**
  1. `frontend/hackaton/src/context/EventContext.jsx` oluşturun (`event`, `formSlug`, `loading`, `error`, `refreshEvent` state'leri ve `useEvent()` kancası).
  2. `main.jsx` içinde `<App />` bileşenini `<EventProvider>` ile sarmalayın (ilk açılışta `base` fallback korunarak SPOF yaratılmaz).
  3. Sayfalarda `({ data })` opsiyonel prop uyumluluğunu testler için koruyup `const { event, formSlug } = useEvent()` kullanın (`const view = data ?? event`); `Admin.jsx` içinde `publishEventPage` başarı sonrası `refreshEvent()` çağırın.

---

### KATEGORİ 2: Arayüz, Deneyim, Hukuki Uyumluluk ve Statik Varlıklar

#### DEF-07: Hackathon Vitrininde Eksik `favicon.svg` ve Kırık OpenGraph Görseli (`og-image.png`)
- **Dosya / Kod Konumu:** `frontend/hackaton/index.html:7,13,17` ve `frontend/hackaton/public/`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High)**
- **Sorun Tanımı ve Etkisi:** `index.html` `/favicon.svg` ve `/og-image.png` yollarını referans vermesine rağmen `frontend/hackaton/public/` içinde yalnızca `_redirects` ve `fonts/` vardır. Her sayfa yüklemesinde 404 oluşur; WhatsApp, LinkedIn, Telegram ve X paylaşımlarında önizleme görseli görünmez.
- **Kök Neden:** Tasarım varlıklarının `frontend/hackaton/public/` altına yerleştirilmemesi.
- **Adım Adım Çözüm:**
  1. `frontend/public/favicon.svg` dosyasını `frontend/hackaton/public/favicon.svg` konumuna kopyalayın (veya güncel etkinlik ikonunu üretin).
  2. `1200x630` PNG formatında `frontend/hackaton/public/og-image.png` görselini ekleyin.
  3. Sosyal medya tarayıcıları (özellikle WhatsApp/Twitter/LinkedIn) göreli `/og-image.png` yolunu her zaman çözemeyebileceği için `frontend/hackaton/index.html` içine mutlak URL'yi (`https://gdgocpamukkale.com/og-image.png`) ve boyut etiketlerini (`og:image:width`, `og:image:height`, `og:url`) yerleştirin.

---

#### DEF-08: Devasa ve Optimize Edilmemiş Ham TTF Font Yükü (~4,31 MB + ~6,48 MB)
- **Dosya / Kod Konumu:**
  - `frontend/hackaton/public/fonts/` (4 dosya, **4.307.692 bayt / ~4,31 MB**): `GoogleSans-Regular.ttf` (2,12 MB), `GoogleSans-Bold.ttf` (2,15 MB), `GoogleSansMono-Regular.ttf` (20 KB), `GoogleSansMono-Bold.ttf` (20 KB) + `frontend/hackaton/src/styles/fonts.css:2-24`.
  - `frontend/public/fonts/` (5 dosya, **6.476.304 bayt / ~6,48 MB**): `GoogleSans-Regular.ttf` (2,12 MB), `GoogleSans-Medium.ttf` (2,17 MB), `GoogleSans-Bold.ttf` (2,15 MB), `GoogleSansMono-Regular.ttf` (20 KB), `GoogleSansMono-Medium.ttf` (20 KB) + `frontend/src/styles/theme.css:6-41`.
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Core Web Vitals & Mobil LCP)**
- **Sorun Tanımı ve Etkisi:** İki uygulama da sıkıştırmasız ham TrueType (`.ttf`) fontları tüm Unicode glifleriyle sunmaktadır; mobil bağlantıda sayfa ilk açılışında metin gecikir (FOIT/FOUT) ve bant genişliği israf edilir.
- **Kök Neden:** Tasarım fontlarının `.woff2` alt kümesine dönüştürülmeden doğrudan `public/fonts/` içine konması.
- **Adım Adım Çözüm:**
  1. Python `fonttools` + `brotli` ile tüm kullanılan stilleri (`Regular`, `Medium`, `Bold`, `Mono-Regular`, `Mono-Medium`, `Mono-Bold`) yalnızca Latin + Türkçe glif kümesine (`U+0000-00FF,U+011E-011F,U+0130-0131,U+015E-015F,U+2013-2014,U+2018-201D,U+2026,U+20AC`) indirgeyin:
     ```bash
     pyftsubset GoogleSans-Regular.ttf --output-file=GoogleSans-Regular.woff2 --flavor=woff2 --unicodes="U+0000-00FF,U+011E-011F,U+0130-0131,U+015E-015F,U+2013-2014,U+2018-201D,U+2026,U+20AC"
     ```
  2. Hem `frontend/hackaton/src/styles/fonts.css` hem `frontend/src/styles/theme.css` içindeki `@font-face` kurallarını `.woff2` (`format('woff2')`, `font-display: swap`) olarak güncelleyin ve ~4,31 MB / ~6,48 MB `.ttf` dosyalarını silin (toplam ağırlık ~%95+ azalır).
  3. `index.html` başlığına `<link rel="preload" href="/fonts/GoogleSans-Regular.woff2" as="font" type="font/woff2" crossorigin />` ekleyin.

---

#### DEF-09: A11y & Görsel Yükleme: `PersonCard.jsx` Boş `alt=""` ve Tembel Yükleme Eksikliği
- **Dosya / Kod Konumu:** `frontend/hackaton/src/components/PersonCard.jsx:19`, `frontend/hackaton/src/components/SponsorGrid.jsx:5`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** `PersonCard.jsx:19` içinde `<img src={person.photo} alt="" />` kullanıldığı için fotoğrafı yüklenen jüri üyesi ve mentor görselleri ekran okuyucularda yok sayılır. Ayrıca hem `PersonCard.jsx:19` hem `SponsorGrid.jsx:5` üzerinde `loading="lazy"` ve `decoding="async"` eksiktir; fotoğraf/logo eklendikçe sayfa aşağısı görselleri açılışı gereksiz bloklar.
- **Kök Neden:** Başlangıçta avatarların dekoratif düşünülmesi ve performans niteliklerinin eklenmemesi.
- **Adım Adım Çözüm:**
  1. `PersonCard.jsx:19` içine açıklayıcı `alt` ve lazy yükleme ekleyin (`initials(person.name)` fallback korunur):
     ```jsx
     <img
       src={person.photo}
       alt={`${person.name}${person.title ? ` — ${person.title}` : ''}`}
       loading="lazy"
       decoding="async"
     />
     ```
  2. `SponsorGrid.jsx:5` içine `loading="lazy" decoding="async"` ekleyin.

---

#### DEF-10: Etkinlik Vitrinindeki Yer Tutucu İçerikler ve Kök Sosyal Medya Bağlantıları
- **Dosya / Kod Konumu:** `shared/hackathon-event.json:7,34-53,104-154,444-457` ve `frontend/hackaton/src/components/Footer.jsx:9-17`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / İçerik & Marka Bütünlüğü)**
- **Sorun Tanımı ve Etkisi:** Canlıya çıkışa aday varsayılan etkinlik verisinde şu yer tutucular bulunmaktadır:
  - `location` (satır 7): `"Konum yakında açıklanacak"`
  - `prizes` (satır 34–53): `"Ödül detayları yakında açıklanacak."`
  - `people.jury` & `people.mentors` (satır 104–133): `"Jüri Üyesi Bir"`, `"Mentor Bir"`, `"Unvan yakında"`, `photo: null`
  - `sponsors` (satır 135–154): `"Ana Sponsor"`, `"Destek Sponsor 1/2"`, `logo: null, url: null`
  - `socials` (satır 444–457): `"https://www.instagram.com/"`, `"https://www.linkedin.com/"`, `"https://x.com/"` (kök platform anasayfaları!)
- **Kök Neden:** Tasarım aşamasındaki geçici metinlerin henüz kulübün gerçek etkinlik/sponsor/sosyal hesaplarıyla doldurulmamış olması.
- **Adım Adım Çözüm:**
  1. Dikkat: `Footer.jsx:13`, `Admin.jsx:77` ve `shared/eventContent.mjs` şeması sosyal nesnelerde **`label`** ve **`url`** anahtarlarını zorunlu tutar (yanlış anahtar kullanılırsa `isEventShape` reddeder; aşağıdaki URL'leri kulübün gerçek resmi hesap adresleriyle değiştirin):
     ```json
     "socials": [
       { "label": "Instagram", "url": "https://www.instagram.com/<kulup-hesabi>/" },
       { "label": "LinkedIn", "url": "https://www.linkedin.com/company/<kulup-sayfasi>/" },
       { "label": "X", "url": "https://x.com/<kulup-hesabi>" }
     ]
     ```
  2. Gerçek etkinlik tarihi/saati, kampüs mekanı, gerçek ödüller, onaylı jüri/mentor listesi (en az 1–3 gerçek kayıt), sponsor logoları ve gerçek sosyal hesaplar `/admin` panelinden yayınlanmalı (`PUT /api/v1/event-page/hackathon`) **ve** yedek geri dönüşte sahte metin görünmemesi için `shared/hackathon-event.json` ile senkronlanmalıdır (`frontend/src` ve testlerin beklediği temel şema alanları bozulmadan).

---

#### DEF-11: Başvuru Formunda Tıklanabilir KVKK Aydınlatma Bağlantısı / Modalının Olmaması
- **Dosya / Kod Konumu:** `shared/hackathon-event.json:432`, `frontend/hackaton/src/components/StepForm.jsx:154,177`, `frontend/hackaton/src/components/Field.jsx:8-12`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / 6698 Sayılı KVKK Uyumluluğu)**
- **Sorun Tanımı ve Etkisi:** `kvkkConsent` alanı `kind: "checkbox"` türündedir. Ancak **`StepForm.jsx:154` (checkbox) ve `StepForm.jsx:177` (radio), `<Field>` bileşenini kullanmadan doğrudan `<p className="field__hint">{f.hint}</p>` render etmektedir!** İpucu metninde `"Detaylı metin için tıklayınız."` yazsa da hiçbir tıklanabilir link veya modal açılmaz. Sunucu `IP`, `User-Agent`, iletişim ve dosya verisi topladığı için aydınlatma metni sunulmadan alınan rıza hukuken eksik kalır.
- **Kök Neden:** Checkbox/radio hint alanının düz metin olarak basılması ve gerçek KVKK URL/metninin şablonda bulunmaması.
- **Adım Adım Çözüm:**
  1. `javascript:` şemasını engelleyen güvenli markdown link ayrıştırıcı bir `HintText` bileşeni yazıp **hem `StepForm.jsx:154,177` hem de `Field.jsx:8-12` içinde kullanın**:
     ```jsx
     function renderHintText(hint) {
       if (!hint) return null
       const match = hint.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/)
       if (!match) return hint
       const [full, label, href] = match
       const idx = hint.indexOf(full)
       return (
         <>
           {hint.slice(0, idx)}
           <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
           {hint.slice(idx + full.length)}
         </>
       )
     }
     ```
  2. Alternatif veya ek olarak sitede `/kvkk` aydınlatma metni sayfası ya da modalı oluşturup `shared/hackathon-event.json:432` içindeki `hint` alanını `"Kişisel verilerinizin işlenmesine ilişkin [KVKK Aydınlatma Metni](/kvkk) sayfasını inceleyiniz."` (veya resmi PAU KVKK URL'i) ile güncelleyin.

---

#### DEF-12: Core Team Panelinde `robots` Meta Etiketi Eksikliği
- **Dosya / Kod Konumu:** `frontend/index.html:1-13` (karşılaştırma: `Admin.jsx:402-405` dinamik `noindex` ekliyor ancak Core Team paneli `index.html` içinde hiç yok)
- **Öncelik / Ciddiyet:** **P2 — Düşük (Low / SEO & Güvenlik Hijyeni)**
- **Sorun Tanımı ve Etkisi:** `panel.gdgocpamukkale.com` yayına çıktığında arama motoru tarayıcıları iç yönetim panelini dizine ekleyebilir.
- **Kök Neden:** `frontend/index.html` oluşturulurken meta etiketin eklenmemesi.
- **Adım Adım Çözüm:**
  1. `frontend/index.html` `<head>` içine `<meta name="robots" content="noindex, nofollow" />` ekleyin.
  2. Ek katman olarak `nginx/nginx.conf` içindeki Core Team paneli server bloğuna `add_header X-Robots-Tag "noindex, nofollow" always;` ekleyin.

---

#### DEF-13: Ön Yüz ve Hata Mesajlarında Türkçe / İngilizce Dil Tutarsızlıkları
- **Dosya / Kod Konumu:** `frontend/src/pages/Users.jsx:59-64,94-96`, `backend/src/middleware/roleMiddleware.js:24`, `backend/src/controllers/authController.js:248` *(Not: `ParticipantVerification.jsx:78` içindeki `text: 'continue_with'` Google GIS SDK'sının zorunlu enum parametresidir, kullanıcıya gösterilen İngilizce metin hatası değildir.)*
- **Öncelik / Ciddiyet:** **P2 — Düşük (Low / UX Tutarlılığı)**
- **Sorun Tanımı ve Etkisi:** `Users.jsx` filtre ve rol seçicisi ham DB enum değerlerini (`PENDING`, `MEMBER`, `ORGANIZER`, `ADMIN`) son kullanıcıya doğrudan basmaktadır. Backend tarafında ise `roleMiddleware.js:24` `'Account awaiting admin approval (Hesabınız yönetici onayını bekliyor).'` mesajını döndürürken, `authController.js:248` `'Account awaiting admin approval (Hesabınız yönetici onayını beklemektedir).'` döndürür; hem çift dilli hem de iki dosya arasında tutarsızdır.
- **Kök Neden:** Sabit etiket eşlemesi olmadan ham enumların ve eski İngilizce hata dizgelerinin bırakılması.
- **Adım Adım Çözüm:**
  1. `Users.jsx` içinde Türkçe etiket sözlüğü (`ALL: 'Tümü'`, `PENDING: 'Onay Bekliyor'`, `MEMBER: 'Üye'`, `ORGANIZER: 'Organizatör'`, `ADMIN: 'Yönetici'`) ekleyin ve ilgili UI testlerini güncelleyin.
  2. `roleMiddleware.js:24` ve `authController.js:248` mesajlarını standartlaştırırken `backend/tests/` ve Challenger testlerindeki eski dizgi assertions'larını da eşzamanlı güncelleyin.

---

### KATEGORİ 3: Kod Kalitesi, Şema ve Sürdürülebilirlik

#### DEF-15: Atıl Şema Kalıntıları ve Legacy vs Dinamik Akış Ayrımı
- **Dosya / Kod Konumu:** `backend/src/models/Team.js:1-4`, `backend/src/models/HackathonApp.js:1-2`, `backend/src/models/User.js:8,55-60`, `backend/src/models/VerificationToken.js:39-40`, `backend/src/modules/hackathon/`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** `cb8880b` ile `Team.js`, `User.permissions` ve `VerificationToken` `LOGIN_2FA` üzerine `@deprecated` notları eklenmiştir; `backend/src/models/HackathonApp.js` ise `modules/hackathon/models/HackathonApp` için 2 satırlık bir shim re-export'udur. Ancak sistemde hâlâ iki paralel hackathon veri havuzu (`FormResponse` vs legacy `HackathonApp`) ve kullanılmayan şema alanları yaşamaktadır (`API.md:688`).
- **Kök Neden:** Faz 1 takım başvuru modelinden dinamik Form/FormResponse mimarisine geçilirken geriye dönük uyumluluk için eski kalıntıların korunması.
- **Adım Adım Çözüm:**
  1. İlk etkinlik sonrası Faz 2 bakım penceresinde eski `HackathonApp` başvuruları yoksa `ENABLE_HACKATHON_MODULE=false` yapılıp arşivlenebilir; `Team` koleksiyonu ve `User.permissions` alanı migration ile temizlenebilir.
  2. Kod temizliği yapılırsa bağlı eski model referans testleri ve `m4-challenge` / `API.md` dokümantasyonu eşzamanlı sadeleştirilmelidir.

---

#### DEF-16: Proje Genelinde Statik Tip Kontrolünün (`TypeScript` / `jsconfig checkJs`) Bulunmaması
- **Dosya / Kod Konumu:** Tüm `backend/src/**/*.js`, `frontend/src/**/*.jsx`, `frontend/hackaton/src/**/*.jsx`, `shared/eventContent.mjs`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Dinamik `fields[]`, `FormResponse.answers[]`, `eventContent` şeması ve API yanıt sözleşmeleri IDE/build zamanında statik tip denetiminden geçmemektedir.
- **Kök Neden:** Projenin saf JavaScript olarak geliştirilmiş olması.
- **Adım Adım Çözüm:**
  1. Her alt paket için ortamına uygun `jsconfig.json` tanımlayın (**frontend Vite ESM** için `module: "ESNext"` + `moduleResolution: "bundler"`, **backend CommonJS** için `module: "CommonJS"` — yanlış `NodeNext` tanımı `.jsx` Vite importlarını bozar!):
     ```json
     {
       "compilerOptions": {
         "checkJs": true,
         "jsx": "react-jsx",
         "target": "ES2022",
         "module": "ESNext",
         "moduleResolution": "bundler"
       },
       "include": ["src", "../../shared"]
     }
     ```
  2. `Form`, `FormResponse`, `EventContent`, `User` nesneleri için ortak `@typedef` JSDoc tanımları ekleyin ve `tsc --noEmit -p <altpaket>/jsconfig.json` kontrolünü ekleyin.

---

### KATEGORİ 4: Ortam Değişkenleri, Geliştirici Deneyimi ve Dağıtım Altyapısı (Docker / Nginx)

#### DEF-17: Ortam Değişkeni Şablonlarının Parçalı Olması
> **Kısmen çözüldü:** Backend şablonunun kopyası olan kök `.env.example` kaldırıldı; `.env.docker.example` kök `.env.example` olarak yeniden adlandırıldı ve yalnızca Compose değişkenlerini (dev + prod portları, `CLIENT_URLS`, `TRUST_PROXY_HOPS`) içeriyor. Backend ayarlarının tek şablonu `backend/.env.example`. `VITE_GOOGLE_CLIENT_ID` build-arg eksikliği DEF-26 kapsamında açık.

- **Dosya / Kod Konumu:** `.env.example:1-78`, `.env.docker.example:1-11`, `backend/.env.example:1-92`, `frontend/.env.example:1-3`, `frontend/hackaton/.env.example:1-3`, `compose.prod.yaml:22,47-70`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / DevOps & Dağıtım Riski)**
- **Sorun Tanımı ve Etkisi:** Kök `.env.example` artık `BREVO_APPLICATION_SENDER_*` değişkenlerini (satır 60–63) içerse de, geliştirme Docker Compose'un kullandığı port/origin değişkenleri `.env.docker.example` (`API_PORT`, `PANEL_PORT`, `HACKATON_PORT`, `MONGO_PORT`, `PUBLIC_API_URL`, `UPLOADS_PATH`) içine dağılmıştır; `compose.prod.yaml` ise ek olarak `WEB_PORT`, `PANEL_PORT` (8080 vs 5174 çakışabilir!) ve ön yüz Google butonu için gerekli `VITE_GOOGLE_CLIENT_ID` build-arg değişkenini kullanır/bekler. Tek kaynak rehber olmadığı için `.env` ve `backend/.env` karıştırılmakta veya `frontend/hackaton/.env` atlanmaktadır.
- **Kök Neden:** Geliştirme Docker Compose, üretim Docker Compose ve yerel Node çalışma modlarının zaman içinde farklı `.env.example` dosyalarına bölünmesi.
- **Adım Adım Çözüm:**
  1. `.env.docker.example` dosyasına `WEB_PORT`, `PANEL_PORT` (`80` / `8080` prod vs `5173` / `5174` dev ayrım notu) ve `VITE_GOOGLE_CLIENT_ID` değişkenlerini net açıklamalarla ekleyin (Dikkat: backend gizli anahtarları `.env.docker.example` içine yazmayın; `backend/.env` içinde kalsın).
  2. Kök `.env.example` üzerindeki `backend/tests/challenger/m5-challenge.test.js:251-262` doğrulamalarını (`replicaSet=rs0`, `CLIENT_URLS`, `Admin123456!` uyarısı, `BREVO_API_KEY`, `GOOGLE_CLIENT_ID`) koruyarak Docker vs Host dosya ayrım tablosunu netleştirin.

---

#### DEF-18: Windows PowerShell `ExecutionPolicy` (`npm.ps1`) Kısıtı & Alt Paket Kılavuzları
- **Dosya / Kod Konumu:** `backend/README.md`, `frontend/README.md`, `frontend/hackaton/README.md` (`README.md:19` ve `KURULUM.md:5-25` 11 Kasım'da güncellendi)
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Kök `README.md` ve `KURULUM.md` Windows PowerShell için `npm.cmd` / `npx.cmd` uyarısını içerse de, geliştiricilerin doğrudan alt uygulama klasörlerine (`backend/`, `frontend/`, `frontend/hackaton/`) girip okuyabileceği alt `README.md` dosyalarında henüz bu yönlendirme bulunmamaktadır.
- **Kök Neden:** Öncelikli güncellemenin kök dokümanlara uygulanıp alt paket README'lerinin sonraya bırakılması.
- **Adım Adım Çözüm:** Alt uygulama README dosyalarına tek paragraflık Windows PowerShell `npm.cmd` / `npx.cmd` notu ekleyin.

---

#### DEF-19: Aşırı Dar Node.js Motor Sürümü Kuralı (`>=24.15.0 <25`)
- **Dosya / Kod Konumu:** `package.json:4-6`, `backend/package.json:36-38`, `frontend/package.json:34-36`, `frontend/hackaton/package.json:6-8`, `.nvmrc` (`24`)
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Kodda kullanılan tüm API'ler (`node:test`, `node:crypto randomInt/createHmac`, native `fetch`, `AbortSignal.timeout`) ve Vite 8 (`^20.19.0 || >=22.12.0`) Node 22 LTS üzerinde de çalışabilirken katı `>=24.15.0 <25` kuralı, Node 22 LTS veya daha eski Node 24 minor kurulu ortamlarda `EBADENGINE` uyarısı/reddi üretebilir.
- **Kök Neden:** Yerel geliştirme ortamındaki kesin Node 24 minor sürümünün `engines` alanına kilitlenmesi.
- **Adım Adım Çözüm:**
  - *Seçenek A:* Node 22 LTS üzerinde tüm 350 testi koşturarak `>=22.12.0 <25` aralığına esnetin.
  - *Seçenek B:* Kurumsal ortam Node 24 standardını koruyacaksa minör alt sınırı en az `>=24.0.0 <25` şeklinde gevşetip `.nvmrc` ve `Dockerfile` (`FROM node:24-bookworm-slim`) ile tutarlı tutun.

---

#### DEF-26: Production `Dockerfile` & `compose.prod.yaml` İçinde `VITE_GOOGLE_CLIENT_ID` Build Argümanı Eksikliği
- **Dosya / Kod Konumu:** `Dockerfile:44-61`, `compose.prod.yaml:63-70`, `frontend/hackaton/src/components/ParticipantVerification.jsx:61,72,90`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Production'da Google ile Doğrulama Çalışmaz)**
- **Sorun Tanımı ve Etkisi:** Vite ortam değişkenlerini (`import.meta.env.VITE_GOOGLE_CLIENT_ID`) **derleme (build) zamanında** JS bundle içine gömer; çalışma zamanında container `environment` okuyamaz. Mevcut `Dockerfile` (`frontend-builder` aşaması satır 44–61) ve `compose.prod.yaml` (`web` servisi satır 63–70) hiçbir `ARG VITE_GOOGLE_CLIENT_ID` (veya `ARG VITE_API_URL`) tanımlamamaktadır! Bu durumda `docker compose -f compose.prod.yaml up -d --build` ile üretilen canlı sitede **`Google ile Devam Et` butonu hiç görünmez**.
- **Kök Neden:** Geliştirme `compose.yaml` dosyasında `frontend/hackaton/.env` Vite dev sunucusu tarafından okunurken üretim multi-stage `Dockerfile`'a build `ARG` eklenmesinin atlanması.
- **Adım Adım Çözüm:**
  1. `Dockerfile` içindeki `frontend-builder` aşamasına `ARG` / `ENV` ekleyin:
     ```dockerfile
     FROM node:24-bookworm-slim AS frontend-builder
     WORKDIR /app
     ARG VITE_API_URL=""
     ARG VITE_GOOGLE_CLIENT_ID=""
     ENV VITE_API_URL=${VITE_API_URL}
     ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
     ```
  2. `compose.prod.yaml` `web` (ve gerekiyorsa `frontend` asset kopyalayan `backend`) build bloğuna `args` ekleyin (`backend/.env` yerine kök `.env` veya `--build-arg` ile geçirilir):
     ```yaml
     web:
       build:
         context: .
         target: reverse-proxy
         args:
           VITE_API_URL: ${VITE_API_URL:-}
           VITE_GOOGLE_CLIENT_ID: ${VITE_GOOGLE_CLIENT_ID:-}
     ```
  3. Üretim derlemesi öncesi `.env` içine `VITE_GOOGLE_CLIENT_ID=<gercek_client_id>` ekleyip `docker compose -f compose.prod.yaml build --no-cache` çalıştırın (`API` ile aynı origin kullanıldığı için `VITE_API_URL` boş bırakılarak göreceli `/api/v1` proxy'si kullanılır).

---

#### DEF-27: `nginx/nginx.conf` İçinde `:443` SSL/TLS ve Domain Yönlendirmesi Eksikliği (Cloudflare `:8080` Engeli)
- **Dosya / Kod Konumu:** `nginx/nginx.conf:6-134`, `compose.prod.yaml:63-70`, `Dockerfile:69`, `backend/tests/challenger/m5-challenge.test.js:230-249`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Production HTTPS & Panel Erişimi Engeli)**
- **Sorun Tanımı ve Etkisi:** Mevcut `nginx/nginx.conf` yalnızca şifresiz HTTP **`listen 80;`** (Hackathon) ve **`listen 8080;`** (`server_name localhost _;`) dinlemektedir. Cloudflare Proxy (Turuncu Bulut) standart HTTPS için `:443` kullanır ve `:8080` portunu HTTPS üzerinden proxy'lemez; ayrıca Google Identity Services (`gsi/client`) ve modern tarayıcı güvenliği canlıda **`https://`** zorunlu kılar.
- **Kök Neden:** Üretim Nginx yapılandırmasının henüz alan adları (`gdgocpamukkale.com` ve `panel.gdgocpamukkale.com`) ve TLS sertifikası bağlanmadan yerel port test şablonuyla yazılmış olması.
- **Adım Adım Çözüm:**
  1. `nginx/nginx.conf` içine Cloudflare Origin Certificate (veya Let's Encrypt) ile `:443 ssl http2` sanal host bloklarını ekleyin:
     - `server_name gdgocpamukkale.com www.gdgocpamukkale.com;` -> `/usr/share/nginx/html/hackaton` + `/api/`, `/uploads/`, `/health`, `/ready` proxy
     - `server_name panel.gdgocpamukkale.com;` -> `/usr/share/nginx/html/panel` + `add_header X-Robots-Tag "noindex, nofollow" always;` + `/api/`, `/uploads/` proxy
     - `:80` üzerinde üretim alan adlarını `301 https://$host$request_uri;` yönlendirin; *veya* mevcut `m5-challenge.test.js:236-237` (`/listen 80;/`, `/listen 8080;/`) testi kırılmayacaksa localhost/internal healthcheck bloklarını ya da testi güncelleyin.
  2. Cloudflare arkasında `Client -> Cloudflare -> Nginx -> Express` iki proxy atlaması oluşacağından:
     - Nginx içine Cloudflare gerçek IP kurallarını (`set_real_ip_from ...; real_ip_header CF-Connecting-IP;`) ekleyip `X-Forwarded-For` zincirini doğru yapılandırın ve `backend` ortamında `TRUST_PROXY_HOPS` değerini topolojiye göre doğrulayın (yalnız Nginx önündeyken `1`, Cloudflare + Nginx `X-Forwarded-For` ekliyorsa `2`). Yanlış değer `express-rate-limit`'in bütün ziyaretçileri aynı Cloudflare IP'si sayıp 429 döndürmesine yol açar!
  3. `compose.prod.yaml` ve `Dockerfile` içine `443:443` portunu ve `./nginx/certs:/etc/nginx/certs:ro` volume mount'unu ekleyin.

---

#### DEF-28: Canlıya Çıkış Harici Ön Koşullarının Tamamlanmamış Olması (DNS / Brevo / Google / Yedek)
- **Dosya / Kod Konumu:** Dış servis yönetimleri & sunucu `.env` / `backend/.env` yapılandırmaları (bkz. `docs/CANLIYA_CIKIS_KONTROL_LISTESI.md` Bölüm 3)
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Go-Live Operasyon Engeli)**
- **Sorun Tanımı ve Etkisi:** Kod ve testler hazır olsa da harici canlı servisler bağlanmadan platform gerçek trafik alamaz:
  1. **Cloudflare DNS (`gdgocpamukkale.com`):** Alan adı henüz Cloudflare'e transfer edilmemiş veya sunucu A kayıtları (`@`, `panel`, `www`) + SSL **Full (strict)** etkinleştirilmemiştir.
  2. **Brevo E-posta & DMARC:** `gdgocpau@gmail.com` adresi Gmail DMARC kısıtı nedeniyle `From` (`BREVO_SENDER_EMAIL`) olarak kullanılmamalıdır; aksine gönderiler spam/ret yer. Alan adı Brevo üzerinde **SPF + DKIM** ile doğrulanmalı (`noreply@gdgocpamukkale.com` sender, `gdgocpau@gmail.com` `BREVO_REPLY_TO` / `BREVO_APPLICATION_REPLY_TO`), API Key izni yalnızca **`Transactional email: All`** (diğer 17 izin **`None`**) olarak oluşturulmalıdır. `NODE_ENV=production` iken geçersiz/eksik anahtar `503`/`502` döndürür ve başvuru onay/red işlemlerinde DB değişikliğini rollback eder.
  3. **Google Cloud OAuth:** OAuth uygulamasının *Publish App* (Üretim) durumuna alınması, *Authorized JavaScript Origins* listesine `https://gdgocpamukkale.com`, `https://panel.gdgocpamukkale.com` (gerekirse `www`) ve test için `http://localhost:5173` eklenmesi; **Authorized Redirect URIs alanının tamamen boş bırakılması**; `GOOGLE_CLIENT_ID` = `VITE_GOOGLE_CLIENT_ID` eşleşmesi gereklidir.
  4. **Üretim Ortam Sırları:** `backend/.env` içinde güçlü ve benzersiz (32+ karakter) `JWT_SECRET` + `PARTICIPANT_JWT_SECRET`, `CLIENT_URLS=https://gdgocpamukkale.com,https://panel.gdgocpamukkale.com`, 12+ karakter karmaşık `DEFAULT_ADMIN_PASSWORD`, `NODE_ENV=production` ayarlanıp `docker compose -f compose.prod.yaml exec backend npm run seed` çalıştırılmalıdır.
  5. **Yedekleme & MongoDB Kernel Doğrulaması:** Hedef Linux VPS üzerinde MongoDB 8 `rseq` kernel uyumu (`compose.prod.yaml:19`) test edilmeli; `mongodump` + `backend/uploads/` senkron yedekleme ve ayrı replica set'e `mongorestore` tatbikatı yapılmalıdır.
- **Kök Neden:** Üretim sunucusu, DNS ve üçüncü taraf hesap yetkilerinin canlıya alma anında tamamlanmayı beklemesi.
- **Adım Adım Çözüm:** Yukarıdaki 5 adımı `docs/CANLIYA_CIKIS_KONTROL_LISTESI.md` sırasıyla tamamlayın; doğrulamadan `main` dalını canlıya almayın.

---

### KATEGORİ 5: Performans, Paketleme ve Ürün Tamlığı

#### DEF-20: Ön Yüz Paketlerinde Kod Bölümleme (`React.lazy` & Vite `manualChunks`) Eksikliği
- **Dosya / Kod Konumu:** `frontend/vite.config.js`, `frontend/hackaton/vite.config.js`, `frontend/hackaton/src/App.jsx`, `frontend/src/App.jsx`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Mevcut üretim build'lerinde tüm rotalar (public ziyaretçilerin hiç girmediği `/admin` dahil) tek bir JS dosyasında paketlenmektedir (`frontend/dist/assets/index-CLd_uMXV.js` = **247.605 bayt / ~248 KB**, `frontend/hackaton/dist/assets/index-WhWcECSJ.js` = **230.441 bayt / ~230 KB**).
- **Kök Neden:** Senkron statik sayfa importları ve `rollupOptions.output.manualChunks` tanımının yapılmaması.
- **Adım Adım Çözüm:**
  1. `frontend/hackaton/src/App.jsx` içinde `Admin`, `Register`, `Schedule`, `Team`, `NotFound` bileşenlerini `lazy(() => import(...))` + `<Suspense fallback={...}>` yapısına geçirin (giriş açılışı için `Home` doğrudan tutulabilir).
  2. Her iki `vite.config.js` dosyasına `manualChunks: { vendor: ['react', 'react-dom'] }` ekleyin (gerekirse Router ayrı chunk).

---

#### DEF-29: Ürün & UX Eksiklikleri (Panel Şifre Sıfırlama UI, Faz 2 CMS Ekranları & `/admin` Cila)
- **Dosya / Kod Konumu:** `frontend/src/pages/Login.jsx`, `frontend/src/lib/api.js`, `frontend/src/App.jsx`, `frontend/src/pages/Users.jsx`, `frontend/hackaton/src/pages/Admin.jsx:112,260-303`, `frontend/hackaton/src/lib/eventApi.js:15-16`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Backend API'de tam çalışan bazı kabiliyetlerin henüz kullanıcı arayüzü veya otomasyonu yoktur:
  1. **Şifre Sıfırlama Arayüzü Eksik:** Backend'de `POST /api/v1/auth/forgot-password` ve `/reset-password` mevcut olup testli olmasına rağmen [`frontend/src/pages/Login.jsx`](../frontend/src/pages/Login.jsx) ve [`frontend/src/lib/api.js`](../frontend/src/lib/api.js) içinde **"Şifremi Unuttum"** akışı yoktur. Ekip üyesi şifresini unutursa API'ye manuel istek atmak zorunda kalır.
  2. **Faz 2 `Content` ve Çoklu `Form` Panel Ekranları Eksik:** Backend `/content` ve `/forms` CRUD uç noktaları hazır ancak Core Team paneli (`frontend/`) yalnızca `event-page/hackathon` başvurularını ve kullanıcı onaylarını (`Users.jsx`) yönetmektedir; `Users.jsx` ayrıca backend'deki sabit `limit=50` değerini UI'dan özelleştirmez.
  3. **Etkinlik Sitesi Tek Slug (`hackathon`) Bağlı & `/admin` Cila Kalemleri:**
     - `eventApi.js:15-16` yalnızca `/event-page/hackathon` (`hackathon-katilim`) yolunu kullanır.
     - `Admin.jsx:290-303` `409 Conflict` aldığında güncel `revision` verisini otomatik çekip fark uyarısı göstermez; kullanıcı sayfayı yenilemek zorunda kalır.
     - Hem `Admin.jsx:390-397` hem Core Team `App.jsx:21` açılışta depolanan token'ı `GET /api/v1/auth/me` ile doğrulamaz (süresi dolmuş/rolü değişmiş oturum ancak yazma/listeleme anında `401` ile düşer).
     - `Admin.jsx` üzerinden `Form` kotası (`maxSubmissions`), tarih aralığı (`startDate`/`endDate`), `allowMultipleSubmissions` ve `verificationMethods` düzenlenemez; sponsor/jüri görselleri doğrudan dosya yüklenemez (yalnız URL girilir); `Admin.jsx:112` hâlâ eski sabit adı (`UNLOCK_KEY = 'hackathon-admin-unlocked'`) taşır.
- **Kök Neden:** Hackathon MVP teslimine odaklanılırken Faz 2 ve yardımcı editör ekranlarının sonraya bırakılması.
- **Adım Adım Çözüm:** Önce Core Team `Login.jsx` içine "Şifremi Unuttum" (`forgot-password`/`reset-password`) akışını ve `App.jsx` / `Admin.jsx` açılışına `/auth/me` oturum doğrulamasını ekleyin; ardından `409 Conflict` otomatik revizyon yenileme ve Faz 2'de `Content` / Çoklu `Form` yönetim sayfalarını planlayın.

---

### KATEGORİ 6: Test Kapsamı, CI/CD ve Dal Hijyeni

#### DEF-21: Challenger Güvenlik Testlerinin Varsayılan `npm test` Dışında Kalması
- **Dosya / Kod Konumu:** `backend/package.json:10` ve `frontend/vitest.config.js:5`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Kalite Güvencesi)**
- **Sorun Tanımı ve Etkisi:**
  - `backend/package.json:10` yalnız `tests/*.test.js` desenini çalıştırdığı için `backend/tests/challenger/{m1,m2,m5}-challenge.test.js` içindeki **26 stres/güvenlik testi** `npm run check` sırasında atlanır.
  - `frontend/vitest.config.js:5` yalnız `include: ['src/**/*.test.{js,jsx}']` içerdiği için `frontend/tests/challenger/m4-challenge.test.jsx` içindeki **12 Challenger testi** `npm run check` sırasında atlanır.
  - Toplam **38 adet** kritik sınır ve güvenlik testi yalnızca manuel çalıştırılmaktadır.
- **Kök Neden:** Deneysel doğrulama paketi olarak ayrı klasörlere yazılan testlerin kök paket betiklerine bağlanmamış olması.
- **Adım Adım Çözüm:**
  1. `backend/package.json:10` içindeki `test` betiğini `node --test --test-concurrency=1 tests/*.test.js tests/challenger/*.test.js` (veya ayrı `"test:challenger"` betiği ekleyip kök `check`'e bağlayarak) genişletin.
  2. `frontend/vitest.config.js:5` içine `'tests/challenger/**/*.test.{js,jsx}'` kalıbını (veya `test:challenger` scriptini) ekleyin.

---

#### DEF-22: GitHub Actions CI İş Akışının Tek Seri İş Olması, Cache Eksikliği ve Apt DNS Kırılganlığı
- **Dosya / Kod Konumu:** `.github/workflows/check.yml:1-20`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** Mevcut CI tek bir `check` job'ı içinde `npm run setup`, `npm run check`, `npx playwright install --with-deps chromium`, `npm run test:e2e` adımlarını sırayla çalıştırmaktadır. Yeşil bir koşum ~1m40s sürmektedir; ancak **`d53b4e2` sonrası Ubuntu runner apt depolarında yaşanan geçici DNS kesintisi (`Temporary failure resolving 'azure.archive.ubuntu.com'`)** nedeniyle **`npm run check` geçmesine rağmen** iş akışı ~11 dakikada Playwright adımında fail vermiştir. Playwright tarayıcıları önbelleğe alınmadığından her koşuda baştan indirilmektedir.
- **Kök Neden:** Bağımsız iş bölümü, Playwright tarayıcı cache'i ve apt geçici ağ hatalarına karşı yeniden deneme (retry) olmaması.
- **Adım Adım Çözüm:**
  `.github/workflows/check.yml` dosyasını `.nvmrc` (**Node 24**) ile uyumlu kalarak paralel `lint-and-unit` ve `e2e` job'larına bölün, `actions/cache@v4` ekleyin ve `apt`/Playwright kurulumuna retry sarın:
  ```yaml
  jobs:
    check:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: npm
            cache-dependency-path: |
              package-lock.json
              backend/package-lock.json
              frontend/package-lock.json
              frontend/hackaton/package-lock.json
        - run: npm run setup
        - run: npm run check

    e2e:
      runs-on: ubuntu-latest
      needs: check
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: npm
            cache-dependency-path: |
              package-lock.json
              backend/package-lock.json
              frontend/package-lock.json
              frontend/hackaton/package-lock.json
        - run: npm ci && npm ci --prefix backend && npm ci --prefix frontend && npm ci --prefix frontend/hackaton
        - uses: actions/cache@v4
          with:
            path: ~/.cache/ms-playwright
            key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
        - name: Install Playwright with retry
          run: |
            for i in 1 2 3; do
              npx playwright install --with-deps chromium && break
              sleep 10
            done
        - run: npm run test:e2e
  ```

---

#### DEF-30: E2E Negatif/Geri Alma Senaryoları Eksikliği ve Git Dal / PR Hijyeni
- **Dosya / Kod Konumu:** `e2e/flows.spec.cjs:1-94`, Git `main` (`d218156`), GitHub `PR #7`
- **Öncelik / Ciddiyet:** **P2 — Düşük (Low)**
- **Sorun Tanımı ve Etkisi:**
  1. `e2e/flows.spec.cjs` artık `Onayla` ve `CSV` indir akışını (satır 33–43) doğrulasa da; **başvuru reddetme (`Reddet` + red notu)**, **`Beklemeye al` ile `PENDING`'e geri döndürme**, **`forgot-password`/`reset-password`** akışı ve **dosya (`<input type="file">`) yükleme** senaryolarını tarayıcı E2E seviyesinde henüz kapsamaz.
  2. `main` (`d218156`) canlı ortam P0 varlık/Altyapı hazırlıkları tamamlanana kadar bilinçli olarak geride beklemektedir; ayrıca GitHub üzerindeki eski `PR #7` (`Dev`, 2026-10-21) açık kalmıştır.
- **Kök Neden:** Durum yönetimi onay akışının yeni eklenmesi ve canlıya geçiş öncesi kontrollü branch disiplini.
- **Adım Adım Çözüm:** `e2e/flows.spec.cjs` içine `Reddet -> Beklemeye al` ve dosya ekli form yükleme testlerini ekleyin; canlı P0 adımları (`DEF-07/08/10/11/14/23/26/27/28`) tamamlandığında kullanıcı onayıyla `dev -> main` release merge yapıp eski `PR #7`'yi kapatın.

---

### KATEGORİ 7: Güvenlik ve Bağımlılık Açıkları

#### DEF-23: Bağımlılık Güvenlik Açıkları (`npm audit` — Üretim ve Geliştirme Paketleri)
- **Dosya / Kod Konumu:** `backend/package.json`, `frontend/package.json`, `frontend/hackaton/package.json`, kök `package.json`
- **Öncelik / Ciddiyet:** **P0 — Yüksek (High / Üretim Çalışma Zamanı Açıkları)**
- **Sorun Tanımı ve Etkisi:** Doğrudan `npm.cmd audit` çalıştırıldığında elde edilen doğrulanmış açık dağılımı:
  - **`backend/` (Üretim `--omit=dev`: 5 açık — 3 high, 2 moderate; toplam dev dahil: 8 açık — 4 high, 4 moderate):**
    - `mongoose` `9.0.0–9.11.3` (*High*, 4 danışma: GHSA-gg4r-jv3p-qx3c, GHSA-wr5m-5jph-8m96, GHSA-8332-j7wj-wjw4, GHSA-6972-9mcm-vhwj — prototype/discriminator & sanitizeFilter açıkları)
    - `multer` `2.0.0–2.4.0` (*High*, GHSA-q7qp-rjg7-q26m — pending async fileFilter DoS)
    - `body-parser` `2.0.0–2.3.0` (*High*, GHSA-27r3-jxmh-p828 — Express transitif DoS)
    - `ip-address` `<=10.7.3` (*Moderate*, GHSA-rxp7-6hxx-x8q5), `qs` `6.7.0–6.16.0` (*Moderate*, GHSA-6pq8-jhm2-2vcw)
    - Yalnız devDependencies: `follow-redirects` (*High*, via `mongodb-memory-server`), `minimatch` (*Moderate*, via `nodemon` — `--force` kırma uyarısı verir!)
  - **`frontend/` (Üretim `--omit=dev`: 0 açık; toplam dev: 5 açık):** `zod <4.6.6` (*High*), `minimatch` (*Moderate*, via `eslint` v10).
  - **`frontend/hackaton/` (Üretim `--omit=dev`: 0 açık; toplam dev: 1 açık):** `undici 8.0.0–8.12.1` (*High*, Vite/Vitest dev bağımlılığı).
  - **Kök `package.json`:** `4 moderate` (`minimatch`, via `eslint` v10).
- **Kök Neden:** Kilit (`package-lock.json`) dosyalarındaki yama (patch) güncellemelerinin henüz alınmamış olması.
- **Adım Adım Çözüm:**
  1. **UYARI:** Kırıcı major sıçrama yapabilecek `npm audit fix --force` veya kör `npm install ...@latest` **kullanmayın** (`nodemon` veya `eslint` v9 düşüşü zinciri bozar). Önce yalnızca semver-uyumlu yamaları uygulayın:
     ```powershell
     npm.cmd audit fix --prefix backend
     npm.cmd audit fix --prefix frontend
     npm.cmd audit fix --prefix frontend/hackaton
     npm.cmd audit --omit=dev --prefix backend
     ```
  2. Eğer `mongoose` `9.11.x` / `multer` `2.4.x` / `body-parser` yamalı minor/patch sürümleri aynı major içinde temizlenirse **tüm 350 testi** (`npm.cmd run check`, `test:roadmap`, Challenger, E2E) baştan koşturup regresyon olmadığını doğrulayın. Yalnız devDependencies (`eslint` 10 -> `minimatch`) uyarısı kalırsa `--omit=dev` çıktısını CI kapısı olarak takip edin.

---

#### DEF-24: Canlı Ortamda (`NODE_ENV=production`) `CLIENT_URLS` Tanımsızsa `localhost` Fallback'ine Düşülmesi
- **Dosya / Kod Konumu:** `backend/src/app.js:33-40`
- **Öncelik / Ciddiyet:** **P1 — Orta (Medium)**
- **Sorun Tanımı ve Etkisi:** `app.js:33` üzerinde `process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174'` yazmaktadır. `JWT_SECRET` eksikken sunucu fail-fast hata fırlatmasına karşın, `NODE_ENV === 'production'` iken `CLIENT_URLS` unutulursa API sessizce yalnız `localhost` origin'lerine izin vererek ayağa kalkar ve canlı siteden gelen tüm istekleri `403` ile reddeder.
- **Kök Neden:** CORS origin yapılandırmasında production zorunluluk kontrolünün eksik bırakılması.
- **Adım Adım Çözüm:**
  `backend/src/app.js` satır 35 öncesine (sadece `NODE_ENV === 'production'` iken çalışacak şekilde, E2E ve unit testleri etkilemeden) şu kontrolü ekleyin:
  ```javascript
  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URLS && !process.env.CLIENT_URL) {
    throw new Error('Üretim (production) ortamında CLIENT_URLS veya CLIENT_URL tanımlanması zorunludur.');
  }
  ```

---

### KATEGORİ 8: Dokümantasyon Senkronizasyonu

#### DEF-25: Ana Dokümanlar Güncellendi — İkincil Rehber ve Alt Proje `README.md` Senkronizasyonu
- **Dosya / Kod Konumu:** `docs/architecture.md`, `docs/KATILIMCI_DOGRULAMA.md`, `docs/GUVENLIK_VE_DOSYALAR.md`, `backend/README.md`, `frontend/README.md`, `frontend/hackaton/README.md`
- **Öncelik / Ciddiyet:** **P2 — Düşük (Low)**
- **Sorun Tanımı ve Etkisi:** 11 Kasım 2026 denetimi sırasında platformun 6 ana dokümanı (`docs/API.md`, `DATABASE.md`, `KURULUM.md`, `MEVCUT_PROJE_DURUMU.md`, `CANLIYA_CIKIS_KONTROL_LISTESI.md`, `README.md`) ile bu kapsamlı rehber doğrudan kod satırlarına göre senkronize edilip düzeltilmiştir (**40 uç nokta**, `b4fbf69` durum iş akışı, Brevo/Google/Cloudflare kurulumu, 350 test, gerçek boyutlar). Ancak ikincil dokümanlarda (mimari, güvenlik ve alt uygulama README'leri) önceki sprintlere ait port/kapsam ifadeleri veya Windows `npm.cmd` notu eksikleri kalmış olabilir.
- **Kök Neden:** Denetimde birincil operasyonel ve referans dokümanlara öncelik verilmesi.
- **Adım Adım Çözüm:** `DEF-02` (`docs/` klasör birleştirmesi) yapılırken alt `README.md` dosyaları ile `architecture.md`, `KATILIMCI_DOGRULAMA.md`, `GUVENLIK_VE_DOSYALAR.md` güncel endpoint/port/uygulama durumuna göre gözden geçirilip hizalanmalıdır.

---

## 4. Bağımsız Doğrulama Komutları

Aşağıdaki komutların tamamı Windows PowerShell üzerinde mevcut kod tabanında **350/350** yeşil sonuç vermektedir (`npm.cmd` / `npx.cmd` kullanılır):

```powershell
# 1. Tüm Lint + Katman 1 (295 Test) + İki Vite Build
npm.cmd run check

# 2. Katman 2 Yol Haritası Kabul Kapıları (12/12)
npm.cmd run test:roadmap

# 3. İzole Challenger Güvenlik & Dayanıklılık Testleri (26 + 12 = 38)
node --test --test-concurrency=1 backend/tests/challenger/*.test.js
npm.cmd exec --prefix frontend -- vitest run tests/challenger/m4-challenge.test.jsx

# 4. Playwright E2E Tarayıcı Akışları (4/4) & Responsive Layout (1/1)
npm.cmd run test:e2e
npm.cmd run check:layout --prefix frontend/hackaton

# 5. Bağımlılık Güvenlik Taraması (Üretim & Tüm Bağımlılıklar)
npm.cmd audit --omit=dev --prefix backend
npm.cmd audit --prefix backend
npm.cmd audit --prefix frontend
npm.cmd audit --prefix frontend/hackaton
```

---

## 5. Ek Güvenlik Sertleştirmesi (SEC-01 – SEC-09)

**Dal:** `fix/security-hardening` (`dev` / `ed9f7a3` üzerine) · **Commitler:** `25251f1` (kod + testler), `9488de3` (env şablonları; `DEF-17`)
**Durum:** Hepsi **Çözüldü**. Bu maddeler yukarıdaki 30 maddelik listede yoktu; 12 Kasım 2026 kod incelemesinde bulundu.

| No | Sorun | Çözüm | Konum |
|---|---|---|---|
| **SEC-01** | `forgot-password` / `reset-password` sıkı auth hız sınırının dışındaydı (yalnız genel 200/15 dk); OTP tahmini ve e-posta bombardımanına açık | Her iki uca `authLimiter` (30/15 dk) eklendi | `backend/src/app.js` |
| **SEC-02** | Hesap varlığı sızıyordu: `forgot-password`, `verify-email`, `reset-password` kayıtsız e-postaya **404**; `send-otp` / `register` kayıtlı hesaba **409**; cooldown **429**'u yalnız gerçek hesaplarda oluşuyordu | Kayıtlı/kayıtsız/doğrulanmış tüm durumlar aynı yanıtı veriyor (genel 200 veya "Kod hatalı" 400); kayıtlı hesaba gereksiz e-posta gitmiyor; OTP yakılmıyor | `backend/src/controllers/authController.js` |
| **SEC-03** | Hackathon başvurusu istemcinin gönderdiği `resumeUrl`'i doğrulamadan kaydediyordu; panelde "Özgeçmiş indir" bağlantısı olarak görünüyordu (oltalama vektörü) | `resumeUrl` yalnız doğrulanmış yüklemeden üretiliyor; gövdedeki değer yok sayılıyor | `backend/src/modules/hackathon/controllers/hackathonController.js` |
| **SEC-04** | Doğrulama istemeyen formlara anonim olarak istek başına 5 × 15 MB dosya yüklenebiliyordu (disk doldurma) | Dosya alanı olan formlar her zaman doğrulanmış katılımcı istiyor; kontrol dosya diske yazılmadan önce yapılıyor | `backend/src/modules/participantAuth/middleware/formParticipantMiddleware.js` |
| **SEC-05** | `tokenVersion` içermeyen JWT'ler iptal kontrolünü atlıyordu | Eksik `tokenVersion` 0 sayılıyor; şifre sıfırlama / rol değişikliği bu token'ları da iptal ediyor | `backend/src/middleware/authMiddleware.js` |
| **SEC-06** | JSON / urlencoded gövde sınırı gereksiz büyüktü (10 MB) | 1 MB'a indirildi; aşan istek Türkçe mesajlı **413** alıyor | `backend/src/app.js`, `backend/src/middleware/errorHandler.js` |
| **SEC-07** | Panel token'ı `localStorage`'da ve varsayılan **7 gün** geçerliydi | Varsayılan `JWT_EXPIRES_IN` **12h**; şablonlar ve `KATILIMCI_DOGRULAMA.md` güncellendi | `backend/src/utils/jwt.js`, `backend/.env.example` |
| **SEC-08** | Nginx: statik dosya `location` bloklarındaki `add_header Cache-Control`, sunucu düzeyindeki güvenlik başlıklarını o blokta siliyordu; geçersiz `X-XSS-Protection` kullanılıyordu | Güvenlik başlıkları statik bloklarda tekrarlandı; `X-XSS-Protection` kaldırıldı (`nginx -t` ile doğrulandı) | `nginx/nginx.conf` |
| **SEC-09** | Cloudflare + Nginx arkasında `TRUST_PROXY_HOPS=1` kalırsa hız sınırları tüm ziyaretçileri Cloudflare IP'leri altında birleştirir | Şablonlara "Cloudflare + Nginx → 2" notu eklendi; prod'da değerin kök `.env`'den geldiği belgelendi (bkz. `DEF-27`) | kök `.env.example`, `backend/.env.example` |

**Testler:** Yeni [`backend/tests/security-hardening.test.js`](../backend/tests/security-hardening.test.js) dosyası her madde için 8 regresyon testi içerir; testlerin hepsi düzeltmeden önceki kodda **başarısız**, sonrasında **başarılı** doğrulandı. Davranış değişikliği nedeniyle 5 mevcut test güncellendi (404/409 beklentileri → 400/200; anonim dosya yükleyen testler katılımcı token'ı gönderiyor). Sonuç: Backend **55/55**, Yol Haritası **5/5**, Backend Challenger **26/26**, ESLint temiz. Ön yüz ve E2E paketleri bu dalda yeniden koşturulmadı.

**Bilinçli olarak yapılmayanlar:**
- **CSP başlığı:** Google girişi ve API origin'i tarayıcıda denenmeden eklenirse siteyi bozabilir; canlı alan adları netleşince eklenmeli.
- **Üretimde zorunlu ayrı `PARTICIPANT_JWT_SECRET`:** Mevcut kurulumları kırmamak için zorunlu tutulmadı; token türü/audience ayrımı karışmayı zaten engelliyor. Şablonlarda ayrı anahtar öneriliyor.

---

## 6. Sonuç

GDG On Campus Pamukkale Üniversitesi Web Platformu; fonksiyonel backend mantığı, MongoDB ACID transaction bütünlüğü, HMAC-OTP ve Google ID token güvenliği, `b4fbf69` başvuru değerlendirme + Brevo e-posta profilleri ve 350 testlik iki katmanlı güvence paketiyle güçlü bir çekirdeğe sahiptir. Canlı alan adı (`gdgocpamukkale.com` + `panel.gdgocpamukkale.com`) açılışı öncesinde özellikle yukarıdaki **11 adet P0 eksikliğin** (bağlantılı sırayla: `DEF-26`, `DEF-27`, `DEF-28` altyapı/harici servisler + `DEF-07`, `DEF-08`, `DEF-10`, `DEF-11`, `DEF-14` vitrin & hukuk/performans + `DEF-17`, `DEF-21`, `DEF-23` env/test/audit yamaları) kapatılması önerilir.
