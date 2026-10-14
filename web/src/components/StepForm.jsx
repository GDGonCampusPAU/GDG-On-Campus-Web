import { useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import {
  STEPS,
  initialValues,
  validateStep,
  normalize,
  YEAR_OPTIONS,
  ROLE_OPTIONS,
  INTEREST_OPTIONS,
  LEVEL_OPTIONS,
} from '../lib/registration.js'
import './StepForm.css'

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? ''

export default function StepForm({ onSubmit, onSuccess }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inFlight = useRef(false)
  const shownStep = useRef(0)
  const headingRef = useRef(null)
  const formRef = useRef(null)

  const step = STEPS[stepIndex]
  const isLast = stepIndex === STEPS.length - 1
  const looking = values.teamRole === 'looking'

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

  const toggleInterest = (value) =>
    setValues((v) => ({
      ...v,
      interests: v.interests.includes(value)
        ? v.interests.filter((i) => i !== value)
        : [...v.interests, value],
    }))

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

    const found = validateStep(step.id, values)
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
      result = await onSubmit(values)
    } catch {
      result = { ok: false }
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
    if (result?.ok) onSuccess()
    else setSubmitError(result?.error ?? 'Bir şeyler ters gitti. Tekrar dene.')
  }

  const summary = normalize(values)

  return (
    <form className="step-form" onSubmit={handleSubmit} noValidate ref={formRef}>
      <ol className="step-form__progress" aria-label="Kayıt adımları">
        {STEPS.map((s, i) => (
          <li
            key={s.id}
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

      {step.id === 'person' && (
        <>
          <Field id="fullName" label="Ad soyad" required error={errors.fullName}>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={values.fullName}
              onChange={set('fullName')}
              aria-invalid={errors.fullName ? 'true' : undefined}
              aria-describedby={describe('fullName')}
            />
          </Field>
          <Field id="email" label="E-posta" required error={errors.email}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={set('email')}
              aria-invalid={errors.email ? 'true' : undefined}
              aria-describedby={describe('email')}
            />
          </Field>
          <Field id="phone" label="Telefon" required error={errors.phone}>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={set('phone')}
              aria-invalid={errors.phone ? 'true' : undefined}
              aria-describedby={describe('phone')}
            />
          </Field>
          <Field id="department" label="Bölüm" required error={errors.department}>
            <input
              id="department"
              type="text"
              value={values.department}
              onChange={set('department')}
              aria-invalid={errors.department ? 'true' : undefined}
              aria-describedby={describe('department')}
            />
          </Field>
          <Field id="year" label="Sınıf" required error={errors.year}>
            <select
              id="year"
              value={values.year}
              onChange={set('year')}
              aria-invalid={errors.year ? 'true' : undefined}
              aria-describedby={describe('year')}
            >
              <option value="">Seç</option>
              {YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {step.id === 'team' && (
        <>
          <Field
            id="teamName"
            label="Takım adı"
            required={!looking}
            error={errors.teamName}
            hint={looking ? 'Takım arıyorsan boş bırakabilirsin.' : undefined}
          >
            <input
              id="teamName"
              type="text"
              value={values.teamName}
              onChange={set('teamName')}
              aria-invalid={errors.teamName ? 'true' : undefined}
              aria-describedby={describe('teamName', looking)}
            />
          </Field>
          <Field id="teamRole" label="Rol" required error={errors.teamRole}>
            <select
              id="teamRole"
              value={values.teamRole}
              onChange={set('teamRole')}
              aria-invalid={errors.teamRole ? 'true' : undefined}
              aria-describedby={describe('teamRole')}
            >
              <option value="">Seç</option>
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="teammates"
            label="Takım arkadaşları (isteğe bağlı)"
            hint="İsimleri virgülle ayırarak yazabilirsin."
          >
            <input
              id="teammates"
              type="text"
              value={values.teammates}
              onChange={set('teammates')}
              aria-describedby="teammates-hint"
            />
          </Field>
        </>
      )}

      {step.id === 'interest' && (
        <>
          <fieldset className="step-form__fieldset" aria-describedby={describe('interests')}>
            <legend>İlgi alanların</legend>
            {INTEREST_OPTIONS.map((o) => (
              <label key={o.value} className="step-form__check">
                <input
                  type="checkbox"
                  checked={values.interests.includes(o.value)}
                  onChange={() => toggleInterest(o.value)}
                  aria-invalid={errors.interests ? 'true' : undefined}
                />
                {o.label}
              </label>
            ))}
            <p className="field__error" id="interests-error" aria-live="polite">
              {errors.interests}
            </p>
          </fieldset>
          <Field id="level" label="Deneyim seviyesi" required error={errors.level}>
            <select
              id="level"
              value={values.level}
              onChange={set('level')}
              aria-invalid={errors.level ? 'true' : undefined}
              aria-describedby={describe('level')}
            >
              <option value="">Seç</option>
              {LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      {step.id === 'confirm' && (
        <>
          <dl className="step-form__summary">
            <dt>Ad soyad</dt>
            <dd>{summary.fullName}</dd>
            <dt>E-posta</dt>
            <dd>{summary.email}</dd>
            <dt>Telefon</dt>
            <dd>{summary.phone}</dd>
            <dt>Bölüm / Sınıf</dt>
            <dd>
              {summary.department} / {labelOf(YEAR_OPTIONS, summary.year)}
            </dd>
            <dt>Takım</dt>
            <dd>
              {summary.teamName
                ? `${summary.teamName} (${labelOf(ROLE_OPTIONS, summary.teamRole)})`
                : labelOf(ROLE_OPTIONS, summary.teamRole)}
            </dd>
            <dt>İlgi alanları</dt>
            <dd>{summary.interests.map((i) => labelOf(INTEREST_OPTIONS, i)).join(', ')}</dd>
            <dt>Seviye</dt>
            <dd>{labelOf(LEVEL_OPTIONS, summary.level)}</dd>
          </dl>
        </>
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
