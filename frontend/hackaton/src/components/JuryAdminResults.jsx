import { Fragment, useState } from 'react'
import Button from './Button.jsx'
import Field from './Field.jsx'
import { formatScore } from '../lib/juryForm.js'

const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' })

const NO_SUGGESTION = {
  NO_NOMINATION: 'Bu kategoriye aday gösterilmedi. Jüri kararı gerekli.',
  NO_ELIGIBLE_NOMINEE: 'İlk 5’te ödül almamış aday yok. Jüri kararı gerekli.',
  NO_TEAM: 'Önerilecek puanlanmış takım yok',
}

function Suggestion({ category, teamName }) {
  // "Aday yok" tek başına yanıltıcı olur: aday vardır ama üst öncelikli bir ödül almıştır.
  const taken = category.awardedNominees.map(teamName).join(', ')
  return (
    <li className="jury-admin__card">
      <h4>
        <span aria-hidden="true">{category.icon}</span> {category.name}
      </h4>
      {category.winner ? (
        <>
          <p className="jury-admin__winner">
            <span>Öneri:</span> <strong>{teamName(category.winner)}</strong>
          </p>
          {category.tie && <p className="jury-admin__warning">Tam eşitlik var, jüri karar versin.</p>}
          <ol className="jury-admin__top">
            {category.top.map((candidate) => (
              <li key={candidate.team}>
                {teamName(candidate.team)}
                <small>
                  {candidate.score != null && `${formatScore(candidate.score)} puan · `}
                  {`${candidate.nominationCount} adaylık · genel ${formatScore(candidate.overall)}`}
                </small>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="jury-admin__undecided">
          {NO_SUGGESTION[category.reason]}
        </p>
      )}
      {taken && <p className="jury-admin__taken">{`Aday gösterilen ama başka ödül önerilen: ${taken}`}</p>}
    </li>
  )
}

function VoidControl({ card, team, onVoid }) {
  // Gerekçe yazılırken jüri yeniden gönderirse yeni kart değil, bakılan sürüm hedeflenir.
  const [version, setVersion] = useState(/** @type {number | null} */ (null))
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const id = `void-${team}-${card.juror.id}`

  const cancel = () => {
    setVersion(null)
    setReason('')
  }
  const submit = async (event) => {
    event.preventDefault()
    if (busy || !reason.trim()) return
    setBusy(true)
    const done = await onVoid(card.juror.id, team, { reason: reason.trim(), version })
    setBusy(false)
    if (done) cancel()
  }

  if (version === null) {
    return (
      <Button variant="danger" size="sm" aria-label={`${card.juror.name} kartını iptal et`} onClick={() => setVersion(card.version)}>
        İptal et
      </Button>
    )
  }
  return (
    <form className="jury-admin__void" onSubmit={submit}>
      <p>Bu kart sonuçlardan çıkar. Jüri yeniden puanlayabilir. Eski puanlar ve gerekçen işlem kaydında kalır.</p>
      <Field id={id} label="İptal gerekçesi">
        <textarea id={id} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <div className="jury-admin__actions">
        <Button type="submit" variant="danger" disabled={busy || !reason.trim()}>{busy ? 'İptal ediliyor…' : 'Kartı iptal et'}</Button>
        <Button variant="ghost" disabled={busy} onClick={cancel}>Vazgeç</Button>
      </div>
    </form>
  )
}

function TeamDetail({ team, results, onVoid }) {
  return (
    <div className="jury-admin__detail">
      {team.missingJurors.length > 0 && (
        <p className="jury-admin__warning">
          {`Eksik jüri: ${team.missingJurors.map((juror) => (juror.voided ? `${juror.name} (iptal edildi)` : juror.hasDraft ? `${juror.name} (taslakta)` : juror.name)).join(', ')}`}
        </p>
      )}
      {team.cards.length === 0 && <p>Gönderilmiş puan kartı yok.</p>}
      {team.cards.map((card) => (
        <article key={card.juror.id} className="jury-admin__scorecard">
          <h4>{`${card.juror.name}${card.juror.active ? '' : ' (pasif)'}: ${formatScore(card.total)} / 100`}</h4>
          <dl>
            {results.criteria.map((criterion) => {
              const score = card.scores.find((item) => item.criterion === criterion.key)
              return (
                <div key={criterion.key}>
                  <dt>
                    {criterion.label}: <strong>{score?.value ?? '-'}</strong>
                  </dt>
                  {score?.comment && <dd>{score.comment}</dd>}
                </div>
              )
            })}
          </dl>
          {card.nominations.length > 0 && <p>{`Adaylık: ${card.nominations.map((key) => results.categoryNames[key] ?? key).join(', ')}`}</p>}
          {card.generalComment && <p className="jury-admin__comment">{card.generalComment}</p>}
          {onVoid && <VoidControl card={card} team={team.team} onVoid={onVoid} />}
        </article>
      ))}
    </div>
  )
}

/**
 * @param {{ results: any, stale: boolean, onDownload: () => void,
 *   onVoid?: (juror: string, team: string, body: { reason: string, version: number }) => Promise<boolean> }} props onVoid yalnız iptal edilebiliyorsa verilir
 */
export default function JuryAdminResults({ results, stale, onDownload, onVoid }) {
  const [open, setOpen] = useState('')
  if (!results) return <p role="status">{stale ? 'Sonuçlar alınamadı, yeniden deneniyor…' : 'Sonuçlar yükleniyor…'}</p>

  const { ranking, categories, criteria, activeJurorCount } = results
  const incomplete = ranking.filter((team) => team.missingJurors.length).length
  const drafts = ranking.reduce((sum, team) => sum + team.missingJurors.filter((juror) => juror.hasDraft).length, 0)
  const teamName = (id) => ranking.find((team) => team.team === id)?.teamName ?? id

  return (
    <section aria-labelledby="results-title">
      <div className="jury-admin__actions">
        <h2 id="results-title">Sonuçlar</h2>
        <p className={stale ? 'jury-admin__warning' : 'jury-admin__hint'}>
          {stale ? 'Yenilenemiyor, gösterilen veri eski: ' : '10 sn’de bir yenilenir: '}
          {timeFormat.format(new Date(results.generatedAt))}
        </p>
        <Button variant="secondary" onClick={onDownload}>CSV indir</Button>
      </div>

      {incomplete > 0 && (
        <p className="jury-admin__warning">
          {`${incomplete} takımda jüri eksik.`}
          {drafts > 0 && ` ${drafts} kart taslakta, gönderilmeden hesaba girmez.`}
        </p>
      )}

      <h3>Genel sıralama</h3>
      <p className="jury-admin__hint">
        Nihai puan = Jüri × {String(results.shares?.jury ?? 0.7).replace('.', ',')} + Katılımcı × {String(results.shares?.participants ?? 0.3).replace('.', ',')}.
        Katılımcı oyu almayan takımın katılımcı puanı {results.shares?.noVoteScore ?? 50} sayılır. Ödüller nihai sıralamanın ilk 5 takımı arasında, takım başına en fazla bir ödül olarak önerilir.
      </p>
      {ranking.length === 0 ? (
        <p>Henüz yarışan takım yok.</p>
      ) : (
        <div className="jury-admin__scroll" role="region" aria-label="Genel sıralama tablosu" tabIndex={0}>
          <table className="jury-admin__table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Takım</th>
                <th scope="col">Nihai</th>
                <th scope="col">Jüri puanı</th>
                <th scope="col">Katılımcı</th>
                <th scope="col">Jüri</th>
                {criteria.map((criterion) => <th key={criterion.key} scope="col">{criterion.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {ranking.map((team) => {
                const expanded = open === team.team
                return (
                  <Fragment key={team.team}>
                    <tr>
                      <td>{team.rank ?? '-'}</td>
                      <th scope="row">
                        <button type="button" className="jury-admin__expand" aria-expanded={expanded} onClick={() => setOpen(expanded ? '' : team.team)}>
                          {team.teamName}
                        </button>
                        {team.projectName && <small>{team.projectName}</small>}
                        {team.teamMissing && <small>Takım dağıtılmış</small>}
                      </th>
                      <td className="jury-admin__overall">{formatScore(team.final ?? team.overall)}</td>
                      <td>{formatScore(team.overall)}</td>
                      <td>
                        {formatScore(team.participantScore ?? null)}
                        <small>{team.participantCount ? `${team.participantCount} oy` : `Oy yok, ${results.shares?.noVoteScore ?? 50} sayıldı`}</small>
                      </td>
                      <td className={team.missingJurors.length ? 'jury-admin__short' : undefined}>
                        {team.judgeCount}
                        {team.missingJurors.length > 0 && <small>{`${team.missingJurors.length} / ${activeJurorCount} eksik`}</small>}
                      </td>
                      {criteria.map((criterion) => <td key={criterion.key}>{formatScore(team.criterionAverages[criterion.key])}</td>)}
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={6 + criteria.length}>
                          <TeamDetail team={team} results={results} onVoid={onVoid} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h3>Kategori önerileri</h3>
      <p className="jury-admin__hint">Bunlar öneridir. Son kararı jüri ve organizasyon verir.</p>
      <ul className="jury-admin__suggestions">
        {categories.map((category) => <Suggestion key={category.key} category={category} teamName={teamName} />)}
      </ul>
    </section>
  )
}
