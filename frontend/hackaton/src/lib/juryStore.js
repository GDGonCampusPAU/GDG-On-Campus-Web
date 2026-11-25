// Jüri ekranının durumu. Sayfa düzeyinde yaşar: takım değiştirilse de önceki takımın kaydı sürer.
//
// Her takım için üç şey tutulur:
//   server: sunucudaki son bilinen kart
//   form:   ekrandaki hâli
//   base:   formun dayandığı kart sürümü
// form != server ise değişiklik var demektir; ayrıca base != server.version ise kart başka bir yerde de değişmiştir.
// Gönderilmiş kart kendiliğinden kaydedilmez: değişiklik cihazda bekler, "Yeniden gönder" ile geçerli olur.
//
// Aynı linkin sekmeleri cihazdaki tek taslağı paylaşır. Her sekme taslağın son gördüğü hâlini tutar (seen);
// cihazdaki ondan farklıysa başka sekme yazmıştır: üstüne yazılmaz, silinmez, önce o hâl alınır (follow).
import * as cache from './juryCache.js'
import { formOf, payloadOf, sameForm } from './juryForm.js'

export const AUTOSAVE_MS = 1000
export const RETRY_MS = 5000
export const RATE_LIMIT_RETRY_MS = 30000
export const POLL_MS = 20000
// Canlı oylama açıkken (sahnede sunum varken) admin'in başlat/bitir'i birkaç saniyede görülsün.
export const LIVE_POLL_MS = 4000
// Başka sekmenin taslağını, o sekme kapanmışsa kaydetmek için bekleme.
export const MIRROR_SAVE_MS = 8000

/**
 * @typedef {object} TeamState
 * @property {any} entry linklerle birlikte takım bilgisi; yüklenene kadar null
 * @property {boolean} known sunucudaki kart biliniyor mu
 * @property {any} server
 * @property {import('./juryForm.js').JuryForm} form
 * @property {number} base
 * @property {boolean} saving
 * @property {boolean} submitting
 * @property {boolean} stored değişiklik cihaza yazılabildi mi
 * @property {string} saveError
 * @property {string} submitError
 */

/** @type {TeamState} */
const BLANK = { entry: null, known: false, server: null, form: formOf(null), base: 0, saving: false, submitting: false, stored: true, saveError: '', submitError: '' }

// Ağ hatası (status yok), zaman aşımı, hız limiti, sunucu hatası ve deploy sırasındaki 502 geçicidir.
const isTemporary = (error) => !error.status || error.status === 408 || error.status === 429 || error.status >= 500
const versionOf = (card) => card?.version ?? 0
const isInvalidLink = (error) => error.status === 401 || error.code === 'JURY_LINK_INVALID'

/**
 * Görünümde kullanılan türetilmiş bilgiler.
 * @param {{ key: string }[]} criteria @param {TeamState | undefined} team @param {string} [listed] listedeki durum
 */
export function describeTeam(criteria, team, listed = 'NONE') {
  if (!team?.known) return { dirty: false, submitted: listed === 'SUBMITTED', unsent: false, conflict: false, status: listed }
  const dirty = !sameForm(criteria, team.form, formOf(team.server))
  const submitted = team.server?.status === 'SUBMITTED'
  return {
    dirty,
    submitted,
    unsent: submitted && dirty,
    // base daha büyükse başka sekme kaydetmiş, bu sekme henüz tazelenmemiştir: çakışma değildir.
    conflict: dirty && team.base < versionOf(team.server),
    status: submitted ? 'SUBMITTED' : team.server || dirty ? 'DRAFT' : 'NONE',
  }
}

/**
 * @param {string} token
 * @param {{ me: () => Promise<any>, entry: (team: string) => Promise<any>, save: (team: string, body: any) => Promise<any> }} client
 */
