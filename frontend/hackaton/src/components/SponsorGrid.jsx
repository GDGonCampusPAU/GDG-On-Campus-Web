import { useState } from 'react'
import './SponsorGrid.css'

// Easter egg: the unrevealed sponsor sprouts wings on click; stops once it is renamed.
const WINGED_SPONSOR = 'Gizli Sponsor'

function SponsorItem({ sponsor }) {
  const [flying, setFlying] = useState(false)
  const fly = () => {
    // base.css kills animations under reduced motion, so animationend would never reset the state
    if (sponsor.name !== WINGED_SPONSOR || flying || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    setFlying(true)
  }
  const content = (
    <>
      <div className="sponsor__media">
        {sponsor.logo ? (
          <img src={sponsor.logo} alt={sponsor.name} loading="lazy" decoding="async" />
        ) : (
          <span className="sponsor__placeholder" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3z" />
            </svg>
          </span>
        )}
      </div>
      <span className="sponsor__name">{sponsor.name}</span>
      {flying && (
        <>
          <img className="sponsor__wing sponsor__wing--left" src="/wing-left.webp" alt="" />
          <img className="sponsor__wing sponsor__wing--right" src="/wing-right.webp" alt="" />
        </>
      )}
    </>
  )
  const props = {
    className: `sponsor sponsor--${sponsor.tier}${flying ? ' is-flying' : ''}`,
    onClick: fly,
    onAnimationEnd: (e) => e.target === e.currentTarget && setFlying(false),
  }
  if (sponsor.url) {
    return (
      <a {...props} href={sponsor.url} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }
  return <div {...props}>{content}</div>
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
