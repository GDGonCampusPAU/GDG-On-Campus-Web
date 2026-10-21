import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Applications from './pages/Applications.jsx'
import Users from './pages/Users.jsx'
import PanelLayout from './components/layout/PanelLayout.jsx'
import { clearSession, loadSession } from './lib/session.js'

// Geçici, bağımlılık gerektirmeyen yönlendirme: #/login, #/register, #/applications.
// Sayfalar arası geçiş adımında react-router ile değiştirilecek.
function getRoute() {
  const hash = window.location.hash
  if (hash === '#/register') return 'register'
  if (hash === '#/applications') return 'applications'
  if (hash === '#/users') return 'users'
  return 'login'
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [session, setSession] = useState(loadSession)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Giriş yapılmışsa her zaman başvuru listesi, yapılmamışsa giriş ya da kayıt gösterilir.
  const page = session ? (route === 'users' && session.user.role === 'ADMIN' ? 'users' : 'applications') : route === 'register' ? 'register' : 'login'

  // Adres çubuğunu gösterilen sayfayla aynı tut (ör. girişsizken #/applications yazılırsa #/login olur).
  useEffect(() => {
    const target = `#/${page}`
    if (window.location.hash !== target) window.location.replace(target)
  }, [page, route])

  const handleLogin = (nextSession) => {
    setNotice('')
    setSession(nextSession)
  }

  const handleLogout = () => {
    clearSession()
    setSession(null)
  }

  const handleUnauthorized = useCallback(() => {
    clearSession()
    setSession(null)
    setNotice('Oturum süren doldu. Lütfen tekrar giriş yap.')
  }, [])

  if (session && !['ADMIN', 'ORGANIZER'].includes(session.user.role)) {
    return <PanelLayout user={session.user} onLogout={handleLogout} title="Ekip hesabı"><p>Hesabın açık. Başvuruları yönetmek için ORGANIZER veya ADMIN yetkisi gerekiyor.</p></PanelLayout>
  }
  if (page === 'users') return <Users session={session} onLogout={handleLogout} onUnauthorized={handleUnauthorized} />
  if (page === 'applications') {
    return (
      <Applications session={session} onLogout={handleLogout} onUnauthorized={handleUnauthorized} />
    )
  }
  if (page === 'register') return <Register />
  return <Login onSuccess={handleLogin} notice={notice} />
}
