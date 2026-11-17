// Yedek etkinlik verisi (base) ve sunucudan doğrulanmış veri okuma.
// Canlı veri React state'inde tutulur: bkz. context/EventContext.jsx (useEvent).
import base from './base.js'
import { isEventShape } from '../lib/content.js'
import { getEventPage } from '../lib/eventApi.js'

export { typeLabels } from '../lib/content.js'

/** Sunucuya ulaşılamazsa gösterilen yedek içerik. */
export const event = base
export const DEFAULT_FORM_SLUG = 'hackathon-katilim'
/** @deprecated useEvent().formSlug kullanın; yalnızca yedek değerdir. */
export const formSlug = DEFAULT_FORM_SLUG

/** Sunucudaki etkinlik sayfasını doğrulayıp döndürür; hiçbir modül durumunu değiştirmez. */
export async function loadEvent() {
  const page = await getEventPage()
  if (!isEventShape(base, page.event)) throw new Error('Sunucudaki etkinlik verisi geçersiz.')
  return { event: page.event, formSlug: page.formSlug || DEFAULT_FORM_SLUG }
}
