# 21 Ekim 2026 API ekleri ve davranış değişiklikleri

Kök `/api/v1`. Aşağıdaki ekler günceldir; devamındaki eski endpoint örneklerini bu davranışlarla birlikte değerlendirin.

| Metot / yol | Yetki | İşlev |
| --- | --- | --- |
| GET `/users?page=1&role=PENDING` | ADMIN | Parola hash'i içermeyen sayfalı kullanıcı listesi |
| PATCH `/users/:id/role` | ADMIN | `{role}` ile onay/rol değişimi; kendini değiştirme ve eşzamanlı admin kaybı engellenir |
| GET `/event-page/hackathon` | Public | `{data: {event, revision, formSlug, formId}}` yayınlanan içerik |
| PUT `/event-page/hackathon` | ADMIN/ORGANIZER | `{event, revision}` ile içerik + form transaction yayını; eski revision 409 |
| GET `/files/:filename` | ADMIN/ORGANIZER | Özel başvuru dosyasını attachment indirir |
| GET `/ready` (API prefix'i olmadan) | Public | DB bağlıysa 200, değilse 503 |

Ekip ve eski hackathon OTP akışları yeniden çalışır; hash, tek kullanımlılık, süre, 5 deneme ve 60 saniye bekleme uygular. Kayıt PENDING üretir; yönetici onayı gerekir. Üretimde eksik mail servisi 503 döner. Yeni etkinlik kayıt kanalı `POST /forms/public/hackathon-katilim/submit` olup katılımcı Bearer token ister; `{success:true,responseId}` kalıcı kayıt onayıdır. İsteğe bağlı `_formVersion` ISO tarihi eski UI şemasını reddetmek için kullanılır.

`GET /forms/:id/responses` ve export `search` ile literal arama yapabilir. JSON/CSV export akış halinde üretilir; silinmiş/yeniden adlandırılmış soruların eski yanıtları korunur. Form alanları, seçenekler ve durum/tarih aralıkları sunucuda doğrulanır. Özel eski `/uploads/:filename` linkleri de artık token ister; public görseller `/uploads/public/` altındadır. Sunucu istek/hata yanıtlarında request ID sağlar.

---

# API kullanım kılavuzu

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Güncelleme: 12 Ekim 2026 — `feature/participant-verification` çalışma ağacı. Katılımcı doğrulaması ve testler dahil.

## API kullanım kuralları

Yerel API kökü: `http://localhost:5000/api/v1`. Sağlık kontrolü ayrıca kök seviyede `/health` yolundadır.

- **Path parametresi:** `:id` yerine kaynak `_id` değeri; genellikle 24 karakterlik hexadecimal MongoDB ObjectId. Kullanıcı yanıtları çoğunlukla `id`, DB dokümanları çoğunlukla `_id` döndürür.
- **Query parametresi:** URL'de `?page=1&limit=10`. GET'lerin aşağıda belirtilen filtreleri isteğe bağlıdır; GET body gerekmez.
- **JSON body:** `Content-Type: application/json`. Boolean değerleri `true/false`, sayıları sayı olarak gönderin.
- **Dosya body:** `multipart/form-data`. `curl -F` veya tarayıcı `FormData` boundary'yi kendisi üretir; elle Content-Type eklemeyin.
- **Yetki:** Yönetim rotalarında ekip JWT’si, doğrulama isteyen form submit rotalarında katılımcı JWT’si `Authorization: Bearer <JWT>` ile gönderilir. İki token türü birbirinin yerine geçmez. Cookie tabanlı oturum uygulanmış değil.
- **Tarih:** ISO 8601 ve açık saat dilimi kullanın; örneğin `2026-11-01T18:00:00+03:00`. Yanıtlarda tarih JSON içinde ISO metnidir.

Örneklerde şu terminal değişkenleri kullanılır:

```bash
API_BASE='http://localhost:5000/api/v1'
AUTH_TOKEN='EKIP_LOGIN_YANITINDAKI_TOKEN'
PARTICIPANT_TOKEN='KATILIMCI_DOGRULAMA_YANITINDAKI_TOKEN'
FORM_ID='GERCEK_FORM_OBJECT_ID'
CONTENT_ID='GERCEK_CONTENT_OBJECT_ID'
```

Başarılı CRUD yanıtları çoğunlukla `{ "success": true, "data": ... }`; auth yanıtları `user/token`, submit yanıtı `responseId` kullanır. Export yanıtları bu zarfa sarılmaz.

Sayfalı listelerin ortak yapısı:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "totalItems": 0,
    "totalPages": 1,
    "currentPage": 1,
    "limit": 10,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

`page` en az 1'e, `limit` 1–100 aralığına sıkıştırılır. Parse edilemeyen ve sıfır değerlerde varsayılan kullanılır. Boş listede bile `totalPages: 1` gelir. Listeler tarih azalan sıradadır; featured sıralaması ayrıca açıklanmıştır.

## Bütün uç noktalar

Tablodaki yollar API köküne göredir; `/health` istisnası tam yol olarak yazılmıştır. **Ekip** = `ORGANIZER` veya `ADMIN`; **Token** = ekip JWT’si ve DB’de mevcut kullanıcı; **Katılımcı** = doğrulanmış Participant kimliği ve katılımcı JWT’si.

| Metot | Yol | Erişim | Girdi / çıktı özeti |
| --- | --- | --- | --- |
| GET | `/health` (API kökü dışında) | Public | Parametresiz, `success/message/timestamp` |
| GET | `/health` (API kökü altında: `/api/v1/health`) | Public | Parametresiz, `success/message/timestamp` |
| POST | `/participant-auth/email/send-otp` | Public | `email`; süre ve yeniden gönderme beklemesi |
| POST | `/participant-auth/email/verify` | Public | `email,code`; katılımcı token’ı |
| POST | `/participant-auth/google` | Public | Google `idToken`; katılımcı token’ı |
| POST | `/auth/send-otp` | Public | `email`, isteğe bağlı `fullName` |
| POST | `/auth/register` | Public | `fullName,email,password`, tamamlamak için `code` |
| POST | `/auth/verify-email` | Public | `email,code` |
| POST | `/auth/login` | Public | `email,password`; `token,user` |
| GET | `/auth/me` | Token | Parametresiz; `user` |
| GET | `/content/public` | Public | `page,limit,type,search` |
| GET | `/content/featured` | Public | `limit`; `count,data` |
| POST | `/content` | Ekip | İçerik JSON'u veya `coverImage` dosyası |
| PUT | `/content/:id` | Ekip | Path `id`, değişecek içerik alanları |
| DELETE | `/content/:id` | Ekip | Path `id`; body yok |
| GET | `/forms/public/:slugOrId` | Public | Path slug veya ID; yayınlanmış form |
| POST | `/forms/public/:slugOrId/submit` | Form ayarına göre Katılımcı | Alan kimlikleriyle yanıt / dosyalar; varsayılan doğrulama zorunlu |
| GET | `/forms` | Ekip | `page,limit,status,category,search` |
| POST | `/forms` | Ekip | Form şeması JSON'u |
| GET | `/forms/:id` | Ekip | Path `id`; bütün form şeması |
| PUT | `/forms/:id` | Ekip | Path `id`, değişecek form alanları |
| PATCH | `/forms/:id/status` | Ekip | Path `id`, JSON `status` |
| DELETE | `/forms/:id` | Ekip | Formu ve tüm ilişkili yanıtları siler |
| GET | `/forms/:id/responses` | Ekip | Path `id`; `page,limit` |
| GET | `/forms/:id/responses/export` | Ekip | Path `id`; `format` |
| POST | `/hackathon/send-verification` | Public | `leaderEmail`, opsiyonel lider/takım adı |
| POST | `/hackathon/apply` | Public | Başvuru alanları, OTP, opsiyonel `resume` |
| GET | `/hackathon/applications` | Ekip | `page,limit,search` |
| GET | `/hackathon/applications/export` | Ekip | `format` |

Toplam 29 HTTP uç noktası, ayrıca `/uploads/<dosya-adı>` statik dosya erişimi vardır. Hackathon kapalıysa dört hackathon rotası yerine ilgili prefix altında `404` döner. Sağlık yanıtları DB'ye anlık ping yapmaz; readiness kontrolü değildir.

## Katılımcı doğrulama API’si

Bu kimlik yönetim ekibinin User hesabından ayrıdır; kayıt/parola/yönetici onayı gerekmez. E-posta adresinde ekip kaydının domain kısıtlaması uygulanmaz. Katılımcı OTP’si ayrı koleksiyondadır; REGISTER veya HACKATHON_APPLY kodu kullanılamaz.

```bash
curl -X POST "$API_BASE/participant-auth/email/send-otp" \
  -H 'Content-Type: application/json' \
  -d '{"email":"aday@example.com"}'
curl -X POST "$API_BASE/participant-auth/email/verify" \
  -H 'Content-Type: application/json' \
  -d '{"email":"aday@example.com","code":"123456"}'
```

Kod gerçek e-posta/yerel geliştirme konsolundan alınmalı; altı haneli **metin** gönderilmeli. Send yanıtı `200`, `success,message,expiresInSeconds,resendAfterSeconds` içerir. Aynı e-posta için bekleme süresi dolmadan yeniden kod istemek `429`; kod hatalı/eskimiş/deneme hakkı dolmuşsa verify `400` döner. Başarılı kod atomik tüketilir.

Google alternatifi:

```bash
curl -X POST "$API_BASE/participant-auth/google" \
  -H 'Content-Type: application/json' \
  -d '{"idToken":"GOOGLE_IDENTITY_SERVICES_CREDENTIAL"}'
```

Backend resmi Google kütüphanesiyle doğrular; yalnızca token’ı decode etmek yeterli değildir. GOOGLE_CLIENT_ID yoksa `503`, geçersiz kimlik `401`, Google tarafından e-posta sahipliği güvenilir kabul edilmeyen üçüncü taraf adresi `403` ve EMAIL_OTP yönlendirmesi alır. Google hesabı/e-posta ilişki çakışması `409` olabilir.

Verify ve Google başarı yanıtı `200`:

```json
{
  "success": true,
  "token": "KATILIMCI_JWT",
  "tokenType": "Bearer",
  "expiresAt": "2026-10-12T09:00:00.000Z",
  "participant": {"id":"OBJECT_ID","email":"aday@example.com","fullName":""},
  "verificationMethod": "EMAIL_OTP"
}
```

Google girişinde yöntem `GOOGLE` olur. Token süresi `PARTICIPANT_JWT_EXPIRES_IN`, OTP süresi `PARTICIPANT_OTP_TTL_MINUTES` ile ayarlanır. Token süre sonunda yeniden doğrulama gerekir; refresh token yok. Token bir forma bağlı değildir, kabul edilen yönteme sahip diğer formlarda da kullanılabilir. Ayrıntı: [katılımcı doğrulama ve test rehberi](KATILIMCI_DOGRULAMA.md).

## Ekip kimlik doğrulama API'si

### OTP ve kayıt

Kayıt yalnızca `gmail.com`, `pau.edu.tr`, `posta.pau.edu.tr` e-posta alan adlarını kabul eder. OTP altı hanelidir, varsayılan 10 dakika geçerlidir. Aynı e-posta ve amaç için yeni kod eski kodu siler. Hatalı denemeler sayılır; beş hatadan sonra sonraki doğrulamada token silinip yeni kod istenir. Doğru kod tüketilir.

```bash
curl -X POST "$API_BASE/auth/send-otp" \
  -H 'Content-Type: application/json' \
  -d '{"email":"aday@gmail.com","fullName":"Ayşe Yılmaz"}'
```

`email` zorunlu; `fullName` isteğe bağlıdır. Başarı `200`; geçersiz e-posta `400`; zaten doğrulanmış hesap `409`.

```bash
curl -X POST "$API_BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Ayşe Yılmaz","email":"aday@gmail.com","password":"OrnekGucluParola!","code":"123456"}'
```

`fullName` 2–100 karakter, `password` en az 6 karakter. Kod örnektir, gerçek OTP kullanılmalıdır. Kod verilmezse hesap oluşturulmaz; OTP gönderilir ve `200`, `requiresVerification: true` döner. Aynı ad/e-posta/parola ile kod eklenerek tekrar POST yapılır. Kodlu başarı `201` ve `user` döndürür; JWT verilmez. Kullanıcı `PENDING` ve `isEmailVerified: true` olur.

### Var olan hesabın e-postasını doğrulama

```bash
curl -X POST "$API_BASE/auth/verify-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"aday@gmail.com","code":"123456"}'
```

Mevcut hesabı doğrulamak içindir. Yeni kayıt akışında `/register` için alınan kodu burada tüketmeyin; bu rota hesap oluşturmaz. Kod doğruysa kullanıcı bulunmasa bile `200` başarı döner. Bu davranış bir akış eksikliğidir.

### Giriş ve profil

```bash
curl -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"organizer@pau.edu.tr","password":"GERCEK_PAROLA"}'
```

Başarı `200`:

```json
{
  "success": true,
  "token": "JWT_DEGERI",
  "user": {
    "id": "OBJECT_ID",
    "fullName": "GDG Organizer",
    "email": "organizer@pau.edu.tr",
    "role": "ORGANIZER"
  }
}
```

Yanlış kimlik bilgileri `401`. E-posta doğrulanmamışsa yeni REGISTER OTP'si gönderilir ve `403`, `requiresVerification: true`; rol `PENDING` ise `403` döner. **PENDING hesabını onaylayan bir HTTP endpoint yoktur.** Bu nedenle normal kayıt sonrası yetkili giriş akışı mevcut API ile tek başına tamamlanamaz.

```bash
curl "$API_BASE/auth/me" -H "Authorization: Bearer $AUTH_TOKEN"
```

Query/body yok; `user` içinde `id,fullName,email,role,isEmailVerified,createdAt` döner. Auth middleware JWT'nin geçerliliğini ve kullanıcının DB'de varlığını kontrol eder. Rol middleware'i güncel DB rolünü kullanır. Ancak auth middleware e-posta doğrulama durumunu yeniden kontrol etmez; `/me` ayrıca PENDING engeli uygulamaz.

**2FA durumu:** Girişte şifre sonrası OTP zorunlu değildir. Mevcut ekip sistemi kayıt/e-posta doğrulaması yapar; `LOGIN_2FA` enum'u kullanılmıyor.

## İçerik API'si

### Public GET parametreleri

| Endpoint | Parametre | Varsayılan | Davranış |
| --- | --- | --- | --- |
| `/content/public` | `page` | 1 | Sayfa numarası |
| `/content/public` | `limit` | 10 | En fazla 100 |
| `/content/public` | `type` | Yok | `EVENT` / `ANNOUNCEMENT`; küçük harf kabul edilir, geçersiz tür filtresiz bırakılır |
| `/content/public` | `search` | Yok | Başlık ve açıklamada büyük/küçük harf duyarsız regex |
| `/content/featured` | `limit` | 5 | 1–20; yalnızca `isFeatured: true` |

```bash
curl --get "$API_BASE/content/public" \
  --data-urlencode 'type=EVENT' --data-urlencode 'search=Cloud' \
  --data-urlencode 'page=1' --data-urlencode 'limit=10'
curl "$API_BASE/content/featured?limit=5"
```

Public liste `createdAt` azalan; featured `eventDate` artan, ardından `createdAt` azalan sıralanır. Featured eski etkinlikleri otomatik elemez; null tarihli duyurular da dönebilir. Yayın durumu yoktur: oluşturulan bütün içerikler public listede görünür. Tek içerik ayrıntısı için `GET /content/:id` yok.

### İçerik POST / PUT alanları

| Alan | Oluşturmada zorunlu | Tip / davranış |
| --- | --- | --- |
| `title` | Evet | Boş olmayan metin, en fazla 200 karakter |
| `description` | Evet | Boş olmayan metin |
| `type` | Evet | Tam olarak `EVENT` veya `ANNOUNCEMENT` |
| `coverImageUrl` | Hayır | Görsel URL'si; URL doğrulaması yok |
| `coverImage` | Hayır | Multipart dosya alanı; varsa URL alanından öncelikli |
| `bevyLink` | Hayır | Harici link metni; boşsa null |
| `isFeatured` | Hayır | JSON `true` veya multipart `"true"`; diğer değerler false |
| `eventDate` | Hayır | Tarih; boşsa null; EVENT için zorunlu değil |

```bash
curl -X POST "$API_BASE/content" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Cloud Atölyesi","description":"Bulut teknolojilerine giriş.","type":"EVENT","isFeatured":true,"eventDate":"2026-11-01T18:00:00+03:00","bevyLink":"https://gdg.community.dev/"}'
```

Görselli gönderim:

```bash
curl -X POST "$API_BASE/content" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -F 'title=Cloud Atölyesi' -F 'description=Bulut teknolojilerine giriş.' \
  -F 'type=EVENT' -F 'isFeatured=true' -F 'coverImage=@/yerel/yol/afis.jpg'
```

Başarı `201`, `data` bütün içerik dokümanıdır. Public GET `type` filtresi küçük harf kabul etse de POST/PUT doğrulaması büyük harf gerektirir.

PUT tam nesneyi yeniden göndermeyi zorunlu tutmaz; yalnızca gelen alanları değiştirir:

```bash
curl -X PUT "$API_BASE/content/$CONTENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Güncel Atölye Başlığı","isFeatured":false,"eventDate":null}'
curl -X DELETE "$API_BASE/content/$CONTENT_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

PUT ve DELETE başarı `200`; bulunamayan içerik `404`. Silme/görsel değiştirme eski dosyayı diskten kaldırmaz. `updatedAt` tutulmaz.

## Dinamik form API'si

### Form oluşturma

POST `/forms` JSON kabul eder; banner dosyası için upload middleware'i yoktur, `bannerImageUrl` metni gönderilir. `title` zorunludur; diğer üst alanlar isteğe bağlıdır.

| Alan | Varsayılan / açıklama |
| --- | --- |
| `title` | Zorunlu; en fazla 200 karakter |
| `description` | `""` |
| `slug` | Başlıktan Türkçe karakterleri dönüştürerek üretilir; doluysa `-1`, `-2` eklenir |
| `status` | `DRAFT`; seçenekler `DRAFT/PUBLISHED/CLOSED/ARCHIVED` |
| `category` | `GENERAL`; büyük harfe çevrilir |
| `bannerImageUrl` | null |
| `startDate`, `endDate` | null; isteğe bağlı tarih sınırları |
| `maxSubmissions` | null; truthy ise sayıya çevrilir, 0 kotayı devre dışı bırakır |
| `fields` | `[]`; sıralı soru tanımları |
| `settings` | `verificationRequired:true`, `verificationMethods:["GOOGLE","EMAIL_OTP"]`, `allowMultipleSubmissions:true`, `requireAuth:false`, varsayılan başarı mesajı |

```bash
curl -X POST "$API_BASE/forms" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "title":"Atölye Kayıt Formu",
    "slug":"atolye-kayit",
    "status":"PUBLISHED",
    "category":"EVENT",
    "maxSubmissions":100,
    "settings":{"verificationRequired":true,"verificationMethods":["GOOGLE","EMAIL_OTP"],"allowMultipleSubmissions":false,"successMessage":"Kaydınız alındı."},
    "fields":[
      {"fieldId":"fullName","label":"Ad Soyad","type":"text","required":true,"order":0},
      {"fieldId":"email","label":"E-posta","type":"email","required":true,"order":1},
      {"fieldId":"memberCount","label":"Katılımcı sayısı","type":"number","required":true,"validation":{"min":1,"max":5},"order":2},
      {"fieldId":"interests","label":"İlgi alanları","type":"checkbox","options":["Web","Cloud"],"order":3},
      {"fieldId":"resumeFile","label":"CV","type":"file","required":false,"order":4}
    ]
  }'
