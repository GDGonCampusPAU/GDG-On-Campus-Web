# GDG On Campus Pamukkale University

React/Vite arayüzleri ve Node.js/Express/MongoDB API projesi. Node 24 kullanılır.

| Dizin | Uygulama | Yerel adres |
| --- | --- | --- |
| `frontend/` | Core Team yönetim paneli | http://localhost:5174 |
| `frontend/hackaton/` | Hackathon etkinlik sitesi (eski `web/`) | http://localhost:5173 |
| `backend/` | API | http://localhost:5000 |

Yerel geliştirmede Docker ile tüm projeyi başlatmak için `backend/.env` ayarlarını hazırlayıp kökte `docker compose up -d --build --wait` çalıştırın. MongoDB, API ve iki ön yüz birlikte başlar; bilgisayarınızda Node/npm kurulumu gerekmez. Uygulama adresleri yukarıdaki tablodadır. Kaynak değişiklikleri container'lara yansır; paket bağımlılığı değişirse yeniden build gerekir.

Compose kendi MongoDB volume'unu ve kalıcı `backend/uploads` dizinini kullanır. Mevcut MongoDB 27017 portunu kullanıyorsa kökteki `.env` dosyasında `MONGO_PORT` değiştirilebilir; diğer portlar ve tarayıcı API/CORS ayarları için [.env.docker.example](.env.docker.example) dosyasına bakın. `docker compose logs -f` logları gösterir; `docker compose down` servisleri durdurur ve veritabanı volume'unu korur. İlk admin için `DEFAULT_ADMIN_PASSWORD` ayarlandıktan sonra `docker compose exec backend npm run seed` çalıştırılır.

Docker olmadan geliştirme için kökte `npm run setup` bağımlılıkları kurar. İlk kurulumda örnek env dosyalarını ilgili dizinlerde `.env` olarak kopyalayıp düzenleyin; mevcut dosyaları ezmeyin. Sadece MongoDB'yi Compose ile çalıştırmak için `docker compose up -d --wait mongo` kullanabilirsiniz.

`npm run dev` üç uygulamayı başlatır. Ayrı çalıştırmak için `dev:api`, `dev:panel`, `dev:hackaton` komutları vardır. `npm run check` üç paketin lint/test kontrollerini ve iki üretim build'ini çalıştırır. `npm run setup:browser` ardından `npm run test:e2e` gerçek Chromium akışlarını kontrol eder. Testler geçici veritabanı kullanır.

- [Mevcut proje durumu ve dokümantasyon haritası](documents/MEVCUT_PROJE_DURUMU.md)
- [Katılımcı doğrulaması ve test araçları](documents/KATILIMCI_DOGRULAMA.md)
- [Backend kurulum ve kullanım](backend/README.md)
- [API](documents/API.md), [mimari](documents/architecture.md), [veritabanı](documents/DATABASE.md)
- [Sorunlar ve geliştirme öncelikleri](documents/SORUNLAR.md)

İyileştirme kapsamı ve kontrol sonuçları: [test planı](documents/IYILESTIRME_VE_TEST_PLANI.md). Eski tarihli belgeler tarihsel durum içerir; güncel kurulum için bu README ve uygulama README'lerini kullanın.
