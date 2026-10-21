# Sorunlar ve kalan kabul kontrolleri

21 Ekim 2026. Kodda doğrulanan kayıt, OTP, rol, form bağlantısı, dosya erişimi ve içerik yayını sorunları düzeltildi. Ayrıntılar ve test kanıtları [mevcut durum](MEVCUT_PROJE_DURUMU.md) belgesinde.

| Alan | Durum |
| --- | --- |
| Ekip OTP / PENDING / yönetici onayı | API, panel ve regresyon testleri tamamlandı |
| Hackathon klasörü | `frontend/hackaton` altına taşındı; ayrı Vite uygulaması |
| Yeni site başvuruları | Katılımcı doğrulamasıyla dinamik forma kayıt, panel ve CSV aynı kaynağı kullanır |
| Eski başvurular | Model/API uyumsuzluğu düzeltildi; panelde ayrı kaynak olarak korunur |
| İçerik editörü | Gömülü parola kaldırıldı; ekip JWT/rol kontrolü ve sürümlü kalıcı yayın var |
| CV / form dosyaları | Public sunum kaldırıldı; staff yetkili indirme, uzantı/imza/adet/boyut ve hata temizliği var |
| Form bütünlüğü | Alan/seçenek/tarih/şema doğrulaması, atomik silme ve geçmiş soru export'u var |
| Çalıştırma / kalite | Kök komutları, Node 24, CI, lint, birim/entegrasyon ve gerçek tarayıcı testleri var |

Gerçek servis/dağıtım kabul kontrolleri için hesap ve hedef ortam gerekir. Bu oturumda gerçek Google hesabı, Brevo teslimatı, canlı deploy ve gerçek yedek geri yükleme işlemi yapılmadı. Google client ID/origin'leri ve Brevo sender/API key, yayın ortamında doğrulanmalı. Örnek sponsor/tarih/metinler organizasyon tarafından tamamlanmalı.

Mevcut hesaplara toplu rol değişimi veya eski başvurulara otomatik migration uygulanmadı. Şifre sıfırlama, token yenileme/iptal ve ayrıntılı permission editörü bu düzeltme kapsamına eklenmiş özellikler değildir; şu an sunucu yetkisi roller üzerinden uygulanır.
