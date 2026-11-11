# GDG On Campus Pamukkale — Kapsamlı Proje Eksiklikleri ve Düzeltme Rehberi

**Tarih:** 11 Kasım 2026  
**Hazırlayan:** Documentation & Technical Audit Ekibi  
**Kapsam:** GDG On Campus Pamukkale Üniversitesi Web Platformu (Kök Yapı, Backend REST API, Core Team Yönetim Paneli, Hackathon Vitrin ve Başvuru Sitesi, Paylaşılan Modüller, Dağıtım & Docker Altyapısı, Test & CI/CD Takımları)  
**Çalışma Dalı (Branch):** `iyilestirme-ve-test` (Commit: `b4fbf69`)  
**Doğrulama Durumu:** 350/350 Test Başarılı, 0 ESLint Hatası, 2 Vite Derlemesi Başarılı  

---

## 1. Giriş ve Yönetici Özeti

Bu doküman, Google Developer Groups On Campus Pamukkale Üniversitesi için geliştirilen web platformunun baştan uca teknik denetimi sonucunda tespit edilen **25 kritik teknik eksiklik, mimari darboğaz, güvenlik açığı ve kullanıcı deneyimi boşluğunu** hiçbir ayrıntı atlanmadan belgelemektedir.

Proje; Express 5 ve Mongoose 9 tabanlı bir REST API, React 18/19 ve Vite tabanlı iki bağımsız ön yüz (Core Team Paneli ve Hackathon Vitrin Sitesi) ile Playwright E2E test takımından oluşan çok katmanlı bir platformdur. Yapılan incelemelerde fonksiyonel testlerin tamamının (Katman 1: 295 birim/entegrasyon testi, Katman 2: 12 kabul kapısı, 38 Challenger testi, 4 E2E senaryosu ve 1 Layout testi olmak üzere 350 test) başarılı olduğu gözlemlenmiştir. Ancak canlıya çıkış (production readiness), varlık optimizasyonu, yasal uyumluluk (KVKK), React durum yönetimi, paket izolasyonu ve bağımlılık güvenliği açılarından çözülmesi gereken somut eksiklikler bulunmaktadır.

Bu rehberde her kusur; kesin dosya yolu, satır aralıkları, etki analizi, kök neden tespiti ve **doğrudan uygulanabilir, eksiksiz kod ve konfigürasyon örnekleriyle** sunulmuştur.

---

## 2. Önceliklendirilmiş Eksiklik Matrisi (Defect Priority Matrix)

| No | Kategori | Eksiklik Tanımı | Konum | Seviye | Öncelik |
|---|---|---|---|---|---|
| **DEF-07** | Arayüz & Varlıklar | Hackathon Vitrininde Kırık Favicon ve Eksik OpenGraph Görseli (HTTP 404) | `frontend/hackaton/index.html:7,13,17` | High | **P0** |
| **DEF-08** | Arayüz & Varlıklar | 4.27+ MB Boyutunda Ham ve Optimize Edilmemiş TTF Font Yükü | `frontend/hackaton/public/fonts/` | High | **P0** |
| **DEF-11** | Arayüz & Varlıklar | Başvuru Formunda KVKK Aydınlatma Metni Bağlantısının Olmaması | `shared/hackathon-event.json:432` | High | **P0** |
| **DEF-14** | Mimari & Durum | Vitrinde Reaktif Olmayan Etkinlik Durumu (`let event = base`) | `frontend/hackaton/src/data/event.js:9-16` | High | **P0** |
| **DEF-17** | Ortam & Dağıtım | Kök `.env.example` Dosyasında Ön Yüz Değişkenlerinin Eksikliği | `.env.example:1-78` | High | **P0** |
| **DEF-21** | Test & CI/CD | Challenger Güvenlik Testlerinin Varsayılan `npm test` Dışında Kalması | `backend/package.json:10` | High | **P0** |
| **DEF-23** | Güvenlik | Yüksek Seviyeli Bağımlılık Güvenlik Açıkları (`mongoose`, `multer`, `body-parser`) | `backend/package.json`, `package.json` | High | **P0** |
| **DEF-25** | Dokümantasyon | API, Veritabanı ve Kurulum Dokümanlarındaki Bayat Açıklamalar | `documents/` | High | **P0** |
| **DEF-02** | Mimari & Durum | Dokümantasyon Klasör Çift Başlılığı (`documents/` vs `Docs/`) | Kök dizin | Medium | **P1** |
| **DEF-04** | Mimari & Durum | Kök Dizin Paket Yönetiminde Workspaces Tanımının Bulunmaması | `package.json:1-27` | Medium | **P1** |
| **DEF-05** | Mimari & Durum | Ön Yüzler Arasında React Sürüm Uyumsuzluğu (React 19 vs React 18) | `frontend/package.json` vs `hackaton` | Medium | **P1** |
| **DEF-06** | Mimari & Durum | Core Team Panelinde İlkel Hash Tabanlı Yönlendirme (Naive Hash Routing) | `frontend/src/App.jsx:9-17, 31-37` | Medium | **P1** |
| **DEF-09** | Arayüz & Varlıklar | A11y: Kişi Kartlarında Boş `alt=""` Özelliği (`PersonCard.jsx`) | `frontend/hackaton/src/components/PersonCard.jsx:19` | Medium | **P1** |
| **DEF-10** | Arayüz & Varlıklar | Footer Sosyal Medya Bağlantılarının Kök Alan Adlarına Yönlenmesi | `shared/hackathon-event.json:444-457` | Medium | **P1** |
| **DEF-15** | Kod Kalitesi | Atıl ve Çelişkili Veri Modelleri (`Team.js` ve shim modeller) | `backend/src/models/Team.js` | Medium | **P1** |
| **DEF-16** | Kod Kalitesi | Proje Genelinde Statik Tip Kontrolünün (TypeScript/JSDoc) Bulunmaması | Proje geneli | Medium | **P1** |
| **DEF-18** | Ortam & Dağıtım | Windows PowerShell Betik Yürütme İlkesi Kısıtı (`npm.ps1`) | `KURULUM.md`, `README.md` | Medium | **P1** |
| **DEF-19** | Ortam & Dağıtım | Aşırı Dar Node.js Motor Sürümü Kuralı (`>=24.15.0`) | `package.json` dosyaları | Medium | **P1** |
| **DEF-20** | Performans | Ön Yüz Paketlerinde Kod Bölümleme (Chunk Splitting) Eksikliği | `vite.config.js` dosyaları | Medium | **P1** |
| **DEF-22** | Test & CI/CD | GitHub Actions CI İş Akışının Tek Bir Seri Adımda Çalışması | `.github/workflows/check.yml:1-20` | Medium | **P1** |
| **DEF-24** | Güvenlik | Canlı Ortamda `CLIENT_URLS` Boş Bırakıldığında Servis Çöküşü | `backend/src/app.js:33-40` | Medium | **P1** |
| **DEF-01** | Mimari & Durum | Klasör İsminde Boşluk Karakteri Bulunması (`design folders/`) | `design folders/` | Low | **P2** |
| **DEF-03** | Mimari & Durum | Yazım Uyumsuzluğu: `frontend/hackaton` vs `backend/.../hackathon` | `frontend/hackaton/` | Low | **P2** |
| **DEF-12** | Arayüz & Varlıklar | Core Team Panelinde Robots Meta Etiketi Bulunmaması | `frontend/index.html:1-13` | Low | **P2** |
| **DEF-13** | Arayüz & Varlıklar | Ön Yüz ve Hata Mesajlarında Türkçe / İngilizce Dil Tutarsızlıkları | `Users.jsx`, `roleMiddleware.js` | Low | **P2** |

