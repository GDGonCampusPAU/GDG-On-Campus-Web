import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Applications from './Applications.jsx'
import * as api from '../lib/api.js'

vi.mock('../lib/api.js', () => ({
  getHackathonApplications: vi.fn(),
  downloadHackathonApplicationsCsv: vi.fn(),
  downloadPrivateFile: vi.fn(),
  updateApplicationStatus: vi.fn(),
}))

const session = { token: 'staff', user: { id: 'staff', role: 'ADMIN', fullName: 'Staff' } }
const record = {
  _id: 'response',
  verifiedEmail: 'participant@example.com',
  submittedAt: '2026-10-21T10:00:00Z',
  answers: [
    { fieldId: 'fullName', label: 'Ad soyad', value: 'Participant Test' },
    { fieldId: 'phone', label: 'Telefon', value: '+905551112233' },
    { fieldId: 'motivation', label: 'Motivasyon', value: 'Proje geliştirme' },
  ],
  uploadedFiles: [
    { filename: 'abc-cv.pdf', originalName: 'ozgecmis.pdf', url: '/api/v1/files/abc-cv.pdf' },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  api.getHackathonApplications.mockResolvedValue({
    data: [record],
    pagination: { totalItems: 1, totalPages: 1, currentPage: 1, hasPrevPage: false, hasNextPage: false },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

test('site submissions are listed by default and all answers are available', async () => {
  render(<Applications session={session} />)
  expect(await screen.findByRole('heading', { name: 'Participant Test' })).toBeInTheDocument()
  expect(api.getHackathonApplications).toHaveBeenCalledWith(expect.objectContaining({ source: 'forms' }), 'staff')
  expect(screen.getByText('Ad soyad')).toBeInTheDocument()
})

test('legacy application source remains accessible', async () => {
  const user = userEvent.setup()
  render(<Applications session={session} />)
  await screen.findByRole('heading', { name: 'Participant Test' })
  await user.selectOptions(screen.getByRole('combobox', { name: 'Başvuru kaynağı' }), 'legacy')
  expect(api.getHackathonApplications).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'legacy' }), 'staff')
})

test('401 expires the session; network failures show an error', async () => {
  const unauthorized = vi.fn()
  api.getHackathonApplications.mockRejectedValue({ status: 401 })
  const { unmount } = render(<Applications session={session} onUnauthorized={unauthorized} />)
  await waitFor(() => expect(unauthorized).toHaveBeenCalled())
  unmount()

  api.getHackathonApplications.mockRejectedValue(new Error('Bağlantı kurulamadı'))
  render(<Applications session={session} onUnauthorized={unauthorized} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Bağlantı kurulamadı')
})

test('debounced search resets pagination to page 1 and passes query to CSV export', async () => {
  const user = userEvent.setup()
  api.getHackathonApplications.mockResolvedValue({
    data: [record],
    pagination: { totalItems: 12, totalPages: 2, currentPage: 1, hasPrevPage: false, hasNextPage: true },
  })
  const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-csv')
  const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  api.downloadHackathonApplicationsCsv.mockResolvedValue(new Blob(['csv']))

  render(<Applications session={session} onUnauthorized={vi.fn()} />)
  await screen.findByRole('heading', { name: 'Participant Test' })

  await user.click(screen.getByRole('button', { name: 'Sonraki' }))
  await waitFor(() =>
    expect(api.getHackathonApplications).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }), 'staff'),
  )

  await user.type(screen.getByLabelText('Ara'), 'Participant')
  await waitFor(
    () =>
      expect(api.getHackathonApplications).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, search: 'Participant', source: 'forms' }),
        'staff',
      ),
    { timeout: 1500 },
  )

  await user.click(screen.getByRole('button', { name: 'CSV indir' }))
  expect(api.downloadHackathonApplicationsCsv).toHaveBeenCalledWith('staff', { source: 'forms', search: 'Participant', status: 'ALL' })
  expect(createUrl).toHaveBeenCalled()
  expect(revokeUrl).toHaveBeenCalledWith('blob:mock-csv')
})