export function createJuryStore(token, client) {
  /** @type {{ phase: 'loading' | 'ready' | 'invalid' | 'error', error: string, offline: boolean, wasReset: boolean, me: any, teams: Record<string, TeamState> }} */
  let state = { phase: 'loading', error: '', offline: false, wasReset: false, me: null, teams: {} }
  let running = false
  let refreshing = null
  let poll
  let livePoll
  const listeners = new Set()
  const timers = new Map()
  const queues = new Map()
  /** @type {Map<string, string | null>} */
  const seen = new Map()

  const set = (changes) => {
    state = { ...state, ...changes }
    listeners.forEach((listener) => listener())
  }
  const team = (id) => state.teams[id] ?? BLANK
  /** Bu takıma şimdi yazılabilir mi: genel kilit yok ve canlı oylama kuralı izin veriyor (sunucu hesaplar). */
  const canWrite = (id) => Boolean(state.me) && !state.me.locked && state.me.entries?.find((entry) => entry.team === id)?.writable !== false
  const info = (id) => describeTeam(state.me?.criteria ?? [], team(id))

  function update(id, changes) {
    let next = { ...team(id), ...changes }
    if (state.me && next.known) {
      const { juror, round, criteria } = state.me
      const clean = sameForm(criteria, next.form, formOf(next.server))
      // Taslağı son gördüğümüzden beri başka sekme yazdıysa yedek onundur.
      if (cache.draftText(juror.id, round, id) === (seen.get(id) ?? null)) {
        if (clean) {
          cache.clearDraft(juror.id, round, id)
          seen.set(id, null)
          next = { ...next, stored: true }
        } else {
          const text = cache.saveDraft(juror.id, round, id, { form: next.form, base: next.base })
          if (text !== null) seen.set(id, text)
          next = { ...next, stored: text !== null }
        }
      }
    }
    set({ teams: { ...state.teams, [id]: next } })
  }

  /** Başka sekmenin yazdığı taslağı alır; cihaza hiçbir şey yazmaz. */
  function follow(id) {
    const current = team(id)
    if (!state.me || !current.known) return
    const text = cache.draftText(state.me.juror.id, state.me.round, id)
    if (text === (seen.get(id) ?? null)) return
    seen.set(id, text)
    const draft = cache.parseDraft(text)
    const form = draft?.form ?? formOf(current.server)
    const base = draft?.base ?? versionOf(current.server)
    set({ teams: { ...state.teams, [id]: { ...current, form, base, stored: true, saveError: '', submitError: '' } } })
    schedule(id, MIRROR_SAVE_MS)
    // Taslak kalktıysa ya da daha yeni bir karta dayanıyorsa o sekme sunucuya kaydetmiştir.
    if (!draft || base > versionOf(current.server)) void loadTeam(id)
  }
  const followAll = () => Object.keys(state.teams).forEach(follow)

  function remember() {
    if (!state.me) return
    const teams = Object.entries(state.teams)
      .filter(([, value]) => value.known)
      .map(([id, { entry, server }]) => [id, { entry, server }])
    cache.saveView(token, { me: state.me, teams: Object.fromEntries(teams) })
  }

  function invalidate() {
    timers.forEach(clearTimeout)
    timers.clear()
    cache.clearView(token)
    set({ phase: 'invalid' })
  }

  /** Sunucudan gelen kartı, ekrandaki değişikliği kaybetmeden işler. */
  function adopt(id, card) {
    const current = team(id)
    const { criteria, juror, round } = state.me
    const version = versionOf(card)
    let { form, base } = current
    if (!current.known) {
      const text = cache.draftText(juror.id, round, id)
      seen.set(id, text)
      const draft = cache.parseDraft(text)
      form = draft?.form ?? formOf(card)
      base = draft?.base ?? version
    } else {
      // Geç gelen eski yanıt yeni kartın üstüne yazılmaz.
      if (version < versionOf(current.server)) return
      if (!info(id).dirty) form = formOf(card)
    }
    if (sameForm(criteria, form, formOf(card))) base = version
    update(id, { known: true, server: card, form, base })
  }

  function schedule(id, delay = AUTOSAVE_MS) {
    clearTimeout(timers.get(id))
    timers.delete(id)
    if (!running || !canWrite(id) || state.phase !== 'ready') return
    const { dirty, submitted, conflict } = info(id)
    if (!dirty || submitted || conflict) return
    timers.set(id, setTimeout(() => {
      timers.delete(id)
      void enqueue(id, false)
    }, delay))
  }

  function resume(delay = AUTOSAVE_MS) {
    for (const id of Object.keys(state.teams)) {
      if (!timers.has(id) && !team(id).saving) schedule(id, delay)
    }
  }

  /** Aynı takımın istekleri sırayla gider; hızlı dokunuşlar birbirini ezmez. */
  function enqueue(id, submit) {
    const next = (queues.get(id) ?? Promise.resolve()).then(() => send(id, submit))
    queues.set(id, next.catch(() => {}))
    return next
  }

  async function send(id, submit) {
    if (!state.me || state.phase !== 'ready' || !team(id).known) return false
    follow(id)
    const before = info(id)
    if (!canWrite(id) || before.conflict) return false
    if (!submit && (!before.dirty || before.submitted)) return false

    const { form, base } = team(id)
    const { criteria, round } = state.me
    update(id, { saving: true, saveError: '', ...(submit ? { submitError: '' } : {}) })
    try {
      const { scorecard } = await client.save(id, { ...payloadOf(criteria, form), submit, round, version: base })
      // İstek sürerken admin sıfırladıysa bu yanıt eski tura aittir.
      if (state.me.round !== round) return false
      update(id, { saving: false, server: scorecard, base: versionOf(scorecard) })
      remember()
      schedule(id)
      return true
    } catch (error) {
      if (state.me.round !== round) return false
      await recover(id, error, submit, form)
      return false
    }
  }

  async function recover(id, error, submit, sent) {
    update(id, { saving: false, saveError: error.message, ...(submit ? { submitError: error.message } : {}) })
    if (isInvalidLink(error)) return invalidate()
    if (error.code === 'JURY_LOCKED') return set({ me: { ...state.me, locked: true } })
    // Canlı oylama: bu takımın oylaması kapandı ya da henüz açılmadı; güncel durumu al.
    if (error.code === 'VOTING_CLOSED' || error.code === 'VOTING_NOT_OPEN') return refresh()
    if (error.code === 'JURY_RESET') return refresh()
    if (error.code === 'SCORECARD_CONFLICT' || error.code === 'SCORECARD_SUBMITTED') {
      try {
        const { scorecard, round } = await client.entry(id)
        if (round !== state.me.round) return await refresh()
        adopt(id, scorecard)
        // Önceki istek sunucuya ulaşmış, yalnız yanıtı kaybolmuşsa bu bir çakışma değildir.
        if (sameForm(state.me.criteria, sent, formOf(scorecard))) {
          update(id, { base: versionOf(scorecard), saveError: '', submitError: '' })
          schedule(id)
        } else {
          update(id, { saveError: '' })
        }
        remember()
      } catch {
        schedule(id, RETRY_MS)
      }
      return undefined
    }
    if (isTemporary(error)) schedule(id, error.status === 429 ? RATE_LIMIT_RETRY_MS : RETRY_MS)
    return undefined
  }

  /** Linkleri ve kartı tazeler (takım açıldığında ve durum değiştiğinde). */
  async function loadTeam(id) {
    if (!state.me || state.phase !== 'ready') return
    try {
      const { entry, scorecard, round } = await client.entry(id)
      if (round !== state.me.round) return
      update(id, { entry })
      if (team(id).saving) return
      adopt(id, scorecard)
      remember()
      schedule(id)
    } catch (error) {
      if (isInvalidLink(error)) invalidate()
    }
  }

  async function applyOverview(me) {
    const previous = state.me
    if (previous && me.round < previous.round) return
    const reset = Boolean(previous && me.round > previous.round)
    if (reset) {
      seen.clear()
      timers.forEach(clearTimeout)
      timers.clear()
    }
    cache.pruneDrafts(me.juror.id, me.round)
    set({ phase: 'ready', error: '', offline: false, me, wasReset: state.wasReset || reset, ...(reset ? { teams: {} } : {}) })

    const toLoad = []
    for (const { team: id, status } of me.entries) {
      // Hiç puanlanmamış takım ayrıntı yüklenmeden de puanlanabilir (bağlantı koparsa bile).
      if (status === 'NONE' && !team(id).known) adopt(id, null)
      const current = team(id)
      if (!current.entry || !current.known || (current.server?.status ?? 'NONE') !== status) toLoad.push(id)
    }
    remember()
    resume()
    // Bütün takımlar baştan yüklenir ki bağlantı koptuğunda takım değiştirilebilsin.
    await Promise.all(toLoad.map(loadTeam))
  }

  function openCachedView() {
    const view = cache.loadView(token)
    if (!view?.me?.juror || !Array.isArray(view.me.entries)) return false
    set({ phase: 'ready', error: '', offline: true, me: view.me })
    for (const { team: id, status } of view.me.entries) {
      const saved = view.teams?.[id]
      if (saved) {
        adopt(id, saved.server)
        update(id, { entry: saved.entry })
      } else if (status === 'NONE') {
        adopt(id, null)
      }
    }
    resume(RETRY_MS)
    return true
  }

  function refresh() {
    if (state.phase === 'invalid') return Promise.resolve()
    refreshing ??= (async () => {
      try {
        await applyOverview(await client.me())
      } catch (error) {
        if (isInvalidLink(error)) invalidate()
        else if (state.phase === 'ready') set({ offline: true })
        else if (!isTemporary(error) || !openCachedView()) set({ phase: 'error', error: error.message })
      } finally {
        refreshing = null
      }
    })()
    return refreshing
  }

  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    followAll()
    void refresh()
  }
  const onStorage = (event) => {
    if (cache.isDraftKey(event.key)) followAll()
  }
  const onOnline = () => {
    void refresh()
    timers.forEach(clearTimeout)
    timers.clear()
    resume(0)
  }
  const onBeforeUnload = (event) => {
    const atRisk = Object.keys(state.teams).some((id) => {
      const { dirty, unsent } = info(id)
      return unsent || (dirty && !team(id).stored)
    })
    if (!atRisk) return
    event.preventDefault()
    event.returnValue = ''
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    start() {
      running = true
      void refresh()
      poll = setInterval(onVisible, POLL_MS)
      livePoll = setInterval(() => { if (state.me?.live?.open) onVisible() }, LIVE_POLL_MS)
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('online', onOnline)
      window.addEventListener('storage', onStorage)
      window.addEventListener('beforeunload', onBeforeUnload)
      resume()
    },
    stop() {
      running = false
      clearInterval(poll)
      clearInterval(livePoll)
      timers.forEach(clearTimeout)
      timers.clear()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('beforeunload', onBeforeUnload)
    },
    refresh,
    loadTeam,
    canWrite,
    /** @param {string} id @param {(form: import('./juryForm.js').JuryForm) => import('./juryForm.js').JuryForm} change */
    edit(id, change) {
      follow(id)
      const current = team(id)
      if (!state.me || !canWrite(id) || !current.known || current.submitting) return
      const form = change(current.form)
      // Form sunucudakiyle aynı olduysa (geri alma, çakışmada aynı değerler) artık o sürüme dayanır.
      const clean = sameForm(state.me.criteria, form, formOf(current.server))
      update(id, { form, submitError: '', ...(clean ? { base: versionOf(current.server), saveError: '' } : {}) })
      schedule(id)
    },
    /** @returns {Promise<boolean>} */
    async submit(id) {
      if (team(id).submitting) return false
      clearTimeout(timers.get(id))
      timers.delete(id)
      update(id, { submitting: true })
      try {
        return await enqueue(id, true)
      } finally {
        update(id, { submitting: false })
      }
    },
    keepMine(id) {
      follow(id)
      update(id, { base: versionOf(team(id).server), submitError: '', saveError: '' })
      schedule(id)
    },
    useServer(id) {
      follow(id)
      const { server } = team(id)
      update(id, { form: formOf(server), base: versionOf(server), submitError: '', saveError: '' })
      schedule(id)
    },
  }
}
