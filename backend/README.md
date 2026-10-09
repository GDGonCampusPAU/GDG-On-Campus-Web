# GDG On Campus Pamukkale University - Backend API

Google Developer Groups on Campus Pamukkale Üniversitesi web platformu için geliştirilmiş RESTful API servisidir.

Bu backend servisi 3 ana frontend alanını destekler:
1. **Public Landing Page:** Etkinlikler ve Duyurular (`/api/v1/content/public`, `/api/v1/content/featured`)
2. **Core Team Administration & CMS:** İçerik Yönetimi ve Ekip Yetkilendirmesi (`/api/v1/auth`, `/api/v1/content`)
3. **Hackathon Management:** Başvuru toplama, listeleme ve CSV/JSON dışa aktarma (`/api/v1/hackathon`)

---

## 🚀 Teknolojiler (Tech Stack)

- **Runtime:** Node.js (v18+)
- **Framework:** Express.js 5.x
- **Veritabanı:** MongoDB & Mongoose ORM
- **Kimlik Doğrulama:** JWT (JSON Web Tokens) & `bcryptjs`
- **Güvenlik:** `helmet`, `cors`, `express-rate-limit`
- **Dosya Yükleme:** `multer` (Resimler ve CV/özgeçmiş belgeleri için)
- **Loglama:** `morgan`

---

## 📁 Proje Klasör Mimarisi

```text
/backend
  ├── /src
  │     ├── /config          # Veritabanı bağlantısı (db.js)
  │     ├── /controllers     # Controller katmanı (auth, content, hackathon)
  │     ├── /middleware      # authMiddleware, roleMiddleware, uploadMiddleware, errorHandler
  │     ├── /models          # Mongoose modelleri (User, Content, HackathonApp)
  │     ├── /routes          # API rotaları (authRoutes, contentRoutes, hackathonRoutes)
  │     ├── /utils           # JWT yardımcısı, girdi doğrulayıcılar, seed scripti
  │     ├── app.js           # Express uygulama yapılandırması
  │     └── server.js        # Uygulama başlangıç ve dinleme noktası
  ├── /uploads               # Yüklenen medya ve CV dosyaları
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

# Seed Admin Bilgileri
DEFAULT_ADMIN_NAME=GDG Admin
DEFAULT_ADMIN_EMAIL=admin@pau.edu.tr
DEFAULT_ADMIN_PASSWORD=Admin123456!
```

### 3. Başlangıç Verilerini (Seed) Yükleyin
Varsayılan **ADMIN** kullanıcısını ve örnek etkinlik/duyuruları oluşturmak için:
```bash
npm run seed
```
> **Varsayılan Yönetici Bilgileri:**  
> - **E-posta:** `admin@pau.edu.tr`  
> - **Şifre:** `Admin123456!`  
> - **Rol:** `ADMIN`

### 4. Sunucuyu Başlatın
- **Geliştirme Modu (Hot Reload):**
  ```bash
  npm run dev
  ```
- **Prodüksiyon Modu:**
  ```bash
  npm start
  ```

Sunucu varsayılan olarak `http://localhost:5000` adresinde çalışacaktır.

---

## 🔒 Kimlik Doğrulama & Yetkilendirme Mekanizması

1. **Kayıt (`POST /api/v1/auth/register`):**
   - E-posta yalnızca `@pau.edu.tr`, `@posta.pau.edu.tr` veya `@gmail.com` uzantılı olabilir.
   - Yeni kaydolan kullanıcılara varsayılan olarak `PENDING` rolü verilir.
2. **Giriş (`POST /api/v1/auth/login`):**
   - Rolü `PENDING` olan kullanıcılar giriş yapamaz (`403 Forbidden - Account awaiting admin approval`).
   - Yönetici tarafından rolü `ORGANIZER` veya `ADMIN` yapılan kullanıcılar JWT token alır.
3. **Korumalı Uç Noktalar:**
   - İstek başlığında (Header) `Authorization: Bearer <TOKEN>` gönderilmelidir.

