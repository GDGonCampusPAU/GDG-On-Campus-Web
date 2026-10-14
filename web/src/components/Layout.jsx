import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { event } from '../data/event.js'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import StickyCta from './StickyCta.jsx'
import './Layout.css'

const PAGE_TITLES = { '/': null, '/kayit': 'Kayıt', '/program': 'Program', '/ekip': 'Ekip' }

export default function Layout() {
  const { pathname } = useLocation()
  // '/kayit/' de aynı rotaya eşleşir; sondaki eğik çizgiyi atıp tek biçime indir.
  const path = pathname.replace(/\/+$/, '') || '/'
  const hasCta = path !== '/kayit' && path !== '/'
  const mainRef = useRef(null)
  const lastPath = useRef(pathname)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      mainRef.current?.focus()
    }
  }, [pathname])

  useEffect(() => {
    const page = path in PAGE_TITLES ? PAGE_TITLES[path] : 'Sayfa bulunamadı'
    document.title = page ? `${page} | ${event.name}` : `${event.name} | ${event.organizer}`
  }, [path])

  return (
    <div className={`app${hasCta ? ' app--has-cta' : ''}`}>
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Navbar />
      <main id="main" className="app__main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
      <Footer />
      {hasCta && <StickyCta />}
    </div>
  )
}
