// MacBook (US ANSI) tuş düzeni. 1u = standart tuş genişliği; her satır tam 15u'dur.
const ones = (n) => Array(n).fill(1)

const ROWS = [
  { h: 0.75, keys: [1.5, ...ones(12), 1.5] }, // esc, F1-F12, Touch ID
  { h: 1, keys: [...ones(13), 2] }, // ` 1-0 - =, delete
  { h: 1, keys: [1.5, ...ones(12), 1.5] }, // tab, Q-P [ ], \
  { h: 1, keys: [1.75, ...ones(11), 2.25] }, // caps, A-L ; ', return
  { h: 1, keys: [2.25, ...ones(10), 2.75] }, // shift, Z-M , . /, shift
  { h: 1, keys: [1, 1, 1, 1.25, 5.5, 1.25, 1] }, // fn, ctrl, opt, cmd, boşluk, cmd, opt; sağda ok kümesi
]

export const KEYBOARD_WIDTH = 15
const GAP = 0.06 // tuşun her kenarından içeri; komşu tuşlar arası boşluk 2 * GAP
const RADIUS = 0.14

// Her tuş hücresi: { row, x, y, w, h } u cinsinden, boşluksuz. Ok kümesi 3u x 1u, yarım yükseklikte tuşlardır.
export function keyboardLayout() {
  const keys = []
  let y = 0
  ROWS.forEach(({ h, keys: widths }, row) => {
    let x = 0
    for (const w of widths) {
      keys.push({ row, x, y, w, h })
      x += w
    }
    if (row === ROWS.length - 1) {
      const half = h / 2
      keys.push({ row, x, y: y + half, w: 1, h: half })
      keys.push({ row, x: x + 1, y, w: 1, h: half })
      keys.push({ row, x: x + 1, y: y + half, w: 1, h: half })
      keys.push({ row, x: x + 2, y: y + half, w: 1, h: half })
    }
    y += h
  })
  return { width: KEYBOARD_WIDTH, height: y, keys }
}

const round = (n) => Number(n.toFixed(3))

export function keyboardSvg({ width, height, keys }, fill = '#2a2d32') {
  const rects = keys
    .map(({ x, y, w, h }) =>
      [
        `<rect x="${round(x + GAP)}" y="${round(y + GAP)}"`,
        ` width="${round(w - 2 * GAP)}" height="${round(h - 2 * GAP)}" rx="${RADIUS}"/>`,
      ].join(''),
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" fill="${fill}">${rects}</svg>`
}

const layout = keyboardLayout()

// CSS background-image değeri ve tuş kuyusunun en-boy oranı; kuyu bu oranda olmazsa tuşlar kareliğini yitirir.
export const KEYBOARD_URL = `url("data:image/svg+xml,${encodeURIComponent(keyboardSvg(layout))}")`
export const KEYBOARD_RATIO = `${layout.width} / ${layout.height}`
