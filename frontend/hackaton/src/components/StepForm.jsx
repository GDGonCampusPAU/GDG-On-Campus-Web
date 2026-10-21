import { Fragment, useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import { initialValues, validateStep, normalize, fieldsOf } from '../lib/registration.js'
import './StepForm.css'

const CONFIRM = { title: 'Onay', fields: [] }

const shownValue = (f, v) => {
  const label = (x) => f.options.find((o) => o.value === x)?.label ?? x
  if (f.kind === 'checkbox') return v.map(label).join(', ')
  return f.kind === 'select' ? label(v) : v
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
    setValues((v) => ({
      ...v,
      [name]: v[name].includes(value) ? v[name].filter((x) => x !== value) : [...v[name], value],
    }))

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
        <dl className="step-form__summary">
          {fieldsOf(configured).map((f) => (
            <Fragment key={f.id}>
              <dt>{f.label}</dt>
              <dd>{shownValue(f, summary[f.id]) || '—'}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        step.fields.map((f) => {
          const required = f.required === 'yes'
          const aria = {
            'aria-invalid': errors[f.id] ? 'true' : undefined,
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
                      checked={values[f.id].includes(o.value)}
                      onChange={() => toggle(f.id, o.value)}
                      aria-invalid={aria['aria-invalid']}
                    />
                    {o.label}
                  </label>
                ))}
                {f.hint && <p className="field__hint" id={`${f.id}-hint`}>{f.hint}</p>}
                <p className="field__error" id={`${f.id}-error`} aria-live="polite">
                  {errors[f.id]}
                </p>
              </fieldset>
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
