# Jüri Puanlama Sistemi — Görev Tanımı (Spec)

Pamukkale Hackathon (27 Kasım, 09.00–21.00) için jürilerin projeleri kriterlere göre puanlayacağı, her kritere isteğe bağlı gerekçe yazabileceği ve ödül kategorilerine aday gösterebileceği bir sistem. Sistem, mevcut monorepo'ya eklenecek: ayrı site veya iframe **yok**.

- **Backend:** `backend/` içine yeni bir jüri modülü (Express + Mongoose).
- **Jüri ekranı:** `frontend/hackaton/` içine yeni `/juri/:token` sayfası.
- **Sonuç ve yönetim ekranı:** `frontend/hackaton/` içindeki mevcut `/admin` sayfasına (veya onun altına `/admin/juri`) eklenecek; mevcut `loginEditor` girişi ve ORGANIZER/ADMIN rolleri kullanılacak.

Teslim tarihi: etkinlikten en geç 1–2 gün önce canlıda ve denenmiş olmalı. Kapsam bilinçli olarak dar tutuldu.

---

## 0. Claude Code için çalışma kuralları

1. Kod yazmadan önce `README.md`, `docs/architecture.md`, `docs/API.md`, `docs/DATABASE.md`, `backend/src/modules/hackathon/` ve `frontend/hackaton/src/` yapısını oku. Mevcut desenleri (modül yapısı, hata yönetimi, `api()` yardımcısı, test stili, JSDoc + `checkJs`) aynen takip et.
2. Önce bu spec'e göre kısa bir uygulama planı çıkar ve onay bekle.
3. `dev` branch'inden `feat/jury-scoring` branch'i aç. Küçük, anlamlı commit'ler at.
4. Mevcut modellerde (`User`, `HackathonTeam`, `Form` vb.) değişiklik gerekiyorsa önce sor. `User` rol enum'una **dokunma**.
5. Arayüz metinleri Türkçe olacak.
6. Bitince `npm run check` hatasız geçmeli. Yeni kod için backend (node:test + mongodb-memory-server) ve frontend (vitest) testleri yazılmalı.
7. `docs/API.md` ve `docs/DATABASE.md` yeni endpoint ve modellerle güncellenmeli.

---

## 1. Kavramlar

| Kavram | Açıklama |
|---|---|
| **Kriter** | Puanlanan başlık. Jüri 1–5 arası tam sayı verir. Her kriterin ağırlığı vardır; ağırlıklar toplamı 100. |
| **Kategori (ödül)** | Örn. "Vay Be". Hangi kriterlere göre sıralanacağı tanımlıdır. Jüri, takımı kategorilere aday gösterebilir. |
| **Yarışan takım (entry)** | Puanlanacak takım: bir `HackathonTeam` + sunum sırası + proje adı / repo / demo linkleri. |
| **Jüri** | Hesap açmadan, kendisine özel token'lı link ile giriş yapan kişi. |
| **Puan kartı (scorecard)** | Bir jürinin bir takım için verdiği puanlar, gerekçeler, adaylıklar ve genel yorum. |

---

## 2. Varsayılan kriterler

Admin ekranından düzenlenebilir; bu değerler seed/varsayılan olarak gelir.

| key | Ad | Ağırlık | Jüriye kısa açıklama |
|---|---|---|---|
| `technical` | Teknik uygulama ve çalışırlık | 25 | Teknik zorluk, mimari, 12 saatte ne kadarı çalışır halde |
| `originality` | Fikir özgünlüğü ve yaratıcılık | 15 | Benzerini gördünüz mü? Yeni bir bakış açısı var mı? |
| `problemFit` | Problem ve temaya uygunluk | 15 | Gerçek bir problem mi, tema ile örtüşüyor mu? |
| `demo` | Demo ve sunum | 15 | Canlı demo sorunsuz mu, anlatım net mi, süreye uyuldu mu? |
| `aiMastery` | AI kullanımı ve kodu açıklayabilme | 10 | AI bilinçli mi kullanılmış? Takım kodunu açıklayabiliyor mu? |
| `ux` | Kullanıcı deneyimi ve arayüz | 10 | Arayüz kalitesi, kullanım kolaylığı |
| `impact` | Gerçek dünyada uygulanabilirlik | 10 | Hayata geçebilir mi, kime ne fayda sağlar? |

Her kriter için arayüzde 1 ve 5'in anlamını gösteren kısa ipucu olmalı (ör. 1 = "zayıf / yok", 3 = "yeterli", 5 = "olağanüstü").

