// public/maintenance.html must stay self-contained (it is served while the app is down),
// so it carries its own copy of the home page laptop. Keep that copy in step.
import html from '../public/maintenance.html?raw'
import { KEYBOARD_RATIO, KEYBOARD_URL } from './lib/keyboard.js'

test('the maintenance laptop uses the same keyboard image and ratio as the home page', () => {
  expect(html).toContain(KEYBOARD_URL)
  expect(html).toContain(`aspect-ratio: ${KEYBOARD_RATIO}`)
})

test('the maintenance page loads nothing but the site fonts', () => {
  const urls = [...html.matchAll(/(?:src|href)=["']([^"']+)["']|url\(['"]?([^'")]+)/g)].map((m) => m[1] ?? m[2])
  const external = urls.filter((url) => !url.startsWith('data:') && !url.startsWith('#') && !url.startsWith('/fonts/'))
  expect(external).toEqual([])
})
