import { useEffect, useState } from 'react'
import './Countdown.css'

export function getTimeLeft(startsAt, now = Date.now()) {
  const target = new Date(startsAt).getTime()
  if (Number.isNaN(target)) return { status: 'invalid' }
  const diff = target - now
  if (diff <= 0) return { status: 'started' }
  const total = Math.floor(diff / 1000)
  return {
    status: 'counting',
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

const pad = (n) => String(n).padStart(2, '0')

const UNITS = [
  ['days', 'gün'],
  ['hours', 'saat'],
  ['minutes', 'dakika'],
  ['seconds', 'saniye'],
]

export default function Countdown({ startsAt }) {
  const [now, setNow] = useState(() => Date.now())
  const left = getTimeLeft(startsAt, now)

  useEffect(() => {
    if (left.status !== 'counting') return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [left.status])

  if (left.status === 'invalid') {
    return <p className="countdown countdown--text">Tarih yakında açıklanacak</p>
  }
  if (left.status === 'started') {
    return <p className="countdown countdown--text">Başladı!</p>
  }

  return (
    <div className="countdown" role="timer" aria-label="Etkinliğe kalan süre">
      {UNITS.map(([key, label]) => (
        <div className="countdown__unit" key={key}>
          <span className="countdown__value" data-testid={`countdown-${key}`}>
            {pad(left[key])}
          </span>
          <span className="countdown__label">{label}</span>
        </div>
      ))}
    </div>
  )
}
