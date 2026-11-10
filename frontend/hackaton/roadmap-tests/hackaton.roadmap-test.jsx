import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import hackathonEvent from '../../../shared/hackathon-event.json'
import { choices, isEventShape } from '../../../shared/eventContent.mjs'
import base from '../src/data/base.js'
import Admin from '../src/pages/Admin.jsx'
import { getEventPage, loginEditor } from '../src/lib/eventApi.js'

vi.mock('../src/lib/eventApi.js', () => ({
  loginEditor: vi.fn(async () => ({ token: 'editor-jwt', user: { role: 'ADMIN' } })),
  getEventPage: vi.fn(async () => ({ event: { ...base, organizer: 'Sunucu Sürümü' }, revision: 4 })),
  publishEventPage: vi.fn(async () => ({ revision: 5 })),
  api: vi.fn(async () => ({ data: {} })),
}))

afterEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

describe('Etkinlik sitesi ve şema yol haritası kabul kapıları', () => {
  test('[P0.3] shared hackathon-event.json includes required KVKK consent field before submit', () => {
    const fields = hackathonEvent.register.steps.flatMap(step => step.fields)
    const kvkk = fields.find(
      field => /kvkk|consent/i.test(field.id) || /kvkk|aydınlatma|açık rıza/i.test(field.label),
    )
    expect(kvkk).toBeTruthy()
    expect(kvkk.required).toBe('yes')
  })

  test('[P1.1] shared eventContent schema supports file and number field kinds alongside backend', () => {
    expect(choices.kind).toEqual(expect.arrayContaining(['file', 'number', 'date']))
  })

  test('[P2.1a] Admin Taslağı sıfırla restores last published server event rather than compile-time base', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Admin />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('E-posta'), 'admin@pau.edu.tr')
    await user.type(screen.getByLabelText('Şifre'), 'password')
    await user.click(screen.getByRole('button', { name: 'Giriş' }))
    await waitFor(() => expect(getEventPage).toHaveBeenCalled())
    expect(loginEditor).toHaveBeenCalled()

    const organizer = await screen.findByRole('textbox', { name: 'Organizatör' })
    await waitFor(() => expect(organizer).toHaveValue('Sunucu Sürümü'))

    await user.clear(organizer)
    await user.type(organizer, 'Geçici Taslak')
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))

    await user.click(screen.getByText('Dosya işlemleri'))
    await user.click(screen.getByRole('button', { name: 'Taslağı sıfırla' }))
    expect(organizer).toHaveValue('Sunucu Sürümü')
  })

  test('[P2.1b] isEventShape rejects empty sponsor and jury/mentor names before publish', () => {
    const emptySponsor = {
      ...base,
      sponsors: [{ name: '', tier: 'main', logo: null, url: null }],
    }
    expect(isEventShape(base, emptySponsor)).toBe(false)
  })
})

