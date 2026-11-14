import { useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import { TeamLookup } from './TeamField.jsx'
import { TEAM_CODE_RE, normalizeTeamCode } from '../lib/registration.js'
import './TeamPanel.css'

const ADMIN_STATUS = {
  PENDING: ['Yönetici onayı bekleniyor', 'yellow'],
  APPROVED: ['Yönetici onayladı', 'green'],
  REJECTED: ['Yönetici onaylamadı', 'red'],
}

/** Başvurunun yönetici kararı; renk tek başına anlam taşımaz, metin de söyler. */
export function AdminBadge({ status }) {
  const [text, tone] = ADMIN_STATUS[status] ?? ADMIN_STATUS.PENDING
  return <span className={`team-panel__badge tone--${tone}`}>{text}</span>
}

/** Geri alınamaz işlemler için iki adımlı düğme: önce "Emin misin?" sorar. */
function ConfirmButton({ label, confirmLabel, onConfirm, disabled }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </Button>
    )
  }
  return (
    <span className="team-panel__confirm" role="group" aria-label={label}>
      <span>Emin misin?</span>
      <Button size="sm" variant="danger" disabled={disabled} onClick={onConfirm}>
        {confirmLabel}
      </Button>
      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => setAsking(false)}>
        Vazgeç
      </Button>
    </span>
  )
}

/** @param {{ person: any, children?: import('react').ReactNode }} props */
function PersonRow({ person, children }) {
  return (
    <li className="team-panel__row">
      <span className="team-panel__person">
        <span className="team-panel__name">
          {person.name}
          {person.captain && <span className="team-panel__tag">Kaptan</span>}
          {person.isMe && <span className="team-panel__tag team-panel__tag--me">Sen</span>}
        </span>
        <AdminBadge status={person.adminStatus} />
      </span>
      {children && <span className="team-panel__actions">{children}</span>}
    </li>
  )
}

/**
 * "Başvurum" sayfasındaki takım bölümü.
 * @param {object} props
 * @param {any} props.team Sunucunun takım görünümü; takımı yoksa null.
 * @param {ReturnType<typeof import('../lib/eventApi.js').applicationApi>} props.api
 * @param {(code: string) => Promise<any>} [props.lookupTeam]
 * @param {(application: any) => void} props.onChange Her işlemden sonra güncel başvuru.
 * @param {() => void} props.onExpired Oturum süresi dolduğunda (401).
 */
