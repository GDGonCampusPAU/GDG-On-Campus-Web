import './Field.css'

// Hints may carry Markdown links, e.g. the KVKK notice: [KVKK Aydınlatma Metni](https://...). Only https and same-site paths become links.
const link = /\[([^\]]+)\]\((https:\/\/[^\s)]+|\/(?![/\\])[^\s)]*)\)/g

export function Hint({ id, text }) {
  const parts = String(text).split(link)
  return (
    <p className="field__hint" id={`${id}-hint`}>
      {parts.map((part, i) =>
        i % 3 === 1 ? <a key={i} href={parts[i + 1]} target="_blank" rel="noopener noreferrer">{part}</a> : i % 3 === 0 ? part : null,
      )}
    </p>
  )
}

export default function Field({ id, label, error, hint, required = false, children }) {
  return (
    <div className={`field${required ? ' field--required' : ''}${error ? ' field--invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <Hint id={id} text={hint} />}
      <p className="field__error" id={`${id}-error`} aria-live="polite">
        {error}
      </p>
    </div>
  )
}