```

Varsayılan olarak yeni ve bu alanı içermeyen eski formlarda doğrulama gerekir. `requireAuth:true` eski ayarı da katılımcı doğrulamasını zorunlu kılar. `allowMultipleSubmissions:false` kimlik doğrulaması ve aynı katılımcı için tek başvuru gerektirir. Anonim form için üçünü birlikte `verificationRequired:false`, `requireAuth:false`, `allowMultipleSubmissions:true` ayarlayın. İzin verilen yöntem listesi boş olamaz.

Başarı `201`, `data._id` sonraki yönetim çağrılarında kullanılır. `createdBy` otomatik token kullanıcısıdır.

Soru tanımı:

| Alan | Tip / varsayılan |
| --- | --- |
| `fieldId` | Metin; verilmezse üretilir. İstemcinin cevap anahtarıdır; kalıcı ve benzersiz seçilmeli |
| `label` | Metin; verilmezse `Soru N` |
| `description`, `placeholder` | Metin, `""` |
| `type` | `text`, `textarea`, `number`, `email`, `phone`, `select`, `radio`, `checkbox`, `file`, `date`; varsayılan text |
| `required` | Boolean, false; JSON boolean gönderilmeli (`"false"` metni controller'da true olur) |
| `options` | Metin dizisi; `[]` |
| `validation.min/max` | Sayı veya null |
| `validation.regex` | Metin veya null; kayıt edilir ama submit'te çalıştırılmaz |
| `order` | Sayı; verilmezse dizi indeksi |

### GET çağrıları ve değişkenler

| Endpoint | Zorunlu | İsteğe bağlı query |
| --- | --- | --- |
| `/forms` | Bearer token | `page=1`, `limit=10` (en fazla 100), `status`, `category`, `search` |
| `/forms/:id` | Token ve form ID | Yok |
| `/forms/public/:slugOrId` | Slug veya ID | Yok; token gerekmez |
| `/forms/:id/responses` | Token ve form ID | `page=1`, `limit=20` (en fazla 100) |
| `/forms/:id/responses/export` | Token ve form ID | `format=csv` veya `json`, varsayılan csv |

Form listesi `status/category` değerlerini büyük harfe çevirir. `search` başlık, açıklama ve slug üzerinde regex arar. Yönetim form GET'leri `createdBy` alanını `fullName/email` ile populate eder. Yanıt listesi ayrıca `form: {id,title,slug,fields}` döndürür.

```bash
curl "$API_BASE/forms?status=PUBLISHED&category=EVENT&page=1&limit=10" \
  -H "Authorization: Bearer $AUTH_TOKEN"
