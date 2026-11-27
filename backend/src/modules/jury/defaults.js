// Seed values for a new JudgingConfig. After that, the admin screen is the source of truth.
const DEFAULT_CRITERIA = [
  { key: 'technical', label: 'Teknik Uygulama ve İşlevsellik', weight: 25, description: 'Projenin teknik açıdan uygulanabilirliği, temel işlevlerinin çalışır durumda olması ve geliştirilen çözümün teknik yeterliliği.' },
  { key: 'originality', label: 'Özgünlük ve Yaratıcılık', weight: 15, description: 'Fikrin yenilikçi yaklaşımı, özgünlüğü ve probleme yönelik geliştirdiği yaratıcı çözüm.' },
  { key: 'problemFit', label: 'Problem Analizi ve Tema ile Uyum', weight: 15, description: 'Problemin doğru tanımlanması, ihtiyaçların anlaşılması ve çözümün hackathon temasıyla ilişkisi.' },
  { key: 'demo', label: 'Demo ve Sunum Performansı', weight: 15, description: 'Projenin açık, anlaşılır ve etkili aktarılması; prototipin işleyişinin gösterilmesi ve sunumun bütünlüğü.' },
  { key: 'aiMastery', label: 'Yapay Zekâ Kullanımı ve Teknik Yetkinlik', weight: 10, description: 'Yapay zekânın projeye katkısı, amaca uygun kullanımı ve takımın çözümün teknik yapısını açıklayabilmesi.' },
  { key: 'ux', label: 'Kullanıcı Deneyimi ve Arayüz Tasarımı', weight: 10, description: 'Arayüzün kullanılabilirliği, erişilebilirliği, tasarım tutarlılığı ve kullanıcı ihtiyaçlarını karşılama düzeyi.' },
  { key: 'impact', label: 'Gerçek Dünya Uygulanabilirliği ve Etkisi', weight: 10, description: 'Gerçek kullanım senaryolarına uyarlanabilirlik, potansiyel kullanıcı kitlesi ve oluşturabileceği fayda.' }
];

const DEFAULT_CATEGORIES = [
  { key: 'campusHero', name: 'Kampüsün Kahramanı', icon: '🛡️', criterionKeys: ['problemFit', 'impact'], priority: 1, active: true },
  { key: 'wow', name: 'Vay Be', icon: '🚀', criterionKeys: ['originality'], priority: 2, active: true },
  { key: 'demoGod', name: 'Demo Tanrısı', icon: '🎤', criterionKeys: ['demo'], priority: 3, active: true },
  { key: 'pilot', name: 'Pilotun Kendisi', icon: '🧑‍✈️', criterionKeys: ['aiMastery'], priority: 4, active: true },
  { key: 'dreamTeam', name: 'Dream Team', icon: '⚙️', criterionKeys: [], priority: 5, active: true }
];

module.exports = { DEFAULT_CRITERIA, DEFAULT_CATEGORIES };
