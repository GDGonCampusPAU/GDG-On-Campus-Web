import { useCallback, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import Applications from './pages/Applications.jsx'
import Users from './pages/Users.jsx'
import PanelLayout from './components/layout/PanelLayout.jsx'
import { clearSession, loadSession } from './lib/session.js'
import { homePath, isStaff } from './lib/routing.js'

// Girişsiz kullanıcıyı /login'e gönderir, gitmek istediği adresi state.from ile hatırlar.
function RequireStaff({ session, allowedRoles, onLogout, children }) {
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!isStaff(session.user)) {
    return (
      <PanelLayout user={session.user} onLogout={onLogout} title="Ekip hesabı">
        <p>Hesabın açık. Başvuruları yönetmek için ORGANIZER veya ADMIN yetkisi gerekiyor.</p>
      </PanelLayout>
    )
  }
  // Yetkisiz rol (ör. ORGANIZER -> /users) kendi ana sayfasına döner.
  if (allowedRoles && !allowedRoles.includes(session.user.role)) return <Navigate to={homePath(session.user)} replace />
  return children
}

export default function App() {
  const [session, setSession] = useState(loadSession)
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect after login is done by the /login route below (single source of truth).
  const handleLogin = (nextSession) => {
    setNotice('')
    setSession(nextSession)
  }

  const handleLogout = useCallback(() => {
    clearSession()
    setSession(null)
    navigate('/login', { replace: true })
  }, [navigate])

  const handleUnauthorized = useCallback(() => {
    clearSession()
    setSession(null)
    setNotice('Oturum süren doldu. Lütfen tekrar giriş yap.')
    navigate('/login', { replace: true })
  }, [navigate])

  const guard = (page, allowedRoles) => (
    <RequireStaff session={session} allowedRoles={allowedRoles} onLogout={handleLogout}>{page}</RequireStaff>
  )
  const home = session ? homePath(session.user) : '/login'
  // Page the user asked for before being sent to /login (same-site paths only).
  const from = location.state?.from
  const returnTo = typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && !from.startsWith('/login') ? from : home

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={returnTo} replace /> : <Login onSuccess={handleLogin} notice={notice} />} />
      <Route path="/register" element={session ? <Navigate to={home} replace /> : <Register />} />
      <Route path="/applications" element={guard(<Applications session={session} onLogout={handleLogout} onUnauthorized={handleUnauthorized} />, ['ORGANIZER', 'ADMIN'])} />
      <Route path="/users" element={guard(<Users session={session} onLogout={handleLogout} onUnauthorized={handleUnauthorized} />, ['ADMIN'])} />
      <Route path="*" element={guard(<Navigate to={home} replace />)} />
    </Routes>
  )
}
