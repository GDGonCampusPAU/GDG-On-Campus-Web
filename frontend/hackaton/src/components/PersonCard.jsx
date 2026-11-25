import { useEffect, useState } from 'react'
import './PersonCard.css'

export function initials(name) {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toLocaleUpperCase('tr-TR'))
    .join('')
  return letters || '?'
}

function BioContent({ bio }) {
  const blocks = (bio ?? '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  return (
    <div className="person-modal__bio">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
        const isBulletList = lines.length > 0 && lines.every((l) => l.startsWith('•'))
        if (isBulletList) {
          return (
            <ul key={i} className="person-modal__list">
              {lines.map((line, j) => (
                <li key={j}>{line.replace(/^•\s*/, '')}</li>
              ))}
            </ul>
          )
        }
        return <p key={i}>{block}</p>
      })}
    </div>
  )
}

export function PersonModal({ person, tone = 'blue', onClose }) {
  useEffect(() => {
    if (!person) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [person, onClose])

  if (!person) return null

  return (
    <div
      className="person-modal__backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`person-modal tone--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-modal-name"
      >
        <div className="person-modal__header">
          <div className="person__avatar person-modal__avatar">
            {person.photo ? (
              <img
                src={person.photo}
                alt={person.title ? `${person.name}, ${person.title}` : person.name}
                decoding="async"
              />
            ) : (
              <span aria-hidden="true">{initials(person.name)}</span>
            )}
          </div>
          <div className="person-modal__meta">
            <span className="person-modal__badge">Hakkında</span>
            <h2 id="person-modal-name" className="person-modal__name">
              {person.name}
            </h2>
            {person.title && <p className="person-modal__title">{person.title}</p>}
          </div>
          <button
            type="button"
            className="person-modal__close"
            aria-label="Kapat"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="person-modal__body">
          {person.bio?.trim() && <BioContent bio={person.bio} />}
          {person.url && (
            <div className="person-modal__actions">
              <a
                className="btn btn--primary person-modal__link"
                href={person.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Web Sitesini Ziyaret Et ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PersonCard({ person, tone = 'blue', onSelect }) {
  const [localOpen, setLocalOpen] = useState(false)
  const hasDetails = Boolean(person.bio?.trim() || person.url)

  const openDetails = () => {
    if (!hasDetails) return
    if (onSelect) onSelect(person, tone)
    else setLocalOpen(true)
  }

  return (
    <>
      <article
        className={`person tone--${tone}${hasDetails ? ' person--interactive' : ''}`}
        onClick={
          hasDetails
            ? (e) => {
                if (e.target instanceof Element && e.target.closest('button')) return
                openDetails()
              }
            : undefined
        }
      >
        <div className="person__avatar">
          {person.photo ? (
            <img
              src={person.photo}
              alt={person.title ? `${person.name}, ${person.title}` : person.name}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span aria-hidden="true">{initials(person.name)}</span>
          )}
        </div>
        <h3 className="person__name">{person.name}</h3>
        <p className="person__title">{person.title}</p>
        {hasDetails && (
          <button
            type="button"
            className="person__about-btn"
            aria-haspopup="dialog"
            onClick={openDetails}
          >
            Hakkında
          </button>
        )}
      </article>
      {!onSelect && localOpen && (
        <PersonModal person={person} tone={tone} onClose={() => setLocalOpen(false)} />
      )}
    </>
  )
}
