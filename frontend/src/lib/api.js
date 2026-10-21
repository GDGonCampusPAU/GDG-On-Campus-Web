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

async function send(path, { method = 'GET', body, token } = {}) {
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
export function register({ fullName, email, password, code }) {
  return request('/auth/register', {
    method: 'POST',
    body: { fullName, email, password, ...(code ? { code } : {}) },
  })
}

export function sendOtp({ email, fullName }) {
  return request('/auth/send-otp', { method: 'POST', body: { email, fullName } })
}

export function verifyEmail({ email, code }) {
  return request('/auth/verify-email', { method: 'POST', body: { email, code } })
}

export function getUsers(token, page = 1) {
  return request(`/users?page=${page}`, { token })
}
export function updateUserRole(id, role, token) {
  return request(`/users/${id}/role`, { method: 'PATCH', body: { role }, token })
}

// --- Hackathon başvuruları (ORGANIZER / ADMIN) -------------------------------

export async function getHackathonApplications({ page = 1, limit = 10, search = '', source = 'forms' }, token) {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (search.trim()) params.set('search', search.trim())
  if (source === 'legacy') return request(`/hackathon/applications?${params}`, { token })
  const pageData = await request('/event-page/hackathon')
  return request(`/forms/${pageData.data.formId}/responses?${params}`, { token })
}

// CSV dosyasını Authorization başlığı gerektiği için fetch ile indirip Blob olarak döndürür.
export async function downloadHackathonApplicationsCsv(token, { source = 'forms', search = '' } = {}) {
  let path = '/hackathon/applications/export?format=csv'
  if (source !== 'legacy') {
    const page = await request('/event-page/hackathon')
    path = `/forms/${page.data.formId}/responses/export?format=csv&search=${encodeURIComponent(search)}`
  }
  const response = await send(path, { token })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(data.message ?? 'CSV dosyası indirilemedi.', response.status, data)
  }
  return response.blob()
}

export async function downloadPrivateFile(url, token) {
  const base = new URL(API_URL || window.location.origin)
  const target = new URL(url, base)
  if (target.origin !== base.origin || !/^\/(?:api\/v1\/files|uploads)\/[a-zA-Z0-9._-]+$/.test(target.pathname)) throw new ApiError('Dosya adresi geçersiz.')
  const response = await fetch(target.href, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new ApiError('Dosya indirilemedi.', response.status)
  return response.blob()
}
