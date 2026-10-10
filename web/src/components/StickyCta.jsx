import { useLocation } from 'react-router-dom'
import Button from './Button.jsx'
import './StickyCta.css'

export default function StickyCta() {
  const { pathname } = useLocation()
  if (pathname === '/kayit') return null
  return (
    <div className="sticky-cta">
      <Button to="/kayit">Kayıt Ol</Button>
    </div>
  )
}
