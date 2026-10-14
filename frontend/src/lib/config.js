// Backend adresi. Geliştirmede varsayılan: http://localhost:5000
// Başka bir adres gerekirse frontend/.env dosyasına VITE_API_URL=... yaz.
const env = import.meta.env ?? {}

export const API_URL = (env.VITE_API_URL ?? (env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '')
export const API_PREFIX = '/api/v1'
