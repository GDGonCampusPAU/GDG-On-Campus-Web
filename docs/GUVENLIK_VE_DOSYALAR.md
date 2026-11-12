# Güvenlik ve dosyalar

21 Ekim 2026.

- Ekip ve katılımcı token'ları birbirinin yerine kabul edilmez. Ekip secret'ı zorunludur; fallback anahtar kaldırıldı. Production katılımcı anahtarı da en az 32 karakter olmalıdır.
- Ekip/legacy hackathon OTP'leri `randomInt` ile üretilir, amaç+e-posta+kod için HMAC saklanır; düz metin eski kayıtlar kabul edilmez ve TTL ile temizlenir. Tek atomik tüketim, 5 deneme ve 60 saniye tekrar gönderim sınırı vardır. Katılımcı OTP'si ayrı model ve yapılandırma kullanır.
- Admin rol değişimi transaction içinde actor ve hedef kullanıcıyı yazar; eşzamanlı karşılıklı rol düşürmelerinin bütün adminleri kaldırması testle engellenir. Kullanıcı kendi rolünü değiştiremez. Eski `permissions` alanı rol kontrolünün yerine geçmez.
- Production'da e-posta simülasyonu reddedilir. Gönderim hatasında ilgili challenge temizlenir. Brevo çağrısı zaman aşımına sahiptir. Sağlayıcı kuyruğu ve otomatik retry bu sürümde uygulanmış değildir.
- Backend CORS açık allowlist kullanır. İsteklere X-Request-ID atanır. Proxy güveni yalnız TRUST_PROXY_HOPS ile ayarlanır.
- Görseller `uploads/public`, form/CV ekleri `uploads/private` altında tutulur. Özel dosyalara `/api/v1/files/:filename` üzerinden ADMIN/ORGANIZER token'ıyla erişilir; panel indirirken Authorization başlığını ekler ve başka origin'e token göndermez. Eski `/uploads/:filename` özel linkleri de yetki ister; yalnız yayımlanmış Content kapak resmi olarak kayıtlı eski görseller public kalır.
- Upload tam uzantı, temel içerik imzası, en fazla 5 dosya ve toplam 25 MB kontrolü uygular. Görseller 5 MB, CV 10 MB, form dosyası 15 MB ile sınırlıdır. İmza kontrolü tam kötü amaçlı yazılım taraması değildir.
- Reddedilen upload'lar temizlenir; form silme ilişkili yanıtlarla transaction kullanır ve kaydedilmiş dosyalarını temizler. Süreç/disk arızaları için işletim takibi ve dönemsel sahipsiz dosya kontrolü gerekir.
- Form alan türü/seçenek/tarih/kimlik doğrulaması, regex biçim sınırlaması ve tek başvuru/kota kontrolleri sunucudadır. Yanıtlar soru etiketini ve şema tarihini saklar; export geçmiş soruları da korur.
- CSV formül başlangıçları metin olarak kaçırılır; aramalar sınırlı uzunlukta literal regex'e çevrilir. CSV/JSON export tüm yanıtları belleğe almak yerine cursor kullanır.
- `/admin` parolası build'e gömülmez; ekip giriş token'ı ve API rol kontrolü gerekir. Taslak kaydı ile kalıcı yayın ayrı işlemlerdir; eski revision yayını reddedilir.

Eski plaintext OTP'ler için yeniden kod alınması gerekir. Eski hesaplar ve başvurular toplu değiştirilmedi. Gerçek servis, dağıtım, yedek ve içerik kabul kontrolleri [mevcut durum](MEVCUT_PROJE_DURUMU.md) belgesindedir.
