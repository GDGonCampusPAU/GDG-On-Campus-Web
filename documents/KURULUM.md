# Kurulum ve kontroller

11 Kasım 2026. Mevcut `package.json` `engines` kuralı Node `>=24.15.0 <25` (`.nvmrc`: `24`) ve npm gerektirir; Node 22 LTS desteği için `DEF-19` kapsamındaki `engines` esnetmesi uygulanmalıdır.

### Önemli: Windows PowerShell Komut Çalıştırma Yönergesi

Windows işletim sisteminde varsayılan PowerShell `ExecutionPolicy` politikası (`Restricted` veya `RemoteSigned`) nedeniyle terminale doğrudan `npm` veya `npx` yazıldığında, PowerShell `npm.ps1` dosyasını yürütmeye çalışır ve `PSSecurityException` güvenlik engeline takılır:
```powershell
# Hata örneği:
# File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.
```

Bu kısıtlamayı aşmak için iki yöntem mevcuttur:
1. **Önerilen Doğrudan Yöntem (`npm.cmd` / `npx.cmd`):** Komutları doğrudan `.cmd` uzantısıyla çağırın. Bu sayede PowerShell `.ps1` dosyasını atlar ve komut doğrudan Windows komut yorumlayıcısı ile çalışır:
   ```powershell
   npm.cmd run check
   npm.cmd test
   npm.cmd run dev
   npx.cmd playwright test
   ```
2. **Oturum Bazlı İzin:** Yalnızca aktif terminal penceresi için çalıştırma ilkesini esnetin:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```

---

### Kurulum Adımları

1. Kök dizinde `npm.cmd run setup` (Linux/macOS: `npm run setup`) çalıştırın. Bu, kök test araçları ile backend/panel/hackaton lockfile'larını kurar.
2. Backend ve iki ön yüzün `.env.example` dosyalarından, yalnız yoksa `.env` oluşturun. Mevcut dosyaları ezmeyin.
3. Backend için replica set/Atlas `MONGO_URI`, en az 32 karakterlik `JWT_SECRET`, ayrı güçlü `PARTICIPANT_JWT_SECRET` ve `CLIENT_URLS` tanımlayın. Geliştirme origin'leri `http://localhost:5173,http://localhost:5174`.
4. Yeni yerel DB gerekiyorsa kökten `docker compose up -d --wait mongo` çalıştırın. 27017 zaten kullanılıyorsa mevcut replica set'i kullanın veya `MONGO_PORT` ayarlayın. Replica set adı rs0'dır.
5. `npm.cmd run dev`: API 5000, etkinlik 5173, panel 5174. `dev:api`, `dev:panel`, `dev:hackaton` ayrı çalıştırır. Portlar otomatik değişmez; çakışma açık hata verir.
6. İlk admin gerekiyorsa backend env içinde özel `DEFAULT_ADMIN_PASSWORD` (en az 12 karakter) belirleyip `npm.cmd run seed --prefix backend` çalıştırın. Seed veri ekler; gerçek DB'de bilinçli çalıştırın. Sunucu etkinlik sayfası/formunu eksikse oluşturur; mevcut yayını ezmez.

Örnek yerel bağlantı: `mongodb://127.0.0.1:27017/gdg_pau?replicaSet=rs0&directConnection=true`.

Tamamını Docker ile çalıştırmak için, backend env ayarları hazırken `docker compose up -d --build --wait` kullanın. API container'ı hosttaki MONGO_URI yerine Compose MongoDB servisine bağlanır; sunucu sırları yine `backend/.env` dosyasından alınır. İki Vite sunucusu tarayıcının eriştiği PUBLIC_API_URL değerini kullanır. Portlar, isteğe bağlı kök `.env` ile değiştirilir; varsayılan tarayıcı URL/CORS ayarları portlarla birlikte uyarlanır. Google butonu için `frontend/hackaton/.env` içindeki VITE_GOOGLE_CLIENT_ID okunur. Upload dizini hostta, veritabanı named volume'da kalır. Bu yapı yerel geliştirme içindir.

