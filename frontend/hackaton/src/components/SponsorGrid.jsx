import { useState } from 'react'
import './SponsorGrid.css'

const WING = (
  <svg viewBox="0 0 72 64">
    <path d="M2 36 C12 18 36 6 70 9 C74 21 66 26 60 27 C62 37 54 41 46 41 C46 50 38 53 30 51 C28 58 18 58 12 52 C6 49 3 43 2 36 Z" />
    <path fill="none" d="M60 27 C44 26 26 29 10 38 M46 41 C34 40 22 41 12 45 M30 51 C24 49 18 48 12 48" />
  </svg>
)

function SponsorItem({ sponsor }) {
  const [flying, setFlying] = useState(false)
  const fly = () => {
    // base.css kills animations under reduced motion, so animationend would never reset the state
    if (sponsor.tier !== 'main' || flying || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setFlying(true)
  }
  const content = sponsor.logo ? (
    <img src={sponsor.logo} alt={sponsor.name} loading="lazy" decoding="async" />
  ) : (
    <span>{sponsor.name}</span>
  )
  const props = {
    className: `sponsor sponsor--${sponsor.tier}${flying ? ' is-flying' : ''}`,
    onClick: fly,
    onAnimationEnd: (e) => e.target === e.currentTarget && setFlying(false),
  }
  const wings = flying && (
    <>
      <span className="sponsor__wing sponsor__wing--left" aria-hidden="true">
        {WING}
      </span>
      <span className="sponsor__wing sponsor__wing--right" aria-hidden="true">
        {WING}
      </span>
    </>
  )
  if (sponsor.url) {
    return (
      <a {...props} href={sponsor.url} target="_blank" rel="noopener noreferrer">
        {content}
        {wings}
      </a>
    )
  }
  return (
    <div {...props}>
      {content}
      {wings}
    </div>
  )
}

export default function SponsorGrid({ sponsors, compact = false }) {
  if (!sponsors || sponsors.length === 0) return null
  const ordered = [...sponsors].sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'main' ? -1 : 1))
  return (
    <ul className={`sponsor-grid${compact ? ' sponsor-grid--compact' : ''}`}>
      {ordered.map((s, i) => (
        <li key={i}>
          <SponsorItem sponsor={s} />
        </li>
      ))}
    </ul>
  )
}
