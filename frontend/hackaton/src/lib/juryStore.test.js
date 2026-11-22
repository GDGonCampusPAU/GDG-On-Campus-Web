import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_MS, POLL_MS, RATE_LIMIT_RETRY_MS, RETRY_MS, createJuryStore, describeTeam } from './juryStore.js'
import { CRITERIA, failure, fakeJuryServer, makeCard, networkError } from '../test/juryFixtures.js'

const TOKEN = 'a'.repeat(32)
let server
let stores

const open = async (token = TOKEN) => {
  const store = createJuryStore(token, server.client)
  stores.push(store)
  store.start()
  await vi.advanceTimersByTimeAsync(0)
  return store
}
const close = (store) => store.stop()
const wait = (ms = AUTOSAVE_MS) => vi.advanceTimersByTimeAsync(ms)
const score = (store, value, team = 't1', key = 'technical') =>
  store.edit(team, (form) => ({ ...form, scores: { ...form.scores, [key]: { value, comment: '' } } }))
const scoreAll = (store, value, team = 't1') => CRITERIA.forEach(({ key }) => score(store, value, team, key))
const saved = (team = 't1', key = 'technical') => server.cards[team]?.scores.find((item) => item.criterion === key)?.value
const shown = (store, team = 't1', key = 'technical') => store.getState().teams[team].form.scores[key]?.value
const info = (store, team = 't1') => describeTeam(CRITERIA, store.getState().teams[team])

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
  server = fakeJuryServer()
  stores = []
})
afterEach(() => {
  stores.forEach(close)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('otomatik kayıt', () => {
  it('değişiklikten 1 sn sonra tek istekle taslak kaydeder', async () => {
    const store = await open()
    score(store, 2)
    score(store, 4)
    await wait(AUTOSAVE_MS - 1)
    expect(server.client.save).not.toHaveBeenCalled()
    await wait(1)
    expect(server.client.save).toHaveBeenCalledTimes(1)
    expect(server.client.save.mock.calls[0][1]).toMatchObject({ submit: false, round: 1, version: 0 })
    expect(saved()).toBe(4)
    expect(info(store).dirty).toBe(false)
  })

  it('istek sürerken yapılan değişiklik sıraya girer, kaybolmaz ve çakışma sayılmaz', async () => {
    const store = await open()
    const real = server.client.save.getMockImplementation()
    server.client.save.mockImplementationOnce(async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 3000))
      return real(...args)
    })
    score(store, 2)
    await wait()
    score(store, 5)
    await wait(6000)
    expect(saved()).toBe(5)
    expect(info(store)).toMatchObject({ dirty: false, conflict: false })
  })

  it('başka takıma geçilse de önceki takım kaydedilir', async () => {
    const store = await open()
    score(store, 3, 't1')
    score(store, 4, 't2')
    await wait()
    expect([saved('t1'), saved('t2')]).toEqual([3, 4])
  })

  it('hız limitinde daha uzun bekler', async () => {
    const store = await open()
    server.client.save.mockRejectedValueOnce(failure(429, 'RATE_LIMITED'))
    score(store, 3)
    await wait()
    await wait(RATE_LIMIT_RETRY_MS - 1000)
    expect(saved()).toBeUndefined()
    await wait(1000)
    expect(saved()).toBe(3)
  })
})

describe('bağlantı kopması ve yenileme', () => {
  it('bağlantı yokken cihazda saklar, gelince yeniden dener', async () => {
    const store = await open()
    server.offline = true
    score(store, 4)
    await wait()
    expect(store.getState().teams.t1.saveError).toContain('ulaşılamadı')
    expect(window.localStorage.getItem('hackaton:jury-draft:j1:1:t1')).toContain('"value":4')
    server.offline = false
    await wait(RETRY_MS)
    expect(saved()).toBe(4)
    expect(window.localStorage.getItem('hackaton:jury-draft:j1:1:t1')).toBeNull()
  })

  it('online olayında beklemeden dener', async () => {
    const store = await open()
    server.offline = true
    score(store, 5)
    await wait()
    server.offline = false
    window.dispatchEvent(new Event('online'))
    await wait(0)
    expect(saved()).toBe(5)
  })

  it('kaydedilmeden sayfa yenilenirse taslak geri gelir ve kaydedilir', async () => {
    const first = await open()
    score(first, 3)
    close(first)
    const second = await open()
    expect(shown(second)).toBe(3)
    await wait()
    expect(saved()).toBe(3)
  })

  it('sunucuya ulaşılamazken yenilenen sayfa son görünümle açılır', async () => {
    const first = await open()
    score(first, 2)
    close(first)
    server.offline = true
    const second = await open()
    expect(second.getState()).toMatchObject({ phase: 'ready', offline: true })
    expect(shown(second)).toBe(2)
    score(second, 5)
    await wait()
    server.offline = false
    await wait(POLL_MS)
    expect(second.getState().offline).toBe(false)
    expect(saved()).toBe(5)
  })

  it('link yenilense de aynı jüri taslağını bulur', async () => {
    const first = await open()
    score(first, 4)
    close(first)
    expect(shown(await open('b'.repeat(32)))).toBe(4)
  })

  it('token depolamaya yazılmaz', async () => {
    const store = await open()
    score(store, 4)
    expect(JSON.stringify({ ...window.localStorage })).not.toContain(TOKEN)
  })

  it('depolama kapalıyken de çalışır', async () => {
    const denied = () => {
      throw new Error('SecurityError')
    }
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(denied)
    const store = await open()
    score(store, 4)
    expect(store.getState().teams.t1.stored).toBe(false)
    await wait()
    expect(saved()).toBe(4)
  })
})

