// Derlenmiş siteyi gerçek Chrome'da açıp laptop hero'nun düzenini ölçer. Kullanım: npm run check:layout
// CHROME_PATH ile Chrome yolu verilebilir. jsdom düzen hesaplamadığı için bu kontrol testlerde yoktur.
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('Chrome bulunamadı, CHROME_PATH ayarla.')

const SIZES = [
  [1440, 900],
  [1024, 768],
  [390, 844],
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const children = []
process.on('exit', () => children.forEach((c) => c.kill()))
const run = (cmd, args) => {
  const child = spawn(cmd, args, { stdio: 'ignore' })
  children.push(child)
  return child
}
const until = async (fn, what) => {
  for (let i = 0; i < 100; i++) {
    try {
      const v = await fn()
      if (v) return v
    } catch {}
    await sleep(100)
  }
  throw new Error(`${what} hazır olmadı`)
}

const PORT = 4179
const DEBUG = 9339
run('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'])
run(CHROME, ['--headless=new', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'chk-'))}`, '--no-first-run', 'about:blank'])

const tab = await until(async () => (await (await fetch(`http://127.0.0.1:${DEBUG}/json`)).json()).find((t) => t.type === 'page'), 'Chrome')
await until(async () => (await fetch(`http://localhost:${PORT}/`)).ok, 'vite preview')
const ws = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const waiting = new Map()
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  waiting.get(d.id)?.(d)
}
const send = (method, params = {}) =>
  new Promise((r) => {
    waiting.set(++id, r)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) =>
  (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.result.value

const scrollTo = (y) => evaluate(`(async () => { scrollTo({ top: ${y}, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 400)) })()`)
const failures = []
const check = (size, name, ok, detail) => ok || failures.push(`${size} ${name}: ${detail}`)

for (const [w, h] of SIZES) {
  const size = `${w}x${h}`
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `http://localhost:${PORT}/` })
  await until(() => evaluate(`!!document.querySelector('.closing')`), 'sayfa')
  // Hero kaydırma uzunluğunu ilk ölçümden sonra (font, yeniden boyutlama) düzeltir; yükseklik oturana dek bekle.
  let max = 0
  for (let i = 0; i < 20; i++) {
    await sleep(150)
    const now = await evaluate('document.documentElement.scrollHeight - innerHeight')
    if (now === max && i > 3) break
    max = now
  }

  await scrollTo(max)
  const end = JSON.parse(
    await evaluate(`JSON.stringify({
      closingBottom: document.querySelector('.closing').getBoundingClientRect().bottom,
      footerTop: document.querySelector('.footer').getBoundingClientRect().top,
      overflowX: document.documentElement.scrollWidth - innerWidth,
    })`),
  )
  check(size, 'kapanış bölümü footer ile bitişik', Math.abs(end.closingBottom - end.footerTop) <= 2, `${end.closingBottom} / ${end.footerTop}`)
  check(size, 'yatay taşma yok', end.overflowX <= 0, `${end.overflowX}px`)

  await scrollTo(max - 300)
  const covered = await evaluate(`(() => {
    const nav = document.querySelector('.navbar').getBoundingClientRect().bottom
    const inPage = (y) => !!document.elementFromPoint(innerWidth / 2, y)?.closest('.laptop__page')
    return inPage(nav + 2) && inPage(innerHeight - 2)
  })()`)
  check(size, 'sayfa pencereyi baştan sona kaplar (koyu şerit yok)', covered, 'üst ya da alt kenar sayfa dışında')
}

children.forEach((c) => c.kill())
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`${SIZES.length} boyutta düzen kontrolü geçti`)
process.exit(0)
