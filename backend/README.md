# GDG On Campus Pamukkale University — Backend

Node.js / Express / Mongoose API. Ekip hesaplarıyla içerik/form yönetimi, ayrı katılımcı Google/e-posta doğrulaması ve hackathon başvuruları sağlar. Bu belge `feature/participant-verification` çalışma ağacına göre 12 Ekim 2026 tarihinde güncellendi.

## Kurulum

MongoDB replica set veya Atlas bağlantısı gerekir. Standalone MongoDB startup’ta reddedilir. Yalnız ilk kurulumda `.env.example` dosyasını `.env` olarak kopyalayın; mevcut `.env` dosyanızı ezmeyin.

```bash
cd backend
npm ci
cp .env.example .env
# Gerçek imza anahtarlarını ve replica set bağlantısını düzenleyin.
npm run dev
```

Yerel Docker URI örneği:

```env
MONGO_URI=mongodb://127.0.0.1:27017/gdg_pau?replicaSet=rs0&directConnection=true
JWT_EXPIRES_IN=7d
PARTICIPANT_JWT_EXPIRES_IN=1h
PARTICIPANT_OTP_TTL_MINUTES=10
CLIENT_URL=http://localhost:5173
```

JWT_SECRET ve tercihen ayrı PARTICIPANT_JWT_SECRET güçlü değerler olmalı. GOOGLE_CLIENT_ID Google OAuth Web client’ıdır; client secret kullanılmaz. Brevo eksikse geliştirmede konsol simülasyonu yapılır, production katılımcı OTP isteği 503 döner. Tam ayarlar [.env.example](.env.example) ve [kurulum rehberinde](../documents/KURULUM.md).

## Kullanım ve test

- API kökü: `http://localhost:5000/api/v1`; kök health `/health`.
- Ekip `/auth/login` token’ı yönetim içindir. Katılımcı `/participant-auth/email/verify` veya `/participant-auth/google` token’ı form submit içindir; birbirinin yerine geçmez.
- Form GET public; submit varsayılan doğrulama ister. Yanıt + sayaç transaction içinde kaydedilir. Form ayarıyla tek katılımcı/tek başvuru uygulanır.
- Özel hackathon modülü eski lider OTP’siyle ayrı başvuru havuzu kullanır. ENABLE_HACKATHON_MODULE=false bu rotaları kapatır; klasörü doğrudan silmek import’ları kırar.
- `npm start`, `npm run dev`, `npm run seed`, `npm test` script’leri vardır. Seed admin emailVerified olmadığından ilk giriş sonrası ekip email doğrulaması gerekebilir.

```bash
npm test
```

20 otomatik test önceki çalıştırmada geçti. Testler geçici replica set kullanır; gerçek Google/Brevo ve browser CORS ayrı manuel doğrulanmalı.

Manuel araçlar [tools/participant-flow.http](tools/participant-flow.http) ve [tools/participant-auth.html](tools/participant-auth.html). HTML’i `tools` dizininde `python3 -m http.server 5173 --bind 127.0.0.1` ile sunup **http://localhost:5173/participant-auth.html** adresinden açın. CLIENT_URL farklıysa tam origin eşleşmeli; localhost ve 127.0.0.1 aynı değildir. Araçlar Express tarafından sunulmaz, ürün frontend’i değildir.

## Dokümantasyon

- [Mevcut proje durumu](../documents/MEVCUT_PROJE_DURUMU.md)
- [Katılımcı doğrulaması ve ayrıntılı test rehberi](../documents/KATILIMCI_DOGRULAMA.md)
- [API uç noktaları ve istek örnekleri](../documents/API.md)
- [Mimari](../documents/architecture.md), [veritabanı](../documents/DATABASE.md)
- [Güvenlik/dosyalar](../documents/GUVENLIK_VE_DOSYALAR.md), [kalan sorunlar](../documents/SORUNLAR.md)