describe('gönderilmiş kart', () => {
  beforeEach(() => {
    server.cards.t1 = makeCard(3, { status: 'SUBMITTED' })
  })

  it('değişiklik kendiliğinden gönderilmez, uyarı için işaretlenir', async () => {
    const store = await open()
    score(store, 5)
    await wait(POLL_MS * 2)
    expect(server.client.save).not.toHaveBeenCalled()
    expect(saved()).toBe(3)
    expect(info(store)).toMatchObject({ unsent: true, submitted: true })
  })

  it('gönderilmemiş değişiklik yenilemede korunur', async () => {
    const first = await open()
    score(first, 5)
    close(first)
    const second = await open()
    expect(shown(second)).toBe(5)
    expect(info(second).unsent).toBe(true)
  })

  it('yeniden gönderince geçerli olur', async () => {
    const store = await open()
    score(store, 5)
    expect(await store.submit('t1')).toBe(true)
    expect(saved()).toBe(5)
    expect(info(store)).toMatchObject({ unsent: false, submitted: true })
  })

  it('geri alınınca uyarı kalkar', async () => {
    const store = await open()
    score(store, 5)
    store.useServer('t1')
    expect(shown(store)).toBe(3)
    expect(info(store).unsent).toBe(false)
  })

  it('sayfadan çıkarken uyarır', async () => {
    const store = await open()
    score(store, 5)
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  })
})

describe('çakışma', () => {
  it('başka cihazın kaydını sessizce ezmez', async () => {
    const store = await open()
    server.cards.t1 = makeCard(1)
    score(store, 5)
    await wait()
    expect(info(store).conflict).toBe(true)
    expect(saved()).toBe(1)
    store.keepMine('t1')
    await wait()
    expect(saved()).toBe(5)
  })

  it('sunucudaki seçilirse form ona döner', async () => {
    const store = await open()
    server.cards.t1 = makeCard(1)
    score(store, 5)
    await wait()
    store.useServer('t1')
    expect(shown(store)).toBe(1)
    expect(info(store).conflict).toBe(false)
  })

  it('çakışma yenilemeden sonra da sorulur', async () => {
    const first = await open()
    score(first, 5)
    close(first)
    server.cards.t1 = makeCard(1)
    expect(info(await open()).conflict).toBe(true)
  })

  it('yanıtı kaybolan istek çakışma sayılmaz', async () => {
    const store = await open()
    const real = server.client.save.getMockImplementation()
    server.client.save.mockImplementationOnce(async (...args) => {
      await real(...args)
      throw networkError()
    })
    score(store, 4)
    await wait()
    await wait(RETRY_MS)
    expect(info(store)).toMatchObject({ dirty: false, conflict: false })
    expect(saved()).toBe(4)
  })

  it('gönderimin yanıtı kaybolursa tazelemede gönderildi görünür', async () => {
    const store = await open()
    scoreAll(store, 4)
    const real = server.client.save.getMockImplementation()
    server.client.save.mockImplementationOnce(async (...args) => {
      await real(...args)
      throw networkError()
    })
    expect(await store.submit('t1')).toBe(false)
    await wait(POLL_MS)
    expect(info(store)).toMatchObject({ submitted: true, unsent: false })
  })
})

describe('kilit, sıfırlama, geçersiz link', () => {
  it('kilit açıkken kaydetmez, açılınca bekleyen taslağı kaydeder', async () => {
    const store = await open()
    server.locked = true
    score(store, 4)
    await wait()
    expect(store.getState().me.locked).toBe(true)
    score(store, 1)
    expect(shown(store)).toBe(4)
    server.locked = false
    await wait(POLL_MS + AUTOSAVE_MS)
    expect(saved()).toBe(4)
  })

  it('sıfırlamadan sonra eski taslak geri gönderilmez', async () => {
    const store = await open()
    score(store, 5)
    await wait()
    score(store, 2)
    server.round = 2
    server.cards = {}
    await wait()
    expect(store.getState().wasReset).toBe(true)
    expect(shown(store)).toBeUndefined()
    await wait(POLL_MS)
    expect(server.cards).toEqual({})
    expect(window.localStorage.getItem('hackaton:jury-draft:j1:1:t1')).toBeNull()
  })

  it('kapalıyken sıfırlandıysa açılışta eski taslak silinir', async () => {
    const first = await open()
    score(first, 5)
    close(first)
    server.round = 2
    const second = await open()
    expect(shown(second)).toBeUndefined()
    await wait(POLL_MS)
    expect(server.cards).toEqual({})
  })

  it('geçersiz link kayıtlı görünümü göstermez', async () => {
    close(await open())
    server.invalid = true
    expect((await open()).getState().phase).toBe('invalid')
  })
})
