import { NavLink } from 'react-router-dom'

/**
 * Giriş yapmış Core Team üyeleri için sayfa iskeleti: üst çubuk + içerik alanı.
 */
/**
 * @param {object} props
 * @param {{ fullName: string, role: string }} props.user
 * @param {() => void} props.onLogout
 * @param {string} props.title
 * @param {import('react').ReactNode} props.children
 * @param {import('react').ReactNode} [props.actions]
 */
export default function PanelLayout({ user, onLogout, title, children, actions }) {
  return (
    <div className="panel">
      <header className="panel__bar">
        <div className="panel__bar-inner">
          <p className="panel__brand">GDG On Campus PAU</p>
          <div className="panel__user">
            <span className="panel__user-name">{user.fullName}</span>
            <span className="panel__badge">{user.role}</span>
            <button type="button" className="link-button" onClick={onLogout}>
              Çıkış Yap
            </button>
          </div>
        </div>
        <div className="panel__stripe" aria-hidden="true" />
      </header>
      <main className="panel__main">
        <nav aria-label="Panel menüsü">
          {['ADMIN', 'ORGANIZER'].includes(user.role) && <NavLink to="/applications">Başvurular</NavLink>}
          {user.role === 'ADMIN' && <> · <NavLink to="/users">Ekip ve onaylar</NavLink></>}
        </nav>
        <div className="panel__heading">
          <h1 className="panel__title">{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}