## 3. Varsayılan kategoriler

Kategori listesi henüz kesinleşmedi; bu yüzden **koda gömülmeyecek**, admin ekranından düzenlenebilir olacak. Varsayılan:

| key | Ad | İkon (emoji) | Sıralama kriterleri | Öncelik |
|---|---|---|---|---|
| `campusHero` | Kampüsün Kahramanı | 🛡️ | `problemFit`, `impact` | 1 |
| `wow` | Vay Be | 🚀 | `originality` | 2 |
| `demoGod` | Demo Tanrısı | 🎤 | `demo` | 3 |
| `pilot` | Pilotun Kendisi | 🧑‍✈️ | `aiMastery` | 4 |
| `dreamTeam` | Dream Team | ⚙️ | *(boş: yalnızca adaylık)* | 5 |

Yedek kategoriler (Pixel Perfect → `ux`, Mini Ama Dev, Rubber Duck vb.) admin tarafından eklenebilmeli. "Topluluk Seçimi" (halk oylaması) bu sistemin **kapsamı dışında**.

---

## 4. Hesaplama kuralları

Hesaplama saf bir fonksiyon olmalı (`computeResults(config, entries, scorecards)`), ayrı dosyada ve kapsamlı birim testli.

1. **Yalnızca `SUBMITTED` durumundaki puan kartları** hesaba girer. Taslaklar girmez.
2. **Jüri toplam puanı (0–100):** `Σ ağırlık × (puan / 5)`.
3. **Takım genel puanı:** Puan kartı gönderen jürilerin toplam puanlarının ortalaması. Kaç jürinin puanladığı (`judgeCount`) da döndürülür; jüri sayısı eksikse arayüzde uyarı gösterilir.
4. **Kategori puanı:** Kategorinin sıralama kriterlerinin ağırlıklı puanı, 0–100'e normalize edilmiş halde, jüriler üzerinden ortalaması.
5. **Kategori kazananı (öneri):**
   - Kategoriler **öncelik sırasına göre** işlenir.
   - **Bir takım en fazla bir ödül alır.** Daha önce ödül almış takım sonraki kategorilerde atlanır.
   - Aday havuzu: o kategoriye en az bir jüriden adaylık almış, henüz ödül almamış takımlar. Havuz boşsa tüm (ödül almamış) puanlanmış takımlar.
   - Sıralama: kategori puanı ↓ → adaylık sayısı ↓ → genel puan ↓ → `technical` puanı ↓.
   - Sıralama kriteri boş olan kategorilerde (Dream Team): adaylık sayısı ↓ → genel puan ↓.
   - Sonuç her kategori için ilk 3 adayla birlikte döner, ekranda **"öneri"** olarak gösterilir. Son kararı jüri/organizasyon verir.
6. Genel sıralama: genel puan ↓ → `technical` ↓.

---

## 5. Veri modeli (Mongoose)

### `JudgingConfig` (tekil doküman, `_id: 'hackathon'`)
```
criteria:   [{ key, label, description, weight }]        // ağırlık toplamı 100 olmalı (doğrulama)
categories: [{ key, name, icon, criterionKeys: [key], priority, active }]
entries:    [{ team: ObjectId(HackathonTeam), order: Number, projectName, repoUrl, demoUrl, presentationUrl }]
locked:     Boolean   // true iken jüri puan değiştiremez
revision:   Number    // eşzamanlı düzenleme koruması (eventPage'deki desen gibi)
updatedBy, timestamps
```
- Puan kartı varken bir kriter **silinemez** veya `key`'i değiştirilemez; sadece `label`, `description`, `weight` değişebilir.
- Linkler `http(s)://` ile başlamalı.

### `Juror`
```
name:       String (zorunlu)
tokenHash:  String (sha256, unique, select: false)
active:     Boolean (default true)
lastSeenAt: Date
timestamps
```
- Token `crypto.randomBytes(24)` → base64url. **Düz token veritabanında saklanmaz**; sadece oluşturulduğu/yenilendiği anda admin'e bir kez gösterilir.

### `Scorecard`
```
juror:  ObjectId(Juror)
team:   ObjectId(HackathonTeam)
scores: [{ criterion: key, value: 1..5 | null, comment: String (≤ 1000) }]
nominations:    [categoryKey]
generalComment: String (≤ 2000)
status:      'DRAFT' | 'SUBMITTED'
submittedAt: Date
timestamps
unique index: { juror: 1, team: 1 }
```

---

## 6. API

Mevcut düzene uygun olarak `/api/v1` altında. Yanıt biçimi mevcut endpoint'lerle aynı (`{ success, data }` / `{ success: false, message }`).

