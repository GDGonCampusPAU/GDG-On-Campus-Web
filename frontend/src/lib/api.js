// Backend ile konuşan tek nokta. Sayfalar fetch'i doğrudan çağırmaz, buradaki fonksiyonları kullanır.
// Uç noktalar backend/README.md içindeki tabloyla aynıdır.
import { API_URL, API_PREFIX } from './config.js'

export class ApiError extends Error {
  constructor(message, status = 0, data = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data // backend'in döndürdüğü tüm gövde (ör. requiresVerification)
  }
}

/**
 * @typedef {{ method?: string, body?: unknown, token?: string }} RequestOptions
 */

/** @param {string} path @param {RequestOptions} [options] */
async function send(path, { method = 'GET', body, token } = {}) {
  /** @type {Record<string, string>} */
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    return await fetch(`${API_URL}${API_PREFIX}${path}`, {
      signal: AbortSignal.timeout(15000),
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. Backend çalışıyor mu ve internet bağlantın var mı kontrol et.')
  }
}

/** @param {string} path @param {RequestOptions} [options] */
async function request(path, options) {
  const response = await send(path, options)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(data.message ?? 'Bir hata oluştu. Lütfen tekrar dene.', response.status, data)
  }
  return data
}

// --- Kimlik doğrulama ---------------------------------------------------

export function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: { email, password } })
}

// `code` verilmezse backend e-postaya 6 haneli kod gönderir ve requiresVerification döner.
// `code` ile çağrılırsa kayıt tamamlanır (hesap yönetici onayını bekler).
/** @param {{ fullName: string, email: string, password: string, code?: string }} input */
export function register({ fullName, email, password, code }) {
  return request('/auth/register', {
    method: 'POST',
    body: { fullName, email, password, ...(code ? { code } : {}) },
  })
}

/** @param {{ email: string, fullName?: string }} input */
export function sendOtp({ email, fullName }) {
  return request('/auth/send-otp', { method: 'POST', body: { email, fullName } })
}

export function verifyEmail({ email, code }) {
  return request('/auth/verify-email', { method: 'POST', body: { email, code } })
}

/**
 * @param {string} token
 * @param {number | { page?: number, role?: string } | null} [pageOrOptions]
 * @param {string} [maybeRole]
 */
export function getUsers(token, pageOrOptions = 1, maybeRole = '') {
  const options = typeof pageOrOptions === 'object' && pageOrOptions !== null ? pageOrOptions : null
  const page = options ? (options.page ?? 1) : (pageOrOptions ?? 1)
  const role = options ? (options.role ?? '') : (maybeRole ?? '')
  const params = new URLSearchParams({ page: String(page) })
  if (role && role !== 'ALL') {
    params.set('role', role)
  }
  return request(`/users?${params}`, { token })
}
export function updateUserRole(id, role, token) {
  return request(`/users/${id}/role`, { method: 'PATCH', body: { role }, token })
}

// --- Hackathon başvuruları (ORGANIZER / ADMIN) -------------------------------

/**
 * @param {{ page?: number, limit?: number, search?: string, source?: string, status?: string, team?: string }} options
 * `team`: ALL | solo | team | captain | pending (yalnız etkinlik sitesi başvuruları)
 * @param {string} token
 */
export async function getHackathonApplications({ page = 1, limit = 10, search = '', source = 'forms', status = 'ALL', team = 'ALL' }, token) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search.trim()) params.set('search', search.trim())
  if (status && status !== 'ALL') params.set('status', status)
  if (source === 'legacy') return request(`/hackathon/applications?${params}`, { token })
  if (team && team !== 'ALL') params.set('team', team)
  const pageData = await request('/event-page/hackathon')
  return request(`/forms/${pageData.data.formId}/responses?${params}`, { token })
}

