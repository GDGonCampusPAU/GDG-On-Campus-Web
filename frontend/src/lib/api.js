// Backend ile konuşan tek nokta. Sayfalar fetch'i doğrudan çağırmaz, buradaki fonksiyonları kullanır.
// Backend adresi frontend/.env dosyasından gelir: VITE_API_URL=http://localhost:3000

const BASE_URL = import.meta.env.VITE_API_URL ?? ''

// TODO: Backend auth API'si hazır olunca bu yolları ve gönderilen alan adlarını ona göre güncelle.
export const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  register: '/api/auth/register',
}

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function post(path, body) {
  if (!BASE_URL) {
    throw new ApiError('Sunucu bağlantısı henüz ayarlanmadı.')
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError('Sunucuya ulaşılamadı. İnternet bağlantını kontrol edip tekrar dene.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new ApiError(data.message ?? 'Bir hata oluştu. Lütfen tekrar dene.', response.status)
  }
  return data
}

export function login({ email, password }) {
  return post(AUTH_ENDPOINTS.login, { email, password })
}

export function register({ fullName, email, password }) {
  return post(AUTH_ENDPOINTS.register, { fullName, email, password })
}
