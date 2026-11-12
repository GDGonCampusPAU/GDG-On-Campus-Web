import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App.jsx'
import * as api from './lib/api.js'
import { legacyHashPath } from './lib/routing.js'

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

function CurrentPath() {
  const { pathname } = useLocation()
  return <span data-testid="current-path">{pathname}</span>
}
const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <CurrentPath />
    </MemoryRouter>,
  )
const currentPath = () => screen.getByTestId('current-path').textContent

beforeEach(() => {
  vi.resetAllMocks()
  window.localStorage.clear()
  api.getHackathonApplications.mockResolvedValue({ data: [], pagination: { totalItems: 0, totalPages: 1 } })
  api.getUsers.mockResolvedValue({ data: [], pagination: { totalPages: 1 } })
})

test('redirects anonymous users from protected routes to /login and links to /register', async () => {
  const user = userEvent.setup()
  renderAt('/applications')
  expect(screen.getByRole('heading', { name: 'Core Team Girişi' })).toBeInTheDocument()
  expect(currentPath()).toBe('/login')

  await user.click(screen.getByRole('link', { name: 'Kayıt Ol' }))
  expect(await screen.findByRole('heading', { name: 'Core Team Kaydı' })).toBeInTheDocument()
  expect(currentPath()).toBe('/register')

  await user.click(screen.getAllByRole('link', { name: 'Giriş Yap' })[0])
  expect(currentPath()).toBe('/login')
})

test('after login the user returns to the page they originally requested', async () => {
  const user = userEvent.setup()
  api.login.mockResolvedValue({ token: 'jwt', user: { id: 'a1', fullName: 'Admin User', role: 'ADMIN' } })
  renderAt('/users')
  expect(currentPath()).toBe('/login')

  await user.type(screen.getByLabelText('E-posta'), 'admin@pau.edu.tr')
  await user.type(screen.getByLabelText('Şifre'), 'safe-password-1')
  await user.click(screen.getByRole('button', { name: 'Giriş Yap' }))

  expect(await screen.findByRole('heading', { name: 'Ekip üyeleri ve onaylar' })).toBeInTheDocument()
  expect(currentPath()).toBe('/users')
})

test('MEMBER account sees restriction message and can log out cleanly', async () => {
  const user = userEvent.setup()
  storeSession({ id: 'm1', fullName: 'Member User', role: 'MEMBER' })
  renderAt('/applications')
  expect(screen.getByText(/ORGANIZER veya ADMIN yetkisi gerekiyor/)).toBeInTheDocument()
  expect(api.getHackathonApplications).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Çıkış Yap' }))
  expect(await screen.findByRole('heading', { name: 'Core Team Girişi' })).toBeInTheDocument()
  expect(currentPath()).toBe('/login')
  expect(window.localStorage.getItem('gdg-pau-session')).toBeNull()
})

test('ORGANIZER cannot open /users; ADMIN can and navigates with the panel menu', async () => {
  storeSession({ id: 'o1', fullName: 'Org User', role: 'ORGANIZER' })
  const { unmount } = renderAt('/users')
  expect(await screen.findByRole('heading', { name: 'Hackathon Başvuruları' })).toBeInTheDocument()
  expect(currentPath()).toBe('/applications')
  expect(screen.queryByRole('link', { name: 'Ekip ve onaylar' })).not.toBeInTheDocument()
  unmount()

  const user = userEvent.setup()
  storeSession({ id: 'a1', fullName: 'Admin User', role: 'ADMIN' })
  renderAt('/applications')
  await user.click(await screen.findByRole('link', { name: 'Ekip ve onaylar' }))
  expect(await screen.findByRole('heading', { name: 'Ekip üyeleri ve onaylar' })).toBeInTheDocument()
  expect(currentPath()).toBe('/users')
})

test('signed-in users are sent home from /login, /register and unknown paths', async () => {
  storeSession({ id: 'o1', fullName: 'Org User', role: 'ORGANIZER' })
  for (const path of ['/login', '/register', '/', '/olmayan-sayfa']) {
    const { unmount } = renderAt(path)
    expect(await screen.findByRole('heading', { name: 'Hackathon Başvuruları' })).toBeInTheDocument()
    expect(currentPath()).toBe('/applications')
    unmount()
  }
})

test('401 response clears session and shows expiration notice on login', async () => {
  storeSession({ id: 'o1', fullName: 'Org User', role: 'ORGANIZER' })
  api.getHackathonApplications.mockRejectedValue({ status: 401, message: 'Token expired' })
  renderAt('/applications')
  expect(await screen.findByRole('heading', { name: 'Core Team Girişi' })).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Oturum süren doldu')
  expect(currentPath()).toBe('/login')
  expect(window.localStorage.getItem('gdg-pau-session')).toBeNull()
})

describe('legacyHashPath', () => {
  test('maps old #/ bookmarks to real paths', () => {
    expect(legacyHashPath('#/register')).toBe('/register')
    expect(legacyHashPath('#/users')).toBe('/users')
    expect(legacyHashPath('#/applications?status=APPROVED')).toBe('/applications?status=APPROVED')
  })
  test('ignores empty, non-route and unsafe hashes', () => {
    for (const hash of ['', '#', '#section', '#//evil.example', '#/javascript:alert(1)', undefined]) {
      expect(legacyHashPath(hash)).toBeNull()
    }
  })
})
