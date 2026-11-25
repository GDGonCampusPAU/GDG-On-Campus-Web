import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Permissions from './Permissions.jsx'
import * as api from '../lib/api.js'
import { render } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({ getPermissions: vi.fn(), setPermissions: vi.fn() }))

const session = { token: 'admin', user: { id: 'a1', fullName: 'Admin', role: 'ADMIN' } }
const OPEN = { registration: true, teamChanges: true, answerEditing: true, projectUpload: true, projectEvaluation: false, closedReason: '', closedEnding: '' }
const card = (name) => screen.getByRole('region', { name })
const confirmIn = (label) => within(screen.getByRole('group', { name: label }))

beforeEach(() => vi.resetAllMocks())

test('shows every permission; closing one asks for confirmation first', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue(OPEN)
  render(<Permissions session={session} />)
  expect(await screen.findByRole('heading', { name: 'Takım değişiklikleri' })).toBeInTheDocument()
  for (const name of ['Kayıtlar', 'Takım değişiklikleri', 'Bilgileri düzenleme', 'Proje yükleme']) expect(within(card(name)).getByText('Açık')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Takım değişikliklerini kapat' }))
  await user.click(confirmIn('Takım değişikliklerini kapat').getByRole('button', { name: 'Vazgeç' }))
  expect(api.setPermissions).not.toHaveBeenCalled()

  api.setPermissions.mockResolvedValueOnce({ ...OPEN, teamChanges: false })
  await user.click(screen.getByRole('button', { name: 'Takım değişikliklerini kapat' }))
  await user.click(confirmIn('Takım değişikliklerini kapat').getByRole('button', { name: 'Kapat' }))
  expect(api.setPermissions).toHaveBeenCalledWith({ teamChanges: false }, 'admin')
  expect(await screen.findByText(/Takım değişiklikleri kapatıldı/)).toBeInTheDocument()
  expect(within(card('Takım değişiklikleri')).getByText('Kapalı')).toBeInTheDocument()
  expect(within(card('Bilgileri düzenleme')).getByText('Açık')).toBeInTheDocument()
})

