import { Fragment, useCallback, useEffect, useState } from 'react'
import Button from './Button.jsx'

const dateTime = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' })
const show = (iso) => (iso ? dateTime.format(new Date(iso)) : '—')
// Türkiye yaz saati uygulamıyor: her zaman UTC+3.
const OFFSET_MS = 3 * 60 * 60 * 1000
const toInput = (iso) => (iso ? new Date(Date.parse(iso) + OFFSET_MS).toISOString().slice(0, 16) : '')
const fromInput = (value) => (value ? `${value}:00+03:00` : '')

const STATUS = {
  LATE: { label: 'Teslimden sonra push var', tone: 'late' },
  ON_TIME: { label: 'Zamanında', tone: 'ok' },
  NO_REPO: { label: 'Link yok', tone: 'off' },
  REPO_GONE: { label: 'Repo bulunamadı (silinmiş ya da gizli)', tone: 'late' },
  UNAVAILABLE: { label: 'GitHub cevap vermedi', tone: 'off' },
}
const TYPE = { push: 'Push', force_push: 'Force push', pr_merge: 'PR birleştirme', merge_queue_merge: 'Birleştirme', branch_creation: 'Yeni dal' }

/**
 * Jüri yönetimi > Teslim kontrolü. Takımların reposuna teslimden SONRA kod gelip gelmediği.
 * Commit tarihi takımın bilgisayarından gelir ve değiştirilebilir; burada GitHub'ın kendi kaydettiği
 * push zamanı kullanılır. Teslim zamanı, "Proje yüklemeyi kapat"a basılan andır; elle değiştirilebilir.
 * GitHub'a sorduğu için kendiliğinden yenilenmez: "Kontrol et" ile çalışır.
 * @param {{ client: any, onError: (error: any) => void }} props
 */
