# API Dokümantasyonu (11 Kasım 2026 — Güncel Sürüm)

Kök URL: `/api/v1`. Sağlık ve hazır olma kontrolleri kök seviyede `/health` ve `/ready` yollarındadır.
En son commit `b4fbf69` ile **Başvuru Durum İnceleme İş Akışı** (`PENDING`, `APPROVED`, `REJECTED`, inceleme notu, bildirim e-postaları) ve **Özelleştirilebilir E-posta Gönderici Profilleri** sisteme dahil edilmiştir.

### 11 Kasım 2026 Güncellemeleri ve Temel Ekler

| Metot / yol | Yetki | İşlev |
| --- | --- | --- |
| GET `/ready` (Kök seviye) | Public | MongoDB bağlantısı hazır mı kontrolü (Ready ise 200, değilse 503) |
| POST `/auth/forgot-password` | Public | Şifre sıfırlama için 6 haneli OTP kodu talebi (`PASSWORD_RESET` amacı) |
| POST `/auth/reset-password` | Public | OTP kodu ile yeni şifre belirleme ve `tokenVersion` artırımı ile eski JWT'leri iptal etme |
| GET `/users?page=1&role=PENDING` | ADMIN | Parola hash'i içermeyen, 6 alanlı standart zarfa sahip sayfalı kullanıcı listesi |
| PATCH `/users/:id/role` | ADMIN | `{role}` ile onay/rol değişimi (`PENDING`, `ORGANIZER`, `ADMIN`); kendini değiştirme ve eşzamanlı admin kaybı engellenir |
| GET `/event-page/hackathon` | Public | `{data: {event, revision, formSlug, formId}}` yayınlanan içerik ve form ID |
| PUT `/event-page/hackathon` | ADMIN/ORGANIZER | `{event, revision}` ile içerik + form transaction yayını; eski revision 409 döner |
| GET `/files/:filename` | ADMIN/ORGANIZER | Özel başvuru dosyasını (CV vb.) attachment olarak indirir; traversal engelli |
| PATCH `/forms/:id/responses/:responseId/status` | ADMIN/ORGANIZER | Form yanıtı durumunu güncelleme (`PENDING`, `APPROVED`, `REJECTED`), not ekleme ve opsiyonel bilgilendirme e-postası tetikleme |
| PATCH `/hackathon/applications/:id/status` | ADMIN/ORGANIZER | Hackathon başvuru durumunu güncelleme (`PENDING`, `APPROVED`, `REJECTED`), not ekleme ve opsiyonel bilgilendirme e-postası tetikleme |

Ekip ve hackathon OTP akışları `node:crypto` `randomInt` ve HMAC-SHA256 hash'leme uygular; tek kullanımlılık, 10 dakika süre, 5 deneme hakkı ve 60 saniye yeniden gönderme beklemesi sağlar. Kayıt `PENDING` rolü üretir; Core Team yönetici onayı gerekir. Üretimde eksik mail servisi 503/502 döner. Yeni etkinlik kayıt kanalı `POST /forms/public/hackathon-katilim/submit` olup katılımcı Bearer token ister; `{success:true,responseId}` kalıcı kayıt onayıdır.

**Takım alanı (`team`):** Cevap `{mode:'solo'}`, `{mode:'create', name}` (2-40 karakter, etkinlikte büyük/küçük harf duyarsız benzersiz) veya `{mode:'join', code}` (6 harf/rakam, büyük/küçük harf fark etmez) olur. Takım kurma/katılma başvuruyla aynı transaction'da yapılır; başvuru reddedilirse takım veya üyelik oluşmaz. Takım en fazla 4 kişidir (kaptan + onaylı + bekleyen). Katılan üye `PENDING` olarak kaptan onayını bekler. Hatalar 400 ile Türkçe döner: bulunamayan kod, dolu takım, alınmış ad.

**Başvurum (26c-26i):** Bütün takım işlemleri transaction içindedir ve takım kaydı, başvurudaki `team/teamName/teamRole` ile personelin gördüğü takım cevabını birlikte günceller. Reddedilen, geri çeken, ayrılan veya çıkarılan kişi takım listesinden silinir ve başka bir takıma katılabilir. Takım arkadaşları birbirlerinin yalnız adını ve yönetici kararını görür; e-posta adresleri dönmez.

**Yönetici reddi:** `PATCH /forms/:id/responses/:responseId/status` ile `REJECTED` verilen kişi takımından otomatik çıkarılır (bekleyen isteği de silinir). Reddedilen kaptansa kaptanlık en eski onaylı üyeye geçer; başka onaylı üye yoksa takım dağıtılır. Yanıt `teamOutcome: left | captain-replaced | disbanded | null` içerir. Başvuru listesi (`GET /forms/:id/responses`) `team=solo|team|captain|pending` filtresini, `summary` sayılarını ve her kayıtta `teamCode`, `teamStatus`, `editedAt` alanlarını döndürür; CSV'de Takım Adı / Takım Kodu / Takımdaki Rol sütunları vardır. Bekleyen istek sahibi yalnız takım adını görür. Dosya ve takım cevapları düzenleme ile değişmez.

`GET /forms/:id/responses`, `GET /forms/:id/responses/export`, `GET /hackathon/applications` ve `GET /hackathon/applications/export` uç noktaları `status` ve `search` ile regex/literal filtreleme yapabilir. JSON/CSV export akış (streaming) halinde üretilir. Form alanları, seçenekler ve durum/tarih aralıkları sunucuda doğrulanır. Özel eski `/uploads/:filename` linkleri yetkilendirme ister; public kapak görselleri `/uploads/public/` altındadır. Sunucu istek/hata yanıtlarında `X-Request-ID` sağlar.

**Hız sınırları (15 dakika):** Salon gibi tek IP'den çıkan kalabalıklarda bir kişinin diğerlerini kilitlememesi için sayaçlar mümkün olduğunca kişiye bağlıdır.

| İstek | Sınır | Anahtar |
| --- | --- | --- |
| Genel API, geçerli imzalı ekip veya katılımcı token'ıyla | 600 | Kişi |
| Genel API, token'sız veya geçersiz token'la | 200 | IP |
| Ekip girişi | 30 başarısız deneme | Hesap + IP |
| Ekip kod kontrolü (kodlu kayıt, e-posta doğrulama, şifre sıfırlama) | 30 başarısız deneme | Hesap + IP |
| Ekip kod e-postası (send-otp, kodsuz kayıt, forgot-password) | 30 | IP |
| Katılımcı kod kontrolü | 15 başarısız deneme | Adres + IP |
| Katılımcı kod e-postası, daha önce doğrulanmamış adres | 100 | IP |
| Katılımcı kod e-postası, daha önce doğrulanmış adres | 60 sn'de 1 | Adres |
| Katılımcı e-posta tavanı dolunca | 429 `MAIL_LIMITED`, herkese aynı yanıt | Daha önce doğrulanmış adrese kod yine gider |
| Google doğrulaması | 300 başarısız deneme | IP |
| `GET /event-page/hackathon`, `GET /forms/public/:slugOrId` | Uygulama sınırı yok | Girişten önce gerekli okumalar |

Giriş ve kod uçlarının gövdesi en fazla 16 KB'dir (aşılırsa 413). Uygulama sınırları hacimsel saldırıya karşı koruma değildir; o koruma Cloudflare tarafında yapılır.

**Kayıtları açma ve kapatma yalnız ADMIN:** Yayındaki etkinlik formunda durum, tarih aralığı, kota, slug, `successMessage` dışındaki `settings` alanları, silme ve `event.register.status` değişikliği ORGANIZER için 403 döner. ORGANIZER içerik ve soruları düzenleyebilir; yayını form durumunu değiştirmez.

---

