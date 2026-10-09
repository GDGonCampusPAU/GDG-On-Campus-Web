# GDG ON CAMPUS PAMUKKALE UNIVERSITY WEB SİTESİ
> **Proje Raporu, Teknik Mimari ve Geliştirici Kılavuzu**  
> **Sürüm:** v2.1  

---

## 1. MEVCUT BACKEND NEYE GÖRE TASARLANDI?
*(Mevcut Durum Analizi)*

Şu an ajana yazdırdığımız **Node.js + Express + MongoDB** tabanlı Backend yapısı şu temel mantıklar üzerine kurgulanmıştır:

* 📅 **Etkinlik & Duyurular:** *Manuel Girdi + Bevy Linki Mantığı*  
  Yönetim ekibi panellerinden etkinliğin başlığını, görselini ve Bevy sayfa linkini manuel olarak girer. `isFeatured: true` işaretlenen içerikler otomatik olarak anasayfadaki slayt alanına düşer.

* 🔐 **Core Team & Onay:** *Kayıt Var + Admin Onayı Mantığı*  
  Kullanıcılar `@pau.edu.tr` veya `@gmail.com` adresiyle kayıt olabilirler; ancak ilk kaydolduklarında durumları **`PENDING` (Beklemede)** olur. Ana admin onaylamadan yönetim paneline giremezler.

* 🚀 **Hackathon & Dosya Yükleme:** *Veritabanı Kaydı + PDF/Resume Yükleme Mantığı*  
  Kullanıcı başvuru formunu doldurduğunda veriler MongoDB veritabanına kaydedilir. İsterse başvuruya PDF CV/özgeçmiş dosyası yükleyebilir (`multer` middleware ile). Yönetim ekibi başvuruları hem panelde listeleyebilir hem de `.csv` veya `.json` formatında bilgisayarına indirebilir.

---

## 2. KARAR VE MİMARİ OPSİYONLARI
*(A, B, C Seçenekleri)*

Projenin gidişatına ve ekibin tercihlerine göre uygulanabilecek esnek opsiyonlar aşağıda detaylandırılmıştır:

### ⚙️ Opsiyon 1: Etkinlik Verilerinin Yönetimi

| Seçenek | Mimari Yapı | Açıklama / Avantaj |
| :--- | :--- | :--- |
| **Seçenek A** | **Mevcut Backend Yapısı** *(Manuel + Bevy Linki)* | Etkinlikler Core Team panelinden manuel girilir, afiş yüklenir ve harici Bevy etkinlik linki eklenir. Tıklayınca Bevy'e gider. *(En hızlı ve pratik yöntem)* |
| **Seçenek B** | **Bevy API Entegrasyonu** | Etkinlikler siteden hiç girilmez; Bevy API'sine bağlanılarak resmi GDG sayfasındaki etkinlikler otomatik çekilir. *(Panel yükünü azaltır ancak Bevy API izni gerektirir)* |
| **Seçenek C** | **Tamamen İç Etkinlik Sistemi** | Bevy yönlendirmesi olmadan; tüm etkinlik detayları, bilet alma ve kayıt süreçleri doğrudan bu web sitesi üzerinden yürütülür. |

### 👥 Opsiyon 2: Core Team Kullanıcı Yönetimi ve Kayıt

| Seçenek | Mimari Yapı | Açıklama / Avantaj |
| :--- | :--- | :--- |
| **Seçenek A** | **Mevcut Backend Yapısı** *(Onaylı Kayıt)* | Kayıt formu açıktır, ancak kaydolan `PENDING` statüsüne düşer. Admin onaylamadan paneli göremez. *(Güvenli ve esnek)* |
| **Seçenek B** | **Kayıt Ekranı Yok** *(Seed / DB Ekleme)* | Sitede hiç `register` (kayıt) ekranı olmaz. Core Team hesapları veritabanına doğrudan yüklenir veya admin tarafından panel içinden açılır. |
| **Seçenek C** | **Açık ve Kısıtsız Kayıt** | Belli e-posta uzantılarına (`@posta.pau.edu.tr`) sahip herkes kaydolduğu an paneli doğrudan kullanabilir. |

### 📝 Opsiyon 3: Hackathon Başvuru ve Dosya Yönetimi

| Seçenek | Mimari Yapı | Açıklama / Avantaj |
| :--- | :--- | :--- |
| **Seçenek A** | **Mevcut Backend Yapısı** *(Form + PDF Yükleme)* | Başvuruda hem metinsel veriler alınır hem de katılımcı PDF CV yükleyebilir. Veriler veritabanına, dosyalar sunucuya/buluta kaydedilir. |
| **Seçenek B** | **Sadece Metin** *(Dosya Yüklemesiz)* | PDF yükleme kısmı kaldırılır; sadece Drive/LinkedIn linki istenebilir. Veritabanında hafiflik sağlar. |
| **Seçenek C** | **Dış Form Entegrasyonu** *(Google Forms / Tally)* | Başvuru sitede tutulmaz, kullanıcı doğrudan Google Forms'a yönlendirilir. Core Team panelinde sadece link paylaşılır. |

