// @vitest-environment jsdom
import '../../src/test/setup.js'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Applications from '../../src/pages/Applications.jsx'
import Users from '../../src/pages/Users.jsx'
import * as api from '../../src/lib/api.js'

vi.mock('../../src/lib/api.js', async () => {
  const actual = await vi.importActual('../../src/lib/api.js')
  return {
    ...actual,
    getHackathonApplications: vi.fn(),
    downloadHackathonApplicationsCsv: vi.fn(),
    getUsers: vi.fn(),
    updateUserRole: vi.fn(),
  }
})

const adminSession = {
  token: 'staff-token-123',
  user: { id: 'admin-1', role: 'ADMIN', fullName: 'Admin User' },
}

describe('Milestone 4 Adversarial Challenges', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  // =========================================================================
  // Challenge Group 1: downloadPrivateFile security & edge case resilience
  // =========================================================================
  describe('downloadPrivateFile adversarial inputs', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
      fetchMock.mockReset()
      vi.stubGlobal('fetch', fetchMock)
    })

    test('cleanly rejects non-string or blank URL inputs with ApiError("Dosya adresi geçersiz.")', async () => {
      const invalidInputs = [
        '',
        '   \t\n  ',
        null,
        undefined,
        12345,
        {},
        [],
        true,
        false,
      ]

      for (const input of invalidInputs) {
        await expect(
          api.downloadPrivateFile(input, 'token'),
        ).rejects.toMatchObject({
          name: 'ApiError',
          message: 'Dosya adresi geçersiz.',
        })
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('cleanly catches malformed URL strings without unhandled TypeError', async () => {
      const malformedUrls = [
        'http://[malformed',
        'http://[::1:8080',
        'http://[invalid-host]',
        'https://::invalid',
      ]

      for (const badUrl of malformedUrls) {
        await expect(
          api.downloadPrivateFile(badUrl, 'token'),
        ).rejects.toMatchObject({
          name: 'ApiError',
          message: 'Dosya adresi geçersiz.',
        })
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('cleanly rejects dangerous protocols (javascript, file, data, blob, vbscript)', async () => {
      const dangerousProtocols = [
        'javascript:alert(1)',
        'JAVASCRIPT:prompt(document.cookie)',
        'file:///etc/passwd',
        'file:///C:/Windows/win.ini',
        'data:text/html,<script>alert(1)</script>',
        'blob:http://localhost:5000/some-guid',
        'vbscript:MsgBox(1)',
      ]

      for (const dangerous of dangerousProtocols) {
        await expect(
          api.downloadPrivateFile(dangerous, 'token'),
        ).rejects.toMatchObject({
          name: 'ApiError',
          message: 'Dosya adresi geçersiz.',
        })
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('cleanly rejects path traversal and non-whitelisted paths', async () => {
      const badPaths = [
        '/api/v1/files/../../secret',
        '/uploads/../../etc/passwd',
        '/api/v1/auth/me',
        '/api/v1/users',
        '/uploads/',
        '/api/v1/files/',
        'relative/path/file.pdf',
        '/api/v1/files/foo/bar.pdf',
        'https://attacker.com/uploads/good.png',
        'http://evil.org/api/v1/files/resume.pdf',
      ]

      for (const path of badPaths) {
        await expect(
          api.downloadPrivateFile(path, 'token'),
        ).rejects.toMatchObject({
          name: 'ApiError',
          message: 'Dosya adresi geçersiz.',
        })
      }
      expect(fetchMock).not.toHaveBeenCalled()
    })

    test('accepts valid whitelisted paths, passes Authorization header, and handles HTTP errors', async () => {
      const fakeBlob = new Blob(['sample-file-content'])
      fetchMock.mockResolvedValueOnce({ ok: true, blob: async () => fakeBlob })

      const result = await api.downloadPrivateFile('/api/v1/files/resume-123_abc.pdf', 'secret-auth-token')
      expect(result).toBe(fakeBlob)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/v1\/files\/resume-123_abc\.pdf$/),
        expect.objectContaining({
          headers: { Authorization: 'Bearer secret-auth-token' },
        }),
      )

      // Test HTTP error response (e.g. 404)
      fetchMock.mockResolvedValueOnce({ ok: false, status: 404 })
      await expect(
        api.downloadPrivateFile('/uploads/missing.png', 'token'),
      ).rejects.toMatchObject({
        name: 'ApiError',
        status: 404,
        message: 'Dosya indirilemedi.',
      })
    })
  })

  // =========================================================================
  // Challenge Group 2: Applications.jsx edge cases
  // =========================================================================
  describe('Applications.jsx phone, idea, and link edge cases', () => {
    test('handles null answers gracefully and omits phone and idea if absent/empty/whitespace/undefined/null', async () => {
      const records = [
        {
          _id: 'r-null-answers',
          teamName: 'Null Answers Team',
          verifiedEmail: 'null-answers@example.com',
          submittedAt: '2026-11-10T10:00:00Z',
          answers: null,
          fullName: 'Null Answers User',
          phone: '',
          projectIdea: '   ',
          uploadedFiles: [],
        },
        {
          _id: 'r-whitespace-fields',
          verifiedEmail: 'whitespace@example.com',
          submittedAt: '2026-11-10T10:00:00Z',
          answers: [
            { fieldId: 'fullName', label: 'Ad Soyad', value: 'Whitespace User' },
            { fieldId: 'phone', label: 'Telefon', value: '   \t  ' },
            { fieldId: 'motivation', label: 'Motivasyon', value: '' },
          ],
          uploadedFiles: [],
        },
        {
          _id: 'r-literal-strings',
          verifiedEmail: 'literal@example.com',
          submittedAt: '2026-11-10T10:00:00Z',
          answers: [
            { fieldId: 'fullName', label: 'Ad Soyad', value: 'Literal String User' },
            { fieldId: 'tel', label: 'Telefon', value: 'undefined' },
            { fieldId: 'projectIdea', label: 'Proje', value: 'null' },
          ],
          uploadedFiles: [],
        },
      ]

      api.getHackathonApplications.mockResolvedValue({
        data: records,
        pagination: { totalItems: 3, totalPages: 1 },
      })

      const { container } = render(<Applications session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByRole('heading', { name: 'Null Answers Team' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Whitespace User' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Literal String User' })).toBeInTheDocument()

      // Asserts NO invalid tel: links exist
      expect(container.querySelector('a[href^="tel:"]')).toBeNull()
      // Asserts NO Proje fikri details tags exist
      expect(screen.queryByText('Proje fikri')).toBeNull()
    })

    test('displays valid phone and valid idea correctly for both site submissions and legacy records', async () => {
      const records = [
        {
          _id: 'r-valid-site',
          verifiedEmail: 'site@example.com',
          submittedAt: '2026-11-10T10:00:00Z',
          answers: [
            { fieldId: 'fullName', label: 'Ad Soyad', value: 'Site User' },
            { fieldId: 'phone', label: 'Telefon', value: '+905551112233' },
            { fieldId: 'motivation', label: 'Motivasyon', value: 'Yapay zeka projesi' },
          ],
          uploadedFiles: [],
        },
        {
          _id: 'r-valid-legacy',
          teamName: 'Legacy Team',
          verifiedEmail: 'legacy@example.com',
          submittedAt: '2026-11-10T10:00:00Z',
          answers: null,
          leaderName: 'Legacy Leader',
          leaderPhone: '+905554445566',
          projectIdea: 'Mobil robotik projesi',
          uploadedFiles: [],
        },
      ]

      api.getHackathonApplications.mockResolvedValue({
        data: records,
        pagination: { totalItems: 2, totalPages: 1 },
      })

      const { container } = render(<Applications session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByRole('heading', { name: 'Site User' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Legacy Team' })).toBeInTheDocument()

      // Phone links
      const sitePhone = container.querySelector('a[href="tel:+905551112233"]')
      expect(sitePhone).not.toBeNull()
      expect(sitePhone).toHaveTextContent('+905551112233')

      const legacyPhone = container.querySelector('a[href="tel:+905554445566"]')
      expect(legacyPhone).not.toBeNull()
      expect(legacyPhone).toHaveTextContent('+905554445566')

      // Project idea sections
      const ideaContainers = container.querySelectorAll('.app-card__idea')
      expect(ideaContainers).toHaveLength(2)
      expect(ideaContainers[0]).toHaveTextContent('Yapay zeka projesi')
      expect(ideaContainers[1]).toHaveTextContent('Mobil robotik projesi')
    })

    test('renders external resumeUrl with https:// as an anchor with target=_blank and rel=noopener noreferrer', async () => {
      const records = [
        {
          _id: 'r-external-resume',
          teamName: 'External Resume Team',
          verifiedEmail: 'resume-ext@example.com',
          submittedAt: '2026-11-10T10:00:00Z',
          fullName: 'External Resume User',
          resumeUrl: 'https://storage.example.com/resumes/my-cv.pdf',
          uploadedFiles: [
            { filename: 'cloud.pdf', originalName: 'bulut.pdf', url: 'https://cloud.example.com/doc.pdf' },
          ],
        },
      ]

      api.getHackathonApplications.mockResolvedValue({
        data: records,
        pagination: { totalItems: 1, totalPages: 1 },
      })

      render(<Applications session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByRole('heading', { name: 'External Resume Team' })).toBeInTheDocument()

      const resumeLink = screen.getByRole('link', { name: 'Özgeçmiş indir' })
      expect(resumeLink).toHaveAttribute('href', 'https://storage.example.com/resumes/my-cv.pdf')
      expect(resumeLink).toHaveAttribute('target', '_blank')
      expect(resumeLink).toHaveAttribute('rel', 'noopener noreferrer')

      const cloudFileLink = screen.getByRole('link', { name: 'bulut.pdf indir' })
      expect(cloudFileLink).toHaveAttribute('href', 'https://cloud.example.com/doc.pdf')
      expect(cloudFileLink).toHaveAttribute('target', '_blank')
      expect(cloudFileLink).toHaveAttribute('rel', 'noopener noreferrer')
    })
  })

  // =========================================================================
  // Challenge Group 3: Users.jsx role filtering, empty state, and pagination
  // =========================================================================
  describe('Users.jsx role filtering, empty state, and pagination', () => {
    test('renders role filter combobox with ALL, PENDING, MEMBER, ORGANIZER, ADMIN and resets page on change', async () => {
      const user = userEvent.setup()
      api.getUsers.mockResolvedValue({
        data: [
          { _id: 'u1', fullName: 'Ali Veli', email: 'ali@example.com', role: 'PENDING', isEmailVerified: true },
        ],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1 },
      })

      render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
      const combobox = await screen.findByRole('combobox', { name: 'Rol filtresi' })
      expect(combobox).toBeInTheDocument()

      // Initial call with ALL
      expect(api.getUsers).toHaveBeenCalledWith('staff-token-123', 1, 'ALL')

      // Switch to PENDING
      await user.selectOptions(combobox, 'PENDING')
      await waitFor(() =>
        expect(api.getUsers).toHaveBeenLastCalledWith('staff-token-123', 1, 'PENDING'),
      )

      // Switch to MEMBER
      await user.selectOptions(combobox, 'MEMBER')
      await waitFor(() =>
        expect(api.getUsers).toHaveBeenLastCalledWith('staff-token-123', 1, 'MEMBER'),
      )

      // Switch to ORGANIZER
      await user.selectOptions(combobox, 'ORGANIZER')
      await waitFor(() =>
        expect(api.getUsers).toHaveBeenLastCalledWith('staff-token-123', 1, 'ORGANIZER'),
      )

      // Switch to ADMIN
      await user.selectOptions(combobox, 'ADMIN')
      await waitFor(() =>
        expect(api.getUsers).toHaveBeenLastCalledWith('staff-token-123', 1, 'ADMIN'),
      )

      // Switch back to ALL
      await user.selectOptions(combobox, 'ALL')
      await waitFor(() =>
        expect(api.getUsers).toHaveBeenLastCalledWith('staff-token-123', 1, 'ALL'),
      )
    })

    test('displays "Kullanıcı bulunamadı" empty state when user list is empty', async () => {
      api.getUsers.mockResolvedValue({
        data: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
      })

      render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByText(/Kullanıcı bulunamadı/i)).toBeInTheDocument()
      expect(screen.getByText(/Henüz üye yok veya kritere uygun üye bulunamadı/i)).toBeInTheDocument()
    })

    test('hides pagination bar when totalPages <= 1, and shows pagination bar when totalPages > 1', async () => {
      const user = userEvent.setup()

      // Case 1: totalPages = 1 -> pager hidden
      api.getUsers.mockResolvedValueOnce({
        data: [{ _id: 'u1', fullName: 'Tek Üye', email: 'tek@example.com', role: 'MEMBER', isEmailVerified: true }],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 1 },
      })

      const { unmount } = render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByRole('heading', { name: 'Tek Üye' })).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Üye sayfalama' })).toBeNull()
      expect(screen.queryByText(/1 \/ 1/)).toBeNull()
      unmount()

      // Case 2: totalPages = 0 -> pager hidden
      api.getUsers.mockResolvedValueOnce({
        data: [],
        pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
      })

      const { unmount: unmount2 } = render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByText(/Kullanıcı bulunamadı/i)).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Üye sayfalama' })).toBeNull()
      unmount2()

      // Case 3: totalPages = 3 -> pager visible, page navigation works
      api.getUsers.mockResolvedValue({
        data: [{ _id: 'u2', fullName: 'Sayfa 1 Üyesi', email: 's1@example.com', role: 'MEMBER', isEmailVerified: true }],
        pagination: { currentPage: 1, totalPages: 3, totalItems: 30 },
      })

      render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByRole('heading', { name: 'Sayfa 1 Üyesi' })).toBeInTheDocument()

      const pager = screen.getByRole('navigation', { name: 'Üye sayfalama' })
      expect(pager).toBeInTheDocument()
      expect(screen.getByText('Sayfa 1 / 3')).toBeInTheDocument()

      // Previous button is disabled on page 1
      const prevBtn = screen.getByRole('button', { name: 'Önceki' })
      const nextBtn = screen.getByRole('button', { name: 'Sonraki' })
      expect(prevBtn).toBeDisabled()
      expect(nextBtn).toBeEnabled()

      // Click next page
      await user.click(nextBtn)
      await waitFor(() =>
        expect(api.getUsers).toHaveBeenLastCalledWith('staff-token-123', 2, 'ALL'),
      )
    })

    test('role change invokes updateUserRole, disables self-role-editing, and handles unverified email', async () => {
      const user = userEvent.setup()
      api.getUsers.mockResolvedValue({
        data: [
          { _id: 'admin-1', fullName: 'Admin User', email: 'admin@example.com', role: 'ADMIN', isEmailVerified: true },
          { _id: 'pending-user', fullName: 'Bekleyen Üye', email: 'bekleyen@example.com', role: 'PENDING', isEmailVerified: true },
          { _id: 'unverified-user', fullName: 'Doğrulanmamış Üye', email: 'unverified@example.com', role: 'PENDING', isEmailVerified: false },
        ],
        pagination: { currentPage: 1, totalPages: 1, totalItems: 3 },
      })
      api.updateUserRole.mockResolvedValue({ success: true })

      render(<Users session={adminSession} onUnauthorized={vi.fn()} />)
      expect(await screen.findByRole('heading', { name: 'Admin User' })).toBeInTheDocument()

      // Current user cannot edit their own role
      const selfSelect = screen.getByRole('combobox', { name: 'Rol — Admin User' })
      expect(selfSelect).toBeDisabled()

      // Unverified user dropdown is disabled and shows notice
      const unverifiedSelect = screen.getByRole('combobox', { name: 'Rol — Doğrulanmamış Üye' })
      expect(unverifiedSelect).toBeDisabled()
      expect(screen.getByText('E-posta doğrulaması bekleniyor.')).toBeInTheDocument()

      // Eligible user can be promoted
      const pendingSelect = screen.getByRole('combobox', { name: 'Rol — Bekleyen Üye' })
      expect(pendingSelect).toBeEnabled()
      await user.selectOptions(pendingSelect, 'MEMBER')
      expect(api.updateUserRole).toHaveBeenCalledWith('pending-user', 'MEMBER', 'staff-token-123')
    })
  })
})
