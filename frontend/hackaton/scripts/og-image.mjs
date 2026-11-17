// Renders public/og-image.png (1200x630) from shared/hackathon-event.json. Re-run after the event name, tagline or date change.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const at = path => fileURLToPath(new URL(path, import.meta.url))
const event = JSON.parse(readFileSync(at('../../../shared/hackathon-event.json'), 'utf8'))
const date = new Date(event.startsAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Istanbul' })
const font = name => `url(data:font/woff2;base64,${readFileSync(at(`../public/fonts/${name}.woff2`)).toString('base64')}) format('woff2')`
const esc = text => String(text).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)

const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: 'Google Sans'; src: ${font('GoogleSans-Regular')}; font-weight: 400 }
@font-face { font-family: 'Google Sans'; src: ${font('GoogleSans-Bold')}; font-weight: 700 }
body { margin: 0; width: 1200px; height: 630px; box-sizing: border-box; padding: 72px 80px; background: #f0f0f0; color: #1e1e1e;
  font-family: 'Google Sans', sans-serif; display: flex; flex-direction: column; justify-content: space-between }
.dots { display: flex; gap: 14px } .dots i { width: 36px; height: 36px; border-radius: 50% }
.org { font-size: 40px; margin-top: 28px } h1 { font-size: 104px; line-height: 1; margin: 12px 0 0 }
p { font-size: 36px; margin: 24px 0 0; max-width: 960px } .date { align-self: flex-start; background: #f9ab00; border: 3px solid #1e1e1e;
  border-radius: 999px; padding: 14px 36px; font-size: 36px; font-weight: 700 }
</style><div><div class="dots"><i style="background:#4285f4"></i><i style="background:#ea4335"></i><i style="background:#f9ab00"></i><i style="background:#34a853"></i></div>
<div class="org">${esc(event.organizer)}</div><h1>${esc(event.name)}</h1><p>${esc(event.tagline)}</p></div><div class="date">${esc(date)}</div>`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } })
await page.setContent(html)
if (!(await page.evaluate(async () => (await document.fonts.ready, [...document.fonts].every(f => f.status === 'loaded'))))) throw new Error('Google Sans did not load')
await page.screenshot({ path: at('../public/og-image.png') })
await browser.close()
console.log(`og-image.png: ${event.name}, ${date}`)
