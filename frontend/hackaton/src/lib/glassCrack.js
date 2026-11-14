// Cracks in a laptop screen's glass, shaped by where it is hit.
// A few main cracks leave the impact point in uneven directions, preferring directions with
// room to run (a hit near an edge fans inward), wander, branch, and stop where they meet an
// earlier crack, as cracks in glass do. No rings around the impact.
//
// public/maintenance.html carries an inline copy of this (it must work while the app is down);
// change both together.

/** Coordinate space of a laptop display (97.8cqw x 66.6cqw, see LaptopHero.css). */
export const GLASS_WIDTH = 978
export const GLASS_HEIGHT = 666

/** Small seeded generator, for cracks that look the same every time (and in tests). */
export function seeded(seed) {
  return function random() {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * @typedef {{ points: [number, number][], width: number }} CrackLine
 * @typedef {{ x: number, y: number, power: number, lines: CrackLine[] }} Crack
 */

/** A pane of glass that remembers its cracks, so new ones end where they meet old ones. */
export function createGlass(W = GLASS_WIDTH, H = GLASS_HEIGHT) {
  /** @type {[number, number, number, number][]} */
  const segments = []

  // Distance from (x, y) to the border along angle a.
  const room = (x, y, a) => {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    let t = Infinity
    if (dx > 1e-6) t = Math.min(t, (W - x) / dx)
    if (dx < -1e-6) t = Math.min(t, -x / dx)
    if (dy > 1e-6) t = Math.min(t, (H - y) / dy)
    if (dy < -1e-6) t = Math.min(t, -y / dy)
    return t
  }

  // Where segment a->b first crosses an earlier crack, as a fraction of a->b (1 = it does not).
  const firstCrossing = (ax, ay, bx, by) => {
    let best = 1
    const rx = bx - ax
    const ry = by - ay
    for (const [x1, y1, x2, y2] of segments) {
      const sx = x2 - x1
      const sy = y2 - y1
      const den = rx * sy - ry * sx
      if (Math.abs(den) < 1e-9) continue
      const t = ((x1 - ax) * sy - (y1 - ay) * sx) / den
      const u = ((x1 - ax) * ry - (y1 - ay) * rx) / den
      if (t > 1e-3 && t < best && u >= 0 && u <= 1) best = t
    }
    return best
  }

  /** One crack line: a jagged walk; its branches are walked after it. */
  const walk = (x, y, angle, length, width, depth, random, lines) => {
    /** @type {[number, number][]} */
    const points = [[x, y]]
    const branches = []
    let travelled = 0
    let heading = angle
    while (travelled < length) {
      const step = 12 + random() * 24
      heading += (random() - 0.5) * 0.75 + (angle - heading) * 0.3
      let nx = x + Math.cos(heading) * step
      let ny = y + Math.sin(heading) * step
      let stop = false
      if (nx < 0 || nx > W || ny < 0 || ny > H) {
        const edge = room(x, y, heading)
        nx = x + Math.cos(heading) * edge
        ny = y + Math.sin(heading) * edge
        stop = true
      }
      const t = firstCrossing(x, y, nx, ny)
      if (t < 1) {
        nx = x + (nx - x) * t
        ny = y + (ny - y) * t
        stop = true
      }
      segments.push([x, y, nx, ny])
      points.push([nx, ny])
      travelled += step
      x = nx
      y = ny
      if (stop) break
      if (depth < 2 && travelled > 30 && random() < 0.14) {
        const turn = (0.45 + random() * 0.6) * (random() < 0.5 ? -1 : 1)
        branches.push([x, y, heading + turn, (length - travelled) * (0.25 + random() * 0.35), width * 0.62, depth + 1])
      }
    }
    lines.push({ points, width })
    for (const [bx, by, ba, bl, bw, bd] of branches) walk(bx, by, ba, bl, bw, bd, random, lines)
  }

  return {
    /**
     * Cracks the glass at (x, y). `power` 0..1 sets how many and how long the cracks are.
     * @param {number} x @param {number} y @param {number} power @param {() => number} [random]
     * @returns {Crack}
     */
    hit(x, y, power, random = Math.random) {
      x = Math.min(W, Math.max(0, x))
      y = Math.min(H, Math.max(0, y))
      const count = 2 + Math.floor(random() * (0.6 + power * 2.4))
      const diagonal = Math.hypot(W, H)
      const angles = []
      for (let tries = 0; angles.length < count && tries < 200; tries++) {
        const a = random() * Math.PI * 2
        if (random() > Math.pow(room(x, y, a) / diagonal, 0.7) * 1.6) continue
        const crowded = angles.some((b) => {
          const d = Math.abs(a - b) % (Math.PI * 2)
          return Math.min(d, Math.PI * 2 - d) < 0.55
        })
        if (!crowded) angles.push(a)
      }
      /** @type {CrackLine[]} */
      const lines = []
      angles.forEach((a, i) => {
        const length = Math.min(room(x, y, a), (140 + random() * 520) * (0.35 + power))
        walk(x, y, a, length, i === 0 ? 2.6 : 2 + random() * 0.6, 0, random, lines)
      })
      // A few short chips right at the impact.
      const chips = 2 + Math.floor(random() * 3)
      for (let c = 0; c < chips; c++) {
        const ca = random() * Math.PI * 2
        const cl = 5 + random() * 12
        lines.push({ points: [[x, y], [x + Math.cos(ca) * cl, y + Math.sin(ca) * cl]], width: 1.2 })
      }
      return { x, y, power, lines }
    },
  }
}

/** SVG path data for a crack line. @param {CrackLine} line */
export const crackPath = (line) => 'M' + line.points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')
