import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, afterEach } from 'vitest'
import LaptopHero from './LaptopHero.jsx'
import { event } from '../data/event.js'

// Geri sayım (role="timer") yalnızca başlangıç gelecekteyken vardır; test tarihten bağımsız kalsın.
const data = { ...event, startsAt: '2999-01-01T09:00:00+03:00' }

const renderHero = (props) =>
  render(
    <MemoryRouter>
      <LaptopHero data={data} {...props} />
    </MemoryRouter>,
  )

describe('LaptopHero', () => {
  afterEach(() => vi.restoreAllMocks())

  it('etkinlik adını h1, CTA ve geri sayımı gerçek DOM olarak verir', () => {
    renderHero()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toHaveTextContent(event.organizer)
    expect(h1).toHaveTextContent(event.name)
    expect(screen.getByRole('link', { name: 'Kayıt Ol' })).toHaveAttribute('href', '/kayit')
    expect(screen.getByRole('timer')).toBeInTheDocument()
  })

  it('varsayılanda kaydırmayla sürülür', () => {
    const { container } = renderHero()
    expect(container.querySelector('.laptop-hero')).toHaveClass('laptop-hero--scrub')
  })

  it('tek h1 ve çocuklar ekranın içindeki sayfada durur, ekran okuyucuya açıktır', () => {
    const { container } = renderHero({ children: <p>sayfanın geri kalanı</p> })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const display = container.querySelector('.laptop__display')
    expect(display.querySelector('.laptop__page h1')).toBeInTheDocument()
    expect(display.querySelector('.laptop__page')).toHaveTextContent('sayfanın geri kalanı')
    expect(container.querySelector('.laptop')).not.toHaveAttribute('aria-hidden')
    expect(container.querySelector('.laptop__editor')).toHaveAttribute('aria-hidden', 'true')
  })

  it('geri sayım ekranın içindedir', () => {
    const { container } = renderHero()
    expect(container.querySelector('.laptop__page [role="timer"]')).toBeInTheDocument()
  })

  it('hareket azaltılmışsa kaydırma sürmez: kapak açık, zemin koyu, ekran kendi kaydırır', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
    const { container } = renderHero()
    const hero = container.querySelector('.laptop-hero')
    expect(hero).not.toHaveClass('laptop-hero--scrub')
    expect(hero).toHaveAttribute('data-dark', 'true')
    expect(container.querySelector('.laptop-hero__banner')).not.toBeInTheDocument()
  })

  it('hareket azaltılmışsa çocuklar ekranın içinde değil, bölümün ardından düz sayfa olarak gelir', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
    const { container } = renderHero({ children: <p>sayfanın geri kalanı</p> })
    const rest = screen.getByText('sayfanın geri kalanı')
    expect(container.querySelector('.laptop-hero')).not.toContainElement(rest)
    expect(container.querySelector('.laptop-hero').nextElementSibling).toBe(rest)
  })
})
