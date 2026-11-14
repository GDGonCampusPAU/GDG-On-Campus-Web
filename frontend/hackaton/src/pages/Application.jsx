import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import Button from '../components/Button.jsx'
import StepForm from '../components/StepForm.jsx'
import TeamPanel from '../components/TeamPanel.jsx'
import { useEvent } from '../context/EventContext.jsx'
import { applicationApi, lookupTeam } from '../lib/eventApi.js'
import './Application.css'

const STATUS = {
  PENDING: {
    tone: 'yellow',
    title: 'Yönetici onayında',
    text: 'Başvurun Core Team tarafından inceleniyor. Değerlendirme tamamlanınca sonucu burada göreceksin.',
  },
  APPROVED: { tone: 'green', title: 'Başvurun kabul edildi', text: 'Tebrikler! Etkinlikte görüşmek üzere.' },
  REJECTED: { tone: 'red', title: 'Başvurun kabul edilmedi', text: 'Bu sefer olmadı; ilgin için teşekkür ederiz.' },
}

const SAVED_NOTICE = 'Bilgilerin güncellendi. Başvurun yeniden yönetici onayına gönderildi.'

const formatDate = (iso) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
}

/** Takım ve dosya soruları bu formda düzenlenmez (takım sayfada yönetilir, dosyalar yüklendiği gibi kalır). */
const editableSteps = (steps) =>
  steps
    .map((step) => ({ ...step, fields: step.fields.filter((field) => field.kind !== 'team' && field.kind !== 'file') }))
    .filter((step) => step.fields.length > 0)

/** Daha önce başvurmuş, e-postası doğrulanmış katılımcının sayfası. Kayıt sayfası buraya yönlendirir. */
export default function Application() {
  const { state } = useLocation()
  const identity = state?.identity
  const { event, formSlug } = useEvent()
  const token = identity?.token
  const api = useMemo(() => applicationApi(formSlug, token), [formSlug, token])
  const previewTeam = useCallback((code) => lookupTeam(formSlug, code, token), [formSlug, token])

  const [application, setApplication] = useState(/** @type {any} */ (null))
  const [loadError, setLoadError] = useState('')
  const [expired, setExpired] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [reload, setReload] = useState(0)
  const savedRef = useRef(null)

  useEffect(() => {
    if (!token) return undefined
    let active = true
    api.get()
      .then((data) => active && (setApplication(data), setLoadError('')))
      .catch((error) => {
        if (!active) return
        if (error?.status === 401) setExpired(true)
        else setLoadError(error?.message || 'Başvurun yüklenemedi.')
      })
    return () => { active = false }
  }, [api, token, reload])

  useEffect(() => {
    if (saved) savedRef.current?.focus()
  }, [saved])

  // Doğrulama bilgisi yalnız yönlendirmeyle gelir; doğrudan açılışta önce e-posta doğrulanmalı.
  if (!identity?.participant?.email) return <Navigate to="/kayit" replace />

  const submittedAt = application?.submittedAt ?? state.submission?.submittedAt
  const submittedLabel = submittedAt ? formatDate(submittedAt) : null
  const status = STATUS[application?.status] ?? STATUS.PENDING

  return (
    <div className="application container">
      <header className="application__header">
        <h1 className="application__title">Başvurum</h1>
        <p className="application__intro">
          <strong>{identity.participant.email}</strong> adresiyle bu etkinliğe başvurdun. Başvurunla ilgili her şeyi bu
          sayfadan takip edebilirsin.
        </p>
        {submittedLabel && (
          <p className="application__date">
            Başvuru tarihi · <time dateTime={submittedAt}>{submittedLabel}</time>
          </p>
        )}
      </header>

      {expired ? (
        <div className="application__message" role="alert">
          <p>Oturumunun süresi doldu. Devam etmek için e-posta adresini yeniden doğrula.</p>
          <Button to="/kayit">E-postamı doğrula</Button>
        </div>
      ) : loadError ? (
        <div className="application__message" role="alert">
          <p>{loadError}</p>
          <Button variant="ghost" onClick={() => { setLoadError(''); setReload((n) => n + 1) }}>
            Tekrar dene
          </Button>
        </div>
      ) : !application ? (
        <p className="application__message" role="status">
          Başvurun yükleniyor…
        </p>
      ) : (
        <>
          {saved && (
            <p className="application__saved" role="status" tabIndex={-1} ref={savedRef}>
              {SAVED_NOTICE}
            </p>
          )}

          <ul className="application__grid">
            <li className={`application__card tone--${status.tone}`}>
              <section aria-labelledby="application-status">
                <span className="application__tag">Onay durumum</span>
                <h2 id="application-status" className="application__card-title">
                  {status.title}
                </h2>
                <p>{status.text}</p>
                {application.statusNote && (
                  <p className="application__note">
                    <strong>Ekibin notu:</strong> {application.statusNote}
                  </p>
                )}
              </section>
            </li>
            <li className="application__card tone--blue">
              <section aria-labelledby="application-edit">
                <span className="application__tag">Bilgilerim</span>
                <h2 id="application-edit" className="application__card-title">
                  Bilgilerimi değiştir
                </h2>
                <p>Takım dışındaki başvuru bilgilerini güncelleyebilirsin. Güncellediğinde başvurun yeniden yönetici onayına gider.</p>
                <Button
                  variant="ghost"
                  aria-expanded={editing}
                  aria-controls="application-editor"
                  onClick={() => { setEditing((open) => !open); setSaved(false) }}
                >
                  {editing ? 'Düzenlemeyi kapat' : 'Bilgilerimi düzenle'}
                </Button>
              </section>
            </li>
          </ul>

          {editing && (
            <section id="application-editor" className="application__editor" aria-label="Başvuru bilgilerini düzenle">
              <p className="application__warning" role="note">
                Kaydettiğinde başvurun yeniden yönetici onayına düşer{application.status === 'APPROVED' ? '; şu anki kabul durumu da kalkar' : ''}.
              </p>
              <StepForm
                steps={editableSteps(event.register.steps)}
                initialData={{ ...application.answers, email: application.email }}
                lockedFields={['email']}
                submitLabels={{ idle: 'Kaydet', busy: 'Kaydediliyor…' }}
                onSubmit={async (values) => {
                  try {
                    return { ok: true, application: await api.update(values) }
                  } catch (error) {
                    if (error?.status === 401) setExpired(true)
                    return { ok: false, error: error?.message || 'Bilgiler kaydedilemedi. Tekrar dene.' }
                  }
                }}
                onSuccess={(result) => {
                  setApplication(result.application)
                  setEditing(false)
                  setSaved(true)
                }}
              />
            </section>
          )}

          <TeamPanel
            team={application.team}
            api={api}
            lookupTeam={previewTeam}
            onChange={setApplication}
            onExpired={() => setExpired(true)}
          />

          <div className="application__actions">
            <Button to="/program">Programı Gör</Button>
            <Button to="/" variant="ghost">
              Ana sayfaya dön
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
