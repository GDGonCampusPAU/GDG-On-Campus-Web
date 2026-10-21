import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Register from './Register.jsx'
import base from '../data/base.js'
import { fillUntilConfirm } from '../test/registrationHelpers.js'
import { fixtureSteps } from '../test/fixtures.js'

vi.mock('../components/ParticipantVerification.jsx', () => ({ default: ({ onVerified }) => <button onClick={() => onVerified({ token: 'participant-token', participant: { email: 'ayse@example.com' } })}>Test doğrula</button> }))
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ success: true, responseId: 'saved-id' }) }))))
afterEach(() => vi.unstubAllGlobals())
const renderRegister = (register = { ...base.register, steps: fixtureSteps }) =>
  render(
    <MemoryRouter>
      <Register data={{ ...base, register }} />
    </MemoryRouter>,
  )

describe('Register sayfası', () => {
  it('h1 ve doğrulama sonrasında formu gösterir', async () => {
    renderRegister()
    expect(screen.getByRole('heading', { level: 1, name: base.register.title })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Test doğrula' }))
    expect(screen.getByLabelText('Ad soyad')).toBeInTheDocument()
  })

  it('doğrulanmış başvuru kaydedilince başarı ekranını gösterir', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: 'Test doğrula' }))
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    const heading = await screen.findByRole('heading', { name: base.register.successTitle })
    expect(heading).toHaveFocus()
    expect(screen.getByText(base.register.successText)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })

  it('durum kapalıyken formu değil kapalı mesajını gösterir', () => {
    renderRegister({ ...base.register, status: 'closed', closedMessage: 'Başvurular bitti.' })
    expect(screen.getByRole('heading', { level: 1, name: base.register.title })).toBeInTheDocument()
    expect(screen.getByText('Başvurular bitti.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ad soyad')).not.toBeInTheDocument()
  })
})