export async function updateApplicationStatus({ id, formId, source = 'forms', status, note = '', notify }, token) {
  const body = { status, note, ...(typeof notify === 'boolean' ? { notify } : {}) }
  if (source === 'legacy') {
    return request(`/hackathon/applications/${encodeURIComponent(id)}/status`, { method: 'PATCH', body, token })
  }
  const resolvedFormId = formId || (await request('/event-page/hackathon')).data.formId
  return request(`/forms/${encodeURIComponent(resolvedFormId)}/responses/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body,
    token,
  })
}

// CSV dosyasını Authorization başlığı gerektiği için fetch ile indirip Blob olarak döndürür.
/**
 * @param {string} token
 * @param {{ source?: string, search?: string, status?: string, team?: string }} [options]
 */
export async function downloadHackathonApplicationsCsv(token, { source = 'forms', search = '', status = 'ALL', team = 'ALL' } = {}) {
  let path = `/hackathon/applications/export?format=csv${search ? `&search=${encodeURIComponent(search)}` : ''}`
  if (source !== 'legacy') {
    const page = await request('/event-page/hackathon')
    path = `/forms/${page.data.formId}/responses/export?format=csv&search=${encodeURIComponent(search)}`
  }
  if (status && status !== 'ALL') {
    path = `${path}&status=${encodeURIComponent(status)}`
  }
  if (source !== 'legacy' && team && team !== 'ALL') path = `${path}&team=${encodeURIComponent(team)}`
  const response = await send(path, { token })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(data.message ?? 'CSV dosyası indirilemedi.', response.status, data)
  }
  return response.blob()
}

export async function downloadPrivateFile(url, token) {
  let base
  let target
  try {
    if (typeof url !== 'string' || !url.trim()) {
      throw new ApiError('Dosya adresi geçersiz.')
    }
    const origin = API_URL || (typeof window !== 'undefined' ? window.location?.origin : 'http://localhost:5000')
    base = new URL(origin)
    target = new URL(url, base)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('Dosya adresi geçersiz.')
  }
  if (target.origin !== base.origin || !/^\/(?:api\/v1\/files|uploads)\/[a-zA-Z0-9._-]+$/.test(target.pathname)) {
    throw new ApiError('Dosya adresi geçersiz.')
  }
  const response = await fetch(target.href, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new ApiError('Dosya indirilemedi.', response.status)
  return response.blob()
}

// --- Kayıt takımları (ORGANIZER / ADMIN) --------------------------------------
// Her işlem güncel takım listesini döndürür: [{ id, name, code, size, maxSize, members, requests, allApproved }]

const teamsPath = async () => `/forms/${encodeURIComponent((await request('/event-page/hackathon')).data.formId)}/teams`

/** @param {string} token */
export async function getTeams(token) {
  return (await request(await teamsPath(), { token })).data
}

/** Onaylı üyeyi çıkarır veya bekleyen katılma isteğini siler. */
export async function removeTeamMember(teamId, participantId, token) {
  const path = `${await teamsPath()}/${encodeURIComponent(teamId)}/members/${encodeURIComponent(participantId)}/remove`
  return (await request(path, { method: 'POST', token })).data
}

export async function setTeamCaptain(teamId, participantId, token) {
  return (await request(`${await teamsPath()}/${encodeURIComponent(teamId)}/captain`, { method: 'POST', body: { participantId }, token })).data
}

export async function disbandTeam(teamId, token) {
  return (await request(`${await teamsPath()}/${encodeURIComponent(teamId)}`, { method: 'DELETE', token })).data
}

// --- Bakım modu (yalnızca ADMIN) -------------------------------------------------
// { active, since, by: { id, name } | null, server: 'running' | 'stopped' | 'external' }

/** @param {string} token */
export async function getMaintenance(token) {
  return (await request('/maintenance', { token })).data
}

/** @param {boolean} active @param {string} token */
export async function setMaintenance(active, token) {
  return (await request('/maintenance', { method: 'PUT', body: { active }, token })).data
}
