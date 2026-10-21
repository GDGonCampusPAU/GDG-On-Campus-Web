import { describe, it, expect } from 'vitest'
import { DRAFT_KEY, applyDraft, clearDraft, isEventShape, readDraft, writeDraft } from './content.js'

const base = {
  name: 'Etkinlik',
  startsAt: '2026-12-12T09:00:00+03:00',
  marquee: ['Kodla'],
  people: { jury: [{ name: 'A', title: 'T', photo: null }] },
  sponsors: [{ name: 'S', tier: 'main', logo: null, url: null }],
  about: [{ title: 'K', text: 'M', color: 'blue' }],
  days: [{ label: 'G', date: '12 Aralık', items: [{ time: '09:00', title: 'Açılış', description: '', type: 'opening' }] }],
  socials: [{ label: 'Instagram', url: 'https://example.com/' }],
}
const withItem = (key, patch) => ({ ...base, [key]: [{ ...base[key][0], ...patch }] })
const stored = (value, snapshot = base) => JSON.stringify({ base: snapshot, value })

const memory = (initial) => {
  const data = new Map(initial ? [[DRAFT_KEY, initial]] : [])
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  }
}
const broken = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('blocked')
  },
  removeItem() {
    throw new Error('blocked')
  },
}

describe('isEventShape', () => {
  it('base ile aynı şekli kabul eder', () => {
    expect(isEventShape(base, { ...base, name: 'Yeni' })).toBe(true)
    expect(isEventShape(base, { ...base, sponsors: [] })).toBe(true)
  })

  it('farklı anahtar kümesini reddeder', () => {
    const { name: _name, ...eksik } = base
    expect(isEventShape(base, eksik)).toBe(false)
    expect(isEventShape(base, { ...base, fazla: 1 })).toBe(false)
  })

  it('yanlış türleri reddeder', () => {
    expect(isEventShape(base, { ...base, name: 5 })).toBe(false)
    expect(isEventShape(base, { ...base, marquee: 'Kodla' })).toBe(false)
    expect(isEventShape(base, { ...base, marquee: [1] })).toBe(false)
    expect(isEventShape(base, { ...base, people: [] })).toBe(false)
    expect(isEventShape(base, { ...base, people: {} })).toBe(false)
    expect(isEventShape(base, { ...base, sponsors: ['x'] })).toBe(false)
    expect(isEventShape(base, [])).toBe(false)
    expect(isEventShape(base, null)).toBe(false)
  })

  it('null değeri yalnızca photo, logo ve url için kabul eder', () => {
    expect(isEventShape(base, { ...base, name: null })).toBe(false)
    expect(isEventShape(base, withItem('about', { title: null }))).toBe(false)
    expect(isEventShape(base, withItem('socials', { url: null }))).toBe(false)
    expect(isEventShape(base, withItem('sponsors', { logo: null, url: null }))).toBe(true)
    expect(isEventShape(base, { ...base, people: { jury: [{ name: 'A', title: 'T', photo: null }] } })).toBe(true)
  })

  it('bilinmeyen renk, seviye ve tür değerlerini reddeder', () => {
    expect(isEventShape(base, withItem('about', { color: 'purple' }))).toBe(false)
    expect(isEventShape(base, withItem('about', { color: 'red' }))).toBe(true)
    expect(isEventShape(base, withItem('sponsors', { tier: 'gold' }))).toBe(false)
    const day = base.days[0]
    const badType = [{ ...day, items: [{ ...day.items[0], type: 'party' }] }]
    expect(isEventShape(base, { ...base, days: badType })).toBe(false)
  })

  it('javascript: ve data: bağlantılarını reddeder, https ve site içi yolu kabul eder', () => {
    expect(isEventShape(base, withItem('socials', { url: 'javascript:alert(1)' }))).toBe(false)
    expect(isEventShape(base, withItem('sponsors', { logo: 'data:text/html,x' }))).toBe(false)
    expect(isEventShape(base, withItem('sponsors', { url: 'JavaScript:alert(1)' }))).toBe(false)
    expect(isEventShape(base, withItem('sponsors', { logo: 'https://cdn.example.com/a.png', url: 'http://s.example.com' }))).toBe(true)
    expect(isEventShape(base, withItem('sponsors', { logo: '/logo.png' }))).toBe(true)
    expect(isEventShape(base, { ...base, people: { jury: [{ name: 'A', title: 'T', photo: 'javascript:1' }] } })).toBe(false)
  })

  it('boş metni kabul eder', () => {
    expect(isEventShape(base, withItem('about', { title: '', text: '' }))).toBe(true)
    expect(isEventShape(base, withItem('sponsors', { logo: '', url: '' }))).toBe(true)
    expect(isEventShape(base, withItem('socials', { label: '', url: '' }))).toBe(true)
    expect(isEventShape(base, { ...base, marquee: [''] })).toBe(true)
  })

  it('geçersiz startsAt değerini reddeder', () => {
    expect(isEventShape(base, { ...base, startsAt: 'yarın' })).toBe(false)
    expect(isEventShape(base, { ...base, startsAt: '' })).toBe(false)
  })
})

