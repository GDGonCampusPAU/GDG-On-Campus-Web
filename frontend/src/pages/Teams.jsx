import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import { disbandTeam, getTeams, removeTeamMember, setTeamCaptain } from '../lib/api.js'

const ADMIN_STATUS = {
  PENDING: ['Yönetici onayı bekleniyor', 'pending'],
  APPROVED: ['Yönetici onayladı', 'approved'],
  REJECTED: ['Yönetici onaylamadı', 'rejected'],
}

function AdminBadge({ status }) {
  const [text, tone] = ADMIN_STATUS[status] ?? ADMIN_STATUS.PENDING
  return <span className={`panel__badge panel__badge--${tone}`}>{text}</span>
}

/**
 * İki adımlı düğme: önce "Emin misin?" sorar. Takımı etkileyen her yönetici işleminde kullanılır.
 * @param {{ label: string, confirmLabel: string, onConfirm: () => void, disabled?: boolean, danger?: boolean }} props
 */
function ConfirmButton({ label, confirmLabel, onConfirm, disabled, danger = false }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className={`btn btn--sm ${danger ? 'btn--danger' : 'btn--outline'}`} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    )
  }
  return (
    <span className="confirm" role="group" aria-label={label}>
      <span>Emin misin?</span>
      <button type="button" className="btn btn--sm btn--danger" disabled={disabled} onClick={onConfirm}>
        {confirmLabel}
      </button>
      <button type="button" className="btn btn--sm btn--outline" disabled={disabled} onClick={() => setAsking(false)}>
        Vazgeç
      </button>
    </span>
  )
}

/** @param {{ person: any, children?: import('react').ReactNode }} props */
function PersonRow({ person, children }) {
  return (
    <li className="person-row">
      <span className="person-row__who">
        <span className="person-row__name">{person.name}</span>
        {person.captain && <span className="panel__badge panel__badge--outline">Kaptan</span>}
        <span className="person-row__email">{person.email}</span>
        <AdminBadge status={person.adminStatus} />
        {person.edited && person.adminStatus === 'PENDING' && <span className="panel__badge panel__badge--edited">Bilgilerini güncelledi</span>}
      </span>
      {children && <span className="person-row__actions">{children}</span>}
    </li>
  )
}

export default function Teams({ session, onLogout, onUnauthorized }) {
  const { token, user } = session
  const [params] = useSearchParams()
  const focusCode = (params.get('kod') ?? '').toUpperCase()
  const [search, setSearch] = useState(focusCode)
  const [teams, setTeams] = useState(/** @type {any[] | null} */ (null))
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    getTeams(token)
      .then((data) => active && setTeams(data))
      .catch((error) => {
        if (!active) return
        if (error.status === 401) onUnauthorized?.()
        else setLoadError(error.message)
      })
    return () => { active = false }
  }, [token, onUnauthorized])

  // Başvurular sayfasından gelinen takımı görünür yap.
  useEffect(() => {
    if (teams && focusCode) document.getElementById(`team-${focusCode}`)?.scrollIntoView({ block: 'center' })
  }, [teams, focusCode])

  /** Bir işlemi çalıştırır; sunucu güncel takım listesini döndürür. */
  const run = async (fn, message) => {
    setBusy(true)
    setNotice('')
    setActionError('')
    try {
      setTeams(await fn())
      setNotice(message)
    } catch (error) {
      if (error.status === 401) onUnauthorized?.()
      else setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  const q = search.trim().toLocaleLowerCase('tr-TR')
  const shown = (teams ?? []).filter(
    (team) => !q || team.name.toLocaleLowerCase('tr-TR').includes(q) || team.code.toLowerCase().includes(q),
  )

  return (
    <PanelLayout user={user} onLogout={onLogout} title="Takımlar">
      <div className="toolbar">
        <div className="field toolbar__search">
          <label className="field__label" htmlFor="teams-search">
            Ara
          </label>
          <input
            id="teams-search"
            className="field__input"
            type="search"
            placeholder="Takım adı veya kodu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="toolbar__count" aria-live="polite">
          {teams ? `${shown.length} takım` : ' '}
        </p>
      </div>

      {notice && (
        <p className="form-message form-message--success" role="status">
          {notice}
        </p>
      )}
      {actionError && (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {actionError}
        </p>
      )}

      {loadError ? (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {loadError}
        </p>
      ) : !teams ? (
        <p className="panel__state" role="status">
          Takımlar yükleniyor…
        </p>
      ) : shown.length === 0 ? (
        <p className="panel__state">{q ? 'Aramanla eşleşen takım yok.' : 'Henüz takım kurulmadı.'}</p>
      ) : (
        <ul className="team-list">
          {shown.map((team) => (
            <li key={team.id} id={`team-${team.code}`} className={`team-card${team.code === focusCode ? ' team-card--focus' : ''}`}>
              <section aria-labelledby={`team-title-${team.id}`}>
                <div className="team-card__head">
                  <div>
                    <h2 id={`team-title-${team.id}`} className="team-card__title">
                      {team.name}
                    </h2>
                    <p className="team-card__meta">
                      <span className="team-chip__code">{team.code}</span>
                      <span>
                        {team.size}/{team.maxSize} kişi
                      </span>
                      {team.requests.length > 0 && <span className="panel__badge panel__badge--pending">{team.requests.length} bekleyen istek</span>}
                      {team.allApproved && <span className="panel__badge panel__badge--approved">Tamamı onaylı</span>}
                    </p>
                  </div>
                  <ConfirmButton
                    danger
                    label="Takımı dağıt"
                    confirmLabel="Dağıt"
                    disabled={busy}
                    onConfirm={() => run(() => disbandTeam(team.id, token), `${team.name} takımı dağıtıldı; üyeler bireysel katılıma döndü.`)}
                  />
                </div>

                <h3 className="team-card__subtitle">Takımdakiler</h3>
                <ul className="person-list">
                  {team.members.map((person) => (
                    <PersonRow key={person.id} person={person}>
                      {!person.captain && (
                        <>
                          <ConfirmButton
                            label="Kaptan yap"
                            confirmLabel="Kaptan yap"
                            disabled={busy}
                            onConfirm={() => run(() => setTeamCaptain(team.id, person.id, token), `${person.name} artık ${team.name} takımının kaptanı.`)}
                          />
                          <ConfirmButton
                            label="Takımdan çıkar"
                            confirmLabel="Çıkar"
                            disabled={busy}
                            onConfirm={() => run(() => removeTeamMember(team.id, person.id, token), `${person.name} takımdan çıkarıldı.`)}
                          />
                        </>
                      )}
                    </PersonRow>
                  ))}
                </ul>

                {team.requests.length > 0 && (
                  <>
                    <h3 className="team-card__subtitle">Katılmak isteyenler</h3>
                    <ul className="person-list">
                      {team.requests.map((person) => (
                        <PersonRow key={person.id} person={person}>
                          <ConfirmButton
                            label="İsteği sil"
                            confirmLabel="Sil"
                            disabled={busy}
                            onConfirm={() => run(() => removeTeamMember(team.id, person.id, token), `${person.name} adlı kişinin katılma isteği silindi.`)}
                          />
                        </PersonRow>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </li>
          ))}
        </ul>
      )}
    </PanelLayout>
  )
}
