import { Fragment, useState } from 'react'
import Button from './Button.jsx'
import { formatScore } from '../lib/juryForm.js'

const timeFormat = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' })

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
          {category.basis === 'ALL_SCORED' && (
            <p className="jury-admin__hint">{taken ? 'Adaylar başka ödül aldı, puana göre sıralandı.' : 'Aday yok, puana göre sıralandı.'}</p>
          )}
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
          {category.reason === 'NO_NOMINATION' ? 'Aday yok, jüri karar versin' : 'Önerilecek puanlanmış takım yok'}
        </p>
      )}
      {taken && <p className="jury-admin__taken">{`Aday gösterilen ama başka ödül önerilen: ${taken}`}</p>}
    </li>
  )
}

function TeamDetail({ team, results }) {
  return (
    <div className="jury-admin__detail">
      {team.missingJurors.length > 0 && (
        <p className="jury-admin__warning">
          {`Eksik jüri: ${team.missingJurors.map((juror) => (juror.hasDraft ? `${juror.name} (taslakta)` : juror.name)).join(', ')}`}
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
        </article>
      ))}
    </div>
  )
}

/** @param {{ results: any, stale: boolean, onDownload: () => void }} props */
export default function JuryAdminResults({ results, stale, onDownload }) {
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
      {ranking.length === 0 ? (
        <p>Henüz yarışan takım yok.</p>
      ) : (
        <div className="jury-admin__scroll" role="region" aria-label="Genel sıralama tablosu" tabIndex={0}>
          <table className="jury-admin__table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Takım</th>
                <th scope="col">Genel</th>
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
                      <td className="jury-admin__overall">{formatScore(team.overall)}</td>
                      <td className={team.missingJurors.length ? 'jury-admin__short' : undefined}>
                        {team.judgeCount}
                        {team.missingJurors.length > 0 && <small>{`${team.missingJurors.length} / ${activeJurorCount} eksik`}</small>}
                      </td>
                      {criteria.map((criterion) => <td key={criterion.key}>{formatScore(team.criterionAverages[criterion.key])}</td>)}
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={4 + criteria.length}>
                          <TeamDetail team={team} results={results} />
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
