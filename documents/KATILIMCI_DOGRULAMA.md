# Katılımcı doğrulaması — kullanım ve test

Bu belge `feature/participant-verification` dalındaki yeni davranışı anlatır. API, mimari ve veritabanı belgeleri de bu çalışma ağacına göre güncellenmiştir.

## Akış ve sınırlar

Katılımcı `User` ekip hesabından ayrıdır; yönetici onayı beklemez. Google veya e-posta OTP'si aynı katılımcı token'ını üretir. Form gönderiminde token kontrol edilir; yanıtın `participant`, `verifiedEmail`, `verificationMethod`, `verifiedAt` alanları sunucu tarafından belirlenir. Formdaki serbest e-posta soruları ayrı yanıt alanlarıdır, doğrulanmış kimlik yerine geçmez.

Ekip token'ı form katılımcısı olarak, katılımcı token'ı yönetim hesabı olarak kullanılamaz. Token yanıtı `token`, `tokenType`, `expiresAt`, `participant`, `verificationMethod` içerir. Refresh token yok; süre dolunca yeniden doğrulama yapılır. Token aynı yöntemle giriş isteyen diğer formlarda da kullanılabilir, tek forma bağlı değildir.

Google ID token'ı resmi `google-auth-library` ile imza, audience, issuer ve süre bakımından doğrulanır. Gmail / Workspace hesabı ve doğrulanmış e-posta gerekir. Google'ın sahipliği güvenilir biçimde doğrulamadığı üçüncü taraf e-postalarında EMAIL_OTP istenir. Kaynak: [Google sunucu tarafı doğrulama kılavuzu](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Ortam ayarları

`backend/.env.example` dosyasını `.env` için başlangıç olarak kullanın. Anahtarları güçlü, ayrı değerlerle doldurun; yapılandırma değişince backend'i yeniden başlatın.

| Değişken | Varsayılan / işlev |
| --- | --- |
| `JWT_EXPIRES_IN` | `7d`; ekip token'ı |
| `PARTICIPANT_JWT_EXPIRES_IN` | `1h`; katılımcı token'ı; ör. `30s`, `15m`, `2h`, `1d` |
| `PARTICIPANT_JWT_SECRET` | Katılımcı imza anahtarı; boşsa gerçek `JWT_SECRET` kullanılır |
| `PARTICIPANT_OTP_TTL_MINUTES` | `10`; OTP süresi |
| `PARTICIPANT_OTP_COOLDOWN_SECONDS` | `60`; aynı e-postaya yeni kod gönderme beklemesi |
| `PARTICIPANT_OTP_MAX_ATTEMPTS` | `5`; hatalı kod deneme sınırı |
| `GOOGLE_CLIENT_ID` | Google Cloud Web application OAuth client ID |
| `BREVO_API_KEY` | Gerçek e-posta için gerekli; üretimde eksikse katılımcı e-posta servisi 503 döner |
| `MONGO_URI` | Replica set / Atlas bağlantısı gerekir |

Süre değişikliği yalnızca sonradan verilen token'ları etkiler; önceden verilen token'ın kendi `exp` değeri geçerlidir. İmza anahtarının değişmesi eski token'ları ve o anahtarla hash'lenen bekleyen katılımcı OTP'lerini geçersiz kılar. Üretimde ayrı katılımcı anahtarı kullanın.

## Veritabanı gereksinimi ve mevcut formlar

Yanıt kaydı ve kota sayacı aynı transaction içinde güncellenir. Tek başvuru kontrolü eşzamanlı isteklerde de korunur. MongoDB **replica set** veya Atlas gerekir; standalone sunucu startup'ta açık bir hata ile reddedilir. Yerel bir örnek:

```bash
mongod --replSet rs0 --bind_ip localhost --dbpath /YEREL/MONGO/VERI/DIZINI
```

Başka terminalde bir kez:

```bash
mongosh --eval 'rs.initiate()'
```

Ardından `MONGO_URI=mongodb://localhost:27017/gdg_pau?replicaSet=rs0`. Mevcut sunucu verisini taşıma/yedekleme kararını kendi ortamınıza göre verin; bu komutları çalışan production MongoDB üzerinde körlemesine uygulamayın.

Yeni koleksiyonlar `participants` ve `participantotps`. OTP'ler HMAC-SHA256 hash olarak saklanır, kriptografik rastgele üretilir, atomik tüketilir. E-posta bazlı cooldown ve IP bazlı limit vardır. E-posta teslimat hatasında ilgili kod silinir.

Form ayarları:

```json
{
  "verificationRequired": true,
  "verificationMethods": ["GOOGLE", "EMAIL_OTP"],
  "allowMultipleSubmissions": false
}
```

**Uyumluluk:** `verificationRequired` varsayılanı true'dur; eski form kayıtlarında bu alan yoksa da Mongoose üzerinden bu varsayılan uygulanır. Anonim kalması gereken formları ekip API'si üzerinden açıkça `verificationRequired:false`, `requireAuth:false`, `allowMultipleSubmissions:true` olarak güncelleyin. Eski `requireAuth:true` doğrulama gerektirir. Tek başvuru da kimlik doğrulaması gerektirir. İzin verilen yöntemler kimlik gerektiren formlarda uygulanır. Public form GET'i token istemez; şemayı görüp ardından giriş yapılabilir.

Eski anonim cevapların kimliği geriye dönük bulunamaz; tek başvuru kontrolü doğrulanmış katılımcı ilişkisinden çalışır. `allowMultipleSubmissions` ayarını yanıt alındıktan sonra değiştirmek geçmiş kayıtları dönüştürmez. Form şeması gönderim sırasında değişmişse 409 ile formu yeniden açma istenir.

Dosyalar kimlik doğrulamasından sonra yazılır; controller'ın reddettiği başvurulardaki dosyalar temizlenir. Önceki public `/uploads` erişimi bu çalışmada değiştirilmedi; gerçek CV toplamadan önce private dosya erişimi geliştirilmelidir. Özel `/hackathon/apply` akışı da mevcut lider OTP'sini kullanmaya devam eder; bu yeni doğrulama dinamik form rotalarına uygulanır.

## API

| Metot / yol | Body | Başarı |
| --- | --- | --- |
| POST `/api/v1/participant-auth/email/send-otp` | `{"email":"test@example.com"}` | 200, süre ve bekleme bilgisi |
| POST `/api/v1/participant-auth/email/verify` | `{"email":"test@example.com","code":"123456"}` | 200, token ve kimlik |
| POST `/api/v1/participant-auth/google` | `{"idToken":"GIS_CREDENTIAL"}` | 200, token ve kimlik |
| POST `/api/v1/forms/public/:slugOrId/submit` | Şemanın fieldId'lerine göre yanıtlar | Bearer katılımcı token'ıyla 201 |

Hata beklentileri: eksik/geçersiz/süresi dolmuş token 401; kabul edilmeyen yöntem 403; tekrar başvuru 409; kota/tarih/durum engeli 403; kod gönderim cooldown'ı 429; yanlış/eskimiş kod 400. Google yapılandırması yoksa 503. Doğrulama rotaları IP başına 15 dakikada 30 istekle ayrıca sınırlıdır.

## Otomatik test aracı

```bash
cd backend
npm ci
npm test
```

Testler geçici, tek üyeli MongoDB replica set açar; gerçek `.env`, mevcut DB veya gerçek Google/Brevo hesabı kullanılmaz. İlk çalıştırmada MongoDB test binary'si internetten indirilir. Kurumsal ortamda önceden kurulu binary için `MONGOMS_SYSTEM_BINARY=/tam/yol/mongod npm test` kullanılabilir.

Kapsam: OTP tek kullanımı/eşzamanlı tüketim, hash saklama, cooldown, expiry ve deneme sınırı; token süresi, geçersiz token, ekip/katılımcı ayrımı; yetkisiz dosyalı başvuru; yöntem kısıtı; anonim form; tek başvuru ve eşzamanlı kota; doğrulanmış kimliğin değiştirilememesi. Google endpoint başarı akışında doğrulayıcı adapter mock edilir. Ayrıca Google kütüphanesinin gerçek RSA imza, audience, issuer ve expiry kontrolleri yerel test anahtarlarıyla çalıştırılır; yalnızca Google sertifika indirmesi mock edilir. Gerçek hesap ve e-posta teslimatı manuel doğrulanmalıdır.

## IDE üzerinden manuel test

[`participant-flow.http`](../backend/tools/participant-flow.http) dosyasını VS Code REST Client veya JetBrains HTTP Client ile açın. Önce e-posta kodu alın, kodu doğrulayın, yanıttaki token'ı değişkene yazın. Var olan doğrulanmış ekip hesabıyla giriş yapıp test formunu oluşturun. Tokensız gönderim 401, ilk doğrulanmış gönderim 201, aynı katılımcının ikinci gönderimi 409 olmalı.

Geliştirmede Brevo anahtarı yoksa kod backend terminalindeki e-posta simülasyonunda görünür. API kodu response içinde vermez. Seed admini mevcut kodda emailVerified değildir; ilk girişte verilen REGISTER kodunu `/auth/verify-email` ile doğrulayıp tekrar giriş yapın.

## Tarayıcı ve gerçek Google test aracı

Backend çalışırken ikinci terminalde:

```bash
cd backend/tools
python3 -m http.server 5173 --bind 127.0.0.1
```

`http://localhost:5173/participant-auth.html` adresini açın. Aynı portta frontend açıksa önce durdurun veya farklı port seçip backend `CLIENT_URL` ve Google origin ayarını uyarlayın. Bu sayfa asıl frontend'e bağlı olmayan bir test aracıdır.

Google Cloud'da OAuth Web client oluşturun, Authorized JavaScript origins alanına `http://localhost:5173` ekleyin. Backend `.env` ve sayfadaki Client ID alanında aynı değeri kullanın. Google giriş düğmesini yükleyip gerçek hesabınızla giriş yapın. Callback'teki ID token backend'e gönderilir; backend doğrular ve katılımcı token'ı verir. Client secret gerekmez. OAuth consent ekranı test modundaysa hesabınızı test kullanıcılarına ekleyin.

Token expiry kontrolü için `.env` içinde `PARTICIPANT_JWT_EXPIRES_IN=30s` ayarlayın, backend'i yeniden başlatın, yeni token alın; 30 saniyeden sonra başvuru 401 olmalıdır. Sonra normal süreye dönün. Google başarı/yanlış audience, gerçek e-posta teslimatı ve CORS ayarları bu araçla ayrıca doğrulanabilir.

## Bu dalda yapılan doğrulama

`npm test`: **20 test geçti**. İzole replica set üzerinde HTTP ve transaction testleri çalıştırıldı; mevcut veritabanına veri yazılmadı. Gerçek Google hesabıyla giriş ve Brevo teslimatı, kullanıcı yapılandırması gerektirdiği için çalıştırılmadı. Branch başlangıcı mevcut yerel `dev` commit'i `a582604`.

Paket kurulumu sonrası npm audit, mevcut geliştirme bağımlılığı `nodemon → chokidar → braces` zincirinde 3 high bulgu raporladı. Önerilen otomatik çözüm sürüm düşürmeyi içerdiği için bu özellik çalışmasında `audit fix --force` uygulanmadı.

## Yerel Docker: kernel 6.19–7.0.13 açılış hatası

Bu makinedeki `7.0.0-38-generic` kernel ile `mongo:8.0` açılışta SERVER-121912 nedeniyle kapanıyordu. 12 Ekim 2026 tarihinde container, aynı veri volume'ları korunarak `GLIBC_TUNABLES=glibc.pthread.rseq=1` ortam değişkeniyle yeniden oluşturuldu. Bu ayar Node `.env` dosyasına değil, MongoDB container ortamına aittir.

Yeni bir yerel kurulum için:

```bash
docker run -d --name gdg-mongodb --restart unless-stopped \
  -p 127.0.0.1:27017:27017 -v gdg-mongodb-data:/data/db \
  -e GLIBC_TUNABLES=glibc.pthread.rseq=1 \
  mongo:8.0 --replSet rs0 --bind_ip_all
```

Mevcut `gdg-mongodb` varken bu komutu yeniden çalıştırmayın. Eski container `gdg-mongodb-before-rseq` adıyla durmuş halde saklandı; yeni container aynı volume'ları kullanıyor, ikisini birlikte başlatmayın. Mevcut kurulumda `rs0` başlatıldığı için yeniden `rs.initiate()` gerekmez.

MongoDB'nin kalıcı çözüm önerisi kernel'i 7.0.14 veya sonraki uyumlu sürüme yükseltmektir; burada işletim sistemi/kernel değiştirilmedi. Kaynaklar: [MongoDB sürüm notları](https://www.mongodb.com/docs/manual/release-notes/8.0/), [resmi Docker image deposundaki workaround kaydı](https://github.com/docker-library/mongo/issues/765).

## Açık manuel test noktaları

CORS düzeltmesi ve test sayfası iyileştirmeleri henüz uygulanmadı. Backend tek CLIENT_URL origin’i kabul ediyor. Sayfayı localhost:5173 üzerinden açıyorsanız CLIENT_URL=http://localhost:5173 kullanın; 127.0.0.1:5173 üzerinden açıyorsanız bu tam origin’i kullanıp backend’i yeniden başlatın. Google Authorized JavaScript origins de sayfanın gerçek origin’i olmalı; HTML dosya yolu eklenmez.

Sayfa varsayılanındaki katilimci-test formu seed tarafından oluşturulmaz; HTTP araçtaki ekip login + form oluşturma adımlarını tamamlayın veya seed’in hackathon-2026-basvuru formuna uygun cevapları gönderin. Seed formunda allowMultipleSubmissions true olduğu için tekrar gönderim 201 olabilir. Token yokken tokenlı düğmenin açık kalması, genel hata mesajları ve tekrar Google başlatma davranışı iyileştirme bekliyor. 20 otomatik testin geçmesi bu browser yapılandırmasını doğrulamaz.
