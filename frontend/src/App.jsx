import { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Register from './pages/Register.jsx'
import AuthLayout from './components/layout/AuthLayout.jsx'

// Geçici, bağımlılık gerektirmeyen yönlendirme: #/login ve #/register.
// Sayfalar arası geçiş adımında react-router ile değiştirilecek.
function getRoute() {
  return window.location.hash === '#/register' ? 'register' : 'login'
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [session, setSession] = useState(null)

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  if (session) {
    return (
      <AuthLayout title="Giriş yaptın" subtitle="Üye listesi sayfası bir sonraki adımda eklenecek.">
        <button type="button" className="btn" onClick={() => setSession(null)}>
          Çıkış Yap
        </button>
      </AuthLayout>
    )
  }

  return route === 'register' ? <Register /> : <Login onSuccess={setSession} />
}