curl "$API_BASE/forms/$FORM_ID" -H "Authorization: Bearer $AUTH_TOKEN"
curl "$API_BASE/forms/public/atolye-kayit"
curl "$API_BASE/forms/$FORM_ID/responses?page=1&limit=20" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

Public form GET `data` içinde `id,title,description,slug,category,bannerImageUrl,startDate,endDate,settings,fields` döndürür. Alanlar `order` ile sıralanır. Form yoksa `404`; PUBLISHED değilse, tarih aralığı dışındaysa veya kota doluysa `403`. Dolayısıyla kapalı formun public şemasını da okuyamazsınız.

### JSON ile cevap gönderme

Cevapları **fieldId anahtarlarıyla doğrudan üst seviyede** gönderin. Veritabanındaki `answers` dizisini istek formatı olarak kullanmayın.

```bash
curl -X POST "$API_BASE/forms/public/atolye-kayit/submit" \
  -H "Authorization: Bearer $PARTICIPANT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Ayşe Yılmaz","email":"aday@gmail.com","memberCount":2,"interests":["Web","Cloud"]}'
```

Başarı `201`:

```json
{"success":true,"message":"Kaydınız alındı.","responseId":"YANIT_OBJECT_ID"}
```

JSON içinde `{ "answers": { ... } }` gönderimi desteklenmiyor. Yalnızca `answers` bir **JSON metni** ise parse edilip üst seviyeye birleştiriliyor. Parse hataları açık bir JSON hatası olarak raporlanmıyor; gerekli alan hatalarına dönüşebilir.