---

## 3. Sekiz Kategori Altında 25 Kusurun Ayrıntılı Analizi ve Çözüm Rehberi

---

### KATEGORİ 1: Mimari ve Durum Yönetimi (Architecture & State Management)

#### DEF-01: Boşluk İçeren Dizin İsmi (`design folders/`)
- **Dosya / Kod Konumu:** `design folders/` (Proje kök dizini)
- **Öncelik / Ciddiyet:** P2 — Düşük (Low)
- **Sorun Tanımı ve Etkisi:** Proje kök dizininde yer alan `design folders` dizin adı boşluk karakteri içermektedir. Bu dizin içinde ~22 MB ham TTF font dosyaları bulunmaktadır. Boşluk karakteri içeren yollar; Linux tabanlı CI/CD koşucularında, Docker volume bağlamalarında (`volume mounts`) ve komut satırı betiklerinde tırnak işareti unutulduğunda komutların (`cd`, `cp`, `rsync`) kırılmasına ve hata vermesine sebep olur.
- **Kök Neden:** İlk tasarım mock-up'larının tasarımcının yerel ortamından doğrudan masaüstü klasör ismiyle depoya eklenmesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. Git dizin taşıma komutuyla klasörü standart kebab-case formatına dönüştürün:
     ```bash
     git mv "design folders" design-assets
     ```
  2. Kök dizindeki `.gitignore` dosyasını açıp büyük tasarım dosyalarının yanlışlıkla takip edilmesini engelleyin:
     ```gitignore
     # Tasarım kaynak dosyaları ve ham arşivler
     design-assets/*.zip
     design-assets/raw-exports/
     ```
  3. Klasör içindeki kullanılmayan ham font varyantlarını (örneğin Google Sans Italic varyantları üretimde kullanılmamaktadır) depodan temizleyerek repo boyutunu küçültün.

---

#### DEF-02: Dokümantasyon Klasör Çift Başlılığı (`documents/` vs `Docs/`)
- **Dosya / Kod Konumu:** `documents/` (13 Markdown + 1 PDF) ve `Docs/` (`Docs/superpowers/...`)
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Windows dosya sistemi büyük/küçük harf duyarsız (`case-insensitive`) çalışırken Linux sunucuları ve GitHub Actions ortamları harf duyarlıdır (`case-sensitive`). Projede hem `documents/` hem de `Docs/` klasörünün bulunması, çapraz platformlarda dosya arama karmaşasına, kırık markdown bağlantılarına ve geliştiricilerin yanlış klasöre dosya yazmasına yol açmaktadır.
- **Kök Neden:** İlk planlama aşamasında `Docs/superpowers/` klasörünün oluşturulması, daha sonraki sprintlerde ise teknik belgelerin `documents/` altına yazılması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. Standart dokümantasyon kök dizini olarak `docs/` seçilmelidir.
  2. Git ortamında güvenli birleştirme adımı:
     ```bash
     # Geçici bir ara ad kullanarak case duyarlılığını koruyun
     git mv documents docs-temp
     git mv Docs/superpowers docs-temp/superpowers
     git rm -rf Docs
     git mv docs-temp docs
     ```
  3. `README.md` ve tüm belgelerdeki `documents/` bağlantılarını `docs/` olarak güncelleyin.

---

#### DEF-03: Yazım Uyumsuzluğu: `frontend/hackaton` vs `backend/src/modules/hackathon`
- **Dosya / Kod Konumu:** `frontend/hackaton/` ve `backend/src/modules/hackathon/`
- **Öncelik / Ciddiyet:** P2 — Düşük (Low)
- **Sorun Tanımı ve Etkisi:** İngilizce ve Türkçe teknik literatürde doğru yazım "hackathon"dur. Backend modülü `hackathon` olarak adlandırılmış, `package.json` adı `gdg-pau-hackathon` yapılmış; ancak ön yüz dizininde "h" harfi eksik bırakılarak `frontend/hackaton` yazılmıştır. Bu durum API rotaları, Vite yapılandırması ve dokümantasyon arasında yazım tutarsızlığına yol açmaktadır.
- **Kök Neden:** İlk ön yüz prototipinin oluşturulması sırasında yapılan yazım hatası.
- **Adım Adım Ayrıntılı Çözüm:**
  - *Seçenek A (Mimari Karar Olarak Korumak):* Mevcut tüm CI ve E2E betiklerini kırmamak için dizin adı korunacaksa, `docs/architecture.md` içerisine şu mimari not eklenmelidir:
    > "Not: `frontend/hackaton` dizin adı geriye dönük betik uyumluluğu için 'h' harfi olmadan korunmuştur; backend modülü ise `hackathon` olarak adlandırılmıştır."
  - *Seçenek B (Düzeltme):*
    ```bash
    git mv frontend/hackaton frontend/hackathon
    ```
    Ardından `package.json` içindeki betiklerde (`dev:hackaton`, `check:layout`), `Dockerfile`, `compose.yaml` ve `playwright.config.cjs` yollarında `hackaton` ifadelerini `hackathon` olarak toplu güncelleyin.

---

