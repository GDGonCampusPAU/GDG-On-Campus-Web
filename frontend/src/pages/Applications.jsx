import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/PanelLayout.jsx'
import {
  downloadHackathonApplicationsCsv,
  getHackathonApplications,
  downloadPrivateFile,
  updateApplicationStatus,
} from '../lib/api.js'

const PAGE_SIZE = 10

const STATUS_LABELS = {
  PENDING: 'Beklemede',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
}

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
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ key: '', status: 'loading', items: [], pagination: null, formId: null, error: '' })
  const [exporting, setExporting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [notesById, setNotesById] = useState({})
  const [notifyById, setNotifyById] = useState({})

  // Yazarken her tuşta istek atmamak için aramayı 350 ms geciktir.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const requestKey = `${token}:${source}:${statusFilter}:${page}:${query}:${revision}`
  useEffect(() => {
    let cancelled = false

    getHackathonApplications({ page, limit: PAGE_SIZE, search: query, source, status: statusFilter }, token)
      .then((data) => {
        if (cancelled) return
        setState({
          key: requestKey,
          status: 'ready',
          items: data.data ?? [],
          pagination: data.pagination ?? null,
          formId: data.form?.id ?? null,
          error: '',
        })
      })
      .catch((error) => {
        if (cancelled) return
        if (error.status === 401) {
          onUnauthorized?.()
          return
        }
        setState({ key: requestKey, status: 'error', items: [], pagination: null, formId: null, error: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [page, query, token, source, statusFilter, onUnauthorized, requestKey])

  const handleExport = async () => {
    setExporting(true)
    setActionError('')
    try {
      const blob = await downloadHackathonApplicationsCsv(token, { source, search: query, status: statusFilter })
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
      setActionError(error.message)
    } finally {
      setExporting(false)
    }
  }

  const downloadFile = async (url, filename = 'dosya') => {
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    setActionError('')
    try {
      const blob = await downloadPrivateFile(url, token)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      link.click()
      URL.revokeObjectURL(objectUrl)
    } catch (error) {
      if (error.status === 401) onUnauthorized?.()
      else setActionError(error.message)
    }
  }

  /** @param {any} record @param {string} nextStatus @param {{ forceNotify?: boolean }} [options] */
  const handleStatusChange = async (record, nextStatus, { forceNotify } = {}) => {
    const id = record._id
    const draftNote = notesById[id] ?? record.statusNote ?? ''
    const notify = forceNotify !== undefined
      ? forceNotify
      : (nextStatus === 'PENDING' ? false : (notifyById[id] ?? true))

    setBusyId(id)
    setActionError('')
    setActionNotice('')
    try {
      const result = await updateApplicationStatus(
        { id, formId: state.formId, source, status: nextStatus, note: draftNote, notify },
        token,
      )
      const updated = result?.data
      setActionNotice(result?.message || 'Başvuru durumu güncellendi.')
      if (statusFilter !== 'ALL' && nextStatus !== statusFilter) {
        if ((state.pagination?.totalPages ?? 1) > 1) {
          setRevision((value) => value + 1)
        } else {
          setState((prev) => ({
            ...prev,
            items: prev.items.filter((item) => item._id !== id),
            pagination: prev.pagination
              ? { ...prev.pagination, totalItems: Math.max(0, (prev.pagination.totalItems ?? prev.items.length) - 1) }
              : null,
          }))
        }
      } else {
        setState((prev) => ({
          ...prev,
          items: prev.items.map((item) =>
            item._id === id
              ? {
                  ...item,
                  ...(updated || {}),
                  status: updated?.status || nextStatus,
                  statusNote: updated?.statusNote ?? draftNote.trim(),
                }
              : item,
          ),
        }))
      }
    } catch (error) {
      if (error.status === 401) {
        onUnauthorized?.()
        return
      }
      setActionError(error.message)
    } finally {
      setBusyId(null)
    }
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
      <div className="toolbar">
        <label className="field">
          <span className="field__label">Başvuru kaynağı</span>
          <select className="field__input" value={source} onChange={event => { setSource(event.target.value); setPage(1) }}>
            <option value="forms">Etkinlik sitesi başvuruları</option>
            <option value="legacy">Eski takım başvuruları</option>
          </select>
        </label>
        <label className="field">
          <span className="field__label">Durum filtresi</span>
          <select
            aria-label="Durum filtresi"
            className="field__input"
            value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }}
          >
            <option value="ALL">Tümü</option>
            <option value="PENDING">Beklemede</option>
            <option value="APPROVED">Onaylandı</option>
            <option value="REJECTED">Reddedildi</option>
          </select>
        </label>
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

      {actionNotice && (
        <p className="form-message form-message--success" role="status">
          {actionNotice}
        </p>
      )}

      {actionError && (
        <p className="form-message form-message--error" role="alert">
          <strong>Hata:</strong> {actionError}
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
          {query || statusFilter !== 'ALL' ? 'Filtrenle eşleşen başvuru bulunamadı.' : 'Henüz hackathon başvurusu yok.'}
        </p>
      )}

      {status === 'ready' && items.length > 0 && (
        <ul className="app-grid">
          {items.map((record) => {
            const answers = Object.fromEntries((record.answers || []).map(answer => [answer.fieldId, answer.value]))
            const app = record.answers ? {
              ...record,
              teamName: answers.teamName || answers.fullName || record.verifiedEmail,
              leaderName: answers.fullName,
              leaderEmail: record.verifiedEmail,
              leaderPhone: answers.phone || answers.tel,
              appliedAt: record.submittedAt,
              projectIdea: answers.motivation || answers.projectIdea,
            } : {
              ...record,
              leaderName: record.leaderName || record.fullName,
              leaderPhone: record.leaderPhone || record.phone,
              projectIdea: record.projectIdea || record.motivation,
            }

            const currentStatus = record.status || 'PENDING'
            const statusClass =
              currentStatus === 'APPROVED'
                ? 'panel__badge--approved'
                : currentStatus === 'REJECTED'
                  ? 'panel__badge--rejected'
                  : 'panel__badge--pending'
            const draftNote = notesById[record._id] ?? record.statusNote ?? ''
            const notifyChecked = notifyById[record._id] ?? true
            const cardBusy = busyId === record._id

            const hasPhone = Boolean(
              app.leaderPhone &&
              String(app.leaderPhone).trim() !== '' &&
              String(app.leaderPhone).trim() !== 'undefined' &&
              String(app.leaderPhone).trim() !== 'null'
            )

            const hasIdea = Boolean(
              app.projectIdea &&
              String(app.projectIdea).trim() !== '' &&
              String(app.projectIdea).trim() !== 'undefined' &&
              String(app.projectIdea).trim() !== 'null'
            )

            return (
            <li key={app._id} className="app-card">
              <div className="app-card__head">
                <h2 className="app-card__team">{app.teamName}</h2>
                <div className="app-card__badges">
                  <span className={`panel__badge ${statusClass}`}>
                    {STATUS_LABELS[currentStatus] || currentStatus}
                  </span>
                  {app.memberCount && <span className="panel__badge">{app.memberCount} kişi</span>}
                </div>
              </div>
              <p className="app-card__leader">{app.leaderName}</p>
              <p className="app-card__contact">
                {app.leaderEmail && <a href={`mailto:${app.leaderEmail}`}>{app.leaderEmail}</a>}
                {hasPhone && <a href={`tel:${app.leaderPhone}`}>{app.leaderPhone}</a>}
              </p>
              {record.answers && <details><summary>Başvuru yanıtları</summary><dl>{record.answers.map(answer => <div key={answer.fieldId}><dt>{answer.label}</dt><dd>{Array.isArray(answer.value) ? answer.value.join(', ') : String(answer.value ?? '')}</dd></div>)}</dl></details>}
              {hasIdea && (
                <details className="app-card__idea">
                  <summary>Proje fikri</summary>
                  <p>{app.projectIdea}</p>
                </details>
              )}
              {record.lastNotifiedAt && (
                <p className="app-card__meta">
                  Son e-posta bildirimi: {STATUS_LABELS[record.lastNotifiedStatus] || record.lastNotifiedStatus} ({formatDate(record.lastNotifiedAt)})
                </p>
              )}
              <div className="app-card__review">
                <input
                  className="field__input"
                  type="text"
                  maxLength={1000}
                  aria-label={`Değerlendirme notu — ${app.teamName}`}
                  placeholder="Katılımcıya iletilecek not (opsiyonel)"
                  value={draftNote}
                  disabled={cardBusy}
                  onChange={(event) => setNotesById((prev) => ({ ...prev, [record._id]: event.target.value }))}
                />
                <label className="app-card__notify">
                  <input
                    type="checkbox"
                    checked={notifyChecked}
                    disabled={cardBusy}
                    onChange={(event) => setNotifyById((prev) => ({ ...prev, [record._id]: event.target.checked }))}
                  />
                  Karar e-postası gönder
                </label>
                <div className="app-card__actions">
                  <button
                    type="button"
                    className="btn btn--approve"
                    disabled={cardBusy || currentStatus === 'APPROVED'}
                    onClick={() => handleStatusChange(record, 'APPROVED')}
                  >
                    Onayla
                  </button>
                  <button
                    type="button"
                    className="btn btn--reject"
                    disabled={cardBusy || currentStatus === 'REJECTED'}
                    onClick={() => handleStatusChange(record, 'REJECTED')}
                  >
                    Reddet
                  </button>
                  {currentStatus !== 'PENDING' && (
                    <button
                      type="button"
                      className="btn btn--outline"
                      disabled={cardBusy}
                      onClick={() => handleStatusChange(record, 'PENDING', { forceNotify: false })}
                    >
                      Beklemeye al
                    </button>
                  )}
                </div>
              </div>
              <div className="app-card__foot">
                <time className="app-card__date" dateTime={app.appliedAt}>
                  {formatDate(app.appliedAt)}
                </time>
                {app.resumeUrl && (
                  /^https?:\/\//i.test(app.resumeUrl) ? (
                    <a
                      href={app.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Özgeçmiş indir
                    </a>
                  ) : (
                    <button type="button" onClick={() => downloadFile(app.resumeUrl, 'ozgecmis')}>Özgeçmiş indir</button>
                  )
                )}
                {(record.uploadedFiles || []).map(file => (
                  /^https?:\/\//i.test(file.url) ? (
                    <a
                      key={file.filename}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {file.originalName} indir
                    </a>
                  ) : (
                    <button type="button" key={file.filename} onClick={() => downloadFile(file.url, file.originalName)}>
                      {file.originalName} indir
                    </button>
                  )
                ))}
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
