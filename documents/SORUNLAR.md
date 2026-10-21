# Sorunlar ve geliştirme öncelikleri

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

Güncelleme: 12 Ekim 2026 — `feature/participant-verification` çalışma ağacı. Bu liste yeni kodun durumunu anlatır.

## Bu değişiklikte çözülenler

| Önceki sorun | Yeni durum |
| --- | --- |
| Katılımcı Google/e-posta doğrulaması yoktu | Ayrı Participant kimliği, Google ve EMAIL_OTP endpoint’leri var |
| Form requireAuth / tek başvuru ayarı uygulanmıyordu | Katılımcı middleware’i ve transaction içinde tekrar kontrolü var |
| Kota ve yanıt/sayaç güncellemesi atomik değildi | FormSubmissionService aynı transaction içinde kaydeder; eşzamanlılık testleri geçti |
| Katılımcı OTP güvenceleri eksikti | Ayrı ParticipantOtp: randomInt, HMAC hash, atomik tüketim, cooldown, deneme sınırı |
| Number min/max null sınırları 0 gibi değerlendirilebiliyordu | Null sınırlar atlanıyor |
| Form doğrulaması upload’dan önce yapılmıyordu | Kimlik upload’dan önce kontrol edilir; controller reddettiği dosyaları temizlemeye çalışır |
| Test script’i / entegrasyon testleri yoktu | npm test, 20 otomatik test, HTML ve HTTP manuel araçları var |
| Yerel MongoDB kernel uyumsuzluğunda sürekli kapanıyordu | Yerel container’da rseq geçici ayarı, rs0 primary ve okuma transaction kontrolü doğrulandı |

Bu düzeltmeler ekip/hackathon OTP’sini, bütün upload rotalarını veya form silme işlemini kapsamıyor.

## Önce gözden geçirilecek açık noktalar

1. **Tarayıcı CORS ve Google ayarı:** Backend tek CLIENT_URL kullanıyor; localhost ve 127.0.0.1 aynı origin değil. Çoklu-origin desteği konuşuldu ama uygulanmadı. Google Authorized JavaScript origins ayrıca eşleşmeli. Tarayıcı akışının eksiksiz çalıştığı doğrulanmış değil.
2. **Manuel test sayfası:** Token olmadan tokenlı gönderim düğmesi etkin; varsayılan katilimci-test formu otomatik oluşturulmuyor; genel hata mesajları ve tekrar Google başlatma iyileştirilmeli. Gerçek token/parolalar `.http` dosyasına yazılıp commit edilmemeli.
3. **Mevcut form uyumluluğu:** verificationRequired varsayılan true; eski alanı eksik formlar da doğrulama ister. Anonim kalacak formları açıkça güncelleyin. Eski anonim yanıtlar geriye dönük katılımcıya bağlanmaz.
4. **Replica set gereksinimi:** Sunucu artık standalone MongoDB’yi reddediyor. Her geliştirici/dağıtım ortamı replica set veya Atlas kullanmalı; yerel tek üyeli set yedeklilik sağlamaz.

## Ürün akışında kalanlar

- ADMIN’e özel kullanıcı listeleme/onay/rol API’si yok. Ekip kaydı PENDING sonrasında mevcut API ile onaylanamıyor.
- Seed admin emailVerified set etmiyor ve parolayı logluyor. `/auth/verify-email`, hesap bulunmasa da başarı dönebiliyor.
- Frontend hâlâ React/Vite başlangıç ekranı; test HTML’i ürün arayüzü değil.
- Dinamik hackathon formu ve özel HackathonApp başvurusu ayrı havuzlar. Ana başvuru kanalının seçilmesi gerekiyor.
- Content–Form arasında etkinlik referansı yok; form ile etkinlik eşleştirme ve ekip ekranları tasarlanmalı.
- Form phone/date/regex, seçenek ve checkbox tip doğrulaması, fieldId tekilliği eksik.

## Üretim öncesi güvenlik ve bütünlük

- CV/form ekleri public `/uploads` altında; özel indirme yetkisi ve dosya saklama yaşam döngüsü geliştirilmeli.
- Eski REGISTER/HACKATHON_APPLY OTP’si Math.random, düz metin kod ve atomik olmayan tüketim kullanıyor; yeni katılımcı güvenceleri bu modele taşınmadı.
- Katılımcı startup config kontrolü var, fakat ayrı participant secret ayarlanırsa eski ekip JWT helper’ı fallback kullanabilir. İki anahtar da zorunlu/güçlü olmalı.
- Katılımcı e-postası production’da simülasyonu reddediyor; ekip/hackathon e-postasında aynı kontrol yok. Brevo timeout/retry ve kuyruk yok.
- Upload filtreleri tam uzantı eşleşmesi yapmıyor; dosya içeriği/adet/toplam boyut kontrolleri eksik. Controller temizliği süreç çökmesini veya disk hatasını çözmez.
- Form silme ve yanıt silme transaction içinde değil. Form şema sürümü/snapshot yok; eski cevapların export’u güncel sorulara bağlı.
- Search regex ve CSV formül başlangıçları için ek koruma yok.

## Bakım ve işletim

Otomatik testler yeni kimlik/form akışını kapsıyor; seed admin, PENDING, başarılı dosyalı başvuru, dosya temizliği, export ve browser CORS için kapsam genişletilmeli. Gerçek Google/Brevo testi yapılmalı. Mevcut npm audit sonucundaki üç high bulgu nodemon/chokidar/braces geliştirme zincirinde; sürüm düşüren force fix uygulanmadı.

OpenAPI, CI/CD, Node sürüm sabitleme, frontend lockfile, yapılandırılmış log/request ID, DB readiness ve MongoDB + upload yedekleme/geri yükleme eksik. Export tüm kayıtları belleğe alıyor; veri arttığında streaming gerekiyor.

Hackathon klasörünü doğrudan silmek import’ları kırar. Modülü kapatmak için mevcut flag kullanılabilir; tam kaldırma ayrıca kod düzenlemesi gerektirir.
