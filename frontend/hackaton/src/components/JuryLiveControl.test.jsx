import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import JuryLiveControl from './JuryLiveControl.jsx'

const order = [
  { team: 'a', teamName: 'Alfa', projectName: 'Robot', position: 1, state: 'CLOSED' },
  { team: 'b', teamName: 'Beta', projectName: '', position: 2, state: 'VOTING' },
  { team: 'c', teamName: 'Gama', projectName: '', position: 3, state: 'WAITING' },
]
const votes = [
  { id: 'j1', name: 'Ayşe', active: true, status: 'SUBMITTED' },
  { id: 'j2', name: 'Mehmet', active: true, status: 'DRAFT' },
  { id: 'j3', name: 'Pasif', active: false, status: 'NONE' },
]
const voting = { open: true, locked: false, started: true, order, current: { team: 'b', teamName: 'Beta', position: 2 }, next: { team: 'c', teamName: 'Gama', position: 3 }, votes }
const idle = { ...voting, current: null, votes: [], order: order.map((e) => (e.team === 'b' ? { ...e, state: 'CLOSED' } : e)) }

const setup = (live, { isAdmin = true } = {}) => {
  const client = {
    live: vi.fn(async () => live),
    startVoting: vi.fn(async () => ({ ...live, current: live.next })),
    endVoting: vi.fn(async () => ({ ...idle, ended: 'Beta' })),
    reopenVoting: vi.fn(async () => live),
    shuffle: vi.fn(async () => live),
  }
  const props = { onChanged: vi.fn(), onNote: vi.fn(), onError: vi.fn() }
  render(<JuryLiveControl live={live} stale={false} isAdmin={isAdmin} client={client} {...props} />)
  return { client, ...props, user: userEvent.setup() }
}
afterEach(() => vi.restoreAllMocks())

describe('Sunum akışı', () => {
  it('değerlendirme kapalıysa nereden açılacağını söyler', () => {
    setup({ ...idle, open: false })
    expect(screen.getByText(/Proje değerlendirme kapalı/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Oylamayı başlat' })).not.toBeInTheDocument()
  })

  it('oy vermeyen aktif jüri varken bitirme kapalıdır; pasif jüri sayılmaz; "Yine de bitir" onay ister', async () => {
    const { client, user } = setup(voting)
    expect(screen.getByRole('heading', { name: '2. Beta' })).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oylamayı bitir' })).toBeDisabled()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'Yine de bitir' }))
    expect(confirm.mock.calls[0][0]).toMatch(/Mehmet/)
    expect(confirm.mock.calls[0][0]).not.toMatch(/Pasif/)
    expect(client.endVoting).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Yine de bitir' }))
    expect(client.endVoting).toHaveBeenCalledWith(true)
  })

  it('herkes oy verince bitirilir; sonra sıradaki takım başlatılır', async () => {
    const { client, onNote, user } = setup({ ...voting, votes: votes.map((v) => ({ ...v, status: 'SUBMITTED' })) })
    await user.click(screen.getByRole('button', { name: 'Oylamayı bitir' }))
    expect(client.endVoting).toHaveBeenCalledWith(false)
    expect(onNote).toHaveBeenCalledWith({ text: 'Beta oylaması bitti. Sıradaki: Gama.' })
  })

  it('boşta: sıradaki takım başlatılır; biten takımı yalnız ADMIN yeniden açar', async () => {
    const { client, user } = setup(idle)
    expect(screen.getByRole('heading', { name: '3. Gama' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Oylamayı başlat' }))
    expect(client.startVoting).toHaveBeenCalledWith('c')
    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Bitti')
    expect(within(rows[0]).getByRole('button', { name: 'Yeniden aç' })).toBeInTheDocument()
  })

  it('ORGANIZER yeniden açamaz ve sırayı karıştıramaz', () => {
    setup({ ...idle, started: false }, { isAdmin: false })
    expect(screen.queryByRole('button', { name: 'Yeniden aç' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sırayı yeniden karıştır' })).not.toBeInTheDocument()
  })
})