describe('taslak okuma ve yazma', () => {
  it('geçerli taslağı uygular', () => {
    const draft = { ...base, name: 'Taslak' }
    expect(applyDraft(base, memory(stored(draft)))).toEqual(draft)
  })

  it('taslak yoksa base döner', () => {
    expect(applyDraft(base, memory())).toBe(base)
  })

  it('bozuk veya şekli uymayan taslağı yok sayar', () => {
    expect(applyDraft(base, memory('{bozuk'))).toBe(base)
    expect(applyDraft(base, memory('"metin"'))).toBe(base)
    expect(applyDraft(base, memory(stored({ ...base, startsAt: 'x' })))).toBe(base)
    expect(applyDraft(base, memory(stored({ ...base, name: null })))).toBe(base)
  })

  it('eski biçimdeki (base içermeyen) taslağı yok sayar', () => {
    expect(applyDraft(base, memory(JSON.stringify({ ...base, name: 'Eski' })))).toBe(base)
  })

  it('base değiştiyse taslağı yok sayar', () => {
    const published = { ...base, name: 'Yayınlanan' }
    const draft = { ...base, name: 'Taslak' }
    expect(applyDraft(published, memory(stored(draft)))).toBe(published)
    expect(applyDraft(base, memory(stored(draft)))).toEqual(draft)
  })

  it('depolama atıyorsa yok sayar ve çökmez', () => {
    expect(readDraft(base, broken)).toBeNull()
    expect(applyDraft(base, broken)).toBe(base)
    expect(writeDraft(base, base, broken)).toBe(false)
    expect(() => clearDraft(broken)).not.toThrow()
  })

  it('yazılan taslak geri okunur, silinince kaybolur', () => {
    const store = memory()
    expect(writeDraft(base, { ...base, name: 'Y' }, store)).toBe(true)
    expect(readDraft(base, store).name).toBe('Y')
    clearDraft(store)
    expect(readDraft(base, store)).toBeNull()
  })
})

describe('isEventShape: kayıt formu', () => {
  const field = (id, options = []) => ({ id, label: 'L', kind: options.length ? 'select' : 'text', required: 'yes', hint: '', options })
  const withFields = (...fields) => ({ ...base, register: { steps: [{ title: 'Adım', fields }] } })
  const form = withFields(field('a', [{ value: 'x', label: 'X' }]), field('b'))

  it('geçerli formu kabul eder', () => {
    expect(isEventShape(form, form)).toBe(true)
  })

  it.each([
    ['yinelenen alan adı', withFields(field('a', [{ value: 'x', label: 'X' }]), field('a'))],
    ['boş alan adı', withFields(field('a', [{ value: 'x', label: 'X' }]), field(''))],
    ['boş seçenek değeri', withFields(field('a', [{ value: '', label: 'X' }]))],
    ['yinelenen seçenek değeri', withFields(field('a', [{ value: 'x', label: 'X' }, { value: 'x', label: 'Y' }]))],
    ['seçeneksiz açılır liste', withFields({ ...field('a'), kind: 'select' })],
    ['alansız form', { ...base, register: { steps: [] } }],
  ])('%s reddedilir', (_, value) => {
    expect(isEventShape(form, value)).toBe(false)
  })

  it('bilinmeyen alan türü reddedilir', () => {
    const bad = withFields({ ...field('a', [{ value: 'x', label: 'X' }]), kind: 'date' })
    expect(isEventShape(form, bad)).toBe(false)
  })
})

