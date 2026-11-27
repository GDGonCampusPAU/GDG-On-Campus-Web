import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { juryApi } from '../lib/juryApi.js'
import { fakeJuryServer, makeCard } from '../test/juryFixtures.js'

vi.mock('../lib/juryApi.js', () => ({ juryApi: vi.fn(), juryAdminApi: vi.fn() }))

let server
beforeEach(() => {
  window.localStorage.clear()
  server = fakeJuryServer()
  vi.mocked(juryApi).mockImplementation(() => server.client)
})
afterEach(() => vi.clearAllMocks())

const show = (query = '') => {
  render(
    <MemoryRouter initialEntries={[`/juri/${'a'.repeat(32)}${query}`]}>
      <App />
    </MemoryRouter>,
  )
  return userEvent.setup()
}
const openTeam = async (name) => {
  const user = show()
  await user.click(await screen.findByRole('button', { name }))
  return user
}
const group = (name) => screen.getByRole('group', { name })
const pick = (user, criterion, value) => user.click(within(group(criterion)).getByRole('radio', { name: String(value) }))
const pickAll = async (user, value) => {
  for (const name of [/Teknik uygulama/, /Fikir özgünlüğü/, /Demo ve sunum/]) await pick(user, name, value)
}

describe('jüri listesi', () => {
  it('sırayla takımları, rozetleri ve ilerlemeyi gösterir', async () => {
    server.cards = { t1: makeCard(4, { status: 'SUBMITTED' }), t2: makeCard(2) }
    show()
    expect(await screen.findByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })).toBeInTheDocument()
    const rows = within(screen.getByRole('list')).getAllByRole('button')
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Kampüs Asistanı')
    expect(rows[0]).toHaveTextContent('Gönderildi')
    expect(rows[1]).toHaveTextContent('Taslak')
    expect(rows[2]).toHaveTextContent('Bekliyor')
    expect(screen.getByText('1 / 3 takım puanlandı')).toBeInTheDocument()
  })

  it('site menüsü olmadan, noindex ve no-referrer ile açılır', async () => {
    show()
    await screen.findByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(document.querySelector('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
  })

  it('geçersiz linkte anlaşılır hata gösterir', async () => {
    server.invalid = true
    show()
    expect(await screen.findByRole('alert')).toHaveTextContent('Bu jüri linki geçersiz, organizasyon ekibiyle iletişime geçin.')
  })

  it('sunucu yoksa tekrar deneme sunar', async () => {
    server.offline = true
    const user = show()
    await screen.findByRole('alert')
    server.offline = false
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    expect(await screen.findByRole('heading', { name: 'Ayşe Yılmaz' })).toBeInTheDocument()
  })
})

