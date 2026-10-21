> Uygulama güncellemesi — 21 Ekim 2026: Bu belgedeki ilk bulgular tarihsel olarak korunmuştur. `web` artık `frontend/hackaton` altındadır. Kod düzeltmeleri, entegrasyon, CI ve test altyapısı uygulanmıştır; güncel sonuçlar ve dış ortam kabul kontrolleri [mevcut durum](MEVCUT_PROJE_DURUMU.md) belgesindedir.

# Proje iyileştirme ve test planı

Tarih: 21 Ekim 2026. Bu belge mevcut kaynak kodun incelenmesine ve bu tarihte çalıştırılan kontrollere dayanır. Uygulama kodunda düzeltme yapılmadı; aşağıdaki mimari tercihler öneridir.

## 1. Mevcut yapı ve doğrulama sonucu

| Parça | Gerçekte yaptığı iş | Bu incelemedeki sonuç |
| --- | --- | --- |
| `web/` | Etkinlik sitesi, çok adımlı katılım formu, tarayıcıda içerik taslağı editörü | 23 dosyada 206 test geçti; üretim build'i geçti. Dört font dosyası çözümlenemedi uyarısı var. |
| `frontend/` | Core Team giriş/kayıt/OTP ekranları, eski hackathon başvurularını listeleme ve CSV indirme | Build geçti. Lint, `Applications.jsx:36` için `react-hooks/set-state-in-effect` hatası verdi. Otomatik test script'i yok. |
| `backend/` | Ekip kimliği, katılımcı kimliği, içerik, dinamik form ve ayrı hackathon API'si | Mevcut 20 test geçti. Kapsam ağırlıklı olarak katılımcı doğrulaması ve form gönderimi. |
| `documents/` ve README'ler | Mimari, kurulum ve geçmiş durum bilgileri | Bir kısmı mevcut kodla çelişiyor; özellikle frontend iskeleti ve eski OTP uygulaması hakkındaki açıklamalar güncel değil. |

Backend testleri geçici MongoDB replica set kullanılarak çalıştırıldı; mevcut `.env` ve gerçek veritabanı kullanılmadı. İlk çalıştırma sandbox port kısıtına takıldı; uygun izinle tekrar çalıştırıldığında 20 test geçti. Ön yüz bağımlılıkları lockfile üzerinden kuruldu. Gerçek Google hesabı, gerçek Brevo teslimatı, tarayıcıdan API akışları ve `check:layout` bu incelemede çalıştırılmadı. Build başarısı bu akışların çalıştığını kanıtlamaz.

## 2. Öncelikli bulgular

### P0 — Kayıt akışlarını doğrudan kıran hatalar

1. `backend/src/models/VerificationToken.js`, çağrılan `generateOtp` ve `verifyOtp` metotlarını tanımlamıyor. Ekip auth ve eski hackathon controller'ları bu metotları kullanıyor. Model yüklenerek ikisinin de `undefined` olduğu doğrulandı. DB sorgusu yerine yerel stub kullanılan controller çağrısında `VerificationToken.generateOtp is not a function` hatası yeniden üretildi. Bu denemede e-posta gönderilmedi.
2. Ekip kayıt controller'ı `PENDING` rolü kaydediyor; `User` modeli yalnız `MEMBER`, `ORGANIZER`, `ADMIN` kabul ediyor. Veritabanına bağlanmadan model doğrulamasıyla `Geçersiz rol tipi: PENDING` hatası yeniden üretildi. OTP düzelse bile kayıt bu noktada engellenir.

### P1 — Parçaların birlikte çalışmasını engelleyen eksikler

