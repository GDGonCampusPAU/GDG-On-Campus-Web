import { event } from '../data/event.js'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <p className="footer__name">{event.organizer}</p>
        <ul className="footer__socials">
          {event.socials.map((s, i) => (
            <li key={i}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <p className="footer__copy">
          © {new Date().getFullYear()} {event.organizer}
        </p>
      </div>
    </footer>
  )
}
