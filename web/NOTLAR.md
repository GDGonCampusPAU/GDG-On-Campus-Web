# Notlar (13 Ekim 2026)

Konuşmada anlaşılmayan iki maddenin açıklaması. Karar ve dosya bekleyen şeyler burada duruyor.

## 1. `public/` klasörü: eksik font ve logo dosyaları

**Ne eksik.** Sitenin iki türlü dış dosyaya ihtiyacı var. İkisi de sende henüz yok.

| Dosya türü | Nereye konacak | Yoksa ne olur |
| --- | --- | --- |
| Google Sans fontları | `public/fonts/` | Site tarayıcının normal fontuyla açılır. Çalışır ama marka görünümü eksik kalır. |
| Sponsor ve GDG logoları | `public/logos/` | Sponsor kutuları logo yerine sadece yazı gösterir. |
| Kişi fotoğrafları (jüri, mentor) | `public/logos/` | Kartlarda fotoğraf yerine baş harfler görünür. |

**Font dosya adları.** Adlar birebir böyle olmalı.

- `GoogleSans-Regular.woff2`
- `GoogleSans-Bold.woff2`
- `GoogleSansMono-Regular.woff2`
- `GoogleSansMono-Bold.woff2`

Dosyaları GDG marka kılavuzundaki "Download" bağlantılarından indireceksin.

**Logo ve fotoğraf.** Dosyayı `public/logos/` içine koy, sonra `src/data/event.js` içinde ilgili kişinin ya da sponsorun satırına yolunu yaz.

- Sponsor için `logo: '/logos/dosya.png'`
- Kişi için `photo: '/logos/kisi.jpg'`

**Kod tarafında yapılacak bir şey yok.** Dosyalar yerine konunca site onları otomatik kullanır. `public/` klasörü artık var (içinde `_redirects` dosyası duruyor), alt klasörleri sen açarsın.

**Sorular.**

- Fontları ve logoları kim getirecek?
- Sponsorların gerçek listesi belli mi? `event.js` içindeki sponsorlar şu an yer tutucu.

## 2. Sabit "Kayıt Ol" çubuğu ana sayfada gizli

**Ne bu.** Diğer sayfalarda, özellikle mobilde, ekranın altına yapışan bir "Kayıt Ol" şeridi var. Sayfa kayarken hep görünür kalıyor.

**Ana sayfada ne yaptım.** Laptop'lu ana sayfada bu şeridi gizledim. Sebebi, laptop ekranı büyüyüp sayfayı kaplarken şeridin onun üstüne binme ihtimali. Daha önce `/test` rotasında da gizliydi, aynı davranışı taşıdım.

**Ana sayfada kullanıcı yine de kayıt olabilir.** İki yerde "Kayıt Ol" düğmesi var.

- Üstte, navbar'da.
- En altta, sarı "Takımını kur, yerini ayırt." bölümünde.

**Karar.** İki seçenek var.

1. **Böyle kalsın.** Ek iş yok. Mobilde sadece navbar menüsü ve sayfa sonu düğmesi kayda götürür.
2. **Çubuk geri gelsin.** Mobilde kullanıcı her an tek dokunuşla kayda gidebilir. Ama laptop animasyonunun üstüne binip binmediğine mobilde bakmak gerekir, gerekirse çubuğu sadece animasyon bittikten sonra göstermek mümkün.

Benim önerim önce 1. seçenek. Yayından sonra kayıt sayısı düşük kalırsa çubuğu geri açmak küçük bir iş.

**Verilen karar (14 Ekim 2026).** 1. seçenek: şimdilik böyle kalsın.
