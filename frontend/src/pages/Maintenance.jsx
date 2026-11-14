import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import { getMaintenance, setMaintenance } from '../lib/api.js'
import { SITE_URL } from '../lib/config.js'

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' })

const SERVER_NOTE = {
  running: 'Bağımsız bakım sunucusu çalışıyor: backend, panel ve site kapatılsa bile bakım sayfası açık kalır.',
  stopped: 'Bağımsız bakım sunucusu çalışmıyor. Site geliştirme sunucusu açıksa sayfayı o gösterir; backend yeniden başladığında bakım sunucusu da kendiliğinden başlar.',
  external: 'Bakım sayfasını sunucu (nginx / site container’ı) gösteriyor; backend kapansa da açık kalır.',
}

export default function Maintenance({ session, onLogout, onUnauthorized }) {
  const { token, user } = session
  const [state, setState] = useState(/** @type {any} */ (null))
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    let active = true
    getMaintenance(token)
      .then((data) => active && setState(data))
      .catch((error) => {
        if (!active) return
        if (error.status === 401) onUnauthorized?.()
        else setLoadError(error.message)
      })
    return () => { active = false }
  }, [token, onUnauthorized])

  const change = async (next) => {
    setBusy(true)
    setNotice('')
    setActionError('')
    try {
      setState(await setMaintenance(next, token))
      setAsking(false)
      setNotice(next ? 'Bakım modu başlatıldı. Sitedeki bütün sayfalar artık bakım sayfasını gösteriyor.' : 'Bakım modu durduruldu. Site yeniden yayında.')
    } catch (error) {
      if (error.status === 401) onUnauthorized?.()
      else setActionError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <PanelLayout user={user} onLogout={onLogout} title="Bakım modu">
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
      ) : !state ? (
        <p className="panel__state" role="status">
          Durum yükleniyor…
        </p>
      ) : (
        <section className={`maintenance-card${state.active ? ' maintenance-card--on' : ''}`} aria-labelledby="maintenance-title">
          <span className={`panel__badge panel__badge--${state.active ? 'outline' : 'approved'}`}>
            {state.active ? 'Site bakımda' : 'Site yayında'}
          </span>
          <h2 id="maintenance-title" className="maintenance-card__title">
            {state.active ? 'Ziyaretçiler “Tadilattayız” sayfasını görüyor' : 'Katılımcı sitesi normal çalışıyor'}
          </h2>

          {state.active ? (
            <>
              <p className="maintenance-card__text">
                {state.since && <>{dateFormat.format(new Date(state.since))} tarihinden beri</>}
                {state.by?.name && <>, {state.by.name} tarafından açıldı</>}.
              </p>
              <p className="maintenance-card__text">{SERVER_NOTE[state.server] ?? ''}</p>
            </>
          ) : (
            <p className="maintenance-card__text">
              Bakım modunu başlattığında sitedeki bütün sayfalar bakım sayfasına yönlenir. Sayfa ayrı bir süreçte çalışır; backend’i ve siteyi
              kapatsan bile açık kalır. Buradan durdurana kadar bakım modundan çıkılmaz.
            </p>
          )}

          <div className="maintenance-card__actions">
            {state.active ? (
              <button type="button" className="btn" disabled={busy} onClick={() => change(false)}>
                Bakım modunu durdur
              </button>
            ) : asking ? (
              <span className="confirm" role="group" aria-label="Bakım modunu başlat">
                <span>Site ziyaretçilere kapanacak. Emin misin?</span>
                <button type="button" className="btn btn--sm btn--danger" disabled={busy} onClick={() => change(true)}>
                  Başlat
                </button>
                <button type="button" className="btn btn--sm btn--outline" disabled={busy} onClick={() => setAsking(false)}>
                  Vazgeç
                </button>
              </span>
            ) : (
              <button type="button" className="btn" disabled={busy} onClick={() => setAsking(true)}>
                Bakım modunu başlat
              </button>
            )}
            {SITE_URL && (
              <a className="btn btn--outline" href={`${SITE_URL}/maintenance.html`} target="_blank" rel="noreferrer">
                Bakım sayfasını önizle
              </a>
            )}
          </div>
        </section>
      )}
    </PanelLayout>
  )
}
