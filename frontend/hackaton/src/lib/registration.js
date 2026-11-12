// Form, event.json içindeki register.steps verisinden çizilir. Alan şekli:
// { id, label, kind: text|textarea|email|tel|select|checkbox|file|number|radio|date, required: yes|no, hint, options: [{ value, label }] }
export const fieldsOf = (steps) => steps.flatMap((s) => s.fields)

const collapse = (s) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : s)
const isChecklist = (f) => f.kind === 'checkbox'
/** @param {unknown} v @returns {v is File} */
const isFile = (v) =>
  (typeof File !== 'undefined' && v instanceof File) ||
  (typeof Blob !== 'undefined' && v instanceof Blob)

export const initialValues = (steps) =>
  Object.fromEntries(fieldsOf(steps).map((f) => [f.id, isChecklist(f) ? [] : f.kind === 'file' ? null : '']))

function clean(f, v) {
  if (isChecklist(f)) return Array.isArray(v) ? [...v] : []
  if (f.kind === 'file') return v
  if (typeof v !== 'string') return v ?? ''
  if (f.kind === 'email') return v.trim().toLowerCase()
  if (f.kind === 'tel') return v.replace(/[\s().-]/g, '')
  if (f.kind === 'number') return v.trim()
  if (f.kind === 'date') return v.trim()
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
    if (required && (!Array.isArray(v) || v.length === 0)) return 'En az bir seçenek seç.'
    return Array.isArray(v) && v.every((x) => known(f, x)) ? '' : 'Listedeki seçeneklerden seç.'
  }
  if (f.kind === 'file') {
    if (required && !v) return 'Bir dosya seç.'
    return ''
  }
  if (v === '' || v == null) return required ? (['select', 'radio'].includes(f.kind) ? 'Bir seçenek seç.' : 'Bu alanı doldur.') : ''
  if (f.kind === 'email' && !EMAIL_RE.test(v)) return 'Geçerli bir e-posta adresi yaz.'
  if (f.kind === 'tel' && !PHONE_RE.test(v)) return 'Geçerli bir telefon numarası yaz.'
  if (['select', 'radio'].includes(f.kind) && !known(f, v)) return 'Listedeki seçeneklerden seç.'
  if (f.kind === 'number' && Number.isNaN(Number(v))) return 'Geçerli bir sayı gir.'
  if (f.kind === 'date' && (Number.isNaN(Date.parse(v)) || !/^\d{4}-\d{2}-\d{2}$/.test(v))) return 'Geçerli bir tarih seç.'
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

/**
 * @param {Record<string, unknown>} values
 * @param {{ endpoint?: string, token?: string, formVersion?: string, fetchImpl?: typeof fetch }} [options]
 */
export async function submitRegistration(
  values,
  { endpoint, token, formVersion, fetchImpl = (input, init) => fetch(input, init) } = {},
) {
  if (!endpoint) {
    // Yayında adres yoksa kayıt hiçbir yere gitmez; başarı göstermek sessiz veri kaybı olur.
    return { ok: false, error: 'Kayıt şu an alınamıyor. Biraz sonra tekrar dene.' }
  }
  if (!token) return { ok: false, status: 401, error: 'Başvurmadan önce e-postanı doğrula.' }

  const hasFiles = Object.values(values).some(isFile)
  let body
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }

  if (hasFiles) {
    const formData = new FormData()
    const nonFileAnswers = {}
    for (const [k, v] of Object.entries(values)) {
      if (isFile(v)) {
        formData.append(k, v)
      } else {
        nonFileAnswers[k] = v
      }
    }
    formData.append('answers', JSON.stringify(nonFileAnswers))
    if (formVersion) formData.append('_formVersion', formVersion)
    body = formData
  } else {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify({ ...values, ...(formVersion ? { _formVersion: formVersion } : {}) })
  }

  try {
    const res = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body,
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
