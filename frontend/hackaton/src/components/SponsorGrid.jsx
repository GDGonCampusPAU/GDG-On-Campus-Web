import './SponsorGrid.css'

function SponsorItem({ sponsor }) {
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
    </>
  )
  const className = `sponsor sponsor--${sponsor.tier}`
  if (sponsor.url) {
    return (
      <a className={className} href={sponsor.url} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }
  return <div className={className}>{content}</div>
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
