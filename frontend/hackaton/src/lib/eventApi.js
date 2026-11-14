export const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '')
/**
 * @param {string} path
 * @param {{ token?: string, body?: unknown, method?: string }} [options]
 */
export async function api(path, { token, body, method = 'GET' } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method, signal: AbortSignal.timeout(15000),
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  } catch { throw new Error('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.') }
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.message || `Sunucu hatası (${response.status})`), { status: response.status })
  return data
}
/**
 * Doğrulanmış katılımcının bu forma daha önce başvurup başvurmadığını döndürür.
 * @param {string} slug @param {string} token
 * @returns {Promise<{ submitted: boolean, status?: 'PENDING' | 'APPROVED' | 'REJECTED', submittedAt?: string }>}
 */
export const getMySubmission = (slug, token) =>
  api(`/forms/public/${encodeURIComponent(slug)}/my-submission`, { token }).then(result => result.data ?? { submitted: false })
/**
 * Takım kodunun önizlemesi (ad ve kişi sayısı). Kod yoksa 404 (error.status) fırlatır.
 * @param {string} slug @param {string} code @param {string} token
 * @returns {Promise<{ name: string, size: number, maxSize: number, full: boolean }>}
 */
export const lookupTeam = (slug, code, token) =>
  api(`/forms/public/${encodeURIComponent(slug)}/teams/${encodeURIComponent(code)}`, { token }).then(result => result.data)
/**
 * "Başvurum" sayfasının işlemleri. Her çağrı güncel başvuru görünümünü döndürür:
 * { status, statusNote, submittedAt, email, answers, team }
 * @param {string} slug @param {string} token
 */
export function applicationApi(slug, token) {
  const base = `/forms/public/${encodeURIComponent(slug)}/my-application`
  const call = (path = '', options = {}) => api(`${base}${path}`, { token, ...options }).then(result => result.data)
  const post = (path, body) => call(path, { method: 'POST', ...(body ? { body } : {}) })
  return {
    get: () => call(),
    update: (answers) => call('', { method: 'PUT', body: { answers } }),
    join: (code) => post('/team/join', { code }),
    create: (name) => post('/team/create', { name }),
    sendTransferCode: () => post('/team/transfer/code'),
    transfer: (participantId, code) => post('/team/transfer', { participantId, code }),
    withdraw: () => post('/team/withdraw'),
    leave: () => post('/team/leave'),
    approve: (id) => post(`/team/requests/${encodeURIComponent(id)}/approve`),
    reject: (id) => post(`/team/requests/${encodeURIComponent(id)}/reject`),
    remove: (id) => post(`/team/members/${encodeURIComponent(id)}/remove`),
    sendDisbandCode: () => post('/team/disband/code'),
    disband: (code) => post('/team/disband', { code }),
  }
}
export const getEventPage = () => api('/event-page/hackathon').then(result => result.data)
export const publishEventPage = (event, revision, token) => api('/event-page/hackathon', { method: 'PUT', body: { event, revision }, token }).then(result => result.data)
export async function loginEditor(email, password) {
  const result = await api('/auth/login', { method: 'POST', body: { email, password } })
  if (!['ADMIN', 'ORGANIZER'].includes(result.user.role)) throw new Error('İçerik düzenlemek için yönetim yetkisi gerekiyor.')
  return { token: result.token, user: result.user }
}
