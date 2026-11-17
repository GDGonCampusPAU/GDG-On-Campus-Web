// Backend adresi. Geliştirmede varsayılan: http://localhost:5000
// Başka bir adres gerekirse frontend/.env dosyasına VITE_API_URL=... yaz.
/** @type {Partial<ImportMetaEnv>} */
const env = import.meta.env ?? {}

export const API_URL = (env.VITE_API_URL ?? (env.DEV ? 'http://localhost:5000' : '')).replace(/\/$/, '')
export const API_PREFIX = '/api/v1'

// Katılımcı sitesinin adresi (bakım modu sayfasındaki "Siteyi aç" bağlantısı).
// Üretimde panel.<alan> veya coreteam.<alan> → <alan>; geliştirmede http://localhost:5173. VITE_SITE_URL ile değiştirilebilir.
const PANEL_SUBDOMAINS = ['panel.', 'coreteam.']
const fromPanelHost = () => {
  const { protocol, host } = globalThis.location ?? {}
  const prefix = PANEL_SUBDOMAINS.find((p) => host?.startsWith(p))
  return prefix ? `${protocol}//${host.slice(prefix.length)}` : ''
}
export const SITE_URL = (env.VITE_SITE_URL ?? (env.DEV ? 'http://localhost:5173' : fromPanelHost())).replace(/\/$/, '')