### Dosyalı cevap gönderme

Dosyanın multipart alan adı şemadaki file sorusunun `fieldId` değeri olmalıdır:

```bash
curl -X POST "$API_BASE/forms/public/atolye-kayit/submit" \
  -H "Authorization: Bearer $PARTICIPANT_TOKEN" \
  -F 'answers={"fullName":"Ayşe Yılmaz","email":"aday@gmail.com","memberCount":2,"interests":["Web","Cloud"]}' \
  -F 'resumeFile=@/yerel/yol/cv.pdf'
```

Metinleri ayrı `-F 'fullName=...'` alanlarıyla da gönderebilirsiniz. Çoklu seçim için JSON metni içindeki dizi daha nettir. File sorusuna dosya yerine URL metni de verilebilir; URL'nin geçerliliği kontrol edilmez. Böyle bir URL `answers` içinde bulunur, yerel yükleme olmadığı için `uploadedFiles` içine eklenmez.

Submit'in uyguladığı kurallar:

- Dosya yazılmadan önce katılımcı kimliği ve formun kabul ettiği doğrulama yöntemi kontrolü.
- Form yayın durumu, başlangıç/bitiş tarihi ve transaction içinde kota kontrolü.
- Tek başvurulu formda aynı katılımcının tekrar kaydının engellenmesi.
- Required alanların eksik, null, boş metin veya boş dizi kontrolü.
- E-posta **metin** değerine temel format kontrolü.
- Number için `Number(value)` ile sayı kontrolü ve min/max karşılaştırması; kaydedilen değer otomatik olarak number'a normalize edilmiyor.

