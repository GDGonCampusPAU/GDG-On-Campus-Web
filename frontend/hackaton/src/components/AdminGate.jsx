import { useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import { loginEditor } from '../lib/eventApi.js'

/**
 * Yönetim sayfalarının ortak giriş formu.
 * @param {{ onUnlock: (session: { token: string, user: any }) => void, title?: string, notice?: string }} props
 */
export default function AdminGate({ onUnlock, title = 'İçerik paneli', notice = '' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { onUnlock(await loginEditor(email.trim(), password)) }
    catch (error) { setPassword(''); setError(error.message) }
    finally { setBusy(false) }
  }
  return (
    <form className="admin__gate" onSubmit={submit}>
      <h1>{title}</h1>
      <p>Core Team yönetim hesabınla giriş yap.</p>
      {notice && <p className="admin__banner">{notice}</p>}
      <Field id="editor-email" label="E-posta"><input id="editor-email" type="email" autoComplete="username" required value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></Field>
      <Field id="password" label="Şifre"><input id="password" type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></Field>
      {error && <p role="alert" className="admin__status">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Bekleyin…' : 'Giriş'}</Button>
    </form>
  )
}
