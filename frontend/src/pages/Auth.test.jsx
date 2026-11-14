import { screen, waitFor, within } from '@testing-library/react'
import { render } from '../test/render.jsx'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Login from './Login.jsx'
import Register from './Register.jsx'
import Users from './Users.jsx'
import * as api from '../lib/api.js'

vi.mock('../lib/api.js', () => ({
  login: vi.fn(),
  register: vi.fn(),
  sendOtp: vi.fn(),
  verifyEmail: vi.fn(),
  getUsers: vi.fn(),
  updateUserRole: vi.fn(),
}))

beforeEach(() => vi.resetAllMocks())

test('login saves session and reports success', async () => {
  const user = userEvent.setup()
  const success = vi.fn()
  api.login.mockResolvedValue({ token: 'team-token', user: { id: '1', role: 'ADMIN' } })
  render(<Login onSuccess={success} />)
  await user.type(screen.getByLabelText(/E-posta/), 'admin@pau.edu.tr')
  await user.type(screen.getByLabelText(/Şifre/), 'password')
  await user.click(screen.getByRole('button', { name: 'Giriş Yap' }))
  expect(success).toHaveBeenCalledWith(expect.objectContaining({ token: 'team-token' }))
  expect(JSON.parse(localStorage.getItem('gdg-pau-session')).token).toBe('team-token')
})

test('unverified login switches to OTP step, verifies email and retries login', async () => {
  const user = userEvent.setup()
  const success = vi.fn()
  api.login
    .mockRejectedValueOnce({ status: 403, data: { requiresVerification: true } })
    .mockResolvedValueOnce({ token: 'verified-token', user: { id: '2', role: 'ORGANIZER' } })
  api.verifyEmail.mockResolvedValue({ success: true })

  render(<Login onSuccess={success} />)
  await user.type(screen.getByLabelText(/E-posta/), 'org@pau.edu.tr')
  await user.type(screen.getByLabelText(/Şifre/), 'password')
  await user.click(screen.getByRole('button', { name: 'Giriş Yap' }))

  await user.type(await screen.findByLabelText(/Doğrulama Kodu/), '654321')
  await user.click(screen.getByRole('button', { name: 'Doğrula ve Giriş Yap' }))

  expect(api.verifyEmail).toHaveBeenCalledWith({ email: 'org@pau.edu.tr', code: '654321' })
  expect(success).toHaveBeenCalledWith(expect.objectContaining({ token: 'verified-token' }))
})

test('pending account shows approval message instead of logging in', async () => {
  const user = userEvent.setup()
  api.login.mockRejectedValue({ status: 403, data: {} })
  render(<Login />)
  await user.type(screen.getByLabelText(/E-posta/), 'pending@gmail.com')
  await user.type(screen.getByLabelText(/Şifre/), 'password')
  await user.click(screen.getByRole('button', { name: 'Giriş Yap' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('onaylanmadı')
})

test('registration validates invalid domains and mismatched passwords without hitting API', async () => {
  const user = userEvent.setup()
  render(<Register />)
  await user.type(screen.getByLabelText(/Ad Soyad/), 'A')
  await user.type(screen.getByLabelText(/E-posta/), 'user@outlook.com')
  await user.type(screen.getByLabelText(/^Şifre$/), '12345')
  await user.type(screen.getByLabelText(/Şifre Tekrar/), '999999')
  await user.click(screen.getByRole('button', { name: 'Devam Et' }))

  expect(api.register).not.toHaveBeenCalled()
  expect(screen.getByText(/en az 2 karakter/)).toBeInTheDocument()
  expect(screen.getByText(/Pamukkale Üniversitesi/)).toBeInTheDocument()
  expect(screen.getByText(/Şifreler eşleşmiyor/)).toBeInTheDocument()
})

test('registration moves through OTP to pending approval', async () => {
  const user = userEvent.setup()
  api.register.mockResolvedValue({ requiresVerification: true })
  render(<Register />)
  await user.type(screen.getByLabelText(/Ad Soyad/), 'Test User')
  await user.type(screen.getByLabelText(/E-posta/), 'test@gmail.com')
  await user.type(screen.getByLabelText(/^Şifre$/), 'password')
  await user.type(screen.getByLabelText(/Şifre Tekrar/), 'password')
  await user.click(screen.getByRole('button', { name: 'Devam Et' }))
  await user.type(await screen.findByLabelText(/Doğrulama Kodu/), '123456')
  await user.click(screen.getByRole('button', { name: 'Kaydı Tamamla' }))
  expect(await screen.findByRole('heading', { name: 'Kaydın iletildi' })).toBeInTheDocument()
  expect(api.register).toHaveBeenLastCalledWith(expect.objectContaining({ code: '123456' }))
})

test('ADMIN can approve a pending account, while self and unverified controls stay disabled', async () => {
  const user = userEvent.setup()
  api.getUsers.mockResolvedValue({
    data: [
      { _id: 'admin', fullName: 'Current Admin', email: 'admin@pau.edu.tr', role: 'ADMIN', isEmailVerified: true },
      { _id: 'unverified', fullName: 'Unverified User', email: 'unverified@gmail.com', role: 'PENDING', isEmailVerified: false },
      { _id: 'pending', fullName: 'Pending User', email: 'pending@gmail.com', role: 'PENDING', isEmailVerified: true },
    ],
    pagination: { totalPages: 1 },
  })
  api.updateUserRole.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Rol güncellenemedi'))

  render(<Users session={{ token: 'admin-token', user: { id: 'admin', role: 'ADMIN', fullName: 'Current Admin' } }} onUnauthorized={vi.fn()} />)
  expect(await screen.findByLabelText('Rol — Current Admin')).toBeDisabled()
  expect(screen.getByLabelText('Rol — Unverified User')).toBeDisabled()
  expect(screen.getByText('E-posta doğrulaması bekleniyor.')).toBeInTheDocument()
  // Üst çubuktaki kendi rol etiketi (liste satırlarında da rol etiketi vardır).
  expect(within(screen.getByRole('banner')).getByText('Yönetici', { selector: '.panel__badge' })).toBeInTheDocument()
  expect(within(screen.getByLabelText('Rol — Pending User')).getByRole('option', { name: 'Organizatör' })).toHaveValue('ORGANIZER')

  await user.selectOptions(screen.getByLabelText('Rol — Pending User'), 'ORGANIZER')
  expect(api.updateUserRole).toHaveBeenCalledWith('pending', 'ORGANIZER', 'admin-token')

  await user.selectOptions(screen.getByLabelText('Rol — Pending User'), 'MEMBER')
  expect(await screen.findByRole('alert')).toHaveTextContent('Rol güncellenemedi')
})

test('Users triggers onUnauthorized when getUsers returns 401', async () => {
  const unauthorized = vi.fn()
  api.getUsers.mockRejectedValueOnce({ status: 401 })
  render(<Users session={{ token: 'expired', user: { id: 'admin', role: 'ADMIN', fullName: 'Admin' } }} onUnauthorized={unauthorized} />)
  await waitFor(() => expect(unauthorized).toHaveBeenCalled())
})
