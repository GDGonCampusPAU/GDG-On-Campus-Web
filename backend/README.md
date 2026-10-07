# Backend

Node.js ve Express tabanlı backend uygulaması.

## Çalıştırma

```bash
npm install
npm start
```

Sunucu varsayılan olarak `3000` portunda çalışır.

## Mevcut Endpoint

```http
GET /api/test
```

Yanıt:

```json
{
  "result": "i m alive"
}
```

## Yapı

```text
src/
├── app.js             # Express uygulaması ve route bağlantıları
├── server.js          # Sunucuyu başlatır
├── controllers/
│   └── test.controller.js # Test endpoint’inin response mantığı
└── routes/
    └── test.routes.js # Test endpoint’i
```
