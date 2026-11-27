import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import JuryLateCheck from './JuryLateCheck.jsx'

const team = (over) => ({ team: 't', teamName: 'Takım', repoUrl: 'https://github.com/a/b', competing: true, status: 'ON_TIME', lateCount: 0,
  forcedLate: false, latePushes: [], earlyCount: 0, lastPushAt: '2026-11-27T14:00:00.000Z', truncated: false, ...over })
const report = (over = {}) => ({
  deadline: '2026-11-27T15:00:00.000Z', deadlineSource: 'CLOSED_AT', closedAt: '2026-11-27T15:00:00.000Z', uploadOpen: false,
  eventStartsAt: '2026-11-27T06:00:00.000Z', checkedAt: '2026-11-27T16:00:00.000Z', authenticated: true,
  teams: [
    team({ team: 't1', teamName: 'Geç Kalan', status: 'LATE', lateCount: 2, forcedLate: true, latePushes: [
      { at: '2026-11-27T15:20:00.000Z', type: 'force_push', actor: 'ali', ref: 'main', url: 'https://github.com/a/b/compare/1...2' },
      { at: '2026-11-27T15:05:00.000Z', type: 'push', actor: 'ayse', ref: 'main', url: 'https://github.com/a/b/commit/3' }] }),
    team({ team: 't2', teamName: 'Zamanında', earlyCount: 1 }),
    team({ team: 't3', teamName: 'Linksiz', status: 'NO_REPO', repoUrl: null, lastPushAt: null }),
  ],
  summary: { late: 1, forced: 1, unavailable: 0, noRepo: 1 },
  ...over,
})

describe('Teslim kontrolü', () => {
  it('kapanış anına göre teslimden sonra push yapanları gösterir, ayrıntıda push listesi açılır', async () => {
    const client = { latePushes: vi.fn(async () => report()) }
    render(<JuryLateCheck client={client} onError={vi.fn()} />)
    expect(await screen.findByText(/1 takım teslimden sonra push yaptı, 1 tanesi force push/)).toBeInTheDocument()
    expect(screen.getByText(/proje yüklemenin kapatıldığı an/)).toBeInTheDocument()
    expect(screen.getByText('Force push var')).toBeInTheDocument()
    expect(screen.getByText('Link yok')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Geç Kalan' }))
    const links = screen.getAllByRole('link', { name: 'Değişiklikleri GitHub’da gör' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', 'https://github.com/a/b/compare/1...2')
    expect(within(links[0].closest('li')).getByText(/Force push · main · @ali/)).toBeInTheDocument()
  })

  it('yükleme açıkken teslim zamanı yok der; elle girilen zamanla (UTC+3) yeniden sorar', async () => {
    const client = { latePushes: vi.fn(async (deadline) => (deadline
      ? report({ deadline: '2026-11-27T14:30:00.000Z', deadlineSource: 'CUSTOM' })
      : report({ deadline: null, deadlineSource: 'NONE', closedAt: null, uploadOpen: true, summary: { late: 0, forced: 0, unavailable: 0, noRepo: 1 } }))) }
    render(<JuryLateCheck client={client} onError={vi.fn()} />)
    expect(await screen.findByText(/Proje yükleme hâlâ açık, teslim zamanı yok/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Başka bir teslim zamanına göre bak'), '2026-11-27T17:30')
    await userEvent.click(screen.getByRole('button', { name: 'Bu zamana göre kontrol et' }))
    expect(client.latePushes).toHaveBeenLastCalledWith('2026-11-27T17:30:00+03:00')
    expect(await screen.findByText(/\(elle girildi\)/)).toBeInTheDocument()
  })

  it('hata üst bileşene gider', async () => {
    const error = Object.assign(new Error('Oturum bitti'), { status: 401 })
    const onError = vi.fn()
    render(<JuryLateCheck client={{ latePushes: vi.fn(async () => { throw error }) }} onError={onError} />)
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error))
  })
})
