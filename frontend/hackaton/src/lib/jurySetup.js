// /admin/juri taslağı: dizideki konum sunum sırası ve öncelik demektir, kaydederken sayıya çevrilir.

/** @param {any} config sunucudaki ayar */
export const draftOf = (config) => ({
  criteria: config.criteria.map(({ key, label, description, weight }) => ({ key, label, description, weight })),
  categories: config.categories.map(({ key, name, icon, criterionKeys, active }) => ({ key, name, icon, criterionKeys, active })),
  entries: config.entries.map(({ team, teamName, projectName, repoUrl, demoUrl, presentationUrl }) => ({ team, teamName, projectName, repoUrl, demoUrl, presentationUrl })),
})

export const isDirty = (config, draft) => JSON.stringify(draftOf(config)) !== JSON.stringify(draft)

/** @param {ReturnType<typeof draftOf>} draft @param {number} revision */
export const bodyOf = (draft, revision) => ({
  revision,
  criteria: draft.criteria,
  categories: draft.categories.map((category, index) => ({ ...category, priority: index + 1 })),
  entries: draft.entries.map(({ teamName: _teamName, ...entry }, index) => ({ ...entry, order: index + 1 })),
})

export const weightTotal = (criteria) => criteria.reduce((sum, criterion) => sum + (Number(criterion.weight) || 0), 0)

export const LINK_FIELDS = [['repoUrl', 'Repo linki'], ['demoUrl', 'Demo linki'], ['presentationUrl', 'Sunum linki']]

export const isValidLink = (value) => {
  const url = value.trim()
  return !url || (/^https?:\/\/\S+$/i.test(url) && URL.canParse(url))
}

/**
 * Kaydetmeyi engelleyen ilk sorun; yoksa ''.
 * @param {ReturnType<typeof draftOf>} draft
 */
export function setupProblem(draft) {
  const total = weightTotal(draft.criteria)
  if (total !== 100) return `Kriter ağırlıklarının toplamı 100 olmalı (şu an ${total}).`
  if (draft.criteria.some((criterion) => !Number.isInteger(criterion.weight) || criterion.weight < 1)) return 'Her ağırlık 1 veya daha büyük tam sayı olmalı.'
  if (draft.criteria.some((criterion) => !criterion.label.trim())) return 'Kriter adı boş olamaz.'
  if (draft.categories.some((category) => !category.name.trim())) return 'Kategori adı boş olamaz.'
  const bad = draft.entries.find((entry) => LINK_FIELDS.some(([key]) => !isValidLink(entry[key])))
  if (bad) return `"${bad.teamName}" takımının linkleri http:// veya https:// ile başlamalı.`
  return ''
}

export const move = (list, from, to) => {
  const copy = [...list]
  copy.splice(to, 0, ...copy.splice(from, 1))
  return copy
}
