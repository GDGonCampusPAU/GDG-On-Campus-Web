# GDG On Campus Pamukkale University — Mevcut Proje Durumu

**Güncelleme:** 12 Ekim 2026

**Kapsam:** `feature/participant-verification` dalının mevcut çalışma ağacı; yeni katılımcı doğrulaması dahil.

Proje backend ağırlıklı geliştirme aşamasında. Katılımcı Google/e-posta doğrulaması ve form gönderiminde kimlik, tek başvuru ve kota kontrolü eklendi. Ürün frontend’i hâlâ React/Vite başlangıç ekranı. Manuel test HTML’i ayrı bir geliştirici aracıdır.

## Dokümantasyon haritası

| Belge | İçerik |
| --- | --- |
| [Katılımcı doğrulaması](KATILIMCI_DOGRULAMA.md) | Yeni akış, token/OTP ayarları, test araçları, Google ve MongoDB kurulumu |
| [Uygulama mimarisi](architecture.md) | Katmanlar, modüller ve kimlik sınırları |
| [Kurulum](KURULUM.md) | Replica set, env, seed, CORS ve yerel geliştirme |
| [API kılavuzu](API.md) | 29 endpoint, yetki, parametreler ve istek örnekleri |
| [Veritabanı](DATABASE.md) | Sekiz model, ilişkiler, indeksler ve transaction |
| [Güvenlik ve dosyalar](GUVENLIK_VE_DOSYALAR.md) | Dosya erişimi, OTP/token güvenceleri ve hatalar |
| [Sorunlar](SORUNLAR.md) | Çözülen maddeler, inceleme noktaları ve kalan geliştirmeler |
| [İnceleme kapsamı](INCELEME_KAPSAMI.md) | Test kanıtları, sınırlar ve kaynak kod haritası |

## Mevcut durum

| Alan | Mevcut | Kalan |
| --- | --- | --- |
| Ekip kimliği | Kayıt OTP, email doğrulama, şifre/JWT, rol kontrolü | ADMIN onayı API’si, seed doğrulama düzeltmesi, şifre sıfırlama/revocation |
| Katılımcı kimliği | Participant, Google / EMAIL_OTP, ayrı JWT, env süreleri | Gerçek hesap/teslimat doğrulaması; token yenileme yok |
| İçerik | Public/featured liste, POST/PUT/DELETE | Ürün ekranları, detay GET’i ve yayın durumu |
| Form | Şema, yayın/tarih/kota, kimlik ve tek başvuru, CSV/JSON | Şema sürümleme, kapsamlı alan doğrulama, etkinlik ilişkisi |
| Veritabanı | Sekiz model, indeksler, submit transaction’ı | Transaction ile silme, tüm canlı indeks ve performans kontrolü |
| Hackathon | Ayrı lider OTP ve HackathonApp | Dinamik form ile başvuru havuzunun birleştirilmesi |
| Frontend | React/Vite iskeleti | Landing page, yönetim/katılımcı ekranları |
| Testler | 20 otomatik test geçti; HTML ve HTTP araçları var | Browser CORS, gerçek Google/Brevo ve daha geniş regresyon kapsamı |
| Operasyon | Health, log/rate limit, replica set startup kontrolü | CI/CD, readiness, deployment ve yedekleme |

## Gözden geçirme için önemli noktalar

- Eski alanı eksik formlar da verificationRequired varsayılan true ile doğrulama ister. Anonim formların ayarları açıkça güncellenmeli.
- MongoDB replica set / Atlas zorunlu; yerel kernel uyumsuzluğu container ortamında geçici rseq ayarıyla çözüldü.
- CORS hâlâ tek CLIENT_URL kullanıyor. localhost ve 127.0.0.1 farklı origin; çoklu-origin desteği uygulanmadı.
- Yüklenen CV/form ekleri hâlâ public. Katılımcı submit dosya temizliği bu erişim riskini çözmez.
- Katılımcı OTP’si güçlendirildi; eski ekip/hackathon OTP’si aynı güvenceye sahip değil.

`proje_taslagi_v2.md` hedef/karar taslağıdır; uygulanmış özellik sözleşmesi değildir. Tailwind, Cloudinary ve Bevy senkronizasyonu mevcut uygulamada yok; Excel export CSV’dir, xlsx üretilmez.
