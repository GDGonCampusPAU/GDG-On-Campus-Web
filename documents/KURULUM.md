# Kurulum ve yapılandırma

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Güncelleme: 12 Ekim 2026 — `feature/participant-verification` çalışma ağacı. Katılımcı doğrulaması ve testler dahil.

### Yerel geliştirme akışı

MongoDB replica set veya Atlas gerekir. Standalone bağlantı startup’ta reddedilir. Yerel Docker kurulumu ve kernel uyumsuzluğu çözümü [katılımcı rehberinde](KATILIMCI_DOGRULAMA.md) yer alır. Mevcut `.env` dosyanızı örnek dosyayla ezmeyin; yalnız ilk kurulumda kopyalayın.

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

Backend komutları: `npm start`, `npm run dev`, `npm run seed`, `npm test`. Frontend komutları: `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`.

### Ortam değişkenleri

| Değişken | Mevcut varsayılan / davranış |
| --- | --- |
| `PORT` | `5000` |
| `MONGO_URI` | `.env.example`: `mongodb://localhost:27017/gdg_pau?replicaSet=rs0`; yerel Docker için `mongodb://127.0.0.1:27017/gdg_pau?replicaSet=rs0&directConnection=true`. db.js fallback’i standalone URI olsa da server topology kontrolü bunu reddeder. |
| `JWT_SECRET` | Ekip token anahtarı. Eski ekip JWT helper’ında fallback vardır; ancak startup katılımcı yapılandırması gerçek PARTICIPANT_JWT_SECRET veya JWT_SECRET ister. İki anahtarı da açıkça güçlü değerlerle ayarlayın. |
| `JWT_EXPIRES_IN` | `7d`; ekip token süresi |
| `PARTICIPANT_JWT_SECRET` | Boşsa JWT_SECRET; katılımcı imzası ve OTP hash’i için kullanılır |
| `PARTICIPANT_JWT_EXPIRES_IN` | `1h`; ör. 30s, 15m, 2h, 1d; en az bir saniye |
| `PARTICIPANT_OTP_TTL_MINUTES` | `10`; pozitif tam sayı |
| `PARTICIPANT_OTP_COOLDOWN_SECONDS` | `60`; pozitif tam sayı |
| `PARTICIPANT_OTP_MAX_ATTEMPTS` | `5`; pozitif tam sayı |
| `GOOGLE_CLIENT_ID` | OAuth Web client ID; yoksa Google endpoint’i 503, e-posta yöntemi kullanılabilir |
| `CLIENT_URL` | `http://localhost:5173`; tek CORS origin'i |
| `NODE_ENV` | Log, hata stack'i davranışını etkiler; üretim için `production` |
| `BREVO_API_KEY` | Geliştirmede eksik/örnek anahtar konsol simülasyonu; production katılımcı OTP endpoint’i 503 ile reddeder. Eski ekip/hackathon servisi hâlâ simülasyona düşebilir. |
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

Örnek dosya `backend/.env.example`, çalışma dosyası `backend/.env` olmalıdır; `npm run dev` komutunu backend dizininde çalıştırın. `src/.env.example` veya kopya örnek dosyalar bu akışta dotenv tarafından okunmaz.

### Token süreleri

Env değişikliklerinden sonra backend’i yeniden başlatın. Süre ayarı yalnızca yeni token’ların exp değerini etkiler; eski token kendi süresine kadar geçerlidir. Katılımcı imza anahtarını değiştirmeniz eski katılımcı token’larını ve bekleyen OTP hash’lerini geçersiz kılar. Refresh token yoktur.

### Manuel test ve CORS

```bash
cd backend/tools
python3 -m http.server 5173 --bind 127.0.0.1
```

Tarayıcıda `http://localhost:5173/participant-auth.html` açın. Varsayılan CLIENT_URL ile bu adres eşleşir. `http://127.0.0.1:5173` farklı origin’dir; bu adresi tercih ederseniz CLIENT_URL’yi tam bu değer yapıp backend’i yeniden başlatın. CLIENT_URLS/virgüllü liste desteği şu an yoktur. Frontend ve test aracı aynı portu aynı anda kullanamaz.

Google Cloud Authorized JavaScript origins, sayfanın gerçek origin’ini içermeli; `/participant-auth.html` yolu origin değildir. Backend GOOGLE_CLIENT_ID ve test sayfası Client ID’si aynı Web client’a ait olmalı. Ayrıntılar ve 401/201/409 senaryoları [test rehberinde](KATILIMCI_DOGRULAMA.md).

Testler `npm test` ile geçici replica set açar; mevcut `.env` veya DB kullanılmaz. MongoDB test binary’si ilk çalıştırmada indirilebilir.