### Jüri (header: `Authorization: Bearer <jurorToken>`)
Ayrı bir `jurorAuth` middleware'i: token'ı hash'ler, aktif jüriyi bulur, `req.juror`'a koyar, `lastSeenAt`'i günceller. Geçersiz/pasif token → 401.

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/jury/me` | Jüri adı, `locked`, kriterler, aktif kategoriler, sunum sırasına göre takım listesi + bu jürinin her takım için durumu (`NONE` / `DRAFT` / `SUBMITTED`) |
| GET | `/jury/entries/:teamId` | Takım bilgisi (ad, proje adı, linkler) + bu jürinin puan kartı |
| PUT | `/jury/entries/:teamId/scorecard` | Gövde: `{ scores, nominations, generalComment, submit: boolean }`. `submit: false` → taslak kaydet (eksik puan olabilir). `submit: true` → tüm kriterler 1–5 dolu olmalı, durum `SUBMITTED`. Gönderilmiş kart, kilit kapalıyken tekrar düzenlenip yeniden gönderilebilir. `locked` ise 423 veya 409. Bilinmeyen kriter/kategori key'i → 400. |

Jüri **başka jürilerin puanlarını ve sonuçları göremez.**

### Yönetim (mevcut auth + `requireRoles('ORGANIZER', 'ADMIN')`)

| Metot | Yol | Açıklama |
|---|---|---|
| GET / PUT | `/jury-admin/config` | Kriter, kategori, yarışan takım listesi; PUT `revision` ile |
| GET | `/jury-admin/teams` | Eklenebilecek `HackathonTeam` listesi (ad, kod, üye sayısı) |
| GET | `/jury-admin/jurors` | Jüri listesi (ad, aktiflik, son görülme, kaç takım puanladı) |
| POST | `/jury-admin/jurors` | Yeni jüri; yanıtta **bir kereye mahsus** `token` döner |
| POST | `/jury-admin/jurors/:id/regenerate` | Yeni token (eski link geçersiz olur) |
| PATCH | `/jury-admin/jurors/:id` | Ad / aktiflik değişikliği |
| PUT | `/jury-admin/lock` | `{ locked: boolean }` |
| GET | `/jury-admin/results` | `computeResults` çıktısı + her takım için jüri bazında puanlar ve tüm gerekçeler |
| GET | `/jury-admin/results.csv` | Takım × kriter × jüri dökümü (UTF-8 BOM ile, Excel'de Türkçe karakter bozulmasın) |

---

## 7. Arayüz

### 7.1 Jüri ekranı — `frontend/hackaton`, route `juri/:token`
Jüriler salonda **telefondan** puanlayacak: mobil öncelikli tasarım, büyük dokunma alanları, yatay kaydırma yok. Sitenin mevcut tema, font ve bileşenleri (`Button`, `Field` vb.) kullanılacak. Bu sayfa `admin` gibi ana `Layout`'un dışında, sade bir düzende olabilir.

- **Liste görünümü:** Üstte jüri adı. Sunum sırasına göre takımlar; her satırda sıra no, takım/proje adı ve durum rozeti (✅ Gönderildi / ✏️ Taslak / ⏳ Bekliyor). Üstte ilerleme: "4 / 12 takım puanlandı".
- **Takım görünümü:**
  - Proje adı, takım adı, repo / demo / sunum linkleri (yeni sekmede).
  - Her kriter için: ad, kısa açıklama, **1–5 arası büyük buton grubu** (radio davranışı), altında **"Neden? (isteğe bağlı)"** açılır metin alanı.
  - Ödül adaylığı: aktif kategoriler ikon + ad ile **işaret kutuları**.
  - Genel yorum alanı.
  - Anlık hesaplanan toplam puan (ör. "78 / 100").
  - **Otomatik taslak kaydı:** değişiklikten ~1 sn sonra `submit: false` ile PUT. Ekranda "Kaydedildi / Kaydediliyor / Kaydedilemedi" durumu. Sunucuya ulaşılamazsa veri `localStorage`'da tutulup bağlantı gelince tekrar denenir (try/catch ile, depolama yoksa da çalışmalı).
  - **"Puanları Gönder"** butonu: eksik kriter varsa hangi kriterlerin eksik olduğunu gösterir.
  - Önceki / sonraki takım geçişi.
- `locked` ise tüm alanlar salt okunur, üstte "Puanlama kapatıldı" bilgisi.
- Geçersiz link → anlaşılır hata sayfası ("Bu jüri linki geçersiz, organizasyon ekibiyle iletişime geçin").
- Token URL'de kalabilir; ama sayfa `<meta name="robots" content="noindex">` ve `Referrer-Policy: no-referrer` (veya link'lere `rel="noreferrer"`) kullanmalı ki token dış sitelere sızmasın.

### 7.2 Yönetim ekranı — mevcut `/admin` (ORGANIZER/ADMIN girişiyle)
Mevcut Admin sayfasının desenine uygun yeni bir "Jüri" bölümü/sekmesi veya `/admin/juri` sayfası:

1. **Kriterler:** ad, açıklama, ağırlık düzenleme; toplam ≠ 100 ise kaydetmeyi engelle.
2. **Kategoriler:** ekle / düzenle / pasifleştir; sıralama kriterlerini ve önceliği seç.
3. **Yarışan takımlar:** `HackathonTeam` listesinden ekle, sunum sırasını belirle (yukarı/aşağı yeterli), proje adı ve linkleri elle gir/düzenle (teslim sistemi hazır olunca oradan alınabilir; şimdilik elle).
4. **Jüriler:** ekle, link oluştur/yenile; oluşan linki **kopyala** butonu ile göster (tek seferlik uyarısıyla), aktif/pasif yap, son görülme ve ilerleme.
5. **Sonuçlar:** genel sıralama tablosu (takım, genel puan, jüri sayısı, kriter ortalamaları), her kategori için önerilen kazanan + ilk 3 aday, takıma tıklayınca jüri bazında puanlar ve tüm gerekçe yorumları. 10 sn'de bir otomatik yenileme (websocket gerekmez). CSV indir butonu.
6. **Puanlamayı kilitle / aç** anahtarı.

---

## 8. Güvenlik ve dayanıklılık

- Jüri token'ı yalnızca hash olarak saklanır, karşılaştırma hash üzerinden.
- Jüri endpoint'lerine mevcut genel rate limit uygulanır; token doğrulama denemeleri için ek sıkı limit.
- Girdi doğrulaması sunucu tarafında: puan 1–5 tam sayı, bilinmeyen key reddi, metin uzunluk sınırları, `entries`'te olmayan takım için 404.
- Kilit açıkken bile bir jüri yalnızca kendi kartını değiştirebilir.
- Mevcut `helmet`, CORS ve hata yöneticisi ayarları bozulmamalı.

## 9. Testler (asgari)

- **`computeResults`:** ağırlıklı toplam; taslakların hariç tutulması; eksik jüri; kategori önceliği ve "takım başına bir ödül"; aday havuzunun boş olması; eşitlik bozma zinciri; Dream Team (kriter boş) durumu.
- **Backend:** geçersiz/pasif token 401; jüri başka takımın kartını değil kendi kartını görür; `submit: true`'da eksik kriter 400; kilitliyken yazma reddi; admin olmayan kullanıcıya yönetim endpoint'leri 401/403; token'ın düz halde saklanmadığı; kriter silme koruması; ağırlık toplamı doğrulaması.
- **Frontend:** jüri sayfası listeyi ve durum rozetlerini gösterir; 1–5 seçimi ve gerekçe alanı; eksik kriterle gönderme uyarısı; kilitli mod; geçersiz link ekranı; admin sonuç tablosunun render'ı.

## 10. Kapsam dışı (bu sürümde yok)

- Halk oylaması / "Topluluk Seçimi"
- Proje teslim formu (site ekibinin görevi; hazır olunca linkler oradan beslenebilir)
- Jürilere e-posta gönderimi (linkler elle/WhatsApp ile iletilecek)
- Canlı (websocket) güncelleme, puan normalizasyonu (jüriler arası sertlik farkı)

## 11. Kabul kriterleri

- [ ] Admin, 3 jüri oluşturup linklerini kopyalayabiliyor.
- [ ] Admin, takımları ekleyip sunum sırasını ve linklerini girebiliyor.
- [ ] Jüri telefondan linke girip tüm takımları puanlayabiliyor, her kritere isteğe bağlı gerekçe yazabiliyor, kategorilere aday gösterebiliyor.
- [ ] Sayfa yenilense veya internet kısa süre kopsa da taslak kaybolmuyor.
- [ ] Admin, sonuç tablosunda genel sıralamayı ve kategori önerilerini görüyor, CSV indirebiliyor.
- [ ] Kilit açıldığında jüriler puan değiştiremiyor.
- [ ] `npm run check` geçiyor; `docs/API.md` ve `docs/DATABASE.md` güncel.
