import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Navbar from './Navbar.jsx'

function renderNav() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  )
}

describe('Navbar', () => {
  it('marka adını ve sayfa bağlantılarını gösterir', () => {
    renderNav()
    expect(screen.getByRole('link', { name: /GDG On Campus PAU/ })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Program' })).toHaveAttribute('href', '/program')
    expect(screen.getByRole('link', { name: 'Ekip' })).toHaveAttribute('href', '/ekip')
    expect(screen.getByRole('link', { name: 'Kayıt Ol' })).toHaveAttribute('href', '/kayit')
  })

  it('menü düğmesi aria-expanded değerini değiştirir ve bağlantıya tıklayınca kapanır', async () => {
    const user = userEvent.setup()
    renderNav()
    const toggle = screen.getByRole('button', { name: 'Menü' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Program' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
