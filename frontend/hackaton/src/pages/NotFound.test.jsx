import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import NotFound from './NotFound.jsx'
import { seeded } from '../lib/glassCrack.js'

const renderAt = (path = '/kayip-sayfa') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Ana sayfa içeriği</p>} />
        <Route path="*" element={<NotFound random={seeded(1)} />} />
      </Routes>
    </MemoryRouter>,
  )

describe('NotFound', () => {
  test('the robot offers to take you back; "Evet" goes to the home page', async () => {
    const user = userEvent.setup()
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: 'Sayfa bulunamadı' })).toBeInTheDocument()
    expect(screen.getByText('Kaybolmuş görünüyorsun. Seni geri götürmemi ister misin?')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Evet' }))
    expect(screen.getByText('Ana sayfa içeriği')).toBeInTheDocument()
  })

  test('"Hayır" → it lies down and waits; knocking cracks the glass once and it comes back, cross', async () => {
    const user = userEvent.setup()
    const { container } = renderAt()
    await user.click(screen.getByRole('button', { name: 'Hayır, burayı çok sevdim' }))

    expect(screen.queryByRole('button', { name: 'Evet' })).not.toBeInTheDocument()
    expect(screen.getByText('Tamamdır, burada bekliyorum. Camı tıklatırsan gelirim.')).toBeInTheDocument()
    expect(container.querySelector('.guide-robot')).toHaveClass('is-lying')
    const glass = screen.getByRole('button', { name: 'Camı tıklat' })
    expect(glass).toHaveFocus()
    expect(container.querySelector('.not-found__glass')).not.toBeInTheDocument()

    await user.keyboard('{Enter}')
    expect(container.querySelectorAll('.not-found__crack').length).toBeGreaterThan(1)
    // It cracks, it does not break: the glass is no longer something to press.
    expect(screen.queryByRole('button', { name: 'Camı tıklat' })).not.toBeInTheDocument()

    const back = await screen.findByRole('link', { name: 'Geri dön' }, { timeout: 2000 })
    expect(screen.getByText('Az yavaş dokun! Bak, kırdın…')).toBeInTheDocument()
    expect(container.querySelector('.guide-robot')).toHaveClass('is-upset')
    expect(back).toHaveAttribute('href', '/')
    expect(back).toHaveFocus()
    const cracks = container.querySelectorAll('.not-found__crack').length
    await user.click(glass)
    expect(container.querySelectorAll('.not-found__crack')).toHaveLength(cracks)
  })
})