export default function TeamPanel({ team, api, lookupTeam, onChange, onExpired }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  /** E-posta koduyla onaylanan işlem: takımı dağıtmak veya kaptanlığı birine devretmek. */
  const [confirm, setConfirm] = useState(/** @type {null | { kind: 'disband' } | { kind: 'transfer', person: any }} */ (null))

  /** Bir işlemi çalıştırır; başarılıysa güncel başvuruyu yukarı verir ve isteğe bağlı bir bilgi mesajı gösterir. */
  const run = async (fn, doneMessage = '') => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      onChange(await fn())
      setNotice(doneMessage)
      return true
    } catch (err) {
      if (err?.status === 401) onExpired()
      else setError(err?.message || 'İşlem tamamlanamadı. Tekrar dene.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const isCaptain = team?.role === 'CAPTAIN'
  const isMember = team?.role === 'MEMBER' && team.status === 'APPROVED'
  const isPending = team?.role === 'MEMBER' && team.status !== 'APPROVED'

  return (
    <section className="team-panel" aria-labelledby="team-panel-title">
      <div className="team-panel__head">
        <div>
          <p className="team-panel__eyebrow">Takım bilgisi</p>
          <h2 id="team-panel-title" className="team-panel__title">
            {team ? team.name : 'Henüz bir takımın yok'}
          </h2>
          {(isCaptain || isMember) && (
            <p className="team-panel__meta">
              Takım kodu <strong className="team-panel__code">{team.code}</strong> · {team.size}/{team.maxSize} kişi
            </p>
          )}
        </div>
        {isCaptain && !confirm && (
          <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirm({ kind: 'disband' })}>
            Takımı dağıt
          </Button>
        )}
        {isCaptain && confirm?.kind === 'disband' && (
          <EmailConfirm
            key="disband"
            title="Takımı dağıt"
            description="Takımı dağıtınca tüm üyeler ve bekleyen istekler bireysel katılıma döner. Bu işlem geri alınamaz."
            confirmLabel="Takımı dağıt"
            busy={busy}
            onSend={api.sendDisbandCode}
            onConfirm={(code) => run(() => api.disband(code), 'Takımı dağıttın. Şu an bireysel olarak katılacaksın.')}
            onClose={() => setConfirm(null)}
          />
        )}
        {isCaptain && confirm?.kind === 'transfer' && (
          <EmailConfirm
            key={`transfer-${confirm.person.id}`}
            title={`Kaptanlığı ${confirm.person.name} adlı kişiye devret`}
            description={`Onaylayınca ${confirm.person.name} takımın kaptanı olur; sen takımda üye olarak kalırsın. İstekleri ve takımı artık o yönetir.`}
            confirmLabel="Kaptanlığı devret"
            busy={busy}
            onSend={api.sendTransferCode}
            onConfirm={(code) => run(() => api.transfer(confirm.person.id, code), `Kaptanlık ${confirm.person.name} adlı kişiye geçti.`)}
            onClose={() => setConfirm(null)}
          />
        )}
      </div>

      {error && (
        <p className="team-panel__alert" role="alert">
          {error}
        </p>
      )}
      <p className="team-panel__done" role="status">
        {notice}
      </p>

      {!team && <NoTeam api={api} run={run} busy={busy} lookupTeam={lookupTeam} />}

      {isPending && (
        <div className="team-panel__pending">
          <p>
            <strong>{team.name}</strong> takımına katılma isteğin kaptanın onayını bekliyor.
          </p>
          <ConfirmButton
            label="İsteği geri çek"
            confirmLabel="Geri çek"
            disabled={busy}
            onConfirm={() => run(api.withdraw, 'Katılma isteğini geri çektin. Şu an bireysel olarak katılacaksın.')}
          />
        </div>
      )}

      {isCaptain && (
        <CaptainLists team={team} api={api} run={run} busy={busy} onTransfer={(person) => setConfirm({ kind: 'transfer', person })} />
      )}

      {isMember && (
        <>
          <h3 className="team-panel__subtitle">Takımdakiler</h3>
          <ul className="team-panel__list">
            {team.members.map((person) => (
              <PersonRow key={person.id} person={person} />
            ))}
          </ul>
          <div className="team-panel__footer">
            <ConfirmButton
              label="Takımdan ayrıl"
              confirmLabel="Ayrıl"
              disabled={busy}
              onConfirm={() => run(api.leave, 'Takımdan ayrıldın. Şu an bireysel olarak katılacaksın.')}
            />
          </div>
        </>
      )}
    </section>
  )
}

