import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Register from './Register.jsx'
import Application from './Application.jsx'
import base from '../data/base.js'
import { fillUntilConfirm } from '../test/registrationHelpers.js'
import { fixtureSteps } from '../test/fixtures.js'

vi.mock('../components/ParticipantVerification.jsx', () => ({
  default: ({ onVerified }) => (
    <button onClick={() => onVerified({ token: 'participant-token', participant: { email: 'ayse@example.com' } })}>
      Test doğrula
    </button>
  ),
}))

beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ success: true, responseId: 'saved-id' }) })),
  ),
)
afterEach(() => vi.unstubAllGlobals())

const renderRegister = (register = { ...base.register, steps: fixtureSteps }) =>
  render(
    <MemoryRouter>
      <Register data={{ ...base, register }} />
    </MemoryRouter>,
  )

describe('Register sayfası', () => {
  it('h1 ve doğrulama sonrasında formu gösterir', async () => {
    renderRegister()
    expect(screen.getByRole('heading', { level: 1, name: base.register.title })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Test doğrula' }))
    expect(await screen.findByLabelText('Ad soyad')).toBeInTheDocument()
  })

  it('doğrulanmış başvuru kaydedilince başarı ekranını gösterir', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: 'Test doğrula' }))
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    const heading = await screen.findByRole('heading', { name: base.register.successTitle })
    expect(heading).toHaveFocus()
    expect(screen.getByText(base.register.successText)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })

  it('gönderimde 401 alınırsa tekrar doğrulamaya döner ve yeni doğrulamada girilen taslak cevapları korur', async () => {
    const user = userEvent.setup()
    renderRegister()
    await user.click(screen.getByRole('button', { name: 'Test doğrula' }))
    await screen.findByLabelText('Ad soyad')
    // Doğrulama sonrası başvuru kontrolü yapıldı; sıradaki istek (gönderim) 401 döner.
    globalThis.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Oturum süresi doldu.' }),
    })
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    // Token expired: returns to ParticipantVerification screen
    const verifyBtn = await screen.findByRole('button', { name: 'Test doğrula' })
    await user.click(verifyBtn)

    // After re-verification, StepForm retains previous draft values
    expect(await screen.findByLabelText('Ad soyad')).toHaveValue('Ayşe Yılmaz')
    expect(screen.getByLabelText('Bölüm')).toHaveValue('Bilgisayar Mühendisliği')
    expect(screen.getByLabelText('E-posta')).toHaveValue('ayse@example.com')
  })

  it('durum kapalıyken formu değil kapalı mesajını gösterir', () => {
    renderRegister({ ...base.register, status: 'closed', closedMessage: 'Başvurular bitti.' })
    expect(screen.getByRole('heading', { level: 1, name: base.register.title })).toBeInTheDocument()
    expect(screen.getByText('Başvurular bitti.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ad soyad')).not.toBeInTheDocument()
  })

  describe('daha önce başvurmuş katılımcı', () => {
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
    // URL'e göre yanıt: my-submission kontrolü ve form gönderimi ayrı ayrı taklit edilir.
    const respond = ({ submitted, submitStatus = 201 }) =>
      globalThis.fetch.mockImplementation(async (url) => {
        if (String(url).includes('/my-submission')) {
          return json(200, { success: true, data: submitted() ? { submitted: true, status: 'PENDING', submittedAt: '2026-11-14T10:30:00.000Z' } : { submitted: false } })
        }
        return submitStatus === 201
          ? json(201, { success: true, responseId: 'saved-id' })
          : json(submitStatus, { message: submitStatus === 409 ? 'Bu forma daha önce başvurdunuz.' : 'Hata' })
      })
    const renderWithRoutes = () =>
      render(
        <MemoryRouter initialEntries={['/kayit']}>
          <Routes>
            <Route path="/kayit" element={<Register data={{ ...base, register: { ...base.register, steps: fixtureSteps } }} />} />
            <Route path="/basvurum" element={<Application />} />
          </Routes>
        </MemoryRouter>,
      )

    it('doğrulamadan sonra formu açmadan Başvurum sayfasına yönlenir', async () => {
      respond({ submitted: () => true })
      renderWithRoutes()
      await userEvent.click(screen.getByRole('button', { name: 'Test doğrula' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Başvurum' })).toBeInTheDocument()
      expect(screen.getByText('ayse@example.com')).toBeInTheDocument()
      expect(screen.queryByLabelText('Ad soyad')).not.toBeInTheDocument()
      const check = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/my-submission'))
      expect(check[1].headers.Authorization).toBe('Bearer participant-token')
    })

    it('gönderimde "zaten başvurdun" (409) gelirse Başvurum sayfasına geçer', async () => {
      let applied = false
      respond({ submitted: () => applied, submitStatus: 409 })
      const user = userEvent.setup()
      renderWithRoutes()
      await user.click(screen.getByRole('button', { name: 'Test doğrula' }))
      await fillUntilConfirm(user)
      applied = true // başka bir sekmeden başvurulmuş
      await user.click(screen.getByRole('button', { name: 'Gönder' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Başvurum' })).toBeInTheDocument()
    })

    it('409 başka bir nedenle gelirse (form güncellendi) formda kalır ve hatayı gösterir', async () => {
      respond({ submitted: () => false, submitStatus: 409 })
      const user = userEvent.setup()
      renderWithRoutes()
      await user.click(screen.getByRole('button', { name: 'Test doğrula' }))
      await fillUntilConfirm(user)
      await user.click(screen.getByRole('button', { name: 'Gönder' }))
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { level: 1, name: 'Başvurum' })).not.toBeInTheDocument()
    })

    it('kontrol isteği başarısız olursa formu göstermeye devam eder', async () => {
      globalThis.fetch.mockImplementation(async (url) => {
        if (String(url).includes('/my-submission')) throw new TypeError('network down')
        return json(201, { success: true, responseId: 'saved-id' })
      })
      renderWithRoutes()
      await userEvent.click(screen.getByRole('button', { name: 'Test doğrula' }))
      expect(await screen.findByLabelText('Ad soyad')).toBeInTheDocument()
    })
  })

  describe('başvuru sonrası takım ekranı', () => {
    const json = (status, body) => ({ ok: status < 400, status, json: async () => body })
    const submitWith = (team) =>
      globalThis.fetch.mockImplementation(async (url) =>
        String(url).includes('/my-submission')
          ? json(200, { success: true, data: { submitted: false } })
          : json(201, { success: true, responseId: 'saved-id', team }),
      )
    const finish = async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/kayit']}>
          <Routes>
            <Route path="/kayit" element={<Register data={{ ...base, register: { ...base.register, steps: fixtureSteps } }} />} />
            <Route path="/basvurum" element={<Application />} />
          </Routes>
        </MemoryRouter>,
      )
      await user.click(screen.getByRole('button', { name: 'Test doğrula' }))
      await fillUntilConfirm(user)
      await user.click(screen.getByRole('button', { name: 'Gönder' }))
      await screen.findByRole('heading', { name: base.register.successTitle })
      return user
    }

    it('takımı kuran kişiye 6 karakterlik kodu gösterir ve kopyalatır', async () => {
      submitWith({ name: 'Kod Kurtları', role: 'CAPTAIN', status: 'APPROVED', code: 'AB12CD' })
      const user = await finish()
      // userEvent.setup() kendi pano taklidini kurar; onu izle.
      const writeText = vi.spyOn(navigator.clipboard, 'writeText')
      expect(screen.getByText('AB12CD')).toBeInTheDocument()
      expect(screen.getByText('Kod Kurtları')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Kodu kopyala' }))
      expect(writeText).toHaveBeenCalledWith('AB12CD')
      expect(await screen.findByText('Kod kopyalandı.')).toBeInTheDocument()
      expect(screen.queryByText(/kaptanının onaylaması bekleniyor/)).not.toBeInTheDocument()
    })

    it('takıma katılana kaptan onayının beklendiğini söyler, kod göstermez', async () => {
      submitWith({ name: 'Yıldızlar', role: 'MEMBER', status: 'PENDING' })
      await finish()
      expect(screen.getByText('Takım kaptanının onaylaması bekleniyor, haber vermek isteyebilirsin :)')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Kodu kopyala' })).not.toBeInTheDocument()
    })

    it('bireysel başvuruda takım kartı yoktur; "Başvuru kontrol sayfama aktar" Başvurum sayfasına götürür', async () => {
      submitWith(null)
      const user = await finish()
      expect(screen.queryByText(/takımın kuruldu|katılma isteğin/)).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
      await user.click(screen.getByRole('button', { name: 'Başvuru kontrol sayfama aktar' }))
      expect(await screen.findByRole('heading', { level: 1, name: 'Başvurum' })).toBeInTheDocument()
      expect(screen.getByText('ayse@example.com')).toBeInTheDocument()
    })
  })
})
