import { describe, expect, test } from 'vitest'
import { GLASS_HEIGHT as H, GLASS_WIDTH as W, createGlass, crackPath, seeded } from './glassCrack.js'

const ends = (crack) => crack.lines.map((line) => line.points.at(-1))
const distanceToSegment = ([px, py], [x1, y1, x2, y2]) => {
  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
}
const segmentsOf = (crack) => crack.lines.flatMap(({ points }) => points.slice(1).map((p, i) => [...points[i], ...p]))

describe('glassCrack', () => {
  test('cracks start at the hit point and stay on the glass', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const crack = createGlass().hit(300, 200, 1, seeded(seed))
      expect(crack.lines.length).toBeGreaterThanOrEqual(4)
      expect(crack.lines.some((line) => line.points[0][0] === 300 && line.points[0][1] === 200)).toBe(true)
      for (const { points } of crack.lines) {
        for (const [x, y] of points) {
          expect(x).toBeGreaterThanOrEqual(-1e-6)
          expect(x).toBeLessThanOrEqual(W + 1e-6)
          expect(y).toBeGreaterThanOrEqual(-1e-6)
          expect(y).toBeLessThanOrEqual(H + 1e-6)
        }
      }
    }
  })

  test('the same seed draws the same crack', () => {
    const a = createGlass().hit(500, 300, 0.6, seeded(42))
    const b = createGlass().hit(500, 300, 0.6, seeded(42))
    expect(a.lines.map(crackPath)).toEqual(b.lines.map(crackPath))
  })

  test('a hit near an edge fans away from it, not in a circle', () => {
    let inward = 0
    let outward = 0
    for (let seed = 1; seed <= 30; seed++) {
      for (const [x] of ends(createGlass().hit(12, H / 2, 1, seeded(seed)))) {
        if (x > 40) inward++
        else outward++
      }
    }
    expect(inward).toBeGreaterThan(outward * 2)
  })

  test('a new crack stops where it meets an earlier one', () => {
    let stopped = 0
    for (let seed = 1; seed <= 10; seed++) {
      const glass = createGlass()
      const first = glass.hit(489, 333, 1, seeded(seed))
      const old = segmentsOf(first)
      const second = glass.hit(560, 300, 1, seeded(seed + 100))
      // Ends that are neither on the border nor a short chip lie on the first crack.
      if (ends(second).some((p) => old.some((s) => distanceToSegment(p, s) < 1e-6))) stopped++
    }
    expect(stopped).toBeGreaterThanOrEqual(8)
  })
})