export default function JuryLateCheck({ client, onError }) {
  const [report, setReport] = useState(/** @type {any} */ (null))
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState('')
  const [open, setOpen] = useState('')

  const run = useCallback(async (deadline = '') => {
    setBusy(true)
    try {
      setReport(await client.latePushes(deadline))
    } catch (error) {
      onError(error)
    } finally {
      setBusy(false)
    }
  }, [client, onError])

  useEffect(() => { void run() }, [run])

  const check = (event) => {
    event.preventDefault()
    void run(fromInput(custom))
  }
  const late = report?.teams.filter((team) => team.status === 'LATE') ?? []

  return (
    <section aria-labelledby="late-title" className="jury-late">
      <div className="jury-admin__actions">
        <h2 id="late-title">Teslim kontrolü</h2>
        <Button variant="secondary" onClick={() => run(fromInput(custom))} disabled={busy}>{busy ? 'Kontrol ediliyor…' : 'Yeniden kontrol et'}</Button>
      </div>
      <p className="jury-admin__hint">
        Her takımın reposuna teslimden sonra kod gelip gelmediğine GitHub’ın kaydettiği <strong>push zamanıyla</strong> bakılır.
        Commit tarihi takımın bilgisayarından gelir ve geriye alınabilir; push zamanı değiştirilemez.
      </p>

      {report && (
        <>
          <div className="jury-late__deadline">
            {report.deadline ? (
              <p>
                Teslim zamanı: <strong>{show(report.deadline)}</strong>
                {report.deadlineSource === 'CLOSED_AT' ? ' (proje yüklemenin kapatıldığı an)' : ' (elle girildi)'}
              </p>
            ) : (
              <p className="jury-admin__warning">
                {report.uploadOpen
                  ? 'Proje yükleme hâlâ açık, teslim zamanı yok. Core Team panelindeki İzinler sayfasından “Proje yüklemeyi kapat” deyince o an teslim zamanı olur. Aşağıdan bir zaman girerek de bakabilirsiniz.'
                  : 'Proje yükleme kapalı ama kapatıldığı an kayıtlı değil (bu özellikten önce kapatılmış). Teslim zamanını aşağıya girin.'}
              </p>
            )}
            <form className="jury-late__form" onSubmit={check}>
              <label htmlFor="late-deadline">Başka bir teslim zamanına göre bak</label>
              <input id="late-deadline" type="datetime-local" value={custom} onChange={(event) => setCustom(event.target.value)} />
              <Button type="submit" size="sm" disabled={busy || !custom}>Bu zamana göre kontrol et</Button>
              {custom && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { setCustom(''); void run() }}>Kapanış anına dön</Button>}
            </form>
            {report.deadlineSource === 'CLOSED_AT' && !custom && (
              <button type="button" className="jury-late__prefill" onClick={() => setCustom(toInput(report.deadline))}>Kapanış anını düzenle</button>
            )}
          </div>

          {report.deadline && (
            <p className={late.length ? 'jury-admin__warning' : 'jury-late__ok'} role="status">
              {late.length
                ? `${late.length} takım teslimden sonra push yaptı${report.summary.forced ? `, ${report.summary.forced} tanesi force push (geçmişi yeniden yazmış)` : ''}.`
                : 'Teslimden sonra push yapan takım yok.'}
            </p>
          )}
          {report.summary.unavailable > 0 && (
            <p className="jury-admin__warning">{`${report.summary.unavailable} takımın reposu okunamadı; o takımlar için sonuç yok.`}</p>
          )}

          <div className="jury-admin__scroll" role="region" aria-label="Teslim kontrolü tablosu" tabIndex={0}>
            <table className="jury-admin__table">
              <thead>
                <tr>
                  <th scope="col">Takım</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Teslimden sonra</th>
                  <th scope="col">Son push</th>
                  <th scope="col">Etkinlik öncesi push</th>
                </tr>
              </thead>
              <tbody>
                {report.teams.map((team) => {
                  const expanded = open === team.team
                  const state = STATUS[team.status]
                  return (
                    <Fragment key={team.team}>
                      <tr className={`jury-late__row jury-late__row--${state.tone}`}>
                        <th scope="row">
                          {team.lateCount > 0 ? (
                            <button type="button" className="jury-admin__expand" aria-expanded={expanded} onClick={() => setOpen(expanded ? '' : team.team)}>
                              {team.teamName}
                            </button>
                          ) : team.teamName}
                          {team.repoUrl && <small><a href={team.repoUrl} target="_blank" rel="noreferrer">{team.repoUrl.replace('https://github.com/', '')}</a></small>}
                          {!team.competing && <small>Yarışan takımlarda değil</small>}
                        </th>
                        <td>{state.label}</td>
                        <td>
                          {team.status === 'LATE' ? `${team.lateCount}${team.truncated ? '+' : ''} push` : '—'}
                          {team.forcedLate && <small className="jury-late__forced">Force push var</small>}
                        </td>
                        <td>{show(team.lastPushAt)}</td>
                        <td>
                          {team.status === 'NO_REPO' ? '—' : team.earlyCount ? `${team.earlyCount} push` : team.truncated ? 'Bilinmiyor' : 'Yok'}
                          {team.truncated && <small>Çok fazla kayıt: en eski push’lar okunmadı</small>}
                        </td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td colSpan={5}>
                            <ol className="jury-late__pushes">
                              {team.latePushes.map((pushItem) => (
                                <li key={`${pushItem.at}-${pushItem.url}`}>
                                  <strong>{show(pushItem.at)}</strong>
                                  {` · ${TYPE[pushItem.type] ?? pushItem.type}`}
                                  {pushItem.ref && ` · ${pushItem.ref}`}
                                  {pushItem.actor && ` · @${pushItem.actor}`}
                                  {' · '}
                                  <a href={pushItem.url} target="_blank" rel="noreferrer">Değişiklikleri GitHub’da gör</a>
                                </li>
                              ))}
                            </ol>
                            {team.lateCount > team.latePushes.length && <p className="jury-admin__hint">{`İlk ${team.latePushes.length} push gösteriliyor.`}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="jury-admin__hint">
            {`Kontrol: ${show(report.checkedAt)}.`}
            {report.eventStartsAt && ` “Etkinlik öncesi push”: ${show(report.eventStartsAt)} öncesinde GitHub’a gelen kod (hazır getirilmiş olabilir).`}
            {' Kendiliğinden yenilenmez.'}
          </p>
        </>
      )}
      {!report && <p role="status">{busy ? 'GitHub’dan push kayıtları alınıyor…' : 'Kontrol yapılamadı. “Yeniden kontrol et”e basın.'}</p>}
    </section>
  )
}
