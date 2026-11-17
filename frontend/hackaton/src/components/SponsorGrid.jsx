import { useState } from 'react'
import './SponsorGrid.css'

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
      <img className="sponsor__wing sponsor__wing--left" src="/wing-left.webp" alt="" />
      <img className="sponsor__wing sponsor__wing--right" src="/wing-right.webp" alt="" />
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
