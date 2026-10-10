import { useState } from 'react'
import Button from '../components/Button.jsx'
import StepForm from '../components/StepForm.jsx'
import { submitRegistration } from '../lib/registration.js'
import './Register.css'

const endpoint = import.meta.env.VITE_REGISTER_ENDPOINT

export default function Register() {
  const [done, setDone] = useState(false)

  return (
    <div className="register container">
      <h1 className="register__title">Kayıt</h1>

      {done ? (
        <section className="register__success" aria-live="polite">
          <div className="register__shapes" aria-hidden="true">
            <i className="tone--blue" />
            <i className="tone--red" />
            <i className="tone--yellow" />
            <i className="tone--green" />
          </div>
          <h2>Kaydın alındı!</h2>
          <p>Detaylar e-posta adresine gönderilecek. Programa göz atmayı unutma.</p>
          <Button to="/program">Programı Gör</Button>
        </section>
      ) : (
        <StepForm onSubmit={(values) => submitRegistration(values, { endpoint })} onSuccess={() => setDone(true)} />
      )}
    </div>
  )
}
