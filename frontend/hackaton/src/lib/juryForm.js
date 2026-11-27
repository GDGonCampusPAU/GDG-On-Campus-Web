/** @typedef {{ scores: Record<string, { value: number | null, comment: string }>, nominations: string[], generalComment: string }} JuryForm */

const EMPTY = { value: null, comment: '' }

/**
 * @param {any} card sunucudaki puan kartı (yoksa null)
 * @returns {JuryForm}
 */
export const formOf = (card) => ({
  scores: Object.fromEntries((card?.scores ?? []).map(({ criterion, value, comment }) => [criterion, { value: value ?? null, comment: comment ?? '' }])),
  nominations: [...(card?.nominations ?? [])],
  generalComment: card?.generalComment ?? '',
})

export const scoreOf = (form, key) => form.scores[key] ?? EMPTY

/** Sunucuya giden gövde kısmı. @param {{ key: string }[]} criteria @param {JuryForm} form */
export const payloadOf = (criteria, form) => ({
  scores: criteria.map(({ key }) => ({ criterion: key, ...scoreOf(form, key) })),
  nominations: form.nominations,
  generalComment: form.generalComment,
})

/** @param {{ key: string }[]} criteria @param {JuryForm} a @param {JuryForm} b */
export function sameForm(criteria, a, b) {
  const text = (form) => JSON.stringify([
    criteria.map(({ key }) => [scoreOf(form, key).value, scoreOf(form, key).comment]),
    [...form.nominations].sort(),
    form.generalComment,
  ])
  return text(a) === text(b)
}

/** Jüri toplamı (0-100): Σ ağırlık × puan / 5. @param {{ key: string, weight: number }[]} criteria @param {JuryForm} form */
export const totalOf = (criteria, form) =>
  criteria.reduce((sum, { key, weight }) => sum + weight * (scoreOf(form, key).value ?? 0), 0) / 5

/** @param {{ key: string, label: string, weight: number }[]} criteria @param {JuryForm} form */
export const missingOf = (criteria, form) => criteria.filter(({ key }) => !scoreOf(form, key).value)

/** 78 → "78", 78,333 → "78,3". @param {number | null | undefined} value */
export const formatScore = (value) => (value == null ? '-' : value.toLocaleString('tr-TR', { maximumFractionDigits: 1 }))
