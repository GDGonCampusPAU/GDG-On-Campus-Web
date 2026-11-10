import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import ParticipantVerification from './ParticipantVerification.jsx'
import { api } from '../lib/eventApi.js'

vi.mock('../lib/eventApi.js', () => ({ api: vi.fn() }))

beforeEach(() => {
  vi.resetAllMocks()
  api.mockResolvedValue({ data: { schemaVersion: 'v1', settings: { verificationMethods: ['EMAIL_OTP'] } } })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

test('email challenge verifies before handing a token to the form', async () => {
  const user = userEvent.setup()
  const verified = vi.fn()
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
  expect(verified).toHaveBeenCalledWith({ ...identity, formVersion: 'v1' })
})

test('wrong OTP keeps verification open and displays the server error', async () => {
  const user = userEvent.setup()
  const verified = vi.fn()
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
  const initialize = vi.fn()
  const renderButton = vi.fn()
  vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } })
  api.mockResolvedValueOnce({ data: { schemaVersion: 'v1', settings: { verificationMethods: ['GOOGLE'] } } })
  const verified = vi.fn()
  render(<ParticipantVerification slug="test" onVerified={verified} />)
  await waitFor(() => expect(initialize).toHaveBeenCalled())
  api.mockResolvedValueOnce({ token: 'google-token' })
  await act(async () => {
    await initialize.mock.calls[0][0].callback({ credential: 'signed-identity' })
  })
  expect(api).toHaveBeenCalledWith('/participant-auth/google', { method: 'POST', body: { idToken: 'signed-identity' } })
  expect(verified).toHaveBeenCalledWith({ token: 'google-token', formVersion: 'v1' })
})

test('initial form load failure shows alert with retry button that reloads form', async () => {
  const user = userEvent.setup()
  api.mockRejectedValueOnce(new Error('Form kapalı veya yüklenemedi'))
  render(<ParticipantVerification slug="hackathon-katilim" onVerified={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveTextContent('Form kapalı veya yüklenemedi')

  await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))
  expect(await screen.findByLabelText('Doğrulama e-postası')).toBeInTheDocument()
  expect(api).toHaveBeenCalledTimes(2)
})

test('can change email after OTP step, warns if Google Client ID missing and guards concurrent submit', async () => {
  const user = userEvent.setup()
  render(<ParticipantVerification slug="test" onVerified={vi.fn()} />)
  await user.type(await screen.findByLabelText('Doğrulama e-postası'), 'first@example.com')

  let resolveSend
  api.mockImplementationOnce(() => new Promise(resolve => { resolveSend = resolve }))
  await user.click(screen.getByRole('button', { name: 'Kod gönder' }))
  await user.click(screen.getByRole('button', { name: 'Bekleyin…' }))
  expect(api).toHaveBeenCalledTimes(2)
  await act(async () => { resolveSend({ resendAfterSeconds: 60 }) })

  expect(await screen.findByLabelText('Doğrulama kodu')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'E-postayı değiştir' }))
  expect(screen.queryByLabelText('Doğrulama kodu')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Doğrulama e-postası')).toBeEnabled()

  api.mockResolvedValueOnce({ data: { settings: { verificationMethods: ['GOOGLE'] } } })
  render(<ParticipantVerification slug="google-only" onVerified={vi.fn()} />)
  expect(await screen.findByText(/Google doğrulaması bu ortamda yapılandırılmamış/)).toBeInTheDocument()
})
