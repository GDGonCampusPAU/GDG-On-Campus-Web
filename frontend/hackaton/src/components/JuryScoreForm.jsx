import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import { describeTeam } from '../lib/juryStore.js'
import { formatScore, missingOf, scoreOf, totalOf } from '../lib/juryForm.js'

const VALUES = [1, 2, 3, 4, 5]
const LINKS = [['repoUrl', 'Repo'], ['demoUrl', 'Demo'], ['presentationUrl', 'Sunum']]

function Criterion({ criterion, score, disabled, missing, onChange }) {
  const { key, label, description, weight } = criterion
  const id = `criterion-${key}`
  const [open, setOpen] = useState(Boolean(score.comment))
  return (
    <fieldset className={`jury__criterion${missing ? ' jury__criterion--missing' : ''}`} aria-describedby={`${id}-description ${id}-scale`}>
      <legend>
        {label} <span className="jury__weight">%{weight}</span>
      </legend>
      <p className="jury__description" id={`${id}-description`}>{description}</p>
      <div className="jury__scale">
        {VALUES.map((value) => (
          <label key={value} className="jury__score">
            <input type="radio" className="visually-hidden" name={id} value={value} disabled={disabled} checked={score.value === value} onChange={() => onChange({ value })} />
            <span>{value}</span>
          </label>
        ))}
      </div>
      <p className="jury__anchors" id={`${id}-scale`}>
        <span>1 = zayıf / yok</span> <span>3 = yeterli</span> <span>5 = olağanüstü</span>
      </p>
      <details className="jury__why" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Neden? (isteğe bağlı)</summary>
        <textarea aria-label={`${label}: neden?`} rows={3} maxLength={1000} readOnly={disabled} value={score.comment} onChange={(event) => onChange({ comment: event.target.value })} />
      </details>
    </fieldset>
  )
}

function saveLabel(team, { dirty, submitted, unsent, conflict }, locked) {
  if (team.submitting) return 'Gönderiliyor…'
  if (unsent) return 'Değişiklik gönderilmedi'
  if (submitted) return 'Gönderildi'
  if (conflict && !locked) return 'Kaydedilmedi, seçim bekliyor'
  if (locked) return dirty || team.server ? 'Gönderilmedi' : ''
  if (dirty && team.saveError && !team.saving) return team.stored ? 'Kaydedilemedi, bu cihazda saklandı' : 'Kaydedilemedi, sayfayı kapatma'
  if (dirty || team.saving) return 'Kaydediliyor…'
  return team.server ? 'Kaydedildi' : 'Henüz puan yok'
}

/**
 * @param {{ me: any, summary: any, team: import('../lib/juryStore.js').TeamState | undefined, store: any,
 *   previous?: any, next?: any, onOpen: (team: string | null) => void }} props
 */