#### DEF-04: Kök Dizin Paket Yönetiminde Workspaces Tanımının Bulunmaması
- **Dosya / Kod Konumu:** `package.json:1-27` (Proje kök dizini)
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Kök `package.json` dosyası modern npm/yarn/pnpm çalışma alanı (`workspaces`) tanımını kullanmamaktadır. Bağımlılıklar kök, backend, frontend ve hackaton dizinlerinde 4 ayrı kopya olarak indirilmekte; `e2e/server.cjs` Express'i import edebilmek için `require('../backend/node_modules/express')` şeklinde kırılgan göreli yollar kullanmaktadır. Ayrıca `npm audit` her dizinde tek tek çalıştırılmak zorundadır.
- **Kök Neden:** Projenin başlangıçta bağımsız repoların bir araya getirilmesiyle monorepo'ya dönüştürülmesi ve workspaces yapılandırmasının atlanması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. Kök `package.json` dosyasını açarak `workspaces` alanını ekleyin:
     ```json
     {
       "name": "gdg-on-campus-web",
       "version": "1.0.0",
       "private": true,
       "workspaces": [
         "backend",
         "frontend",
         "frontend/hackaton"
       ],
       "scripts": { ... }
     }
     ```
  2. Kök dizinden `npm.cmd install` çalıştırarak bağımlılıkların hoist edilmesini sağlayın.
  3. `e2e/server.cjs` içindeki import yollarını standart paket adlarına dönüştürün:
     ```javascript
     // Eski: const express = require('../backend/node_modules/express');
     // Yeni:
     const express = require('express');
     const mongoose = require('mongoose');
     ```

---

#### DEF-05: Ön Yüzler Arasında React Sürüm Uyumsuzluğu (React 19 vs React 18)
- **Dosya / Kod Konumu:** `frontend/package.json:15` (`"react": "^19.2.8"`) vs `frontend/hackaton/package.json:20` (`"react": "^18.3.1"`)
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Core Team paneli React 19 kullanırken, Hackathon vitrini React 18 kullanmaktadır. İki uygulama arasında ortak UI bileşeni (butonlar, modal pencereler, form girdileri) veya özel kancalar (`useToast`, `useAuth`) paylaşıldığında React context ve hook çakışmaları (invalid hook call) meydana gelecektir.
- **Kök Neden:** Core Team panelinin daha yeni bir Vite şablonuyla oluşturulması, Hackathon sitesinin ise önceki React 18 LTS şablonunda kalması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend/hackaton/package.json` bağımlılıklarını React 19'a yükseltin:
     ```json
     "dependencies": {
       "react": "^19.2.8",
       "react-dom": "^19.2.8"
     },
     "devDependencies": {
       "@testing-library/react": "^16.2.0"
     }
     ```
  2. `frontend/hackaton` dizininde `npm.cmd install` çalıştırın.
  3. `npm.cmd test --prefix frontend/hackaton` ile 221 testin tamamının React 19 üzerinde çalıştığını doğrulayın.

---

#### DEF-06: Core Team Panelinde İlkel Hash Tabanlı Yönlendirme (Naive Hash Routing)
- **Dosya / Kod Konumu:** `frontend/src/App.jsx:9-17, 31-37`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Core Team paneli rota yönetimini tarayıcının `window.location.hash` değerini elle dinleyerek (`getRoute()`) çözmektedir. Kod içinde `// Sayfalar arası geçiş adımında react-router ile değiştirilecek.` notu bulunmaktadır. Bu yöntem; tarayıcı geçmişini (ileri/geri butonları), dinamik URL parametrelerini (`/applications/:id`), sorgu parametrelerini (`?status=PENDING`) ve yetki korumalı alt rotaları (nested protected routes) standart dışı ve kırılgan kılmaktadır.
- **Kök Neden:** Hızlı prototipleme amacıyla ilk aşamada harici yönlendirme kütüphanesinin eklenmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend` dizinine `react-router-dom` paketini ekleyin:
     ```bash
     npm.cmd install react-router-dom --prefix frontend
     ```
  2. `frontend/src/App.jsx` dosyasını declarative router yapısına dönüştürün:
     ```jsx
     import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
     import Auth from './pages/Auth';
     import Applications from './pages/Applications';
     import Users from './pages/Users';
     import ProtectedRoute from './components/ProtectedRoute';

     export default function App() {
       return (
         <BrowserRouter>
           <Routes>
             <Route path="/login" element={<Auth />} />
             <Route path="/applications" element={
               <ProtectedRoute allowedRoles={['ORGANIZER', 'ADMIN']}>
                 <Applications />
               </ProtectedRoute>
             } />
             <Route path="/users" element={
               <ProtectedRoute allowedRoles={['ADMIN']}>
                 <Users />
               </ProtectedRoute>
             } />
             <Route path="*" element={<Navigate to="/applications" replace />} />
           </Routes>
         </BrowserRouter>
       );
     }
     ```

---

#### DEF-14: Vitrinde Reaktif Olmayan Etkinlik Durumu (`let event = base`)
- **Dosya / Kod Konumu:** `frontend/hackaton/src/data/event.js:9-16` ve `frontend/hackaton/src/main.jsx:11-41`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / Kritik Mimari Açık)
- **Sorun Tanımı ve Etkisi:** Hackathon vitrin sitesinde dinamik etkinlik verisi ES modülü düzeyinde mutable bir `let` değişkeni olarak tutulmaktadır:
  ```javascript
  export let event = base;
  export let formSlug = 'hackathon-katilim';
  export async function loadEvent() {
    const page = await getEventPage();
    event = page.event; // <-- Modül değişkeni mutate ediliyor!
    formSlug = page.formSlug;
  }
  ```
  JavaScript modüllerinde dışa aktarılan bir `let` değişkeninin içeriğini değiştirmek, React'ın Virtual DOM render döngüsünü tetiklemez. Sayfa bileşenleri (`Home`, `Register`, `Schedule`, `Team`) veriyi `props.data = event` varsayılan parametresiyle okuduğundan; `/admin` panelinden yapılan anlık içerik güncellemeleri veya arka planda verinin tazelenmesi sayfaların yeniden render olmasını sağlamaz. Kullanıcı sayfayı F5 ile tamamen yenilemedikçe değişiklikleri göremez.
- **Kök Neden:** İlk statik prototipte verinin doğrudan JSON dosyasından import edilmesi, daha sonra API katmanı eklenirken React Context mimarisi yerine modül değişkeninin güncellenmesi yoluna gidilmesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend/hackaton/src/context/EventContext.jsx` dosyasını oluşturun:
     ```jsx
     import { createContext, useContext, useState, useEffect, useCallback } from 'react';
     import { getEventPage } from '../lib/eventApi';
     import baseEvent from '../data/base';

     const EventContext = createContext(null);

     export function EventProvider({ children }) {
       const [eventData, setEventData] = useState(baseEvent);
       const [formSlug, setFormSlug] = useState('hackathon-katilim');
       const [loading, setLoading] = useState(true);
       const [error, setError] = useState(null);

       const refreshEvent = useCallback(async () => {
         try {
           setLoading(true);
           const page = await getEventPage();
           if (page?.event) {
             setEventData(page.event);
             setFormSlug(page.formSlug || 'hackathon-katilim');
           }
         } catch (err) {
           setError(err.message);
         } finally {
           setLoading(false);
         }
       }, []);

       useEffect(() => {
         refreshEvent();
       }, [refreshEvent]);

       return (
         <EventContext.Provider value={{ event: eventData, formSlug, loading, error, refreshEvent }}>
           {children}
         </EventContext.Provider>
       );
     }

     export function useEvent() {
       const context = useContext(EventContext);
       if (!context) throw new Error('useEvent must be used within an EventProvider');
       return context;
     }
     ```
  2. `frontend/hackaton/src/main.jsx` içinde kök bileşeni `<EventProvider>` ile sarmalayın:
     ```jsx
     import { EventProvider } from './context/EventContext';

     ReactDOM.createRoot(document.getElementById('root')).render(
       <React.StrictMode>
         <EventProvider>
           <App />
         </EventProvider>
       </React.StrictMode>
     );
     ```
  3. `Register.jsx`, `Home.jsx`, `Admin.jsx` vb. bileşenlerde doğrudan `import { event }` yerine `const { event, formSlug } = useEvent();` kancasını kullanın.

