import { useEffect, useState } from 'react'
import Field, { Hint } from './Field.jsx'
import { TEAM_CODE_RE, normalizeTeamCode } from '../lib/registration.js'
import './TeamField.css'

// Üst seçimin metinleri alanın options'ından gelir (admin düzenleyebilir); yoksa bunlar kullanılır.
const DEFAULT_LABELS = { solo: 'Bireysel katılacağım', team: 'Takımla katılacağım' }
const isTeamMode = (mode) => mode === 'team' || mode === 'create' || mode === 'join'

/**
 * Kayıt formundaki `team` alanı: bireysel / takımla → takım oluştur (ad) veya takıma katıl (6 karakterlik kod).
 * @param {object} props
 * @param {{ id: string, label: string, required: string, hint?: string, options?: { value: string, label: string }[] }} props.field
 * @param {{ mode: string, name?: string, code?: string }} props.value
 * @param {(value: { mode: string, name?: string, code?: string }) => void} props.onChange
 * @param {string} [props.error]
 * @param {(code: string) => Promise<{ name: string, size: number, maxSize: number, full: boolean }>} [props.lookupTeam]
 */
export default function TeamField({ field, value, onChange, error, lookupTeam }) {
  const id = field.id
  const mode = value?.mode ?? ''
  const labelOf = (key) => field.options?.find((o) => o.value === key)?.label || DEFAULT_LABELS[key]
  const invalid = error ? 'true' : undefined
  const describedBy = [error ? `${id}-error` : null, field.hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined

  return (
    <fieldset className={`step-form__fieldset team-field${field.required === 'yes' ? ' team-field--required' : ''}`} aria-describedby={describedBy}>
      <legend>{field.label}</legend>
      {['solo', 'team'].map((key) => (
        <label key={key} className="step-form__check">
          <input
            type="radio"
            name={`${id}-participation`}
            checked={key === 'solo' ? mode === 'solo' : isTeamMode(mode)}
            onChange={() => onChange(key === 'solo' ? { mode: 'solo' } : { mode: 'team' })}
            aria-invalid={!mode ? invalid : undefined}
          />
          {labelOf(key)}
        </label>
      ))}

      {isTeamMode(mode) && (
        <div className="team-field__panel">
          <fieldset className="team-field__choice">
            <legend>Takımın için ne yapmak istersin?</legend>
            <label className="step-form__check">
              <input
                type="radio"
                name={`${id}-action`}
                checked={mode === 'create'}
                onChange={() => onChange({ mode: 'create', name: value?.name ?? '' })}
                aria-invalid={mode === 'team' ? invalid : undefined}
              />
              Takım oluştur
            </label>
            <label className="step-form__check">
              <input
                type="radio"
                name={`${id}-action`}
                checked={mode === 'join'}
                onChange={() => onChange({ mode: 'join', code: value?.code ?? '' })}
                aria-invalid={mode === 'team' ? invalid : undefined}
              />
              Takıma katıl
            </label>
          </fieldset>

          {mode === 'create' && (
            <Field id={`${id}-name`} label="Takım adı" required hint="Takımı kuran kişi kaptan olur. Kayıttan sonra takım kodunu arkadaşlarınla paylaşırsın.">
              <input
                id={`${id}-name`}
                type="text"
                maxLength={40}
                autoComplete="off"
                value={value.name ?? ''}
                onChange={(e) => onChange({ mode: 'create', name: e.target.value })}
                aria-invalid={invalid}
                aria-describedby={[error ? `${id}-error` : null, `${id}-name-hint`].filter(Boolean).join(' ')}
              />
            </Field>
          )}

          {mode === 'join' && (
            <>
              <Field id={`${id}-code`} label="Takım kodu" required hint="Kaptanından aldığın 6 karakterlik kodu yaz.">
                <input
                  id={`${id}-code`}
                  className="team-field__code"
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={6}
                  placeholder="ABC123"
                  value={value.code ?? ''}
                  onChange={(e) => onChange({ mode: 'join', code: normalizeTeamCode(e.target.value) })}
                  aria-invalid={invalid}
                  aria-describedby={[error ? `${id}-error` : null, `${id}-code-hint`, `${id}-lookup`].filter(Boolean).join(' ')}
                />
              </Field>
              <TeamLookup id={`${id}-lookup`} code={value.code ?? ''} lookupTeam={lookupTeam} />
            </>
          )}
        </div>
      )}

      {field.hint && <Hint id={id} text={field.hint} />}
      <p className="field__error" id={`${id}-error`} aria-live="polite">
        {error}
      </p>
    </fieldset>
  )
}

/** Kod tamamlanınca takımı önizler; asıl kontrol başvuru gönderilirken sunucuda yapılır. */
function TeamLookup({ id, code, lookupTeam }) {
  const [result, setResult] = useState(/** @type {{ code: string, state: 'found' | 'missing' | 'error', team?: any } | null} */ (null))
  const ready = Boolean(lookupTeam) && TEAM_CODE_RE.test(code)

  useEffect(() => {
    if (!ready) return undefined
    let active = true
    lookupTeam(code)
      .then((team) => active && setResult({ code, state: 'found', team }))
      .catch((error) => active && setResult({ code, state: error?.status === 404 ? 'missing' : 'error' }))
    return () => { active = false }
  }, [code, ready, lookupTeam])

  const current = ready && result?.code === code ? result : null
  let text = ''
  let tone = ''
  if (ready && !current) text = 'Takım aranıyor…'
  else if (current?.state === 'found' && current.team.full) [text, tone] = [`${current.team.name} takımı dolu (${current.team.size}/${current.team.maxSize} kişi).`, 'bad']
  else if (current?.state === 'found') [text, tone] = [`${current.team.name} takımına katılma isteği göndereceksin (${current.team.size}/${current.team.maxSize} kişi).`, 'ok']
  else if (current?.state === 'missing') [text, tone] = ['Bu kodla bir takım bulunamadı. Kodu kaptanından kontrol et.', 'bad']
  else if (current?.state === 'error') text = 'Takım şu an kontrol edilemedi; kod başvuru gönderilirken yeniden denetlenecek.'

  return (
    <p id={id} className={`team-field__lookup${tone ? ` team-field__lookup--${tone}` : ''}`} aria-live="polite">
      {text}
    </p>
  )
}