3. `web` formu yalnız düz JSON POST ediyor; katılımcı doğrulaması ve Bearer token gönderimi yok. Endpoint tanımsızsa geliştirmede kayıt atlamasına rağmen başarı gösteriyor; üretimde hata gösteriyor. Yerel başarı ekranı kalıcı kayıt kanıtı değil.
4. Üç ayrı başvuru tanımı var: `web` kayıt alanları, dinamik `Form/FormResponse` ve eski `HackathonApp`. Panel yalnız `HackathonApp` listesini okuyor; dinamik forma yazılan başvurular bu ekranda görünmez. Alan adları ve bireysel/takım başvurusu anlamları da farklı.
5. Yeni ekip hesabını onaylayacak kullanıcı/rol yönetimi API'si ve ekranı yok. Kayıt ekranı onay e-postası vaat ediyor; bu bildirimin uygulanması da kapsamda doğrulanmalı.
6. Backend tek `CLIENT_URL` kabul ediyor. İki ön yüzün portları ve origin'leri birlikte tanımlanmamış; her ikisi de varsayılan Vite portuyla başlıyor.
7. `web /admin`, pakette bulunan şifreyle açılan yerel taslak editörü. Değişiklikler localStorage'a yazılıyor veya JSON olarak indiriliyor; sunucuya yayınlanmıyor. Ortak, yetkili içerik yönetimi olarak kullanılamaz.

### P1/P2 — Yayın öncesi güvence ve bakım

8. CV ve form ekleri public `/uploads` üzerinden sunuluyor. Özel dosyalar için sunucuda yetkili indirme gerekiyor. Upload uzantı filtreleri tam eşleşme kullanmıyor; dosya içeriği, adet ve toplam boyut kontrolleri genişletilmeli.
9. Seed admin e-postası doğrulanmış olarak oluşturulmuyor; varsayılan parola kullanabiliyor ve parolayı logluyor. Ekip JWT helper'ında sabit fallback anahtar var.
10. Form alan türleri/seçenekleri eksik doğrulanıyor; form ve yanıtlarının silinmesi transaction içinde değil. Form değiştikten sonra eski yanıtların export davranışı tanımlanmalı. CSV formül başlangıçları ve kullanıcı kaynaklı arama regex'leri kontrol edilmeli.
11. Kök geliştirme/test komutları ve CI yok. Backend ve `web` için lint komutu, panel için test altyapısı eksik. Node ve ortam kuralları repo genelinde tutarlı değil.

## 3. Önerilen hedef ve kapsam kararları

- İlk etapta `web` etkinlik sitesi, `frontend` yönetim paneli ve `backend` API olarak kalır. Önce sorumlulukları ve bağlantıları netleştirilir; klasör birleştirmesi ilk iş yapılmaz.
- Yeni etkinlik başvuruları için mevcut doğrulama, kota ve transaction altyapısı olan `Form/FormResponse` ana kanal olarak önerilir. Panel aynı veriyi okumalıdır. Mevcut `HackathonApp` verisi ve kullanan akışlar envantere alınmadan eski modül kaldırılmaz. Gerekli veri taşıma için ayrıca eşleme, yedek ve geri dönüş planı hazırlanır.
- Bireysel katılım mı, takım başvurusu mu alınacağı ürün kararıdır. `web` alanları backend form şemasıyla buna göre eşleştirilir; mevcut iki modeli körlemesine dönüştürmeyiz.
- Ekip hesabı ile katılımcı hesabı ayrı kalır. Ekip onay durumu, rol ve `permissions` alanlarının ilişkisi açıkça belirlenir; arayüz ve sunucu aynı yetki kurallarına uyar.
- İçerik için kalıcı kaynak seçilir. Mevcut `Content` modeli etkinlik sitesindeki bütün program/sponsor/form şemasını karşılamadığından yalnız bir endpoint adresini değiştirmek yeterli değildir. Statik yayın geçici olarak korunabilir; ortak editör istenirse veri modeli ve yetkili yayın akışı ayrıca tamamlanır.

Bu kararlar özellikle 4. aşamadan önce netleşmelidir. P0 hata testleri ve ortam düzenlemesi bu kararları beklemeden yapılabilir.

## 4. Sıralı uygulama planı

### Aşama 1 — Tekrarlanabilir geliştirme ve kontrol ortamı

- Repo genelinde desteklenen Node sürümünü ve paket yöneticisini belirle; mevcut lockfile'ları koru.
- Kökten servisleri başlatma, test, lint ve build komutları ekle; portları açıkça ayır: öneri `web:5173`, panel `5174`, API `5000`.
- Yerel MongoDB replica set kurulumu için tekrarlanabilir tarif/Compose ve sağlık kontrolü hazırla. Var olan veri volume'larını değiştirme.
- Test ortamını gerçek `.env`, gerçek DB ve gerçek e-posta servisinden ayır. Geçici DB/upload dizini ve test veri üreticilerini standartlaştır.
- Panelde Vitest/Testing Library altyapısı kur; API istekleri için kontrollü mock kullan. Mevcut backend ve `web` testlerini koru.
- CI temelini hazırla: temiz kurulum, mevcut testler ve iki build. Yeni lint/test kontrolleri düzeltildikçe zorunlu kapı olur.

