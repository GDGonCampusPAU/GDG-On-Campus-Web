# GDG PAU API

Node 24, Express ve MongoDB replica set/Atlas kullanır. Kök dizindeki `npm run setup` bütün uygulamaları kurar. Backend tek başına `npm ci`, `npm test`, `npm start` veya `npm run dev` ile çalışır; repo lint araçları kök kurulumdan gelir.

İlk kurulumda `.env.example` dosyasını `.env` olarak kopyalayın; mevcut ayarları ezmeyin. `JWT_SECRET` en az 32 karakterlik özel bir anahtar olmalı. `PARTICIPANT_JWT_SECRET` için de ayrı güçlü anahtar önerilir. Anahtar üretmek için `openssl rand -hex 32` kullanılabilir. MongoDB standalone bağlantısı kabul edilmez. Kök dizindeki Compose, yeni yerel geliştirme veritabanı için replica set kurar; mevcut veritabanı/volume üzerinde çalıştırmak gerekmez.

- API: `http://localhost:5000/api/v1`; `/health` süreç canlılığını, `/ready` DB bağlantısını bildirir.
- `CLIENT_URLS=http://localhost:5173,http://localhost:5174` iki ön yüze izin verir. Eski `CLIENT_URL` tek-origin ayarı geriye uyumludur. `localhost` ve `127.0.0.1` farklı origin'lerdir.
- Ters proxy arkasında doğru `TRUST_PROXY_HOPS` değerini ayarlayın; varsayılan 0'dır.
- Ekip `/auth/register` → e-posta OTP → `PENDING` → ADMIN `/users/:id/role` onayı → `/auth/login` akışını kullanır. Roller PENDING, MEMBER, ORGANIZER, ADMIN'dir. Yönetim yetkisi sunucuda rol üzerinden uygulanır; eski `permissions` alanı bu sürümde yetki vermek için kullanılmaz.
- Katılımcı `/participant-auth/email/send-otp` + `/email/verify` veya `/google` ile ayrı token alır. Ekip token'ı katılımcı formu yerine geçmez.
- Ekip ve eski hackathon OTP'leri hash, tek kullanımlılık, 5 deneme, 10 dakika süre ve 60 saniye tekrar gönderim beklemesi uygular. Katılımcı süreleri env üzerinden ayarlanır.
- Production'da Brevo ayarı yoksa e-posta simülasyonu başarılı sayılmaz. Geliştirmede kod konsola yazılır. Gerçek servis çağrısı 10 saniye zaman aşımı kullanır.
- `/event-page/hackathon` etkinlik içeriğinin kalıcı kaynağıdır. GET public, PUT ADMIN/ORGANIZER yetkilidir; `{event, revision}` ister. İçerik ve ilgili form aynı transaction'da yayınlanır. Başlangıç şablonu `shared/hackathon-event.json`; sunucu ilk başlangıçta eksik sayfa/formu oluşturur, mevcut başvuruları ve ayarları ezmez.
- Yeni etkinlik başvuruları `hackathon-katilim` dinamik formuna yazılır. Eski HackathonApp koleksiyonu ve API'si korunur; panelde ayrı kaynak olarak görünür. `ENABLE_HACKATHON_MODULE=false` yalnız eski modülü kapatır.
- Form gönderimleri transaction ile kota/tek başvuru/sayaç tutarlılığı sağlar. `_formVersion` gönderilirse eski şemayla başvuru reddedilir. Export eski soru etiketlerini korur ve cursor ile akış halinde üretilir.
- Public görseller `/uploads/public/` altında, CV/form ekleri özel dizindedir. `/api/v1/files/:filename` ORGANIZER/ADMIN token'ı ister. Eski özel `/uploads/:filename` adresleri de token ister; kayıtlı eski public kapak görselleri korunur. Dosyalar tam uzantı ve temel içerik imzası, adet ve boyut kontrolünden geçer.

`npm run seed` için yeni admin parolasını `DEFAULT_ADMIN_PASSWORD` ile en az 12 karakter olarak belirleyin. Seed doğrulanmış ADMIN oluşturur; aynı admin tekrar çalıştırıldığında parola değişmez ve loglanmaz. Başka rolü otomatik ADMIN yapmaz.

Otomatik testler geçici MongoDB kullanır; gerçek `.env`, Google hesabı ve Brevo teslimatı kullanılmaz. Tarayıcı testleri kökten `npm run test:e2e` ile çalışır. Güncel sonuçlar [mevcut durum](../documents/MEVCUT_PROJE_DURUMU.md) belgesindedir.
