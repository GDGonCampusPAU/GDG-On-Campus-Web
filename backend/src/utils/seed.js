require('dotenv').config();
const mongoose = require('mongoose');
const { ensureAdmin } = require('../services/seedAdminService');
const { ensureHackathonPage, FORM_SLUG } = require('../services/eventPageService');
const Content = require('../models/Content');

const seedDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gdg_pau';

  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB.');

    // 1. Seed Default ADMIN User
    const admin = await ensureAdmin();
    console.log(`[Seed] Verified ADMIN ready: ${admin.email}`);

    // 2. Seed Sample Content if none exists (without external Unsplash URLs)
    const contentCount = await Content.countDocuments();
    if (contentCount === 0) {
      console.log('[Seed] Seeding initial sample GDG On Campus contents...');
      await Content.create([
        {
          title: 'GDG On Campus Pamukkale: Tanışma Toplantısı & Info Session',
          description:
            'Yeni akademik yıla enerjik bir başlangıç yapıyoruz! Google Developer Groups On Campus Pamukkale University topluluğumuzun yeni dönem hedefleri, etkinlikleri ve ekipleriyle tanışmak için herkesi bekliyoruz.',
          coverImageUrl: null,
          bevyLink: 'https://gdg.community.dev/events/details/developer-student-clubs-pamukkale-university-presents-info-session/',
          isFeatured: true,
          type: 'EVENT',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        },
        {
          title: 'Google Cloud & AI Bootcamp 2026 Başvuruları Açıldı!',
          description:
            'Yapay zeka ve bulut teknolojilerine adım atmak isteyen öğrenciler için hazırladığımız yoğunlaştırılmış eğitim programı başlıyor. Sınırlı kontenjan için hemen başvurun.',
          coverImageUrl: null,
          bevyLink: null,
          isFeatured: true,
          type: 'ANNOUNCEMENT',
          eventDate: null
        },
        {
          title: 'Pamukkale Hackathon 2026 Duyurusu',
          description:
            'Üniversitemizin en büyük öğrenci hackathonu için geri sayım başladı! Takımını kur, projenle başvur ve büyük ödüller için yarış.',
          coverImageUrl: null,
          bevyLink: null,
          isFeatured: false,
          type: 'ANNOUNCEMENT',
          eventDate: null
        }
      ]);
      console.log('[Seed] Sample events and announcements created successfully.');
    }

    // 3. Ensure Hackathon EventPage and dynamic registration form (hackathon-katilim)
    console.log(`[Seed] Ensuring hackathon event page and form (${FORM_SLUG})...`);
    await ensureHackathonPage();
    console.log(`[Seed] Hackathon event page and registration form (${FORM_SLUG}) verified.`);

    console.log('[Seed] Database seeding completed successfully.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error] Failed to seed database:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

seedDatabase();