# API kullanım kılavuzu

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Güncelleme: 11 Kasım 2026 — `iyilestirme-ve-test` çalışma dalı (Commit: `b4fbf69`). Başvuru inceleme, şifre sıfırlama, e-posta profilleri ve 350 testlik doğrulama paketi dahil.

## API kullanım kuralları

Yerel API kökü: `http://localhost:5000/api/v1`. Sağlık kontrolü kök seviyede `/health` ve `/ready` yollarındadır.

- **Path parametresi:** `:id` yerine kaynak `_id` değeri; genellikle 24 karakterlik hexadecimal MongoDB ObjectId. Kullanıcı yanıtları çoğunlukla `id`, DB dokümanları çoğunlukla `_id` döndürür.
- **Query parametresi:** URL'de `?page=1&limit=10`. GET'lerin aşağıda belirtilen filtreleri isteğe bağlıdır; GET body gerekmez.
- **JSON body:** `Content-Type: application/json`. Boolean değerleri `true/false`, sayıları sayı olarak gönderin.
- **Dosya body:** `multipart/form-data`. `curl -F` veya tarayıcı `FormData` boundary'yi kendisi üretir; elle Content-Type eklemeyin.
- **Yetki:** Yönetim rotalarında ekip JWT’si (`ORGANIZER`/`ADMIN`), doğrulama isteyen form submit rotalarında katılımcı JWT’si `Authorization: Bearer <JWT>` ile gönderilir. İki token türü birbirinin yerine geçmez. Cookie tabanlı oturum uygulanmış değil.
- **Tarih:** ISO 8601 ve açık saat dilimi kullanın; örneğin `2026-11-01T18:00:00+03:00`. Yanıtlarda tarih JSON içinde ISO metnidir.

Örneklerde şu terminal değişkenleri kullanılır:

```bash
API_BASE='http://localhost:5000/api/v1'
AUTH_TOKEN='EKIP_LOGIN_YANITINDAKI_TOKEN'
PARTICIPANT_TOKEN='KATILIMCI_DOGRULAMA_YANITINDAKI_TOKEN'
FORM_ID='GERCEK_FORM_OBJECT_ID'
CONTENT_ID='GERCEK_CONTENT_OBJECT_ID'
```

Başarılı CRUD yanıtları çoğunlukla `{ "success": true, "data": ... }`; auth yanıtları `user/token`, submit yanıtı `responseId` kullanır. Export yanıtları stream olarak dosya indirir.

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

`page` en az 1'e, `limit` 1–100 aralığına sıkıştırılır. Parse edilemeyen ve sıfır değerlerde varsayılan kullanılır. Boş listede bile `totalPages: 1` gelir. Listeler tarih azalan sıradadır.

## Bütün uç noktalar

Tablodaki yollar API köküne (`/api/v1`) göredir; `/health` ve `/ready` istisnaları kök yol olarak yazılmıştır. **Ekip** = `ORGANIZER` veya `ADMIN`; **Token** = ekip JWT’si ve DB’de mevcut kullanıcı; **Katılımcı** = doğrulanmış Participant kimliği ve katılımcı JWT’si.

