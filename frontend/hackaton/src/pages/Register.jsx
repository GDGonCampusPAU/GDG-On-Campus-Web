import { useEffect, useRef, useState } from 'react'
import Button from '../components/Button.jsx'
import StepForm from '../components/StepForm.jsx'
import { event, formSlug } from '../data/event.js'
import ParticipantVerification from '../components/ParticipantVerification.jsx'
import { API_URL } from '../lib/eventApi.js'
import { submitRegistration } from '../lib/registration.js'
import './Register.css'

export default function Register({ data = event }) {
  const { register } = data
  const [done, setDone] = useState(false)
  const [identity, setIdentity] = useState(null)
  const [draftValues, setDraftValues] = useState({})
  const successHeadingRef = useRef(null)

  useEffect(() => {
    if (done) successHeadingRef.current?.focus()
  }, [done])

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
          <Button to="/program">Programı Gör</Button>
        </section>
      ) : !identity ? (
        <ParticipantVerification slug={formSlug} onVerified={setIdentity} />
      ) : (
        <>
          <p>Doğrulanan adres: {identity.participant.email}</p>
          <StepForm steps={register.steps} initialData={{ ...draftValues, email: identity.participant.email }} lockedFields={['email']}
            onSubmit={async values => {
              setDraftValues(values)
              const result = await submitRegistration(values, { endpoint: `${API_URL}/api/v1/forms/public/${encodeURIComponent(formSlug)}/submit`, token: identity.token, formVersion: identity.formVersion })
              if (result.status === 401) setIdentity(null)
              return result
            }} onSuccess={() => setDone(true)} />
        </>
      )}
    </div>
  )
}
