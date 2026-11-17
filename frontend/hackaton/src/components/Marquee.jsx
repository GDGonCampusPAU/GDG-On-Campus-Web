import './Marquee.css'

const DOT_TONES = ['blue', 'red', 'yellow', 'green']

export default function Marquee({ items }) {
  if (!items || items.length === 0) return null

  const group = (copy) => (
    <ul className="marquee__group" key={copy}>
      {items.map((text, i) => (
        <li key={`${copy}-${text}-${i}`} className="marquee__item">
          <span className={`marquee__dot tone--${DOT_TONES[i % DOT_TONES.length]}`} />
          {text}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee__track">
        {['a', 'b', 'c', 'd'].map(group)}
      </div>
    </div>
  )
}