| No | Metot | Yol | Erişim | Girdi / çıktı özeti |
|---|---|---|---|---|
| 1 | GET | `/health` (Kök) | Public | Parametresiz; `success,message,timestamp` |
| 2 | GET | `/ready` (Kök) | Public | Parametresiz; DB bağlıysa 200 `{success:true}`, değilse 503 `{success:false}` |
| 3 | GET | `/health` (`/api/v1/health`) | Public | Parametresiz; API v1 sağlık kontrolü |
| 4 | GET | `/uploads/:filename` | Fallback / Token | Kapak görseli ise public, özel dosya ise ekip token'ı gerektirir |
| 5 | GET | `/files/:filename` | Ekip (ORGANIZER/ADMIN) | Özel başvuru dosyasını güvenli attachment indirir |
| 6 | POST | `/participant-auth/email/send-otp` | Public | `email`; süre ve yeniden gönderme beklemesi |
| 7 | POST | `/participant-auth/email/verify` | Public | `email,code`; katılımcı token’ı |
| 8 | POST | `/participant-auth/google` | Public | Google `idToken`; katılımcı token’ı |
| 9 | POST | `/auth/send-otp` | Public | `email`, isteğe bağlı `fullName` |
| 10 | POST | `/auth/register` | Public | `fullName,email,password`, tamamlamak için `code` (PENDING kullanıcı) |
| 11 | POST | `/auth/verify-email` | Public | `email,code`; e-posta doğrulama |
| 12 | POST | `/auth/login` | Public | `email,password`; `token,user` |
| 13 | POST | `/auth/forgot-password` | Public | `email`; şifre sıfırlama OTP'si gönderir |
| 14 | POST | `/auth/reset-password` | Public | `email,code,newPassword`; şifreyi sıfırlar, tokenVersion artırır |
| 15 | GET | `/auth/me` | Token | Parametresiz; aktif `user` profili |
| 16 | GET | `/users` | ADMIN | `page,role` (`PENDING/MEMBER/ORGANIZER/ADMIN`); şifresiz sayfalı kullanıcı listesi |
| 17 | PATCH | `/users/:id/role` | ADMIN | `{role}`; kullanıcı yetkisini onaylar/değiştirir |
| 18 | GET | `/content/public` | Public | `page,limit,type,search`; yayınlanan duyuru ve etkinlikler |
| 19 | GET | `/content/featured` | Public | `limit`; öne çıkan içerik listesi |
| 20 | POST | `/content` | Ekip | İçerik JSON'u veya `coverImage` dosyası |
| 21 | PUT | `/content/:id` | Ekip | Path `id`, değişecek içerik alanları |
| 22 | DELETE | `/content/:id` | Ekip | Path `id`; içeriği ve yerel görsel dosyasını siler |
| 23 | GET | `/event-page/hackathon` | Public | `{data: {event, revision, formSlug, formId}}` yayınlanan sayfa |
| 24 | PUT | `/event-page/hackathon` | Ekip | `{event, revision}`; atomik sayfa ve form yayını |
| 25 | GET | `/forms/public/:slugOrId` | Public | Path slug veya ID; yayınlanmış form şeması |
| 26 | POST | `/forms/public/:slugOrId/submit` | Form ayarına göre Katılımcı | Alan kimlikleriyle yanıt / dosyalar; varsayılan doğrulama zorunlu. `team` alanı varsa yanıt `team: {name, role, status, code?}` içerir (kod yalnız kaptana) |
| 26a | GET | `/forms/public/:slugOrId/my-submission` | Katılımcı | `{submitted, status?, submittedAt?}`; cevaplar dönmez. Kayıt sayfası daha önce başvuranı `/basvurum`'a yönlendirir |
| 26b | GET | `/forms/public/:slugOrId/teams/:code` | Katılımcı | Takım kodu önizlemesi `{name, size, maxSize, full}`; üye e-postaları dönmez, yoksa 404 |
| 26c | GET | `/forms/public/:slugOrId/my-application` | Katılımcı (başvurmuş) | Başvurum: `{status, statusNote, submittedAt, email, answers, team}`; takım cevabı `answers` içinde yok |
| 26d | PUT | `/forms/public/:slugOrId/my-application` | Katılımcı (başvurmuş) | `{answers}`; takım ve dosya hariç günceller, e-posta kilitli; durum `PENDING`'e döner (yeniden yönetici onayı) |
| 26e | POST | `/forms/public/:slugOrId/my-application/team/join` | Takımsız katılımcı | `{code}`; kaptan onayına düşen istek |
| 26e2 | POST | `/forms/public/:slugOrId/my-application/team/create` | Takımsız katılımcı | `{name}`; sayfadan takım kurar, kişi kaptan olur |
| 26e3 | POST | `…/my-application/team/transfer/code` · `…/team/transfer` | Kaptan | E-postaya kod gönderir · `{participantId, code}` ile kaptanlığı onaylı bir üyeye devreder; eski kaptan onaylı üye olarak kalır |
| 26j | GET | `/forms/:id/teams` | Ekip (ORGANIZER/ADMIN) | Tüm takımlar: kod, kişi sayısı, üyeler ve istekler (ad, e-posta, yönetici kararı, `edited`), `allApproved` |
| 26k | POST | `/forms/:id/teams/:teamId/members/:participantId/remove` | Ekip | Üyeyi çıkarır veya bekleyen isteği siler; kaptan çıkarılamaz (409) |
| 26l | POST · DELETE | `/forms/:id/teams/:teamId/captain` `{participantId}` · `/forms/:id/teams/:teamId` | Ekip | Kaptanı onaylı bir üyeyle değiştirir · takımı dağıtır (herkes bireysel olur) |
| 26f | POST | `…/my-application/team/withdraw` · `…/team/leave` | İstek sahibi · Üye | İsteği geri çek · takımdan ayrıl (kaptan ayrılamaz, 409) |
| 26g | POST | `…/my-application/team/requests/:participantId/approve` · `…/reject` | Kaptan | Katılma isteğini kabul / ret |
| 26h | POST | `…/my-application/team/members/:participantId/remove` | Kaptan | Üyeyi takımdan çıkar |
| 26i | POST | `…/my-application/team/disband/code` · `…/team/disband` | Kaptan | E-postaya kod gönderir · `{code}` ile takımı dağıtır; herkes bireysel katılıma döner |
| 27 | GET | `/forms` | Ekip | `page,limit,status,category,search`; form listesi |
| 28 | POST | `/forms` | Ekip | Form şeması JSON'u |
| 29 | GET | `/forms/:id` | Ekip | Path `id`; bütün form şeması |
| 30 | PUT | `/forms/:id` | Ekip | Path `id`, değişecek form alanları |
| 31 | PATCH | `/forms/:id/status` | Ekip | Path `id`, JSON `status` (`DRAFT/PUBLISHED/CLOSED/ARCHIVED`) |
| 32 | DELETE | `/forms/:id` | Ekip | Formu, tüm yanıtlarını ve özel dosyalarını siler (yayınlı EventPage formu ise 409 döner) |
| 33 | GET | `/forms/:id/responses` | Ekip | Path `id`; `page,limit,status,search` |
| 34 | PATCH | `/forms/:id/responses/:responseId/status` | Ekip | `{status, note, notify}`; başvuru durum inceleme ve bildirim e-postası |
| 35 | GET | `/forms/:id/responses/export` | Ekip | Path `id`; `format,status,search`; CSV veya JSON export |
| 36 | ~~POST~~ | ~~`/hackathon/send-verification`~~ | **Kaldırıldı** | 404 döner; bkz. aşağıdaki not |
| 37 | ~~POST~~ | ~~`/hackathon/apply`~~ | **Kaldırıldı** | 404 döner; bkz. aşağıdaki not |
| 38 | GET | `/hackathon/applications` | Ekip | `page,limit,search,status` |
| 39 | PATCH | `/hackathon/applications/:id/status` | Ekip | `{status, note, notify}`; hackathon başvuru durum inceleme ve bildirim e-postası |
| 40 | GET | `/hackathon/applications/export` | Ekip | `format,search,status`; CSV veya JSON export |
| 41 | GET | `/maintenance` | ADMIN | Bakım modu durumu: `active,since,by{id,name},server` (`running`/`stopped`/`external`) |
| 42 | PUT | `/maintenance` | ADMIN | `{active:boolean}`; bakım modunu açar/kapatır, güncel durumu döner |
| 43 | GET | `/jury/me` | Jüri linki | Jüri adı, kilit, kriterler, aktif kategoriler, takımlar ve kendi durumu |
| 44 | GET | `/jury/entries/:teamId` | Jüri linki | Takım, linkler ve yalnız kendi puan kartı |
| 45 | PUT | `/jury/entries/:teamId/scorecard` | Jüri linki | `{scores,nominations,generalComment,submit,round,version}`; taslak veya gönderim |
| 46 | GET | `/jury-admin/config` | Ekip | Kriter, kategori, yarışan takım, kilit, revision |
| 47 | PUT | `/jury-admin/config` | Ekip | `{criteria,categories,entries,revision}`; eski revision 409, kilitliyken 423 |
| 48 | GET | `/jury-admin/teams` | Ekip | Eklenebilecek takımlar: `id,name,code,memberCount` |
| 49 | GET | `/jury-admin/jurors` | Ekip | Jüriler, son görülme, ilerleme |
| 50 | POST | `/jury-admin/jurors` | ADMIN | `{name}`; 201 ve bir kereye mahsus `token` |
| 51 | POST | `/jury-admin/jurors/:id/regenerate` | ADMIN | Yeni token; eski link geçersiz |
| 52 | PATCH | `/jury-admin/jurors/:id` | Ekip | `{name?,active?}` |
| 53 | PUT | `/jury-admin/lock` | Ekip | `{locked:boolean}`; `false` (kilit açma) yalnız ADMIN |
| 54 | POST | `/jury-admin/scorecards/reset` | ADMIN | `{confirm:"SIFIRLA"}`; bütün puan kartlarını siler, kilitliyken 423 |
| 55 | GET | `/jury-admin/results` | Ekip | Sıralama, kategori önerileri, jüri bazında puan ve gerekçeler |
| 56 | GET | `/jury-admin/results.csv` | Ekip | Excel uyumlu döküm |
| 57 | POST | `/jury-admin/jurors/:id/scorecards/:teamId/void` | ADMIN | `{reason,version}`; tek gönderilmiş kartı iptal eder |
| 58 | GET | `/jury-admin/log` | Ekip | `before?`; işlem kaydı, en yeni önce |

Jüri modülünün 16 rotası (43-58) dışında **58 adet `/api/v1` rotası** vardır (tablodaki bazı satırlar birden çok rota içerir). Ek olarak kökte `/health`, `/ready`, `/uploads/:filename` ve `/uploads/public/<dosya-adı>` statik dosya erişimi bulunur. Hackathon kapalıysa hackathon rotaları yerine `404` döner. `/health` canlılık, `/ready` ise MongoDB veritabanı hazır mı kontrolüdür.

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

`email` zorunlu; `fullName` isteğe bağlıdır. Başarı `200`; geçersiz e-posta `400`. Zaten doğrulanmış hesap da aynı `200` yanıtını alır ama e-posta gönderilmez.

```bash
curl -X POST "$API_BASE/auth/register" \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"Ayşe Yılmaz","email":"aday@gmail.com","password":"OrnekGucluParola!","code":"123456"}'
```

`fullName` 2–100 karakter, `password` en az 8 karakter. Kod örnektir, gerçek OTP kullanılmalıdır. Kod verilmezse hesap oluşturulmaz; OTP gönderilir ve `200`, `requiresVerification: true` döner. Aynı ad/e-posta/parola ile kod eklenerek tekrar POST yapılır. Kodlu başarı `201` ve `user` döndürür; JWT verilmez. Kullanıcı `PENDING` ve `isEmailVerified: true` olur.

### Var olan hesabın e-postasını doğrulama

```bash
curl -X POST "$API_BASE/auth/verify-email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"aday@gmail.com","code":"123456"}'
```

Mevcut hesabı doğrulamak içindir. Yeni kayıt akışında `/register` için alınan kodu burada tüketmeyin; bu rota hesap oluşturmaz. Kullanıcı yoksa veya e-postası zaten doğrulanmışsa OTP tüketilmeden, yanlış kodla aynı `400` yanıtı döner.

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

