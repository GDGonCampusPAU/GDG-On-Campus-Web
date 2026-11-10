import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import { getUsers, updateUserRole } from '../lib/api.js'

export default function Users({ session, onLogout, onUnauthorized }) {
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('ALL')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  async function changeRole(id, nextRole) {
    setBusy(true)
    setError('')
    try {
      await updateUserRole(id, nextRole, session.token)
      setRevision(value => value + 1)
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
            <option value="PENDING">PENDING</option>
            <option value="MEMBER">MEMBER</option>
            <option value="ORGANIZER">ORGANIZER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </label>
        <p className="toolbar__count" aria-live="polite">
          {isReady ? `${pagination?.totalItems ?? users.length} üye` : '\u00A0'}
        </p>
      </div>

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
            <ul className="app-grid">
              {users.map(user => (
                <li key={user._id} className="app-card">
                  <h2>{user.fullName}</h2>
                  <p>{user.email}</p>
                  <label>Rol — {user.fullName}
                    <select
                      aria-label={`Rol — ${user.fullName}`}
                      value={user.role}
                      disabled={busy || user._id === session.user.id || !user.isEmailVerified}
                      onChange={event => changeRole(user._id, event.target.value)}
                    >
                      {['PENDING', 'MEMBER', 'ORGANIZER', 'ADMIN'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  {!user.isEmailVerified && <p>E-posta doğrulaması bekleniyor.</p>}
                </li>
              ))}
            </ul>
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
