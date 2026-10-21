# GDG On Campus Pamukkale University

React/Vite arayüzleri ve Node.js/Express/MongoDB API projesi. Node 24 kullanılır.

| Dizin | Uygulama | Yerel adres |
| --- | --- | --- |
| `frontend/` | Core Team yönetim paneli | http://localhost:5174 |
| `frontend/hackaton/` | Hackathon etkinlik sitesi (eski `web/`) | http://localhost:5173 |
| `backend/` | API | http://localhost:5000 |

Kök dizinde `npm run setup` bağımlılıkları kurar. İlk kurulumda örnek env dosyalarını ilgili dizinlerde `.env` olarak kopyalayıp düzenleyin; mevcut dosyaları ezmeyin. Yerel veritabanı gerekiyorsa `docker compose up -d --wait` kullanın. Bu Compose kendi volume'unu oluşturur; mevcut MongoDB 27017 portunu kullanıyorsa mevcut replica set'i kullanın veya portu ayrıca değiştirin.

`npm run dev` üç uygulamayı başlatır. Ayrı çalıştırmak için `dev:api`, `dev:panel`, `dev:hackaton` komutları vardır. `npm run check` lint, test ve iki üretim build'ini çalıştırır. Testler geçici veritabanı kullanır.

- [Mevcut proje durumu ve dokümantasyon haritası](documents/MEVCUT_PROJE_DURUMU.md)
- [Katılımcı doğrulaması ve test araçları](documents/KATILIMCI_DOGRULAMA.md)
- [Backend kurulum ve kullanım](backend/README.md)
- [API](documents/API.md), [mimari](documents/architecture.md), [veritabanı](documents/DATABASE.md)
- [Sorunlar ve geliştirme öncelikleri](documents/SORUNLAR.md)

İyileştirme kapsamı ve kontrol sonuçları: [test planı](documents/IYILESTIRME_VE_TEST_PLANI.md). Eski tarihli belgeler tarihsel durum içerir; güncel kurulum için bu README ve uygulama README'lerini kullanın.
