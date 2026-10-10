import { useRef, useState } from 'react'
import AuthLayout from '../components/layout/AuthLayout.jsx'
import TextField from '../components/common/TextField.jsx'
import { login } from '../lib/api.js'
import { validateEmail, validateLoginPassword } from '../lib/validation.js'

export default function Login({ onSuccess }) {
  const formRef = useRef(null)
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (event) => {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setFormError('')

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
    try {
      const data = await login({ email: values.email.trim(), password: values.password })
      onSuccess?.(data)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Giriş Yap"
      subtitle="Hesabınla giriş yap ve hackathon sürecini takip et."
      footer={
        <>
          Hesabın yok mu? <a href="#/register">Kayıt Ol</a>
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