Yanlış kimlik bilgileri `401`. E-posta doğrulanmamışsa yeni REGISTER OTP'si gönderilir ve `403`, `requiresVerification: true`; rol `PENDING` ise `403` döner (`Account awaiting admin approval`). PENDING durumundaki hesaplar, yöneticiler tarafından `PATCH /api/v1/users/:id/role` endpoint'i üzerinden onaylanarak `ORGANIZER` veya `ADMIN` rolüne geçirilir.

### Şifre Sıfırlama (Forgot & Reset Password)

Kullanıcı parolasını unuttuğunda 6 haneli OTP kodu ile şifresini güvenli bir şekilde sıfırlayabilir.

```bash
# 1. Şifre sıfırlama OTP kodu talep etme
curl -X POST "$API_BASE/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"organizer@pau.edu.tr"}'
```

- Girdi: `email` (zorunlu, geçerli PAU veya Gmail adresi).
- Başarı: `200 OK`, `{ "success": true, "message": "Bu e-posta adresi ile kayıtlı bir hesap varsa şifre sıfırlama kodu gönderildi." }`.
- Hata: E-posta gönderilemezse `502 Bad Gateway` (kod atomik olarak geçersiz kılınır). Kullanıcı bulunmasa da aynı `200` yanıtı döner.

```bash
# 2. OTP kodu ile yeni şifreyi belirleme
curl -X POST "$API_BASE/auth/reset-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"organizer@pau.edu.tr","code":"123456","newPassword":"YeniGucluParola2026!"}'
```

- Girdi: `email`, `code` (6 haneli metin), `newPassword` (en az 8 karakter).
- İşlem: OTP doğrulanır ve tüketilir. Kullanıcının `passwordHash` değeri bcrypt ile güncellenir ve `tokenVersion` değeri `1` artırılır. Bu sayede kullanıcının önceki tüm aktif JWT oturumları derhal geçersiz kalır.
- Başarı: `200 OK`, `{ "success": true, "message": "Şifreniz başarıyla sıfırlandı. Yeni şifrenizle giriş yapabilirsiniz." }`.

```bash
curl "$API_BASE/auth/me" -H "Authorization: Bearer $AUTH_TOKEN"
```

Query/body yok; `user` içinde `id,fullName,email,role,isEmailVerified,createdAt` döner. Auth middleware JWT'nin geçerliliğini, `tokenVersion` eşleşmesini ve kullanıcının DB'de varlığını kontrol eder. Rol middleware'i güncel DB rolünü kullanır.

## Kullanıcı Yönetimi API'si (Yönetici / Admin)

Yalnızca `ADMIN` rolündeki kullanıcılar erişebilir.

### Sayfalı Kullanıcı Listesi

```bash
curl "$API_BASE/users?page=1&role=PENDING" \
  -H "Authorization: Bearer $AUTH_TOKEN"
```

- Query: `page` (varsayılan 1), `role` (`PENDING`, `MEMBER`, `ORGANIZER`, `ADMIN`; opsiyonel).
- Çıktı: `passwordHash` içermeyen kullanıcı dokümanları ve standart 6 alanlı `pagination` zarfı (`totalItems`, `totalPages`, `currentPage`, `limit: 50`, `hasNextPage`, `hasPrevPage`).

### Kullanıcı Rolü Değiştirme ve Onaylama

```bash
curl -X PATCH "$API_BASE/users/$TARGET_USER_ID/role" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"role":"ORGANIZER"}'
```

- Girdi: `role` (`PENDING`, `MEMBER`, `ORGANIZER`, `ADMIN`).
- Güvenlik Kuralları:
  1. Yönetici kendi rolünü değiştiremez (self-demotion koruması: `400 Bad Request`).
  2. Eşzamanlı çapraz rol düşürmelerini engellemek için işlem MongoDB transaction içinde yürütülür ve aktörün `roleChangeVersion` alanı artırılır.
  3. E-postası doğrulanmamış kullanıcılar `PENDING` dışında bir role geçirilemez (`400`).
  4. Rol değiştiğinde kullanıcının `tokenVersion` değeri artırılarak önceki yetkili oturumları sonlandırılır.
- Başarı: `200 OK`, güncellenen kullanıcı dokümanı.

## Etkinlik Sayfası (Event Page) ve Özel Dosya API'si

### Hackathon Etkinlik Sayfası Yayını

Hackathon vitrin sitesi dinamik içeriklerini (`event`) ve form slug'ını bu API üzerinden çeker ve günceller.

```bash
# Yayınlanmış sayfayı okuma (Public)
curl "$API_BASE/event-page/hackathon"
```

- Başarı: `200 OK`, `{ "success": true, "data": { "_id": "hackathon", "event": { ... }, "revision": 3, "formSlug": "hackathon-katilim", "formId": "OBJECT_ID" } }`. Henüz sayfa yayınlanmamışsa `503 Service Unavailable`. `Cache-Control: no-cache` ile döner.

```bash
# Etkinlik sayfasını güncelleme (ADMIN / ORGANIZER)
curl -X PUT "$API_BASE/event-page/hackathon" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"event": { "name": "PAU Hackathon 2026", ... }, "revision": 3}'
```

- İşlem: İstekteki `revision` DB'deki güncel `revision` ile eşleşmelidir. Eşleşirse atomik transaction ile sayfa güncellenir ve `revision` 1 artırılır; eşleşmezse `409 Conflict` döner.

### Özel Başvuru Dosyalarını Güvenli İndirme

Katılımcıların yüklediği CV, portfolyo ve form ekleri (/uploads/private/) genel web erişimine kapalıdır.

```bash
curl "$API_BASE/files/$FILENAME" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -o indirilen_dosya.pdf
```

- Yetki: `ORGANIZER` veya `ADMIN`.
- Güvenlik: Path traversal (`..`) ve gizli dosya (`.`) girişimleri `400 Bad Request` ile engellenir. `Cache-Control: private, no-store` başlığı eklenir ve dosya binary stream olarak `Content-Disposition: attachment` ile indirilir.

### Sistem Hazır Olma Kontrolü (Readiness Check)

```bash
curl "http://localhost:5000/ready"
```

