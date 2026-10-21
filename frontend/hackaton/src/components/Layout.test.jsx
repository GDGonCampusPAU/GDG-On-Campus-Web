import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Layout from './Layout.jsx'
import { event } from '../data/event.js'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>içerik</p>} />
          <Route path="kayit" element={<p>form</p>} />
          <Route path="program" element={<p>program</p>} />
          <Route path="*" element={<p>yok</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  let scrollTo
  beforeEach(() => {
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  })
  afterEach(() => scrollTo.mockRestore())

  it('içeriği main içinde gösterir', () => {
    renderAt('/')
    expect(screen.getByRole('main')).toHaveTextContent('içerik')
  })

  it('sabit CTA iç sayfalarda vardır (navbar + sabit çubuk)', () => {
    renderAt('/program')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(2)
  })

  it('sabit CTA /kayit sayfasında yoktur', () => {
    renderAt('/kayit')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(1)
  })

  it('sabit CTA ana sayfada yoktur (kapanış bölümünde kendi çağrısı var)', () => {
    renderAt('/')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(1)
  })

  it('sabit CTA /kayit/ (sonda eğik çizgi) sayfasında da yoktur', () => {
    const { container } = renderAt('/kayit/')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(1)
    expect(container.querySelector('.app')).not.toHaveClass('app--has-cta')
  })

  it('sayfa başlığı rotaya göre değişir', () => {
    renderAt('/kayit')
    expect(document.title).toBe(`Kayıt | ${event.name}`)
  })

  it('ana sayfa başlığı etkinlik adı ve düzenleyeni içerir', () => {
    renderAt('/')
    expect(document.title).toBe(`${event.name} | ${event.organizer}`)
  })

  it('bilinmeyen rotada 404 başlığı kullanır', () => {
    renderAt('/yok-boyle-bir-sayfa')
    expect(document.title).toBe(`Sayfa bulunamadı | ${event.name}`)
  })

  it('sabit CTA yalnızca gösterildiğinde alt boşluk sınıfını ekler', () => {
    const { container, unmount } = renderAt('/program')
    expect(container.querySelector('.app')).toHaveClass('app--has-cta')
    unmount()
    const second = renderAt('/kayit')
    expect(second.container.querySelector('.app')).not.toHaveClass('app--has-cta')
  })

  it('ilk render odağı main\'e taşımaz', () => {
    renderAt('/')
    expect(document.body).toHaveFocus()
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })

  it('rota değişince sayfayı en üste kaydırır ve odağı main\'e taşır', async () => {
    const user = userEvent.setup()
    renderAt('/')
    scrollTo.mockClear()
    await user.click(screen.getAllByRole('link', { name: 'Kayıt Ol' })[0])
    expect(screen.getByText('form')).toBeInTheDocument()
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'instant' })
    expect(screen.getByRole('main')).toHaveFocus()
  })
})
