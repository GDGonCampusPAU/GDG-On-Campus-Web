# GDG On Campus Pamukkale University - Backend API

Google Developer Groups on Campus Pamukkale Üniversitesi web platformu için geliştirilmiş modüler RESTful API servisidir.

Bu backend servisi şu ana alanları destekler:
1. **Public Landing Page:** Etkinlikler ve Duyurular (`/api/v1/content/public`, `/api/v1/content/featured`)
2. **Core Team Administration & CMS:** İçerik Yönetimi ve Ekip Yetkilendirmesi (`/api/v1/auth`, `/api/v1/content`)
3. **Dinamik Form Yönetimi (Google Forms Mantığı):** Her amaca uygun dinamik form oluşturma, soru ekleme/çıkarma, yanıt toplama ve Excel/CSV dışa aktarma (`/api/v1/forms`)
4. **İzole Hackathon Modülü:** Ayrı bir modül olarak tutulan, hackathon bittiğinde tek satırla gizlenebilen veya silinebilen modül (`/api/v1/hackathon`)

---

## 🚀 Teknolojiler (Tech Stack)

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js 5.x
- **Veritabanı:** MongoDB & Mongoose ORM
- **Kimlik Doğrulama:** JWT (JSON Web Tokens) & `bcryptjs`
- **Güvenlik:** `helmet`, `cors`, `express-rate-limit`
- **Dosya Yükleme:** `multer` (Görseller, dinamik form belgeleri ve CV'ler için)
- **Loglama:** `morgan`

---

## 📁 Proje Klasör Mimarisi

```text
/backend
  ├── /src
  │     ├── /config          # Veritabanı bağlantısı (db.js)
  │     ├── /controllers     # Controller katmanı (auth, content, form)
  │     ├── /middleware      # authMiddleware, roleMiddleware, uploadMiddleware, errorHandler
  │     ├── /models          # Mongoose modelleri (User, Content, Form, FormResponse)
  │     ├── /modules         # Bağımsız / İzole modüller
  │     │     └── /hackathon # İzole Hackathon Modülü (models, controllers, routes, index.js)
  │     ├── /routes          # API rotaları (authRoutes, contentRoutes, formRoutes)
  │     ├── /utils           # JWT yardımcısı, girdi doğrulayıcılar, seed scripti
  │     ├── app.js           # Express uygulama yapılandırması
  │     └── server.js        # Uygulama başlangıç ve dinleme noktası
  ├── /uploads               # Yüklenen medya, CV ve form dosyaları
  ├── .env                   # Ortam değişkenleri (gizli)
  ├── .env.example           # Örnek ortam değişkenleri şablonu
  ├── package.json           # Bağımlılıklar ve npm scriptleri
  └── README.md              # Dokümantasyon
```

---

## ⚙️ Kurulum ve Çalıştırma

### 1. Bağımlılıkları Yükleyin
```bash
cd backend
npm install
```

### 2. Ortam Değişkenlerini Ayarlayın
`.env.example` dosyasını kopyalayarak `.env` oluşturun:
```bash
cp .env.example .env
```

Örnek `.env` içeriği:
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/gdg_pau
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development

# Hackathon modülü bittiğinde false yaparak API'yi gizleyebilirsiniz
ENABLE_HACKATHON_MODULE=true

# Seed Admin Bilgileri
DEFAULT_ADMIN_NAME=GDG Admin
DEFAULT_ADMIN_EMAIL=admin@pau.edu.tr
DEFAULT_ADMIN_PASSWORD=Admin123456!
```

### 3. Başlangıç Verilerini (Seed) Yükleyin
Varsayılan **ADMIN** kullanıcısını, örnek etkinlikleri ve **Hackathon Başvuru Formu Şablonunu** yüklemek için:
```bash
npm run seed
```
> **Varsayılan Yönetici Bilgileri:**  
> - **E-posta:** `admin@pau.edu.tr`  
> - **Şifre:** `Admin123456!`  
> - **Rol:** `ADMIN`

### 4. Sunucuyu Başlatın
- **Geliştirme Modu (Hot Reload):** `npm run dev`
- **Prodüksiyon Modu:** `npm start`

---

## 📋 Dinamik Form Yönetimi (Google Forms Mantığı)

Formlar tamamen dinamiktir. Her türlü etkinlik kaydı, geri bildirim anketi, hackathon başvurusu vb. için soru ekleyip çıkarabilir, sıralayabilir ve yanıtları Excel/CSV olarak indirebilirsiniz.

### Desteklenen Soru Tipleri (`fields[].type`):
- `text`: Kısa metin
- `textarea`: Uzun metin
- `number`: Sayısal değer (min/max doğrulama destekli)
- `email`: E-posta formatı doğrulamalı
- `phone`: Telefon numarası
- `select`: Açılır liste (dropdown)
- `radio`: Tekli seçim
- `checkbox`: Çoklu seçim
- `file`: Dosya / CV / Belge yükleme (PDF, DOCX, ZIP, Resim)
- `date`: Tarih seçici

### Form Rotaları (`/api/v1/forms`)

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/forms/public/:slugOrId` | Herkese Açık | Aktif formu ve soru şemasını getirir |
| `POST` | `/api/v1/forms/public/:slugOrId/submit` | Herkese Açık | Form yanıtı gönderir (Dosya yükleme destekli: `multipart/form-data`) |
| `GET` | `/api/v1/forms` | `ORGANIZER`, `ADMIN` | Tüm formları listeler |
| `POST` | `/api/v1/forms` | `ORGANIZER`, `ADMIN` | Yeni form ve soru listesi oluşturur |
| `GET` | `/api/v1/forms/:id` | `ORGANIZER`, `ADMIN` | Form detayını ve soru şemasını getirir |
| `PUT` | `/api/v1/forms/:id` | `ORGANIZER`, `ADMIN` | Formu ve sorularını günceller |
| `PATCH`| `/api/v1/forms/:id/status` | `ORGANIZER`, `ADMIN` | Durumu günceller (`DRAFT`, `PUBLISHED`, `CLOSED`, `ARCHIVED`) |
| `DELETE`| `/api/v1/forms/:id` | `ORGANIZER`, `ADMIN` | Formu ve ilişkili yanıtlarını siler |
| `GET` | `/api/v1/forms/:id/responses` | `ORGANIZER`, `ADMIN` | Form yanıtlarını listeler |
| `GET` | `/api/v1/forms/:id/responses/export` | `ORGANIZER`, `ADMIN` | Yanıtları her soru bir sütun olacak şekilde CSV veya JSON olarak indirir (`?format=csv` veya `?format=json`) |

---

## 🧩 İzole Hackathon Modülü (`/src/modules/hackathon`)

Hackathon işlemleri ana kod tabanından tamamen ayrı bir klasörde (`src/modules/hackathon/`) tutulmaktadır.

- **Geçici Olarak Gizleme:** `.env` dosyasına `ENABLE_HACKATHON_MODULE=false` yazıldığında hackathon API rotaları otomatik olarak kapanır.
- **Tamamen Silme / Kaldırma:** Hackathon bittiğinde `src/modules/hackathon/` klasörü doğrudan silinebilir.

### Hackathon Uç Noktaları (`/api/v1/hackathon`)

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/hackathon/send-verification` | Herkese Açık | Takım lideri e-posta adresine Brevo ile 6 haneli doğrulama kodu gönderir |
| `POST` | `/api/v1/hackathon/apply` | Herkese Açık | Hackathon başvuru formu gönderme (**`verificationCode` zorunludur**, CV destekli) |
| `GET` | `/api/v1/hackathon/applications` | `ORGANIZER`, `ADMIN` | Başvuruları listeleme |
| `GET` | `/api/v1/hackathon/applications/export` | `ORGANIZER`, `ADMIN` | Başvuruları CSV/JSON dışa aktarma |

---

## 🔒 Kimlik Doğrulama & 2FA / E-posta Doğrulama (`/api/v1/auth`)

Core Team kayıtlarında ve hesap güvenliğinde Brevo destekli 6 haneli OTP kodu kullanılır:

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/send-otp` | Herkese Açık | Kayıt öncesi e-postaya 6 haneli doğrulama kodu gönderir |
| `POST` | `/api/v1/auth/register` | Herkese Açık | Doğrulama koduyla (`code`) güvenli kayıt tamamlama |
| `POST` | `/api/v1/auth/verify-email` | Herkese Açık | Mevcut bekleyen hesabı kod ile doğrulama |
| `POST` | `/api/v1/auth/login` | Herkese Açık | Giriş yapma ve JWT alma (E-posta doğrulaması ve yönetici onayı şarttır) |
| `GET` | `/api/v1/auth/me` | Giriş Yapmış | Kullanıcı profil bilgileri |

---

## 📰 İçerik ve Etkinlik Yönetimi (`/api/v1/content`)

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/content/public` | Herkese Açık | Sayfalamalı ve filtreli etkinlik/duyuru listesi |
| `GET` | `/api/v1/content/featured` | Herkese Açık | Anasayfa slider'ı için öne çıkanlar |
| `POST` | `/api/v1/content` | `ORGANIZER`, `ADMIN` | Yeni içerik ekleme (Görsel yükleme destekli: `coverImage`) |
| `PUT` | `/api/v1/content/:id` | `ORGANIZER`, `ADMIN` | İçerik güncelleme |
| `DELETE`| `/api/v1/content/:id` | `ORGANIZER`, `ADMIN` | İçerik silme |
