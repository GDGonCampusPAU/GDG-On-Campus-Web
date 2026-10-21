// Tüm değerler PLACEHOLDER'dır. Yayınlamak için /admin panelinden JSON'u indirip
// src/data/event.json dosyasını onunla değiştirin.
import base from './base.js'
import { isEventShape } from '../lib/content.js'
import { getEventPage } from '../lib/eventApi.js'

export { typeLabels } from '../lib/content.js'

export let event = base
export let formSlug = 'hackathon-katilim'
export async function loadEvent() {
  const page = await getEventPage()
  if (!isEventShape(base, page.event)) throw new Error('Sunucudaki etkinlik verisi geçersiz.')
  event = page.event
  formSlug = page.formSlug
}