**Mevcut doğrulama eksikleri:** `phone/date/regex`, seçeneklerin `options` içinde olması, checkbox'ın dizi olması ve genel metin türleri tam doğrulanmıyor. Min/max null sınırları artık uygulanmaz; yalnızca tanımlı sınırlar karşılaştırılır. `fieldId` tekilliği garanti edilmiyor.

`settings.requireAuth` ve `allowMultipleSubmissions` artık uygulanır. Katılımcı kimliği `participant` referansına yazılır; `respondent.user` ekip hesabı alanıdır ve bu akışta null kalır. `verifiedEmail`, `verificationMethod`, `verifiedAt` backend’den gelir, istek body’siyle değiştirilemez. E-posta soru yanıtı bu kimlikten ayrı bir alandır.

Eksik/geçersiz/eskimiş katılımcı token’ı `401`, kabul edilmeyen yöntem `403`, tekrar başvuru veya gönderim sırasında değişen form `409` döndürür. Form durum/tarih/kota engeli `403` döner; quota kontrolü tekrar başvuru kontrolünden önce gelir. Yanıt ve sayaç aynı transaction’da saklanır. Eski anonim yanıtlar geriye dönük kimliklendirilmez.

### Güncelleme, durum, silme ve export

```bash
curl -X PUT "$API_BASE/forms/$FORM_ID" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"description":"Güncellenmiş açıklama","maxSubmissions":150}'
curl -X PATCH "$API_BASE/forms/$FORM_ID/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"CLOSED"}'
curl "$API_BASE/forms/$FORM_ID/responses/export?format=csv" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o form-yanitlari.csv
curl "$API_BASE/forms/$FORM_ID/responses/export?format=json" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o form-yanitlari.json
```

