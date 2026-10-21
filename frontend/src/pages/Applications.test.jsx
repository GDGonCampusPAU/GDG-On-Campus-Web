import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Applications from './Applications.jsx'
import * as api from '../lib/api.js'
vi.mock('../lib/api.js', () => ({ getHackathonApplications: vi.fn(), downloadHackathonApplicationsCsv: vi.fn(), downloadPrivateFile: vi.fn() }))
const session = { token: 'staff', user: { id: 'staff', role: 'ADMIN', fullName: 'Staff' } }
const record = { _id: 'response', verifiedEmail: 'participant@example.com', submittedAt: '2026-10-21T10:00:00Z',
  answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Participant Test' }], uploadedFiles: [] }
beforeEach(() => { vi.resetAllMocks(); api.getHackathonApplications.mockResolvedValue({ data: [record], pagination: { totalItems: 1, totalPages: 1 } }) })
test('site submissions are listed by default and all answers are available', async () => {
  render(<Applications session={session} />)
  expect(await screen.findByRole('heading', { name: 'Participant Test' })).toBeInTheDocument()
  expect(api.getHackathonApplications).toHaveBeenCalledWith(expect.objectContaining({ source: 'forms' }), 'staff')
  expect(screen.getByText('Ad soyad')).toBeInTheDocument()
})
test('legacy application source remains accessible', async () => {
  const user = userEvent.setup(); render(<Applications session={session} />)
  await screen.findByRole('heading', { name: 'Participant Test' })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Başvuru kaynağı' }), 'legacy')
  expect(api.getHackathonApplications).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'legacy' }), 'staff')
})
test('401 expires the session; network failures show an error', async () => {
  const unauthorized = vi.fn(); api.getHackathonApplications.mockRejectedValue({ status: 401 })
  const { unmount } = render(<Applications session={session} onUnauthorized={unauthorized} />)
  await vi.waitFor(() => expect(unauthorized).toHaveBeenCalled()); unmount()
  api.getHackathonApplications.mockRejectedValue(new Error('Bağlantı kurulamadı'))
  render(<Applications session={session} onUnauthorized={unauthorized} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı kurulamadı')
})
