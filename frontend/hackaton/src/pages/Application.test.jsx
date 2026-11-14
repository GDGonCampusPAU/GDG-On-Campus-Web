import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Application from './Application.jsx'

const api = vi.hoisted(() => ({
  get: vi.fn(), update: vi.fn(), join: vi.fn(), withdraw: vi.fn(), leave: vi.fn(),
  approve: vi.fn(), reject: vi.fn(), remove: vi.fn(), sendDisbandCode: vi.fn(), disband: vi.fn(),
  create: vi.fn(), sendTransferCode: vi.fn(), transfer: vi.fn(),
}))
vi.mock('../lib/eventApi.js', () => ({
  applicationApi: () => api,
  lookupTeam: vi.fn(async () => ({ name: 'Yıldızlar', size: 2, maxSize: 4, full: false })),
}))

const identity = { token: 't', participant: { email: 'ayse@example.com' } }
// Temel şablonun (shared/hackathon-event.json) tüm zorunlu sorularını geçerli biçimde yanıtlar.
const answers = {
  fullName: 'Ayşe Yılmaz', email: 'ayse@example.com', phone: '05551234567', education: 'bachelor',
  department: 'Bilgisayar Mühendisliği', year: '3', interests: ['web'], level: 'beginner', hackathonBefore: 'no',
  motivation: 'Takım çalışmasını deneyimlemek istiyorum.', availability: 'yes', heardFrom: '', kvkkConsent: ['accepted'],
}
const application = (overrides = {}) => ({
  status: 'PENDING', statusNote: '', submittedAt: '2026-11-14T10:30:00.000Z', email: 'ayse@example.com', answers, team: null, ...overrides,
})
const person = (id, name, extra = {}) => ({ id, name, adminStatus: 'PENDING', captain: false, isMe: false, ...extra })
const captainTeam = {
  name: 'Kod Kurtları', role: 'CAPTAIN', status: 'APPROVED', size: 3, maxSize: 4, code: 'AB12CD',
  members: [person('c', 'Ayşe Yılmaz', { captain: true, isMe: true, adminStatus: 'APPROVED' }), person('m1', 'Ali Veli', { adminStatus: 'APPROVED' })],
  requests: [person('r1', 'Zeynep Kaya')],
}

const renderPage = (state = { identity }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/basvurum', state }]}>
      <Routes>
        <Route path="/basvurum" element={<Application />} />
        <Route path="/kayit" element={<h1>Kayıt sayfası</h1>} />
      </Routes>
    </MemoryRouter>,
  )
const confirm = async (user, trigger, confirmLabel) => {
  await user.click(screen.getByRole('button', { name: trigger }))
  await user.click(within(screen.getByRole('group', { name: trigger })).getByRole('button', { name: confirmLabel }))
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset())
})

