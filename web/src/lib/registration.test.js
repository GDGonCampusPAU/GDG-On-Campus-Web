import { describe, it, expect, vi, afterEach } from 'vitest'
import { fieldsOf, initialValues, normalize, validateStep, submitRegistration } from './registration.js'
import { fixtureSteps } from '../test/fixtures.js'

const [person, team, interest] = fixtureSteps
const blank = initialValues(fixtureSteps)
const valid = {
  ...blank,
  fullName: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  phone: '05551234567',
  department: 'Bilgisayar Mühendisliği',
  year: '2',
  teamName: 'Kod Kurtları',
  teamRole: 'founder',
  interests: ['web'],
  level: 'beginner',
}

describe('initialValues', () => {
  it('her alan için boş değer üretir, çoklu seçim dizi olur', () => {
    expect(Object.keys(blank)).toEqual(fieldsOf(fixtureSteps).map((f) => f.id))
    expect(blank.interests).toEqual([])
    expect(blank.fullName).toBe('')
  })
})

describe('normalize', () => {
  it('kirli girdiyi türüne göre temizler', () => {
    const out = normalize(fixtureSteps, {
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

  it('yalnızca tanımlı alanları döndürür', () => {
    expect(Object.keys(normalize(fixtureSteps, { ...valid, stray: 'x' }))).not.toContain('stray')
  })

  it('girdi nesnesini değiştirmez', () => {
    const input = { ...valid, email: ' A@B.CO ' }
    normalize(fixtureSteps, input)
    expect(input.email).toBe(' A@B.CO ')
  })
})

describe('validateStep', () => {
  it('boş değerlerde yalnızca zorunlu alanlar hata verir', () => {
    expect(Object.keys(validateStep(person, blank)).sort()).toEqual(['department', 'email', 'fullName', 'phone', 'year'])
    expect(Object.keys(validateStep(team, blank))).toEqual(['teamRole'])
    expect(Object.keys(validateStep(interest, blank)).sort()).toEqual(['interests', 'level'])
  })

  it('geçerli girdide hata yoktur', () => {
    fixtureSteps.forEach((step) => expect(validateStep(step, valid)).toEqual({}))
  })

  it('boş adım listesi (özet adımı) hata vermez', () => {
    expect(validateStep({ title: 'Onay', fields: [] }, valid)).toEqual({})
  })

  it('boşluklu ve büyük harfli e-posta geçerlidir, eksik olan değildir', () => {
    expect(validateStep(person, { ...valid, email: '  AYSE@Example.COM ' })).toEqual({})
    expect(validateStep(person, { ...valid, email: 'ayse@' }).email).toBe('Geçerli bir e-posta adresi yaz.')
  })

  it.each([
    ['0 (555) 123-45-67', true],
    ['+90 555 123 45 67', true],
    ['1234567890', true],
    ['12345678901234', true],
    ['123', false],
    ['123456789', false],
    ['123456789012345', false],
    ['555abc1234567', false],
    ['12345+67890', false],
  ])('telefon %s geçerlilik: %s', (phone, ok) => {
    expect('phone' in validateStep(person, { ...valid, phone })).toBe(ok === false)
  })

  it('listede olmayan seçim reddedilir', () => {
    expect(validateStep(person, { ...valid, year: '9' }).year).toBe('Listedeki seçeneklerden seç.')
    expect(validateStep(team, { ...valid, teamRole: 'hacker' }).teamRole).toBe('Listedeki seçeneklerden seç.')
    expect(validateStep(interest, { ...valid, interests: ['web', 'hacking'] }).interests).toBeDefined()
    expect(validateStep(interest, { ...valid, level: 'god' }).level).toBeDefined()
  })

  it('zorunlu olmayan alan boş geçilir, doldurulursa türü yine denetlenir', () => {
    const step = { title: 'T', fields: [{ id: 'mail', label: 'M', kind: 'email', required: 'no', hint: '', options: [] }] }
    expect(validateStep(step, { mail: '' })).toEqual({})
    expect(validateStep(step, { mail: 'x' }).mail).toBe('Geçerli bir e-posta adresi yaz.')
  })

  it('zorunlu olmayan çoklu seçim boş olabilir', () => {
    const step = {
      title: 'T',
      fields: [{ id: 'c', label: 'C', kind: 'checkbox', required: 'no', hint: '', options: [{ value: 'a', label: 'A' }] }],
    }
    expect(validateStep(step, { c: [] })).toEqual({})
  })
})

describe('submitRegistration', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('geliştirmede endpoint yoksa istek atmaz ve başarılı döner', async () => {
    const fetchImpl = vi.fn()
    const result = await submitRegistration(valid, { dev: true, fetchImpl })
    expect(result).toEqual({ ok: true, skipped: true })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('yayında endpoint yoksa başarı göstermez, hata döner', async () => {
    const fetchImpl = vi.fn()
    const result = await submitRegistration(valid, { dev: false, fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/alınamıyor/)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('endpoint varsa değerleri JSON POST eder', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const result = await submitRegistration(valid, { endpoint: 'https://example.test/kayit', fetchImpl })
    expect(result).toEqual({ ok: true })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://example.test/kayit')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.headers.Accept).toBe('application/json')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init.body).email).toBe('ayse@example.com')
  })

  it('sunucu hatasında ok:false ve durum kodunu döner', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toContain('500')
  })

  it.each([400, 429])('%i durum kodunu hata mesajına yazar', async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status })
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result).toEqual({
      ok: false,
      error: `Sunucu hatası (${status}). Biraz sonra tekrar dene.`,
    })
  })

  it('zaman aşımında fırlatmaz, ok:false döner', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('x', 'TimeoutError'))
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/bağlantı/i)
  })

  it('fetchImpl verilmezse global fetch kullanılır', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    vi.stubGlobal('fetch', fetchMock)
    const result = await submitRegistration(valid, { endpoint: 'https://example.test/kayit' })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('https://example.test/kayit')
  })

  it('ağ hatasında fırlatmaz, ok:false döner', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const result = await submitRegistration(valid, { endpoint: 'https://example.test', fetchImpl })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/bağlantı/i)
  })
})
