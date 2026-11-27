import { API_URL, api } from './eventApi.js'

/**
 * Jüri linkinin işlemleri.
 * @param {string} token
 */
export function juryApi(token) {
  const call = (path, options = {}) => api(`/jury${path}`, { token, ...options }).then((result) => result.data)
  const entry = (team) => `/entries/${encodeURIComponent(team)}`
  return {
    me: () => call('/me'),
    entry: (team) => call(entry(team)),
    save: (team, body) => call(`${entry(team)}/scorecard`, { method: 'PUT', body }),
  }
}

/**
 * /admin/juri işlemleri (ORGANIZER/ADMIN).
 * @param {string} token
 */
export function juryAdminApi(token) {
  const call = (path, options = {}) => api(`/jury-admin${path}`, { token, ...options }).then((result) => result.data)
  return {
    config: () => call('/config'),
    saveConfig: (body) => call('/config', { method: 'PUT', body }),
    teams: () => call('/teams'),
    jurors: () => call('/jurors'),
    createJuror: (name) => call('/jurors', { method: 'POST', body: { name } }),
    regenerate: (id) => call(`/jurors/${encodeURIComponent(id)}/regenerate`, { method: 'POST' }),
    updateJuror: (id, body) => call(`/jurors/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    setLock: (locked) => call('/lock', { method: 'PUT', body: { locked } }),
    reset: (confirm) => call('/scorecards/reset', { method: 'POST', body: { confirm } }),
    results: () => call('/results'),
    latePushes: (deadline = '') => call(deadline ? `/late-pushes?deadline=${encodeURIComponent(deadline)}` : '/late-pushes'),
    live: () => call('/live'),
    startVoting: (team) => call('/live/start', { method: 'POST', body: { team } }),
    endVoting: (force = false) => call('/live/end', { method: 'POST', body: { force } }),
    reopenVoting: (team) => call('/live/reopen', { method: 'POST', body: { team } }),
    shuffle: () => call('/live/shuffle', { method: 'POST', body: {} }),
    log: (before) => call(before ? `/log?before=${encodeURIComponent(before)}` : '/log'),
    voidCard: (juror, team, body) =>
      call(`/jurors/${encodeURIComponent(juror)}/scorecards/${encodeURIComponent(team)}/void`, { method: 'POST', body }),
    /** api() JSON bekler; dosya için yanıt gövdesi olduğu gibi alınır. @returns {Promise<Blob>} */
    async csv() {
      let response
      try {
        response = await fetch(`${API_URL}/api/v1/jury-admin/results.csv`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15000),
        })
      } catch {
        throw new Error('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.')
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw Object.assign(new Error(data.message || `Sunucu hatası (${response.status})`), { status: response.status })
      }
      return response.blob()
    },
  }
}
