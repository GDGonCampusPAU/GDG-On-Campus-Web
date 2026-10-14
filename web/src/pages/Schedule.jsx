import { useState } from 'react'
import Timeline from '../components/Timeline.jsx'
import { event } from '../data/event.js'
import './Schedule.css'

export default function Schedule({ data = event }) {
  const days = data.days ?? []
  const [active, setActive] = useState(0)

  return (
    <div className="schedule container">
      <h1 className="schedule__title">Program</h1>

      {days.length === 0 ? (
        <p>Program yakında açıklanacak.</p>
      ) : (
        <>
          <div className="schedule__tabs" role="tablist" aria-label="Günler">
            {days.map((day, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                id={`tab-${i}`}
                aria-selected={i === active}
                aria-controls={`day-${i}`}
                className="schedule__tab"
                onClick={() => setActive(i)}
              >
                {day.label}
              </button>
            ))}
          </div>

          {days.map((day, i) => (
            <section
              key={i}
              id={`day-${i}`}
              role="tabpanel"
              aria-labelledby={`tab-${i}`}
              className={`schedule__day${i === active ? ' is-active' : ''}`}
            >
              <h2 className="schedule__day-title">
                {day.label} <span>{day.date}</span>
              </h2>
              <Timeline items={day.items} />
            </section>
          ))}
        </>
      )}
    </div>
  )
}
