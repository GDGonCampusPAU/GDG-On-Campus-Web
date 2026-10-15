import { useEffect, useRef, useState } from 'react'
import Button from '../components/Button.jsx'
import StepForm from '../components/StepForm.jsx'
import { event } from '../data/event.js'
import { submitRegistration } from '../lib/registration.js'
import './Register.css'

const endpoint = import.meta.env.VITE_REGISTER_ENDPOINT

export default function Register({ data = event }) {
  const { register } = data
  const [done, setDone] = useState(false)
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
      ) : (
        <StepForm steps={register.steps} onSubmit={(values) => submitRegistration(values, { endpoint })} onSuccess={() => setDone(true)} />
      )}
    </div>
  )
}
