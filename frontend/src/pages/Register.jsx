import { useRef, useState } from 'react'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import TextField from '../components/common/TextField.jsx'
import { register } from '../lib/api.js'
import {
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePasswordConfirm,
} from '../lib/validation.js'

const EMPTY = { fullName: '', email: '', password: '', passwordConfirm: '' }

export default function Register() {
  const formRef = useRef(null)
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registeredEmail, setRegisteredEmail] = useState('')

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

    const nextErrors = {
      fullName: validateFullName(values.fullName),
      email: validateEmail(values.email),
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
      await register({
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        password: values.password,
      })
      setRegisteredEmail(values.email.trim())
      setValues(EMPTY)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (registeredEmail) {
    return (
      <AuthLayout
        title="Kaydın alındı"
        footer={
          <>
            Doğrulamayı tamamladın mı? <a href="#/login">Giriş Yap</a>
          </>
        }
      >
        <p className="form-message form-message--success" role="status">
          <strong>Başarılı:</strong> Doğrulama bağlantısını <strong>{registeredEmail}</strong> adresine
          gönderdik. Gelen kutunu ve gereksiz klasörünü kontrol et.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Kayıt Ol"
      subtitle="Hackathona katılmak için hesabını oluştur."
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
          hint="En az 8 karakter, bir harf ve bir rakam."
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
          {loading ? 'Kayıt yapılıyor…' : 'Kayıt Ol'}
        </button>
      </form>
    </AuthLayout>
  )
}