Tamamlanma ölçütü: yeni bir geliştirici belgelenmiş komutlarla üç servisi başlatabilir; CI mevcut 20 backend ve 206 web testini ve iki build'i tekrar çalıştırabilir.

### Aşama 2 — Ekip kimliği ve onay akışını çalışır hale getirme

- Önce eksik OTP metotlarını ve `PENDING` uyumsuzluğunu yakalayan regresyon testleri ekle; mevcut hatayı gördükten sonra düzelt.
- Eski OTP akışını güvenli ortak mekanizmaya taşı veya mevcut katılımcı servisinin ortak altyapısını ayır. Amaç ayrımını koru; ekip ve katılımcı token'larını birbirinin yerine kabul etme.
- Hash, güvenli rastgele üretim, tek kullanımlılık, eşzamanlı tüketim, süre/deneme sınırı ve yeniden gönderim beklemesi ekle.
- Kayıt/onay/rol modelini tutarlı hale getir. ADMIN onay işlemini API ve panel üzerinden tamamla; yetkisiz onayı engelle.
- Seed admin'i güvenli ve tekrar çalıştırılabilir yap; parola logunu ve production fallback anahtarlarını kaldır. Eksik ayarlarda açık başlangıç hatası ver.
- Panelin kayıt, OTP, PENDING, giriş, oturum sonlanması ve 403 durumlarını test et. Onay bildirimi metnini gerçek davranışla eşleştir.
- Mevcut panel lint hatasını davranışı koruyarak gider.

Tamamlanma ölçütü: ekip kaydı → e-posta doğrulama → yönetici onayı → giriş → yetkili listeleme akışı otomatik testlerle geçer. MEMBER, ORGANIZER ve ADMIN erişimleri tanımlıdır.

### Aşama 3 — API sınırları, dosyalar ve veri bütünlüğü

- İki ön yüz için açık CORS allowlist'i, reddedilen origin ve OPTIONS testleri ekle; Google origin ayarlarını kurulum tarifine işle.
- CV/form eklerini public statik yayından ayır; yetkili indirme, güvenli dosya türü/boyutu/adedi ve hata temizliği uygula. Kamuya açık görselleri ayrı tut.
- Form alan türleri, seçenekler, benzersiz fieldId, tarih aralıkları ve durum geçişlerini doğrula.
- Form silme işlemini ilişkili yanıtlarla atomik hale getir; upload temizliğini ayrıca ele al. Şema değişikliklerinde eski yanıt/export davranışını koru.
- CSV hücrelerini ve arama girdilerini güvenli işle. Production'da e-posta simülasyonunun başarı sayılmasını engelle; servis çağrılarına zaman aşımı ekle.

Tamamlanma ölçütü: başarısız işlemler yanıt/sayaç/dosya tutarsızlığı bırakmaz; özel dosyalara anonim erişim reddedilir; mevcut eşzamanlı kota testleri geçmeye devam eder.

### Aşama 4 — Katılımcı sitesi ve paneli aynı başvuru kanalına bağlama

- Seçilen başvuru modeline göre form alanlarının ve API hata/başarı gövdelerinin sözleşmesini yaz.
- `web` tarafına katılımcı Google/e-posta doğrulaması, token yönetimi ve doğrulanmış form gönderimini bağla.
- Form şemasını tek kaynaktan üret veya açık bir adapter ile eşleştir; yerel editörün alanları değiştirmesinin API'yi sessizce bozmasını önle.
- Paneli aynı başvuru kaynağında listeleme, arama, sayfalama ve export yapacak hale getir.
- Geliştirmedeki simülasyonu kullanıcıya açıkça belirt; gerçek başarıyı kayıt kimliği ve DB kaydıyla doğrula.
- İçerik yönetimi kararına göre `web /admin` editörünü yetkili sunucu akışına taşı veya yerel taslak aracı olarak açıkça sınırla.

