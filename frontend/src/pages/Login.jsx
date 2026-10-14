import { useRef, useState } from 'react'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import TextField from '../components/common/TextField.jsx'
import OtpForm from '../components/common/OtpForm.jsx'
import { login, sendOtp, verifyEmail } from '../lib/api.js'
import { saveSession } from '../lib/session.js'
import { validateEmail, validateLoginPassword } from '../lib/validation.js'

const PENDING_MESSAGE =
  'Hesabın henüz Core Team yöneticisi tarafından onaylanmadı. Onaylandığında giriş yapabilirsin.'

export default function Login({ onSuccess, notice }) {
  const formRef = useRef(null)
  const [step, setStep] = useState('form') // 'form' | 'code'
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  // Giriş dener. Başarılıysa oturumu kaydeder; değilse hangi adıma geçileceğine karar verir.
  const attemptLogin = async () => {
    setFormError('')
    try {
      const data = await login({ email: values.email.trim(), password: values.password })
      const session = { token: data.token, user: data.user }
      saveSession(session)
      onSuccess?.(session)
    } catch (error) {
      if (error.data?.requiresVerification) {
        setStep('code') // backend yeni kodu e-postaya gönderdi
      } else if (error.status === 403) {
        setStep('form')
        setFormError(PENDING_MESSAGE)
      } else {
        setStep('form')
        setFormError(error.message)
      }
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const nextErrors = {
      email: validateEmail(values.email),
      password: validateLoginPassword(values.password),
    }
    setErrors(nextErrors)

    if (nextErrors.email || nextErrors.password) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setLoading(true)
    await attemptLogin()
    setLoading(false)
  }

  // E-posta doğrulanmamış hesap: kodu doğrula, sonra girişi yeniden dene.
  const handleVerify = async (code) => {
    await verifyEmail({ email: values.email.trim(), code })
    await attemptLogin()
  }

  if (step === 'code') {
    return (
      <AuthLayout
        title="E-postanı doğrula"
        subtitle="Giriş yapmadan önce e-posta adresini doğrulaman gerekiyor."
        footer={
          <>
            Hesabın yok mu? <a href="#/register">Kayıt Ol</a>
          </>
        }
      >
        <OtpForm
          email={values.email.trim()}
          onVerify={handleVerify}
          onResend={() => sendOtp({ email: values.email.trim() })}
          onBack={() => setStep('form')}
          submitLabel="Doğrula ve Giriş Yap"
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Core Team Girişi"
      subtitle="Core Team hesabınla giriş yap."
      footer={
        <>
          Hesabın yok mu? <a href="#/register">Kayıt Ol</a>
        </>
      }
    >
      <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
        {notice && (
          <p className="form-message form-message--info" role="status">
            {notice}
          </p>
        )}
        {formError && (
          <p className="form-message form-message--error" role="alert">
            <strong>Hata:</strong> {formError}
          </p>
        )}
        <TextField
          label="E-posta"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={handleChange}
          error={errors.email}
          disabled={loading}
          required
        />
        <TextField
          label="Şifre"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={errors.password}
          disabled={loading}
          required
        />
        <button type="submit" className="btn" disabled={loading} aria-busy={loading}>
          {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
        </button>
      </form>
    </AuthLayout>
  )
}
