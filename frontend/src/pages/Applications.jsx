import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import {
  downloadHackathonApplicationsCsv,
  getHackathonApplications,
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

  useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))

    getHackathonApplications({ page, limit: PAGE_SIZE, search: query }, token)
      .then((data) => {
        if (cancelled) return
        setState({ status: 'ready', items: data.data ?? [], pagination: data.pagination ?? null, error: '' })
      })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401) {
          onUnauthorized?.()
          return
        }
        setState({ status: 'error', items: [], pagination: null, error: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [page, query, token, onUnauthorized])

  const handleExport = async () => {
    setExporting(true)
    setExportError('')
    try {
      const blob = await downloadHackathonApplicationsCsv(token)
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

  const { status, items, pagination, error } = state
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
          {items.map((app) => (
            <li key={app._id} className="app-card">
              <div className="app-card__head">
                <h2 className="app-card__team">{app.teamName}</h2>
                <span className="panel__badge">{app.memberCount} kişi</span>
              </div>
              <p className="app-card__leader">{app.leaderName}</p>
              <p className="app-card__contact">
                <a href={`mailto:${app.leaderEmail}`}>{app.leaderEmail}</a>
                <a href={`tel:${app.leaderPhone}`}>{app.leaderPhone}</a>
              </p>
              <details className="app-card__idea">
                <summary>Proje fikri</summary>
                <p>{app.projectIdea}</p>
              </details>
              <div className="app-card__foot">
                <time className="app-card__date" dateTime={app.appliedAt}>
                  {formatDate(app.appliedAt)}
                </time>
                {app.resumeUrl && (
                  <a href={app.resumeUrl} target="_blank" rel="noopener noreferrer">
                    Özgeçmiş
                  </a>
                )}
              </div>
            </li>
          ))}
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
