import { useRef, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'

const seenFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })

function IssuedLink({ name, url }) {
  const input = useRef(null)
  const [result, setResult] = useState('')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setResult('Kopyalandı.')
    } catch {
      input.current?.select()
      setResult('Kopyalanamadı. Seçili linki elle kopyala.')
    }
  }
  return (
    <li className="jury-admin__link">
      <label>
        <span>{`${name} linki`}</span>
        <input ref={input} type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
      </label>
      <Button variant="secondary" aria-label={`${name} linkini kopyala`} onClick={copy}>Kopyala</Button>
      <span role="status">{result}</span>
    </li>
  )
}

/**
 * @param {{ jurors: any[] | null, links: { id: string, name: string, url: string }[], client: any,
 *   onIssued: (result: { juror: any, token: string }) => void, onChanged: () => void, onError: (error: any) => void }} props
 */
export default function JuryAdminJurors({ jurors, links, client, onIssued, onChanged, onError }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)

  const run = async (action) => {
    setBusy(true)
    try {
      await action()
      onChanged()
    } catch (error) {
      onError(error)
    } finally {
      setBusy(false)
    }
  }
  const create = (event) => {
    event.preventDefault()
    if (busy || !name.trim()) return
    void run(async () => {
      onIssued(await client.createJuror(name.trim()))
      setName('')
    })
  }
  const regenerate = (juror) => {
    if (!window.confirm(`${juror.name} için yeni link oluşturulsun mu? Eski link hemen geçersiz olur.`)) return
    void run(async () => onIssued(await client.regenerate(juror.id)))
  }
  const toggle = (juror) => {
    if (juror.active && !window.confirm(`${juror.name} pasifleştirilsin mi? Linki çalışmaz, gönderdiği puanlar sonuçlarda kalır.`)) return
    void run(() => client.updateJuror(juror.id, { active: !juror.active }))
  }
  const rename = (event) => {
    event.preventDefault()
    if (!editing.name.trim()) return
    void run(async () => {
      await client.updateJuror(editing.id, { name: editing.name.trim() })
      setEditing(null)
    })
  }

  return (
    <section aria-labelledby="jurors-title">
      <h2 id="jurors-title">Jüriler</h2>
      <form className="jury-admin__actions jury-admin__add" onSubmit={create}>
        <Field id="juror-name" label="Jüri adı">
          <input id="juror-name" type="text" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" variant="secondary" disabled={busy || !name.trim()}>Jüri ekle</Button>
      </form>

      {links.length > 0 && (
        <div className="jury-admin__issued">
          <p>
            <strong>Linkler yalnızca bir kez gösterilir.</strong> Şimdi kopyala. Sayfadan ayrılınca bir daha görünmez, ancak yenisi oluşturulabilir.
          </p>
          <ul>{links.map((link) => <IssuedLink key={link.url} name={link.name} url={link.url} />)}</ul>
        </div>
      )}

      {jurors === null && <p>Yükleniyor…</p>}
      {jurors?.length === 0 && <p>Henüz jüri yok.</p>}
      <ul>
        {jurors?.map((juror) => (
          <li key={juror.id} className={`jury-admin__card jury-admin__actions${juror.active ? '' : ' jury-admin__card--inactive'}`}>
            {editing?.id === juror.id ? (
              <form className="jury-admin__actions jury-admin__rename" onSubmit={rename}>
                <input type="text" aria-label={`${juror.name} yeni ad`} maxLength={80} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                <Button type="submit" size="sm" disabled={busy}>Kaydet</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Vazgeç</Button>
              </form>
            ) : (
              <div className="jury-admin__juror">
                <h3>{juror.name}{!juror.active && ' (pasif)'}</h3>
                <p>
                  {`${juror.submittedCount} / ${juror.entryCount} takım puanlandı`}
                  {juror.draftCount > 0 && `, ${juror.draftCount} taslak`}
                  {' · '}
                  {juror.lastSeenAt ? `son görülme ${seenFormat.format(new Date(juror.lastSeenAt))}` : 'linki henüz açmadı'}
                </p>
              </div>
            )}
            <Button variant="ghost" size="sm" disabled={busy} aria-label={`${juror.name} adını değiştir`} onClick={() => setEditing({ id: juror.id, name: juror.name })}>
              Adı değiştir
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} aria-label={`${juror.name} linkini yenile`} onClick={() => regenerate(juror)}>
              Linki yenile
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} aria-label={`${juror.name} ${juror.active ? 'pasifleştir' : 'aktifleştir'}`} onClick={() => toggle(juror)}>
              {juror.active ? 'Pasifleştir' : 'Aktifleştir'}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
