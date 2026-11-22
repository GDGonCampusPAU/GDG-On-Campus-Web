import { describe, expect, it } from 'vitest'
import { needsEventData } from './startup.js'

describe('needsEventData', () => {
  it.each(['/juri/abc', '/Juri/abc', '/admin/juri', '/admin/juri/'])('%s etkinlik verisini beklemez', (path) => {
    expect(needsEventData(path)).toBe(false)
  })
  it.each(['/', '/kayit', '/admin', '/admin/juriler', '/juri'])('%s etkinlik verisini bekler', (path) => {
    expect(needsEventData(path)).toBe(true)
  })
})