- Kök seviyededir (prefix'siz).
- DB bağlı (`readyState === 1`) ise `200 OK`, `{ "success": true }`.
- DB kopuksa `503 Service Unavailable`, `{ "success": false }`. Kubernetes ve Docker healthcheck için kullanılır.

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
| `coverImageUrl` | Hayır | Görsel URL'si (`http(s)://` veya göreli `/uploads/public/...` dışı ve `javascript:` şemaları `400` ile reddedilir) |
| `coverImage` | Hayır | Multipart dosya alanı; varsa URL alanından öncelikli |
| `bevyLink` | Hayır | Harici `http(s)://` veya `/uploads/public/...` bağlantısı; boşsa null (`400` protokol doğrulamalı) |
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

PUT ve DELETE başarı `200`; bulunamayan içerik `404`. İçerik silme ve yeni görselle güncelleme işlemleri eski yerel `/uploads/public/` kapak dosyasını diskten (`unlink`) temizler; `updatedAt` tutulmaz.

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
| `type` | `text`, `textarea`, `number`, `email`, `phone` (ön yüz `eventContent.mjs` `tel` türü `eventPageService` üzerinden `phone`'a eşlenir), `select`, `radio`, `checkbox`, `file`, `date`; varsayılan text |
| `required` | Boolean, false; JSON boolean gönderilmeli (`"false"` metni controller'da true olur) |
| `options` | Metin dizisi; `[]` |
| `validation.min/max` | Sayı veya null |
| `validation.regex` | Güvenli RegExp deseni veya null (`safePattern` ile modelde ve submit anında `answerError` ile doğrulanır) |
| `order` | Sayı; verilmezse dizi indeksi |

### GET çağrıları ve değişkenler

| Endpoint | Zorunlu | İsteğe bağlı query |
| --- | --- | --- |
| `/forms` | Bearer token | `page=1`, `limit=10` (en fazla 100), `status`, `category`, `search` |
| `/forms/:id` | Token ve form ID | Yok |
| `/forms/public/:slugOrId` | Slug veya ID | Yok; token gerekmez |
| `/forms/:id/responses` | Token ve form ID | `page=1`, `limit=20` (en fazla 100), `status` (`PENDING/APPROVED/REJECTED`), `search` |
| `/forms/:id/responses/export` | Token ve form ID | `format=csv` veya `json` (varsayılan `csv`), `status`, `search` |

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

Metinleri ayrı `-F 'fullName=...'` alanlarıyla da gönderebilirsiniz. Çoklu seçim için JSON metni içindeki dizi daha nettir. File sorusu yalnız yüklenen dosyayı kabul eder; dosya yerine gönderilen metin veya URL yok sayılır.

Submit'in uyguladığı kurallar:

- Dosya yazılmadan önce katılımcı kimliği ve formun kabul ettiği doğrulama yöntemi kontrolü.
- Form yayın durumu, başlangıç/bitiş tarihi ve transaction içinde kota kontrolü.
- Tek başvurulu formda aynı katılımcının tekrar kaydının engellenmesi.
- Required alanların eksik, null, boş metin veya boş dizi kontrolü.
- E-posta **metin** değerine temel format kontrolü.
- Number için `Number(value)` ile sayı kontrolü ve min/max karşılaştırması; kaydedilen değer otomatik olarak number'a normalize edilmiyor.
- `phone` (telefon regex + uzunluk), `date` (`YYYY-MM-DD` geçerlilik kontrolü), `select`/`radio` (`options` içi eşleşme), `checkbox` (dizi ve tekil seçenek kontrolü) ve `validation.regex` (`safePattern`) `answerError` üzerinden sunucuda doğrulanır; `fieldId` değerlerinin form içinde benzersizliği (`^[a-zA-Z][a-zA-Z0-9_]{0,99}$`) model `pre('validate')` kancasında zorlanır.

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
curl "$API_BASE/forms/$FORM_ID/responses/export?format=csv&status=APPROVED&search=Pamukkale" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o form-yanitlari.csv
curl "$API_BASE/forms/$FORM_ID/responses/export?format=json" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o form-yanitlari.json
```

PUT verilen üst alanları günceller. **`fields` gönderilirse bütün soru dizisini değiştirir**; tek bir soruyu eklemek için mevcut sorular da gönderilmeli. Eski cevaplar değiştirilmez. `fieldId` değişimi eski cevapların CSV'de eşleşmesini bozar. Slug değişimi eski FormResponse kayıtlarındaki `formSlug` değerini güncellemez. `settings` mevcut alanları koruyarak kısmi birleştirilir; doğrulama yönteminin ve tek başvuru ayarının korunduğu entegrasyon testiyle doğrulandı.

Desteklenen Form Alan Türleri (10 Tür):
- `text`: Tek satırlık metin girişi.
- `textarea`: Çok satırlı metin girişi.
- `email`: E-posta adresi (regex ve format kontrolü).
- `tel` / `phone`: Telefon numarası.
- `select`: Açılır liste tekli seçim.
- `checkbox`: Çoklu seçim kutusu dizisi.
- `radio`: Tek seçenek işaretleme.
- `file`: Dosya yükleme (PDF, PNG, JPG, DOCX; en fazla 5MB).
- `number`: Sayısal değer (min/max doğrulamalı).
- `date`: Tarih seçici (ISO 8601).

CSV sütunları (`formController.js`): `Yanıt ID`, `Tarih`, `Başvuru Durumu`, `Değerlendirme Notu`, `IP Adresi`, `Doğrulanmış E-posta`, `Doğrulama Yöntemi`, güncel/tarihsel soru etiketleri (`fields`), `Eklenen Dosyalar`. JSON, ham yanıt dokümanları dizisidir. UTF-8 BOM'lu CSV üretilir. Dosya `,`, `;` veya sekmeyle bölünse de formül başlatabilecek parçaların başına `'` konur. Export `status` ve `search` filtrelerini destekler; format belirtilmezse varsayılan CSV'dir.

DELETE `/forms/:id` body almadan formu, bütün yanıtlarını ve ekli özel dosyaları (`/uploads/private/`) atomik transaction sonrasında diskten siler; başarı `200` döner. Form yayındaki bir `EventPage`'e bağlıysa silme yerine kapatma isteyerek `409 Conflict` döndürür.

### Form Yanıtı Durum İnceleme ve Bildirim API'si

Yöneticiler ve organizatörler gelen form başvurularını inceleyerek onaylayabilir (`APPROVED`), reddedebilir (`REJECTED`) veya tekrar beklemeye alabilir (`PENDING`). İsteğe bağlı olarak katılımcıya özel not içeren durum bildirim e-postası tetiklenebilir.

```bash
curl -X PATCH "$API_BASE/forms/$FORM_ID/responses/$RESPONSE_ID/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "APPROVED",
    "note": "Başvurunuz ve portfolyonuz değerlendirildi. Tebrikler!",
    "notify": true
  }'
```

- **Yetki:** `ORGANIZER` veya `ADMIN`.
- **Girdi Parametreleri:**
  - `status` (Zorunlu, String enum): `'PENDING'`, `'APPROVED'`, `'REJECTED'`.
  - `note` (İsteğe bağlı, String): En fazla 1000 karakterlik inceleme veya geribildirim notu.
  - `notify` (İsteğe bağlı, Boolean): `true` ise Brevo üzerinden adaya bildirim e-postası gönderilir.
- **İşlem Mantığı:**
  1. `FormResponse` dokümanında `status`, `statusNote`, `reviewedBy` (giriş yapan kullanıcı ID'si) ve `reviewedAt` (tarih) alanları güncellenir.
  2. `notify: true` ise `applicationStatusService` adayın e-posta adresini çözer (sırasıyla `verifiedEmail`, form içi `email` alanı veya `answers`).
  3. Brevo Transactional Email servisi (`emailService.js`) üzerinden `applicationStatus` profili kullanılarak HTML kaçışlı ve CRLF korumalı bildirim e-postası iletilir.
  4. Gönderim başarılı olduğunda `lastNotifiedStatus` ve `lastNotifiedAt` dokümana işlenir.
- **Başarı Yanıtı (`200 OK`):**
  ```json
  {
    "success": true,
    "emailSent": true,
    "message": "Başvuru onaylandı ve katılımcıya bilgilendirme e-postası gönderildi.",
    "data": {
      "_id": "67320b...",
      "form": "67320a...",
      "status": "APPROVED",
      "statusNote": "Başvurunuz ve portfolyonuz değerlendirildi. Tebrikler!",
      "reviewedBy": "673209...",
      "reviewedAt": "2026-11-11T14:00:00.000Z",
      "lastNotifiedStatus": "APPROVED",
      "lastNotifiedAt": "2026-11-11T14:00:01.000Z"
    }
  }
  ```

## Hackathon API'si

### Herkese açık eski başvuru uçları kaldırıldı

`POST /hackathon/send-verification` ve `POST /hackathon/apply` artık yok (404). Bu uçlar admin panelindeki **Kayıtlar** iznini (kayıtları kapatma) atlatıyor ve kimlik doğrulama hız sınırının dışında e-posta gönderebiliyordu. Yeni başvurular yalnızca dinamik form akışından alınır: katılımcı doğrulaması (`/participant-auth/*`) + `POST /forms/public/:slug/submit`. Daha önce `HackathonApp` koleksiyonuna kaydedilmiş başvurular aşağıdaki personel uçlarıyla görüntülenmeye, durumları güncellenmeye ve dışa aktarılmaya devam eder.

### Listeleme ve export GET değişkenleri

`/hackathon/applications`: token zorunlu; `page=1`, `limit=10` (1–100), `status` (`PENDING`, `APPROVED`, `REJECTED`) ve `search` isteğe bağlı. Search takım adı, lider adı ve lider e-postasında literal regex arar. Sıra `appliedAt` azalan.

```bash
curl --get "$API_BASE/hackathon/applications" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  --data-urlencode 'search=Kod Takımı' --data-urlencode 'status=APPROVED' \
  --data-urlencode 'page=1' --data-urlencode 'limit=20'
curl "$API_BASE/hackathon/applications/export?format=csv&status=APPROVED&search=Kod" \
  -H "Authorization: Bearer $AUTH_TOKEN" -o hackathon-basvurulari.csv
```

Export `format=json` için ham başvuru dizisi; diğer değerler (`json`/`csv` dışı `400`) ve eksik format için CSV verir. Liste `search` ve `status` filtreleri export'a da uygulanır. CSV sütunları: `ID`, `Takım Adı`, `Lider Adı`, `Lider E-posta`, `Lider Telefon`, `Üye Sayısı`, `Proje Fikri`, `Özgeçmiş / CV Linki`, `Başvuru Tarihi`, `Durum`, `Değerlendirme Notu`.

### Hackathon Başvuru Durum İnceleme API'si

```bash
curl -X PATCH "$API_BASE/hackathon/applications/$APPLICATION_ID/status" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "APPROVED",
    "note": "Proje fikriniz hackathon jürisi tarafından onaylandı.",
    "notify": true
  }'
```

- Takım liderine (`leaderEmail`) otomatik bildirim gönderir.
- Yanıt modelinde `emailSent`, durum mesajı ve güncellenmiş başvuru verisi döner.

## Proje Yükleme (proje.gdgocpamukkale.com)

Takımlar GitHub proje linklerini ayrı bir sitede (`hackaton-proje-yukleme` projesi) ekler. Link takım başına tektir, onaylı her üye değiştirebilir; her değişiklik kişi ve zamanla `ProjectSubmission.history` içinde saklanır. Aynı repo iki takıma eklenemez. Admin, panelin **İzinler** sayfasından "Proje yükleme"yi kapatınca linkler kilitlenir; site ve commit geçmişi görüntülenmeye devam eder (`projectUpload` izni, `PUT /api/v1/forms/:id/permissions`).

### Siteye geçiş (katılımcı)

| Metot | Yol | Açıklama |
|---|---|---|
| POST | `/api/v1/forms/public/:slugOrId/my-application/project-upload` | Katılımcı token'ı gerekir. Onaylı takım üyesine 24 saatlik giriş anahtarı üretir: `{ url: "<PROJECT_UPLOAD_URL>/#t=<token>", expiresAt }`. Takımsız → 409 `NO_TEAM`, onay bekleyen → 409 `TEAM_PENDING`, yapılandırılmamış → 503. |

Anahtar `PROJECT_UPLOAD_SECRET` ile imzalı bir JWT'dir (`aud: project-upload`, `sub`: katılımcı, `team`, `teamName`). URL'nin `#` kısmında taşındığı için sunuculara, loglara ve Referer'a gitmez. Yükleme sitesi onu bitiş saatine kadar geçerli httpOnly bir çereze çevirir.

### İç API (yalnız yükleme sitesinin backend'i)

`/api/v1/internal/project-upload` altında; `X-Internal-Key: <PROJECT_UPLOAD_INTERNAL_KEY>` başlığı gerekir (anahtar yoksa uçlar 404, yanlışsa 401). nginx bu yolu yalnız özel Docker ağından gelen isteklere açar; genel IP limitine sayılmaz.

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/teams/:teamId/state?participant=<id>` | `{ member, reason, team: { id, name }, open, submission, eventStartsAt }`. `reason`: `NOT_MEMBER` / `TEAM_GONE`. `submission`: `{ repoUrl, updatedBy, updatedAt, history[] }` (son 10 değişiklik, yalnız ad). |
| PUT | `/teams/:teamId/submission` | Gövde `{ participant, repoUrl }`. Üyelik ve izin kaydetme anında denetlenir. Hatalar: 400 `INVALID_REPO`, 403 `NOT_MEMBER` / `UPLOAD_CLOSED`, 409 `REPO_TAKEN`. Aynı repo (büyük/küçük harf farkı dahil) yeniden kaydedilirse değişiklik sayılmaz. |

Ortam değişkenleri: `PROJECT_UPLOAD_URL`, `PROJECT_UPLOAD_SECRET`, `PROJECT_UPLOAD_INTERNAL_KEY` (bkz. `backend/.env.example`).

## Canlı Sunum ve Oylama (Proje değerlendirme)

Panelin **İzinler** sayfasındaki "Proje değerlendirme" (`projectEvaluation`, varsayılan kapalı) açılınca jürideki yarışan takımlar bir kez rastgele sıralanır; kapatıp açmak sırayı değiştirmez. Admin `/admin/juri` > **Sunum akışı** sekmesinden sunan takımın oylamasını başlatır; jüriler yalnız o takımı puanlayabilir. Bütün **aktif** jüriler kartını göndermeden oylama bitirilemez (`force: true` ile onaylanarak bitirilebilir, eksikler işlem kaydına yazılır). Oylaması biten takım kalıcı olarak kilitlenir (değerlendirme sonradan kapatılsa da); yalnız ADMIN yeniden açabilir. Değerlendirme kapalıyken jüri eskisi gibi serbest puanlar (sahnede akış bozulursa yedek yol).

| Metot | Yol | Yetki | Açıklama |
|---|---|---|---|
| GET | `/api/v1/jury-admin/live` | ORGANIZER, ADMIN | `{ open, locked, started, order[{ team, teamName, projectName, position, state }], current, next, votes[{ id, name, active, status }] }`; `state`: `WAITING` / `VOTING` / `CLOSED`, `status`: `NONE` / `DRAFT` / `SUBMITTED`. |
| POST | `/api/v1/jury-admin/live/start` | ORGANIZER, ADMIN | `{ team }`. Hatalar: `EVALUATION_CLOSED`, `JURY_LOCKED`, `VOTING_IN_PROGRESS`, `VOTING_CLOSED`, `ENTRY_NOT_FOUND`. |
| POST | `/api/v1/jury-admin/live/end` | ORGANIZER, ADMIN | `{ force? }`. Eksik oy varsa 409 `VOTES_MISSING` (mesajda jüri adları). |
| POST | `/api/v1/jury-admin/live/reopen` | ADMIN | `{ team }`: bitmiş takım yeniden oylanabilir olur. |
| POST | `/api/v1/jury-admin/live/shuffle` | ADMIN | Yeni rastgele sıra; ilk oylama başladıktan sonra 409 `LIVE_STARTED`. |
| GET | `/api/v1/presentation` | herkese açık | Başvurum sayfası için: `{ open, current: { name, position } \| null, order[{ position, name, state }] }` (yalnız takım adları). Kendi IP başına geniş limiti vardır, sonuç 2 sn önbellekte. |

Jüri tarafında `GET /api/v1/jury/me` ayrıca `live: { open, current }` ve her takım için `live` (durum) ile `writable` döner; yazılamayan takıma kayıt 423 `VOTING_NOT_OPEN` / `VOTING_CLOSED` ile reddedilir. Jüri ekranı canlı oylama açıkken 4 sn'de bir yenilenir. Jüri ayarında repo linki boş olan takımın linki proje yükleme sitesinden gelir.

## Bakım Modu ("Tadilattayız" sayfası)

Panelde **Bakım** sekmesinden (yalnızca ADMIN) açılıp kapatılır. Açıkken katılımcı sitesindeki bütün sayfalar 503 ile `frontend/hackaton/public/maintenance.html` sayfasını gösterir; panel ve API çalışmaya devam eder.

Durumun tek kaynağı diskteki bayrak dosyasıdır (`.maintenance/active.json`, veritabanı değil). Böylece backend veya MongoDB kapalıyken de sayfa açık kalır:

| Ortam | Sayfayı kim gösterir |
|---|---|
| Yerel `npm run dev` | Backend, bakım açılınca `maintenance/server.mjs` sürecini kendi süreç ağacının dışında başlatır. Bu süreç backend, panel ve site kapatılsa da 5173'te sayfayı gösterir, bayrak silinince kendiliğinden kapanır. Vite açıkken portu Vite kullanır (`maintenance-plugin.js` aynı sayfayı gösterir, açık sekmeleri yeniler); Vite kapanınca bağımsız sunucu portu devralır, Vite açılınca portu geri ister. Backend açılışta bayrak varsa bağımsız sunucuyu yeniden başlatır. |
| `compose.yaml` | Bayrak `./.maintenance` ile backend ve site container'ı arasında paylaşılır; sayfayı sitenin Vite eklentisi gösterir. |
| `compose.prod.yaml` | Bayrak nginx'e salt okunur bağlanır; nginx `location /` isteklerine 503 ve bakım sayfası döner (backend kapalı olsa da). |

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `MAINTENANCE_DIR` | `<repo>/.maintenance` | Bayrak ve pid dosyasının klasörü |
| `MAINTENANCE_STANDALONE` | (açık) | `false` ise backend bağımsız sunucuyu başlatmaz (Docker / üretim) |
| `MAINTENANCE_PORT` / `MAINTENANCE_HOST` | `5173` / `localhost` | Bağımsız sunucunun dinlediği adres |

## Jüri Puanlama API'si

Kaynak: [jüri spec'i](JURI_PUANLAMA_SPEC.md), kod: `backend/src/modules/jury`. Spec'ten farklı veya spec'te açık olmayan kararlar:

| Konu | Davranış |
| --- | --- |
| Hız limiti | Jüri rotaları genel limite girmez ve geçerli jüri veya personelin önünde IP'ye bağlı sınır yoktur. Jüri başına 900, personel oturumu başına 2000 istek (15 dk). IP başına 30 sınırı yalnız **başarısız** kimlik kontrollerine uygulanır. Gövde, kimlik doğrulanmadan okunmaz. Hacimsel saldırıya karşı koruma uygulamada değil Cloudflare'dedir. |
| Kilit | Puanların yanında kriter, kategori, takım, sıra, linkler, sıfırlama ve kart iptali de donar (ADMIN dahil, 423). ORGANIZER kilitleyebilir ama açamaz: kilidi yalnız ADMIN açar. Kilitleme ve açma işlem kaydına düşer. |
| Link yetkisi | Jüri linkini yalnız ADMIN oluşturur ve yeniler. Linke sahip olan o jüri adına puan verebilir. |
| Kart iptali | Yalnız ADMIN, gerekçe zorunlu. Kart boş taslağa döner ve hesaptan çıkar; jüri iptali görür, gerekçeyi görmez. Eski puanlar işlem kaydında kalır. |
| İşlem kaydı | Yönetim tarafındaki her değişiklik, işlemle aynı transaction'da yazılır. Düzenleme veya silme ucu yoktur. Veritabanına erişebilen kişiye karşı kanıt niteliği taşımaz. |
| Aynı link, iki sekme | Sekmeler cihazdaki tek taslağı paylaşır; bir sekme diğerinin yedeğini silmez veya ezmez. |
| Link gizliliği | Nginx logunda `/juri/` sonrasındaki token biçimli parça (24+ base64url karakter) gizlenir, isteğin geri kalanı okunur kalır. Cloudflare, Nginx Proxy Manager ve nginx hata kaydı linki tam görebilir. |
| Gönderilmiş kart | `submit:false` ile değişmez (409). Değişiklik yalnız yeniden `submit:true` ile geçerli olur; ekranda o ana kadar uyarı görünür. |
| Ödül önerisi | Yalnız ödül almamış adaylar arasından yapılır. Spec §4.5'teki puana düşme hiçbir kategoride uygulanmaz. Uygun aday yoksa `reason: "NO_ELIGIBLE_NOMINEE"`, ekranda "Uygun aday kalmadı, jüri karar versin". |
| Kriteri boş kategori | Adaylık sayısına göre sıralanır. Hiç aday gösterilmediyse `reason: "NO_NOMINATION"`, ekranda "Aday yok, jüri karar versin". |
| Puan kartı varken | Kriter eklenemez, silinemez, anahtarı değişemez. Kategori silinemez, pasifleştirilir. |
| Pasif kategori | Eski adaylık kaydı bozmaz ve hesaba girmez. |
| Pasif jüri | Linki çalışmaz. Gönderdiği kartlar hesapta kalır; gerekirse tek tek iptal edilir. |
| Dağıtılan takım | Adı `entries.teamName` kopyasından okunur. Puanı varsa listeden çıkarılamaz. |
| Linkler | Proje adı ve linkler boş olabilir; puanlamayı engellemez. |
| Sıfırlama | Yalnız ADMIN, `{"confirm":"SIFIRLA"}`, puanlama açıkken. Tur (`round`) artar, cihazlarda kalan eski taslaklar kabul edilmez. İşlem kaydı silinmez. |

### Jüri uçları

`Authorization: Bearer <jüri token'ı>`. Token, admin'in oluşturduğu `/juri/<token>` linkindedir. Ekip JWT'si burada, jüri token'ı da yönetim uçlarında geçmez. Jüri başka jürilerin puanlarını ve sonuçları göremez.

`GET /jury/me`:

```json
{
  "success": true,
  "data": {
    "juror": { "id": "JUROR_ID", "name": "Ayşe Yılmaz" },
    "locked": false,
    "round": 1,
    "criteria": [{ "key": "technical", "label": "Teknik uygulama ve çalışırlık", "description": "...", "weight": 25 }],
    "categories": [{ "key": "wow", "name": "Vay Be", "icon": "🚀" }],
    "entries": [{ "team": "TEAM_ID", "teamName": "Kod Kurtları", "projectName": "", "order": 1, "status": "NONE" }]
  }
}
```

`GET /jury/entries/:teamId` yanıtı `{entry, locked, round, scorecard}` biçimindedir. `entry` linkleri içerir; `scorecard` yalnız bu jürinindir, yoksa `null`. İptal edildiyse `voidedAt` doludur; gerekçe dönmez.

`PUT /jury/entries/:teamId/scorecard`:

```json
{
  "submit": false,
  "round": 1,
  "version": 0,
  "scores": [{ "criterion": "technical", "value": 4, "comment": "Canlı demoda çalıştı" }],
  "nominations": ["wow"],
  "generalComment": ""
}
```

- `round`: `GET /jury/me` yanıtındaki tur. `version`: kartın son bilinen sürümü, kart yoksa `0`.
- `value`: 1-5 tam sayı veya `null`. `comment` en fazla 1000, `generalComment` en fazla 2000 karakter.
- `submit:false` eksik puanı kabul eder. `submit:true` bütün kriterleri ister.
- Gövde kartın tamamıdır; gönderilmeyen kriter boş kaydedilir.
- Başarı `{scorecard}` döndürür; sonraki kayıtta onun `version` değeri gönderilir.

| HTTP | `code` | Anlamı |
| --- | --- | --- |
| 400 | `SCORES_MISSING` | Gönderimde eksik kriter var; mesajda adları yazar |
| 400 | `UNKNOWN_KEY` | Bilinmeyen kriter veya kategori |
| 401, 429 | `JURY_LINK_INVALID` | Token geçersiz, yenilenmiş veya jüri pasif. Aynı IP'den 30 başarısız denemeden sonra 429; geçerli token bundan etkilenmez |
| 404 | `ENTRY_NOT_FOUND` | Takım yarışan takımlar arasında değil |
| 409 | `SCORECARD_SUBMITTED` | Gönderilmiş kart taslakla değiştirilmek istendi |
| 409 | `SCORECARD_CONFLICT` | Kart başka sekme veya cihazda değişti |
| 409 | `JURY_RESET` | `round` eski; kartlar sıfırlanmış |
| 423 | `JURY_LOCKED` | Puanlama kilitli |
| 429 | `RATE_LIMITED` | Bu jürinin 900 istek sınırı |

Biçim hataları (tür, uzunluk, aralık) `code` alanı olmadan 400 döner.

### Yönetim uçları

Ekip JWT'si ve `ORGANIZER`/`ADMIN` rolü gerekir; link oluşturma/yenileme, kilit açma, sıfırlama ve kart iptali yalnız `ADMIN`. Rol token'dan değil veritabanından okunur. Arayüz: `/admin/juri`.

- `GET /jury-admin/config`: `{revision, locked, round, criteria, categories, entries, scorecardCount}`. Her `entries` öğesinde ayrıca `teamMissing` ve `scorecardCount` bulunur.
- `PUT /jury-admin/config`: `{revision, criteria, categories, entries}` ayarın tamamını değiştirir.
  - Ağırlıklar tam sayıdır ve toplamı 100'dür; kategori öncelikleri ve sunum sıraları benzersizdir; linkler `http(s)://` ile başlar.
  - `teamName` sunucuda belirlenir.
  - Çakışma ve koruma kodları: `CONFIG_CONFLICT`, `CRITERIA_FROZEN`, `CATEGORY_IN_USE`, `ENTRY_HAS_SCORES` (hepsi 409). Kilitliyken `CONFIG_LOCKED` (423).
- `PUT /jury-admin/lock`: `{locked}`. `false` yalnız ADMIN, diğer rollere 403 `UNLOCK_ADMIN_ONLY`. `revision` değerini artırmaz. Kilitliyken ayar kaydı 423 döner; kilit açılınca açık düzenleme aynı `revision` ile kaydedilebilir.
- `POST /jury-admin/jurors` ve `POST /jury-admin/jurors/:id/regenerate`: `{juror, token}`. Düz token yalnız bu yanıtta döner.
- `POST /jury-admin/scorecards/reset`: `{deleted, config}`. Bütün puan kartlarını kalıcı siler; takımlar, jüriler ve linkler kalır.
- `POST /jury-admin/jurors/:id/scorecards/:teamId/void`: `{reason, version}`. `reason` zorunlu (en fazla 500), `version` sonuçlarda görülen kartın sürümüdür.
  - 404 `SCORECARD_NOT_FOUND`; 409 `SCORECARD_NOT_SUBMITTED` veya `SCORECARD_CONFLICT` (jüri bu arada yeniden gönderdi); 423 `CONFIG_LOCKED`.
- `GET /jury-admin/log?before=<id>`: `{items, next}`, sayfa başına 50. Her kayıt `id, at, action, target, details, actor{name,email,role}`.
  - `action`: `JUROR_CREATED`, `LINK_REGENERATED`, `JUROR_RENAMED`, `JUROR_ACTIVATED`, `JUROR_DEACTIVATED`, `CONFIG_UPDATED`, `LOCKED`, `UNLOCKED`, `SCORECARDS_RESET`, `SCORECARD_VOIDED`.
- `GET /jury-admin/results`:
  - `ranking[]`: `rank, overall, judgeCount, criterionAverages, nominationCounts, missingJurors, cards` (jüri bazında puan ve gerekçeler).
  - `categories[]`: `winner, top` (en fazla 3), `reason, tie, awardedNominees`. Bunlar öneridir. `reason` öneri yoksa `NO_NOMINATION`, `NO_ELIGIBLE_NOMINEE` veya `NO_TEAM` (gönderilmiş kart yok) olur.
  - Puanlar yuvarlanmadan döner.
- `GET /jury-admin/results.csv`: yalnız gönderilmiş kartlar; takım × kriter × jüri. UTF-8 BOM, `;` ayırıcı ve ondalık virgül kullanır (Türkçe Excel). Dosya `,`, `;` veya sekmeyle bölünse de formül başlatabilecek parçaların başına `'` konur.

```bash
curl -X PUT "$API_BASE/jury-admin/lock" \
  -H "Authorization: Bearer $AUTH_TOKEN" -H 'Content-Type: application/json' \
  -d '{"locked":true}'
curl "$API_BASE/jury-admin/results.csv" -H "Authorization: Bearer $AUTH_TOKEN" -o juri_sonuclari.csv
```

### Etkinlik günü

1. Provadan sonra puanlama açıkken ADMIN hesabıyla **Puan kartlarını sıfırla**. Jüri linklerini de ADMIN oluşturur; etkinlikte en az bir ADMIN hazır bulunsun.
2. Ekip oturumu varsayılan 12 saat sürer: sunumlardan önce (18.00 civarı) yeniden giriş yapın.
3. Kilitlemeden önce sonuç ekranındaki "taslakta" ve "jüri eksik" uyarılarını kontrol edin. Gönderilmiş kart üzerindeki gönderilmemiş değişiklik yalnız jürinin cihazındadır, admin ekranında görünmez; jürilere sorun.
4. Kilitten sonra **İşlem kaydı**nı gözden geçirin: beklenmeyen kilit açma, ayar değişikliği veya link yenileme olmamalı.
5. Puanlama sırasında deploy yapmayın: deploy siteyi bakım moduna alır.

## E-posta Gönderici Profilleri Yapılandırması (Brevo)

Sistemde giden e-postaların kimden gittiğini ve yanıt adresini modüler olarak özelleştirmek için profil altyapısı tanımlıdır:

| Değişken Adı | Varsayılan Değer | Açıklama |
|---|---|---|
| `BREVO_API_KEY` | Yok (Console log fallback) | Brevo v3 SMTP API anahtarı |
| `BREVO_SENDER_EMAIL` | `noreply@pau.edu.tr` | Genel gönderici e-posta adresi |
| `BREVO_SENDER_NAME` | `GDG On Campus Pamukkale University` | Genel gönderici görünen adı |
| `BREVO_REPLY_TO` | `""` (Boş) | Genel yanıtlama e-posta adresi |
| `BREVO_APPLICATION_SENDER_EMAIL` | `BREVO_SENDER_EMAIL` | Başvuru durum bilgilendirmeleri gönderici adresi |
| `BREVO_APPLICATION_SENDER_NAME` | `BREVO_SENDER_NAME` | Başvuru durum bilgilendirmeleri gönderici adı |
| `BREVO_APPLICATION_REPLY_TO` | `BREVO_REPLY_TO` | Başvuru durum bilgilendirmeleri yanıt adresi |

### İki farklı hackathon veri akışı

Seed'in dinamik hackathon formuna gönderilen başvuru **FormResponse** koleksiyonuna gider. **HackathonApp** koleksiyonu yalnızca kaldırılan `/hackathon/apply` ucunun eski kayıtlarını tutar; yeni kayıt eklenmez. Dinamik formun `category:HACKATHON` olması onu hackathon modülüne bağlamaz; iki kayıt havuzu otomatik birleşmez, aynı OTP kuralları uygulanmaz. Hackathon modülünü kapatmak yayınlanmış dinamik hackathon formunu kapatmaz.