---

### KATEGORİ 2: Arayüz, Deneyim ve Statik Varlıklar (UI/UX & Assets)

#### DEF-07: Hackathon Vitrininde Eksik Favicon ve Kırık OpenGraph Görseli (HTTP 404)
- **Dosya / Kod Konumu:** `frontend/hackaton/index.html:7, 13, 17`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / Marka & Sosyal Medya İtibarı)
- **Sorun Tanımı ve Etkisi:** `frontend/hackaton/index.html` başlığında:
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta property="og:image" content="/og-image.png" />
  <meta name="twitter:image" content="/og-image.png" />
  ```
  tanımlıdır. Ancak `frontend/hackaton/public/` dizini kontrol edildiğinde sadece `_redirects` ve `fonts/` bulunmaktadır. Tarayıcı her açılışta `/favicon.svg` için 404 hatası üretmekte; bağlantı WhatsApp, LinkedIn, Telegram veya Twitter'da paylaşıldığında kart görseli kırık çıkmaktadır.
- **Kök Neden:** Varlık dosyalarının `frontend/public/` altında kalması, hackathon projesinin `public/` klasörüne kopyalanmaması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend/public/favicon.svg` dosyasını `frontend/hackaton/public/favicon.svg` konumuna kopyalayın:
     ```bash
     copy frontend\public\favicon.svg frontend\hackaton\public\favicon.svg
     ```
  2. 1200x630 piksel boyutunda, GDG On Campus Pamukkale Hackathon 2026 temalı optimize edilmiş `og-image.png` görselini `frontend/hackaton/public/og-image.png` konumuna yerleştirin.
  3. `frontend/hackaton/index.html` dosyasında tam alan adı kullanımını desteklemek üzere `content` etiketine güvenli fallback ekleyin:
     ```html
     <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
     <meta property="og:image" content="/og-image.png" />
     <meta property="og:image:width" content="1200" />
     <meta property="og:image:height" content="630" />
     <meta name="twitter:card" content="summary_large_image" />
     <meta name="twitter:image" content="/og-image.png" />
     ```

---

#### DEF-08: Devasa ve Optimize Edilmemiş TTF Font Yükü (4.27+ MB)
- **Dosya / Kod Konumu:** `frontend/hackaton/public/fonts/` ve `frontend/hackaton/src/styles/fonts.css`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / Web Vitals & Mobil Performans)
- **Sorun Tanımı ve Etkisi:**
  - `GoogleSans-Bold.ttf`: 2,148,428 bayt (~2.15 MB)
  - `GoogleSans-Regular.ttf`: 2,119,572 bayt (~2.12 MB)
  - Toplam font boyutu **4.27 MB**'ın üzerindedir. Bu dosyalar `fonts.css` üzerinden senkron yüklenmektedir. Düşük mobil bağlantılarda (3G/4G) sayfa açılışında içerik saniyelerce çizilememekte (LCP / FCP darboğazı) veya FOIT (Flash of Invisible Text) oluşmaktadır.
- **Kök Neden:** Masaüstü tasarım paketinden alınan ham TrueType fontların web için optimize edilmeden (Woff2 ve karakter alt-kümeleme yapılmadan) doğrudan `public/fonts/` klasörüne konulması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `fonttools` ve `brotli` kullanarak yalnızca Latin ve Latin-Extended (Türkçe karakterler: `ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü`) gliflerini içeren `.woff2` fontları üretin:
     ```bash
     pyftsubset GoogleSans-Regular.ttf --output-file=GoogleSans-Regular.woff2 --flavor=woff2 --unicodes="U+0000-00FF,U+0131,U+0130,U+015F,U+015E,U+011F,U+011E,U+00E7,U+00C7,U+00F6,U+00D6,U+00FC,U+00DC"
     pyftsubset GoogleSans-Bold.ttf --output-file=GoogleSans-Bold.woff2 --flavor=woff2 --unicodes="U+0000-00FF,U+0131,U+0130,U+015F,U+015E,U+011F,U+011E,U+00E7,U+00C7,U+00F6,U+00D6,U+00FC,U+00DC"
     ```
     Bu işlem dosya boyutlarını ~2.15 MB'tan font başına **~35 KB** seviyesine (toplamda ~70 KB) indirecektir (%98 tasarruf).
  2. `frontend/hackaton/src/styles/fonts.css` dosyasını güncelleyin:
     ```css
     @font-face {
       font-family: 'Google Sans';
       src: url('/fonts/GoogleSans-Regular.woff2') format('woff2');
       font-weight: 400;
       font-style: normal;
       font-display: swap;
     }

     @font-face {
       font-family: 'Google Sans';
       src: url('/fonts/GoogleSans-Bold.woff2') format('woff2');
       font-weight: 700;
       font-style: normal;
       font-display: swap;
     }
     ```
  3. `frontend/hackaton/index.html` içine `preload` bağlantısı ekleyerek fontun ilk byte'ta indirilmesini sağlayın:
     ```html
     <link rel="preload" href="/fonts/GoogleSans-Regular.woff2" as="font" type="font/woff2" crossorigin />
     ```

---

