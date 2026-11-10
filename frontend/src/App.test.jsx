import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App.jsx'
import * as api from './lib/api.js'

vi.mock('./lib/api.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  sendOtp: vi.fn(),
  verifyEmail: vi.fn(),
  getUsers: vi.fn(),
  updateUserRole: vi.fn(),
  getHackathonApplications: vi.fn(),
  downloadHackathonApplicationsCsv: vi.fn(),
  downloadPrivateFile: vi.fn(),
}))

const storeSession = (user, token = 'jwt-token') =>
  window.localStorage.setItem('gdg-pau-session', JSON.stringify({ token, user }))

beforeEach(() => {
  vi.resetAllMocks()
  window.location.hash = '#/login'
  api.getHackathonApplications.mockResolvedValue({ data: [], pagination: { totalItems: 0, totalPages: 1 } })
  api.getUsers.mockResolvedValue({ data: [], pagination: { totalPages: 1 } })
})

test('redirects anonymous users away from protected routes and supports #/register link', async () => {
  window.location.hash = '#/applications'
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Core Team Girişi' })).toBeInTheDocument()
  expect(window.location.hash).toBe('#/login')

  await userEvent.click(screen.getByRole('link', { name: 'Kayıt Ol' }))
  window.location.hash = '#/register'
  window.dispatchEvent(new HashChangeEvent('hashchange'))
  expect(await screen.findByRole('heading', { name: 'Core Team Kaydı' })).toBeInTheDocument()
})

test('MEMBER account sees restriction message and can log out cleanly', async () => {
  const user = userEvent.setup()
  storeSession({ id: 'm1', fullName: 'Member User', role: 'MEMBER' })
  render(<App />)
  expect(screen.getByText(/ORGANIZER veya ADMIN yetkisi gerekiyor/)).toBeInTheDocument()
  expect(api.getHackathonApplications).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Çıkış Yap' }))
  expect(await screen.findByRole('heading', { name: 'Core Team Girişi' })).toBeInTheDocument()
  expect(window.localStorage.getItem('gdg-pau-session')).toBeNull()
})

test('ORGANIZER stays on Applications when requesting #/users, while ADMIN can switch routes', async () => {
  window.location.hash = '#/users'
  storeSession({ id: 'o1', fullName: 'Org User', role: 'ORGANIZER' })
  const { unmount } = render(<App />)
  expect(await screen.findByRole('heading', { name: 'Hackathon Başvuruları' })).toBeInTheDocument()
  expect(window.location.hash).toBe('#/applications')
  unmount()

  window.location.hash = '#/users'
  storeSession({ id: 'a1', fullName: 'Admin User', role: 'ADMIN' })
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Ekip üyeleri ve onaylar' })).toBeInTheDocument()
  expect(window.location.hash).toBe('#/users')
})

test('401 response clears session and shows expiration notice on login', async () => {
  storeSession({ id: 'o1', fullName: 'Org User', role: 'ORGANIZER' })
  api.getHackathonApplications.mockRejectedValue({ status: 401, message: 'Token expired' })
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Core Team Girişi' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Oturum süren doldu')
  expect(window.localStorage.getItem('gdg-pau-session')).toBeNull()
})

