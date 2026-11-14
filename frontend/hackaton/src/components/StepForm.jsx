import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import Field, { Hint } from './Field.jsx'
import { initialValues, validateStep, normalize } from '../lib/registration.js'
import './StepForm.css'

const CONFIRM = { title: 'Onay', fields: [] }

const shownValue = (f, v) => {
  const label = (x) => f.options?.find((o) => o.value === x)?.label ?? x
  if (f.kind === 'checkbox') return Array.isArray(v) ? v.map(label).join(', ') : ''
  if (f.kind === 'file') return v?.name || (typeof v === 'string' ? v : '—')
  return (f.kind === 'select' || f.kind === 'radio') ? label(v) : v
}

export default function StepForm({ steps: configured, onSubmit, onSuccess, initialData = {}, lockedFields = [] }) {
  const steps = [...configured, CONFIRM]
  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState(() => ({ ...initialValues(configured), ...initialData }))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlight = useRef(false)
  const shownStep = useRef(0)
  const headingRef = useRef(null)
  const formRef = useRef(null)

  const step = steps[stepIndex]
  const isLast = stepIndex === steps.length - 1

  useEffect(() => {
    // Compare instead of flagging the first run: StrictMode re-runs the mount effect.
    if (shownStep.current === stepIndex) return
    shownStep.current = stepIndex
    headingRef.current?.focus()
  }, [stepIndex])

  useEffect(() => {
    if (Object.keys(errors).length === 0) return
    formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [errors])

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }))

  const toggle = (name, value) =>
    setValues((v) => {
      const current = Array.isArray(v[name]) ? v[name] : []
      return {
        ...v,
        [name]: current.includes(value) ? current.filter((x) => x !== value) : [...current, value],
      }
    })

  const summary = normalize(configured, values)

  const describe = (name, withHint = false) => {
    const ids = [errors[name] ? `${name}-error` : null, withHint ? `${name}-hint` : null]
    return ids.filter(Boolean).join(' ') || undefined
  }

  const back = () => {
    setErrors({})
    setSubmitError('')
    setStepIndex((i) => i - 1)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (inFlight.current) return

    const found = validateStep(step, values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    if (!isLast) {
      setStepIndex((i) => i + 1)
      return
    }

    const allErrors = configured.reduce((acc, s) => ({ ...acc, ...validateStep(s, values) }), {})
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors)
      const firstInvalid = configured.findIndex((s) => Object.keys(validateStep(s, values)).length > 0)
      if (firstInvalid !== -1) setStepIndex(firstInvalid)
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setSubmitError('')
    let result
    try {
      result = await onSubmit(summary)
    } catch {
      result = { ok: false }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
    if (result?.ok) onSuccess()
    else setSubmitError(result?.error ?? 'Bir şeyler ters gitti. Tekrar dene.')
  }

  return (
    <form className="step-form" onSubmit={handleSubmit} noValidate ref={formRef}>
      <ol className="step-form__progress" aria-label="Kayıt adımları">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`step-form__dot${i === stepIndex ? ' is-current' : ''}${i < stepIndex ? ' is-done' : ''}`}
            aria-current={i === stepIndex ? 'step' : undefined}
          >
            <span className="step-form__num">{i + 1}</span>
            <span className="step-form__name">{s.title}</span>
          </li>
        ))}
      </ol>

      <h2 className="step-form__title" tabIndex={-1} ref={headingRef}>
        {step.title}
      </h2>

      {step === CONFIRM ? (
        <div className="step-form__summary">
          {configured.map((s, i) => (
            <section key={s.id ?? i} className="step-form__summary-group" aria-labelledby={`summary-${i}`}>
              <div className="step-form__summary-head">
                <h3 id={`summary-${i}`}>{s.title}</h3>
                <button
                  type="button"
                  className="step-form__edit"
                  aria-label={`${s.title} adımını düzenle`}
                  onClick={() => setStepIndex(i)}
                >
                  Düzenle
                </button>
              </div>
              <dl>
                {s.fields.map((f) => (
                  <div key={f.id} className="step-form__summary-row">
                    <dt>{f.label}</dt>
                    <dd>{shownValue(f, summary[f.id]) || '—'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        step.fields.map((f) => {
          const required = f.required === 'yes'
          const aria = {
            'aria-invalid': errors[f.id] ? /** @type {const} */ ('true') : undefined,
            'aria-describedby': describe(f.id, Boolean(f.hint)),
          }
          if (f.kind === 'checkbox')
            return (
              <fieldset className="step-form__fieldset" key={f.id} aria-describedby={aria['aria-describedby']}>
                <legend>{f.label}</legend>
                {f.options.map((o) => (
                  <label key={o.value} className="step-form__check">
                    <input
                      type="checkbox"
                      checked={Array.isArray(values[f.id]) && values[f.id].includes(o.value)}
                      onChange={() => toggle(f.id, o.value)}
                      aria-invalid={aria['aria-invalid']}
                    />
                    {o.label}
                  </label>
                ))}
                {f.hint && <Hint id={f.id} text={f.hint} />}
                <p className="field__error" id={`${f.id}-error`} aria-live="polite">
                  {errors[f.id]}
                </p>
              </fieldset>
            )
          if (f.kind === 'radio')
            return (
              <fieldset className="step-form__fieldset" key={f.id} aria-describedby={aria['aria-describedby']}>
                <legend>{f.label}</legend>
                {f.options.map((o) => (
                  <label key={o.value} className="step-form__check">
                    <input
                      type="radio"
                      name={f.id}
                      value={o.value}
                      checked={values[f.id] === o.value}
                      onChange={() => setValues((v) => ({ ...v, [f.id]: o.value }))}
                      aria-invalid={aria['aria-invalid']}
                    />
                    {o.label}
                  </label>
                ))}
                {f.hint && <Hint id={f.id} text={f.hint} />}
                <p className="field__error" id={`${f.id}-error`} aria-live="polite">
                  {errors[f.id]}
                </p>
              </fieldset>
            )
          if (f.kind === 'file')
            return (
              <Field key={f.id} id={f.id} label={f.label} required={required} error={errors[f.id]} hint={f.hint || undefined}>
                <input
                  id={f.id}
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setValues((v) => ({ ...v, [f.id]: file }))
                  }}
                  {...aria}
                />
              </Field>
            )
          return (
            <Field key={f.id} id={f.id} label={f.label} required={required} error={errors[f.id]} hint={f.hint || undefined}>
              {f.kind === 'select' ? (
                <select id={f.id} value={values[f.id]} onChange={set(f.id)} {...aria}>
                  <option value="">Seç</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.kind === 'textarea' ? (
                <textarea id={f.id} rows={3} value={values[f.id]} onChange={set(f.id)} {...aria} />
              ) : (
                <input id={f.id} type={f.kind} value={values[f.id]} onChange={set(f.id)} readOnly={lockedFields.includes(f.id)} {...aria} />
              )}
            </Field>
          )
        })
      )}

      {submitError && (
        <p className="step-form__submit-error" role="alert">
          {submitError}
        </p>
      )}

      <div className="step-form__actions">
        {stepIndex > 0 && (
          <Button variant="ghost" onClick={back} disabled={submitting}>
            Geri
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {!isLast ? 'İleri' : submitError ? 'Tekrar dene' : submitting ? 'Gönderiliyor…' : 'Gönder'}
        </Button>
      </div>
    </form>
  )
}