MongoDB imajı 8.0.34'e sabitlendi. Bu makinedeki kernel ile görülen [MongoDB rseq uyumluluk sorunu](https://jira.mongodb.org/browse/SERVER-121912) için geliştirme container'ında `GLIBC_TUNABLES=glibc.pthread.rseq=1` kullanılır. Bu ayar, glibc rseq kaydı açıkken TCMalloc per-CPU önbelleğinin kullanılmamasına dayanır; MongoDB'nin kernel kontrolü kaldırılmaz. [MongoDB kaynak kodu](https://github.com/mongodb/mongo/blob/v8.0/src/mongo/db/startup_check_rseq.cpp) kontrolü per-CPU önbelleğinin aktifliğine bağlar. Production için ayrı uyumlu kernel/imaj doğrulaması gerekir.

`npm run check` bütün lint/test/build kontrolleridir. `npm run setup:browser` Chromium'u kurar; sonra `npm run test:e2e` gerçek tarayıcı testlerini çalıştırır. Linux CI, Playwright sistem bağımlılıklarını `npx playwright install --with-deps chromium` ile kurar. Tarayıcı test sunucusunun test OTP endpoint'leri yalnız `e2e/server.cjs` içinde tanımlıdır; production sunucusunda yoktur.

E-posta OTP geliştirmede konsola düşebilir; production gerçek Brevo ayarı ister. Google için backend GOOGLE_CLIENT_ID ve site VITE_GOOGLE_CLIENT_ID eşleşmeli; Console authorized origins tarayıcı origin'iyle tam aynı olmalı. `localhost`, `127.0.0.1`, farklı portlar ve HTTPS farklı origin'lerdir.

Üretim build'inde her ön yüzde `VITE_API_URL` belirleyin veya aynı origin'de `/api/v1` proxy'sini kurun. SPA rotalarını index.html'e yönlendirin. `TRUST_PROXY_HOPS` yalnız gerçek proxy topolojisine göre belirlenir. `/health` canlılık, `/ready` DB bağlantısı kontrolüdür.

### Üretim Ortamı Dağıtımı (Docker Compose Production)

Canlı ortam için optimize edilmiş multi-stage `Dockerfile`, Nginx ters proxy'si ve MongoDB `rs0` otomatik ilklendirmesi içeren üretim yapısı:

```bash
# 1. Ortam dosyalarını oluşturun
cp .env.example .env
cp backend/.env.example backend/.env

# 2. Üretim servislerini başlatın
docker compose -f compose.prod.yaml up -d --build

# 3. İlk yönetici hesabını oluşturun
docker compose -f compose.prod.yaml exec backend npm run seed
```

Mevcut [`nginx/nginx.conf`](../nginx/nginx.conf), `80` portundan gelen `/api/`, `/uploads/`, `/health`, `/ready` çağrılarını backend konteynerine ve kök yolları statik Hackathon sitesine (`/usr/share/nginx/html/hackaton`), `8080` portunu ise Core Team paneline (`/usr/share/nginx/html/panel`) yönlendirir (`listen 80` ve `listen 8080`). Canlı domain yayını öncesi `:443` SSL/TLS sonlandırması, `gdgocpamukkale.com` / `panel.gdgocpamukkale.com` sanal host ayrımı (Cloudflare `:8080` proxy desteklemediği için zorunludur) ve [`Dockerfile`](../Dockerfile) + [`compose.prod.yaml`](../compose.prod.yaml) içine `ARG VITE_GOOGLE_CLIENT_ID` eklenmelidir (bkz. [Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md](../Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md)).

Yedekleme: API yazmalarını durdurarak MongoDB dump'ı ile `backend/uploads` dizinini aynı bakım penceresinde birlikte yedekleyin. Dosyalar özel başvuru verisi içerir; erişimi sınırlayın. Canlıya geri yüklemeden önce ayrı replica set ve ayrı upload dizininde dump/restore, kayıt sayıları ve yetkili dosya indirmeyi doğrulayın. Bu oturumda gerçek veriye yönelik yedek/restore çalıştırılmadı.

Projede tespit edilen tüm teknik eksiklikler (mimari, güvenlik, altyapı/Docker/Nginx, performans ve UI/UX) ve bunların adım adım çözüm yolları için [Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md](../Docs/EKSIKLIKLER_VE_DUZELTME_REHBERI.md) belgesini inceleyiniz.
