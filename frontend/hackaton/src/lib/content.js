export const DRAFT_KEY = 'hackathon-event-draft'

export { typeLabels, choices, isEventShape } from '../../../../shared/eventContent.mjs'
import { isEventShape } from '../../../../shared/eventContent.mjs'
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

const store = (s) => s ?? window.localStorage

// Taslak, yazıldığı andaki base ile saklanır; base sonradan değiştiyse (yeni event.json yayınlandı) taslak eskidir.
// Depolama erişimi bile atabilir (gizli pencere, engelli site verisi); hepsi try içinde.
export function readDraft(base, storage) {
  try {
    const draft = JSON.parse(store(storage).getItem(DRAFT_KEY))
    const fresh = isObject(draft) && JSON.stringify(draft.base) === JSON.stringify(base)
    return fresh && isEventShape(base, draft.value) ? draft.value : null
  } catch {
    return null
  }
}

export const applyDraft = (base, storage) => readDraft(base, storage) ?? base

export function writeDraft(base, value, storage) {
  try {
    store(storage).setItem(DRAFT_KEY, JSON.stringify({ base, value }))
    return true
  } catch {
    return false
  }
}

export function clearDraft(storage) {
  try {
    store(storage).removeItem(DRAFT_KEY)
  } catch {
    // Silinemediyse yapacak bir şey yok; bir sonraki okuma yine doğrular.
  }
}