#### DEF-09: A11y: Kişi Kartlarında Boş `alt=""` Özelliği (`PersonCard.jsx`)
- **Dosya / Kod Konumu:** `frontend/hackaton/src/components/PersonCard.jsx:19`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium / Erişilebilirlik)
- **Sorun Tanımı ve Etkisi:**
  ```jsx
  {person.photo ? <img src={person.photo} alt="" /> : ...}
  ```
  `alt=""` kullanımı ekran okuyucu kullanan görme engelli bireyler için görseli tamamen dekoratif kabul eder ve yok sayar. Jüri üyesinin, konuşmacının veya organizatörün adı seslendirilmez.
- **Kök Neden:** Hızlı arayüz kodlaması sırasında erişilebilirlik (WCAG 2.1 AA) kurallarının göz ardı edilmesi.
- **Adım Adım Ayrıntılı Çözüm:**
  `PersonCard.jsx` satır 19'u şu şekilde güncelleyin:
  ```jsx
  {person.photo ? (
    <img
      src={person.photo}
      alt={`${person.name} - ${person.title || 'Ekip Üyesi'}`}
      loading="lazy"
    />
  ) : (
    <div className="person-card__fallback-avatar" aria-hidden="true">
      {person.name ? person.name.charAt(0) : '?'}
    </div>
  )}
  ```

---

#### DEF-10: Footer Sosyal Medya Bağlantılarının Kök Alan Adlarına Yönlenmesi
- **Dosya / Kod Konumu:** `shared/hackathon-event.json:444-457` ve `frontend/hackaton/src/components/Footer.jsx:9-17`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium / Kullanıcı Deneyimi)
- **Sorun Tanımı ve Etkisi:** Etkinlik sitesinin altbilgisindeki sosyal medya butonları jenerik platform anasayfalarına (`https://www.instagram.com/`, `https://www.linkedin.com/`, `https://x.com/`) gitmektedir. Etkinlikle ilgilenen katılımcılar kulübün resmi hesaplarına ulaşamamaktadır.
- **Kök Neden:** Şablondaki yer tutucu adreslerin organizasyonun gerçek hesaplarıyla değiştirilmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  `shared/hackathon-event.json` dosyasındaki `socials` listesini GDG On Campus Pamukkale resmi profilleriyle güncelleyin:
  ```json
  "socials": [
    { "platform": "instagram", "url": "https://www.instagram.com/gdgocpau" },
    { "platform": "linkedin", "url": "https://www.linkedin.com/company/gdg-on-campus-pamukkale-university/" },
    { "platform": "x", "url": "https://x.com/gdgocpau" }
  ]
  ```

---

#### DEF-11: Başvuru Formunda KVKK Aydınlatma Metni Bağlantısının Olmaması
- **Dosya / Kod Konumu:** `shared/hackathon-event.json:432` ve `frontend/hackaton/src/components/StepForm.jsx`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / Hukuki Zorunluluk — 6698 Sayılı Kanun)
- **Sorun Tanımı ve Etkisi:** Formun 4. adımında zorunlu KVKK rıza onay kutusu yer almaktadır. İpucu metninde "Detaylı metin için tıklayınız." yazmaktadır. Ancak bu metin tıklanamayan düz bir `<p className="field__hint">` etiketi olarak render edilmektedir; herhangi bir link, modal veya sayfa bağlantısı yoktur. 6698 sayılı Kişisel Verilerin Korunması Kanunu uyarınca, aydınlatma yükümlülüğü yerine getirilmeden alınan açık rıza hukuken geçersizdir.
- **Kök Neden:** Arayüz bileşeninin markdown veya bağlantı ayrıştırma mantığına sahip olmaması ve resmi aydınlatma URL'inin şablona eklenmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend/hackaton/src/components/Field.jsx` veya `StepForm.jsx` bileşeninde `hint` alanını tıklanabilir bağlantıları açacak şekilde güncelleyin:
     ```jsx
     function renderHint(hint) {
       if (!hint) return null;
       const urlMatch = hint.match(/\[(.*?)\]\((.*?)\)/);
       if (urlMatch) {
         const [full, text, url] = urlMatch;
         const parts = hint.split(full);
         return (
           <p className="field__hint">
             {parts[0]}
             <a href={url} target="_blank" rel="noopener noreferrer" className="field__link">
               {text}
             </a>
             {parts[1]}
           </p>
         );
       }
       return <p className="field__hint">{hint}</p>;
     }
     ```
  2. `shared/hackathon-event.json` satır 432'yi güncelleyin:
     ```json
     "hint": "Kişisel verilerinizin işlenmesine ilişkin detaylı aydınlatma metnini okumak için [buraya tıklayınız](https://pau.edu.tr/kvkk-aydinlatma-metni)."
     ```

---

#### DEF-12: Core Team Panelinde Robots Meta Etiketi Bulunmaması
- **Dosya / Kod Konumu:** `frontend/index.html:1-13`
- **Öncelik / Ciddiyet:** P2 — Düşük (Low / Güvenlik & SEO)
- **Sorun Tanımı ve Etkisi:** Core Team paneli dahili bir yönetim arayüzüdür. HTML şablonunda `<meta name="robots" content="noindex, nofollow" />` etiketi bulunmamaktadır. Canlıya alındığında arama motoru botları (Googlebot vb.) panelin giriş sayfasını dizine ekleyebilir ve arama sonuçlarında listeleyebilir.
- **Kök Neden:** Standart Vite React şablonunun robots meta etiketi olmadan kullanılması.
- **Adım Adım Ayrıntılı Çözüm:**
  `frontend/index.html` dosyasına head etiketleri arasına şu satırı ekleyin:
  ```html
  <meta name="robots" content="noindex, nofollow" />
  ```

---

