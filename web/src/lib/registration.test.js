import { describe, it, expect, vi } from 'vitest'
import { initialValues, normalize, validateStep, submitRegistration, STEPS } from './registration.js'

const valid = {
  ...initialValues,
  fullName: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '0555 123 45 67',
  department: 'Bilgisayar Mühendisliği',
  year: '2',
  teamName: 'Kod Kurtları',
  teamRole: 'founder',
  interests: ['web'],
  level: 'beginner',
  consent: true,
}

describe('STEPS', () => {
  it('4 adım sırasıyla tanımlıdır', () => {
    expect(STEPS.map((s) => s.id)).toEqual(['person', 'team', 'interest', 'confirm'])
  })
})

describe('normalize', () => {
  it('kirli girdiyi temizler', () => {
    const out = normalize({
      ...valid,
      fullName: '  İlker   Şahin ',
      email: '  ILKER@Example.COM ',
      phone: '0 (555) 123-45-67',
      teamName: '  Kod   Kurtları ',
      teammates: '  Ali, Veli ',
    })
    expect(out.fullName).toBe('İlker Şahin')
    expect(out.email).toBe('ilker@example.com')
    expect(out.phone).toBe('05551234567')
    expect(out.teamName).toBe('Kod Kurtları')
    expect(out.teammates).toBe('Ali, Veli')
  })

  it('girdi nesnesini değiştirmez', () => {
    const input = { ...valid, email: ' A@B.CO ' }
    normalize(input)
    expect(input.email).toBe(' A@B.CO ')
  })
})

describe('validateStep: person', () => {
  it('boş değerlerde tüm zorunlu alanlar hata verir', () => {
    const errors = validateStep('person', initialValues)
    expect(Object.keys(errors).sort()).toEqual(['department', 'email', 'fullName', 'phone', 'year'])
  })

  it('geçerli girdide hata yoktur', () => {
    expect(validateStep('person', valid)).toEqual({})
  })

  it('tek kelimelik ad hata verir', () => {
    expect(validateStep('person', { ...valid, fullName: 'Ayşe' }).fullName).toBe('Ad ve soyadını yaz.')
  })

  it('Türkçe karakterli isim geçerlidir', () => {
    expect(validateStep('person', { ...valid, fullName: 'İlker Şahin' })).toEqual({})
  })

  it('boşluklu ve büyük harfli e-posta geçerlidir, eksik olan değildir', () => {
    expect(validateStep('person', { ...valid, email: '  AYSE@Example.COM ' })).toEqual({})
    expect(validateStep('person', { ...valid, email: 'ayse@' }).email).toBe('Geçerli bir e-posta adresi yaz.')
  })

  it('telefon biçimlerini kabul eder, kısa numarayı reddeder', () => {
    expect(validateStep('person', { ...valid, phone: '0 (555) 123-45-67' })).toEqual({})
    expect(validateStep('person', { ...valid, phone: '+90 555 123 45 67' })).toEqual({})
    expect(validateStep('person', { ...valid, phone: '123' }).phone).toBe('Geçerli bir telefon numarası yaz.')
  })
})

describe('validateStep: team, interest, confirm', () => {
  it('takım adı ve rol zorunludur', () => {
    const errors = validateStep('team', initialValues)
    expect(errors.teamName).toBe('Takım adını yaz.')
    expect(errors.teamRole).toBe('Rolünü seç.')
    expect(validateStep('team', valid)).toEqual({})
  })

  it('bilinmeyen rol reddedilir', () => {
    expect(validateStep('team', { ...valid, teamRole: 'hacker' }).teamRole).toBe('Rolünü seç.')
  })

  it('en az bir ilgi alanı ve seviye zorunludur', () => {
    const errors = validateStep('interest', initialValues)
    expect(errors.interests).toBe('En az bir ilgi alanı seç.')
    expect(errors.level).toBe('Deneyim seviyeni seç.')
    expect(validateStep('interest', valid)).toEqual({})
  })

  it('onay kutusu işaretlenmeden geçilmez', () => {
    expect(validateStep('confirm', { ...valid, consent: false }).consent).toBe(
      'Devam etmek için onay vermelisin.',
    )
    expect(validateStep('confirm', valid)).toEqual({})
  })
})

describe('submitRegistration', () => {
  it('endpoint yoksa istek atmaz ve başarılı döner', async () => {
    const fetchImpl = vi.fn()
    const result = await submitRegistration(valid, { fetchImpl })
    expect(result).toEqual({ ok: true, skipped: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('endpoint varsa normalize edilmiş JSON POST eder', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const result = await submitRegistration(
      { ...valid, email: ' AYSE@Example.com ' },
      { endpoint: 'https://example.test/kayit', fetchImpl },
    )
    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.test/kayit')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body).email).toBe('ayse@example.com')
  })

  it('sunucu hatasında ok:false ve durum kodunu döner', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('500')
  })

  it('ağ hatasında fırlatmaz, ok:false döner', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/bağlantı/i)
  })
})
