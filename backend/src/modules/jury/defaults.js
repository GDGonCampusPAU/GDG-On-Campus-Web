// Seed values for a new JudgingConfig. After that, the admin screen is the source of truth.
const DEFAULT_CRITERIA = [
  { key: 'technical', label: 'Teknik uygulama ve çalışırlık', weight: 25, description: 'Teknik zorluk, mimari, 12 saatte ne kadarı çalışır halde' },
  { key: 'originality', label: 'Fikir özgünlüğü ve yaratıcılık', weight: 15, description: 'Benzerini gördünüz mü? Yeni bir bakış açısı var mı?' },
  { key: 'problemFit', label: 'Problem ve temaya uygunluk', weight: 15, description: 'Gerçek bir problem mi, tema ile örtüşüyor mu?' },
  { key: 'demo', label: 'Demo ve sunum', weight: 15, description: 'Canlı demo sorunsuz mu, anlatım net mi, süreye uyuldu mu?' },
  { key: 'aiMastery', label: 'AI kullanımı ve kodu açıklayabilme', weight: 10, description: 'AI bilinçli mi kullanılmış? Takım kodunu açıklayabiliyor mu?' },
  { key: 'ux', label: 'Kullanıcı deneyimi ve arayüz', weight: 10, description: 'Arayüz kalitesi, kullanım kolaylığı' },
  { key: 'impact', label: 'Gerçek dünyada uygulanabilirlik', weight: 10, description: 'Hayata geçebilir mi, kime ne fayda sağlar?' }
];

const DEFAULT_CATEGORIES = [
  { key: 'campusHero', name: 'Kampüsün Kahramanı', icon: '🛡️', criterionKeys: ['problemFit', 'impact'], priority: 1, active: true },
  { key: 'wow', name: 'Vay Be', icon: '🚀', criterionKeys: ['originality'], priority: 2, active: true },
  { key: 'demoGod', name: 'Demo Tanrısı', icon: '🎤', criterionKeys: ['demo'], priority: 3, active: true },
  { key: 'pilot', name: 'Pilotun Kendisi', icon: '🧑‍✈️', criterionKeys: ['aiMastery'], priority: 4, active: true },
  { key: 'dreamTeam', name: 'Dream Team', icon: '⚙️', criterionKeys: [], priority: 5, active: true }
];

module.exports = { DEFAULT_CRITERIA, DEFAULT_CATEGORIES };