#### DEF-13: Ön Yüz ve Hata Mesajlarında Türkçe / İngilizce Dil Tutarsızlıkları
- **Dosya / Kod Konumu:** `frontend/src/pages/Users.jsx:59-62`, `backend/src/middleware/roleMiddleware.js:24`, `frontend/hackaton/src/components/ParticipantVerification.jsx:78`
- **Öncelik / Ciddiyet:** P2 — Düşük (Low / UX Tutarlılığı)
- **Sorun Tanımı ve Etkisi:** Paneldeki filtre butonlarında `PENDING`, `ORGANIZER`, `ADMIN` gibi ham İngilizce veritabanı enum değerleri doğrudan son kullanıcıya gösterilmektedir. Backend hata mesajında ise `'Account awaiting admin approval (Hesabınız yönetici onayını bekliyor).'` şeklinde iki dilli melez bir yapı bulunmaktadır. Google GIS butonunda ise `'continue_with'` kullanılmaktadır.
- **Kök Neden:** Çok dilli altyapı (i18n) kurulmadan parça parça geliştirme yapılması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend/src/pages/Users.jsx` içine etiket haritalaması ekleyin:
     ```javascript
     const ROLE_LABELS = {
       ALL: 'Tümü',
       PENDING: 'Onay Bekliyor',
       ORGANIZER: 'Organizatör',
       ADMIN: 'Yönetici'
     };
     ```
  2. `backend/src/middleware/roleMiddleware.js` ve `authController.js` içindeki hata mesajlarını standart Türkçe yapın:
     ```javascript
     return res.status(403).json({
       success: false,
       message: 'Hesabınız yönetici onayını beklemektedir.'
     });
     ```

---

### KATEGORİ 3: Kod Kalitesi ve Sürdürülebilirlik (Code Quality & Maintainability)

#### DEF-15: Atıl ve Çelişkili Veri Modelleri (`Team.js` ve shim modeller)
- **Dosya / Kod Konumu:** `backend/src/models/Team.js` ve `backend/src/models/HackathonApp.js`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Proje dinamik form mimarisine (`Form` ve `FormResponse`) geçmiş durumdadır. `Team.js` modeli aktif hiçbir rotada kullanılmamaktadır. `HackathonApp.js` ise hem kök `models/` altında shim olarak hem de `modules/hackathon/models/HackathonApp.js` altında bulunmaktadır. Yeni bir geliştirici hangi modelin güncel olduğunu anlamakta zorlanmaktadır.
- **Kök Neden:** Faz 1'deki eski mimarinin temizlenmeden bırakılması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `backend/src/models/Team.js` üzerine açık bir JSDoc ve migration uyarısı ekleyin:
     ```javascript
     /**
      * @deprecated Bu model dinamik Form/FormResponse yapısına geçildiği için atıldır.
      * Faz 2 veritabanı temizliğinde koleksiyon kaldırılacaktır.
      */
     ```
  2. Kök `models/HackathonApp.js` dosyasını yalnızca modül modeline referans veren temiz bir köprü (`proxy`) olarak koruyun veya import yollarını doğrudan modüle yönlendirin.

---

#### DEF-16: Proje Genelinde Statik Tip Kontrolünün (TypeScript/JSDoc) Bulunmaması
- **Dosya / Kod Konumu:** Tüm `backend/src/**/*.js`, `frontend/src/**/*.jsx`, `frontend/hackaton/src/**/*.jsx`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Projede TypeScript veya JSDoc tabanlı statik tip denetimi (`checkJs`) bulunmamaktadır. Dinamik form alanları (`fields[]`), Mongoose modelleri ve API yanıtları çalışma zamanında beklenmeyen tipler aldığında (`null` vs `undefined`, sayı yerine metin) sessiz veri bozulmalarına yol açmaktadır.
- **Kök Neden:** Başlangıçta projenin saf JavaScript ile hızlıca hayata geçirilmesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. Kök dizine ve her alt projeye `jsconfig.json` ekleyerek VS Code / IDE tip denetimini aktif edin:
     ```json
     {
       "compilerOptions": {
         "checkJs": true,
         "jsx": "react-jsx",
         "target": "ES2022",
         "module": "NodeNext",
         "baseUrl": ".",
         "paths": {
           "@/*": ["src/*"]
         }
       },
       "exclude": ["node_modules", "dist"]
     }
     ```
  2. Kritik veri modelleri için JSDoc `@typedef` tanımları ekleyin:
     ```javascript
     /**
      * @typedef {Object} FormField
      * @property {string} fieldId
      * @property {string} label
      * @property {'text'|'textarea'|'email'|'tel'|'select'|'checkbox'|'radio'|'file'|'number'|'date'} type
      * @property {boolean} required
      */
     ```

---

### KATEGORİ 4: Ortam Değişkenleri ve Dağıtım Yapılandırması (Configuration & Environment)

#### DEF-17: Kök `.env.example` Dosyasında Ön Yüz Değişkenlerinin Eksikliği
- **Dosya / Kod Konumu:** `.env.example:1-78` (Kök dizin)
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / DevOps & Canlıya Alma)
- **Sorun Tanımı ve Etkisi:** Kök `.env.example` dosyasında veritabanı, JWT ve Brevo değişkenleri varken; Docker Compose ve Vite ön yüzlerinin ihtiyaç duyduğu `VITE_API_URL`, `PUBLIC_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `HACKATON_PORT`, `PANEL_PORT` değişkenleri yer almamaktadır. Projeyi ilk kez klonlayan biri kök `.env` dosyasını oluşturduğunda Docker konteynerleri API'ye bağlanamamakta ve Google butonu çalışmamaktadır.
- **Kök Neden:** Ortam değişkenlerinin sadece alt dizinlerdeki (`frontend/.env.example`) dosyalara yazılması, kök şablonun senkronize edilmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  Kök `.env.example` dosyasına aşağıdaki bloğu ekleyin:
  ```env
  # ==============================================================================
  # Ön Yüz (Vite) & Docker Port Yapılandırması
  # ==============================================================================
  VITE_API_URL=http://localhost:5000
  PUBLIC_API_URL=http://localhost:5000
  VITE_GOOGLE_CLIENT_ID=your_google_web_client_id.apps.googleusercontent.com
  HACKATON_PORT=5173
  PANEL_PORT=5174
  MONGO_PORT=27017

  # ==============================================================================
  # Brevo E-posta Gönderici Profilleri (Commit b4fbf69)
  # ==============================================================================
  BREVO_APPLICATION_SENDER_EMAIL=noreply@pau.edu.tr
  BREVO_APPLICATION_SENDER_NAME="GDG On Campus Pamukkale"
  BREVO_APPLICATION_REPLY_TO=iletisim@pau.edu.tr
  ```

---

#### DEF-18: Windows PowerShell Script Yürütme İlkesi Kısıtı (`npm.ps1`)
- **Dosya / Kod Konumu:** `package.json`, `README.md`, `documents/KURULUM.md`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium / Geliştirici Deneyimi)
- **Sorun Tanımı ve Etkisi:** Windows kullanıcıları PowerShell üzerinde `npm run check` veya `npm run dev` çalıştırdığında `PSSecurityException: File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system` hatasıyla karşılaşmakta ve projeyi başlatamamaktadır.
- **Kök Neden:** Windows'un imzasız PowerShell betiklerini (`.ps1`) varsayılan güvenlik ilkesi (`Restricted`) ile engellemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  `KURULUM.md` ve `README.md` dosyalarına açık bir Windows kılavuzu ekleyin:
  1. Geliştiricilere komutları `.cmd` uzantısıyla çalıştırmaları önerilmelidir (`npm.cmd run check`, `npm.cmd test`, `npx.cmd playwright test`).
  2. Alternatif olarak PowerShell oturumunda tek seferlik izin verilmelidir:
     ```powershell
     Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
     ```

