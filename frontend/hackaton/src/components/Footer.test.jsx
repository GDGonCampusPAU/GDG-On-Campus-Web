import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import Footer from './Footer.jsx'
import { fixtureEvent } from '../test/fixtures.js'

vi.mock('../data/event.js', async () => {
  const { fixtureEvent } = await import('../test/fixtures.js')
  return { event: fixtureEvent }
})

describe('Footer', () => {
  it('düzenleyen adını gösterir', () => {
    render(<Footer />)
    expect(screen.getByText(fixtureEvent.organizer)).toBeInTheDocument()
  })

  it('sosyal bağlantıları yeni sekmede ve noopener noreferrer ile verir', () => {
    render(<Footer />)
    for (const s of fixtureEvent.socials) {
      const link = screen.getByRole('link', { name: s.label })
      expect(link).toHaveAttribute('href', s.url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
