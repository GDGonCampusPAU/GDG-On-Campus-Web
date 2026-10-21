export const DRAFT_KEY = 'hackathon-event-draft'

export const typeLabels = {
  opening: 'Açılış',
  workshop: 'Workshop',
  coding: 'Kodlama',
  submission: 'Teslim',
  jury: 'Jüri',
  awards: 'Ödül',
}
// Anahtar adına göre izin verilen değerler; hem editör seçenekleri hem taslak doğrulaması bunu kullanır.
export const choices = {
  color: ['blue', 'green', 'yellow', 'red'],
  tier: ['main', 'support'],
  type: Object.keys(typeLabels),
  status: ['open', 'closed'],
  kind: ['text', 'textarea', 'email', 'tel', 'select', 'checkbox'],
  required: ['yes', 'no'],
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
// Bu alanlar null olabilir; sosyal bağlantının url'si ise her zaman metindir.
const nullable = new Set(['photo', 'logo', 'url'])
// Bu alanlar href/src olur; boş, site içi yol veya http(s) dışındaki şemalar (javascript:, data:) reddedilir.
const urlLike = new Set(['photo', 'logo', 'url'])
const safeUrl = (s) => s === '' || s.startsWith('/') || /^https?:/i.test(s)

// base'in şeklini özyinelemeli karşılaştırır. Dizi öğeleri base'in ilk öğesine benzemeli.
// path: kökten bu değere anahtarlar; dizi dizinleri yoktur.
function matches(base, v, path = []) {
  const key = path.at(-1)
  if (typeof base === 'string' || base === null) {
    if (v === null) return nullable.has(key) && path[0] !== 'socials'
    if (typeof v !== 'string') return false
    if (choices[key] && !choices[key].includes(v)) return false
    return !urlLike.has(key) || safeUrl(v)
  }
  if (Array.isArray(base)) return Array.isArray(v) && (!base.length || v.every((it) => matches(base[0], it, path)))
  if (isObject(base)) {
    const keys = Object.keys(base)
    return isObject(v) && Object.keys(v).length === keys.length && keys.every((k) => k in v && matches(base[k], v[k], [...path, k]))
  }
  return typeof v === typeof base
}

// Şekil tutsa bile form çalışmaz: alan adları boş/yinelenen olamaz, seçeneklerin değeri dolu ve benzersiz olmalı.
function formUsable(steps) {
  const fields = steps.flatMap((s) => s.fields)
  const ids = fields.map((f) => f.id)
  // Boş options şablonu öğeleri doğrulatmaz; bu yüzden öğenin şekli de burada denetlenir.
  const optionsOk = (f) => {
    const values = f.options.map((o) => o?.value)
    const needsOptions = f.kind === 'select' || f.kind === 'checkbox'
    return (!needsOptions || values.length > 0) && values.every(Boolean) && new Set(values).size === values.length && f.options.every((o) => typeof o.label === 'string')
  }
  return ids.length > 0 && ids.every(Boolean) && new Set(ids).size === ids.length && fields.every(optionsOk)
}

export const isEventShape = (base, value) =>
  matches(base, value) && !Number.isNaN(Date.parse(value.startsAt)) && (!value.register?.steps || formUsable(value.register.steps))

const store = (s) => s ?? window.localStorage

// Taslak, yazıldığı andaki base ile saklanır; base sonradan değiştiyse (yeni event.json yayınlandı) taslak eskidir.
// Depolama erişimi bile atabilir (gizli pencere, engelli site verisi); hepsi try içinde.
export function readDraft(base, storage) {
  try {
    const draft = JSON.parse(store(storage).getItem(DRAFT_KEY))
    const fresh = isObject(draft) && JSON.stringify(draft.base) === JSON.stringify(base)
    return fresh && isEventShape(base, draft.value) ? draft.value : null
  } catch {
    return null
  }
}

export const applyDraft = (base, storage) => readDraft(base, storage) ?? base

export function writeDraft(base, value, storage) {
  try {
    store(storage).setItem(DRAFT_KEY, JSON.stringify({ base, value }))
    return true
  } catch {
    return false
  }
}

export function clearDraft(storage) {
  try {
    store(storage).removeItem(DRAFT_KEY)
  } catch {
    // Silinemediyse yapacak bir şey yok; bir sonraki okuma yine doğrular.
  }
}