PUT verilen üst alanları günceller. **`fields` gönderilirse bütün soru dizisini değiştirir**; tek bir soruyu eklemek için mevcut sorular da gönderilmeli. Eski cevaplar değiştirilmez. `fieldId` değişimi eski cevapların CSV'de eşleşmesini bozar. Slug değişimi eski FormResponse kayıtlarındaki `formSlug` değerini güncellemez. `settings` mevcut alanları koruyarak kısmi birleştirilir; doğrulama yönteminin ve tek başvuru ayarının korunduğu entegrasyon testiyle doğrulandı.

CSV sütunları: yanıt ID, tarih, IP, doğrulanmış e-posta, doğrulama yöntemi, güncel soruların sıralı başlıkları, dosya linkleri. JSON, ham yanıt dokümanları dizisidir. UTF-8 BOM'lu CSV üretilir. Export sayfalama yapmaz; ilgili formun tüm yanıtlarını belleğe alır. `format=json` dışındaki değerler CSV'ye düşer.

DELETE `/forms/:id` body almadan formu ve bütün yanıtlarını siler, başarı `200` döner. Dosyaları silmez. Form silme ve yanıt silme transaction içinde değil; kısmi silinme mümkündür.

## Hackathon API'si

### Lider e-postasına kod gönderme

