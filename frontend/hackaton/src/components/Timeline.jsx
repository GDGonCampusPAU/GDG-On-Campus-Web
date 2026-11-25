import { typeLabels } from '../data/event.js'
import './Timeline.css'

const typeTones = {
  opening: 'blue',
  workshop: 'green',
  coding: 'yellow',
  challenge: 'red',
  lunch: 'yellow',
  submission: 'green',
  jury: 'blue',
  awards: 'yellow',
}

export default function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((item, i) => {
        const description = item.description?.trim()
        return (
          <li
            key={i}
            className={`timeline__item tone--${typeTones[item.type] ?? 'blue'}`}
          >
            <time className="timeline__time">{item.time}</time>
            <div className="timeline__body">
              <span className="timeline__tag">{typeLabels[item.type] ?? item.type}</span>
              <h3 className="timeline__title">{item.title}</h3>
              {description && <p>{description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
