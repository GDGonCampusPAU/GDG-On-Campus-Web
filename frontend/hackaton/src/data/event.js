// Tüm değerler PLACEHOLDER'dır. Yayınlamak için /admin panelinden JSON'u indirip
// src/data/event.json dosyasını onunla değiştirin.
import base from './event.json'
import { applyDraft } from '../lib/content.js'

export { typeLabels } from '../lib/content.js'

export const event = applyDraft(base)