```bash
curl -X POST "$API_BASE/hackathon/send-verification" \
  -H 'Content-Type: application/json' \
  -d '{"leaderEmail":"lider@example.com","leaderName":"Ayşe Yılmaz","teamName":"Kod Takımı"}'
```

`leaderEmail` zorunlu, diğer iki alan isteğe bağlıdır. Auth kaydının aksine genel e-posta formatı kabul edilir. Başarı `200`. OTP amacı `HACKATHON_APPLY` olduğu için REGISTER kodu burada kullanılamaz.

### Başvuru POST alanları

| Alan | Zorunlu | Kural |
| --- | --- | --- |
| `teamName` | Evet | Boş olmayan metin, en fazla 100 karakter |
| `leaderName` | Evet | Boş olmayan metin, en fazla 100 karakter |
| `leaderEmail` | Evet | Genel e-posta formatı |
| `leaderPhone` | Evet | Metin, trim sonrası en az 7 karakter; kapsamlı telefon doğrulaması yok |
| `memberCount` | Evet | 1–5 arasında sayı; tam sayı şartı yok |
| `projectIdea` | Evet | Trim sonrası en az 10 karakter |
| `verificationCode` | Tamamlamak için evet | Gerçek OTP; alternatif `code` da kabul edilir |
| `resume` | Hayır | Multipart dosya alanı |
| `resumeUrl` | Hayır | Dosya gönderilmezse URL metni |

