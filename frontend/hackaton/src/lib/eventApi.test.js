import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import base from '../data/base.js'
import { api, loginEditor, publishEventPage } from './eventApi.js'
import { loadEvent } from '../data/event.js'

const res = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
})

describe('eventApi & loadEvent', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('api attaches bearer token and JSON headers and wraps network/server failures', async () => {
    fetchMock.mockResolvedValueOnce(res({ ok: true }))
    await api('/event-page/hackathon', { token: 'jwt-1', method: 'PUT', body: { revision: 1 } })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/v1/event-page/hackathon',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer jwt-1' },
        body: '{"revision":1}',
      }),
    )

    fetchMock.mockRejectedValueOnce(new TypeError('offline'))
    await expect(api('/event-page/hackathon')).rejects.toThrow('Sunucuya ulaşılamadı')

    fetchMock.mockResolvedValueOnce(res({ message: 'Revizyon çakışması' }, { ok: false, status: 409 }))
    await expect(api('/event-page/hackathon')).rejects.toMatchObject({
      status: 409,
      message: 'Revizyon çakışması',
    })
  })

  test('loginEditor enforces ORGANIZER or ADMIN role', async () => {
    fetchMock.mockResolvedValueOnce(res({ token: 't1', user: { role: 'MEMBER' } }))
    await expect(loginEditor('m@pau.edu.tr', 'pass')).rejects.toThrow('yönetim yetkisi')

    fetchMock.mockResolvedValueOnce(res({ token: 't2', user: { role: 'ORGANIZER' } }))
    const session = await loginEditor('o@pau.edu.tr', 'pass')
    expect(session).toEqual({ token: 't2', user: { role: 'ORGANIZER' } })
  })

  test('loadEvent rejects malformed server payload and publishEventPage submits payload', async () => {
    fetchMock.mockResolvedValueOnce(res({ data: { event: { ...base, startsAt: 'not-a-date' }, formSlug: 'bad' } }))
    await expect(loadEvent()).rejects.toThrow('Sunucudaki etkinlik verisi geçersiz.')

    const validServerEvent = { ...base, organizer: 'Sunucu Org' }
    fetchMock.mockResolvedValueOnce(res({ data: { event: validServerEvent, formSlug: 'custom-slug', revision: 3 } }))
    await loadEvent()

    fetchMock.mockResolvedValueOnce(res({ data: { revision: 4 } }))
    const published = await publishEventPage(validServerEvent, 3, 'editor-jwt')
    expect(published.revision).toBe(4)
  })
})