export default function JuryScoreForm({ me, summary, team, store, previous, next, onOpen }) {
  const id = summary.team
  const [showMissing, setShowMissing] = useState(false)
  const heading = useRef(null)
  const missingAlert = useRef(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus({ preventScroll: true })
    void store.loadTeam(id)
  }, [store, id])

  const back = <Button variant="ghost" onClick={() => onOpen(null)}>← Takımlar</Button>
  const title = (
    <header className="jury__header">
      <p className="jury__eyebrow">{`Sunum ${summary.order}`}</p>
      <h1 ref={heading} tabIndex={-1}>{summary.projectName || summary.teamName}</h1>
      {summary.projectName && <p className="jury__sub">{summary.teamName}</p>}
    </header>
  )
  if (!team?.known) {
    return (
      <>
        {back}
        {title}
        <p className="jury__notice" role="status">Puan kartı yükleniyor. Bağlantı yoksa geldiğinde açılacak.</p>
      </>
    )
  }

  const { form, entry } = team
  const info = describeTeam(me.criteria, team)
  const { submitted, unsent, conflict } = info
  const disabled = me.locked || team.submitting
  const missing = missingOf(me.criteria, form)
  const links = LINKS.filter(([key]) => /^https?:\/\//i.test(entry?.[key] ?? ''))
  // Kilitliyken yalnız hesaba giren puan değil, jürinin cihazdaki hâli de okunabilir kalır.
  const status = saveLabel(team, info, me.locked)

  const changeScore = (key, changes) =>
    store.edit(id, (current) => ({ ...current, scores: { ...current.scores, [key]: { ...scoreOf(current, key), ...changes } } }))
  const toggle = (key) =>
    store.edit(id, (current) => ({
      ...current,
      nominations: current.nominations.includes(key) ? current.nominations.filter((item) => item !== key) : [...current.nominations, key],
    }))
  const submit = async () => {
    if (missing.length) {
      setShowMissing(true)
      // Uyarı bu render'dan sonra oluşur.
      requestAnimationFrame(() => missingAlert.current?.focus())
      return
    }
    setShowMissing(false)
    await store.submit(id)
  }

  return (
    <>
      {back}
      {title}
      {links.length > 0 ? (
        <ul className="jury__links">
          {links.map(([key, label]) => (
            <li key={key}>
              <a href={entry[key]} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
                {label} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        entry && <p className="jury__notice">Bu takımın bağlantısı eklenmemiş. Puanlamaya devam edebilirsin.</p>
      )}

      {conflict && !me.locked && (
        <div className="jury__warning" role="alert">
          <strong>Bu puan kartı başka bir sekmede veya cihazda değişti.</strong>
          <p>Hangisi geçerli olsun?</p>
          <div className="jury__choices">
            <Button variant="secondary" onClick={() => store.keepMine(id)}>Bu ekrandaki</Button>
            <Button variant="ghost" onClick={() => store.useServer(id)}>Sunucudaki</Button>
          </div>
        </div>
      )}

      {me.criteria.map((criterion) => (
        <Criterion
          key={criterion.key}
          criterion={criterion}
          score={scoreOf(form, criterion.key)}
          disabled={disabled}
          missing={showMissing && !scoreOf(form, criterion.key).value}
          onChange={(changes) => changeScore(criterion.key, changes)}
        />
      ))}

      {me.categories.length > 0 && (
        <fieldset className="jury__criterion">
          <legend>Ödül adaylığı</legend>
          <p className="jury__description">Yakıştırdığın ödüllere aday göster. Seçmek zorunda değilsin.</p>
          {me.categories.map(({ key, name, icon }) => (
            <label key={key} className="jury__nomination">
              <input type="checkbox" disabled={disabled} checked={form.nominations.includes(key)} onChange={() => toggle(key)} />
              <span aria-hidden="true">{icon}</span>
              <span>{name}</span>
            </label>
          ))}
        </fieldset>
      )}

      <Field id="jury-general" label="Genel yorum">
        <textarea id="jury-general" rows={4} maxLength={2000} readOnly={disabled} value={form.generalComment} onChange={(event) => store.edit(id, (current) => ({ ...current, generalComment: event.target.value }))} />
      </Field>

      {showMissing && missing.length > 0 && (
        <div className="jury__warning" role="alert" tabIndex={-1} ref={missingAlert}>
          <strong>Göndermeden önce şu kriterleri puanla:</strong>
          <ul className="jury__missing">
            {missing.map((criterion) => <li key={criterion.key}>{criterion.label}</li>)}
          </ul>
        </div>
      )}

      <nav className="jury__pager" aria-label="Takım geçişi">
        <Button variant="ghost" disabled={!previous} onClick={() => onOpen(previous.team)}>← Önceki</Button>
        <Button variant="ghost" disabled={!next} onClick={() => onOpen(next.team)}>Sonraki →</Button>
      </nav>

      <div className={`jury__bar${unsent ? ' jury__bar--unsent' : ''}`}>
        {/* Uyarı alt çubukta: sayfanın neresinde olunursa olunsun görünür. */}
        {unsent && (
          <div className="jury__unsent" role="alert">
            <strong>⚠️ Gönderilmemiş değişiklik var</strong>
            <span>
              {me.locked ? 'Puanlama kapandı, önce gönderdiğin puanlar geçerli.' : 'Hesapta önce gönderdiğin puanlar var.'}
            </span>
            {!me.locked && !conflict && !team.submitting && (
              <button type="button" className="jury__undo" onClick={() => store.useServer(id)}>Değişikliği geri al</button>
            )}
          </div>
        )}
        {team.submitError && !conflict && !me.locked && (!submitted || unsent) && (
          <p className="jury__submit-error" role="alert">{`Gönderilemedi: ${team.submitError}`}</p>
        )}
        <div className="jury__bar-row">
          <p className="jury__total">
            <strong>{`${formatScore(totalOf(me.criteria, form))} / 100`}</strong>
            <span role="status">{status}</span>
          </p>
          {!me.locked && (
            <Button variant={unsent ? 'secondary' : 'primary'} disabled={team.submitting || conflict || (submitted && !unsent)} onClick={submit}>
              {unsent ? 'Yeniden gönder' : submitted ? 'Gönderildi' : 'Puanları Gönder'}
            </Button>
          )}
        </div>
      </div>
    </>
  )
}