test('project upload can be closed when the submission time is over', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue(OPEN)
  api.setPermissions.mockResolvedValueOnce({ ...OPEN, projectUpload: false })
  render(<Permissions session={session} />)
  expect(await within(await screen.findByRole('region', { name: 'Proje yükleme' })).findByText(/GitHub linkini ekleyebilir/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Proje yüklemeyi kapat' }))
  await user.click(confirmIn('Proje yüklemeyi kapat').getByRole('button', { name: 'Kapat' }))
  expect(api.setPermissions).toHaveBeenCalledWith({ projectUpload: false }, 'admin')
  expect(await screen.findByText(/Proje yükleme kapatıldı/)).toBeInTheDocument()
  expect(within(card('Proje yükleme')).getByText('Kapalı')).toBeInTheDocument()
})

test('project evaluation is closed by default and opening it asks first', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue(OPEN)
  api.setPermissions.mockResolvedValueOnce({ ...OPEN, projectEvaluation: true })
  render(<Permissions session={session} />)
  expect(await within(await screen.findByRole('region', { name: 'Proje değerlendirme' })).findByText('Kapalı')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Proje değerlendirmeyi aç' }))
  expect(api.setPermissions).not.toHaveBeenCalled()
  await user.click(confirmIn('Proje değerlendirmeyi aç').getByRole('button', { name: 'Aç' }))
  expect(api.setPermissions).toHaveBeenCalledWith({ projectEvaluation: true }, 'admin')
  expect(await screen.findByText(/Sunum sırası belirlendi/)).toBeInTheDocument()
  expect(within(card('Proje değerlendirme')).getByText('Açık')).toBeInTheDocument()
})

test('opening a closed permission also asks for confirmation', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue({ ...OPEN, answerEditing: false })
  api.setPermissions.mockResolvedValueOnce(OPEN)
  render(<Permissions session={session} />)
  expect(await within(await screen.findByRole('region', { name: 'Bilgileri düzenleme' })).findByText(/Bilgilerimi gör/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Bilgi düzenlemeyi aç' }))
  expect(api.setPermissions).not.toHaveBeenCalled()
  await user.click(confirmIn('Bilgi düzenlemeyi aç').getByRole('button', { name: 'Aç' }))
  expect(api.setPermissions).toHaveBeenCalledWith({ answerEditing: true }, 'admin')
  expect(await screen.findByText('Bilgi düzenleme açıldı.')).toBeInTheDocument()
})

test('closing registration asks for the reason and ending, previews the sentence and sends both', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue(OPEN)
  render(<Permissions session={session} />)
  await user.click(await screen.findByRole('button', { name: 'Kayıtları kapat' }))
  const kapat = confirmIn('Kayıtları kapat').getByRole('button', { name: 'Kapat' })
  expect(kapat).toBeDisabled()
  expect(screen.getByText('İlginiz için teşekkür ederiz, {neden} için kaydınızı yapamıyoruz. {kapanış}')).toBeInTheDocument()

  await user.type(screen.getByLabelText(/Kapanma nedeni/), 'kontenjan  dolduğu')
  expect(screen.getByText('İlginiz için teşekkür ederiz, kontenjan dolduğu için kaydınızı yapamıyoruz. {kapanış}')).toBeInTheDocument()
  expect(kapat).toBeDisabled()
  await user.type(screen.getByLabelText(/Kapanış cümlesi/), 'Görüşmek üzere!')
  const sentence = 'İlginiz için teşekkür ederiz, kontenjan dolduğu için kaydınızı yapamıyoruz. Görüşmek üzere!'
  expect(screen.getByText(sentence)).toBeInTheDocument()

  api.setPermissions.mockResolvedValueOnce({ ...OPEN, registration: false, closedReason: 'kontenjan dolduğu', closedEnding: 'Görüşmek üzere!' })
  await user.click(kapat)
  expect(api.setPermissions).toHaveBeenCalledWith({ registration: false, closedReason: 'kontenjan dolduğu', closedEnding: 'Görüşmek üzere!' }, 'admin')
  expect(await screen.findByText(/Kayıtlar kapatıldı/)).toBeInTheDocument()
  expect(within(card('Kayıtlar')).getByText('Kapalı')).toBeInTheDocument()
  expect(within(card('Kayıtlar')).getByText(sentence)).toBeInTheDocument()
  expect(screen.queryByLabelText(/Kapanma nedeni/)).not.toBeInTheDocument()
})

test('closing registration again starts from the last texts; opening needs confirmation', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue({ ...OPEN, registration: false, closedReason: 'bakım', closedEnding: 'Yakında döneceğiz.' })
  api.setPermissions.mockResolvedValueOnce({ ...OPEN, closedReason: 'bakım', closedEnding: 'Yakında döneceğiz.' })
  render(<Permissions session={session} />)
  await user.click(await screen.findByRole('button', { name: 'Kayıtları aç' }))
  await user.click(confirmIn('Kayıtları aç').getByRole('button', { name: 'Aç' }))
  expect(api.setPermissions).toHaveBeenCalledWith({ registration: true }, 'admin')
  await user.click(await screen.findByRole('button', { name: 'Kayıtları kapat' }))
  expect(screen.getByLabelText(/Kapanma nedeni/)).toHaveValue('bakım')
  expect(screen.getByLabelText(/Kapanış cümlesi/)).toHaveValue('Yakında döneceğiz.')
})

test('load and save errors are shown; an expired session logs out', async () => {
  const user = userEvent.setup()
  api.getPermissions.mockResolvedValue({ ...OPEN, teamChanges: false })
  api.setPermissions.mockRejectedValueOnce(Object.assign(new Error('Sunucu hatası'), { status: 500 }))
  const { unmount } = render(<Permissions session={session} />)
  await user.click(await screen.findByRole('button', { name: 'Takım değişikliklerini aç' }))
  await user.click(confirmIn('Takım değişikliklerini aç').getByRole('button', { name: 'Aç' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Sunucu hatası')
  unmount()

  const onUnauthorized = vi.fn()
  api.getPermissions.mockRejectedValueOnce(Object.assign(new Error('Oturum'), { status: 401 }))
  render(<Permissions session={session} onUnauthorized={onUnauthorized} />)
  await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalled())
})
