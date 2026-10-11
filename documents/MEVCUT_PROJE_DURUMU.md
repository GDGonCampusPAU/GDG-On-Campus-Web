# GDG On Campus Pamukkale University — Mevcut Proje Durumu

**İnceleme tarihi:** 11 Ekim 2026  
**Kaynak sürüm:** `d218156` — `Merge pull request #3 from GDGonCampusPAU/feature-backend`  
**Kapsam:** Depodaki kaynak kod, modeller, rotalar, yapılandırma ve mevcut dokümanların mimari incelemesi.

Bu rapor kaynak kodun mevcut davranışını anlatır. Canlı sunucuya veya MongoDB'ye bağlanılmadı; kayıt sayıları, gerçek indekslerin oluşması, e-posta teslimatı, deployment ve uçtan uca çalışma durumu doğrulanmadı. Aşağıdaki örnek yanıtlar koddan türetilmiş şematik örneklerdir. “Kodda mevcut” ifadesi, canlı ortamda test edilip çalıştığı anlamına gelmez.

## Dokümantasyon haritası

Belge, konulara göre ayrı dosyalara ayrılmıştır. Önce genel durumu okuyabilir, ardından ihtiyaç duyduğunuz bölüme geçebilirsiniz.

| Belge | İçerik |
| --- | --- |
| [Uygulama mimarisi](architecture.md) | Katmanlar, klasör sorumlulukları, kullanılan teknolojiler ve modül sınırları. |
| [Kurulum ve yapılandırma](KURULUM.md) | Yerel çalıştırma, ortam değişkenleri ve seed davranışı. |
| [API kullanım kılavuzu](API.md) | Uç noktalar, yetkiler, GET parametreleri ve JSON / dosyalı istek örnekleri. |
| [Veritabanı mimarisi](DATABASE.md) | Modeller, koleksiyonlar, ilişkiler, indeksler ve veri bütünlüğü. |
| [Dosya yönetimi, güvenlik ve hatalar](GUVENLIK_VE_DOSYALAR.md) | Dosya yükleme ve erişim, güvenlik kontrolleri ve HTTP hata davranışları. |
| [Sorunlar ve geliştirme öncelikleri](SORUNLAR.md) | Eksikler, üretim öncesi düzeltmeler ve önerilen geliştirme sırası. |
| [İnceleme kapsamı ve kaynak haritası](INCELEME_KAPSAMI.md) | Doğrulanan kapsam, test edilmeyen noktalar ve ilgili kaynak kod bağlantıları. |

## Projenin olgunluk durumu

**Mimari değerlendirme:** Proje, backend ağırlıklı bir geliştirme iskeleti aşamasında. API kapsamı önemli ölçüde yazılmış, ancak kullanılabilir ürünün frontend'i ve bazı temel yönetim akışları tamamlanmamış. Mevcut kodu üretime hazır bir platform olarak değerlendirmek için yeterli doğrulama yok.

| Alan | Kodda mevcut | Eksik / sınırlı |
| --- | --- | --- |
| Frontend | React, Vite, CSS, başlangıç ekranı | Landing page, giriş/kayıt, yönetim paneli, form ekranları, API entegrasyonu yok |
| Kimlik doğrulama | Kayıt OTP'si, e-posta doğrulama, şifreyle giriş, JWT, profil | Yönetici onay/rol atama API'si, şifre sıfırlama, refresh token, logout/revocation yok |
| Etkinlik / duyuru | Listeleme, öne çıkanlar, oluşturma, güncelleme, silme | Ayrıntı GET'i, taslak/yayın durumları, geçmiş/gelecek etkinlik filtresi yok |
| Dinamik form | Şema oluşturma, yayın durumu, tarih/kota kontrolü, yanıt, CSV/JSON | Bazı ayarlar ve alan doğrulamaları uygulanmıyor; sürümleme yok |
| Hackathon | Lider OTP'si, başvuru, listeleme, CSV/JSON | Başvuru değerlendirme durumu, güncelleme/silme, tekillik, etkinlik ayrımı yok |
| Veritabanı | Altı Mongoose modeli, referanslar, indeks tanımları, seed | Migration, transaction, yedekleme ve canlı indeks doğrulaması yok |
| Operasyon | Sağlık rotaları, loglama, rate limit, kapanış sinyalleri | CI/CD, test altyapısı, container/deployment yapılandırması depoda yok |

`documents/proje_taslagi_v2.md` hedefleri ve seçenekleri anlatır; mevcut uygulamanın eksiksiz referansı değildir. Örneğin Tailwind, Cloudinary, Bevy senkronizasyonu ve `/public/fonts/` içeriği şu an uygulamada bulunmuyor. Bevy için yalnızca manuel bir link alanı var. Excel dışa aktarma gerçekte CSV'dir; `.xlsx` üretilmez.
