# Sorunlar ve geliştirme öncelikleri

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Kaynak kod incelemesi: 11 Ekim 2026, sürüm `d218156`. Canlı API ve veritabanı testi yapılmadı. Belgelerin ayrılması: 12 Ekim 2026.

Bu bölüm mevcut özellikler değil, kaynak kod bulgularına dayalı mimari önerilerdir.

### Öncelik 1 — Ürünün temel akışını tamamlamak

1. **Kullanıcı onayı:** Yalnız ADMIN için kullanıcı listeleme, onay ve rol atama API'si ekleyin; son adminin yanlışlıkla etkisiz kalmasını önleyin. Mevcut kayıt akışının en belirgin engeli budur.
2. **Seed ve doğrulama:** Seed adminin email doğrulama kararını açıklaştırın; parolayı logdan çıkarın. Kullanıcı yokken verify-email başarı yanıtını düzeltin.
3. **Frontend:** Public içerik, giriş/kayıt, form doldurma ve ekip panelini gerçek API ile bağlayın. Önce uçtan uca bir içerik ve bir form akışını tamamlayın.
4. **Form sözleşmesi:** requireAuth/çoklu cevap ayarlarını gerçekten uygulayın veya arayüzde sunmayın. Min/max null hatasını ve eksik tip/seçenek/regex doğrulamasını düzeltin.
5. **Hackathon için tek ana akış:** Dinamik form ile özel modülün hangisinin ana başvuru kanalı olacağını kararlaştırın; değerlendirme ve export iki farklı havuzda kalmamalı.

### Öncelik 2 — Üretim öncesi güvenlik ve veri bütünlüğü

1. JWT_SECRET ve gerçek e-posta ayarları eksikse üretimde başlangıcı durdurun; uygun bir ortam doğrulama katmanı kurun.
2. CV/form eklerini private depolayın; yetkili indirme route'u veya süreli erişim uygulayın. Public afişlerden ayırın.
3. OTP için kriptografik rastgelelik, hash saklama, e-posta başına cooldown, atomik tüketim ve `(email,purpose)` tekillik kullanın.
4. Upload uzantılarını tam eşleşen allowlist'e alın; içerik türü, dosya sayısı, toplam boyut ve yetim dosya temizliği ekleyin.
5. Form kota rezervasyonu ve yanıt/sayaç tutarlılığını atomik sorgu/transaction ile sağlayın; transaction gereksinimine göre MongoDB deployment'ını hazırlayın.
6. Form schemaVersion ve cevapta sürüm/snapshot tutun. Eski yanıtların dışa aktarımını sürümden bağımsız kaybetmeyin.
7. Search regex'ini kullanıcı açısından literal metne dönüştürün veya kontrollü arama yapın; uzunluk sınırı koyun. CSV hücrelerindeki formül başlangıçlarını etkisizleştirin.

### Öncelik 3 — Bakım ve işletim

- Auth, form validasyonu ve OTP gibi iş kurallarını servislere ayırın; ortak request validation ve tutarlı hata sözleşmesi oluşturun.
- Kritik akışlarda entegrasyon testleri: seed admin girişi, PENDING engeli, rol kontrolü, OTP tüketimi, dosyalı submit, min/max null, eşzamanlı kota ve export.
- OpenAPI sözleşmesi, backend test script'i, frontend API katmanı, Node sürüm sabitleme ve frontend lockfile ekleyin.
- Büyük export'ları cursor/stream veya arka plan işiyle üretin; sorguları gerçek veri ve explain ile ölçün.
- MongoDB + upload yedekleme/geri yükleme, private/public veri saklama süreleri ve audit kayıtlarını tanımlayın.
- DB ping'i yapan readiness endpoint'i, yapılandırılmış loglar, request ID, CI build/lint/test ve deployment yapılandırması ekleyin.

Mevcut kapsam için monolit makul bir başlangıçtır. Öncelik servis sayısını artırmak değil; kayıt/onay akışını, veri bütünlüğünü ve özel dosya erişimini tamamlamaktır. Hackathon modülü kapatılabilir olsa da klasörü doğrudan silmek güvenli değildir: app, proxy dosyalar ve modül import'ları düzenlenmeden sunucu açılışı kırılır.
