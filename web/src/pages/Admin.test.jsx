import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, it, expect, vi } from 'vitest'
import App from '../App.jsx'
import base from '../data/event.json'
import { DRAFT_KEY, writeDraft } from '../lib/content.js'

const renderAt = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
const stored = () => JSON.parse(window.localStorage.getItem(DRAFT_KEY))?.value
// Testin ihtiyaç duyduğu veriyi base üzerine kurar; yer tutucu içeriğe bağımlı kalınmaz.
const seed = (patch) => writeDraft(base, { ...base, ...patch })
const sponsor = (name) => ({ name, tier: 'support', logo: null, url: null })
const person = (name) => ({ name, title: 'Unvan', photo: null })

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

const unlock = async (user) => {
  await user.type(screen.getByLabelText('Şifre'), '123')
  await user.click(screen.getByRole('button', { name: 'Giriş' }))
}
const openEditor = async (path = '/admin') => {
  const user = userEvent.setup()
  renderAt(path)
  await unlock(user)
  return user
}
const openTab = (user, name) => user.click(within(screen.getByRole('group', { name: 'Bölümler' })).getByRole('button', { name }))
const detailsOf = (name) => screen.getByText(name, { selector: 'summary' }).closest('details')
// Kapalıysa özetine tıklayıp açar ve kartı döndürür.
const openCard = async (user, name) => {
  const details = detailsOf(name)
  if (!details.open) await user.click(screen.getByText(name, { selector: 'summary' }))
  return within(details)
}
const upload = async (user, content) => {
  await user.click(screen.getByText('Dosya işlemleri'))
  await user.upload(screen.getByLabelText('JSON yükle'), new File([content], 'event.json', { type: 'application/json' }))
}
const save = (user) => user.click(screen.getByRole('button', { name: 'Kaydet' }))

