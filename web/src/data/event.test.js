import { describe, it, expect } from 'vitest'
import { event, typeLabels } from './event.js'

const colors = ['blue', 'green', 'yellow', 'red']

describe('event verisi', () => {
  it('startsAt geçerli bir tarihtir', () => {
    expect(Number.isNaN(new Date(event.startsAt).getTime())).toBe(false)
  })

  it('3 ödül vardır ve her biri bilinen bir renk taşır', () => {
    expect(event.prizes).toHaveLength(3)
    event.prizes.forEach((p) => expect(colors).toContain(p.color))
  })

  it('tanıtım kartları bilinen bir renk taşır', () => {
    expect(event.about).toHaveLength(3)
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
})
