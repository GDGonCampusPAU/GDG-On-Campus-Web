// Jüri testlerinin sahte sunucusu: sürüm, tur, kilit ve "gönderilmiş kart" kurallarını API gibi uygular.
import { vi } from 'vitest'

export const CRITERIA = [
  { key: 'technical', label: 'Teknik uygulama', description: 'Çalışıyor mu?', weight: 50 },
  { key: 'originality', label: 'Fikir özgünlüğü', description: 'Yeni mi?', weight: 30 },
  { key: 'demo', label: 'Demo ve sunum', description: 'Net mi?', weight: 20 },
]
export const CATEGORIES = [
  { key: 'wow', name: 'Vay Be', icon: '🚀' },
  { key: 'dreamTeam', name: 'Dream Team', icon: '⚙️' },
]

export const failure = (status, code, message = 'Hata') => Object.assign(new Error(message), { status, code })
export const networkError = () => new Error('Sunucuya ulaşılamadı. Lütfen tekrar deneyin.')

export const makeCard = (value, changes = {}) => ({
  scores: CRITERIA.map(({ key }) => ({ criterion: key, value, comment: '' })),
  nominations: [],
  generalComment: '',
  status: 'DRAFT',
  version: 1,
  ...changes,
})

export function fakeJuryServer({ cards = {}, locked = false, round = 1, live = null } = {}) {
  const server = {
    locked,
    round,
    // Canlı oylama: { open, current: 't1' | null, closed: ['t2'] } ya da null (eski serbest puanlama).
    live,
    offline: false,
    invalid: false,
    cards: { ...cards },
    entries: [
      { team: 't1', order: 1, teamName: 'Çılgın Kodcular', projectName: 'Kampüs Asistanı', repoUrl: 'https://example.com/repo', demoUrl: '', presentationUrl: '' },
      { team: 't2', order: 2, teamName: 'Işık Hızı', projectName: '', repoUrl: '', demoUrl: '', presentationUrl: '' },
      { team: 't3', order: 3, teamName: 'Üçüncü Takım', projectName: '', repoUrl: '', demoUrl: '', presentationUrl: '' },
    ],
  }
  const stateOf = (team) => (server.live?.closed?.includes(team) ? 'CLOSED' : server.live?.current === team ? 'VOTING' : 'WAITING')
  const writable = (team) => !server.locked && stateOf(team) !== 'CLOSED' && (!server.live?.open || stateOf(team) === 'VOTING')
  const guard = () => {
    if (server.offline) throw networkError()
    if (server.invalid) throw failure(401, 'JURY_LINK_INVALID')
  }
  server.client = {
    me: vi.fn(async () => {
      guard()
      return structuredClone({
        juror: { id: 'j1', name: 'Ayşe Yılmaz' },
        locked: server.locked,
        round: server.round,
        criteria: CRITERIA,
        categories: CATEGORIES,
        entries: server.entries.map(({ team, order, teamName, projectName }) => ({ team, order, teamName, projectName, status: server.cards[team]?.status ?? 'NONE',
          ...(server.live ? { live: stateOf(team), writable: writable(team) } : {}) })),
        ...(server.live ? { live: { open: server.live.open, current: server.live.open && server.live.current
          ? { team: server.live.current, teamName: server.entries.find((e) => e.team === server.live.current).teamName, position: 1 } : null } } : {}),
      })
    }),
    entry: vi.fn(async (team) => {
      guard()
      return structuredClone({ entry: server.entries.find((entry) => entry.team === team), locked: server.locked, round: server.round, scorecard: server.cards[team] ?? null })
    }),
    save: vi.fn(async (team, { submit, round: sentRound, version, ...content }) => {
      guard()
      if (server.locked) throw failure(423, 'JURY_LOCKED')
      if (server.live && !writable(team)) throw failure(423, stateOf(team) === 'CLOSED' ? 'VOTING_CLOSED' : 'VOTING_NOT_OPEN')
      if (sentRound !== server.round) throw failure(409, 'JURY_RESET')
      const card = server.cards[team]
      if (card?.status === 'SUBMITTED' && !submit) throw failure(409, 'SCORECARD_SUBMITTED')
      if ((card?.version ?? 0) !== version) throw failure(409, 'SCORECARD_CONFLICT')
      server.cards[team] = { ...structuredClone(content), status: submit ? 'SUBMITTED' : (card?.status ?? 'DRAFT'), version: version + 1 }
      return { scorecard: structuredClone(server.cards[team]) }
    }),
  }
  return server
}
