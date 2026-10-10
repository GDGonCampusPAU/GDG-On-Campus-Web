// Tüm değerler PLACEHOLDER'dır. Gerçek bilgiler gelince yalnızca bu dosya güncellenir.

export const typeLabels = {
  opening: 'Açılış',
  workshop: 'Workshop',
  coding: 'Kodlama',
  submission: 'Teslim',
  jury: 'Jüri',
  awards: 'Ödül',
}

export const event = {
  organizer: 'GDG On Campus PAU',
  name: 'PAU Hackathon 2026',
  tagline: 'Fikrini bir hafta sonunda çalışan bir ürüne dönüştür.',
  theme: 'Kampüs için Yapay Zeka',
  startsAt: '2026-12-12T09:00:00+03:00',
  location: 'Konum yakında açıklanacak',

  about: [
    { title: 'Ne?', text: 'Takımlar halinde 2 gün boyunca bir fikri prototipe dönüştürdüğümüz hackathon.', color: 'blue' },
    { title: 'Kim için?', text: 'Bölümü ve seviyesi fark etmez; kod yazan, tasarlayan ve fikri olan herkes.', color: 'green' },
    { title: 'Neden?', text: 'Mentorlardan geri bildirim, ödüller ve yeni bir takım arkadaşı kazanırsın.', color: 'yellow' },
  ],

  marquee: ['Kodla', 'Tasarla', 'Paylaş', 'Yapay Zeka', 'Takım Kur', 'Prototiple', 'GDG On Campus PAU'],

  prizes: [
    { place: '1.', title: 'Birincilik', description: 'Ödül detayları yakında açıklanacak.', color: 'yellow' },
    { place: '2.', title: 'İkincilik', description: 'Ödül detayları yakında açıklanacak.', color: 'blue' },
    { place: '3.', title: 'Üçüncülük', description: 'Ödül detayları yakında açıklanacak.', color: 'green' },
  ],

  days: [
    {
      label: '1. Gün',
      date: '12 Aralık 2026',
      items: [
        { time: '09:00', title: 'Açılış ve tanışma', description: 'Etkinliğin tanıtımı, kurallar ve takım eşleşmeleri.', type: 'opening' },
        { time: '10:30', title: 'Yapay Zeka workshop', description: 'Başlangıç seviyesinde uygulamalı oturum.', type: 'workshop' },
        { time: '13:00', title: 'Kodlama başlıyor', description: 'Takımlar projelerine başlar, mentorlar sahada.', type: 'coding' },
      ],
    },
    {
      label: '2. Gün',
      date: '13 Aralık 2026',
      items: [
        { time: '12:00', title: 'Proje teslimi', description: 'Son commit ve sunum dosyalarının yüklenmesi.', type: 'submission' },
        { time: '14:00', title: 'Jüri sunumları', description: 'Her takım 5 dakikada projesini anlatır.', type: 'jury' },
        { time: '17:00', title: 'Ödül töreni', description: 'Sonuçların açıklanması ve kapanış.', type: 'awards' },
      ],
    },
  ],

  people: {
    jury: [
      { name: 'Jüri Üyesi Bir', title: 'Unvan yakında', photo: null },
      { name: 'Jüri Üyesi İki', title: 'Unvan yakında', photo: null },
      { name: 'Jüri Üyesi Üç', title: 'Unvan yakında', photo: null },
    ],
    mentors: [
      { name: 'Mentor Bir', title: 'Unvan yakında', photo: null },
      { name: 'Mentor İki', title: 'Unvan yakında', photo: null },
    ],
  },

  sponsors: [
    { name: 'Ana Sponsor', tier: 'main', logo: null, url: null },
    { name: 'Destek Sponsor 1', tier: 'support', logo: null, url: null },
    { name: 'Destek Sponsor 2', tier: 'support', logo: null, url: null },
  ],

  socials: [
    { label: 'Instagram', url: 'https://www.instagram.com/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
    { label: 'X', url: 'https://x.com/' },
  ],
}
