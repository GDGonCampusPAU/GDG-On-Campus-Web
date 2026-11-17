# GDG On Campus Frontend Agent Guidelines

Bu dosya, `Google Developer Groups - Brand Guide for Organizers.pdf` içindeki marka
kurallarını frontend üzerinde çalışan agentlar için uygulanabilir bir sözleşmeye
dönüştürür. Yeni bir sayfa, component veya stil eklerken bu dosyadaki kurallar
varsayılan kabul edilmelidir.

## 1. Marka ve içerik dili

- Topluluğun tam adı: **Google Developer Groups On Campus Pamukkale University**.
- Kısa ad: **GDG On Campus Pamukkale University** veya **GDG On Campus PAU**.
- Organizer unvanı yalnızca **GDG Organizer** veya **Google Developer Group Organizer**
  olarak yazılmalıdır. `GDG Lead`, `Google Developer Group Lead` ve benzeri unvanlar
  kullanılmamalıdır.
- Marka adı, logo ve resmi metinler değiştirilmemeli; yeni bir kısaltma, slogan veya
  marka lockup'ı tasarlanmadan önce mevcut içerik korunmalıdır.
- Kullanıcıya gösterilen metinlerde okunabilirlik, doğru büyük/küçük harf kullanımı ve
  tutarlı dil önceliklidir. Metin yalnızca görsel bir tasarım öğesi olarak görsele
  gömülmemeli; mümkünse gerçek HTML metni olarak sunulmalıdır.

## 2. Logo ve marka varlıkları

- PDF'deki resmi GDG logo varyantları kullanılmalı; logo yeniden çizilmemeli,
  oranı bozulmamalı, döndürülmemeli, gölgelendirilmemeli veya renkleri değiştirilmemelidir.
- Renkli/çok yoğun arka planlarda uygun beyaz logo; açık ve nötr arka planlarda
  uygun renkli logo varyantı tercih edilmelidir.
- Logo, başka logolarla veya metinlerle bitişik kullanılmamalı; etrafında PDF'deki
  koruma alanını ihlal etmeyecek boşluk bırakılmalıdır.
- Logo yerine metin, emoji veya rastgele ikon kullanılmamalıdır. İkon tek başına
  yalnızca alanın yatay logo için yetersiz olduğu durumlarda ve resmi varyant mevcutsa
  kullanılabilir.

### Gelecekte eklenecek görseller

PNG, JPEG, JPG, SVG, WebP ve font dosyalarının kesin yolları henüz belirlenmemiştir.
Bir asset path'i verildiğinde:

1. Path'i component içine sabit, dağınık bir string olarak yazma.
2. Path'i merkezi bir asset registry, theme dosyası veya ilgili sayfanın açık bir
   asset prop'u üzerinden bağla.
3. Asset'in anlamlı bir adı, alternatif metni ve gerekiyorsa boyut/aspect-ratio
   bilgisi olsun.
4. Görsel yüklenemezse layout bozulmamalı; anlamlı bir fallback ve kullanıcıya
   fayda sağlayan `alt` metni kullanılmalıdır.
5. Dekoratif görseller `alt=""` ile işaretlenmeli; bilgi taşıyan görseller açıklayıcı
   `alt` metnine sahip olmalıdır.

Path verilmeden placeholder görsel, rastgele internet URL'si veya varsayılan
logo üretilmemelidir.

## 3. Tipografi

Sitede marka dilini korumak için yalnızca aşağıdaki aileler kullanılmalıdır:

### Google Sans

- Başlıklar, gövde metni, butonlar, navigasyon ve ana yönlendirme öğeleri.
- Başlıklarda Regular, Medium veya Bold; paragraf ve yardımcı metinlerde Regular
  veya Medium kullanılmalıdır.
- Başlık seviyeleri anlamlı HTML (`h1`-`h6`) ile eşleşmeli; yalnızca font boyutuyla
  görsel hiyerarşi oluşturulmamalıdır.

### Google Sans Mono

- Kod benzeri metinler, kısa badge/etiketler, tarih-saat değerleri, konuşmacı
  isimleri ve teknik yetenek/konu adları.
- Normal, Medium, SemiBold veya Bold ağırlıkları kullanılabilir.
- Uzun paragraf metinleri veya tüm site navigasyonu Mono font ile yazılmamalıdır.

Font dosyaları projeye eklendiğinde `@font-face` tanımları tek bir global stil/theme
katmanında tutulmalı; component içinde farklı font ailesi tanımlanmamalıdır.
Eksik font dosyası nedeniyle tarayıcı fallback'e düşerse sistem sans-serif fallback'i
okunabilirliği korumalıdır.

## 4. Renk sistemi

Renkler component içinde hardcoded HEX olarak tekrarlanmamalı; CSS custom property,
theme veya Tailwind token'ı üzerinden kullanılmalıdır. Aşağıdaki adlar ve değerler
tek kaynaktan tanımlanmalıdır.

### GDG core colors

| Token | HEX | Kullanım |
| --- | --- | --- |
| `gdg-blue` | `#4285F4` | Ana link, birincil vurgu |
| `gdg-green` | `#34A853` | Başarı ve ikincil vurgu |
| `gdg-yellow` | `#F9AB00` | Uyarı ve sıcak vurgu |
| `gdg-red` | `#EA4335` | Hata ve kritik vurgu |

