import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Button from './Button.jsx'
import { event } from '../data/event.js'
import './Navbar.css'

const links = [
  { to: '/', label: 'Ana Sayfa', end: true },
  { to: '/program', label: 'Program' },
  { to: '/ekip', label: 'Ekip' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="navbar">
      <div className="navbar__inner container">
        <Link to="/" className="navbar__brand" onClick={close}>
          <span className="navbar__dots" aria-hidden="true">
            <i className="tone--blue" />
            <i className="tone--red" />
            <i className="tone--yellow" />
            <i className="tone--green" />
          </span>
          {event.organizer}
        </Link>

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={open}
          aria-controls="nav-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="visually-hidden">Menü</span>
          <span className="navbar__bars" aria-hidden="true" />
        </button>

        <nav id="nav-menu" className={`navbar__menu${open ? ' is-open' : ''}`} aria-label="Ana menü">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="navbar__link" onClick={close}>
              {l.label}
            </NavLink>
          ))}
          <Button to="/kayit" onClick={close}>
            Kayıt Ol
          </Button>
        </nav>
      </div>
    </header>
  )
}
