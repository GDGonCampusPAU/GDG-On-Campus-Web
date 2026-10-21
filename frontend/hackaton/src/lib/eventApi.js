export const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '')
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
export const getEventPage = () => api('/event-page/hackathon').then(result => result.data)
export const publishEventPage = (event, revision, token) => api('/event-page/hackathon', { method: 'PUT', body: { event, revision }, token }).then(result => result.data)
export async function loginEditor(email, password) {
  const result = await api('/auth/login', { method: 'POST', body: { email, password } })
  if (!['ADMIN', 'ORGANIZER'].includes(result.user.role)) throw new Error('İçerik düzenlemek için yönetim yetkisi gerekiyor.')
  return { token: result.token, user: result.user }
}
