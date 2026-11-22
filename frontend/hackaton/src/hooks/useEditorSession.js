import { useState } from 'react'

const UNLOCK_KEY = 'hackathon-admin-unlocked'

/** /admin ve /admin/juri'nin ortak oturumu; yalnız bu sekmede tutulur. */
export function useEditorSession() {
  const [session, setSession] = useState(() => {
    try {
      const value = JSON.parse(window.sessionStorage.getItem(UNLOCK_KEY))
      return value?.token ? value : null
    } catch {
      return null
    }
  })

  const unlock = (value) => {
    try {
      window.sessionStorage.setItem(UNLOCK_KEY, JSON.stringify(value))
    } catch {
      // Hatırlanamazsa bu oturumda yine açılır; yenilemede şifre tekrar sorulur.
    }
    setSession(value)
  }

  const lock = () => {
    try { window.sessionStorage.removeItem(UNLOCK_KEY) } catch { /* storage unavailable */ }
    setSession(null)
  }

  return { session, unlock, lock }
}