Tamamlanma ölçütü: siteden yapılan başvuru DB'ye bir kez kaydedilir; aynı başvuru panelde ve export'ta görünür. Eski modülün kapatılması gerekiyorsa mevcut veriye erişim korunur.

### Aşama 5 — Tarayıcıdan uçtan uca test ve yayın hazırlığı

- Playwright ile gerçek tarayıcı + API + izole MongoDB üzerinde kritik senaryoları çalıştır.
- CI'da temiz kurulum, tüm testler, lint, iki build ve temel uçtan uca akışı zorunlu yap.
- Gerçek Google hesabı ve Brevo teslimatını ayrı staging kabul kontrolü olarak yürüt; gerçek hesaplara bağımlı testleri her PR'ın içine koyma.
- SPA rota yenilemesi, mobil kullanım, klavye odağı, hata/boş/yükleniyor ekranları ve görsel layout kontrolünü doğrula. Eksik font ve görselleri tamamla.
- DB readiness, hata/log takibi, proxy ayarları, DB+upload yedekleme ve geri yükleme denemesini tamamla; README/API/mimari belgelerini son kodla eşleştir.

Tamamlanma ölçütü: temiz ortamda kayıt ve yönetim senaryoları otomatik geçer; staging'de gerçek doğrulama tamamlanır; dağıtım ve geri dönüş adımları belgelenmiştir.

## 5. Asgari test matrisi

| Alan | Eklenecek temel senaryolar | Katman |
| --- | --- | --- |
| Ekip auth | Kod gönderme, kayıt, mevcut e-posta, yanlış/süresi dolmuş/tekrar kullanılan kod, eşzamanlı tüketim, gönderim hatası | Backend entegrasyon |
| Onay ve yetki | PENDING giriş engeli, ADMIN onayı, MEMBER/ORGANIZER sınırları, izinsiz rol yükseltme, seed ile ilk giriş | Backend + panel |
| Katılımcı auth | Mevcut 20 testi koru; tarayıcı token süresi, yeniden doğrulama ve gerçek origin davranışı | Mevcut backend + UI/E2E |
| Panel | Kayıt/giriş/OTP adımları, oturum bozulması, 401/403, boş liste, ağ hatası, arama yarışı, sayfalama, CSV hatası | Vitest + API mock |
| Form yönetimi | Oluştur/güncelle/yayınla/kapat, yanlış tür ve seçenek, yinelenen fieldId, şema değişimi ve eski yanıtlar | Backend entegrasyon |
| Başvuru | Doğrulama → gönderim → DB kaydı → panel → export; tekrar tıklama, yenileme, kota ve kapalı form | Backend + Playwright |
| Dosya ve export | Başarılı dosyalı başvuru, izinsiz indirme, tür/boyut/adet reddi, hata temizliği, CSV özel karakter/formül girdisi | Backend entegrasyon |
| İçerik | Public okuma, yetkili değişiklik, geçersiz veri, iki tarayıcıda yayınlanan içeriğin aynı olması | Backend + E2E; sunucu yayını seçilirse |
| Yapılandırma | Eksik secret, yanlış DB topology, allowlist dışı origin, provider hatası, production simülasyon engeli | Başlangıç/API testleri |

Hedef yalnız test sayısını veya genel coverage yüzdesini artırmak değildir. Her doğrulanmış hata için regresyon testi ve her kritik kullanıcı akışı için başarı/hata/yetki senaryoları gereklidir. Bir akışın “çalışıyor” sayılması için beklenen kalıcı kayıt, sayaç ve dosya etkisi de doğrulanmalıdır.

## 6. İlk uygulama dilimi

İlk küçük teslimat: ekip OTP ve PENDING regresyon testleri, bu iki hatanın düzeltmesi, panel lint düzeltmesi ve mevcut test/build sonuçlarını tekrarlayan temel CI. Sonraki teslimat: ekip onay yaşam döngüsü ve başvuru kanalının site/panel entegrasyonu. Böylece geniş bir yeniden yazımdan önce mevcut kırık davranışlar görünür ve kontrol altında olur.