### GDG halftones

| Token | HEX |
| --- | --- |
| `gdg-blue-halftone` | `#57CAFF` |
| `gdg-green-halftone` | `#5CDB6D` |
| `gdg-yellow-halftone` | `#FFD427` |
| `gdg-red-halftone` | `#FF7DAF` |

### GDG pastels

| Token | HEX |
| --- | --- |
| `gdg-blue-pastel` | `#C3ECF6` |
| `gdg-green-pastel` | `#CCF6C5` |
| `gdg-yellow-pastel` | `#FFE7A5` |
| `gdg-red-pastel` | `#F8D8D8` |

### Nötr renkler

| Token | HEX | Kullanım |
| --- | --- | --- |
| `gdg-off-white` | `#F0F0F0` | Açık sayfa ve yüzey arka planları |
| `gdg-black-02` | `#1E1E1E` | Koyu yüzeyler ve güçlü metin |

Metin/arka plan kontrastı erişilebilir olmalıdır. Renk yalnızca anlamın tek taşıyıcısı
olmamalı; durumlar metin, ikon veya yardımcı açıklamayla da belirtilmelidir. PDF'de
tanımlı olmayan yeni marka rengi eklenmeden önce mevcut token'larla çözüm aranmalıdır.

## 5. Layout ve component dili

- Ortak componentler `components/common`, sayfa iskeletleri `components/layout`,
  sayfa/route bileşenleri ise `pages` veya `routes` altında tutulmalıdır.
- Tekrarlanan renk, spacing, radius, typography ve gölge değerleri global token
  katmanına taşınmalıdır.
- Kart, banner ve görsel çerçevelerinde GDG'nin asimetrik çentikli
  (*notched/folder-shaped*) yüzey dili gerektiğinde kullanılmalıdır. Bu şekil her
  kutuya zorla uygulanmamalı; içerik hiyerarşisini desteklediği yerde kullanılmalıdır.
- Geometrik line-art; globe/dünya çizgileri, `{ }`, oklar, `<3` ve dalga desenleri
  dekoratif vurgu olarak kullanılabilir. Dekorasyon içeriğin önüne geçmemeli ve
  ekran okuyucularına gereksiz metin olarak sunulmamalıdır.
- Koyu bölümlerde `gdg-black-02` arka plan ve renkli ince çizgi kenarlıklar
  kullanılabilir. Koyu yüzeylerde metin kontrastı ayrıca kontrol edilmelidir.
- Buton, link, form alanı, kart ve navigasyon davranışları sayfalar arasında aynı
  component API'sini ve aynı etkileşim durumlarını (`hover`, `focus`, `disabled`,
  `loading`, `error`) kullanmalıdır.
- Yeni component eklemeden önce mevcut ortak component veya helper aranmalı;
  aynı davranış ikinci kez kopyalanmamalıdır.

## 6. Responsive ve erişilebilir frontend

- Mobile-first yaklaşım kullanılmalı; içerik küçük ekranlarda yatay taşma olmadan
  çalışmalıdır.
- Görseller sabit piksel ölçülerine zorlanmamalı; oranları korunmalı ve uygun
  `object-fit` davranışı belirlenmelidir.
- Semantik HTML, klavye ile erişim, görünür focus durumu, yeterli tıklama alanı ve
  form alanı label'ları zorunludur.
- Animasyonlar kısa ve işlevsel olmalı; `prefers-reduced-motion` tercihine saygı
  gösterilmelidir.
- Responsive breakpoint veya spacing değerleri componentlere dağınık şekilde
  yazılmamalı; proje theme/config katmanında tutarlı kullanılmalıdır.

## 7. Uygulama kuralları

1. Önce mevcut route, component, theme ve asset registry'yi incele.
2. Marka token'larını kullan; yeni HEX, font ailesi veya rastgele icon set ekleme.
3. Asset path'i bilinmiyorsa placeholder uydurma; açık bir prop/token ile bağlantı
   noktası bırak ve eksik asset'i sessizce başarı gibi gösterme.
4. Her yeni görsel için `alt`, her etkileşimli öğe için klavye/focus davranışı ekle.
5. Aynı sayfadaki ve diğer sayfalardaki başlık, buton, kart ve renk kullanımını
   mevcut tasarım diliyle karşılaştır.
6. Değişiklikten sonra ilgili lint, type-check, build veya test komutunu çalıştır;
   görsel değişikliklerde mümkünse responsive ekranları da kontrol et.

### Kaçınılacaklar

- PDF'de olmayan logo varyantı veya marka lockup'ı üretmek.
- Component içinde tekrarlanan hardcoded renk/font/path değerleri bırakmak.
- Asset path'i verilmeden harici görsel URL'si kullanmak.
- Sadece rengi değiştirerek durum anlatmak.
- Erişilemeyen, focus durumu olmayan veya metni görselin içine gömülü UI üretmek.
- Bir sayfada diğerlerinden farklı font, token adı, kart geometrisi veya spacing sistemi
  oluşturmak.

Bu yönerge, resmi PDF'nin yerini almaz; belirsiz veya çelişkili bir durumda PDF'deki
resmi marka kuralları ve proje sorumlusunun verdiği güncel asset/brand kararı esas alınır.
