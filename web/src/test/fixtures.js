// Testler organizatörlerin değiştirebildiği event.json metnine bağlanmasın diye
// yapı gerektiren durumlar (2 gün, workshop, sponsor katmanları) buradan kurulur.
export const fixtureEvent = {
  organizer: 'Test Topluluğu',
  name: 'Test Hackathon',
  days: [
    {
      label: 'Birinci',
      date: '1 Ocak',
      items: [
        { time: '09:00', title: 'Açılış testi', description: 'açıklama bir', type: 'opening' },
        { time: '10:00', title: 'Atölye testi', description: 'açıklama iki', type: 'workshop' },
      ],
    },
    {
      label: 'İkinci',
      date: '2 Ocak',
      items: [{ time: '12:00', title: 'Ödül testi', description: 'açıklama üç', type: 'awards' }],
    },
  ],
  people: {
    jury: [{ name: 'Jüri Test', title: 'Unvan', photo: null }],
    mentors: [{ name: 'Mentor Test', title: 'Unvan', photo: null }],
  },
  sponsors: [
    { name: 'Destek Test', tier: 'support', logo: null, url: null },
    { name: 'Ana Test', tier: 'main', logo: null, url: null },
  ],
  socials: [
    { label: 'Sosyal Bir', url: 'https://example.com/bir' },
    { label: 'Sosyal İki', url: 'https://example.com/iki' },
  ],
}
