import { describe, it, expect } from 'vitest'
import { typeLabels } from './event.js'
import event from './base.js'
import { isEventShape } from '../lib/content.js'

const colors = ['blue', 'green', 'yellow', 'red']

// event.json'un kendisi denetlenir; tarayıcıdaki taslak testin sonucunu değiştirmemeli.
describe('event.json', () => {
  it('yayınlanan veri editörün kabul ettiği şekle uyar', () => {
    expect(isEventShape(event, event)).toBe(true)
  })

  it('startsAt geçerli bir tarihtir', () => {
    expect(Number.isNaN(new Date(event.startsAt).getTime())).toBe(false)
  })

  it('en az bir ödül vardır ve her biri bilinen bir renk taşır', () => {
    expect(event.prizes.length).toBeGreaterThan(0)
    event.prizes.forEach((p) => expect(colors).toContain(p.color))
  })

  it('tanıtım kartları bilinen bir renk taşır', () => {
    expect(event.about.length).toBeGreaterThan(0)
    event.about.forEach((a) => expect(colors).toContain(a.color))
  })

  it('program öğelerinin türü typeLabels içinde tanımlıdır', () => {
    const items = event.days.flatMap((d) => d.items)
    expect(items.length).toBeGreaterThan(0)
    items.forEach((i) => expect(typeLabels[i.type]).toBeTruthy())
  })

  it('sponsor seviyeleri main veya support olur', () => {
    event.sponsors.forEach((s) => expect(['main', 'support']).toContain(s.tier))
  })

  it('her kişi ad ve unvan taşır', () => {
    const all = [...event.people.jury, ...event.people.mentors]
    expect(all.length).toBeGreaterThan(0)
    all.forEach((p) => {
      expect(p.name).toBeTruthy()
      expect(p.title).toBeTruthy()
    })
  })

  it('program öğeleri açıklamasız başlıklar olarak tanımlıdır', () => {
    const items = event.days.flatMap((d) => d.items)
    expect(items.map((i) => i.title)).toEqual([
      'Tema Duyurusu',
      'Mini Challenge 1',
      'Öğle Yemeği',
      'Mini Challenge 2',
      'Proje Teslimi',
      'Sunumlar & Ödüller',
    ])
    items.forEach((i) => expect(i.description).toBe(''))
  })

  it('jüride Ali Rıza Selçuk ve Sinan Bakış fotoğraf, hakkında ve site linkiyle yer alır; mentorlar boştur', () => {
    expect(event.people.mentors).toEqual([])
    expect(event.people.jury).toHaveLength(2)
    const [ali, sinan] = event.people.jury
    expect(ali).toMatchObject({
      name: 'Ali Rıza Selçuk',
      title: 'Asistone Kurucusu',
      photo: '/images/ali-riza-selcuk.jpg',
      url: 'https://www.asistone.ai/tr',
    })
    expect(ali.bio).toContain('Asistone')
    expect(sinan).toMatchObject({
      name: 'Sinan Bakış',
      title: 'Zenmira Kurucusu',
      photo: '/images/sinan-bakis.png',
      url: 'https://zenmira.com/',
    })
    expect(sinan.bio).toContain('Zenmira Bilgi Teknolojileri A.Ş.')
    expect(event.sponsors[0]).toMatchObject({
      name: 'Asistone',
      tier: 'main',
      logo: '/images/asistone-logo.jpg',
      url: 'https://www.asistone.ai/tr',
    })
  })
})
