// Kayıt akışının cihazda tuttuğu kısa ömürlü veriler:
// - Form taslağı: e-posta başına 1 saat; aynı e-postayla dönen katılımcının formu önceden dolar.
// - E-posta doğrulaması: 30 dakika; aynı e-postayla tekrar "Kod gönder" denince OTP istenmez.
// localStorage erişimi gizli pencere vb. durumlarda hata verebilir; her erişim sessizce yutulur.

export const DRAFT_TTL_MS = 60 * 60 * 1000
export const IDENTITY_TTL_MS = 30 * 60 * 1000
const DRAFT_PREFIX = 'hackaton:register-draft:'
const IDENTITY_KEY = 'hackaton:register-identity'
// Token bu süreden az ömrü kaldıysa yeniden kullanılmaz; gönderim yarıda 401 almasın.
const TOKEN_MARGIN_MS = 5 * 60 * 1000

const normEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '')
const isFile = (v) => (typeof Blob !== 'undefined' && v instanceof Blob)

function read(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function write(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)) } catch { /* depolama kapalı/dolu */ }
}
function remove(key) {
  try { window.localStorage.removeItem(key) } catch { /* depolama kapalı */ }
}

/** Dosyalar saklanamaz, e-posta zaten doğrulanan adresten gelir. */
export function saveDraft(email, values, now = Date.now()) {
  const key = normEmail(email)
  if (!key) return
  const kept = Object.fromEntries(Object.entries(values ?? {}).filter(([k, v]) => k !== 'email' && !isFile(v)))
  write(DRAFT_PREFIX + key, { savedAt: now, values: kept })
}

export function loadDraft(email, now = Date.now()) {
  const key = DRAFT_PREFIX + normEmail(email)
  const entry = read(key)
  if (!entry || typeof entry.savedAt !== 'number' || now - entry.savedAt > DRAFT_TTL_MS || !entry.values) {
    if (entry) remove(key)
    return null
  }
  return entry.values
}

export const clearDraft = (email) => remove(DRAFT_PREFIX + normEmail(email))

/** Süresi geçmiş taslakları temizler (başka e-postalarınkiler dahil). */
export function pruneDrafts(now = Date.now()) {
  try {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(DRAFT_PREFIX))
    for (const k of keys) loadDraft(k.slice(DRAFT_PREFIX.length), now)
  } catch { /* depolama kapalı */ }
}

export function saveIdentity(identity, now = Date.now()) {
  if (!identity?.token || !normEmail(identity.participant?.email)) return
  write(IDENTITY_KEY, { savedAt: now, identity })
}

/** Aynı e-posta için 30 dk içinde ve token'ı hâlâ geçerli olan doğrulamayı döndürür. */
export function loadIdentity(email, now = Date.now()) {
  const entry = read(IDENTITY_KEY)
  if (!entry) return null
  const identity = entry.identity
  const expiresAt = Date.parse(identity?.expiresAt ?? '')
  const stale = typeof entry.savedAt !== 'number' || now - entry.savedAt > IDENTITY_TTL_MS
    || (!Number.isNaN(expiresAt) && expiresAt - now < TOKEN_MARGIN_MS) || !identity?.token
  if (stale) {
    remove(IDENTITY_KEY)
    return null
  }
  return normEmail(identity.participant?.email) === normEmail(email) ? identity : null
}

export const clearIdentity = () => remove(IDENTITY_KEY)
