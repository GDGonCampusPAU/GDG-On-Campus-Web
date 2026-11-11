import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  ApiError,
  downloadHackathonApplicationsCsv,
  downloadPrivateFile,
  getHackathonApplications,
  getUsers,
  updateApplicationStatus,
  updateUserRole,
} from './api.js'

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
})

describe('panel API client', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('normalizes network failures and server errors into ApiError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getUsers('token', 1)).rejects.toMatchObject({
      name: 'ApiError',
      status: 0,
      message: expect.stringContaining('Sunucuya ulaşılamadı'),
    })

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => { throw new SyntaxError('not json') },
    })
    await expect(updateUserRole('u1', 'ADMIN', 'token')).rejects.toMatchObject({
      name: 'ApiError',
      status: 403,
      message: 'Bir hata oluştu. Lütfen tekrar dene.',
    })
  })

  test('getHackathonApplications chains event-page formId for site source and encodes search', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { formId: 'form-123' } }))
      .mockResolvedValueOnce(jsonResponse({ data: [], pagination: { totalItems: 0 } }))

    await getHackathonApplications({ page: 2, limit: 10, search: ' Ayşe & Ali ', source: 'forms' }, 'staff-jwt')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/\/api\/v1\/event-page\/hackathon$/),
      expect.objectContaining({ method: 'GET' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/\/api\/v1\/forms\/form-123\/responses\?page=2&limit=10&search=Ay%C5%9Fe\+%26\+Ali$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer staff-jwt' }),
      }),
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }))
    await getHackathonApplications({ source: 'legacy', search: 'team' }, 'staff-jwt')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/hackathon\/applications\?page=1&limit=10&search=team$/),
      expect.any(Object),
    )
  })

  test('downloadHackathonApplicationsCsv sends Authorization and surfaces error JSON', async () => {
    const fakeBlob = new Blob(['csv'])
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { formId: 'form-1' } }))
      .mockResolvedValueOnce({ ok: true, blob: async () => fakeBlob })

    const blob = await downloadHackathonApplicationsCsv('jwt-1', { source: 'forms', search: 'ali' })
    expect(blob).toBe(fakeBlob)
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/forms\/form-1\/responses\/export\?format=csv&search=ali$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
      }),
    )

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Export failed' }),
    })
    await expect(downloadHackathonApplicationsCsv('jwt-1', { source: 'legacy' })).rejects.toEqual(
      expect.objectContaining({ status: 500, message: 'Export failed' }),
    )

    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => fakeBlob })
    await downloadHackathonApplicationsCsv('jwt-1', { source: 'legacy', search: 'team alpha' })
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/hackathon\/applications\/export\?format=csv&search=team%20alpha$/),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
      }),
    )
  })

  test('downloadPrivateFile blocks cross-origin and non-file paths before sending bearer token', async () => {
    for (const unsafeUrl of [
      'https://attacker.example/api/v1/files/secret.pdf',
      '//attacker.example/api/v1/files/secret.pdf',
      '/api/v1/auth/me',
      '/api/v1/files/../users',
    ]) {
      await expect(downloadPrivateFile(unsafeUrl, 'secret-token')).rejects.toBeInstanceOf(ApiError)
    }
    expect(fetchMock).not.toHaveBeenCalled()

    const pdfBlob = new Blob(['pdf'])
    fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => pdfBlob })
    const result = await downloadPrivateFile('/api/v1/files/resume-1.pdf', 'secret-token')
    expect(result).toBe(pdfBlob)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/files\/resume-1\.pdf$/),
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
      }),
    )
  })

  test('updateApplicationStatus and status-filtered list/CSV call expected endpoints', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { formId: 'form-99' } }))
      .mockResolvedValueOnce(jsonResponse({ data: [], pagination: { totalItems: 0 } }))

    await getHackathonApplications({ source: 'forms', status: 'APPROVED' }, 'jwt-1')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/forms\/form-99\/responses\?page=1&limit=10&status=APPROVED$/),
      expect.any(Object),
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, emailSent: true, data: { _id: 'resp-1', status: 'APPROVED' } }))
    await updateApplicationStatus({ id: 'resp-1', formId: 'form-99', source: 'forms', status: 'APPROVED', note: 'Uygun', notify: true }, 'jwt-1')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/forms\/form-99\/responses\/resp-1\/status$/),
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-1' }),
        body: JSON.stringify({ status: 'APPROVED', note: 'Uygun', notify: true }),
      }),
    )

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, emailSent: false, data: { _id: 'leg-1', status: 'REJECTED' } }))
    await updateApplicationStatus({ id: 'leg-1', source: 'legacy', status: 'REJECTED', notify: false }, 'jwt-1')
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/api\/v1\/hackathon\/applications\/leg-1\/status$/),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'REJECTED', note: '', notify: false }),
      }),
    )
  })
})

