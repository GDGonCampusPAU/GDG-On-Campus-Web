import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import {
  downloadHackathonApplicationsCsv,
  getHackathonApplications,
  downloadPrivateFile,
} from '../lib/api.js'

const PAGE_SIZE = 10

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function Applications({ session, onLogout, onUnauthorized }) {
  const { token, user } = session
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('') // gecikmeli arama metni
  const [page, setPage] = useState(1)
  const [source, setSource] = useState('forms')
  const [state, setState] = useState({ status: 'loading', items: [], pagination: null, error: '' })
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  // Yazarken her tuşta istek atmamak için aramayı 350 ms geciktir.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const requestKey = `${token}:${source}:${page}:${query}`
  useEffect(() => {
    let cancelled = false

    getHackathonApplications({ page, limit: PAGE_SIZE, search: query, source }, token)
      .then((data) => {
        if (cancelled) return
        setState({ key: requestKey, status: 'ready', items: data.data ?? [], pagination: data.pagination ?? null, error: '' })
      })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401) {
          onUnauthorized?.()
          return
        }
        setState({ key: requestKey, status: 'error', items: [], pagination: null, error: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [page, query, token, source, onUnauthorized, requestKey])

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const blob = await downloadHackathonApplicationsCsv(token, { source, search: query })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'hackathon_basvurulari.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      if (error.status === 401) {
        onUnauthorized?.()
        return
      }
      setExportError(error.message)
    } finally {
      setExporting(false)
    }
  }

  const downloadFile = async (url, filename = 'dosya') => {
    try {
      const blob = await downloadPrivateFile(url, token)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = objectUrl; link.download = filename
      link.click(); URL.revokeObjectURL(objectUrl)
    } catch (error) { if (error.status === 401) onUnauthorized(); else setExportError(error.message) }
  }
  const { items, pagination, error } = state
  const status = state.key === requestKey ? state.status : 'loading'
  const total = pagination?.totalItems ?? 0

  return (
    <PanelLayout
      user={user}
      onLogout={onLogout}
      title="Hackathon Başvuruları"
      actions={
        <button type="button" className="btn btn--outline" onClick={handleExport} disabled={exporting}>
          {exporting ? 'İndiriliyor…' : 'CSV indir'}
        </button>
      }
    >
      <label>Başvuru kaynağı
        <select value={source} onChange={event => { setSource(event.target.value); setPage(1) }}>
          <option value="forms">Etkinlik sitesi başvuruları</option>
          <option value="legacy">Eski takım başvuruları</option>
        </select>
      </label>
      <div className="toolbar">
        <div className="field toolbar__search">
          <label className="field__label" htmlFor="applications-search">
            Ara
          </label>
          <input
            id="applications-search"
            className="field__input"
            type="search"
            placeholder="Takım adı, kişi veya e-posta"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="toolbar__count" aria-live="polite">
          {status === 'ready' ? `${total} başvuru` : ' '}
        </p>
      </div>

      {exportError && (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {exportError}
        </p>
      )}

      {status === 'loading' && (
        <p className="panel__state" role="status">
          Başvurular yükleniyor…
        </p>
      )}

      {status === 'error' && (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {error}
        </p>
      )}

      {status === 'ready' && items.length === 0 && (
        <p className="panel__state">
          {query ? 'Aramanla eşleşen başvuru bulunamadı.' : 'Henüz hackathon başvurusu yok.'}
        </p>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="app-grid">
          {items.map((record) => {
            const answers = Object.fromEntries((record.answers || []).map(answer => [answer.fieldId, answer.value]))
            const app = record.answers ? { ...record, teamName: answers.teamName || answers.fullName || record.verifiedEmail,
              leaderName: answers.fullName, leaderEmail: record.verifiedEmail, leaderPhone: answers.phone, appliedAt: record.submittedAt,
              projectIdea: answers.motivation || answers.projectIdea } : { ...record, leaderName: record.leaderName || record.fullName, projectIdea: record.projectIdea || record.motivation }
            return (
            <li key={app._id} className="app-card">
              <div className="app-card__head">
                <h2 className="app-card__team">{app.teamName}</h2>
                {app.memberCount && <span className="panel__badge">{app.memberCount} kişi</span>}
              </div>
              <p className="app-card__leader">{app.leaderName}</p>
              <p className="app-card__contact">
                <a href={`mailto:${app.leaderEmail}`}>{app.leaderEmail}</a>
                <a href={`tel:${app.leaderPhone}`}>{app.leaderPhone}</a>
              </p>
              {record.answers && <details><summary>Başvuru yanıtları</summary><dl>{record.answers.map(answer => <div key={answer.fieldId}><dt>{answer.label}</dt><dd>{Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value ?? '')}</dd></div>)}</dl></details>}
              <details className="app-card__idea">
                <summary>Proje fikri</summary>
                <p>{app.projectIdea}</p>
              </details>
              <div className="app-card__foot">
                <time className="app-card__date" dateTime={app.appliedAt}>
                  {formatDate(app.appliedAt)}
                </time>
                {app.resumeUrl && (
                  <button onClick={() => downloadFile(app.resumeUrl, 'ozgecmis')}>Özgeçmiş indir</button>
                )}
                {(record.uploadedFiles || []).map(file => <button key={file.filename} onClick={() => downloadFile(file.url, file.originalName)}>{file.originalName} indir</button>)}
              </div>
            </li>
          )})}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <nav className="pager" aria-label="Sayfalama">
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setPage((p) => p - 1)}
            disabled={!pagination.hasPrevPage || status === 'loading'}
          >
            Önceki
          </button>
          <span className="pager__info">
            Sayfa {pagination.currentPage} / {pagination.totalPages}
          </span>
          <button
            type="button"
            className="btn btn--outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={!pagination.hasNextPage || status === 'loading'}
          >
            Sonraki
          </button>
        </nav>
      )}
    </PanelLayout>
  )
}
