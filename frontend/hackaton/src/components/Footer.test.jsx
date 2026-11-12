import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Footer from './Footer.jsx'
import { EventProvider } from '../context/EventContext.jsx'
import { fixtureEvent } from '../test/fixtures.js'

const renderFooter = () => render(
  <EventProvider initial={{ event: fixtureEvent, formSlug: 'test' }}>
    <Footer />
  </EventProvider>,
)

describe('Footer', () => {
  it('düzenleyen adını gösterir', () => {
    renderFooter()
    expect(screen.getByText(fixtureEvent.organizer)).toBeInTheDocument()
  })

  it('sosyal bağlantıları yeni sekmede ve noopener noreferrer ile verir', () => {
    renderFooter()
    for (const s of fixtureEvent.socials) {
      const link = screen.getByRole('link', { name: s.label })
      expect(link).toHaveAttribute('href', s.url)
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })
})
