import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import Footer from '../components/Footer.jsx'
import base from '../data/base.js'
import { DRAFT_KEY, writeDraft } from '../lib/content.js'
import { getEventPage } from '../lib/eventApi.js'
import { EventProvider, useEvent } from './EventContext.jsx'

vi.mock('../lib/eventApi.js', () => ({
  loginEditor: vi.fn(async () => ({ token: 'editor-token', user: { role: 'ADMIN' } })),
  getEventPage: vi.fn(async () => ({ event: base, formSlug: 'hackathon-katilim', revision: 1 })),
  publishEventPage: vi.fn(async () => ({ revision: 2 })),
  api: vi.fn(async () => ({ data: {} })),
  API_URL: '',
}))

afterEach(() => {
  getEventPage.mockReset()
  getEventPage.mockImplementation(async () => ({ event: base, formSlug: 'hackathon-katilim', revision: 1 }))
  window.localStorage.clear()
  window.sessionStorage.clear()
})

// Shows what every consumer currently sees and exposes refreshEvent to the test.
let refresh
function Probe() {
  const { event, formSlug, error, refreshEvent } = useEvent()
  refresh = refreshEvent
  return <output aria-label="probe">{`${event.organizer}|${formSlug}|${error ? error.message : ''}`}</output>
}

describe('EventContext', () => {
  it('without a provider, consumers get the bundled fallback content', () => {
    render(<Probe />)
    expect(screen.getByLabelText('probe')).toHaveTextContent(`${base.organizer}|hackathon-katilim|`)
  })

  it('refreshEvent re-renders every consumer with server data, no page reload needed', async () => {
    render(
      <EventProvider>
        <Probe />
        <Footer />
      </EventProvider>,
    )
    expect(screen.getAllByText(base.organizer).length).toBeGreaterThan(0)

    getEventPage.mockResolvedValueOnce({ event: { ...base, organizer: 'Yeni Org' }, formSlug: 'yeni-form' })
    await act(() => refresh())

    expect(screen.getByLabelText('probe')).toHaveTextContent('Yeni Org|yeni-form|')
    expect(screen.getByText('Yeni Org', { selector: '.footer__name' })).toBeInTheDocument()
  })

  it('a failed refresh keeps the current content and exposes the error', async () => {
    render(
      <EventProvider initial={{ event: { ...base, organizer: 'Mevcut Org' }, formSlug: 'mevcut' }}>
        <Probe />
      </EventProvider>,
    )
    getEventPage.mockRejectedValueOnce(new Error('API çevrimdışı'))
    await act(() => refresh())
    expect(screen.getByLabelText('probe')).toHaveTextContent('Mevcut Org|mevcut|API çevrimdışı')

    getEventPage.mockResolvedValueOnce({ event: { ...base, startsAt: 'geçersiz' }, formSlug: 'x' })
    await act(() => refresh())
    expect(screen.getByLabelText('probe')).toHaveTextContent('Mevcut Org|mevcut|Sunucudaki etkinlik verisi geçersiz.')
  })

  it('publishing from /admin refreshes the live site content', async () => {
    writeDraft(base, { ...base, organizer: 'Yayın Org' })
    const user = userEvent.setup()
    render(
      <EventProvider>
        <Probe />
        <MemoryRouter initialEntries={['/admin']}>
          <App />
        </MemoryRouter>
      </EventProvider>,
    )
    await user.type(screen.getByLabelText('E-posta'), 'admin@pau.edu.tr')
    await user.type(screen.getByLabelText('Şifre'), 'test-password')
    await user.click(screen.getByRole('button', { name: 'Giriş' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Yayınla' })).toBeEnabled())

    // After the publish the server returns the new content.
    getEventPage.mockResolvedValue({ event: { ...base, organizer: 'Yayın Org' }, formSlug: 'hackathon-katilim', revision: 2 })
    await user.click(screen.getByRole('button', { name: 'Yayınla' }))

    await waitFor(() => expect(screen.getByLabelText('probe')).toHaveTextContent('Yayın Org|'))
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
  })
})
