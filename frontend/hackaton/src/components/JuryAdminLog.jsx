import Button from './Button.jsx'
import { formatScore } from '../lib/juryForm.js'

const ACTIONS = {
  JUROR_CREATED: 'Jüri ve linki oluşturuldu',
  LINK_REGENERATED: 'Jüri linki yenilendi',
  JUROR_RENAMED: 'Jüri adı değişti',
  JUROR_ACTIVATED: 'Jüri aktifleştirildi',
  JUROR_DEACTIVATED: 'Jüri pasifleştirildi',
  CONFIG_UPDATED: 'Ayarlar değişti',
  LOCKED: 'Puanlama kilitlendi',
  UNLOCKED: 'Puanlama açıldı',
  SCORECARDS_RESET: 'Puan kartları sıfırlandı',
  SCORECARD_VOIDED: 'Puan kartı iptal edildi',
}
const SECTIONS = { criteria: 'Kriter', categories: 'Kategori', entries: 'Takım' }
const FIELDS = {
  key: 'Anahtar', label: 'Ad', name: 'Ad', description: 'Açıklama', weight: 'Ağırlık', icon: 'İkon', criterionKeys: 'Sıralama kriterleri',
  priority: 'Öncelik', active: 'Aktif', teamName: 'Takım adı', order: 'Sunum sırası', projectName: 'Proje adı',
  repoUrl: 'Repo linki', demoUrl: 'Demo linki', presentationUrl: 'Sunum linki',
}
const timeFormat = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Istanbul' })

function shown(value) {
  if (typeof value === 'boolean') return value ? 'evet' : 'hayır'
  if (Array.isArray(value)) return value.join(', ') || 'boş'
  return value === '' || value == null ? 'boş' : String(value)
}

/** Ayar değişikliğini okunur satırlara çevirir. */
function changeLines(changes) {
  return Object.entries(changes).flatMap(([section, { added, removed, edited }]) => [
    ...added.map((name) => `${SECTIONS[section] ?? section} eklendi: ${name}`),
    ...removed.map((name) => `${SECTIONS[section] ?? section} çıkarıldı: ${name}`),
    ...edited.flatMap(({ name, fields }) =>
      Object.entries(fields).map(([field, [from, to]]) => `${name}, ${FIELDS[field] ?? field}: ${shown(from)} → ${shown(to)}`)),
  ])
}

function Details({ entry, criteria }) {
  const { details } = entry
  if (entry.action === 'JUROR_RENAMED') return <p>{`${details.from} → ${details.to}`}</p>
  if (entry.action === 'SCORECARDS_RESET') return <p>{`${details.deleted} kart silindi.`}</p>
  if (entry.action === 'CONFIG_UPDATED') {
    return (
      <ul>
        {changeLines(details.changes ?? {}).map((line, index) => <li key={index}>{line}</li>)}
      </ul>
    )
  }
  if (entry.action !== 'SCORECARD_VOIDED') return null
  return (
    <>
      <p className="jury-admin__comment">{`Gerekçe: ${details.reason}`}</p>
      {details.card && (
        <details>
          <summary>{`İptal edilen puan: ${formatScore(details.card.total)} / 100`}</summary>
          <ul>
            {details.card.scores.map((score) => (
              <li key={score.criterion}>
                {`${criteria.find((criterion) => criterion.key === score.criterion)?.label ?? score.criterion}: ${score.value ?? '-'}`}
                {score.comment && ` (${score.comment})`}
              </li>
            ))}
          </ul>
          {details.card.generalComment && <p className="jury-admin__comment">{details.card.generalComment}</p>}
        </details>
      )}
    </>
  )
}

/** @param {{ log: { items: any[], next: string | null } | null, criteria: any[], stale: boolean, onMore: () => void }} props */
export default function JuryAdminLog({ log, criteria, stale, onMore }) {
  if (!log) return <p role="status">{stale ? 'İşlem kaydı alınamadı, yeniden deneniyor…' : 'İşlem kaydı yükleniyor…'}</p>
  return (
    <section aria-labelledby="log-title">
      <h2 id="log-title">İşlem kaydı</h2>
      <p className="jury-admin__hint">Kim, neyi, ne zaman yaptı. En yeni üsttedir. Panelden değiştirilemez ve sıfırlamada silinmez.</p>
      {stale && <p className="jury-admin__warning">Yenilenemiyor, gösterilen kayıt eski olabilir.</p>}
      {log.items.length === 0 && <p>Henüz işlem yok.</p>}
      <ul aria-label="İşlem kaydı">
        {log.items.map((entry) => (
          <li key={entry.id}>
            <article className="jury-admin__card jury-admin__log">
              <h3>
                {ACTIONS[entry.action] ?? entry.action}
                {entry.target && `: ${entry.target}`}
              </h3>
              <p className="jury-admin__actor">
                <time dateTime={entry.at}>{timeFormat.format(new Date(entry.at))}</time>
                {` · ${entry.actor.name} (${entry.actor.email}, ${entry.actor.role})`}
              </p>
              <Details entry={entry} criteria={criteria} />
            </article>
          </li>
        ))}
      </ul>
      {log.next && <Button variant="ghost" onClick={onMore}>Daha eski kayıtlar</Button>}
    </section>
  )
}