function CaptainLists({ team, api, run, busy, onTransfer }) {
  const requests = team.requests ?? []
  const [tab, setTab] = useState(requests.length ? 'requests' : 'members')
  const tabs = [
    ['requests', 'Katılmak isteyenler', requests.length],
    ['members', 'Takımdakiler', team.members.length],
  ]
  const onKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    const next = tab === 'requests' ? 'members' : 'requests'
    setTab(next)
    document.getElementById(`team-tab-${next}`)?.focus()
  }

  return (
    <>
      <div className="team-panel__tabs" role="tablist" aria-label="Takım listeleri">
        {tabs.map(([key, label, count]) => (
          <button
            key={key}
            id={`team-tab-${key}`}
            type="button"
            role="tab"
            className="team-panel__tab"
            aria-selected={tab === key}
            aria-controls={`team-tabpanel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => setTab(key)}
            onKeyDown={onKeyDown}
          >
            {label} <span className="team-panel__count">{count}</span>
          </button>
        ))}
      </div>

      <div id={`team-tabpanel-${tab}`} role="tabpanel" aria-labelledby={`team-tab-${tab}`} className="team-panel__tabpanel">
        {tab === 'requests' ? (
          requests.length === 0 ? (
            <p className="team-panel__empty">Şu an bekleyen katılma isteği yok. Takım kodunu arkadaşlarınla paylaşabilirsin.</p>
          ) : (
            <ul className="team-panel__list">
              {requests.map((person) => (
                <PersonRow key={person.id} person={person}>
                  <Button size="sm" disabled={busy} onClick={() => run(() => api.approve(person.id), `${person.name} takıma katıldı.`)}>
                    Kabul et
                  </Button>
                  <ConfirmButton
                    label="Reddet"
                    confirmLabel="Reddet"
                    disabled={busy}
                    onConfirm={() => run(() => api.reject(person.id), `${person.name} adlı kişinin isteğini reddettin.`)}
                  />
                </PersonRow>
              ))}
            </ul>
          )
        ) : (
          <ul className="team-panel__list">
            {team.members.map((person) => (
              <PersonRow key={person.id} person={person}>
                {!person.captain && (
                  <>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => onTransfer(person)}>
                      Kaptan yap
                    </Button>
                    <ConfirmButton
                      label="Takımdan çıkar"
                      confirmLabel="Çıkar"
                      disabled={busy}
                      onConfirm={() => run(() => api.remove(person.id), `${person.name} takımdan çıkarıldı.`)}
                    />
                  </>
                )}
              </PersonRow>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

/** Takımı olmayanlar: bireysel katılım uyarısı + takım kur / takıma katıl. */
function NoTeam({ api, run, busy, lookupTeam }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const trimmed = name.trim().replace(/\s+/g, ' ')
  const nameValid = trimmed.length >= 2 && trimmed.length <= 40
  const codeValid = TEAM_CODE_RE.test(code)

  const create = async (event) => {
    event.preventDefault()
    if (nameValid && (await run(() => api.create(trimmed), 'Takımın kuruldu. Takım kodunu arkadaşlarınla paylaş; istekleri buradan onaylarsın.'))) setName('')
  }
  const join = async (event) => {
    event.preventDefault()
    if (codeValid && (await run(() => api.join(code), 'Katılma isteğin gönderildi. Kaptanın onayını bekliyor, haber vermek isteyebilirsin :)'))) setCode('')
  }

  return (
    <>
      <p className="team-panel__solo" role="note">
        Şu an bireysel olarak katılacaksın.
      </p>
      <div className="team-panel__choices">
        <form className="team-panel__choice" onSubmit={create} aria-labelledby="create-team-title">
          <h3 id="create-team-title" className="team-panel__subtitle">Takım kur</h3>
          <Field id="create-team-name" label="Takım adı" hint="Takımı kuran kişi kaptan olur; arkadaşların takım koduyla katılır.">
            <input
              id="create-team-name"
              type="text"
              maxLength={40}
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-describedby="create-team-name-hint"
            />
          </Field>
          <Button type="submit" disabled={busy || !nameValid}>
            Takımı kur
          </Button>
        </form>
        <form className="team-panel__choice" onSubmit={join} aria-labelledby="join-team-title">
          <h3 id="join-team-title" className="team-panel__subtitle">Takıma katıl</h3>
          <Field id="join-team-code" label="Takım kodu" hint="Kaptanından aldığın 6 karakterlik kodu yaz; isteğin kaptanın onayına düşer.">
            <input
              id="join-team-code"
              className="team-field__code"
              type="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={6}
              placeholder="ABC123"
              value={code}
              onChange={(event) => setCode(normalizeTeamCode(event.target.value))}
              aria-describedby="join-team-code-hint join-team-lookup"
            />
          </Field>
          <TeamLookup id="join-team-lookup" code={code} lookupTeam={lookupTeam} />
          <Button type="submit" disabled={busy || !codeValid}>
            Katılma isteği gönder
          </Button>
        </form>
      </div>
    </>
  )
}

/**
 * E-postaya gelen 6 haneli kodla onaylanan işlem (takımı dağıtmak, kaptanlığı devretmek).
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} props.confirmLabel
 * @param {boolean} props.busy
 * @param {() => Promise<any>} props.onSend Kodu e-postaya gönderir.
 * @param {(code: string) => Promise<boolean>} props.onConfirm Kodla işlemi yapar; başarılıysa true.
 * @param {() => void} props.onClose
 */
function EmailConfirm({ title, description, confirmLabel, busy, onSend, onConfirm, onClose }) {
  const [step, setStep] = useState(/** @type {'explain' | 'code'} */ ('explain'))
  const [code, setCode] = useState('')
  const [sendError, setSendError] = useState('')
  const [sending, setSending] = useState(false)

  const sendCode = async () => {
    setSendError('')
    setSending(true)
    try {
      await onSend()
      setStep('code')
    } catch (err) {
      setSendError(err?.message || 'Kod gönderilemedi. Tekrar dene.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="team-panel__disband" role="group" aria-labelledby="email-confirm-title">
      <p id="email-confirm-title" className="team-panel__disband-title">
        {title}
      </p>
      <p>{description}</p>
      {step === 'explain' ? (
        <>
          <p>Onay için e-posta adresine 6 haneli bir kod göndereceğiz.</p>
          {sendError && <p role="alert">{sendError}</p>}
          <span className="team-panel__actions">
            <Button size="sm" variant="danger" disabled={busy || sending} onClick={sendCode}>
              Kodu gönder
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Vazgeç
            </Button>
          </span>
        </>
      ) : (
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            if (await onConfirm(code)) onClose()
          }}
        >
          <Field id="email-confirm-code" label="E-postana gelen kod" required>
            <input
              id="email-confirm-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <span className="team-panel__actions">
            <Button size="sm" variant="danger" type="submit" disabled={busy || code.length !== 6}>
              {confirmLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Vazgeç
            </Button>
          </span>
        </form>
      )}
    </div>
  )
}
