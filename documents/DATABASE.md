# Veritabanı mimarisi

[← Mevcut proje durumu](MEVCUT_PROJE_DURUMU.md)

> Kaynak kod incelemesi: 11 Ekim 2026, sürüm `d218156`. Canlı API ve veritabanı testi yapılmadı. Belgelerin ayrılması: 12 Ekim 2026.

Varsayılan veritabanı `gdg_pau`. Mongoose modellerinin varsayılan koleksiyon adları aşağıdadır; bunlar koddan beklenen adlardır, canlı DB'de incelenmedi. Bütün modellerde `versionKey:false`; `__v` sürüm alanı tutulmuyor. Her dokümanda MongoDB `_id` kimliği bulunur.

```mermaid
erDiagram
    User ||--o{ Form : createdBy
    Form ||--o{ FormResponse : form
    User o|--o{ FormResponse : respondent_user
    User {
        ObjectId _id
        string email
        string role
        boolean isEmailVerified
    }
    Form {
        ObjectId _id
        string slug
        string status
        array fields
        number submissionCount
    }
    FormResponse {
        ObjectId form
        string formSlug
        array answers
        array uploadedFiles
    }
    Content {
        string type
        boolean isFeatured
        date eventDate
    }
    HackathonApp {
        string leaderEmail
        number memberCount
        string resumeUrl
    }
    VerificationToken {
        string email
        string purpose
        string code
        date expiresAt
    }
```

Diyagramdaki bağlantılar Mongoose referanslarıdır; SQL foreign key gibi DB tarafından zorunlu ilişki bütünlüğü sağlamaz. VerificationToken e-posta metniyle çalışır; User'a ObjectId referansı yoktur. Content ve HackathonApp bağımsızdır.

### User → `users`

| Alan | Tip | Kural / varsayılan |
| --- | --- | --- |
| `fullName` | String | Zorunlu, trim, 2–100 karakter |
| `email` | String | Zorunlu, unique, lowercase/trim, üç izinli domain |
| `passwordHash` | String | Zorunlu; register/seed bcrypt 10 salt round kullanır |
| `role` | String enum | `PENDING/ORGANIZER/ADMIN`; default PENDING |
| `isEmailVerified` | Boolean | false |
| `createdAt` | Date | Şimdiki zaman |

`toJSON()` passwordHash'ı çıkarır; her tür sorgu dönüşünün otomatik güvenli olduğu varsayılmamalı. Auth controller'ları alan seçerek yanıt verir. Şifre model hook'unda değil register/seed içinde hash edilir. Doğrudan DB/model yazan gelecekteki kod aynı kuralı korumalı.

### Content → `contents`

`title,description,type` zorunlu; `coverImageUrl,bevyLink,eventDate` null; `isFeatured` false; `createdAt` şimdi. Content'in `createdBy`, `updatedAt`, yayın durumu veya ayrı slug alanı yok. EVENT/ANNOUNCEMENT ortak koleksiyonda tutulur; etkinliklere özel kapasite veya katılımcı ilişkisi bulunmaz.

### Form → `forms`

`title`, unique `slug`, `status`, `category`, banner, tarih sınırları, `maxSubmissions`, `submissionCount`, gömülü `fields/settings`, `createdBy:User` referansı. `createdAt` ve `updatedAt` timestamps ile tutulur.

Sorular ayrı koleksiyonda değil aynı form dokümanında gömülüdür. Her sorunun `_id` alanı yok; kimlik `fieldId`. Bu yapı tek sorguda formu getirmek için uygundur. Ancak aynı formu düzenleyince eski yanıtlar için soru şeması sürümü saklanmaz.

### FormResponse → `formresponses`

| Alan | Yapı |
| --- | --- |
| `form` | Zorunlu ObjectId → Form |
| `formSlug` | Zorunlu String; başvuru anındaki slug kopyası |
| `answers[]` | `{fieldId, label, value}`; value `Mixed`, null varsayılan |
| `uploadedFiles[]` | `{fieldId,originalName,filename,url,size}` |
| `respondent` | `{ip,userAgent,user}`; user opsiyonel User referansı |
| `submittedAt` | Date, şimdi |

