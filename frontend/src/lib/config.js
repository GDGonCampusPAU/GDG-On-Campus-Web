// Backend adresi. Geliştirmede varsayılan: http://localhost:5000
// Başka bir adres gerekirse frontend/.env dosyasına VITE_API_URL=... yaz.
/** @type {Partial<ImportMetaEnv>} */
const env = import.meta.env ?? {}

export const API_URL = (env.VITE_API_URL ?? (env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '')
export const API_PREFIX = '/api/v1'

// Katılımcı sitesinin adresi (bakım modu sayfasındaki "Siteyi aç" bağlantısı).
// Üretimde panel.<alan> → <alan>; geliştirmede http://localhost:5173. VITE_SITE_URL ile değiştirilebilir.
const fromPanelHost = () => {
  const { protocol, host } = globalThis.location ?? {}
  return host?.startsWith('panel.') ? `${protocol}//${host.slice('panel.'.length)}` : ''
}
export const SITE_URL = (env.VITE_SITE_URL ?? (env.DEV ? 'http://localhost:5173' : fromPanelHost())).replace(/\/$/, '')
