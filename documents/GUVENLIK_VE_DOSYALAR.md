# Dosya yönetimi, güvenlik ve hatalar

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Kaynak kod incelemesi: 11 Ekim 2026, sürüm `d218156`. Canlı API ve veritabanı testi yapılmadı. Belgelerin ayrılması: 12 Ekim 2026.

### Dosya davranışı

| Kullanım | Multipart alanı | Dosya başına sınır | Filtrede hedeflenen türler |
| --- | --- | --- | --- |
| İçerik afişi | `coverImage` | 5 MiB | jpg/jpeg/png/webp/gif |
| Hackathon CV | `resume` | 10 MiB | pdf/doc/docx |
| Form eki | İlgili `fieldId` | 15 MiB | jpg/jpeg/png/webp/gif/pdf/doc/docx/zip/rar/txt |

Dosyalar `backend/uploads/` altına ad + zaman + rastgele ek ile yazılır. DB'de dosya içeriği değil URL/metadata tutulur. Bulut depolama entegrasyonu yoktur. URL `req.protocol` ve istemci Host başlığından üretilir; reverse proxy/TLS ortamı için `trust proxy` ve güvenilir public URL yapılandırması henüz yok.

**CV ve form ekleri de `/uploads` altında token olmadan erişilebilir.** Rastgele dosya adı erişim kontrolü sağlamaz. Filtreler regex ile uzantı/MIME kontrolü yapıyor; özellikle regex'ler tam eşleşmeye sabitlenmediği için beklenmeyen uzantıların geçmesi mümkün. Dosya içeriğinin gerçek türü veya zararlı içerik taranmıyor. Form upload `.any()` kullandığı için şemada bulunmayan alan adlarıyla dosya da kabul edebilir. Dosya adedi/toplam boyut sınırı tanımlanmamış.

Upload middleware controller doğrulamasından önce çalışır; geçersiz OTP, kapalı form veya validation hatası sonrasında dosya kalabilir. Silme ve değiştirme de dosya temizliği yapmaz. Yedekler hem MongoDB'yi hem upload dizinini kapsamalıdır.

### Güvenlik kontrolleri

Helmet başlıkları, tek-origin CORS, JWT doğrulaması, güncel DB rolüne göre erişim, bcrypt ve rate limit var. Genel API limiti IP başına 15 dakikada 200; login/register ek limiti 15 dakikada 30. OTP gönderme endpoint'lerinde ayrıca e-posta başına bekleme süresi yok. `/health` ve `/uploads` genel API limiter'ının dışında; `/api/v1/health` içindedir.

CORS erişim yetkilendirmesi değildir. Organizer ile Admin mevcut korumalı işlevlerde aynı yetkiye sahip; form sahibiyle sınırlama yapılmaz. Her Organizer bütün formları/yanıtları görebilir ve değiştirebilir. Kişisel veri erişimi açısından bu yetki modeli ürün gereksinimine göre yeniden değerlendirilmelidir.

Brevo anahtarı yokken servis üretimde de konsol simülasyonuna düşebilir ve endpoint “gönderildi” diyebilir. E-posta şablonuna kullanıcı metinleri escape edilmeden ekleniyor. Brevo çağrısında açık timeout/retry veya kuyruk yok. OTP kodu DB'de düz metin, simülasyon logunda da görünür.

### Hata kodları

| HTTP | Mevcut anlam |
| --- | --- |
| 200 | Okuma/güncelleme/silme; kayıt için OTP bekleme yanıtı da olabilir |
| 201 | Kullanıcı, içerik, form veya başvuru oluşturuldu |
| 400 | Girdi/model doğrulama, geçersiz ObjectId, bozuk JSON, OTP ve Multer hataları |
| 401 | Token yok/geçersiz/süresi dolmuş, kullanıcı yok veya yanlış giriş bilgileri |
| 403 | Rol/onay engeli, doğrulanmamış e-posta, formun kapalı/tarih/kota engeli |
| 404 | Kaynak veya rota yok, hackathon kapalı |
| 409 | Unique alan çakışması, kayıtlı e-posta, slug çakışması |
| 429 | Rate limit |
| 500 | Yakalanan diğer hatalar, e-posta servis hataları |

Ortak hata: `{ "success": false, "message": "..." }`. Development modunda stack eklenir. Tüm hata tiplerinin durum kodları tutarlı değil: dosya filtreleri normal Error üretir ve 500'e düşebilir; Multer boyut hatası mesajı her zaman 5 MB der, gerçekte CV 10 ve form 15 MiB sınırındadır. Body boyutu aşımı gibi `err.status` değerleri global handler'da genel olarak kullanılmıyor. Dahili hata mesajları üretim yanıtına taşınabilir.
