// Giriş bilgisini (token + kullanıcı) tarayıcıda saklar.
// Depolama kapalı olabilir (gizli pencere vb.), bu yüzden her erişim try/catch içindedir.
const KEY = 'gdg-pau-session'

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    const session = raw ? JSON.parse(raw) : null
    return session?.token && session?.user ? session : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Depolama kullanılamıyorsa oturum sayfa yenilenene kadar bellekte kalır.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Silinecek bir şey yok.
  }
}
