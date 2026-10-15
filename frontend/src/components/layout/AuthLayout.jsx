/**
 * Login ve Register için ortak sayfa iskeleti.
 * Resmi logo dosyasının yolu belli olunca `logoSrc` ile verilir; verilmezse logo gösterilmez.
 */
export default function AuthLayout({ title, subtitle, children, footer, logoSrc, logoAlt = '' }) {
  return (
    <main className="auth-page">
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-bg__glyph auth-bg__glyph--braces">{'{ }'}</span>
        <span className="auth-bg__glyph auth-bg__glyph--tag">{'</>'}</span>
        <span className="auth-bg__glyph auth-bg__glyph--heart">{'<3'}</span>
        <span className="auth-bg__glyph auth-bg__glyph--arrow">{'->'}</span>
      </div>
      <div className="auth-shell">
        {logoSrc ? (
          <img className="auth-logo" src={logoSrc} alt={logoAlt} />
        ) : (
          <p className="auth-brand">GDG On Campus PAU</p>
        )}
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-card__stripe" aria-hidden="true" />
          <div className="auth-card__body">
            <h1 id="auth-title" className="auth-title">
              {title}
            </h1>
            {subtitle && <p className="auth-subtitle">{subtitle}</p>}
            {children}
          </div>
        </section>
        {footer && <p className="auth-footer">{footer}</p>}
      </div>
    </main>
  )
}