---

#### DEF-19: Aşırı Dar Node.js Motor Sürümü Kuralı (`>=24.15.0`)
- **Dosya / Kod Konumu:** `package.json:4-6`, `backend/package.json:36-38`, `frontend/package.json:34-36`, `frontend/hackaton/package.json:6-8`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium / Dağıtım Uyumluluğu)
- **Sorun Tanımı ve Etkisi:** Tüm `package.json` dosyalarında `"node": ">=24.15.0 <25"` kuralı konulmuştur. Node.js 24 henüz en yeni (Current) sürümdür. Kurumsal PaaS sağlayıcılarında (AWS Elastic Beanstalk, Render, Vercel, Railway) ve birçok geliştirici makinesinde aktif LTS sürümü olan Node.js 22 (`v22.12.0+`) kuruludur. Bu katı kural gereksiz `EBADENGINE` hatalarına yol açmaktadır.
- **Kök Neden:** Geliştiricinin yerel makinesindeki Node 24 sürümünü birebir kural olarak sabitlemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  Tüm `package.json` dosyalarındaki `engines` alanını Node 22 LTS'yi de kapsayacak şekilde esnetin:
  ```json
  "engines": {
    "node": ">=22.12.0 <25",
    "npm": ">=10.0.0"
  }
  ```

---

### KATEGORİ 5: Performans ve Optimizasyon (Performance & Optimization)

#### DEF-20: Ön Yüz Paketlerinde Kod Bölümleme (Chunk Splitting) Eksikliği
- **Dosya / Kod Konumu:** `frontend/vite.config.js` ve `frontend/hackaton/vite.config.js`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** Vite üretim derlemesi alındığında:
  - `frontend/dist/assets/index-CLd_uMXV.js` -> ~248 kB
  - `frontend/hackaton/dist/assets/index-WhWcECSJ.js` -> ~230 kB
  şeklinde tüm sayfalar (Admin içerik düzenleyicisi dahil) tek bir JavaScript dosyasına paketlenmektedir. Sadece vitrin sitesini gezen bir ziyaretçi dahi admin paneli kodlarını indirmektedir.
- **Kök Neden:** Sayfa bileşenlerinin doğrudan senkron olarak import edilmesi ve Rollup `manualChunks` yapılandırmasının bulunmaması.
- **Adım Adım Ayrıntılı Çözüm:**
  1. `frontend/hackaton/src/App.jsx` içinde sayfa bileşenlerini dinamik import ile tembel yükleyin (`React.lazy`):
     ```jsx
     import { lazy, Suspense } from 'react';
     const Home = lazy(() => import('./pages/Home'));
     const Register = lazy(() => import('./pages/Register'));
     const Schedule = lazy(() => import('./pages/Schedule'));
     const Team = lazy(() => import('./pages/Team'));
     const Admin = lazy(() => import('./pages/Admin'));

     // Render kısmında:
     <Suspense fallback={<div className="loading-spinner" />}>
       <Routes>...</Routes>
     </Suspense>
     ```
  2. `vite.config.js` dosyasına `manualChunks` ekleyin:
     ```javascript
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             vendor: ['react', 'react-dom']
           }
         }
       }
     }
     ```

---

### KATEGORİ 6: Test Kapsamı ve CI/CD (Testing & CI/CD)

#### DEF-21: Challenger Güvenlik Testlerinin Varsayılan `npm test` Dışında Kalması
- **Dosya / Kod Konumu:** `backend/package.json:10`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / Kalite Güvencesi)
- **Sorun Tanımı ve Etkisi:** `backend/package.json` içindeki test komutu:
  ```json
  "test": "node --test --test-concurrency=1 tests/*.test.js"
  ```
  Bu ifade yalnızca `backend/tests/` kökündeki testleri çalıştırmaktadır. `backend/tests/challenger/` altındaki 3 dosyada bulunan **26 adet kritik güvenlik, SQL/NoSQL enjeksiyonu, regex DoS, XSS ve sınır testi** standart `npm test` veya `npm run check` koşumunda ÇALIŞTIRILMAMAKTADIR.
- **Kök Neden:** Challenger testlerinin sonradan eklenmesi ve glob deseninin alt klasörleri kapsayacak şekilde güncellenmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  `backend/package.json` satır 10'daki betiği şu şekilde güncelleyin:
  ```json
  "test": "node --test --test-concurrency=1 tests/*.test.js tests/challenger/*.test.js"
  ```
  Bu sayede `npm.cmd test` veya kök `npm.cmd run check` çalıştırıldığında 26 ek güvenlik testi de otomatik olarak doğrulanacaktır.

---

#### DEF-22: GitHub Actions CI İş Akışının Tek Bir Seri Adımda Çalışması
- **Dosya / Kod Konumu:** `.github/workflows/check.yml:1-20`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** GitHub Actions iş akışı tek bir job altında lint, test, build ve E2E adımlarını ardışık (seri) çalıştırmaktadır. Bir lint hatası saatlerce sürebilecek Playwright adımlarını beklemekte; Playwright tarayıcı ikilileri önbelleğe (cache) alınmadığı için her CI koşumunda yüzlerce megabayt indirme yapılmaktadır.
- **Kök Neden:** İlk CI dosyasının en basit şablonla hazırlanması.
- **Adım Adım Ayrıntılı Çözüm:**
  `.github/workflows/check.yml` dosyasını bağımsız işlere (Jobs) ayırın ve Playwright önbelleklemesi ekleyin:
  ```yaml
  name: CI Check
  on: [push, pull_request]

  jobs:
    lint:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: 'npm' }
        - run: npm ci
        - run: npm run lint

    unit-tests:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: 'npm' }
        - run: npm ci
        - run: npm test

    e2e:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: 22, cache: 'npm' }
        - run: npm ci
        - name: Cache Playwright Browsers
          uses: actions/cache@v4
          with:
            path: ~/.cache/ms-playwright
            key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
        - run: npx playwright install --with-deps chromium
        - run: npm run test:e2e
  ```

---

### KATEGORİ 7: Güvenlik ve Bağımlılık Açıkları (Security & Compliance)

