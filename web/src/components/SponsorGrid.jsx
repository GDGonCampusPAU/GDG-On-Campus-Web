import './SponsorGrid.css'

function SponsorItem({ sponsor }) {
  const content = sponsor.logo ? (
    <img src={sponsor.logo} alt={sponsor.name} />
  ) : (
    <span>{sponsor.name}</span>
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
      {ordered.map((s) => (
        <li key={s.name}>
          <SponsorItem sponsor={s} />
        </li>
      ))}
    </ul>
  )
}
