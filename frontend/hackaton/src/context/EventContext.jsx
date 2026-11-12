import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_FORM_SLUG, event as fallbackEvent, loadEvent } from '../data/event.js'

const fallback = { event: fallbackEvent, formSlug: DEFAULT_FORM_SLUG }

// Provider dışında (ör. birim testleri) yedek içerik ve işlevsiz yenileme döner.
const EventContext = createContext({ ...fallback, error: null, refreshEvent: async () => {} })

/**
 * Etkinlik verisini React state'inde tutar; refreshEvent() sunucudan yeniden okur
 * ve tüm sayfaları yeniden çizer (ör. /admin yayınından sonra F5 gerekmez).
 */
export function EventProvider({ initial = fallback, initialError = null, children }) {
  const [page, setPage] = useState(initial)
  const [error, setError] = useState(initialError)
  const refreshEvent = useCallback(async () => {
    try {
      setPage(await loadEvent())
      setError(null)
    } catch (err) {
      // Mevcut içerik korunur; yalnızca hata bilgisi güncellenir.
      setError(err)
    }
  }, [])
  const value = useMemo(() => ({ ...page, error, refreshEvent }), [page, error, refreshEvent])
  return <EventContext.Provider value={value}>{children}</EventContext.Provider>
}

export const useEvent = () => useContext(EventContext)