#### DEF-23: Yüksek Seviyeli Bağımlılık Güvenlik Açıkları (`npm audit`)
- **Dosya / Kod Konumu:** `backend/package.json`, `package.json`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High / Sistem Güvenliği)
- **Sorun Tanımı ve Etkisi:** `npm audit --prefix backend` çalıştırıldığında 8 güvenlik açığı (4 high, 4 moderate) raporlanmaktadır:
  1. `mongoose` 9.0.0-9.11.3: Prototip kirlenmesi (`Schema.prototype.virtual()`) ve discriminator anahtarı atlatması (GHSA-wr5m-5jph-8m96, GHSA-6972-9mcm-vhwj).
  2. `multer` 2.0.0-2.4.0: Asenkron dosya filtresi sonrasında istek sonlandırıldığında sunucu çökmesi (DoS) (GHSA-q7qp-rjg7-q26m).
  3. `body-parser` 2.0.0-2.3.0: Sıkıştırılmış istek gövdesi artık baytları ile DoS (GHSA-27r3-jxmh-p828).
  4. `zod` < 4.6.6 & `undici` 8.0.0-8.12.1: Bellek tükenmesi ve HTTP istek kaçakçılığı.
- **Kök Neden:** Paketlerin kilitli sürümlerinin yamalı (patched) sürümlere güncellenmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. Yamalı sürümlere geçiş için paketleri güncelleyin:
     ```bash
     npm.cmd audit fix --prefix backend
     npm.cmd install mongoose@latest multer@latest body-parser@latest --prefix backend
     npm.cmd install zod@latest undici@latest --prefix frontend
     ```
  2. `npm.cmd run check` çalıştırarak hiçbir kırıcı değişiklik olmadığını ve 350 testin başarıyla geçtiğini doğrulayın.

---

#### DEF-24: Canlı Ortamda `CLIENT_URLS` Boş Bırakıldığında Servis Çöküşü
- **Dosya / Kod Konumu:** `backend/src/app.js:33-40`
- **Öncelik / Ciddiyet:** P1 — Orta (Medium)
- **Sorun Tanımı ve Etkisi:** `backend/src/app.js` dosyasında:
  ```javascript
  const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174')
    .split(',').map(value => value.trim()).filter(Boolean);
  ```
  Eğer canlı ortamda (`NODE_ENV=production`) `CLIENT_URLS` tanımlanması unutulursa, kod sessizce `localhost` adreslerine döner. Sonuç olarak canlı alan adından (`https://hackathon.pau.edu.tr`) gelen tüm isteklere CORS `403 Forbidden` yanıtı döner ve tüm sistem erişilemez hale gelir.
- **Kök Neden:** Üretim ortamında zorunlu ortam değişkenleri için erken doğrulama (fail-fast) yapılmaması.
- **Adım Adım Ayrıntılı Çözüm:**
  `backend/src/app.js` satır 35 öncesine şu fail-fast kontrolünü ekleyin:
  ```javascript
  if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URLS && !process.env.CLIENT_URL) {
    throw new Error('Üretim (production) modunda CLIENT_URLS ortam değişkeninin tanımlanması zorunludur.');
  }
  ```

---

### KATEGORİ 8: Dokümantasyon Senkronizasyonu (Documentation)

#### DEF-25: API, Veritabanı ve Kurulum Dokümanlarındaki Bayat Açıklamalar
- **Dosya / Kod Konumu:** `documents/API.md`, `documents/DATABASE.md`, `documents/KURULUM.md`, `documents/MEVCUT_PROJE_DURUMU.md`
- **Öncelik / Ciddiyet:** P0 — Yüksek (High)
- **Sorun Tanımı ve Etkisi:**
  - `API.md`: Sistemde gerçekte **39 HTTP uç noktası** olmasına rağmen "29 uç noktası vardır" demekteydi; şifre sıfırlama (`forgot-password`, `reset-password`), `/ready` ve başvuru durum inceleme API'leri (`PATCH .../status`) belgelenmemişti.
  - `DATABASE.md`: `FormResponse` ve `HackathonApp` modellerindeki `status`, `statusNote`, `reviewedBy` alanları yoktu; `VerificationToken` için hâlâ `Math.random()` kullanıldığı iddia edilmekteydi.
  - `MEVCUT_PROJE_DURUMU.md`: En son commit olan `b4fbf69`'u ve güncel 350 testlik metrikleri içermiyordu.
- **Kök Neden:** Kod geliştirmeleri (`b4fbf69` dahil) hızla tamamlanırken dokümanların eşzamanlı güncellenmemesi.
- **Adım Adım Ayrıntılı Çözüm:**
  1. Milestone 2 kapsamında `documents/API.md` dosyası güncellenmiş; 39 endpoint tablosu, girdi/çıktı JSON şemaları ve Brevo e-posta profilleri eklenmiştir.
  2. `documents/DATABASE.md` dosyası güncellenmiş; `FormResponse`, `HackathonApp`, `User.roleChangeVersion`, `tokenVersion` ve `crypto.randomInt` düzeltmeleri işlenmiştir.
  3. `documents/MEVCUT_PROJE_DURUMU.md` 11 Kasım 2026 tarihine çekilerek `b4fbf69` ve 350 test sayısı belgelenmiştir.
  4. `documents/KURULUM.md` ve kök `README.md` içerisine Windows PowerShell `npm.cmd` yönergeleri eklenmiştir.

---

## 4. Bağımsız Doğrulama ve Test Kapıları

Tüm bu tespit ve öneriler aşağıdaki komutlarla doğrulanabilir:

```powershell
# 1. Kod Standartları ve Lint (0 hata, 0 uyarı beklenir)
npm.cmd run lint

# 2. Katman 1 Birim ve Entegrasyon Testleri (295 test geçer)
npm.cmd test

# 3. Katman 2 Yol Haritası Kabul Kapıları (12/12 yeşil)
npm.cmd run test:roadmap

# 4. Challenger Güvenlik & Stres Testleri (38/38 geçer)
node --test --test-concurrency=1 backend/tests/challenger/*.test.js
npm.cmd exec --prefix frontend -- vitest run tests/challenger/m4-challenge.test.jsx

# 5. Playwright Uçtan Uca Tarayıcı Testleri (4/4 geçer)
npx.cmd playwright test

# 6. Duyarlı Tasarım Yerleşim Kontrolü (1/1 geçer)
npm.cmd run check:layout --prefix frontend/hackaton

# 7. Üretim Derlemeleri (2 Vite build geçer)
npm.cmd run build
```

---

## 5. Sonuç

Bu rehber, GDG On Campus Pamukkale Üniversitesi Web Platformu'nun mevcut durumunu şeffaf bir şekilde ortaya koymakta ve canlıya geçiş sürecinde atılması gereken her adımı somutlaştırmaktadır. Projenin test altyapısı ve fonksiyonel kod kalitesi son derece güçlü olup, bu raporda belirtilen iyileştirmelerin uygulanmasıyla birlikte tam kurumsal olgunluğa erişecektir.