```bash
curl -X POST "$API_BASE/hackathon/apply" \
  -H 'Content-Type: application/json' \
  -d '{"teamName":"Kod Takımı","leaderName":"Ayşe Yılmaz","leaderEmail":"lider@example.com","leaderPhone":"05551234567","memberCount":3,"projectIdea":"Kampüs için erişilebilir bir etkinlik platformu.","verificationCode":"123456"}'
```

Dosyalı sürüm:

```bash
curl -X POST "$API_BASE/hackathon/apply" \
  -F 'teamName=Kod Takımı' -F 'leaderName=Ayşe Yılmaz' \
  -F 'leaderEmail=lider@example.com' -F 'leaderPhone=05551234567' \
  -F 'memberCount=3' -F 'projectIdea=Kampüs için erişilebilir etkinlik platformu.' \
  -F 'verificationCode=123456' -F 'resume=@/yerel/yol/cv.pdf'
```

Başarı `201`, `data` içinde `applicationId,teamName,leaderName,appliedAt`. Kod yoksa valid temel alanlardan sonra OTP gönderilir, başvuru kaydedilmez ve **`400`, `requiresVerification:true`** döner. Auth register'ın kodsuz `200` davranışından farklıdır. Eksik/geçersiz alan veya OTP `400`.

### Listeleme ve export GET değişkenleri

`/hackathon/applications`: token zorunlu; `page=1`, `limit=10` (1–100), `search` isteğe bağlı. Search takım adı, lider adı ve lider e-postasında regex arar. Sıra `appliedAt` azalan.

```bash
curl --get "$API_BASE/hackathon/applications" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data-urlencode 'search=Kod Takımı' --data-urlencode 'page=1' --data-urlencode 'limit=20'
curl "$API_BASE/hackathon/applications/export?format=csv" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o hackathon-basvurulari.csv
```

Export `format=json` için ham başvuru dizisi; diğer değerler ve eksik format için CSV verir. Liste search filtresi export'a uygulanmaz; **tüm başvurular** indirilir. CSV sütunları: ID, takım adı, lider adı, e-posta, telefon, üye sayısı, fikir, CV linki ve başvuru tarihi.

### İki farklı hackathon veri akışı

Seed'in dinamik hackathon formuna gönderilen başvuru **FormResponse** koleksiyonuna gider. `/hackathon/apply` başvurusu **HackathonApp** koleksiyonuna gider. Dinamik formun `category:HACKATHON` olması onu hackathon modülüne bağlamaz; iki kayıt havuzu otomatik birleşmez, aynı OTP kuralları uygulanmaz. Hackathon modülünü kapatmak yayınlanmış dinamik hackathon formunu kapatmaz.
