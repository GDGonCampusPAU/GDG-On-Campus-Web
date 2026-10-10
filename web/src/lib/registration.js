export const STEPS = [
  { id: 'person', title: 'Kişisel bilgiler' },
  { id: 'team', title: 'Takım' },
  { id: 'interest', title: 'İlgi alanları' },
  { id: 'confirm', title: 'Onay' },
]

export const YEAR_OPTIONS = [
  { value: 'prep', label: 'Hazırlık' },
  { value: '1', label: '1. sınıf' },
  { value: '2', label: '2. sınıf' },
  { value: '3', label: '3. sınıf' },
  { value: '4', label: '4. sınıf' },
  { value: 'grad', label: 'Yüksek lisans / Doktora' },
]

export const ROLE_OPTIONS = [
  { value: 'founder', label: 'Takım kurucusuyum' },
  { value: 'member', label: 'Bir takımın üyesiyim' },
  { value: 'looking', label: 'Takım arıyorum' },
]

export const INTEREST_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'mobile', label: 'Mobil' },
  { value: 'ai', label: 'Yapay Zeka' },
  { value: 'game', label: 'Oyun' },
  { value: 'cloud', label: 'Bulut' },
]

export const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Yeni başlıyorum' },
  { value: 'intermediate', label: 'Orta seviye' },
  { value: 'advanced', label: 'İleri seviye' },
]

export const initialValues = {
  fullName: '',
  email: '',
  phone: '',
  department: '',
  year: '',
  teamName: '',
  teamRole: '',
  teammates: '',
  interests: [],
  level: '',
  consent: false,
}

const collapse = (s) => s.trim().replace(/\s+/g, ' ')

export function normalize(values) {
  return {
    ...values,
    fullName: collapse(values.fullName),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.replace(/[\s().-]/g, ''),
    department: collapse(values.department),
    teamName: collapse(values.teamName),
    teammates: values.teammates.trim(),
    interests: [...values.interests],
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{10,14}$/

const has = (options, value) => options.some((o) => o.value === value)

export function validateStep(stepId, values) {
  const v = normalize(values)
  const errors = {}

  if (stepId === 'person') {
    if (v.fullName.split(' ').filter(Boolean).length < 2) errors.fullName = 'Ad ve soyadını yaz.'
    if (!EMAIL_RE.test(v.email)) errors.email = 'Geçerli bir e-posta adresi yaz.'
    if (!PHONE_RE.test(v.phone)) errors.phone = 'Geçerli bir telefon numarası yaz.'
    if (v.department.length < 2) errors.department = 'Bölümünü yaz.'
    if (!has(YEAR_OPTIONS, v.year)) errors.year = 'Sınıfını seç.'
  }

  if (stepId === 'team') {
    if (v.teamRole !== 'looking' && v.teamName.length < 2) errors.teamName = 'Takım adını yaz.'
    if (!has(ROLE_OPTIONS, v.teamRole)) errors.teamRole = 'Rolünü seç.'
  }

  if (stepId === 'interest') {
    if (v.interests.length === 0) errors.interests = 'En az bir ilgi alanı seç.'
    if (!has(LEVEL_OPTIONS, v.level)) errors.level = 'Deneyim seviyeni seç.'
  }

  if (stepId === 'confirm') {
    if (v.consent !== true) errors.consent = 'Devam etmek için onay vermelisin.'
  }

  return errors
}

export async function submitRegistration(values, { endpoint, fetchImpl = (...args) => fetch(...args) } = {}) {
  if (!endpoint) return { ok: true, skipped: true }

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(normalize(values)),
    })
    if (!res.ok) return { ok: false, error: `Sunucu hatası (${res.status}). Biraz sonra tekrar dene.` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.' }
  }
}
