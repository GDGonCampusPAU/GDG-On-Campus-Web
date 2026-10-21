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

export default function PersonCard({ person, tone = 'blue' }) {
  return (
    <article className={`person tone--${tone}`}>
      <div className="person__avatar">
        {person.photo ? (
          <img src={person.photo} alt="" />
        ) : (
          <span aria-hidden="true">{initials(person.name)}</span>
        )}
      </div>
      <h3 className="person__name">{person.name}</h3>
      <p className="person__title">{person.title}</p>
    </article>
  )
}
