# Dosya yönetimi, güvenlik ve hatalar

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Güncelleme: 12 Ekim 2026 — `feature/participant-verification` çalışma ağacı. Katılımcı doğrulaması ve testler dahil.

### Dosya davranışı

| Kullanım | Multipart alanı | Dosya başına sınır | Filtrede hedeflenen türler |
| --- | --- | --- | --- |
| İçerik afişi | `coverImage` | 5 MiB | jpg/jpeg/png/webp/gif |
| Hackathon CV | `resume` | 10 MiB | pdf/doc/docx |
| Form eki | İlgili `fieldId` | 15 MiB | jpg/jpeg/png/webp/gif/pdf/doc/docx/zip/rar/txt |

Dosyalar `backend/uploads/` altına ad + zaman + rastgele ek ile yazılır. DB'de dosya içeriği değil URL/metadata tutulur. Bulut depolama entegrasyonu yoktur. URL `req.protocol` ve istemci Host başlığından üretilir; reverse proxy/TLS ortamı için `trust proxy` ve güvenilir public URL yapılandırması henüz yok.

**CV ve form ekleri de `/uploads` altında token olmadan erişilebilir.** Rastgele dosya adı erişim kontrolü sağlamaz. Filtreler regex ile uzantı/MIME kontrolü yapıyor; özellikle regex'ler tam eşleşmeye sabitlenmediği için beklenmeyen uzantıların geçmesi mümkün. Dosya içeriğinin gerçek türü veya zararlı içerik taranmıyor. Form upload `.any()` kullandığı için şemada bulunmayan alan adlarıyla dosya da kabul edebilir. Dosya adedi/toplam boyut sınırı tanımlanmamış.

Dinamik formda katılımcı middleware’i upload’dan önce kimliği kontrol eder. Alan ve tarih/durum doğrulaması upload’dan sonra yapılır; controller reddedilen başvurunun dosyalarını finally bloğunda silmeye çalışır. Silme/değiştirme rotaları ve özel hackathon başvurusu için aynı dosya yaşam döngüsü güvencesi yoktur; süreç çökmesi ve disk hataları da yetim dosya bırakabilir. Yedekler hem MongoDB'yi hem upload dizinini kapsamalıdır.

### Güvenlik kontrolleri

Helmet başlıkları, tek-origin CORS, JWT doğrulaması, güncel DB rolüne göre erişim, bcrypt ve rate limit var. Genel API limiti IP başına 15 dakikada 200; login/register ek limiti 15 dakikada 30. Katılımcı doğrulama prefix’inde ek IP limiti 15 dakikada 30’dur; e-posta OTP’sinde env’den ayarlanan cooldown vardır. Ekip/hackathon OTP gönderiminde ayrıca e-posta bazlı cooldown yoktur. `/health` ve `/uploads` genel API limiter'ının dışında; `/api/v1/health` içindedir.

CORS erişim yetkilendirmesi değildir. Organizer ile Admin mevcut korumalı işlevlerde aynı yetkiye sahip; form sahibiyle sınırlama yapılmaz. Her Organizer bütün formları/yanıtları görebilir ve değiştirebilir. Kişisel veri erişimi açısından bu yetki modeli ürün gereksinimine göre yeniden değerlendirilmelidir.

Katılımcı OTP endpoint’i production’da Brevo anahtarı eksik/örnek ise 503 verir; gönderim hatasında kod silinir ve 502 döner. Eski ekip/hackathon servisi production’da da konsol simülasyonuna düşebilir ve “gönderildi” diyebilir. E-posta şablonuna kullanıcı metinleri escape edilmeden ekleniyor. Brevo çağrısında açık timeout/retry veya kuyruk yok. Eski VerificationToken kodları DB’de düz metindir. Yeni ParticipantOtp kriptografik rastgele kod, HMAC hash, atomik tüketim, süre ve deneme sınırı kullanır. Geliştirme simülasyonu katılımcı kodunu da konsolda gösterir; API yanıtı kodu içermez.

### Kimlik ve origin sınırları

Ekip ve katılımcı token’ları birbirinin yerine kullanılamaz. Katılımcı JWT HS256, audience `form-participant`, issuer `gdg-pau`, type `participant` ile doğrulanır; DB’de katılımcı mevcut olmalı. Süre dolunca yeni OTP/Google doğrulaması gerekir. İmza anahtarı env ile ayrılabilir.

CORS tek `CLIENT_URL` kullanır. `localhost:5173` ve `127.0.0.1:5173` farklıdır; tarayıcı sayfasının origin’i env ve Google Console ile eşleşmelidir. Çoklu-origin geliştirmesi bekleyen iştir, wildcard açılmamıştır. Google uyarısındaki “origin not allowed” backend CORS’tan ayrı Google istemci yapılandırmasıdır.

### Hata kodları

| HTTP | Mevcut anlam |
| --- | --- |
| 200 | Okuma/güncelleme/silme; kayıt için OTP bekleme yanıtı da olabilir |
| 201 | Kullanıcı, içerik, form veya başvuru oluşturuldu |
| 400 | Girdi/model doğrulama, geçersiz ObjectId, bozuk JSON, OTP ve Multer hataları |
| 401 | Token yok/geçersiz/süresi dolmuş, kullanıcı yok veya yanlış giriş bilgileri |
| 403 | Rol/onay engeli, doğrulanmamış e-posta, kapalı/tarih/kota veya izin verilmeyen doğrulama yöntemi |
| 404 | Kaynak veya rota yok, hackathon kapalı |
| 409 | Unique alan çakışması, kayıtlı e-posta, slug, tekrar başvuru veya gönderim sırasında güncellenen form |
| 429 | IP rate limit veya katılımcı e-posta cooldown |
| 502 | Katılımcı OTP e-postası gönderilemedi |
| 503 | Google / production katılımcı e-posta servisi yapılandırılmamış |
| 500 | Yakalanan diğer hatalar, e-posta servis hataları |

Ortak hata: `{ "success": false, "message": "..." }`. Development modunda stack eklenir. Tüm hata tiplerinin durum kodları tutarlı değil: dosya filtreleri normal Error üretir ve 500'e düşebilir; Multer boyut hatası mesajı her zaman 5 MB der, gerçekte CV 10 ve form 15 MiB sınırındadır. Global handler artık `err.status` değerini kullanır; katılımcı servis hataları ve parser boyut hataları bu yolla taşınır. Dahili hata mesajları üretim yanıtına taşınabilir.
