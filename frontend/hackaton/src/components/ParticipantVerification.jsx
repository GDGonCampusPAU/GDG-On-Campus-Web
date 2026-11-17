import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/eventApi.js'
import Button from './Button.jsx'
import './ParticipantVerification.css'
import { loadIdentity, saveIdentity } from '../lib/registrationCache.js'

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
  // Kayıtlar kapalıyken önceden başvuranlar "Başvurum" sayfasına yine bu doğrulamayla ulaşır.
  const [returning, setReturning] = useState(false)
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
      // Bu cihazda aynı e-posta son 30 dk içinde doğrulandıysa yeni kod istenmez.
      const cached = loadIdentity(email)
      if (cached) return onVerified({ ...cached, formVersion: form.schemaVersion, registration: form.registration })
      const result = await api('/participant-auth/email/send-otp', { method: 'POST', body: { email: email.trim() } })
      setSent(true); setCooldown(result.resendAfterSeconds)
    })
  }
  function verify(event) {
    event.preventDefault()
    return perform(async () => {
      const identity = await api('/participant-auth/email/verify', { method: 'POST', body: { email: email.trim(), code } })
      saveIdentity(identity)
      onVerified({ ...identity, formVersion: form.schemaVersion, registration: form.registration })
    })
  }
  if (!form) return (
    <section className="verify verify--loading">
      <p role={error ? 'alert' : 'status'} className={error ? 'verify__alert' : 'verify__status'}>{error || 'Başvuru formu yükleniyor…'}</p>
      {error && <Button variant="ghost" onClick={() => { setError(''); setRetry(value => value + 1) }}>Tekrar dene</Button>}
    </section>
  )
  const closed = form.registration?.open === false
  if (closed && !returning) return (
    <section className="verify verify--closed" aria-labelledby="verify-title">
      <Shapes />
      <p className="verify__eyebrow">Kayıtlar kapandı</p>
      <h2 id="verify-title" className="verify__title">Şu an kayıt alamıyoruz</h2>
      <p className="verify__closed-message">{form.registration.message}</p>
      <p className="verify__returning">
        Daha önce başvurdun mu?{' '}
        <button type="button" className="verify__link" onClick={() => setReturning(true)}>Başvuruma bak</button>
      </p>
    </section>
  )
  const methods = form.settings?.verificationMethods || []
  const hasEmail = methods.includes('EMAIL_OTP')
  const hasGoogle = methods.includes('GOOGLE') && Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)
  return (
    <section className="verify" aria-labelledby="verify-title">
      <Shapes />
      <p className="verify__eyebrow">{closed ? 'Başvurum' : 'Başvurudan önce'}</p>
      <h2 id="verify-title" className="verify__title">E-posta adresini doğrula</h2>
      <p className="verify__lead">{closed ? 'Başvurunu görmek için başvururken kullandığın e-posta adresini doğrula.' : 'Başvurmadan önce e-posta adresinin sana ait olduğunu doğrula.'}</p>
      {error && <p role="alert" className="verify__alert">{error}</p>}
      {hasGoogle && <GoogleVerification onCredential={credential => perform(async () => onVerified({ ...await api('/participant-auth/google', { method: 'POST', body: { idToken: credential } }), formVersion: form.schemaVersion, registration: form.registration }))} onError={setError} />}
      {hasGoogle && hasEmail && <p className="verify__divider"><span>veya e-posta ile</span></p>}
      {hasEmail && (
        <form className="verify__form" onSubmit={sent ? verify : send}>
          <div className="field">
            <label htmlFor="participant-email">Doğrulama e-postası</label>
            <input id="participant-email" type="email" autoComplete="email" placeholder="ornek@mail.com" required value={email} disabled={busy || sent} onChange={event => setEmail(event.target.value)} />
          </div>
          {sent && (
            <div className="field">
              <label htmlFor="participant-code">Doğrulama kodu</label>
              <input id="participant-code" className="verify__code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} placeholder="••••••" value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} />
              <p className="field__hint">6 haneli kodu <strong>{email.trim()}</strong> adresine gönderdik. Gelen kutunda yoksa spam klasörüne de bak.</p>
            </div>
          )}
          <Button type="submit" className="btn btn--primary verify__submit" disabled={busy}>{busy ? 'Bekleyin…' : sent ? 'Doğrula ve devam et' : 'Kod gönder'}</Button>
          {sent && (
            <div className="verify__secondary">
              <Button variant="ghost" size="sm" onClick={send} disabled={busy || cooldown > 0}>{cooldown > 0 ? `Tekrar gönder (${cooldown} sn)` : 'Tekrar gönder'}</Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setSent(false); setCode(''); setError('') }}>E-postayı değiştir</Button>
            </div>
          )}
        </form>
      )}
      {!hasEmail && !hasGoogle && <p role="alert" className="verify__alert">Google doğrulaması bu ortamda yapılandırılmamış.</p>}
    </section>
  )
}

function Shapes() {
  return (
    <div className="verify__shapes" aria-hidden="true">
      <i className="tone--blue" /><i className="tone--red" /><i className="tone--yellow" /><i className="tone--green" />
    </div>
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
    // GSI düğmesi sabit piksel genişlikte çizilir (en fazla 400px); alan daralınca/genişleyince
    // (telefon döndürme, pencere boyutu) yeniden çizilmezse kartın dışına taşar.
    let renderedWidth = 0
    let resizeTimer
    const render = () => {
      const element = container.current
      if (!active || !element) return
      const width = Math.min(400, Math.max(200, Math.floor(element.clientWidth || 320)))
      if (width === renderedWidth) return
      renderedWidth = width
      element.replaceChildren()
      window.google.accounts.id.renderButton(element, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width })
    }
    const observer = typeof ResizeObserver === 'undefined' ? null
      : new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150) })
    const initialize = () => {
      if (!active) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: result => callbacks.current.onCredential(result.credential) })
      render()
      if (container.current) observer?.observe(container.current)
    }
    /** @type {HTMLScriptElement | null} */
    let script = document.querySelector('script[data-google-identity]')
    if (window.google?.accounts?.id) initialize()
    else {
      if (!script) { script = document.createElement('script'); script.src = 'https://accounts.google.com/gsi/client'; script.dataset.googleIdentity = 'true'; script.async = true; document.head.append(script) }
      script.addEventListener('load', initialize)
    }
    const failed = () => callbacks.current.onError('Google doğrulaması yüklenemedi. Lütfen tekrar deneyin.')
    script?.addEventListener('error', failed)
    return () => { active = false; clearTimeout(resizeTimer); observer?.disconnect(); script?.removeEventListener('load', initialize); script?.removeEventListener('error', failed) }
  }, [])
  return import.meta.env.VITE_GOOGLE_CLIENT_ID ? <div className="verify__google" ref={container} /> : null
}
