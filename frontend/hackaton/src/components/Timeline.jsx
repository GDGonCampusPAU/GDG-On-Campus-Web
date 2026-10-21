import { typeLabels } from '../data/event.js'
import './Timeline.css'

const typeTones = {
  opening: 'blue',
  workshop: 'green',
  coding: 'yellow',
  submission: 'red',
  jury: 'blue',
  awards: 'yellow',
}

export default function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((item, i) => (
        <li
          key={i}
          className={`timeline__item tone--${typeTones[item.type] ?? 'blue'}`}
        >
          <time className="timeline__time">{item.time}</time>
          <div className="timeline__body">
            <span className="timeline__tag">{typeLabels[item.type] ?? item.type}</span>
            <h3 className="timeline__title">{item.title}</h3>
            <p>{item.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
