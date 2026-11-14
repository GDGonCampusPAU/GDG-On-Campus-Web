import { NavLink } from 'react-router-dom'
import { roleLabels } from '../../lib/roles.js'

const isStaff = (role) => role === 'ADMIN' || role === 'ORGANIZER'

/**
 * Giriş yapmış Core Team üyeleri için sayfa iskeleti: beyaz üst çubuk (logo, menü, kullanıcı) + içerik.
 * @param {object} props
 * @param {{ fullName: string, role: string }} props.user
 * @param {() => void} props.onLogout
 * @param {string} props.title
 * @param {import('react').ReactNode} props.children
 * @param {import('react').ReactNode} [props.actions] Başlığın sağındaki düğmeler.
 */
export default function PanelLayout({ user, onLogout, title, children, actions }) {
  return (
    <div className="panel">
      <header className="panel__bar">
        <div className="panel__bar-inner">
          <p className="panel__brand">
            <span className="panel__dots" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            GDG On Campus PAU
            <span className="panel__brand-tag">Core Team</span>
          </p>
          {isStaff(user.role) && (
            <nav className="panel__nav" aria-label="Panel menüsü">
              <NavLink to="/applications">Başvurular</NavLink>
              <NavLink to="/teams">Takımlar</NavLink>
              {user.role === 'ADMIN' && <NavLink to="/users">Ekip ve onaylar</NavLink>}
              {user.role === 'ADMIN' && <NavLink to="/maintenance">Bakım</NavLink>}
            </nav>
          )}
          <div className="panel__user">
            <span className="panel__user-name">{user.fullName}</span>
            <span className="panel__badge panel__badge--outline">{roleLabels[user.role] ?? user.role}</span>
            <button type="button" className="link-button" onClick={onLogout}>
              Çıkış Yap
            </button>
          </div>
        </div>
      </header>
      <main className="panel__main">
        <div className="panel__heading">
          <h1 className="panel__title">{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}
