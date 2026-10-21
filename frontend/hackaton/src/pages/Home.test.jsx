import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Home from './Home.jsx'
import { event } from '../data/event.js'

const renderHome = (data) =>
  render(
    <MemoryRouter>
      <Home data={data} />
    </MemoryRouter>,
  )

describe('Home', () => {
  it('etkinlik adını h1 olarak gösterir', () => {
    renderHome(event)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(event.organizer)
    expect(h1).toHaveTextContent(event.name)
  })

  it('kayıt ve program CTA bağlantılarını içerir', () => {
    renderHome(event)
    // Hero ve kapanış bölümünde iki "Kayıt Ol" CTA'sı vardır; ikisi de /kayit'e gitmeli.
    const signUps = screen.getAllByRole('link', { name: 'Kayıt Ol' })
    expect(signUps).toHaveLength(2)
    signUps.forEach((link) => expect(link).toHaveAttribute('href', '/kayit'))
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })

  it('her ödül için bir kart gösterir', () => {
    renderHome(event)
    const section = screen.getByRole('heading', { name: 'Kazananları bekleyen ödüller' }).closest('section')
    const titles = within(section).getAllByRole('heading', { level: 3 })
    expect(titles).toHaveLength(event.prizes.length)
    expect(titles.map((h) => h.textContent)).toEqual(event.prizes.map((p) => p.title))
  })

  it('sponsor yokken sponsor bölümünü göstermez', () => {
    renderHome({ ...event, sponsors: [] })
    expect(screen.queryByRole('heading', { name: 'Sponsorlarımız' })).not.toBeInTheDocument()
  })

  it('tek h1 render eder ve bölümler laptopun ekranının içindedir', () => {
    const { container } = renderHome(event)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const display = container.querySelector('.laptop__display')
    expect(display).toContainElement(screen.getByRole('heading', { name: 'Neden katılmalısın?' }))
    expect(display).toContainElement(screen.getByRole('heading', { name: 'Sponsorlarımız' }))
  })

  it('bozuk tarihle çökmez', () => {
    renderHome({ ...event, startsAt: 'bozuk' })
    expect(screen.getByText('Tarih yakında açıklanacak')).toBeInTheDocument()
  })
})
