/**
 * Giriş yapmış Core Team üyeleri için sayfa iskeleti: üst çubuk + içerik alanı.
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
        <div className="panel__heading">
          <h1 className="panel__title">{title}</h1>
          {actions}
        </div>
        {children}
      </main>
    </div>
  )
}
