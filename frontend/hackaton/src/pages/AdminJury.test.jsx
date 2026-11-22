import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.jsx'
import { loginEditor } from '../lib/eventApi.js'
import { juryAdminApi } from '../lib/juryApi.js'
import { failure } from '../test/juryFixtures.js'

vi.mock('../lib/juryApi.js', () => ({ juryApi: vi.fn(), juryAdminApi: vi.fn() }))
vi.mock('../lib/eventApi.js', () => ({
  loginEditor: vi.fn(async () => ({ token: 'new-token', user: { role: 'ADMIN' } })),
  getEventPage: vi.fn(),
  publishEventPage: vi.fn(),
  api: vi.fn(),
}))

const criteria = [
  { key: 'technical', label: 'Teknik', description: 'Çalışıyor mu?', weight: 60 },
  { key: 'demo', label: 'Demo', description: 'Net mi?', weight: 40 },
]
const makeConfig = (changes = {}) => ({
  revision: 3,
  locked: false,
  round: 1,
  scorecardCount: 5,
  criteria,
  categories: [
    { key: 'demoGod', name: 'Demo Tanrısı', icon: '🎤', criterionKeys: ['demo'], priority: 1, active: true },
    { key: 'dreamTeam', name: 'Dream Team', icon: '⚙️', criterionKeys: [], priority: 2, active: true },
  ],
  entries: [
    { team: 't1', teamName: 'Çılgın Kodcular', order: 1, projectName: 'Asistan', repoUrl: '', demoUrl: '', presentationUrl: '', scorecardCount: 2, teamMissing: false },
    { team: 't2', teamName: 'Işık Hızı', order: 2, projectName: '', repoUrl: '', demoUrl: '', presentationUrl: '', scorecardCount: 0, teamMissing: false },
  ],
  ...changes,
})
const makeResults = () => ({
  generatedAt: '2026-11-27T17:30:00.000Z',
  locked: false,
  activeJurorCount: 2,
  criteria,
  categoryNames: { demoGod: 'Demo Tanrısı', dreamTeam: 'Dream Team' },
  ranking: [
    {
      team: 't1', rank: 1, teamName: 'Çılgın Kodcular', projectName: 'Asistan', overall: 86.5, judgeCount: 2, teamMissing: false,
      criterionAverages: { technical: 4.5, demo: 4 },
      missingJurors: [],
      cards: [{ juror: { id: 'j1', name: 'Ayşe', active: true }, version: 3, total: 92, generalComment: 'Çok iyi sunum', nominations: ['demoGod'],
        scores: [{ criterion: 'technical', value: 5, comment: 'Canlıda çalıştı' }, { criterion: 'demo', value: 4, comment: '' }] }],
    },
    {
      team: 't2', rank: 2, teamName: 'Işık Hızı', projectName: '', overall: 60, judgeCount: 1, teamMissing: false,
      criterionAverages: { technical: 3, demo: 3 },
      missingJurors: [{ name: 'Burak', hasDraft: true }],
      cards: [],
    },
  ],
  categories: [
    { key: 'demoGod', name: 'Demo Tanrısı', icon: '🎤', winner: 't1', reason: null, basis: 'NOMINATIONS', tie: false, awardedNominees: [], top: [{ team: 't1', score: 80, nominationCount: 1, overall: 86.5 }] },
    { key: 'dreamTeam', name: 'Dream Team', icon: '⚙️', winner: null, reason: 'NO_NOMINATION', basis: null, tie: false, awardedNominees: ['t1'], top: [] },
  ],
})