describe('takım görünümü', () => {
  it('1-5 seçimi, gerekçe, adaylık ve toplam puan çalışır; taslak kaydedilir', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    const technical = group(/Teknik uygulama/)
    expect(within(technical).getAllByRole('radio')).toHaveLength(5)
    await pick(user, /Teknik uygulama/, 2)
    await pick(user, /Teknik uygulama/, 4)
    expect(within(technical).getByRole('radio', { name: '4' })).toBeChecked()
    expect(within(technical).getByRole('radio', { name: '2' })).not.toBeChecked()
    expect(screen.getByText('40 / 100')).toBeInTheDocument()

    await user.click(within(technical).getByText('Neden? (isteğe bağlı)'))
    await user.type(screen.getByLabelText('Teknik uygulama: neden?'), 'Sağlam')
    expect(screen.getByText('Yakıştırdığın ödülleri işaretle. Ödül önerileri yalnız aday gösterilen takımlar arasından çıkar.')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Vay Be' }))
    await user.type(screen.getByLabelText('Genel yorum'), 'İyi iş')
    expect(screen.getByRole('status')).toHaveTextContent('Kaydediliyor')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Kaydedildi'), { timeout: 3000 })
    expect(server.cards.t1).toMatchObject({ status: 'DRAFT', nominations: ['wow'], generalComment: 'İyi iş' })
    expect(server.cards.t1.scores[0]).toEqual({ criterion: 'technical', value: 4, comment: 'Sağlam' })
  })

  it('linkler yeni sekmede ve referrer olmadan açılır', async () => {
    await openTeam(/Kampüs Asistanı/)
    const link = await screen.findByRole('link', { name: /Repo/ })
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
    expect(screen.queryByRole('link', { name: /Demo/ })).toBeNull()
  })

  it('teslimden sonra push yapan takımda uyarı ve push listesi gösterir', async () => {
    server.entries[0].latePush = { deadline: '2026-11-27T15:00:00.000Z', status: 'LATE', lateCount: 2, forcedLate: true, headsAtDeadline: [],
      latePushes: [{ at: '2026-11-27T15:20:00.000Z', type: 'force_push', actor: 'ali', ref: 'main', sha: 'b', url: 'https://github.com/a/b/compare/a...b' }] }
    await openTeam(/Kampüs Asistanı/)
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent('Teslimden sonra 2 push yapılmış (force push var')
    expect(note).toHaveTextContent('Teslim: 18:00')
    expect(within(note).getByRole('link', { name: /Değişiklikler/ })).toHaveAttribute('href', 'https://github.com/a/b/compare/a...b')
  })

  it('zamanında teslim eden takımda uyarı yok', async () => {
    server.entries[0].latePush = { deadline: '2026-11-27T15:00:00.000Z', status: 'ON_TIME', lateCount: 0, forcedLate: false, latePushes: [], headsAtDeadline: [] }
    await openTeam(/Kampüs Asistanı/)
    await screen.findByRole('link', { name: /Repo/ })
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('javascript: linki render edilmez', async () => {
    server.entries[0].repoUrl = 'javascript:alert(1)'
    await openTeam(/Kampüs Asistanı/)
    expect(await screen.findByText(/bağlantısı eklenmemiş/)).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('linkleri boş takım puanlanıp gönderilebilir', async () => {
    const user = await openTeam(/Işık Hızı/)
    expect(await screen.findByText(/bağlantısı eklenmemiş/)).toBeInTheDocument()
    await pickAll(user, 5)
    await user.click(screen.getByRole('button', { name: 'Puanları Gönder' }))
    await waitFor(() => expect(server.cards.t2?.status).toBe('SUBMITTED'))
    // Gönderilince takım listesine dönülür; takım orada "Gönderildi" görünür.
    expect(await screen.findByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Işık Hızı/ }).closest('li')).toHaveTextContent('Gönderildi')
  })

  it('eksik kriterle gönderimde eksikleri listeler', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    await pick(user, /Teknik uygulama/, 3)
    await user.click(screen.getByRole('button', { name: 'Puanları Gönder' }))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Fikir özgünlüğü')
    expect(alert).toHaveTextContent('Demo ve sunum')
    expect(alert).not.toHaveTextContent('Teknik uygulama')
    expect(server.client.save.mock.calls.some(([, body]) => body.submit)).toBe(false)
  })

  it('önceki/sonraki düğmesi yok; takımlara dönüş var', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    expect(screen.queryByRole('button', { name: /Önceki|Sonraki/ })).toBeNull()
    await user.click(screen.getByRole('button', { name: '← Takımlar' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Ayşe Yılmaz' })).toBeInTheDocument()
  })
})

describe('gönderilmemiş değişiklik', () => {
  beforeEach(() => {
    server.cards.t1 = makeCard(3, { status: 'SUBMITTED' })
  })

  it('takımda ve listede belirgin uyarı gösterir', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    await screen.findByRole('button', { name: 'Gönderildi' })
    expect(screen.queryByRole('alert')).toBeNull()
    await pick(user, /Teknik uygulama/, 5)
    expect(screen.getByRole('alert')).toHaveTextContent('Gönderilmemiş değişiklik var')
    expect(screen.getByRole('button', { name: 'Yeniden gönder' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: '← Takımlar' }))
    expect(screen.getByRole('alert')).toHaveTextContent('1 takımda gönderilmemiş değişiklik var')
    expect(screen.getByRole('button', { name: /Kampüs Asistanı/ })).toHaveTextContent('Gönderilmemiş değişiklik')
  })

  it('yeniden gönderince uyarı kalkar', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    await screen.findByRole('button', { name: 'Gönderildi' })
    await pick(user, /Teknik uygulama/, 5)
    await user.click(screen.getByRole('button', { name: 'Yeniden gönder' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(server.cards.t1.scores[0].value).toBe(5)
  })

  it('geri al ile önceki puana döner', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    await screen.findByRole('button', { name: 'Gönderildi' })
    await pick(user, /Teknik uygulama/, 5)
    await user.click(screen.getByRole('button', { name: 'Değişikliği geri al' }))
    expect(within(group(/Teknik uygulama/)).getByRole('radio', { name: '3' })).toBeChecked()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('kilitlenince değişikliğin sayılmayacağını söyler', async () => {
    const user = await openTeam(/Kampüs Asistanı/)
    await screen.findByRole('button', { name: 'Gönderildi' })
    await pick(user, /Teknik uygulama/, 5)
    server.locked = true
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('önce gönderdiğin puanlar geçerli'))
  })
})

describe('iptal edilen kart', () => {
  it('listede ve takımda iptali söyler', async () => {
    server.cards.t1 = makeCard(null, { version: 2, voidedAt: '2026-11-27T18:00:00.000Z' })
    const user = show()
    const row = await screen.findByRole('button', { name: /Kampüs Asistanı/ })
    await waitFor(() => expect(row).toHaveTextContent('İptal edildi'))
    await user.click(row)
    expect(screen.getByRole('alert')).toHaveTextContent('Puan kartın yönetim tarafından iptal edildi')
  })
})

describe('kilitli mod', () => {
  it('bütün alanlar salt okunur', async () => {
    server.locked = true
    server.cards.t1 = makeCard(4)
    await openTeam(/Kampüs Asistanı/)
    await screen.findByText('80 / 100')
    expect(screen.getByText('Puanlama kapatıldı.')).toBeInTheDocument()
    screen.getAllByRole('radio').forEach((radio) => expect(radio).toBeDisabled())
    screen.getAllByRole('checkbox').forEach((box) => expect(box).toBeDisabled())
    expect(screen.getByLabelText('Genel yorum')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: /Gönder/ })).toBeNull()
  })
})

describe('canlı oylama', () => {
  it('listede sunan takım bandı ve satır etiketleri; "Puanla" o takımı açar', async () => {
    server = fakeJuryServer({ live: { open: true, current: 't2', closed: ['t1'] } })
    const user = show()
    const banner = await screen.findByText(/Şu an sunuyor:/)
    expect(banner.closest('[role="status"]')).toHaveTextContent('Işık Hızı')
    const rows = within(screen.getByRole('list')).getAllByRole('button')
    expect(rows[0]).toHaveTextContent('Oylama bitti')
    expect(rows[1]).toHaveTextContent('Şu an sunuyor')
    await user.click(screen.getByRole('button', { name: 'Puanla' }))
    expect(await screen.findByRole('heading', { name: /Işık Hızı/ })).toBeInTheDocument()
    expect(within(group(/Teknik uygulama/)).getByRole('radio', { name: '4' })).toBeEnabled()
  })

  it('oylaması biten ya da henüz açılmayan takımda alanlar kilitli ve nedeni yazar', async () => {
    server = fakeJuryServer({ live: { open: true, current: 't2', closed: ['t1'] } })
    await openTeam(/Kampüs Asistanı/)
    expect(await screen.findByText('Bu takımın oylaması bitti.')).toBeInTheDocument()
    expect(within(group(/Teknik uygulama/)).getByRole('radio', { name: '4' })).toBeDisabled()
  })
})
