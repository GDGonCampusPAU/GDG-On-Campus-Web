// Form, event.json içindeki register.steps verisinden çizilir. Alan şekli:
// { id, label, kind: text|textarea|email|tel|select|checkbox, required: yes|no, hint, options: [{ value, label }] }
export const fieldsOf = (steps) => steps.flatMap((s) => s.fields)

const collapse = (s) => s.trim().replace(/\s+/g, ' ')
const isChecklist = (f) => f.kind === 'checkbox'

export const initialValues = (steps) =>
  Object.fromEntries(fieldsOf(steps).map((f) => [f.id, isChecklist(f) ? [] : '']))

function clean(f, v) {
  if (isChecklist(f)) return [...v]
  if (f.kind === 'email') return v.trim().toLowerCase()
  if (f.kind === 'tel') return v.replace(/[\s().-]/g, '')
  return f.kind === 'textarea' ? v.trim() : collapse(v)
}

export const normalize = (steps, values) =>
  Object.fromEntries(fieldsOf(steps).map((f) => [f.id, clean(f, values[f.id])]))

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?\d{10,14}$/

const known = (f, v) => f.options.some((o) => o.value === v)

function fieldError(f, v) {
  const required = f.required === 'yes'
  if (isChecklist(f)) {
    if (required && v.length === 0) return 'En az bir seçenek seç.'
    return v.every((x) => known(f, x)) ? '' : 'Listedeki seçeneklerden seç.'
  }
  if (v === '') return required ? (f.kind === 'select' ? 'Bir seçenek seç.' : 'Bu alanı doldur.') : ''
  if (f.kind === 'email' && !EMAIL_RE.test(v)) return 'Geçerli bir e-posta adresi yaz.'
  if (f.kind === 'tel' && !PHONE_RE.test(v)) return 'Geçerli bir telefon numarası yaz.'
  if (f.kind === 'select' && !known(f, v)) return 'Listedeki seçeneklerden seç.'
  return ''
}

export function validateStep(step, values) {
  const v = normalize([step], values)
  const errors = {}
  for (const f of step.fields) {
    const msg = fieldError(f, v[f.id])
    if (msg) errors[f.id] = msg
  }
  return errors
}

export async function submitRegistration(
  values,
  { endpoint, token, formVersion, fetchImpl = (...args) => fetch(...args) } = {},
) {
  if (!endpoint) {
    // Yayında adres yoksa kayıt hiçbir yere gitmez; başarı göstermek sessiz veri kaybı olur.
    return { ok: false, error: 'Kayıt şu an alınamıyor. Biraz sonra tekrar dene.' }
  }
  if (!token) return { ok: false, status: 401, error: 'Başvurmadan önce e-postanı doğrula.' }

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...values, ...(formVersion ? { _formVersion: formVersion } : {}) }),
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, status: res.status, error: data.message || `Sunucu hatası (${res.status}). Biraz sonra tekrar dene.` }
    if (!data.success || !data.responseId) return { ok: false, error: 'Sunucu kayıt onayı vermedi. Lütfen tekrar deneyin.' }
    return { ok: true, responseId: data.responseId }
  } catch {
    return { ok: false, error: 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.' }
  }
}