let client
beforeEach(() => {
  window.sessionStorage.clear()
  client = {
    config: vi.fn(async () => makeConfig()),
    results: vi.fn(async () => makeResults()),
    saveConfig: vi.fn(async (body) => makeConfig({ revision: 4, criteria: body.criteria })),
    teams: vi.fn(async () => [{ id: 't3', name: 'Yeni Takım', code: 'CCCCCC', memberCount: 3 }]),
    jurors: vi.fn(async () => [{ id: 'j1', name: 'Ayşe', active: true, lastSeenAt: null, submittedCount: 1, draftCount: 0, entryCount: 2 }]),
    createJuror: vi.fn(async (name) => ({ juror: { id: `id-${name}`, name }, token: `token-${name}` })),
    regenerate: vi.fn(async (id) => ({ juror: { id, name: 'Ayşe' }, token: 'yeni' })),
    updateJuror: vi.fn(async () => ({})),
    setLock: vi.fn(async (locked) => makeConfig({ locked })),
    reset: vi.fn(async () => ({ deleted: 5, config: makeConfig({ round: 2, scorecardCount: 0 }) })),
    csv: vi.fn(async () => new Blob(['csv'])),
    voidCard: vi.fn(async () => ({ voided: true })),
    log: vi.fn(async () => ({ next: null, items: [
      { id: 'l3', at: '2026-11-27T18:00:00.000Z', action: 'SCORECARD_VOIDED', target: 'Ayşe · Çılgın Kodcular',
        actor: { name: 'Ada', email: 'ada@pau.edu.tr', role: 'ADMIN' }, details: { reason: 'Yanlış takım', card: { total: 92, scores: [] } } },
      { id: 'l2', at: '2026-11-27T17:00:00.000Z', action: 'CONFIG_UPDATED', target: '',
        actor: { name: 'Oya', email: 'oya@pau.edu.tr', role: 'ORGANIZER' }, details: { changes: { criteria: { added: [], removed: [], edited: [{ name: 'Teknik', fields: { weight: [25, 30] } }] } } } },
      { id: 'l1', at: '2026-11-27T16:00:00.000Z', action: 'LINK_REGENERATED', target: 'Burak',
        actor: { name: 'Ada', email: 'ada@pau.edu.tr', role: 'ADMIN' }, details: {} },
    ] })),
  }
  vi.mocked(juryAdminApi).mockImplementation(() => client)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const show = (role = 'ADMIN') => {
  if (role) window.sessionStorage.setItem('hackathon-admin-unlocked', JSON.stringify({ token: 'token', user: { role } }))
  render(
    <MemoryRouter initialEntries={['/admin/juri']}>
      <App />
    </MemoryRouter>,
  )
  return userEvent.setup()
}
const openTab = async (user, name) => {
  await screen.findByRole('button', { name: 'Puanlamayı kilitle' })
  await user.click(screen.getByRole('button', { name }))
}

describe('giriş', () => {
  it('oturum yoksa mevcut yönetici girişini ister', async () => {
    const user = show(null)
    expect(juryAdminApi).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('E-posta'), 'admin@pau.edu.tr')
    await user.type(screen.getByLabelText('Şifre'), 'parola')
    await user.click(screen.getByRole('button', { name: 'Giriş' }))
    expect(loginEditor).toHaveBeenCalledWith('admin@pau.edu.tr', 'parola')
    expect(await screen.findByRole('button', { name: 'Puanlamayı kilitle' })).toBeInTheDocument()
  })

  it('oturum düşerse yarım düzenleme korunur', async () => {
    const user = show()
    await openTab(user, 'Yarışan takımlar')
    await user.type(screen.getAllByLabelText('Proje adı')[1], 'Roket')
    client.saveConfig.mockRejectedValueOnce(failure(401))
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(await screen.findByText(/Oturumun sona erdi/)).toBeVisible()

    await user.type(screen.getByLabelText('E-posta'), 'admin@pau.edu.tr')
    await user.type(screen.getByLabelText('Şifre'), 'parola')
    await user.click(screen.getByRole('button', { name: 'Giriş' }))
    await waitFor(() => expect(screen.queryByText(/Oturumun sona erdi/)).toBeNull())
    expect(screen.getAllByLabelText('Proje adı')[1]).toHaveValue('Roket')
  })
})

describe('sonuçlar', () => {
  it('sıralama tablosunu, jüri sayısını ve ortalamaları gösterir', async () => {
    show()
    const table = await screen.findByRole('table')
    const [head, first, second] = within(table).getAllByRole('row')
    expect(head).toHaveTextContent('Teknik')
    expect(first).toHaveTextContent('Çılgın Kodcular')
    expect(first).toHaveTextContent('86,5')
    expect(first).toHaveTextContent('4,5')
    expect(second).toHaveTextContent('1 / 2 eksik')
    expect(screen.getByText(/1 takımda jüri eksik/)).toHaveTextContent('1 kart taslakta')
  })

  it('öneriyi gösterir; adayı olmayan Dream Team için jüriye bırakır', async () => {
    show()
    const wow = (await screen.findByRole('heading', { name: /Demo Tanrısı/ })).closest('li')
    expect(wow).toHaveTextContent('Öneri: Çılgın Kodcular')
    const dream = screen.getByRole('heading', { name: /Dream Team/ }).closest('li')
    expect(dream).toHaveTextContent('Aday yok, jüri karar versin')
    expect(dream).not.toHaveTextContent('Öneri:')
    expect(dream).toHaveTextContent('Aday gösterilen ama başka ödül önerilen: Çılgın Kodcular')
  })

  it('takıma tıklayınca jüri puanlarını ve gerekçeleri açar', async () => {
    const user = show()
    const table = await screen.findByRole('table')
    await user.click(within(table).getByRole('button', { name: 'Çılgın Kodcular' }))
    expect(screen.getByText('Ayşe: 92 / 100')).toBeInTheDocument()
    expect(screen.getByText('Canlıda çalıştı')).toBeInTheDocument()
    expect(screen.getByText('Çok iyi sunum')).toBeInTheDocument()
  })

  it('10 saniyede bir yenilenir', async () => {
    vi.useFakeTimers()
    try {
      show()
      await act(() => vi.advanceTimersByTimeAsync(0))
      expect(client.results).toHaveBeenCalledTimes(1)
      await act(() => vi.advanceTimersByTimeAsync(10000))
      expect(client.results).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('CSV indirir', async () => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = show()
    await user.click(await screen.findByRole('button', { name: 'CSV indir' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
  })
})

describe('puan kartlarını sıfırla', () => {
  it('ORGANIZER görmez', async () => {
    show('ORGANIZER')
    await screen.findByRole('table')
    expect(screen.queryByRole('button', { name: 'Puan kartlarını sıfırla' })).toBeNull()
  })

  it('ADMIN için yazılı onay ister', async () => {
    const user = show()
    await user.click(await screen.findByRole('button', { name: 'Puan kartlarını sıfırla' }))
    expect(screen.getByText(/5 puan kartı kalıcı olarak silinecek/)).toBeInTheDocument()
    const remove = screen.getByRole('button', { name: 'Kalıcı olarak sil' })
    expect(remove).toBeDisabled()
    const input = screen.getByLabelText('Onaylamak için SIFIRLA yaz')
    await user.type(input, 'SIFIR')
    expect(remove).toBeDisabled()
    expect(client.reset).not.toHaveBeenCalled()
    await user.type(input, 'LA')
    await user.click(remove)
    expect(client.reset).toHaveBeenCalledWith('SIFIRLA')
    expect(await screen.findByText('5 puan kartı silindi.')).toBeInTheDocument()
  })
})

describe('ayarlar', () => {
  it('ağırlık toplamı 100 değilse kaydettirmez', async () => {
    const user = show()
    await openTab(user, 'Kriterler')
    const [weight] = screen.getAllByLabelText('Ağırlık')
    await user.clear(weight)
    await user.type(weight, '50')
    expect(screen.getByRole('alert')).toHaveTextContent('toplamı 100 olmalı (şu an 90)')
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
  })

  it('takım ekler, sıralar ve revision ile kaydeder', async () => {
    const user = show()
    await openTab(user, 'Yarışan takımlar')
    await screen.findByRole('option', { name: /Yeni Takım/ })
    await user.selectOptions(screen.getByLabelText('Takım'), 't3')
    await user.click(screen.getByRole('button', { name: 'Takım ekle' }))
    await user.click(screen.getByRole('button', { name: 'Yeni Takım yukarı taşı' }))
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    const body = client.saveConfig.mock.calls[0][0]
    expect(body.revision).toBe(3)
    expect(body.entries.map((entry) => [entry.team, entry.order])).toEqual([['t1', 1], ['t3', 2], ['t2', 3]])
    expect(body.entries[1].repoUrl).toBe('')
  })

  it('geçersiz linki kaydettirmez', async () => {
    const user = show()
    await openTab(user, 'Yarışan takımlar')
    await user.type(screen.getAllByLabelText('Repo linki')[0], 'github.com/x')
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeDisabled()
  })

  it('kategori ekler ve öncelik verir', async () => {
    const user = show()
    await openTab(user, 'Kategoriler')
    await user.click(screen.getByRole('button', { name: 'Kategori ekle' }))
    await user.type(screen.getAllByLabelText('Ad').at(-1), 'Rubber Duck')
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(client.saveConfig.mock.calls[0][0].categories.at(-1)).toMatchObject({ name: 'Rubber Duck', priority: 3, active: true, criterionKeys: [] })
  })

  it('çakışmada başkasının değişikliğini ezmez', async () => {
    const user = show()
    await openTab(user, 'Kriterler')
    await user.type(screen.getAllByLabelText('Açıklama')[0], ' Ek')
    client.config.mockImplementation(async () => makeConfig({ revision: 4 }))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitFor(() => expect(client.config.mock.calls.length).toBeGreaterThan(2))
    client.saveConfig.mockRejectedValueOnce(failure(409, 'CONFIG_CONFLICT', 'Başka oturumda güncellendi'))
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(client.saveConfig.mock.calls[0][0].revision).toBe(3)
    expect(await screen.findByRole('button', { name: 'Güncel hâli yükle' })).toBeInTheDocument()
    expect(screen.getAllByLabelText('Açıklama')[0]).toHaveValue('Çalışıyor mu? Ek')
  })

  it('kilitlemeden önce onay ister', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    const user = show()
    const button = await screen.findByRole('button', { name: 'Puanlamayı kilitle' })
    await user.click(button)
    expect(client.setLock).not.toHaveBeenCalled()
    await user.click(button)
    expect(client.setLock).toHaveBeenCalledWith(true)
    expect(confirm).toHaveBeenCalledTimes(2)
  })
})

describe('işlem kaydı', () => {
  it.each(['ADMIN', 'ORGANIZER'])('%s kaydı kişi, işlem ve gerekçeyle görür', async (role) => {
    const user = show(role)
    await openTab(user, 'İşlem kaydı')
    const [voided, config, link] = within(await screen.findByRole('list', { name: 'İşlem kaydı' })).getAllByRole('article')
    expect(voided).toHaveTextContent('Puan kartı iptal edildi')
    expect(voided).toHaveTextContent('Ayşe · Çılgın Kodcular')
    expect(voided).toHaveTextContent('Gerekçe: Yanlış takım')
    expect(voided).toHaveTextContent('ada@pau.edu.tr')
    expect(config).toHaveTextContent('Ağırlık: 25 → 30')
    expect(link).toHaveTextContent('Jüri linki yenilendi')
  })
})

describe('kilit açma', () => {
  it('ORGANIZER açamaz, nedenini görür', async () => {
    client.config.mockImplementation(async () => makeConfig({ locked: true }))
    show('ORGANIZER')
    expect(await screen.findByText('Kilidi yalnız ADMIN açabilir.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Puanlamayı aç' })).toBeNull()
  })

  it('ADMIN açabilir', async () => {
    client.config.mockImplementation(async () => makeConfig({ locked: true }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = show()
    await user.click(await screen.findByRole('button', { name: 'Puanlamayı aç' }))
    expect(client.setLock).toHaveBeenCalledWith(false)
  })

  it('ORGANIZER kilitlerken geri açamayacağını onayda görür', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = show('ORGANIZER')
    await user.click(await screen.findByRole('button', { name: 'Puanlamayı kilitle' }))
    expect(confirm.mock.calls[0][0]).toContain('Kilidi yalnız ADMIN açabilir')
    expect(client.setLock).toHaveBeenCalledWith(true)
  })
})

describe('tek kart iptali', () => {
  const openCard = async (user) => {
    await user.click(within(await screen.findByRole('table')).getByRole('button', { name: 'Çılgın Kodcular' }))
  }

  it('ORGANIZER iptal düğmesini görmez', async () => {
    const user = show('ORGANIZER')
    await openCard(user)
    expect(screen.queryByRole('button', { name: /kartını iptal et/ })).toBeNull()
  })

  it('kilitliyken iptal düğmesi yok', async () => {
    client.config.mockImplementation(async () => makeConfig({ locked: true }))
    const user = show()
    await openCard(user)
    expect(screen.queryByRole('button', { name: /kartını iptal et/ })).toBeNull()
  })

  it('ADMIN gerekçesiz iptal edemez, gerekçe ve sürümle iptal eder', async () => {
    const user = show()
    await openCard(user)
    await user.click(screen.getByRole('button', { name: 'Ayşe kartını iptal et' }))
    const confirm = screen.getByRole('button', { name: 'Kartı iptal et' })
    expect(confirm).toBeDisabled()
    const reason = screen.getByLabelText('İptal gerekçesi')
    await user.type(reason, '   ')
    expect(confirm).toBeDisabled()
    await user.type(reason, 'Yanlış takım')
    await user.click(confirm)
    expect(client.voidCard).toHaveBeenCalledWith('j1', 't1', { reason: 'Yanlış takım', version: 3 })
    expect(await screen.findByText('Puan kartı iptal edildi.')).toBeInTheDocument()
  })
})

describe('kilitliyken', () => {
  beforeEach(() => {
    client.config.mockImplementation(async () => makeConfig({ locked: true }))
  })

  it.each(['Kriterler', 'Kategoriler', 'Yarışan takımlar'])('%s düzenlenemez', async (name) => {
    const user = show()
    await user.click(await screen.findByRole('button', { name }))
    await screen.findByText('Puanlama kilitli: ayarlar değiştirilemez.')
    screen.getAllByRole('textbox').forEach((box) => expect(box).toBeDisabled())
  })

  it('sıfırlanamaz', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'Puan kartlarını sıfırla' })).toBeDisabled()
  })
})

describe('jüriler', () => {
  it('ORGANIZER link oluşturamaz ve yenileyemez', async () => {
    const user = show('ORGANIZER')
    await openTab(user, 'Jüriler')
    await screen.findByRole('button', { name: 'Ayşe adını değiştir' })
    expect(screen.queryByLabelText('Jüri adı')).toBeNull()
    expect(screen.queryByRole('button', { name: /linkini yenile/ })).toBeNull()
    expect(screen.getByText('Link oluşturma ve yenileme yalnız ADMIN yetkisindedir.')).toBeInTheDocument()
  })

  it('3 jüri oluşturup linklerini kopyalar', async () => {
    const user = show()
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    await openTab(user, 'Jüriler')
    for (const name of ['Bir', 'İki', 'Üç']) {
      await user.type(screen.getByLabelText('Jüri adı'), name)
      await user.click(screen.getByRole('button', { name: 'Jüri ekle' }))
      await user.click(await screen.findByRole('button', { name: `${name} linkini kopyala` }))
      expect(copy).toHaveBeenLastCalledWith(`${window.location.origin}/juri/token-${name}`)
    }
    expect(screen.getByText('Linkler yalnızca bir kez gösterilir.')).toBeInTheDocument()
    expect(screen.getAllByRole('textbox', { name: /linki$/ })).toHaveLength(3)
  })

  it('link yenilemeden önce eski linkin öleceğini söyler', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = show()
    await openTab(user, 'Jüriler')
    await user.click(await screen.findByRole('button', { name: 'Ayşe linkini yenile' }))
    expect(confirm.mock.calls[0][0]).toContain('Eski link hemen geçersiz olur')
    expect(await screen.findByDisplayValue(`${window.location.origin}/juri/yeni`)).toBeInTheDocument()
  })
})
