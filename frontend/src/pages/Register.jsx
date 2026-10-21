import { useRef, useState } from 'react'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import TextField from '../components/common/TextField.jsx'
import OtpForm from '../components/common/OtpForm.jsx'
import { register, sendOtp } from '../lib/api.js'
import {
  validateFullName,
  validateNewPassword,
  validatePasswordConfirm,
  validateRegisterEmail,
} from '../lib/validation.js'

const EMPTY = { fullName: '', email: '', password: '', passwordConfirm: '' }

export default function Register() {
  const formRef = useRef(null)
  const [step, setStep] = useState('form') // 'form' | 'code' | 'done'
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const account = () => ({
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    password: values.password,
  })

  // 1. adım: bilgileri gönder. Kod olmadan çağrılınca backend e-postaya 6 haneli kod yollar.
  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    const nextErrors = {
      fullName: validateFullName(values.fullName),
      email: validateRegisterEmail(values.email),
      password: validateNewPassword(values.password),
      passwordConfirm: validatePasswordConfirm(values.password, values.passwordConfirm),
    }
    setErrors(nextErrors)

    if (Object.values(nextErrors).some(Boolean)) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus())
      return
    }

    setLoading(true)
    try {
      await register(account())
      setStep('code')
    } catch (error) {
      setFormError(error.message)
    } finally {
      setLoading(false)
    }
  }

  // 2. adım: kodla kaydı tamamla.
  const handleVerify = async (code) => {
    await register({ ...account(), code })
    setStep('done')
  }

  if (step === 'done') {
    return (
      <AuthLayout
        title="Kaydın iletildi"
        footer={
          <>
            Zaten onaylandın mı? <a href="#/login">Giriş Yap</a>
          </>
        }
      >
        <p className="form-message form-message--success" role="status">
          <strong>Başarılı:</strong> E-posta adresin doğrulandı ve kaydın iletildi. Hesabının
          onay durumunu giriş ekranından kontrol edebilirsin. Onaylanana kadar giriş yapamazsın.
        </p>
      </AuthLayout>
    )
  }

  if (step === 'code') {
    return (
      <AuthLayout
        title="E-postanı doğrula"
        subtitle="Kaydı tamamlamak için e-postana gelen kodu yaz."
        footer={
          <>
            Zaten hesabın var mı? <a href="#/login">Giriş Yap</a>
          </>
        }
      >
        <OtpForm
          email={values.email.trim()}
          onVerify={handleVerify}
          onResend={() => sendOtp({ email: values.email.trim(), fullName: values.fullName.trim() })}
          onBack={() => setStep('form')}
          submitLabel="Kaydı Tamamla"
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Core Team Kaydı"
      subtitle="Core Team'e katılmak için hesabını oluştur."
      footer={
        <>
          Zaten hesabın var mı? <a href="#/login">Giriş Yap</a>
        </>
      }
    >
      <form ref={formRef} className="auth-form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-message form-message--error" role="alert">
            <strong>Hata:</strong> {formError}
          </p>
        )}
        <TextField
          label="Ad Soyad"
          name="fullName"
          autoComplete="name"
          value={values.fullName}
          onChange={handleChange}
          error={errors.fullName}
          disabled={loading}
          required
        />
        <TextField
          label="E-posta"
          name="email"
          type="email"
          autoComplete="email"
          hint="Gmail ya da Pamukkale Üniversitesi (@pau.edu.tr, @posta.pau.edu.tr) adresi."
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
          autoComplete="new-password"
          hint="En az 6 karakter."
          value={values.password}
          onChange={handleChange}
          error={errors.password}
          disabled={loading}
          required
        />
        <TextField
          label="Şifre Tekrar"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          value={values.passwordConfirm}
          onChange={handleChange}
          error={errors.passwordConfirm}
          disabled={loading}
          required
        />
        <button type="submit" className="btn" disabled={loading} aria-busy={loading}>
          {loading ? 'Kod gönderiliyor…' : 'Devam Et'}
        </button>
      </form>
    </AuthLayout>
  )
}
