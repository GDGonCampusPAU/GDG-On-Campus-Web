import { screen } from '@testing-library/react'
import { render } from '../src/test/render.jsx'
import { beforeEach, expect, test, vi } from 'vitest'
import Applications from '../src/pages/Applications.jsx'
import Users from '../src/pages/Users.jsx'
import * as api from '../src/lib/api.js'

vi.mock('../src/lib/api.js', async () => {
  const actual = await vi.importActual('../src/lib/api.js')
  return {
    ...actual,
    getHackathonApplications: vi.fn(),
    downloadHackathonApplicationsCsv: vi.fn(),
    getUsers: vi.fn(),
    updateUserRole: vi.fn(),
  }
})

const adminSession = { token: 'staff', user: { id: 'staff', role: 'ADMIN', fullName: 'Staff' } }

beforeEach(() => {
  vi.resetAllMocks()
})

test('[P2.2a] Applications omits tel:undefined and empty Proje fikri container when dynamic fields are absent', async () => {
  api.getHackathonApplications.mockResolvedValue({
    data: [{
      _id: 'r1',
      verifiedEmail: 'no-phone@example.com',
      submittedAt: '2026-11-10T10:00:00Z',
      answers: [{ fieldId: 'fullName', label: 'Ad soyad', value: 'Sade Başvuru' }],
      uploadedFiles: [],
    }],
    pagination: { totalItems: 1, totalPages: 1 },
  })

  const { container } = render(<Applications session={adminSession} onUnauthorized={vi.fn()} />)
  expect(await screen.findByRole('heading', { name: 'Sade Başvuru' })).toBeInTheDocument()
  expect(container.querySelector('a[href="tel:undefined"]')).toBeNull()
  expect(screen.queryByText('Proje fikri')).toBeNull()
})

test('[P2.2b] Users supports PENDING role filtering, displays empty state and hides 1/1 single page pager', async () => {
  api.getUsers.mockResolvedValue({ data: [], pagination: { currentPage: 1, totalPages: 1 } })
  render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
  expect(await screen.findByRole('combobox', { name: /Rol filtresi|Durum filtresi/i })).toBeInTheDocument()
  expect(screen.queryByText('1 / 1')).toBeNull()
  expect(screen.getByText(/üye bulunamadı|henüz üye yok/i)).toBeInTheDocument()
})

test('[P2.2c] downloadPrivateFile throws ApiError rather than native TypeError on malformed URLs', async () => {
  await expect(api.downloadPrivateFile('http://[malformed', 'token')).rejects.toMatchObject({
    name: 'ApiError',
    message: 'Dosya adresi geçersiz.',
  })
})

