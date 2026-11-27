import { useCallback, useEffect, useRef, useState } from 'react'
import Button from './Button.jsx'

export const VOTE_POLL_MS = 4000
export const IDLE_POLL_MS = 15000

const NOT_ELIGIBLE = {
  NO_TEAM: 'Katılımcı oylamasına yalnız yarışan takımların üyeleri katılabilir. Bir takımda olmadığın için oy veremezsin.',
  PENDING: 'Takım kaptanın katılma isteğini henüz onaylamadı. Onaylayınca diğer takımlara oy verebilirsin.',
  NOT_COMPETING: 'Takımın yarışan takımlar listesinde değil, bu yüzden oy veremezsin. Bir yanlışlık olduğunu düşünüyorsan organizasyon ekibine haber ver.',
}

/**
 * Katılımcı oylaması ("Başvurum"). Sahnedeki takımın oylaması açıkken, yarışan diğer takımların üyeleri
 * jüriyle aynı kriterlerle 1-5 puan verir. Anonim, takım başına bir kez, kendi takımına değil.
 * Değerlendirme açıkken 4 sn'de bir sorar; bir dakikalık oylama penceresi beklemeyle geçmesin.
 * @param {{ load: () => Promise<any>, cast: (team: string, scores: Record<string, number>) => Promise<any>, onExpired: () => void,
 *   interval?: number, idleInterval?: number }} props
 */
export default function VoteCard({ load, cast, onExpired, interval = VOTE_POLL_MS, idleInterval = IDLE_POLL_MS }) {
  const [state, setState] = useState(/** @type {any} */ (null))
  const [scores, setScores] = useState(/** @type {Record<string, number>} */ ({}))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const team = useRef('')

  const refresh = useCallback(async () => {
    if (document.visibilityState !== 'visible') return
    try {
      const next = await load()
      // Yeni takımın oylaması açıldı: önceki seçimler ve mesajlar temizlenir.
      if ((next.current?.team ?? '') !== team.current) {
        team.current = next.current?.team ?? ''
        setScores({})
        setError('')
        setDone('')
      }
      setState(next)
    } catch (e) {
      if (e?.status === 401) onExpired()
    }
  }, [load, onExpired])

  const open = Boolean(state?.open)
  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, open ? interval : idleInterval)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, open, interval, idleInterval])

  if (!state?.open) return null
  const { current, criteria, reason } = state

  // Oy hakkı yoksa kart kaybolmaz: kişi nedenini görür (yoksa "oy veremiyorum" diye kalır).
  if (!state.eligible) {
    return (
      <section className="vote vote--idle" aria-live="polite">
        <p className="vote__tag">Katılımcı oylaması</p>
        <p>{NOT_ELIGIBLE[state.notEligible] ?? NOT_ELIGIBLE.NOT_COMPETING}</p>
      </section>
    )
  }
  if (reason === 'LOCKED') {
    return (
      <section className="vote vote--idle" aria-live="polite">
        <p className="vote__tag">Katılımcı oylaması</p>
        <p>Oylama kapandı.</p>
      </section>
    )
  }

  if (!current || reason === 'NO_VOTING') {
    return (
      <section className="vote vote--idle" aria-live="polite">
        <p className="vote__tag">Katılımcı oylaması</p>
        <p>Bir takımın sunumu bitip oylaması açılınca burada oy verebileceksin.</p>
      </section>
    )
  }
  if (reason === 'OWN_TEAM') {
    return (
      <section className="vote vote--idle" aria-live="polite">
        <p className="vote__tag">Katılımcı oylaması</p>
        <p>Şu an kendi takımın değerlendiriliyor; kendi takımına oy veremezsin.</p>
      </section>
    )
  }
  if (reason === 'VOTED' || done) {
    return (
      <section className="vote vote--done" aria-live="polite">
        <p className="vote__tag">Katılımcı oylaması</p>
        <p><strong>{current.teamName}</strong> için oyun alındı. Teşekkürler!</p>
      </section>
    )
  }

  const complete = criteria.every((c) => scores[c.key])
  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      await cast(current.team, scores)
      setDone(current.team)
    } catch (e) {
      if (e?.status === 401) onExpired()
      else {
        setError(e?.message || 'Oy gönderilemedi. Tekrar dene.')
        void refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="vote" aria-labelledby="vote-title">
      <p className="vote__tag">Katılımcı oylaması · anonim</p>
      <h2 id="vote-title" className="vote__title">🗳️ {current.position}. {current.teamName} için oy ver</h2>
      <p className="vote__hint">Her kriteri 1 (zayıf) ile 5 (olağanüstü) arasında puanla. Oyun kimseye gösterilmez, bir kez verilir.</p>
      {criteria.map((criterion) => (
        <fieldset key={criterion.key} className="vote__criterion">
          <legend>{criterion.label}</legend>
          <div className="vote__scale" role="radiogroup" aria-label={criterion.label}>
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className={`vote__option${scores[criterion.key] === value ? ' vote__option--on' : ''}`}>
                <input
                  type="radio"
                  name={`vote-${criterion.key}`}
                  value={value}
                  checked={scores[criterion.key] === value}
                  onChange={() => setScores((s) => ({ ...s, [criterion.key]: value }))}
                />
                {value}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <p className="vote__error" role="alert" hidden={!error}>{error}</p>
      <Button onClick={submit} disabled={busy || !complete}>
        {busy ? 'Gönderiliyor…' : complete ? 'Oyumu gönder' : `Oyumu gönder (${criteria.filter((c) => !scores[c.key]).length} kriter eksik)`}
      </Button>
    </section>
  )
}
