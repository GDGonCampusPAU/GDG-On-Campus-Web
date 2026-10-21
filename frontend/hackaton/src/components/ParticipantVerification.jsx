import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/eventApi.js'

export default function ParticipantVerification({ slug, onVerified }) {
  const [form, setForm] = useState(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const inFlight = useRef(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    api(`/forms/public/${encodeURIComponent(slug)}`).then(result => { if (active) setForm(result.data) })
      .catch(error => { if (active) setError(error.message) })
    return () => { active = false }
  }, [slug, retry])
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])
  async function perform(action) {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setError('')
    try { await action() } catch (error) { setError(error.message) }
    finally { setBusy(false); inFlight.current = false }
  }
  function send(event) {
    event.preventDefault()
    return perform(async () => {
      const result = await api('/participant-auth/email/send-otp', { method: 'POST', body: { email: email.trim() } })
      setSent(true); setCooldown(result.resendAfterSeconds)
    })
  }
  function verify(event) {
    event.preventDefault()
    return perform(async () => {
      const identity = await api('/participant-auth/email/verify', { method: 'POST', body: { email: email.trim(), code } })
      onVerified({ ...identity, formVersion: form.schemaVersion })
    })
  }
  if (!form) return <section><p role={error ? 'alert' : 'status'}>{error || 'Başvuru formu yükleniyor…'}</p>{error && <button onClick={() => { setError(''); setRetry(value => value + 1) }}>Tekrar dene</button>}</section>
  const methods = form.settings?.verificationMethods || []
  return (
    <section className="participant-verification">
      <h2>E-posta adresini doğrula</h2>
      <p>Başvurmadan önce e-posta adresinin sana ait olduğunu doğrula.</p>
      {error && <p role="alert">{error}</p>}
      {methods.includes('EMAIL_OTP') && (
        <form onSubmit={sent ? verify : send}>
          <label htmlFor="participant-email">Doğrulama e-postası</label>
          <input id="participant-email" type="email" autoComplete="email" required value={email} disabled={busy || sent} onChange={event => setEmail(event.target.value)} />
          {sent && <><label htmlFor="participant-code">Doğrulama kodu</label><input id="participant-code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} /></>}
          <button type="submit" disabled={busy}>{busy ? 'Bekleyin…' : sent ? 'Doğrula ve devam et' : 'Kod gönder'}</button>
          {sent && <><button type="button" onClick={send} disabled={busy || cooldown > 0}>{cooldown > 0 ? `Tekrar gönder (${cooldown} sn)` : 'Tekrar gönder'}</button><button type="button" disabled={busy} onClick={() => { setSent(false); setCode(''); setError('') }}>E-postayı değiştir</button></>}
        </form>
      )}
      {!methods.includes('EMAIL_OTP') && !import.meta.env.VITE_GOOGLE_CLIENT_ID && <p role="alert">Google doğrulaması bu ortamda yapılandırılmamış.</p>}
      {methods.includes('GOOGLE') && <GoogleVerification onCredential={credential => perform(async () => onVerified({ ...await api('/participant-auth/google', { method: 'POST', body: { idToken: credential } }), formVersion: form.schemaVersion }))} onError={setError} />}
    </section>
  )
}

function GoogleVerification({ onCredential, onError }) {
  const container = useRef(null)
  const callbacks = useRef({ onCredential, onError })
  useEffect(() => { callbacks.current = { onCredential, onError } }, [onCredential, onError])
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return
    let active = true
    const initialize = () => {
      if (!active) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: result => callbacks.current.onCredential(result.credential) })
      window.google.accounts.id.renderButton(container.current, { theme: 'outline', size: 'large', text: 'continue_with' })
    }
    let script = document.querySelector('script[data-google-identity]')
    if (window.google?.accounts?.id) initialize()
    else {
      if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.dataset.googleIdentity = 'true'; script.async = true; document.head.append(script) }
      script.addEventListener('load', initialize)
    }
    const failed = () => callbacks.current.onError('Google doğrulaması yüklenemedi. Lütfen tekrar deneyin.')
    script?.addEventListener('error', failed)
    return () => { active = false; script?.removeEventListener('load', initialize); script?.removeEventListener('error', failed) }
  }, [])
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ? <div ref={container} /> : null
}
