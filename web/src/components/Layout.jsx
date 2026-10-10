import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import StickyCta from './StickyCta.jsx'
import './Layout.css'

export default function Layout() {
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const lastPath = useRef(pathname)

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      mainRef.current?.focus()
    }
  }, [pathname])

  return (
    <div className={`app${pathname !== '/kayit' ? ' app--has-cta' : ''}`}>
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Navbar />
      <main id="main" className="app__main" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
      <Footer />
      <StickyCta />
    </div>
  )
}
