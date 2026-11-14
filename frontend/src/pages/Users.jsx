import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import { getUsers, updateUserRole } from '../lib/api.js'
import { roleLabels } from '../lib/roles.js'

export default function Users({ session, onLogout, onUnauthorized }) {
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('ALL')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const key = `${page}:${role}:${revision}`

  useEffect(() => {
    let cancelled = false
    getUsers(session.token, page, role).then(data => {
      if (!cancelled) setState({ ...data, key })
    }).catch(error => {
      if (cancelled) return
      if (error.status === 401) onUnauthorized?.()
      else setState({ key, error: error.message, data: [], pagination: null })
    })
    return () => { cancelled = true }
  }, [session.token, page, role, revision, key, onUnauthorized])

  async function changeRole(id, nextRole, name = '') {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateUserRole(id, nextRole, session.token)
      setRevision(value => value + 1)
      if (name) setNotice(`${name} artık ${roleLabels[nextRole] ?? nextRole}.`)
    } catch (error) {
      if (error.status === 401) onUnauthorized?.()
      else setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const isReady = state?.key === key
  const users = state?.data ?? []
  const pagination = state?.pagination

  // Doğrulanmış ama henüz onaylanmamış hesaplar ayrı bölümde, tek tıkla onaylanır.
  const pending = users.filter(user => user.role === 'PENDING' && user.isEmailVerified)
  const others = users.filter(user => !pending.includes(user))

  const row = (user) => {
    const isMe = user._id === session.user.id
    return (
      <li key={user._id} className="user-row">
        <div className="user-row__who">
          <span className="person-row__who">
            <h2 className="user-row__name">{user.fullName}</h2>
            {isMe && <span className="panel__badge panel__badge--outline">Sen</span>}
          </span>
          <span className="user-row__email">{user.email}</span>
          {!user.isEmailVerified && <p className="app-card__meta">E-posta doğrulaması bekleniyor.</p>}
        </div>
        <div className="user-row__controls">
          <span className={`panel__badge${user.role === 'PENDING' ? ' panel__badge--pending' : ''}`}>{roleLabels[user.role] ?? user.role}</span>
          {user.role === 'PENDING' && user.isEmailVerified && (
            <button type="button" className="btn btn--sm btn--approve" disabled={busy} onClick={() => changeRole(user._id, 'MEMBER', user.fullName)}>
              Üye olarak onayla
            </button>
          )}
          <label>
            Rol
            <select
              aria-label={`Rol — ${user.fullName}`}
              value={user.role}
              disabled={busy || isMe || !user.isEmailVerified}
              onChange={event => changeRole(user._id, event.target.value, user.fullName)}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      </li>
    )
  }

  return (
    <PanelLayout user={session.user} onLogout={onLogout} title="Ekip üyeleri ve onaylar">
      <div className="toolbar">
        <label className="field">
          <span className="field__label">Rol filtresi</span>
          <select
            aria-label="Rol filtresi"
            value={role}
            disabled={busy}
            onChange={(event) => {
              setRole(event.target.value)
              setPage(1)
            }}
          >
            <option value="ALL">Tümü</option>
            {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="toolbar__count" aria-live="polite">
          {isReady ? `${pagination?.totalItems ?? users.length} üye` : '\u00A0'}
        </p>
      </div>

      {notice && <p className="form-message form-message--success" role="status">{notice}</p>}
      {error && <p className="form-message form-message--error" role="alert">{error}</p>}

      {!isReady ? (
        <p className="panel__state" role="status">Üyeler yükleniyor…</p>
      ) : state.error ? (
        <p className="form-message form-message--error" role="alert">{state.error}</p>
      ) : (
        <>
          {users.length === 0 ? (
            <p className="panel__state">Kullanıcı bulunamadı. Henüz üye yok veya kritere uygun üye bulunamadı.</p>
          ) : (
            <>
              {pending.length > 0 && (
                <section className="users-section users-section--pending" aria-labelledby="users-pending-title">
                  <h2 id="users-pending-title" className="users-section__title">Onay bekleyenler ({pending.length})</h2>
                  <ul className="app-grid">{pending.map(row)}</ul>
                </section>
              )}
              {others.length > 0 && (
                <section className="users-section" aria-labelledby="users-all-title">
                  <h2 id="users-all-title" className="users-section__title">{pending.length > 0 ? 'Diğer hesaplar' : 'Hesaplar'}</h2>
                  <ul className="app-grid">{others.map(row)}</ul>
                </section>
              )}
            </>
          )}

          {pagination && pagination.totalPages > 1 && (
            <nav aria-label="Üye sayfalama" className="pager">
              <button
                type="button"
                className="btn btn--outline"
                disabled={page <= 1 || busy}
                onClick={() => setPage(p => p - 1)}
              >
                Önceki
              </button>
              <span className="pager__info">
                Sayfa {page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                className="btn btn--outline"
                disabled={page >= pagination.totalPages || busy}
                onClick={() => setPage(p => p + 1)}
              >
                Sonraki
              </button>
            </nav>
          )}
        </>
      )}
    </PanelLayout>
  )
}
