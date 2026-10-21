# Kurulum ve kontroller

21 Ekim 2026. Node 24 ve npm kullanılır.

1. Kök dizinde `npm run setup` çalıştırın. Bu, kök test araçları ile backend/panel/hackaton lockfile'larını kurar.
2. Backend ve iki ön yüzün `.env.example` dosyalarından, yalnız yoksa `.env` oluşturun. Mevcut dosyaları ezmeyin.
3. Backend için replica set/Atlas `MONGO_URI`, en az 32 karakterlik `JWT_SECRET`, ayrı güçlü `PARTICIPANT_JWT_SECRET` ve `CLIENT_URLS` tanımlayın. Geliştirme origin'leri `http://localhost:5173,http://localhost:5174`.
4. Yeni yerel DB gerekiyorsa kökten `docker compose up -d --wait mongo` çalıştırın. 27017 zaten kullanılıyorsa mevcut replica set'i kullanın veya `MONGO_PORT` ayarlayın. Replica set adı rs0'dır.
5. `npm run dev`: API 5000, etkinlik 5173, panel 5174. `dev:api`, `dev:panel`, `dev:hackaton` ayrı çalıştırır. Portlar otomatik değişmez; çakışma açık hata verir.
6. İlk admin gerekiyorsa backend env içinde özel `DEFAULT_ADMIN_PASSWORD` (en az 12 karakter) belirleyip `npm run seed --prefix backend` çalıştırın. Seed veri ekler; gerçek DB'de bilinçli çalıştırın. Sunucu etkinlik sayfası/formunu eksikse oluşturur; mevcut yayını ezmez.

Örnek yerel bağlantı: `mongodb://127.0.0.1:27017/gdg_pau?replicaSet=rs0&directConnection=true`.

Tamamını Docker ile çalıştırmak için, backend env ayarları hazırken `docker compose up -d --build --wait` kullanın. API container'ı hosttaki MONGO_URI yerine Compose MongoDB servisine bağlanır; sunucu sırları yine `backend/.env` dosyasından alınır. İki Vite sunucusu tarayıcının eriştiği PUBLIC_API_URL değerini kullanır. Portlar, isteğe bağlı kök `.env` ile değiştirilir; varsayılan tarayıcı URL/CORS ayarları portlarla birlikte uyarlanır. Google butonu için `frontend/hackaton/.env` içindeki VITE_GOOGLE_CLIENT_ID okunur. Upload dizini hostta, veritabanı named volume'da kalır. Bu yapı yerel geliştirme içindir.

MongoDB imajı 8.0.34'e sabitlendi. Bu makinedeki kernel ile görülen [MongoDB rseq uyumluluk sorunu](https://jira.mongodb.org/browse/SERVER-121912) için geliştirme container'ında `GLIBC_TUNABLES=glibc.pthread.rseq=1` kullanılır. Bu ayar, glibc rseq kaydı açıkken TCMalloc per-CPU önbelleğinin kullanılmamasına dayanır; MongoDB'nin kernel kontrolü kaldırılmaz. [MongoDB kaynak kodu](https://github.com/mongodb/mongo/blob/v8.0/src/mongo/db/startup_check_rseq.cpp) kontrolü per-CPU önbelleğinin aktifliğine bağlar. Production için ayrı uyumlu kernel/imaj doğrulaması gerekir.

`npm run check` bütün lint/test/build kontrolleridir. `npm run setup:browser` Chromium'u kurar; sonra `npm run test:e2e` gerçek tarayıcı testlerini çalıştırır. Linux CI, Playwright sistem bağımlılıklarını `npx playwright install --with-deps chromium` ile kurar. Tarayıcı test sunucusunun test OTP endpoint'leri yalnız `e2e/server.cjs` içinde tanımlıdır; production sunucusunda yoktur.

E-posta OTP geliştirmede konsola düşebilir; production gerçek Brevo ayarı ister. Google için backend GOOGLE_CLIENT_ID ve site VITE_GOOGLE_CLIENT_ID eşleşmeli; Console authorized origins tarayıcı origin'iyle tam aynı olmalı. `localhost`, `127.0.0.1`, farklı portlar ve HTTPS farklı origin'lerdir.

Üretim build'inde her ön yüzde `VITE_API_URL` belirleyin veya aynı origin'de `/api/v1` proxy'sini kurun. SPA rotalarını index.html'e yönlendirin. `TRUST_PROXY_HOPS` yalnız gerçek proxy topolojisine göre belirlenir. `/health` canlılık, `/ready` DB bağlantısı kontrolüdür.

Yedekleme: API yazmalarını durdurarak MongoDB dump'ı ile `backend/uploads` dizinini aynı bakım penceresinde birlikte yedekleyin. Dosyalar özel başvuru verisi içerir; erişimi sınırlayın. Canlıya geri yüklemeden önce ayrı replica set ve ayrı upload dizininde dump/restore, kayıt sayıları ve yetkili dosya indirmeyi doğrulayın. Bu oturumda gerçek veriye yönelik yedek/restore çalıştırılmadı.
