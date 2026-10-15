import { useEffect, useState } from 'react'
import TextField from './TextField.jsx'
import { validateOtpCode } from '../../lib/validation.js'

const RESEND_SECONDS = 30

/**
 * 6 haneli e-posta doğrulama kodu formu (kayıt ve giriş akışlarında ortak).
 * onVerify(code): kodu doğrulayan async fonksiyon; hata fırlatırsa mesajı gösterilir.
 * onResend(): yeni kod gönderen async fonksiyon.
 */
export default function OtpForm({ email, onVerify, onResend, onBack, submitLabel = 'Doğrula' }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS) // kod az önce gönderildi

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const handleChange = (event) => {
    setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setNotice('')
    const message = validateOtpCode(code)
    if (message) {
      setError(message)
      return
    }
    setLoading(true)
    try {
      await onVerify(code)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setError('')
    setNotice('')
    try {
      await onResend()
      setNotice('Yeni kod gönderildi.')
      setCooldown(RESEND_SECONDS)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <p className="form-message form-message--info" role="status">
        <strong>{email}</strong> adresine 6 haneli bir doğrulama kodu gönderdik. Gelen kutunu ve
        gereksiz klasörünü kontrol et. Kod 10 dakika geçerli.
      </p>
      {notice && (
        <p className="form-message form-message--success" role="status">
          {notice}
        </p>
      )}
      <TextField
        label="Doğrulama Kodu"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        inputClassName="field__input--code"
        value={code}
        onChange={handleChange}
        error={error}
        disabled={loading}
        required
      />
      <button type="submit" className="btn" disabled={loading} aria-busy={loading}>
        {loading ? 'Doğrulanıyor…' : submitLabel}
      </button>
      <div className="auth-actions">
        <button
          type="button"
          className="link-button"
          onClick={handleResend}
          disabled={loading || cooldown > 0}
        >
          {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
        </button>
        {onBack && (
          <button type="button" className="link-button" onClick={onBack} disabled={loading}>
            Geri dön
          </button>
        )}
      </div>
    </form>
  )
}
