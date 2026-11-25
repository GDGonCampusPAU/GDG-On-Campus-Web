import { useCallback, useEffect, useState } from 'react'
import { getPresentation } from '../lib/eventApi.js'

export const PRESENTATION_POLL_MS = 15000

const STATE = { CLOSED: 'Sundu', VOTING: 'Şu an sunuyor', WAITING: 'Sırada' }

/**
 * "Başvurum" sayfasında sahnedeki sunum sırası. Yalnız Proje değerlendirme açıkken görünür; sekme açıkken
 * 15 saniyede bir ve sekmeye dönülünce hemen yenilenir. Kendi takımı işaretlenir, sırası ve önünde kaç
 * takım kaldığı yazar.
 * @param {{ teamName?: string | null, load?: () => Promise<any>, interval?: number }} props
 */
export default function PresentationCard({ teamName = null, load = getPresentation, interval = PRESENTATION_POLL_MS }) {
  const [data, setData] = useState(null)

  const refresh = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    try {
      setData(await load())
    } catch {
      /* Bağlantı koptuysa son bilinen sıra kalır; sonraki turda yeniden denenir. */
    }
  }, [load])

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, interval)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, interval])

  if (!data?.open || !data.order.length) return null

  const mine = teamName ? data.order.find((item) => item.name === teamName) : null
  const ahead = mine ? data.order.filter((item) => item.position < mine.position && item.state === 'WAITING').length : 0
  const myTurn = mine?.state === 'VOTING'

  return (
    <section className={`presentation${myTurn ? ' presentation--turn' : ''}`} aria-labelledby="presentation-title">
      <p className="presentation__tag">Proje değerlendirme</p>
      <h2 id="presentation-title" className="presentation__title">Sunum sırası</h2>
      <p className="presentation__now" aria-live="polite">
        {myTurn ? (
          <strong>🎤 Sıra sizde! Jüri şu an takımınızı değerlendiriyor.</strong>
        ) : data.current ? (
          <>Şu an sunuyor: <strong>{data.current.position}. {data.current.name}</strong></>
        ) : (
          'Sıradaki sunum birazdan başlayacak.'
        )}
      </p>
      {mine && !myTurn && (
        <p className="presentation__mine">
          {mine.state === 'CLOSED'
            ? 'Takımınız sunumunu yaptı. Teşekkürler!'
            : `Takımınızın sırası: ${mine.position}. ${ahead === 0 ? 'Sıradaki takım sizsiniz, hazır olun!' : `Önünüzde ${ahead} takım var.`}`}
        </p>
      )}
      <ol className="presentation__list">
        {data.order.map((item) => (
          <li
            key={item.position}
            className={`presentation__item presentation__item--${item.state.toLowerCase()}${item === mine ? ' presentation__item--mine' : ''}`}
            aria-current={item.state === 'VOTING' ? 'step' : undefined}
          >
            <span className="presentation__pos">{item.position}</span>
            <span className="presentation__name">
              {item.name}
              {item === mine && <span className="presentation__you">Sizin takımınız</span>}
            </span>
            <span className="presentation__state">{STATE[item.state]}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
