import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import StepForm from '../components/StepForm.jsx'
import { useEvent } from '../context/EventContext.jsx'
import ParticipantVerification from '../components/ParticipantVerification.jsx'
import { API_URL, getMySubmission, lookupTeam } from '../lib/eventApi.js'
import TeamResult from '../components/TeamResult.jsx'
import { submitRegistration } from '../lib/registration.js'
import './Register.css'

/** @param {{ data?: any }} props Testler için isteğe bağlı veri; verilmezse useEvent() kullanılır. */
export default function Register({ data: dataProp }) {
  const { event, formSlug } = useEvent()
  const data = dataProp ?? event
  const { register } = data
  /** Başarılı gönderimin sonucu; takım bilgisi (team) içerebilir. */
  const [done, setDone] = useState(/** @type {null | { team?: any }} */ (null))
  const [identity, setIdentity] = useState(null)
  const [draftValues, setDraftValues] = useState({})
  const [checking, setChecking] = useState(false)
  const navigate = useNavigate()
  const successHeadingRef = useRef(null)

  useEffect(() => {
    if (done) successHeadingRef.current?.focus()
  }, [done])

  // Daha önce başvurmuş katılımcı formu yeniden doldurmaz; başvuru sayfasına yönlenir.
  const showApplication = (verified, submission) =>
    navigate('/basvurum', { replace: true, state: { identity: verified, submission } })

  const token = identity?.token
  const previewTeam = useCallback((code) => lookupTeam(formSlug, code, token), [formSlug, token])

  const handleVerified = async (verified) => {
    setChecking(true)
    try {
      const submission = await getMySubmission(formSlug, verified.token)
      if (submission.submitted) return showApplication(verified, submission)
    } catch {
      // Kontrol başarısızsa formu göster; sunucu tekrar başvuruyu zaten 409 ile reddeder.
    } finally {
      setChecking(false)
    }
    setIdentity(verified)
  }

  return (
    <div className="register container">
      <h1 className="register__title">{register.title}</h1>

      {register.status === 'closed' ? (
        <p>{register.closedMessage}</p>
      ) : done ? (
        <section className="register__success" aria-live="polite">
          <div className="register__shapes" aria-hidden="true">
            <i className="tone--blue" />
            <i className="tone--red" />
            <i className="tone--yellow" />
            <i className="tone--green" />
          </div>
          <h2 tabIndex={-1} ref={successHeadingRef}>
            {register.successTitle}
          </h2>
          <p>{register.successText}</p>
          {done.team && <TeamResult team={done.team} />}
          <div className="register__actions">
            <Button onClick={() => showApplication(identity, { submitted: true, status: 'PENDING', submittedAt: new Date().toISOString() })}>
              Başvuru kontrol sayfama aktar
            </Button>
            <Button to="/program" variant="ghost">
              Programı Gör
            </Button>
          </div>
        </section>
      ) : checking ? (
        <p className="register__identity" role="status">Başvuru durumun kontrol ediliyor…</p>
      ) : !identity ? (
        <ParticipantVerification slug={formSlug} onVerified={handleVerified} />
      ) : (
        <>
          <p className="register__identity">Doğrulanan adres: <strong>{identity.participant.email}</strong></p>
          <StepForm steps={register.steps} initialData={{ ...draftValues, email: identity.participant.email }} lockedFields={['email']} lookupTeam={previewTeam}
            onSubmit={async values => {
              setDraftValues(values)
              const result = await submitRegistration(values, { endpoint: `${API_URL}/api/v1/forms/public/${encodeURIComponent(formSlug)}/submit`, token: identity.token, formVersion: identity.formVersion })
              if (result.status === 401) setIdentity(null)
              // 409 hem "zaten başvurdun" hem "form güncellendi" olabilir; yalnız gerçek başvuruda yönlendir.
              if (result.status === 409) {
                const submission = await getMySubmission(formSlug, identity.token).catch(() => null)
                if (submission?.submitted) showApplication(identity, submission)
              }
              return result
            }} onSuccess={(result) => setDone({ team: result?.team ?? null })} />
        </>
      )}
    </div>
  )
}
