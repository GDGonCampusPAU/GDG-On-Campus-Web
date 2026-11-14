import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Teams from './Teams.jsx'
import * as api from '../lib/api.js'
import { render } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({
  getTeams: vi.fn(),
  removeTeamMember: vi.fn(),
  setTeamCaptain: vi.fn(),
  disbandTeam: vi.fn(),
}))

const session = { token: 'staff', user: { id: 'a1', fullName: 'Admin', role: 'ADMIN' } }
const person = (id, name, extra = {}) => ({ id, name, email: `${id}@example.com`, adminStatus: 'PENDING', captain: false, edited: false, ...extra })
const ekip = {
  id: 't1', name: 'Deneme Ekibi', code: 'RQP9FE', size: 3, maxSize: 4, allApproved: false,
  members: [person('c', 'Ece Kaptan', { captain: true, adminStatus: 'APPROVED' }), person('m', 'Mert Üye', { edited: true })],
  requests: [person('r', 'Deniz İstek')],
}
const diger = { id: 't2', name: 'Yıldızlar', code: 'ABC234', size: 1, maxSize: 4, allApproved: true,
  members: [person('y', 'Yıldız Kaptan', { captain: true, adminStatus: 'APPROVED' })], requests: [] }

const confirm = async (user, scope, trigger, confirmLabel) => {
  await user.click(within(scope).getByRole('button', { name: trigger }))
  await user.click(within(within(scope).getByRole('group', { name: trigger })).getByRole('button', { name: confirmLabel }))
}
const card = (name) => screen.getByRole('heading', { level: 2, name }).closest('li')

beforeEach(() => {
  vi.resetAllMocks()
  api.getTeams.mockResolvedValue([ekip, diger])
})

test('lists teams with members, e-mails, admin decisions, requests and readiness', async () => {
  render(<Teams session={session} />)
  const team = card(await screen.findByRole('heading', { level: 2, name: 'Deneme Ekibi' }).then((h) => h.textContent))
  expect(within(team).getByText('RQP9FE')).toBeInTheDocument()
  expect(within(team).getByText('3/4 kişi')).toBeInTheDocument()
  expect(within(team).getByText('1 bekleyen istek')).toBeInTheDocument()
  expect(within(team).getByText('Kaptan')).toBeInTheDocument()
  expect(within(team).getByText('c@example.com')).toBeInTheDocument()
  expect(within(team).getByText('Bilgilerini güncelledi')).toBeInTheDocument()
  expect(within(team).getByText('Deniz İstek')).toBeInTheDocument()
  expect(within(card('Yıldızlar')).getByText('Tamamı onaylı')).toBeInTheDocument()
  // The captain row has no member actions.
  const captainRow = within(team).getByText('Ece Kaptan').closest('li')
  expect(within(captainRow).queryByRole('button')).not.toBeInTheDocument()
})

test('a team code in the URL filters and highlights that team; search also works', async () => {
  const user = userEvent.setup()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  render(<Teams session={session} />, { route: '/teams?kod=rqp9fe' })
  await screen.findByRole('heading', { level: 2, name: 'Deneme Ekibi' })
  expect(screen.queryByRole('heading', { level: 2, name: 'Yıldızlar' })).not.toBeInTheDocument()
  expect(card('Deneme Ekibi')).toHaveClass('team-card--focus')
  const search = screen.getByLabelText('Ara')
  await user.clear(search)
  await user.type(search, 'yıldız')
  expect(screen.getByRole('heading', { level: 2, name: 'Yıldızlar' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'Deneme Ekibi' })).not.toBeInTheDocument()
})

test('staff change the captain, remove members and requests, and disband — each after confirmation', async () => {
  const user = userEvent.setup()
  render(<Teams session={session} />)
  await screen.findByRole('heading', { level: 2, name: 'Deneme Ekibi' })

  const mertRow = within(card('Deneme Ekibi')).getByText('Mert Üye').closest('li')
  await user.click(within(mertRow).getByRole('button', { name: 'Kaptan yap' }))
  expect(api.setTeamCaptain).not.toHaveBeenCalled()
  await user.click(within(mertRow).getByRole('button', { name: 'Vazgeç' }))

  api.setTeamCaptain.mockResolvedValueOnce([ekip, diger])
  await confirm(user, mertRow, 'Kaptan yap', 'Kaptan yap')
  expect(api.setTeamCaptain).toHaveBeenCalledWith('t1', 'm', 'staff')
  expect(await screen.findByText('Mert Üye artık Deneme Ekibi takımının kaptanı.')).toBeInTheDocument()

  api.removeTeamMember.mockResolvedValueOnce([ekip, diger])
  await confirm(user, within(card('Deneme Ekibi')).getByText('Mert Üye').closest('li'), 'Takımdan çıkar', 'Çıkar')
  expect(api.removeTeamMember).toHaveBeenLastCalledWith('t1', 'm', 'staff')

  api.removeTeamMember.mockResolvedValueOnce([{ ...ekip, requests: [] }, diger])
  await confirm(user, within(card('Deneme Ekibi')).getByText('Deniz İstek').closest('li'), 'İsteği sil', 'Sil')
  expect(api.removeTeamMember).toHaveBeenLastCalledWith('t1', 'r', 'staff')
  expect(await screen.findByText('Deniz İstek adlı kişinin katılma isteği silindi.')).toBeInTheDocument()

  api.disbandTeam.mockResolvedValueOnce([diger])
  const head = within(card('Deneme Ekibi')).getByRole('heading', { level: 2 }).parentElement.parentElement
  await confirm(user, head, 'Takımı dağıt', 'Dağıt')
  expect(api.disbandTeam).toHaveBeenCalledWith('t1', 'staff')
  expect(await screen.findByText(/Deneme Ekibi takımı dağıtıldı/)).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'Deneme Ekibi' })).not.toBeInTheDocument()
})

test('shows server errors and logs out on 401', async () => {
  const user = userEvent.setup()
  const unauthorized = vi.fn()
  render(<Teams session={session} onUnauthorized={unauthorized} />)
  await screen.findByRole('heading', { level: 2, name: 'Deneme Ekibi' })
  api.removeTeamMember.mockRejectedValueOnce(Object.assign(new Error('Kaptan takımdan çıkarılamaz.'), { status: 409 }))
  await confirm(user, within(card('Deneme Ekibi')).getByText('Mert Üye').closest('li'), 'Takımdan çıkar', 'Çıkar')
  expect(await screen.findByRole('alert')).toHaveTextContent('Kaptan takımdan çıkarılamaz.')

  api.getTeams.mockRejectedValueOnce({ status: 401 })
  render(<Teams session={session} onUnauthorized={unauthorized} />)
  await vi.waitFor(() => expect(unauthorized).toHaveBeenCalled())
})