Cevaplar formdan ayrı koleksiyonda tutulduğu için form büyüklüğü cevap sayısıyla artmaz. `label` kopyası soru metninin gönderim anını kısmen korur; fakat export güncel `Form.fields` şemasını kullanır. `Mixed` esneklik sağlar, tip güvenliği için controller doğrulaması gerekir. IP ve user agent veri olarak saklanır.

### HackathonApp → `hackathonapps`

Takım/lider bilgileri, üye sayısı, proje fikri, isteğe bağlı CV URL'si ve `appliedAt`. Takım üyelerinin bireysel bilgileri yok; yalnızca sayı tutulur. Başvurunun onay/red durumu, etkinlik ID'si, yıl veya hakem değerlendirmesi yok. Takım adı/e-posta unique değil; birden çok kodla tekrar başvuru mümkündür.

### VerificationToken → `verificationtokens`

E-posta, düz metin kod, amaç, attempts, expiresAt, createdAt. Amaçlar `REGISTER`, `LOGIN_2FA`, `HACKATHON_APPLY`, `FORM_SUBMIT`; mevcut controller'lar yalnızca REGISTER ve HACKATHON_APPLY kullanır.

`expiresAt` TTL indeksi kaydı süre dolunca otomatik temizlemek üzere tanımlanmış. Kod ayrıca süreyi kontrol eder; TTL temizliği tam süre sonunda gerçekleşecek diye varsayılmaz. Kod üretimindeki `Math.random()` kriptografik rastgelelik sağlamaz; kaynak yorumundaki güvenlik iddiasıyla uyumlu değildir.

### Kodda tanımlı indeksler

Her koleksiyonda MongoDB'nin `_id` indeksi beklenir; ek tanımlar:

| Model | İndeksler |
| --- | --- |
| User | `email` unique |
| Content | Tekil `isFeatured`, `type`, `createdAt`; bileşik `{type:1,createdAt:-1}`, `{isFeatured:1,createdAt:-1}` |
| Form | `slug` unique; tekil `status`, `category`; bileşik `{status:1,createdAt:-1}`, `{category:1,status:1}` |
| FormResponse | Tekil `form`, `formSlug`, `submittedAt`; bileşik `{form:1,submittedAt:-1}` |
| HackathonApp | `appliedAt` için alan üzerinde ve ayrıca `{appliedAt:-1}`; `{teamName:'text',leaderName:'text',leaderEmail:'text'}` |
| VerificationToken | Tekil `email`, `purpose`; `expiresAt` TTL (`expireAfterSeconds:0`) |

Hackathon araması `$text` kullanmadığı için text indeksi bu aramayı doğrudan karşılamaz. Sınırsız, başlangıca sabitlenmemiş regex aramalarının maliyeti veri büyüdükçe artabilir. Featured sıralamasındaki `eventDate` mevcut bileşik indekste yok. Token için sık kullanılan `(email,purpose)` sorgusu bileşik unique indeksle korunmuyor; eşzamanlı kod üretiminde birden fazla token riski var. İndekslerin fiilen oluştuğu ve performansı `getIndexes()/explain` ile ayrıca ölçülmeli.

### Bütünlük ve eşzamanlılık

- Submit önce FormResponse oluşturur, sonra form sayacını artırıp kaydeder. Transaction yok: cevap kaydı başarılı olup sayaç kaydı başarısız olabilir.
- Kota kontrolü ve sayaç artışı atomik değil. Eşzamanlı başvurular kotayı aşabilir; sayaç güncellemesi de çakışabilir.
- Form/cevap silme birlikte transaction kullanmaz.
- OTP doğrulaması okuma ve silme adımlarından oluşur; tek kullanımlılık eşzamanlı isteklerde atomik garantilenmez.
- Slug üretimi önce varlık kontrolü yapar; unique indeks yarışta son korumadır, kullanıcıya 409 dönebilir.
- Dosya sistemi ile DB arasında transaction yok. Başarısız isteklerden yetim dosya kalabilir.
