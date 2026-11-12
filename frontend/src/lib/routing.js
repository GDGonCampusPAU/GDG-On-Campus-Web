// Panel rotaları ve rol kuralları tek yerde (backend ile aynı: /users yalnız ADMIN).
export const STAFF_ROLES = ['ADMIN', 'ORGANIZER']

export const isStaff = (user) => Boolean(user && STAFF_ROLES.includes(user.role))

/** Giriş yapmış kullanıcının varsayılan sayfası (şu an tüm ekip rolleri için aynı). */
export const homePath = () => '/applications'

/**
 * Eski hash adreslerini (#/register, #/users ...) gerçek yollara çevirir; eski yer imleri çalışmaya devam eder.
 * @returns {string|null} Yeni yol veya değişiklik gerekmiyorsa null.
 */
export function legacyHashPath(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#/')) return null
  const path = hash.slice(1)
  return /^\/[A-Za-z0-9/_-]*(\?[^#]*)?$/.test(path) ? path : null
}
