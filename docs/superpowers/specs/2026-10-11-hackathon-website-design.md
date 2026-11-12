# GDG On Campus PAU Hackathon Websitesi: Tasarım Spec'i

Tarih: 2026-10-11
Durum: Kullanıcı incelemesi bekliyor

## 1. Amaç

GDG On Campus PAU'nun hackathonu için katılımcıların dikkatini çekecek ve kayıt olmaya yönlendirecek çok sayfalı, Türkçe bir web sitesi. Başarı ölçütü: bir ziyaretçi ana sayfada etkinliği, tarihi ve ödülleri anlar, 2 tıklama içinde kayıt formuna ulaşır ve formu mobilde sorunsuz tamamlar.

## 2. Kararlar

| Konu | Karar |
|---|---|
| Kapsam | 4 sayfa: Ana sayfa, Kayıt, Program, Ekip |
| Stil | Canlı Google/GDG kimliği, brand guide'a sadık |
| Teknoloji | React 18 + Vite + react-router-dom, düz CSS (UI kütüphanesi yok) |
| Dil | Yalnızca Türkçe (i18n yok) |
| İmza öğe | Hareketli 4 renk geometri hero'su |
| Konum | `/Users/heath/Python/Hackathon/web/` |

## 3. Marka kuralları

Kaynak: `Docs/GDG On Campus PAU - Brand Guide.pdf`.

- **Fontlar:** Google Sans (ana; başlıkta bold ile regular karışımı, paragrafta Regular). Google Sans Mono (kısa satırlar, isimler, geri sayım, küçük veri).
- **Çekirdek renkler:** Blue `#4285f4`, Green `#34a853`, Yellow `#f9ab00`, Red `#ea4335`.
- **Halftone:** `#57caff`, `#5cdb6d`, `#ffd427`, `#ff7daf`.
- **Pastel:** `#c3ecf6`, `#ccf6c5`, `#ffe7a5`, `#f8d8d8`.
- **Gri:** Off White `#f0f0f0`, Black `#1e1e1e`.
- **İsim:** "GDG On Campus PAU" tam adı, "GDG" kısaltması kullanılır.

Renkler `src/styles/tokens.css` içinde CSS değişkeni olarak tanımlanır; bileşenler ham hex kullanmaz.

## 4. Sayfalar

### 4.1 Ana sayfa `/`
1. **Hero:** hareketli geometri (4.5), başlık, geri sayım, birincil CTA "Kayıt Ol", ikincil CTA "Programı Gör".
2. **Marquee şeridi:** tema/etiket metni sürekli kayar.
3. **Tanıtım:** 3 kısa kart (ne, kim için, neden katılmalı).
4. **Ödül özeti:** 3 ödül kartı (1., 2., 3.), her biri farklı çekirdek renkte.
5. **Sponsor şeridi:** logolar, `/ekip` sayfasına bağlantı.
6. **Kapanış CTA:** renk bloklu bölüm, "Kayıt Ol".

### 4.2 Kayıt `/kayit`
4 adımlı form, üstte ilerleme göstergesi.

| Adım | Alanlar |
|---|---|
| 1 Kişi | ad soyad, e-posta, telefon, bölüm, sınıf |
| 2 Takım | takım adı, rol (takım kurucusu / üye / takım arıyorum), takım arkadaşları (isteğe bağlı) |
| 3 İlgi | ilgi alanları (çoklu seçim: Web, Mobil, Yapay Zeka, Oyun, Bulut), deneyim seviyesi |
| 4 Onay | özet, KVKK/katılım koşulu onay kutusu, gönder |

- Zorunlu alan boşsa "İleri" engellenir, alanın altında hata metni gösterilir.
- E-posta basit biçim kontrolü yapar. Adımlar arası geri dönüşte veri korunur.
- Gönderimde `import.meta.env.VITE_REGISTER_ENDPOINT` tanımlıysa JSON POST edilir; tanımlı değilse istek atılmaz. Her iki durumda başarılı yanıt veya endpoint yokluğu başarı ekranını açar; ağ hatasında hata mesajı ve "Tekrar dene" gösterilir.
- Başarı ekranı: konfeti yerine marka şekillerinden kısa animasyon, "Programı Gör" bağlantısı.

### 4.3 Program `/program`
`data/event.js` içindeki günlere göre dikey zaman çizelgesi. Her öğe: saat (Mono), başlık, kısa açıklama, tür etiketi (açılış, workshop, kodlama, teslim, jüri, ödül). Masaüstünde gün sekmeleri, mobilde alt alta bölümler.

### 4.4 Ekip `/ekip`
Üç bölüm: Jüri, Mentorlar, Sponsorlar. Kişi kartı: renkli şekil çerçeveli avatar (görsel yoksa baş harfler), ad (Mono), unvan. Sponsor ızgarası: seviyeye göre (ana, destek) boyutlandırılmış logo kutuları.

