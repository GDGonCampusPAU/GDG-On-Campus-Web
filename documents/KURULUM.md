# Kurulum ve yapılandırma

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Kaynak kod incelemesi: 11 Ekim 2026, sürüm `d218156`. Canlı API ve veritabanı testi yapılmadı. Belgelerin ayrılması: 12 Ekim 2026.

### Yerel geliştirme akışı

MongoDB'nin ayrıca çalışıyor olması gerekir. Aşağıdaki komutlar kılavuzdur; incelemede çalıştırılmadı.

```bash
cd backend
npm ci
cp .env.example .env
# .env içindeki bağlantı, JWT ve e-posta ayarlarını düzenleyin.
npm run dev
```

İkinci terminal:

```bash
cd frontend
npm install
npm run dev
```

Backend varsayılan portu `5000`; CORS'un varsayılan frontend origin'i `http://localhost:5173`. Vite'ta API proxy'si tanımlı değil. Frontend bağlantısı geliştirildiğinde base URL ayrıca tanımlanmalı; mevcut kodda `VITE_API_URL` kullanan bir yapı yok.

Backend komutları: `npm start`, `npm run dev`, `npm run seed`. Frontend komutları: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

### Ortam değişkenleri

| Değişken | Mevcut varsayılan / davranış |
| --- | --- |
| `PORT` | `5000` |
| `MONGO_URI` | `mongodb://localhost:27017/gdg_pau` |
| `JWT_SECRET` | Yoksa kodda sabit geliştirme anahtarına düşer; üretim öncesi zorunlu hale getirilmeli |
| `JWT_EXPIRES_IN` | `7d` |
| `CLIENT_URL` | `http://localhost:5173`; tek CORS origin'i |
| `NODE_ENV` | Log, hata stack'i davranışını etkiler; üretim için `production` |
| `BREVO_API_KEY` | Yoksa veya örnek değer kalırsa gerçek e-posta yerine konsola simülasyon |
| `BREVO_SENDER_EMAIL` | `noreply@pau.edu.tr` |
| `BREVO_SENDER_NAME` | `GDG On Campus Pamukkale University` |
| `BREVO_REPLY_TO` | İsteğe bağlı; serviste var, `.env.example` içinde yok |
| `ENABLE_HACKATHON_MODULE` | Yalnızca tam olarak `false` metni modülü kapatır; yoksa açık |
| `DEFAULT_ADMIN_NAME` | Seed admin adı; script fallback'i `GDG PAU Admin` |
| `DEFAULT_ADMIN_EMAIL` | Seed e-postası; fallback `admin@pau.edu.tr` |
| `DEFAULT_ADMIN_PASSWORD` | Seed parolası; örnek/sabit değer üretimde kullanılmamalı |

### Seed'in gerçek davranışı

`npm run seed` aynı e-posta yoksa ADMIN oluşturur; tüm içerik koleksiyonu boşsa üç örnek içerik; tüm form koleksiyonu boşsa `hackathon-2026-basvuru` slug'lı yayınlanmış dinamik form oluşturur. Koleksiyonları temizlemez. Mevcut adminin parolasını, rolünü veya doğrulama durumunu düzeltmez.

**Önemli hata:** Oluşturulan ADMIN'de `isEmailVerified: true` set edilmiyor. Model varsayılanı `false` olduğu için seed sonrası ilk login `403` ve e-posta doğrulama isteği üretir. Mevcut adminin giriş yapabilmesi için gerçek OTP doğrulama akışı tamamlanmalı veya seed mantığı düzeltilmeli. Seed ayrıca parolayı konsola yazıyor.

Dinamik hackathon formunun başarı mesajında e-postayla bilgilendirme sözü var; bu formun submit controller'ı e-posta göndermez.
