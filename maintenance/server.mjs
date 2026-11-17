// Standalone maintenance server: no dependencies, only Node built-ins.
//
// The backend starts it (detached) when an admin turns maintenance on in the panel.
// It keeps answering every request on the site's port with the maintenance page even
// when the backend, the panel and the Vite dev server are all stopped, and it exits by
// itself as soon as the flag file disappears (maintenance turned off in the panel).
//
// While the Vite dev server is running it owns the port and shows the same page
// (see frontend/hackaton/maintenance-plugin.js); this process takes the port over
// whenever it becomes free.
import { createServer } from 'node:http'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const stateDir = resolve(process.env.MAINTENANCE_DIR || join(here, '..', '.maintenance'))
const flagFile = join(stateDir, 'active.json')
const pidFile = join(stateDir, 'server.pid')
const publicDir = resolve(process.env.MAINTENANCE_PUBLIC_DIR || join(here, '..', 'frontend', 'hackaton', 'public'))
const port = Number(process.env.MAINTENANCE_PORT || 5173)
const host = process.env.MAINTENANCE_HOST || 'localhost'
const RETRY_MS = Number(process.env.MAINTENANCE_RETRY_MS || 2000)
const YIELD_MS = Number(process.env.MAINTENANCE_YIELD_MS || 8000)
const FONTS = new Set(['GoogleSans-Regular.woff2', 'GoogleSans-Bold.woff2', 'GoogleSansMono-Regular.woff2', 'GoogleSansMono-Bold.woff2'])

const log = (...args) => console.log('[bakım]', ...args)
const isAlive = (pid) => {
  try { process.kill(pid, 0); return true } catch (error) { return error.code === 'EPERM' }
}

if (!existsSync(flagFile)) {
  log('Bakım modu kapalı; başlatılmadı.')
  process.exit(0)
}
// --detach: start a copy in its own session and exit at once. The copy is then adopted by
// init, so stopping whatever started us (npm run dev, a terminal, an IDE task that kills the
// whole process tree) does not take the maintenance page down with it.
if (process.argv.includes('--detach')) {
  const { spawn } = await import('node:child_process')
  spawn(process.execPath, [fileURLToPath(import.meta.url)], { detached: true, stdio: 'ignore', env: process.env }).unref()
  process.exit(0)
}
// Terminal hang-ups are not a reason to stop; only the flag (or an explicit SIGTERM) is.
process.on('SIGHUP', () => {})
// One instance only.
const otherPid = existsSync(pidFile) ? Number(readFileSync(pidFile, 'utf8')) : 0
if (otherPid && otherPid !== process.pid && isAlive(otherPid)) {
  log(`Zaten çalışıyor (pid ${otherPid}).`)
  process.exit(0)
}
writeFileSync(pidFile, String(process.pid))

const page = () => readFileSync(join(publicDir, 'maintenance.html'))
const isLoopback = (address = '') => address === '::1' || address.startsWith('127.') || address === '::ffff:127.0.0.1'

let server = null
let retryTimer = null
let stopping = false

function handle(req, res) {
  const path = decodeURIComponent((req.url || '/').split('?')[0])
  // The Vite dev server asks for the port back when it starts.
  if (path === '/__maintenance/yield' && req.method === 'POST' && isLoopback(req.socket.remoteAddress)) {
    res.writeHead(204).end()
    log('Port geliştirme sunucusuna bırakılıyor.')
    release(YIELD_MS)
    return
  }
  const font = path.startsWith('/fonts/') && path.slice(7)
  if (font && FONTS.has(font)) {
    res.writeHead(200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'public, max-age=86400' })
    res.end(readFileSync(join(publicDir, 'fonts', font)))
    return
  }
  res.writeHead(503, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Retry-After': '120',
    'X-Robots-Tag': 'noindex',
  })
  res.end(req.method === 'HEAD' ? undefined : page())
}

function listen() {
  if (stopping) return
  retryTimer = null
  const candidate = createServer(handle)
  candidate.once('error', (error) => {
    if (error.code !== 'EADDRINUSE') log('Dinleme hatası:', error.message)
    retryTimer = setTimeout(listen, RETRY_MS)
  })
  candidate.listen(port, host, () => {
    server = candidate
    log(`Bakım sayfası yayında: http://${host}:${port}`)
  })
}

function release(waitMs) {
  if (server) {
    server.close()
    server.closeAllConnections()
    server = null
  }
  clearTimeout(retryTimer)
  retryTimer = setTimeout(listen, waitMs)
}

function stop(reason) {
  if (stopping) return
  stopping = true
  log(reason)
  clearTimeout(retryTimer)
  clearInterval(watcher)
  try {
    if (Number(readFileSync(pidFile, 'utf8')) === process.pid) unlinkSync(pidFile)
  } catch { /* already gone */ }
  if (!server) process.exit(0)
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

// Polling (not fs.watch) works on every platform and on bind mounts.
const watcher = setInterval(() => {
  if (!existsSync(flagFile)) stop('Bakım modu kapatıldı; çıkılıyor.')
}, 1000)

process.on('SIGTERM', () => stop('SIGTERM alındı; çıkılıyor.'))
process.on('SIGINT', () => stop('SIGINT alındı; çıkılıyor.'))
listen()