### 4.5 Hero geometrisi
- Bileşen: `HeroShapes`, tek `<svg>` içinde 4 şekil: Blue daire, Red kare, Yellow üçgen, Green yarım daire.
- Hareket: her şekil kendi yavaş sürüklenme yörüngesinde döner/kayar (CSS animation). Fare veya dokunma konumuna göre şekilleri katmana göre ters yönde kaydıran parallax uygulanır (pointer olayı, `requestAnimationFrame` ile sınırlı).
- `prefers-reduced-motion: reduce` durumunda animasyon ve parallax kapalı, şekiller sabit kompozisyonda.
- Başlık metni SVG'nin üstünde, şekiller içeriği örtmeyecek şekilde arka planda konumlanır.

## 5. Ortak bileşenler ve davranış

- **Navbar:** logo/wordmark, 4 bağlantı, "Kayıt Ol" butonu. Mobilde hamburger menü.
- **Sabit CTA:** `/kayit` dışındaki sayfalarda mobilde alt çubuk olarak "Kayıt Ol".
- **Footer:** GDG On Campus PAU adı, sosyal bağlantılar (data'dan), telif satırı.
- **Scroll reveal:** kartlar görünür alana girince `IntersectionObserver` ile belirir; reduced-motion'da hemen görünür.
- **Button:** hover'da köşe yarıçapı değişimi (yuvarlak → kare) ile oyuncu geri bildirim; odak halkası her zaman görünür.
- **Geri sayım:** `data.event.startsAt` ISO tarihine bakar; tarih geçmişse "Başladı" metni gösterir.

## 6. Veri modeli (`src/data/event.js`)

Tek kaynak; sayfalar buradan okur, başka yerde içerik sabitlenmez.

```js
export const event = {
  name, tagline, theme,
  startsAt,            // ISO string
  location,
  prizes: [{ place, title, description, color }],
  days: [{ label, date, items: [{ time, title, description, type }] }],
  people: { jury: [...], mentors: [...] },        // { name, title, photo? }
  sponsors: [{ name, tier, logo, url }],
  socials: [{ label, url }],
};
```

Tüm değerler placeholder olarak girilir ve gerçek bilgiler gelince yalnızca bu dosya güncellenir.

## 7. Erişilebilirlik ve performans

- Mobile-first, kırılımlar 375 / 768 / 1440 px; yatay kaydırma yok.
- Metin/zemin kontrastı AA. Sarı yüzeylerde yalnızca siyah metin.
- Klavye ile tüm etkileşimler kullanılabilir; form alanları `label` ile bağlı, hatalar `aria-live` bölgesinde duyurulur.
- Animasyonlar yalnızca `transform`/`opacity` ile yapılır, reduced-motion saygı görür.
- Fontlar `font-display: swap`; dosyalar yoksa `system-ui` / `ui-monospace` fallback.

## 8. Dosya yapısı

```
web/
  index.html, package.json, vite.config.js
  public/fonts/, public/logos/
  src/
    main.jsx, App.jsx
    styles/tokens.css, base.css
    data/event.js
    components/  Navbar, Footer, HeroShapes, Countdown, Marquee, Button,
                 SectionHeading, PersonCard, SponsorGrid, Timeline, StepForm
    pages/       Home, Register, Schedule, Team
```

## 9. Kapsam dışı

Backend/veritabanı, kullanıcı hesabı, i18n, CMS, e-posta gönderimi, ödeme, admin paneli.

## 10. Açık noktalar (spec'i bloklamaz)

1. Hackathon adı, tarih, tema, ödül, program, jüri ve sponsor bilgileri placeholder; ekip gerçek içeriği verince `event.js` güncellenir.
2. Google Sans ve Google Sans Mono dosyaları brand guide'daki Download bağlantılarından indirilip `public/fonts/` içine konacak.
3. Resmi GDG logoları (PDF'te görsel olarak var, metin olarak çıkarılamadı) `public/logos/` içine konacak; gelene kadar metin wordmark kullanılır.
4. Kayıt verisinin nereye gideceği (Google Forms, Formspree, kendi API'miz) belirlenince `VITE_REGISTER_ENDPOINT` ayarlanır.

## 11. Doğrulama

- `npm run build` hatasız biter.
- `npm run dev` ile 4 rota açılır; 375/768/1440 px'te taşma yok.
- Hero animasyonu çalışır; reduced-motion'da durur.
- Kayıt formu: zorunlu alan boşken ilerlemez, geri dönüşte veri korunur, tüm adımlardan sonra başarı ekranı gelir, endpoint hatasında hata mesajı görünür.
- Geri sayım tarih geçmişken "Başladı" gösterir.
- Sarı yüzeylerde kontrast elle kontrol edilir.
