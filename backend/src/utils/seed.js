require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Content = require('../models/Content');

const seedDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gdg_pau';

  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB.');

    // 1. Seed Default ADMIN User
    const adminEmail = (process.env.DEFAULT_ADMIN_EMAIL || 'admin@pau.edu.tr').toLowerCase().trim();
    const adminFullName = process.env.DEFAULT_ADMIN_NAME || 'GDG PAU Admin';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123456!';

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      admin = await User.create({
        fullName: adminFullName,
        email: adminEmail,
        passwordHash,
        role: 'ADMIN'
      });

      console.log('--------------------------------------------------');
      console.log(' Default ADMIN user successfully created:');
      console.log(`   Email:    ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log(`   Role:     ADMIN`);
      console.log('--------------------------------------------------');
    } else {
      console.log(`[Seed] Admin user (${adminEmail}) already exists. Role: ${admin.role}`);
    }

    // 2. Optionally Seed Sample Content if none exists
    const contentCount = await Content.countDocuments();
    if (contentCount === 0) {
      console.log('[Seed] Seeding initial sample GDG On Campus contents...');
      await Content.create([
        {
          title: 'GDG On Campus Pamukkale: Tanışma Toplantısı & Info Session',
          description:
            'Yeni akademik yıla enerjik bir başlangıç yapıyoruz! Google Developer Groups On Campus Pamukkale University topluluğumuzun yeni dönem hedefleri, etkinlikleri ve ekipleriyle tanışmak için herkesi bekliyoruz.',
          coverImageUrl: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop',
          bevyLink: 'https://gdg.community.dev/events/details/developer-student-clubs-pamukkale-university-presents-info-session/',
          isFeatured: true,
          type: 'EVENT',
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        },
        {
          title: 'Google Cloud & AI Bootcamp 2026 Başvuruları Açıldı!',
          description:
            'Yapay zeka ve bulut teknolojilerine adım atmak isteyen öğrenciler için hazırladığımız yoğunlaştırılmış eğitim programı başlıyor. Sınırlı kontenjan için hemen başvurun.',
          coverImageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop',
          bevyLink: null,
          isFeatured: true,
          type: 'ANNOUNCEMENT',
          eventDate: null
        },
        {
          title: 'Pamukkale Hackathon 2026 Duyurusu',
          description:
            'Üniversitemizin en büyük öğrenci hackathonu için geri sayım başladı! Takımını kur, projenle başvur ve büyük ödüller için yarış.',
          coverImageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop',
          bevyLink: null,
          isFeatured: false,
          type: 'ANNOUNCEMENT',
          eventDate: null
        }
      ]);
      console.log('[Seed] Sample events and announcements created successfully.');
    }

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

