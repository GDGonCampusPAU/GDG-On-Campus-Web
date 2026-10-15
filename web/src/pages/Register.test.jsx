import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Register from './Register.jsx'
import base from '../data/event.json'
import { fillUntilConfirm } from '../test/registrationHelpers.js'
import { fixtureSteps } from '../test/fixtures.js'

const renderRegister = (register = { ...base.register, steps: fixtureSteps }) =>
  render(
    <MemoryRouter>
      <Register data={{ ...base, register }} />
    </MemoryRouter>,
  )

describe('Register sayfası', () => {
  it('h1 ve formu gösterir', () => {
    renderRegister()
    expect(screen.getByRole('heading', { level: 1, name: base.register.title })).toBeInTheDocument()
    expect(screen.getByLabelText('Ad soyad')).toBeInTheDocument()
  })

  it('endpoint yokken formu tamamlayınca başarı ekranını gösterir', async () => {
    const user = userEvent.setup()
    renderRegister()
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
