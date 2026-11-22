import { useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'

const CONFIRMATION = 'SIFIRLA'

/**
 * Yalnız ADMIN'e gösterilir; sunucu da ayrıca denetler.
 * @param {{ count: number, onReset: (confirmation: string) => Promise<boolean> }} props
 */
export default function JuryResetPanel({ count, onReset }) {
  const [asking, setAsking] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const cancel = () => {
    setAsking(false)
    setText('')
  }
  const submit = async (event) => {
    event.preventDefault()
    if (busy || text !== CONFIRMATION) return
    setBusy(true)
    const done = await onReset(text)
    setBusy(false)
    if (done) cancel()
  }

  return (
    <section className="jury-admin__danger" aria-labelledby="reset-title">
      <h2 id="reset-title">Prova verisini temizle</h2>
      {!asking ? (
        <Button variant="danger" onClick={() => setAsking(true)}>Puan kartlarını sıfırla</Button>
      ) : (
        <form onSubmit={submit}>
          <p>
            <strong>{`${count} puan kartı kalıcı olarak silinecek. Geri alınamaz.`}</strong>
            {' Taslaklar, puanlar, gerekçeler ve adaylıklar gider. Takımlar, jüriler ve linkler kalır. Gerekiyorsa önce CSV indir.'}
          </p>
          <Field id="reset-confirm" label={`Onaylamak için ${CONFIRMATION} yaz`}>
            <input id="reset-confirm" type="text" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <div className="jury-admin__actions">
            <Button type="submit" variant="danger" disabled={busy || text !== CONFIRMATION}>{busy ? 'Siliniyor…' : 'Kalıcı olarak sil'}</Button>
            <Button variant="ghost" disabled={busy} onClick={cancel}>Vazgeç</Button>
          </div>
        </form>
      )}
    </section>
  )
}
