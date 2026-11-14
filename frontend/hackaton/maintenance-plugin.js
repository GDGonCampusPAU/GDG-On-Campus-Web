// Maintenance mode for the Vite dev server.
// While the flag file exists (an admin turned maintenance on in the panel) every page
// request gets public/maintenance.html with 503, and open tabs reload into it.
// When this dev server stops, the standalone maintenance server (maintenance/server.mjs)
// takes the port over; when it starts, it asks that server to hand the port back.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** @param {{ stateDir?: string, publicDir?: string }} [options] */
export default function maintenance(options = {}) {
  const stateDir = resolve(options.stateDir || process.env.MAINTENANCE_DIR || join(here, '..', '..', '.maintenance'))
  const flagFile = join(stateDir, 'active.json')
  const page = join(options.publicDir || join(here, 'public'), 'maintenance.html')

  return {
    name: 'gdg-maintenance',
    apply: 'serve',
    /** @param {import('vite').ViteDevServer} server */
    async configureServer(server) {
      let active = existsSync(flagFile)

      server.middlewares.use((req, res, next) => {
        if (!active) return next()
        const path = (req.url || '/').split('?')[0]
        // The page's own fonts, and Vite's HMR client so already-open tabs still get the reload.
        if (path.startsWith('/fonts/') || path.startsWith('/@vite/')) return next()
        res.statusCode = 503
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Retry-After', '120')
        res.end(req.method === 'HEAD' ? undefined : readFileSync(page))
      })

      if (process.env.VITEST || !server.httpServer) return

      // Switch open tabs as soon as maintenance is turned on or off.
      const timer = setInterval(() => {
        const now = existsSync(flagFile)
        if (now === active) return
        active = now
        server.config.logger.info(active ? '[bakım] Bakım modu açıldı.' : '[bakım] Bakım modu kapandı.', { timestamp: true })
        server.ws.send({ type: 'full-reload', path: '*' })
      }, 1000)
      timer.unref()
      server.httpServer.once('close', () => clearInterval(timer))

      // The standalone maintenance server may be holding our port; ask for it back.
      if (active) {
        const port = server.config.server.port || 5173
        await fetch(`http://localhost:${port}/__maintenance/yield`, { method: 'POST', signal: AbortSignal.timeout(1000) })
          .then(() => new Promise((done) => setTimeout(done, 300)))
          .catch(() => {})
      }
    },
  }
}
