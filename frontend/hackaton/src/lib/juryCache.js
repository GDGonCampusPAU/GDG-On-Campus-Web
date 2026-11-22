// Jüri ekranının cihazda tuttuğu veriler:
// - Taslak: jüri + tur + takım başına. Link yenilense de aynı jüri taslağını bulur; admin sıfırlayınca eski tur silinir.
// - Son görünüm: sunucuya ulaşılamadığında sayfa bununla açılır.
// Token depolamaya yazılmaz. Depolama kapalı olabilir; her erişim try/catch içindedir.

const DRAFT_PREFIX = 'hackaton:jury-draft:'
const VIEW_PREFIX = 'hackaton:jury-view:'

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

/** @returns {boolean} saklanabildi mi */
function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function remove(key) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* depolama kapalı */
  }
}

const draftKey = (juror, round, team) => `${DRAFT_PREFIX}${juror}:${round}:${team}`

// Yalnızca linkleri birbirinden ayıran kısa özet (FNV-1a); 192 bitlik token bundan geri üretilemez.
function viewKey(token) {
  let hash = 0x811c9dc5
  for (let i = 0; i < token.length; i += 1) hash = Math.imul(hash ^ token.charCodeAt(i), 0x01000193)
  return VIEW_PREFIX + (hash >>> 0).toString(36)
}

/**
 * @param {string} juror @param {number} round @param {string} team
 * @returns {{ form: import('./juryForm.js').JuryForm, base: number } | null}
 */
export function loadDraft(juror, round, team) {
  const draft = read(draftKey(juror, round, team))
  const form = draft?.form
  const valid = Number.isInteger(draft?.base) && form?.scores && typeof form.scores === 'object'
    && Array.isArray(form.nominations) && typeof form.generalComment === 'string'
  return valid ? draft : null
}

export const saveDraft = (juror, round, team, draft) => write(draftKey(juror, round, team), draft)
export const clearDraft = (juror, round, team) => remove(draftKey(juror, round, team))

/** Sıfırlamadan önceki turların taslaklarını siler. */
export function pruneDrafts(juror, round) {
  try {
    const prefix = `${DRAFT_PREFIX}${juror}:`
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith(prefix) && Number(key.slice(prefix.length).split(':')[0]) < round)
      .forEach(remove)
  } catch {
    /* depolama kapalı */
  }
}

export const loadView = (token) => read(viewKey(token))
export const saveView = (token, view) => write(viewKey(token), view)
export const clearView = (token) => remove(viewKey(token))