---

## 📡 API Uç Noktaları (Endpoints)

### 1. Kimlik Doğrulama (`/api/v1/auth`)

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/register` | Herkese Açık | Yeni kullanıcı kaydı (`PENDING` rolü ile) |
| `POST` | `/api/v1/auth/login` | Herkese Açık | Giriş yapma ve JWT token alma |
| `GET` | `/api/v1/auth/me` | Giriş Yapmış | Mevcut kullanıcının profil bilgileri |

#### Örnek Kayıt İsteği:
```json
POST /api/v1/auth/register
{
  "fullName": "Ahmet Yılmaz",
  "email": "ahmet@posta.pau.edu.tr",
  "password": "Password123!"
}
```

---

### 2. İçerik ve Etkinlik Yönetimi (`/api/v1/content`)

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/content/public` | Herkese Açık | Sayfalamalı ve filtreli etkinlik/duyuru listesi (`?page=1&limit=10&type=EVENT&search=ai`) |
| `GET` | `/api/v1/content/featured` | Herkese Açık | Anasayfa slider'ı için öne çıkan etkinlikler (`isFeatured: true`) |
| `POST` | `/api/v1/content` | `ORGANIZER`, `ADMIN` | Yeni etkinlik/duyuru ekleme (Resim yükleme destekli: `coverImage`) |
| `PUT` | `/api/v1/content/:id` | `ORGANIZER`, `ADMIN` | İçerik güncelleme |
| `DELETE`| `/api/v1/content/:id` | `ORGANIZER`, `ADMIN` | İçerik silme |

#### Örnek İçerik Ekleme İsteği (`POST /api/v1/content`):
```json
{
  "title": "Flutter ile Mobil Uygulama Geliştirme",
  "description": "Sıfırdan ileri seviyeye Flutter workshop serimiz başlıyor.",
  "coverImageUrl": "https://example.com/banner.png",
  "bevyLink": "https://gdg.community.dev/events/details/...",
  "isFeatured": true,
  "type": "EVENT",
  "eventDate": "2026-11-15T14:00:00.000Z"
}
```
*(Ayrıca `multipart/form-data` formatında `coverImage` dosyası yüklenerek de oluşturulabilir.)*

---

### 3. Hackathon Başvuruları (`/api/v1/hackathon`)

| Metot | Uç Nokta | Yetki | Açıklama |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/hackathon/apply` | Herkese Açık | Hackathon başvuru formu gönderme (CV yükleme destekli: `resume`) |
| `GET` | `/api/v1/hackathon/applications` | `ORGANIZER`, `ADMIN` | Tüm başvuruları listeleme (Sayfalama ve arama destekli) |
| `GET` | `/api/v1/hackathon/applications/export` | `ORGANIZER`, `ADMIN` | Başvuruları indirme (`?format=csv` veya `?format=json`) |

#### Örnek Başvuru İsteği (`POST /api/v1/hackathon/apply`):
```json
{
  "teamName": "Algoritma Ustaları",
  "leaderName": "Zeynep Kaya",
  "leaderEmail": "zeynep@gmail.com",
  "leaderPhone": "+90 555 123 4567",
  "memberCount": 4,
  "projectIdea": "Yapay zeka tabanlı kampüs içi akıllı enerji tasarrufu sistemi.",
  "resumeUrl": "https://linkedin.com/in/zeynep-kaya"
}
```

---

## 🛡️ Hata Yakalama & Güvenlik
- **Hata Formatı:** Tüm hatalar standart `{ success: false, message: "Hata mesajı" }` JSON formatında döner.
- **Rate Limit:** API uç noktaları DDoS ve kaba kuvvet (brute force) saldırılarına karşı `express-rate-limit` ile korunmaktadır.
- **Dosya Doğrulama:** Yüklenen dosyalar uzantı ve MIME tiplerine göre doğrulanır (Resimler için maks 5MB, PDF/CV için maks 10MB).

