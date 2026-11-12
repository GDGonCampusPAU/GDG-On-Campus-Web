import { useId, useState } from 'react'

/**
 * Etiketli form alanı. Şifre alanlarında "Göster/Gizle" düğmesi otomatik eklenir.
 * Hata ve ipucu metinleri aria-describedby ile alana bağlanır.
 */
/**
 * @param {object} props
 * @param {string} props.label
 * @param {string} props.name
 * @param {string} [props.type]
 * @param {string} props.value
 * @param {(event: any) => void} props.onChange
 * @param {string} [props.error]
 * @param {string} [props.hint]
 * @param {string} [props.autoComplete]
 * @param {boolean} [props.required]
 * @param {boolean} [props.disabled]
 * @param {string} [props.inputClassName]
 * @param {import('react').HTMLAttributes<HTMLInputElement>['inputMode']} [props.inputMode]
 * @param {number} [props.maxLength]
 */
export default function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  hint,
  autoComplete,
  required = false,
  disabled = false,
  inputClassName = '',
  ...rest
}) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'

  const describedBy =
    [error ? errorId : hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div
      className="field"
      data-invalid={error ? 'true' : undefined}
      data-has-toggle={isPassword ? 'true' : undefined}
    >
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={id}
          className={`field__input ${inputClassName}`.trim()}
          name={name}
          type={isPassword && visible ? 'text' : type}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-required={required || undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            className="field__toggle"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            disabled={disabled}
          >
            {visible ? 'Gizle' : 'Göster'}
          </button>
        )}
      </div>
      {error ? (
        <p id={errorId} className="field__error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