test('status filter passes status parameter and approve/reject controls update status & notification choice', async () => {
  const user = userEvent.setup()
  api.getHackathonApplications.mockResolvedValue({
    form: { id: 'form-10' },
    data: [{ ...record, status: 'PENDING' }],
    pagination: { totalItems: 1, totalPages: 1, currentPage: 1, hasPrevPage: false, hasNextPage: false },
  })
  api.updateApplicationStatus.mockResolvedValueOnce({
    success: true,
    message: 'Başvuru onaylandı ve katılımcıya bilgilendirme e-postası gönderildi.',
    data: { ...record, status: 'APPROVED', statusNote: 'Tebrikler!' },
  })

  render(<Applications session={session} onUnauthorized={vi.fn()} />)
  await screen.findByRole('button', { name: 'Onayla' })
  expect(document.querySelector('.app-card .panel__badge--pending')).toHaveTextContent('Beklemede')

  await user.type(screen.getByLabelText('Değerlendirme notu — Participant Test'), 'Tebrikler!')
  await user.click(screen.getByRole('button', { name: 'Onayla' }))

  expect(api.updateApplicationStatus).toHaveBeenCalledWith(
    { id: 'response', formId: 'form-10', source: 'forms', status: 'APPROVED', note: 'Tebrikler!', notify: true },
    'staff',
  )
  expect(await screen.findByRole('status')).toHaveTextContent('Başvuru onaylandı')
  expect(document.querySelector('.app-card .panel__badge--approved')).toHaveTextContent('Onaylandı')
  expect(screen.getByRole('button', { name: 'Beklemeye al' })).toBeInTheDocument()

  api.updateApplicationStatus.mockResolvedValueOnce({
    success: true,
    message: 'Başvuru durumu güncellendi (reddedildi).',
    data: { ...record, status: 'REJECTED', statusNote: 'Tebrikler!' },
  })
  await user.click(screen.getByRole('checkbox', { name: 'Karar e-postası gönder' }))
  await user.click(screen.getByRole('button', { name: 'Reddet' }))
  expect(api.updateApplicationStatus).toHaveBeenLastCalledWith(
    { id: 'response', formId: 'form-10', source: 'forms', status: 'REJECTED', note: 'Tebrikler!', notify: false },
    'staff',
  )

  await user.selectOptions(screen.getByRole('combobox', { name: 'Durum filtresi' }), 'APPROVED')
  await waitFor(() =>
    expect(api.getHackathonApplications).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'APPROVED', page: 1 }),
      'staff',
    ),
  )
})

test('status update errors surface alert and 401 expires session', async () => {
  const user = userEvent.setup()
  const unauthorized = vi.fn()
  api.getHackathonApplications.mockResolvedValue({
    form: { id: 'form-10' },
    data: [{ ...record, status: 'PENDING' }],
    pagination: { totalItems: 1, totalPages: 1 },
  })
  api.updateApplicationStatus.mockRejectedValueOnce(new Error('Brevo başarısız'))

  render(<Applications session={session} onUnauthorized={unauthorized} />)
  await screen.findByRole('button', { name: 'Onayla' })
  await user.click(screen.getByRole('button', { name: 'Onayla' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Brevo başarısız')

  api.updateApplicationStatus.mockRejectedValueOnce({ status: 401, message: 'Yetkisiz' })
  await user.click(screen.getByRole('button', { name: 'Reddet' }))
  await waitFor(() => expect(unauthorized).toHaveBeenCalled())
})

test('private attachment button downloads via authorized client and handles CSV/file errors + 401', async () => {
  const user = userEvent.setup()
  const unauthorized = vi.fn()
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-file')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  api.downloadPrivateFile.mockResolvedValueOnce(new Blob(['pdf']))

  render(<Applications session={session} onUnauthorized={unauthorized} />)
  await user.click(await screen.findByRole('button', { name: 'ozgecmis.pdf indir' }))
  expect(api.downloadPrivateFile).toHaveBeenCalledWith('/api/v1/files/abc-cv.pdf', 'staff')

  api.downloadHackathonApplicationsCsv.mockRejectedValueOnce(new Error('CSV indirilemedi'))
  await user.click(screen.getByRole('button', { name: 'CSV indir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('CSV indirilemedi')

  api.downloadPrivateFile.mockRejectedValueOnce({ status: 401, message: 'Yetkisiz' })
  await user.click(screen.getByRole('button', { name: 'ozgecmis.pdf indir' }))
  await waitFor(() => expect(unauthorized).toHaveBeenCalled())
})