describe('Admin şifre kapısı', () => {
  it('editörü göstermez, yalnızca şifre alanı ve Giriş vardır', () => {
    renderAt('/admin')
    expect(screen.getByRole('heading', { level: 1, name: 'İçerik paneli' })).toBeInTheDocument()
    expect(screen.getByLabelText('Şifre')).toHaveAttribute('type', 'password')
    expect(screen.queryByRole('group', { name: 'Bölümler' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kaydet' })).not.toBeInTheDocument()
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
    expect(document.title).toBe('İçerik paneli')
  })

  it('yanlış şifre editörü açmaz, hata gösterir ve alanı temizler', async () => {
    const user = userEvent.setup()
    renderAt('/admin')
    await user.type(screen.getByLabelText('Şifre'), 'yanlis')
    await user.click(screen.getByRole('button', { name: 'Giriş' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Şifre yanlış.')
    expect(screen.getByLabelText('Şifre')).toHaveValue('')
    expect(screen.queryByRole('group', { name: 'Bölümler' })).not.toBeInTheDocument()
  })

  it('doğru şifre editörü açar ve sekme boyunca hatırlanır', async () => {
    await openEditor()
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Şifre')).not.toBeInTheDocument()
    expect(window.sessionStorage.getItem('hackathon-admin-unlocked')).toBe('1')
    cleanup()
    renderAt('/admin')
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeInTheDocument()
  })

  it('oturum depolaması hata verse de kapı çalışır', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    await openEditor()
    expect(screen.getByRole('button', { name: 'Kaydet' })).toBeInTheDocument()
  })
})

describe('Admin paneli', () => {
  it('/admin Navbar, Footer ve sabit CTA olmadan render olur', async () => {
    await openEditor()
    expect(screen.getByRole('heading', { level: 1, name: 'İçerik paneli' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })

  it('bölüm düğmeleri tek panel gösterir, varsayılan Genel', async () => {
    const user = await openEditor()
    const group = within(screen.getByRole('group', { name: 'Bölümler' }))
    expect(group.getByRole('button', { name: 'Genel' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('textbox', { name: 'Organizatör' })).toHaveValue(base.organizer)
    expect(screen.queryByText('Sponsor ekle')).not.toBeInTheDocument()
    await openTab(user, 'Sponsorlar')
    expect(group.getByRole('button', { name: 'Sponsorlar' })).toHaveAttribute('aria-pressed', 'true')
    expect(group.getByRole('button', { name: 'Genel' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('textbox', { name: 'Organizatör' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sponsor ekle' })).toBeInTheDocument()
  })

  it('dizi öğeleri kapalı kartlardır ve özette öğenin adı görünür', async () => {
    seed({
      sponsors: [sponsor('Alfa')],
      days: [{ label: 'Cuma', date: '1 Ocak', items: [{ time: '09:00', title: 'Açılış', description: '', type: 'opening' }] }],
    })
    const user = await openEditor()
    await openTab(user, 'Sponsorlar')
    expect(detailsOf('Alfa')).not.toHaveAttribute('open')
    await openTab(user, 'Program')
    await user.click(screen.getByText('Cuma', { selector: 'summary' }))
    expect(screen.getByText('09:00 Açılış', { selector: 'summary' })).toBeInTheDocument()
  })

  it('kayıtlı taslak varsa uyarı gösterir, yoksa göstermez', async () => {
    await openEditor()
    expect(screen.queryByText(/taslak bu tarayıcıda siteye uygulanıyor/)).not.toBeInTheDocument()
    cleanup()
    seed({ organizer: 'Taslak Org' })
    renderAt('/admin')
    expect(screen.getByText(/taslak bu tarayıcıda siteye uygulanıyor/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Organizatör' })).toHaveValue('Taslak Org')
  })

  it('base değiştiyse eski taslak uygulanmaz', async () => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: { ...base, organizer: 'Eski base' }, value: { ...base, organizer: 'Eski' } }))
    await openEditor()
    expect(screen.getByRole('textbox', { name: 'Organizatör' })).toHaveValue(base.organizer)
    expect(screen.queryByText(/taslak bu tarayıcıda siteye uygulanıyor/)).not.toBeInTheDocument()
  })

  it('Kayıt sekmesinde durumu kapalıya çevirip kaydetmek taslağa yazar', async () => {
    const user = await openEditor()
    await openTab(user, 'Kayıt')
    expect(screen.getByRole('combobox', { name: 'Durum' })).toHaveValue(base.register.status)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durum' }), 'closed')
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(stored().register.status).toBe('closed')
  })

  it('Kayıt sekmesinde forma yeni alan eklenip kaydedilir, adı boş alan kaydı engeller', async () => {
    const user = await openEditor()
    await openTab(user, 'Kayıt')
    const firstStep = base.register.steps[0]
    const step = await openCard(user, firstStep.title)
    await user.click(step.getAllByRole('button', { name: 'Alan ekle' }).at(-1))
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Kaydedilmedi')
    expect(stored()).toBeUndefined()

    const added = within(screen.getByText('Alan ' + (firstStep.fields.length + 1), { selector: 'summary' }).closest('details'))
    await user.type(added.getByRole('textbox', { name: /Alan adı/ }), 'city')
    await user.type(added.getByRole('textbox', { name: 'Etiket' }), 'Şehir')
    await user.click(screen.getByRole('button', { name: 'Kaydet' }))
    expect(stored().register.steps[0].fields.at(-1)).toMatchObject({ id: 'city', label: 'Şehir', kind: 'text', required: 'yes' })
  })

  it('sponsor adını düzenleyip kaydetmek taslağı yazar', async () => {
    seed({ sponsors: [sponsor('Alfa')] })
    const user = await openEditor()
    await openTab(user, 'Sponsorlar')
    const card = await openCard(user, 'Alfa')
    const input = card.getByRole('textbox', { name: 'Ad' })
    await user.clear(input)
    await user.type(input, 'Yeni Sponsor')
    await save(user)
    expect(stored().sponsors[0].name).toBe('Yeni Sponsor')
    expect(screen.getByRole('status')).toHaveTextContent('bu tarayıcıda')
    expect(screen.getByText(/taslak bu tarayıcıda siteye uygulanıyor/)).toBeInTheDocument()
  })

  it('sponsor ekler ve kaldırır, boş logo null kaydedilir', async () => {
    const user = await openEditor()
    await openTab(user, 'Sponsorlar')
    const added = `Sponsor ${base.sponsors.length + 1}`
    await user.click(screen.getByRole('button', { name: 'Sponsor ekle' }))
    const card = await openCard(user, added)
    await user.type(card.getByRole('textbox', { name: 'Logo URL' }), '/logo.png')
    await user.clear(card.getByRole('textbox', { name: 'Logo URL' }))
    await save(user)
    expect(stored().sponsors).toHaveLength(base.sponsors.length + 1)
    expect(stored().sponsors.at(-1).logo).toBeNull()

    await user.click(screen.getByRole('button', { name: `${added} kaldır` }))
    await save(user)
    expect(stored().sponsors).toHaveLength(base.sponsors.length)
  })

  it('kaldırılan kartın açık durumu başka öğeye geçmez', async () => {
    seed({ sponsors: [sponsor('Alfa'), sponsor('Beta'), sponsor('Gama')] })
    const user = await openEditor()
    await openTab(user, 'Sponsorlar')
    await user.click(screen.getByText('Gama', { selector: 'summary' }))
    await user.click(screen.getByRole('button', { name: 'Sponsor 1 kaldır' }))
    expect(screen.queryByText('Alfa', { selector: 'summary' })).not.toBeInTheDocument()
    expect(detailsOf('Gama')).toHaveAttribute('open')
    expect(detailsOf('Beta')).not.toHaveAttribute('open')
  })

  it('taşınan kartın açık durumu kartla birlikte gider', async () => {
    seed({ sponsors: [sponsor('Alfa'), sponsor('Beta')] })
    const user = await openEditor()
    await openTab(user, 'Sponsorlar')
    await user.click(screen.getByText('Alfa', { selector: 'summary' }))
    await user.click(screen.getByRole('button', { name: 'Sponsor 1 aşağı taşı' }))
    expect(detailsOf('Alfa')).toHaveAttribute('open')
    expect(detailsOf('Beta')).not.toHaveAttribute('open')
    const order = screen.getAllByText(/^(Alfa|Beta)$/, { selector: 'summary' }).map((el) => el.textContent)
    expect(order).toEqual(['Beta', 'Alfa'])
  })

  it('kayan yazı tek satırlık girdilerdir ve taşınabilir', async () => {
    seed({ marquee: ['Bir', 'İki'] })
    const user = await openEditor()
    await openTab(user, 'Kayan yazı')
    expect(screen.getByRole('textbox', { name: 'Kelime 1' })).toHaveValue('Bir')
    await user.click(screen.getByRole('button', { name: 'Kelime 1 aşağı taşı' }))
    await save(user)
    expect(stored().marquee).toEqual(['İki', 'Bir'])
  })

  it('Ekip sekmesinde iç içe jüri alanı düzenlenir', async () => {
    seed({ people: { ...base.people, jury: [person('Jüri A'), person('Jüri B')] } })
    const user = await openEditor()
    await openTab(user, 'Ekip')
    const card = await openCard(user, 'Jüri B')
    const input = card.getByRole('textbox', { name: 'Ad' })
    await user.clear(input)
    await user.type(input, 'Jüri C')
    await save(user)
    expect(stored().people.jury.map((p) => p.name)).toEqual(['Jüri A', 'Jüri C'])
    expect(stored().people.mentors).toEqual(base.people.mentors)
  })

  it('gün ekler, güne program öğesi ekler ve kaydeder', async () => {
    const user = await openEditor()
    await openTab(user, 'Program')
    await user.click(screen.getByRole('button', { name: 'Gün ekle' }))
    const day = await openCard(user, `Gün ${base.days.length + 1}`)
    await user.type(day.getByRole('textbox', { name: 'Etiket' }), 'Cumartesi')
    await user.click(day.getByRole('button', { name: 'Program öğesi ekle' }))
    const item = await openCard(user, 'Program öğesi 1')
    await user.type(item.getByRole('textbox', { name: 'Saat' }), '10:30')
    await user.type(item.getByRole('textbox', { name: 'Başlık' }), 'Workshop')
    await save(user)
    const added = stored().days.at(-1)
    expect(stored().days).toHaveLength(base.days.length + 1)
    expect(added.label).toBe('Cumartesi')
    expect(added.items).toEqual([expect.objectContaining({ time: '10:30', title: 'Workshop' })])
  })

  it('geçersiz başlangıç tarihi kaydedilmez', async () => {
    const user = await openEditor()
    const input = screen.getByRole('textbox', { name: /Başlangıç/ })
    await user.clear(input)
    await save(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Kaydedilmedi')
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
  })

  it('güvensiz bağlantı kaydedilmez', async () => {
    seed({ socials: [{ label: 'Site', url: 'https://example.com/' }] })
    const user = await openEditor()
    await openTab(user, 'Sosyal')
    const card = await openCard(user, 'Site')
    const input = card.getByRole('textbox', { name: 'Bağlantı URL' })
    await user.clear(input)
    await user.type(input, 'javascript:alert(1)')
    await save(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Kaydedilmedi')
    expect(stored().socials[0].url).toBe('https://example.com/')
  })

  it('depolama yazamazsa kayıt hatası gösterir', async () => {
    const user = await openEditor()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    await save(user)
    expect(screen.getByRole('alert')).toHaveTextContent('Kaydedilemedi')
    expect(screen.queryByText(/taslak bu tarayıcıda siteye uygulanıyor/)).not.toBeInTheDocument()
  })

  it('durum satırı kalıcıdır, hata ayrı bir uyarı olarak gelir', async () => {
    const user = await openEditor()
    const status = screen.getByRole('status')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await save(user)
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toHaveTextContent('Taslak kaydedildi')
    await user.clear(screen.getByRole('textbox', { name: /Başlangıç/ }))
    await save(user)
    expect(screen.getByRole('status')).toBe(status)
    expect(status).toBeEmptyDOMElement()
    expect(screen.getByRole('alert')).toHaveTextContent('Kaydedilmedi')
  })

  it('geçerli JSON yüklemesi formu doldurur, kaydedilene dek depolamaya yazmaz', async () => {
    const user = await openEditor()
    await upload(user, JSON.stringify({ ...base, organizer: 'Yüklenen Org' }))
    expect(await screen.findByText(/Dosya yüklendi/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Organizatör' })).toHaveValue('Yüklenen Org')
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    await save(user)
    expect(stored().organizer).toBe('Yüklenen Org')
  })

  it('geçersiz JSON yüklemesi hata gösterir ve taslağı korur', async () => {
    const user = await openEditor()
    await upload(user, '{"name": 5}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Dosya geçersiz')
    expect(screen.getByRole('textbox', { name: 'Organizatör' })).toHaveValue(base.organizer)
  })

  it('null içeren zorunlu metin alanı yüklemede reddedilir', async () => {
    const user = await openEditor()
    await upload(user, JSON.stringify({ ...base, name: null }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Dosya geçersiz')
    expect(screen.getByRole('textbox', { name: 'Ad' })).toHaveValue(base.name)
  })

  it('taslağı sıfırlamak kaydı siler, formu base\'e döndürür ve uyarıyı kaldırır', async () => {
    const user = await openEditor()
    const input = screen.getByRole('textbox', { name: 'Organizatör' })
    await user.clear(input)
    await user.type(input, 'Değişti')
    await save(user)
    expect(stored().organizer).toBe('Değişti')
    expect(screen.getByText(/taslak bu tarayıcıda siteye uygulanıyor/)).toBeInTheDocument()
    await user.click(screen.getByText('Dosya işlemleri'))
    await user.click(screen.getByRole('button', { name: 'Taslağı sıfırla' }))
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Organizatör' })).toHaveValue(base.organizer)
    expect(screen.queryByText(/taslak bu tarayıcıda siteye uygulanıyor/)).not.toBeInTheDocument()
  })
})

describe('herkese açık sayfalar', () => {
  it.each(['/', '/program', '/ekip', '/kayit'])('%s sayfası /admin\'e bağlantı vermez', (path) => {
    const { container } = renderAt(path)
    expect(container.querySelector('a[href*="admin"]')).toBeNull()
  })
})
