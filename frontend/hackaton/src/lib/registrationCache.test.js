import { beforeEach, expect, test } from 'vitest'
import { DRAFT_TTL_MS, IDENTITY_TTL_MS, clearDraft, loadDraft, loadIdentity, pruneDrafts, saveDraft, saveIdentity } from './registrationCache.js'

beforeEach(() => window.localStorage.clear())

const identity = (over = {}) => ({ token: 't', expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), participant: { email: 'Person@Example.com' }, ...over })

test('draft is keyed by normalized email and drops email and files', () => {
  saveDraft('Person@Example.com ', { name: 'Ada', email: 'x@y.z', cv: new Blob(['x']), team: { mode: 'solo' } })
  expect(loadDraft('person@example.com')).toEqual({ name: 'Ada', team: { mode: 'solo' } })
  expect(loadDraft('other@example.com')).toBeNull()
})

test('draft expires after one hour and is removed', () => {
  const now = Date.now()
  saveDraft('a@b.co', { name: 'Ada' }, now)
  expect(loadDraft('a@b.co', now + DRAFT_TTL_MS - 1)).toEqual({ name: 'Ada' })
  expect(loadDraft('a@b.co', now + DRAFT_TTL_MS + 1)).toBeNull()
  expect(window.localStorage.length).toBe(0)
})

test('clearDraft and pruneDrafts remove entries', () => {
  const now = Date.now()
  saveDraft('a@b.co', { name: 'A' }, now - DRAFT_TTL_MS - 1)
  saveDraft('c@d.co', { name: 'C' }, now)
  pruneDrafts(now)
  expect(window.localStorage.length).toBe(1)
  clearDraft('c@d.co')
  expect(window.localStorage.length).toBe(0)
})

test('identity is reused only for the same email within 30 minutes', () => {
  const now = Date.now()
  saveIdentity(identity(), now)
  expect(loadIdentity(' person@example.com', now + 1000)?.token).toBe('t')
  expect(loadIdentity('other@example.com', now + 1000)).toBeNull()
  expect(loadIdentity('person@example.com', now + IDENTITY_TTL_MS + 1)).toBeNull()
  expect(window.localStorage.length).toBe(0)
})

test('identity whose token is about to expire is not reused', () => {
  saveIdentity(identity({ expiresAt: new Date(Date.now() + 60 * 1000).toISOString() }))
  expect(loadIdentity('person@example.com')).toBeNull()
})

test('broken storage contents are ignored', () => {
  window.localStorage.setItem('hackaton:register-identity', '{nope')
  expect(loadIdentity('a@b.co')).toBeNull()
})
