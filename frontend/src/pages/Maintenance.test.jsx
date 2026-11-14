import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Maintenance from './Maintenance.jsx'
import * as api from '../lib/api.js'
import { render } from '../test/render.jsx'

vi.mock('../lib/api.js', () => ({ getMaintenance: vi.fn(), setMaintenance: vi.fn() }))

const session = { token: 'admin', user: { id: 'a1', fullName: 'Admin', role: 'ADMIN' } }
const off = { active: false, since: null, by: null, server: 'stopped' }
const on = { active: true, since: '2026-11-14T13:30:00.000Z', by: { id: 'a1', name: 'Ada Yönetici' }, server: 'running' }

beforeEach(() => vi.resetAllMocks())

test('starting maintenance asks for confirmation first', async () => {
  const user = userEvent.setup()
  api.getMaintenance.mockResolvedValue(off)
  render(<Maintenance session={session} />)
  expect(await screen.findByText('Site yayında')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Bakım sayfasını önizle' })).toHaveAttribute('href', 'http://localhost:5173/maintenance.html')

  await user.click(screen.getByRole('button', { name: 'Bakım modunu başlat' }))
  await user.click(screen.getByRole('button', { name: 'Vazgeç' }))
  expect(api.setMaintenance).not.toHaveBeenCalled()

  api.setMaintenance.mockResolvedValueOnce(on)
  await user.click(screen.getByRole('button', { name: 'Bakım modunu başlat' }))
  await user.click(screen.getByRole('button', { name: 'Başlat' }))
  expect(api.setMaintenance).toHaveBeenCalledWith(true, 'admin')
  expect(await screen.findByText('Site bakımda')).toBeInTheDocument()
  expect(screen.getByText(/Ada Yönetici tarafından açıldı/)).toBeInTheDocument()
  expect(screen.getByText(/backend, panel ve site kapatılsa bile/)).toBeInTheDocument()
})

test('stopping maintenance puts the site back', async () => {
  const user = userEvent.setup()
  api.getMaintenance.mockResolvedValue(on)
  api.setMaintenance.mockResolvedValueOnce(off)
  render(<Maintenance session={session} />)
  await user.click(await screen.findByRole('button', { name: 'Bakım modunu durdur' }))
  expect(api.setMaintenance).toHaveBeenCalledWith(false, 'admin')
  expect(await screen.findByRole('status')).toHaveTextContent('Site yeniden yayında')
  expect(screen.getByText('Site yayında')).toBeInTheDocument()
})

test('shows errors and logs out on 401', async () => {
  const unauthorized = vi.fn()
  api.getMaintenance.mockRejectedValueOnce({ status: 401 })
  render(<Maintenance session={session} onUnauthorized={unauthorized} />)
  await vi.waitFor(() => expect(unauthorized).toHaveBeenCalled())

  api.getMaintenance.mockRejectedValueOnce(Object.assign(new Error('Sunucuya ulaşılamadı.'), { status: 0 }))
  render(<Maintenance session={session} onUnauthorized={unauthorized} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Sunucuya ulaşılamadı.')
})
