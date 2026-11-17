import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAINTENANCE_POLL_MS, useMaintenanceWatch } from './useMaintenanceWatch.js'

const setVisibility = (state) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
const flush = () => vi.advanceTimersByTimeAsync(0)

describe('useMaintenanceWatch', () => {
  let onMaintenance
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
    onMaintenance = vi.fn()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    setVisibility('visible')
  })

  const watch = (status) => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(/** @type {Response} */ ({ status }))
    const hook = renderHook(() => useMaintenanceWatch({ onMaintenance }))
    return { fetchMock, ...hook }
  }

  it('yüklenirken istek atmaz; aralıkla HEAD / sorar ve 503 gelince bakım ekranına geçer', async () => {
    const { fetchMock } = watch(503)
    expect(fetchMock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS)
    expect(fetchMock).toHaveBeenCalledWith('/', { method: 'HEAD', cache: 'no-store' })
    expect(onMaintenance).toHaveBeenCalledTimes(1)
  })

  it('site açıkken (200) ve deploy sırasındaki 502 / ağ hatasında sayfayı yenilemez', async () => {
    const { fetchMock } = watch(200)
    await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS)
    fetchMock.mockResolvedValue(/** @type {Response} */ ({ status: 502 }))
    await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS)
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(onMaintenance).not.toHaveBeenCalled()
  })

  it('arka plandaki sekme sormaz; sekmeye dönülünce hemen sorar', async () => {
    setVisibility('hidden')
    const { fetchMock } = watch(503)
    await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS * 3)
    expect(fetchMock).not.toHaveBeenCalled()
    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onMaintenance).toHaveBeenCalledTimes(1)
  })

  it('sayfadan çıkınca sormayı bırakır', async () => {
    const { fetchMock, unmount } = watch(200)
    unmount()
    await vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS * 2)
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
