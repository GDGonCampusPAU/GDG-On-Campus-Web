require('dotenv').config();
const mongoose = require('mongoose');
const { ensureAdmin } = require('../services/seedAdminService');
const Content = require('../models/Content');
const Form = require('../models/Form');

const seedDatabase = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gdg_pau';

  try {
    console.log('[Seed] Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB.');

    // 1. Seed Default ADMIN User
    const admin = await ensureAdmin();
    console.log(`[Seed] Verified ADMIN ready: ${admin.email}`);

    // 2. Seed Sample Content if none exists
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
          eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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

    // 3. Seed Sample Dynamic Form (Google Forms Yapısı)
    const formCount = await Form.countDocuments();
    if (formCount === 0) {
      console.log('[Seed] Seeding sample dynamic Google Forms template...');
      await Form.create({
        title: 'Pamukkale Hackathon 2026 Başvuru Formu',
        description: 'Google Developer Groups on Campus Pamukkale University Hackathon 2026 takım başvuru formudur.',
        slug: 'hackathon-2026-basvuru',
        status: 'PUBLISHED',
        category: 'HACKATHON',
        bannerImageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&auto=format&fit=crop',
        createdBy: admin ? admin._id : null,
        settings: {
          allowMultipleSubmissions: true,
          successMessage: 'Hackathon başvurunuz başarıyla alındı! Ekip liderine e-posta ile bilgilendirme yapılacaktır.'
        },
        fields: [
          {
            fieldId: 'teamName',
            label: 'Takım Adı',
            description: 'Yarışmaya katılacağınız takımınızın adı',
            type: 'text',
            required: true,
            placeholder: 'Örn: Kod Kurtları',
            order: 1
          },
          {
            fieldId: 'leaderName',
            label: 'Takım Lideri Adı ve Soyadı',
            type: 'text',
            required: true,
            placeholder: 'Örn: Ahmet Yılmaz',
            order: 2
          },
          {
            fieldId: 'leaderEmail',
            label: 'Takım Lideri E-posta Adresi',
            type: 'email',
            required: true,
            placeholder: 'Örn: ahmet@posta.pau.edu.tr veya ahmet@gmail.com',
            order: 3
          },
          {
            fieldId: 'leaderPhone',
            label: 'Takım Lideri Telefon Numarası',
            type: 'phone',
            required: true,
            placeholder: 'Örn: +90 555 123 4567',
            order: 4
          },
          {
            fieldId: 'memberCount',
            label: 'Takım Üye Sayısı',
            description: 'Lider dahil toplam üye sayısı (1-5)',
            type: 'number',
            required: true,
            validation: { min: 1, max: 5 },
            order: 5
          },
          {
            fieldId: 'experienceLevel',
            label: 'Takımın Genel Deneyim Seviyesi',
            type: 'select',
            required: false,
            options: ['Başlangıç (Öğrenmeye açığız)', 'Orta (Daha önce proje geliştirdik)', 'İleri (Hackathon tecrübeliyiz)'],
            order: 6
          },
          {
            fieldId: 'projectIdea',
            label: 'Proje Fikriniz / Çözmek İstediğiniz Problem',
            description: 'Hackathon boyunca geliştirmeyi planladığınız fikri kısaca özetleyin.',
            type: 'textarea',
            required: true,
            placeholder: 'Projenizin temel amacı, hedef kitlesi ve teknolojileri...',
            order: 7
          },
          {
            fieldId: 'resumeFile',
            label: 'Özgeçmiş / CV veya Portfolyo Belgesi (PDF)',
            description: 'Ekip üyelerinin CV veya portfolyolarını tek bir PDF veya ZIP olarak yükleyebilirsiniz.',
            type: 'file',
            required: false,
            order: 8
          }
        ]
      });
      console.log('[Seed] Sample dynamic form created successfully.');
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
