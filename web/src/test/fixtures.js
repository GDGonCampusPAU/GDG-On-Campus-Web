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

// Kayıt formu testleri organizatörün düzenleyebildiği event.json'a bağlanmasın diye form buradan kurulur.
export const fixtureSteps = [
  {
    "title": "Kişisel bilgiler",
    "fields": [
      {
        "id": "fullName",
        "label": "Ad soyad",
        "kind": "text",
        "required": "yes",
        "hint": "",
        "options": []
      },
      {
        "id": "email",
        "label": "E-posta",
        "kind": "email",
        "required": "yes",
        "hint": "",
        "options": []
      },
      {
        "id": "phone",
        "label": "Telefon",
        "kind": "tel",
        "required": "yes",
        "hint": "",
        "options": []
      },
      {
        "id": "department",
        "label": "Bölüm",
        "kind": "text",
        "required": "yes",
        "hint": "",
        "options": []
      },
      {
        "id": "year",
        "label": "Sınıf",
        "kind": "select",
        "required": "yes",
        "hint": "",
        "options": [
          {
            "value": "prep",
            "label": "Hazırlık"
          },
          {
            "value": "1",
            "label": "1. sınıf"
          },
          {
            "value": "2",
            "label": "2. sınıf"
          },
          {
            "value": "3",
            "label": "3. sınıf"
          },
          {
            "value": "4",
            "label": "4. sınıf"
          },
          {
            "value": "grad",
            "label": "Yüksek lisans / Doktora"
          }
        ]
      }
    ]
  },
  {
    "title": "Takım",
    "fields": [
      {
        "id": "teamName",
        "label": "Takım adı",
        "kind": "text",
        "required": "no",
        "hint": "Takım arıyorsan boş bırakabilirsin.",
        "options": []
      },
      {
        "id": "teamRole",
        "label": "Rol",
        "kind": "select",
        "required": "yes",
        "hint": "",
        "options": [
          {
            "value": "founder",
            "label": "Takım kurucusuyum"
          },
          {
            "value": "member",
            "label": "Bir takımın üyesiyim"
          },
          {
            "value": "looking",
            "label": "Takım arıyorum"
          }
        ]
      },
      {
        "id": "teammates",
        "label": "Takım arkadaşları",
        "kind": "text",
        "required": "no",
        "hint": "İsimleri virgülle ayırarak yazabilirsin.",
        "options": []
      }
    ]
  },
  {
    "title": "İlgi alanları",
    "fields": [
      {
        "id": "interests",
        "label": "İlgi alanların",
        "kind": "checkbox",
        "required": "yes",
        "hint": "",
        "options": [
          {
            "value": "web",
            "label": "Web"
          },
          {
            "value": "mobile",
            "label": "Mobil"
          },
          {
            "value": "ai",
            "label": "Yapay Zeka"
          },
          {
            "value": "game",
            "label": "Oyun"
          },
          {
            "value": "cloud",
            "label": "Bulut"
          }
        ]
      },
      {
        "id": "level",
        "label": "Deneyim seviyesi",
        "kind": "select",
        "required": "yes",
        "hint": "",
        "options": [
          {
            "value": "beginner",
            "label": "Yeni başlıyorum"
          },
          {
            "value": "intermediate",
            "label": "Orta seviye"
          },
          {
            "value": "advanced",
            "label": "İleri seviye"
          }
        ]
      }
    ]
  }
]
