import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import { getUsers, updateUserRole } from '../lib/api.js'

export default function Users({ session, onLogout, onUnauthorized }) {
  const [page, setPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = `${page}:${revision}`
  useEffect(() => {
    let cancelled = false
    getUsers(session.token, page).then(data => {
      if (!cancelled) setState({ ...data, key })
    }).catch(error => {
      if (cancelled) return
      if (error.status === 401) onUnauthorized()
      else setState({ key, error: error.message })
    })
    return () => { cancelled = true }
  }, [session.token, page, key, onUnauthorized])
  async function changeRole(id, role) {
    setBusy(true); setError('')
    try { await updateUserRole(id, role, session.token); setRevision(value => value + 1) }
    catch (error) { if (error.status === 401) onUnauthorized(); else setError(error.message) }
    finally { setBusy(false) }
  }
  return (
    <PanelLayout user={session.user} onLogout={onLogout} title="Ekip üyeleri ve onaylar">
      {error && <p role="alert">{error}</p>}
      {state?.key !== key ? <p role="status">Üyeler yükleniyor…</p> : state.error ? <p role="alert">{state.error}</p> : (
        <>
          <ul className="app-grid">
            {state.data.map(user => (
              <li key={user._id} className="app-card">
                <h2>{user.fullName}</h2><p>{user.email}</p>
                <label>Rol — {user.fullName}
                  <select aria-label={`Rol — ${user.fullName}`} value={user.role}
                    disabled={busy || user._id === session.user.id || !user.isEmailVerified}
                    onChange={event => changeRole(user._id, event.target.value)}>
                    {['PENDING', 'MEMBER', 'ORGANIZER', 'ADMIN'].map(role => <option key={role}>{role}</option>)}
                  </select>
                </label>
                {!user.isEmailVerified && <p>E-posta doğrulaması bekleniyor.</p>}
              </li>
            ))}
          </ul>
          <nav aria-label="Üye sayfalama">
            <button disabled={page <= 1 || busy} onClick={() => setPage(page - 1)}>Önceki</button>
            <span> {page} / {state.pagination.totalPages} </span>
            <button disabled={page >= state.pagination.totalPages || busy} onClick={() => setPage(page + 1)}>Sonraki</button>
          </nav>
        </>
      )}
    </PanelLayout>
  )
}
