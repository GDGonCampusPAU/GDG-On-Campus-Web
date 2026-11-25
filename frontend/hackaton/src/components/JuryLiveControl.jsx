import { useState } from 'react'
import Button from './Button.jsx'

const STATE = {
  CLOSED: { label: 'Bitti', tone: 'done' },
  VOTING: { label: 'Oylanıyor', tone: 'now' },
  WAITING: { label: 'Sırada', tone: 'wait' },
}
const VOTE = {
  SUBMITTED: { label: 'Oy verdi', tone: 'done' },
  DRAFT: { label: 'Puanlıyor (gönderilmedi)', tone: 'now' },
  NONE: { label: 'Bekleniyor', tone: 'wait' },
}

/**
 * Sahnedeki sunum akışı (/admin/juri > Sunum akışı). "Proje değerlendirme" izni açıkken sunan takım seçilir,
 * jüriler yalnız onu oylar; bütün aktif jüriler oy vermeden "Oylamayı bitir" kapalıdır. Jüri salondan
 * ayrıldıysa "Yine de bitir" onayla kapatır (işlem kaydına eksikler yazılır).
 * @param {{ live: any, stale: boolean, isAdmin: boolean, client: any, onChanged: (view: any) => void,
 *   onNote: (note: { text: string, bad?: boolean }) => void, onError: (error: any) => void }} props
 */
export default function JuryLiveControl({ live, stale, isAdmin, client, onChanged, onNote, onError }) {
  const [busy, setBusy] = useState(false)

  if (!live) return <p>{stale ? 'Sunum akışı alınamadı, yeniden deneniyor…' : 'Yükleniyor…'}</p>

  const act = async (fn, text) => {
    setBusy(true)
    try {
      const view = await fn()
      onChanged(view)
      onNote({ text: text(view) })
    } catch (error) {
      onError(error)
      // Başka bir ekrandan değişmiş olabilir: güncel hâli getir.
      try { onChanged(await client.live()) } catch { /* sonraki yoklamada gelir */ }
    } finally {
      setBusy(false)
    }
  }
  const start = (entry) => act(() => client.startVoting(entry.team), () => `${entry.teamName} için oylama başladı. Jüriler artık bu takımı puanlayabilir.`)
  const end = (force) => act(() => client.endVoting(force), (view) => `${view.ended} oylaması bitti.${view.next ? ` Sıradaki: ${view.next.teamName}.` : ''}`)
  const reopen = (entry) => {
    if (!window.confirm(`${entry.teamName} için oylama yeniden açılabilir hâle gelsin mi? Jüriler, başlatılınca puanlarını değiştirebilir.`)) return
    act(() => client.reopenVoting(entry.team), () => `${entry.teamName} yeniden oylanabilir.`)
  }
  const shuffle = () => {
    if (!window.confirm('Sunum sırası yeniden rastgele belirlensin mi? Katılımcılar yeni sırayı görecek.')) return
    act(() => client.shuffle(), () => 'Sunum sırası yeniden belirlendi.')
  }

  const { current, next, votes } = live
  const counted = votes.filter((vote) => vote.active)
  const missing = counted.filter((vote) => vote.status !== 'SUBMITTED')
  const forceEnd = () => {
    if (!window.confirm(`Şu jüriler oy vermedi: ${missing.map((vote) => vote.name).join(', ')}.\nOnların oyu olmadan bitirilsin mi? Bu takım bir daha puanlanamaz.`)) return
    end(true)
  }

  return (
    <section className="jury-live" aria-labelledby="jury-live-title">
      <h2 id="jury-live-title" className="visually-hidden">Sunum akışı</h2>
      {stale && <p className="jury-admin__warning" role="status">Bağlantı sorunu: gösterilen bilgi eski olabilir, yeniden deneniyor.</p>}
      {!live.open && (
        <p className="jury-admin__warning">
          Proje değerlendirme kapalı. Core Team panelindeki <strong>İzinler</strong> sayfasından “Proje değerlendirmeyi aç” ile
          başlatın; açılınca takımlar rastgele sıralanır.
        </p>
      )}
      {live.open && live.locked && <p className="jury-admin__warning">Puanlama kilitli: oylama başlatılamaz. Önce kilidi açın.</p>}

      {live.open && current && (
        <div className="jury-live__now" aria-live="polite">
          <p className="jury-live__tag">Şu an oylanıyor</p>
          <h3 className="jury-live__team">{current.position}. {current.teamName}</h3>
          <p className="jury-live__count">
            <strong>{counted.length - missing.length} / {counted.length}</strong> jüri oy verdi
          </p>
          <ul className="jury-live__votes">
            {votes.map((vote) => (
              <li key={vote.id} className={vote.active ? '' : 'jury-live__vote--off'}>
                <span>{vote.name}</span>
                <span className={`jury-live__badge jury-live__badge--${vote.active ? VOTE[vote.status].tone : 'off'}`}>
                  {vote.active ? VOTE[vote.status].label : 'Pasif, sayılmaz'}
                </span>
              </li>
            ))}
          </ul>
          <div className="jury-live__actions">
            <Button onClick={() => end(false)} disabled={busy || missing.length > 0}>Oylamayı bitir</Button>
            {missing.length > 0 && (
              <>
                <span className="jury-live__why">{missing.length} jüri henüz oy vermedi.</span>
                <Button variant="danger" size="sm" onClick={forceEnd} disabled={busy}>Yine de bitir</Button>
              </>
            )}
          </div>
        </div>
      )}

      {live.open && !current && (
        <div className="jury-live__now jury-live__now--idle">
          {next ? (
            <>
              <p className="jury-live__tag">Sıradaki takım</p>
              <h3 className="jury-live__team">{next.position}. {next.teamName}</h3>
              <div className="jury-live__actions">
                <Button onClick={() => start(next)} disabled={busy || live.locked}>Oylamayı başlat</Button>
              </div>
            </>
          ) : live.order.length ? (
            <>
              <p className="jury-live__tag">Tamamlandı</p>
              <h3 className="jury-live__team">Bütün takımların oylaması bitti.</h3>
              <p>Sonuçlar sekmesinden kontrol edip puanlamayı kilitleyebilirsiniz.</p>
            </>
          ) : (
            <p>Yarışan takım yok. “Yarışan takımlar” sekmesinden takım ekleyin.</p>
          )}
        </div>
      )}

      <div className="jury-live__head">
        <h3>Sunum sırası</h3>
        {isAdmin && live.open && !live.started && live.order.length > 1 && (
          <Button variant="ghost" size="sm" onClick={shuffle} disabled={busy}>Sırayı yeniden karıştır</Button>
        )}
      </div>
      <ol className="jury-live__order">
        {live.order.map((entry) => (
          <li key={entry.team} className={`jury-live__row jury-live__row--${STATE[entry.state].tone}`}>
            <span className="jury-live__pos">{entry.position}</span>
            <span className="jury-live__name">
              {entry.teamName}
              {entry.projectName && <small>{entry.projectName}</small>}
            </span>
            <span className={`jury-live__badge jury-live__badge--${STATE[entry.state].tone}`}>{STATE[entry.state].label}</span>
            {live.open && !current && entry.state === 'WAITING' && entry.team !== next?.team && (
              <Button variant="ghost" size="sm" onClick={() => start(entry)} disabled={busy || live.locked}>Şimdi başlat</Button>
            )}
            {isAdmin && entry.state === 'CLOSED' && (
              <Button variant="ghost" size="sm" onClick={() => reopen(entry)} disabled={busy}>Yeniden aç</Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
