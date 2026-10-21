import { describe, it, expect } from 'vitest'
import { keyboardLayout, keyboardSvg, KEYBOARD_RATIO, KEYBOARD_URL, KEYBOARD_WIDTH } from './keyboard.js'

const { keys, width, height } = keyboardLayout()
const rowKeys = (row) => keys.filter((k) => k.row === row).sort((a, b) => a.x - b.x || a.y - b.y)

// Aynı satırda alt alta duran tuşlar (yukarı/aşağı ok) tek sütun sayılır.
const covered = (row) => {
  const spans = rowKeys(row).map((k) => [k.x, k.x + k.w])
  const merged = []
  for (const [a, b] of spans) {
    const last = merged[merged.length - 1]
    if (last && a < last[1]) last[1] = Math.max(last[1], b)
    else merged.push([a, b])
  }
  return merged.reduce((sum, [a, b]) => sum + (b - a), 0)
}

describe('keyboardLayout', () => {
  it('her satır tam 15u genişliği boşluksuz kaplar', () => {
    expect(width).toBe(KEYBOARD_WIDTH)
    for (let row = 0; row < 6; row += 1) expect(covered(row)).toBeCloseTo(15, 6)
  })

  it('satır başına tuş sayısı MacBook ANSI düzenindedir (ok kümesi 4 tuş)', () => {
    expect([0, 1, 2, 3, 4, 5].map((row) => rowKeys(row).length)).toEqual([14, 14, 14, 13, 12, 11])
  })

  it('satırlar sırayla dizilir ve fonksiyon satırı 0.75u yüksekliktedir', () => {
    expect(rowKeys(0)[0]).toMatchObject({ y: 0, h: 0.75 })
    expect(rowKeys(1)[0].y).toBe(0.75)
    expect(height).toBeCloseTo(0.75 + 5, 6)
  })

  it('hiçbir iki tuş çakışmaz', () => {
    const overlap = (a, b) =>
      a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        expect(overlap(keys[i], keys[j]), `${i} ile ${j}`).toBe(false)
      }
    }
  })

  it('alt satırda boşluk çubuğu 5.5u, ok kümesi sağ kenarda 3u ve ters T biçimindedir', () => {
    const bottom = rowKeys(5)
    expect(Math.max(...bottom.map((k) => k.w))).toBe(5.5)
    const arrows = bottom.filter((k) => k.x >= 12)
    expect(arrows).toHaveLength(4)
    expect(arrows.every((k) => k.h === 0.5 && k.w === 1)).toBe(true)
    const up = arrows.find((k) => k.x === 13 && k.y === bottom[0].y)
    const down = arrows.find((k) => k.x === 13 && k.y === bottom[0].y + 0.5)
    expect(up).toBeDefined()
    expect(down).toBeDefined()
    expect(Math.max(...arrows.map((k) => k.x + k.w))).toBe(15)
  })
})

describe('keyboardSvg', () => {
  it('her tuş için bir rect üretir ve oran viewBox ile aynıdır', () => {
    const svg = keyboardSvg(keyboardLayout())
    expect(svg.match(/<rect /g)).toHaveLength(keys.length)
    expect(svg).toContain(`viewBox="0 0 ${width} ${height}"`)
    expect(KEYBOARD_RATIO).toBe(`${width} / ${height}`)
  })

  it('KEYBOARD_URL çözülünce düzenin SVG çıktısını verir', () => {
    const prefix = 'url("data:image/svg+xml,'
    expect(KEYBOARD_URL.startsWith(prefix)).toBe(true)
    expect(KEYBOARD_URL.endsWith('")')).toBe(true)
    expect(decodeURIComponent(KEYBOARD_URL.slice(prefix.length, -2))).toBe(keyboardSvg(keyboardLayout()))
  })
})