### 💻 Opsiyon 4: Frontend Teknoloji Tercihi

| Seçenek | Teknolojiler | Öne Çıkan Özelliği |
| :--- | :--- | :--- |
| **Seçenek A** | **React + Vite + Tailwind CSS** | Hafif, çok hızlı ve modüler. Ekip için öğrenme eğrisi en düşük kombinasyon. *(Önerilen)* |
| **Seçenek B** | **React + Material-UI (MUI)** | Google Material Design 3 bileşenlerini hazır sunduğu için GDG konseptine ve Google Sites havasına en uygun yapı. |
| **Seçenek C** | **Next.js App Router** | SEO uyumu ve performans öncelikli mimari. |

---

## 3. PROJE KAPSAMI VE SİTE SAYFALARI
*(Faz 1)*

### 🌐 1. Ana Sayfa *(Landing Page)*
* **Üst Navigasyon Barı:** Sekmeli (*Tabs*) gezinme yapısı.
* **Güncel Etkinlik Slaytı:** Opsiyon 1/A veya 1/B ile gelen veriyi gösterir, Bevy yönlendirmelidir.
* **Geçmiş Etkinlikler & Duyurular:** `/api/v1/content/public` uç noktası üzerinden çekilen içerik listesi.

### 🔐 2. Core Team Giriş ve Kayıt Sayfası
* Seçilen **Opsiyon 2** kararına göre `Login` ve/veya `Register` ekranları.

### 🛠️ 3. Core Team Yönetim Paneli *(Admin Dashboard)*
* **İçerik Yönetimi:** Etkinlik ve duyuru CRUD (*Ekle/Sil/Güncelle*) ekranı.
* **Başvuru Yönetimi:** Hackathon başvuru listeleme ve `.excel` / `.csv` formatında indirme ekranı.

### 🚀 4. Hackathon Özel Sayfası
* Hackathon detayları, jüri/ödül bilgileri ve Seçilen **Opsiyon 3** kararına göre başvuru formu.

> **📌 Gelecek Özellik (Faz 2):** Ekip içi görev takibi ve canlı **Scoreboard / Yarışma** sayfası.

---

## 4. MARKA VE TASARIM STANDARTLARI
*(GDG BRAND GUIDELINES)*
*Brand guide'ların drive'dan kopyalanıp, başka bir drive'a alınıp burada isimlendirmelerin yapılması gerekiyor. Frontend geliştirmesinin başlaması için bu gerekli.*

* **Topluluk Resmi Adı:** `Google Developer Groups on Campus Pamukkale University` veya `GDGoC Pamukkale University`.
* **Unvan Standardı:** `GDG Organizer` veya `GDGoC Organizer` *(Lead unvanı kullanılmaz)*.
* **Tipografi:** 
  * Primary: **Google Sans** *(Ana metinler, başlıklar)*
  * Secondary: **Google Sans Mono** *(Kodlar, tarihler, rozetler)*
  * *Font dosyaları `/public/fonts/` dizininde yer almaktadır.*
* **Renk Paleti (Color Tokens):**
  * 🔵 **Blue:** `#4285F4`
  * 🟢 **Green:** `#34A853`
  * 🟡 **Yellow:** `#F9AB00`
  * 🔴 **Red:** `#EA4335`
  * ⬛ **Dark Surface (Black 02):** `#1E1E1E`
* **UI Kart Yapıları:** Çentikli klasör kartları (*Notched folder-shaped containers*), çizgisel geometri desenleri (*Line art / brackets*).

---

## 5. FRONTEND AI AGENT SYSTEM INSTRUCTIONS (`README.md`)

```markdown
# AI Agent Instructions - GDG On Campus Pamukkale University Frontend

You are an AI Coding Agent tasked with building the React frontend for GDG On Campus Pamukkale University.

## 1. Design Rules & Assets
- **Name:** "Google Developer Groups on Campus Pamukkale University"
- **Fonts:** 'Google Sans' (main) and 'Google Sans Mono' (code/badges) loaded from `/public/fonts/`.
- **Colors:** 
  - Primary Blue: `#4285F4`
  - Green: `#34A853`
  - Yellow: `#F9AB00`
  - Red: `#EA4335`
  - Dark Surface: `#1E1E1E`
- **Style:** Google Sites style with notched folder cards and line-art elements.

## 2. API Integration (Node.js Backend)
- **Base URL:** `http://localhost:5000/api/v1`
- **Public Events/Announcements:** 
  - `GET /content/public`
  - `GET /content/featured`
- **Auth Endpoints:** 
  - `POST /auth/login`
  - `POST /auth/register`
  - *Header requirement:* `Authorization: Bearer <token>`
- **Admin CMS:** 
  - `POST /content`
  - `PUT /content/:id`
  - `DELETE /content/:id`
- **Hackathon:** 
  - `POST /hackathon/apply` (Supports optional resume PDF upload)
  - `GET /hackathon/applications`