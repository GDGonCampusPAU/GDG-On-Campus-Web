import { describeTeam } from '../lib/juryStore.js'

const BADGES = {
  SUBMITTED: ['✅', 'Gönderildi'],
  DRAFT: ['✏️', 'Taslak'],
  NONE: ['⏳', 'Bekliyor'],
  UNSENT: ['⚠️', 'Gönderilmemiş değişiklik'],
}

/** @param {{ me: any, teams: Record<string, import('../lib/juryStore.js').TeamState>, onOpen: (team: string) => void }} props */
export default function JuryTeamList({ me, teams, onOpen }) {
  const rows = me.entries.map((entry) => ({ entry, ...describeTeam(me.criteria, teams[entry.team], entry.status) }))
  const done = rows.filter((row) => row.submitted).length
  const unsent = rows.filter((row) => row.unsent).length

  return (
    <>
      <header className="jury__header">
        <p className="jury__eyebrow">Jüri puanlama</p>
        <h1>{me.juror.name}</h1>
        <p className="jury__progress">{`${done} / ${rows.length} takım puanlandı`}</p>
        <progress className="jury__meter" max={rows.length || 1} value={done} aria-label="Puanlanan takımlar" />
      </header>

      {unsent > 0 && (
        <div className="jury__warning" role="alert">
          <strong>{`${unsent} takımda gönderilmemiş değişiklik var.`}</strong>
          <p>
            {me.locked
              ? 'Puanlama kapatıldığı için bu değişiklikler hesaba girmeyecek.'
              : 'Bu değişiklikler hesaba girmiyor. Takımı açıp "Yeniden gönder"e bas.'}
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="jury__notice">Henüz takım eklenmedi. Liste hazır olduğunda burada görünecek.</p>
      ) : (
        <ol className="jury__list">
          {rows.map(({ entry, status, unsent: changed }) => {
            const [icon, label] = BADGES[changed ? 'UNSENT' : status]
            return (
              <li key={entry.team}>
                <button type="button" className={`jury__row${changed ? ' jury__row--unsent' : ''}`} onClick={() => onOpen(entry.team)}>
                  <span className="jury__order">{entry.order}</span>
                  <span className="jury__names">
                    <span className="jury__team-name">{entry.projectName || entry.teamName}</span>
                    {entry.projectName && <span className="jury__sub">{entry.teamName}</span>}
                    <span className={`jury__badge jury__badge--${changed ? 'unsent' : status.toLowerCase()}`}>
                      <span aria-hidden="true">{icon}</span> {label}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </>
  )
}
