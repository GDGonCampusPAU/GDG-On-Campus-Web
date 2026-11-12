import './Field.css'
import HintText from './HintText.jsx'

/**
 * @param {object} props
 * @param {string} props.id
 * @param {string} props.label
 * @param {string} [props.error]
 * @param {string} [props.hint]
 * @param {boolean} [props.required]
 * @param {import('react').ReactNode} props.children
 */
export default function Field({ id, label, error, hint, required = false, children }) {
  return (
    <div className={`field${required ? ' field--required' : ''}${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          <HintText text={hint} />
        </p>
      )}
      <p className="field__error" id={`${id}-error`} aria-live="polite">
        {error}
      </p>
    </div>
  )
}