describe('Başvurum sayfası', () => {
  it('doğrulama bilgisi olmadan açılırsa kayıt sayfasına yönlendirir', () => {
    renderPage(null)
    expect(screen.getByRole('heading', { name: 'Kayıt sayfası' })).toBeInTheDocument()
  })

  it('onay durumunu yazar: yönetici onayında / kabul edildi (ekip notuyla)', async () => {
    api.get.mockResolvedValueOnce(application())
    const { unmount } = renderPage()
    expect(await screen.findByRole('heading', { level: 2, name: 'Yönetici onayında' })).toBeInTheDocument()
    expect(screen.getByText(/14 Kasım 2026/)).toBeInTheDocument()
    unmount()

    api.get.mockResolvedValueOnce(application({ status: 'APPROVED', statusNote: 'Hoş geldin!' }))
    renderPage()
    expect(await screen.findByRole('heading', { level: 2, name: 'Başvurun kabul edildi' })).toBeInTheDocument()
    expect(screen.getByText('Hoş geldin!')).toBeInTheDocument()
  })

  it('oturum süresi dolduysa yeniden doğrulamaya yönlendirir', async () => {
    api.get.mockRejectedValueOnce(Object.assign(new Error('Yetkisiz'), { status: 401 }))
    renderPage()
    expect(await screen.findByText(/Oturumunun süresi doldu/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'E-postamı doğrula' })).toHaveAttribute('href', '/kayit')
  })

  it('takımı olmayan kişi bireysel uyarısını görür, kodla istek gönderir ve geri çekebilir', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(application())
    api.join.mockResolvedValueOnce(application({ team: { name: 'Yıldızlar', role: 'MEMBER', status: 'PENDING', size: 2, maxSize: 4 } }))
    api.withdraw.mockResolvedValueOnce(application())
    renderPage()
    expect(await screen.findByText('Şu an bireysel olarak katılacaksın.')).toBeInTheDocument()
    const send = screen.getByRole('button', { name: 'Katılma isteği gönder' })
    expect(send).toBeDisabled()
    await user.type(screen.getByLabelText('Takım kodu'), 'ab12cd')
    expect(await screen.findByText(/Yıldızlar takımına katılma isteği göndereceksin/)).toBeInTheDocument()
    await user.click(send)
    expect(api.join).toHaveBeenCalledWith('AB12CD')
    expect(await screen.findByText(/takımına katılma isteğin kaptanın onayını bekliyor/)).toBeInTheDocument()
    expect(screen.getByText(/haber vermek isteyebilirsin/)).toBeInTheDocument()

    await confirm(user, 'İsteği geri çek', 'Geri çek')
    expect(api.withdraw).toHaveBeenCalled()
    expect(await screen.findByText('Şu an bireysel olarak katılacaksın.')).toBeInTheDocument()
  })

  it('kaptan istekleri kabul eder/reddeder ve üyeyi çıkarır; ad ve yönetici onayı görünür', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(application({ team: captainTeam }))
    api.approve.mockResolvedValueOnce(application({ team: { ...captainTeam, requests: [] } }))
    renderPage()

    const requestsTab = await screen.findByRole('tab', { name: /Katılmak isteyenler/ })
    expect(requestsTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('AB12CD')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Takımı dağıt' })).toBeInTheDocument()
    const row = screen.getByText('Zeynep Kaya').closest('li')
    expect(within(row).getByText('Yönetici onayı bekleniyor')).toBeInTheDocument()

    // Reddet önce onay ister.
    await user.click(within(row).getByRole('button', { name: 'Reddet' }))
    expect(api.reject).not.toHaveBeenCalled()
    await user.click(within(row).getByRole('button', { name: 'Vazgeç' }))

    await user.click(within(row).getByRole('button', { name: 'Kabul et' }))
    expect(api.approve).toHaveBeenCalledWith('r1')
    expect(await screen.findByText('Zeynep Kaya takıma katıldı.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Takımdakiler/ }))
    const captainRow = screen.getByText('Ayşe Yılmaz', { selector: '.team-panel__name' }).closest('li')
    expect(within(captainRow).getByText('Kaptan')).toBeInTheDocument()
    expect(within(captainRow).getByText('Yönetici onayladı')).toBeInTheDocument()
    expect(within(captainRow).queryByRole('button', { name: 'Takımdan çıkar' })).not.toBeInTheDocument()

    api.remove.mockResolvedValueOnce(application({ team: { ...captainTeam, requests: [], members: [captainTeam.members[0]] } }))
    await confirm(user, 'Takımdan çıkar', 'Çıkar')
    expect(api.remove).toHaveBeenCalledWith('m1')
  })

  it('üye listeyi görür ve yalnız ayrılabilir', async () => {
    const user = userEvent.setup()
    const memberTeam = { ...captainTeam, role: 'MEMBER', requests: undefined,
      members: [person('c', 'Kaptan Kişi', { captain: true, adminStatus: 'APPROVED' }), person('me', 'Ayşe Yılmaz', { isMe: true })] }
    api.get.mockResolvedValueOnce(application({ team: memberTeam }))
    api.leave.mockResolvedValueOnce(application())
    renderPage()
    expect(await screen.findByText('Kaptan Kişi')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Takımı dağıt' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kabul et|Reddet|Takımdan çıkar/ })).not.toBeInTheDocument()
    expect(screen.getByText('Sen')).toBeInTheDocument()

    await confirm(user, 'Takımdan ayrıl', 'Ayrıl')
    expect(api.leave).toHaveBeenCalled()
    expect(await screen.findByText(/Takımdan ayrıldın/)).toBeInTheDocument()
  })

  it('takımı dağıtmak için e-postaya gelen kod istenir', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(application({ team: captainTeam }))
    api.sendDisbandCode.mockResolvedValueOnce({})
    api.disband.mockResolvedValueOnce(application())
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Takımı dağıt' }))
    expect(api.sendDisbandCode).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Kodu gönder' }))
    expect(api.sendDisbandCode).toHaveBeenCalled()
    const submit = within(screen.getByRole('group', { name: 'Takımı dağıt' })).getByRole('button', { name: 'Takımı dağıt' })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText(/E-postana gelen kod/), '12a3456')
    await user.click(submit)
    expect(api.disband).toHaveBeenCalledWith('123456')
    expect(await screen.findByText(/Takımı dağıttın/)).toBeInTheDocument()
    expect(screen.getByText('Şu an bireysel olarak katılacaksın.')).toBeInTheDocument()
  })

  it('bilgiler takım hariç düzenlenir; kaydedince yeniden onaya düştüğü bildirilir', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(application({ status: 'APPROVED', team: captainTeam }))
    api.update.mockImplementationOnce(async (values) => application({ answers: values, team: captainTeam }))
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Bilgilerimi düzenle' }))
    expect(screen.getByText(/yeniden yönetici onayına düşer; şu anki kabul durumu da kalkar/)).toBeInTheDocument()
    expect(screen.queryByText("Hackathon'a nasıl katılmayı düşünüyorsun?")).not.toBeInTheDocument()

    const name = screen.getByLabelText('Ad soyad')
    expect(name).toHaveValue('Ayşe Yılmaz')
    expect(screen.getByLabelText('E-posta')).toHaveAttribute('readonly')
    await user.clear(name)
    await user.type(name, 'Ayşe Yıldız')
    while (!screen.queryByRole('button', { name: 'Kaydet' })) await user.click(screen.getByRole('button', { name: 'İleri' }))
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))

    await waitFor(() => expect(api.update).toHaveBeenCalled())
    const sentValues = api.update.mock.calls[0][0]
    expect(sentValues.fullName).toBe('Ayşe Yıldız')
    expect(sentValues.team).toBeUndefined()
    expect(await screen.findByText('Bilgilerin güncellendi. Başvurun yeniden yönetici onayına gönderildi.')).toHaveFocus()
    expect(screen.getByRole('heading', { level: 2, name: 'Yönetici onayında' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument()
  })

  it('takımı olmayan kişi sayfadan takım kurabilir ve kaptan olur', async () => {
    const user = userEvent.setup()
    api.get.mockResolvedValueOnce(application())
    api.create.mockResolvedValueOnce(application({ team: { ...captainTeam, name: 'Yeni Ekip', members: [captainTeam.members[0]], requests: [] } }))
    renderPage()
    expect(await screen.findByRole('heading', { level: 3, name: 'Takım kur' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Takıma katıl' })).toBeInTheDocument()
    const create = screen.getByRole('button', { name: 'Takımı kur' })
    await user.type(screen.getByLabelText('Takım adı'), 'Y')
    expect(create).toBeDisabled()
    await user.type(screen.getByLabelText('Takım adı'), 'eni   Ekip ')
    await user.click(create)
    expect(api.create).toHaveBeenCalledWith('Yeni Ekip')
    expect(await screen.findByRole('heading', { level: 2, name: 'Yeni Ekip' })).toBeInTheDocument()
    expect(screen.getByText(/Takımın kuruldu/)).toBeInTheDocument()
    expect(screen.queryByText('Şu an bireysel olarak katılacaksın.')).not.toBeInTheDocument()
  })

  it('kaptan, onaylı bir üyeyi e-posta koduyla kaptan yapar', async () => {
    const user = userEvent.setup()
    const afterTransfer = { ...captainTeam, role: 'MEMBER', requests: undefined,
      members: [person('m1', 'Ali Veli', { captain: true, adminStatus: 'APPROVED' }), person('c', 'Ayşe Yılmaz', { isMe: true, adminStatus: 'APPROVED' })] }
    api.get.mockResolvedValueOnce(application({ team: captainTeam }))
    api.sendTransferCode.mockResolvedValueOnce({})
    api.transfer.mockResolvedValueOnce(application({ team: afterTransfer }))
    renderPage()
    await user.click(await screen.findByRole('tab', { name: /Takımdakiler/ }))
    const aliRow = screen.getByText('Ali Veli').closest('li')
    expect(within(screen.getByText('Ayşe Yılmaz', { selector: '.team-panel__name' }).closest('li')).queryByRole('button', { name: 'Kaptan yap' })).not.toBeInTheDocument()
    await user.click(within(aliRow).getByRole('button', { name: 'Kaptan yap' }))

    const dialog = screen.getByRole('group', { name: 'Kaptanlığı Ali Veli adlı kişiye devret' })
    expect(within(dialog).getByText(/sen takımda üye olarak kalırsın/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Takımı dağıt' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Kodu gönder' }))
    expect(api.sendTransferCode).toHaveBeenCalled()
    await user.type(screen.getByLabelText(/E-postana gelen kod/), '654321')
    await user.click(within(dialog).getByRole('button', { name: 'Kaptanlığı devret' }))
    expect(api.transfer).toHaveBeenCalledWith('m1', '654321')
    expect(await screen.findByText('Kaptanlık Ali Veli adlı kişiye geçti.')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Takımdan ayrıl' })).toBeInTheDocument()
  })
})
