import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Register from './Register.jsx'
import { fillUntilConfirm } from '../test/registrationHelpers.js'

const renderRegister = () =>
  render(
    <MemoryRouter>
      <Register />
    </MemoryRouter>,
  )

describe('Register sayfası', () => {
  it('h1 ve formu gösterir', () => {
    renderRegister()
    expect(screen.getByRole('heading', { level: 1, name: 'Kayıt' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ad soyad')).toBeInTheDocument()
  })

  it('endpoint yokken formu tamamlayınca başarı ekranını gösterir', async () => {
    const user = userEvent.setup()
    renderRegister()
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    const heading = await screen.findByRole('heading', { name: 'Kaydın alındı!' })
    expect(heading).toHaveFocus()
    expect(screen.getByText('Kaydın alındı. Programa göz atmayı unutma.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })
})
