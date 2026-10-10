import { Outlet } from 'react-router-dom'
import Navbar from './Navbar.jsx'
import Footer from './Footer.jsx'
import StickyCta from './StickyCta.jsx'
import './Layout.css'

export default function Layout() {
  return (
    <div className="app">
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <Navbar />
      <main id="main" className="app__main">
        <Outlet />
      </main>
      <Footer />
      <StickyCta />
    </div>
  )
}
