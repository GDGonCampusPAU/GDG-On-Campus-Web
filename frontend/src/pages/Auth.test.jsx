import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import Login from './Login.jsx'
import Register from './Register.jsx'
import Users from './Users.jsx'
import * as api from '../lib/api.js'
vi.mock('../lib/api.js', () => ({ login: vi.fn(), register: vi.fn(), sendOtp: vi.fn(), verifyEmail: vi.fn(), getUsers: vi.fn(), updateUserRole: vi.fn() }))
beforeEach(() => vi.resetAllMocks())
test('login saves session and reports success', async () => {
  const user = userEvent.setup(); const success = vi.fn()
  api.login.mockResolvedValue({ token: 'team-token', user: { id: '1', role: 'ADMIN' } })
  render(<Login onSuccess={success} />)
  await user.type(screen.getByLabelText(/E-posta/), 'admin@pau.edu.tr')
  await user.type(screen.getByLabelText(/Şifre/), 'password')
  await user.click(screen.getByRole('button', { name: 'Giriş Yap' }))
  expect(success).toHaveBeenCalledWith(expect.objectContaining({ token: 'team-token' }))
  expect(JSON.parse(localStorage.getItem('gdg-pau-session')).token).toBe('team-token')
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
test('registration moves through OTP to pending approval', async () => {
  const user = userEvent.setup(); api.register.mockResolvedValue({ requiresVerification: true })
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
test('ADMIN can approve a pending account', async () => {
  const user = userEvent.setup()
  api.getUsers.mockResolvedValue({ data: [{ _id: 'pending', fullName: 'Pending User', email: 'pending@gmail.com', role: 'PENDING', isEmailVerified: true }], pagination: { totalPages: 1 } })
  api.updateUserRole.mockResolvedValue({})
  render(<Users session={{ token: 'admin-token', user: { id: 'admin', role: 'ADMIN' } }} onUnauthorized={vi.fn()} />)
  await user.selectOptions(await screen.findByLabelText('Rol — Pending User'), 'ORGANIZER')
  expect(api.updateUserRole).toHaveBeenCalledWith('pending', 'ORGANIZER', 'admin-token')
})
