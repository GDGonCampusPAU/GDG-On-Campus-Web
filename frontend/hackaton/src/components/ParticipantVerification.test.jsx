import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import ParticipantVerification from './ParticipantVerification.jsx'
import { api } from '../lib/eventApi.js'
vi.mock('../lib/eventApi.js', () => ({ api: vi.fn() }))
beforeEach(() => {
  vi.resetAllMocks()
  api.mockResolvedValue({ data: { settings: { verificationMethods: ['EMAIL_OTP'] } } })
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
test('email challenge verifies before handing a token to the form', async () => {
  const user = userEvent.setup(); const verified = vi.fn()
  render(<ParticipantVerification slug="hackathon-katilim" onVerified={verified} />)
  await user.type(await screen.findByLabelText('Doğrulama e-postası'), 'person@example.com')
  api.mockResolvedValueOnce({ resendAfterSeconds: 60 })
  await user.click(screen.getByRole('button', { name: 'Kod gönder' }))
  expect(verified).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Tekrar gönder/ })).toBeDisabled()
  await user.type(screen.getByLabelText('Doğrulama kodu'), '123456')
  const identity = { token: 'verified', participant: { email: 'person@example.com' } }
  api.mockResolvedValueOnce(identity)
  await user.click(screen.getByRole('button', { name: 'Doğrula ve devam et' }))
  expect(verified).toHaveBeenCalledWith(identity)
})
test('wrong OTP keeps verification open and displays the server error', async () => {
  const user = userEvent.setup(); const verified = vi.fn()
  render(<ParticipantVerification slug="test" onVerified={verified} />)
  await user.type(await screen.findByLabelText('Doğrulama e-postası'), 'person@example.com')
  api.mockResolvedValueOnce({ resendAfterSeconds: 60 })
  await user.click(screen.getByRole('button', { name: 'Kod gönder' }))
  await user.type(screen.getByLabelText('Doğrulama kodu'), '000000')
  api.mockRejectedValueOnce(new Error('Kod hatalı'))
  await user.click(screen.getByRole('button', { name: 'Doğrula ve devam et' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Kod hatalı')
  expect(verified).not.toHaveBeenCalled()
})
test('Google credential is sent as idToken to the existing API', async () => {
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'web-client')
  const initialize = vi.fn(); const renderButton = vi.fn()
  vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } })
  api.mockResolvedValueOnce({ data: { settings: { verificationMethods: ['GOOGLE'] } } })
  render(<ParticipantVerification slug="test" onVerified={vi.fn()} />)
  await waitFor(() => expect(initialize).toHaveBeenCalled())
  api.mockResolvedValueOnce({ token: 'google-token' })
  await initialize.mock.calls[0][0].callback({ credential: 'signed-identity' })
  expect(api).toHaveBeenCalledWith('/participant-auth/google', { method: 'POST', body: { idToken: 'signed-identity' } })
})
