import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReveal } from './useReveal.js'

function Probe() {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} data-testid="probe">
      {visible ? 'görünür' : 'gizli'}
    </div>
  )
}

describe('useReveal', () => {
  let observers
  beforeEach(() => {
    observers = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback) {
          this.callback = callback
          this.observe = vi.fn()
          this.disconnect = vi.fn()
          observers.push(this)
        }
      },
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('ekrana girmeden önce gizli kalır ve öğeyi gözler', () => {
    render(<Probe />)
    expect(screen.getByText('gizli')).toBeInTheDocument()
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledWith(screen.getByTestId('probe'))
  })

  it('kesişince görünür yapar ve gözlemciyi keser', () => {
    render(<Probe />)
    act(() => observers[0].callback([{ isIntersecting: true }]))
    expect(screen.getByText('görünür')).toBeInTheDocument()
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('kesişmeyen girdide gizli kalır', () => {
    render(<Probe />)
    act(() => observers[0].callback([{ isIntersecting: false }]))
    expect(screen.getByText('gizli')).toBeInTheDocument()
    expect(observers[0].disconnect).not.toHaveBeenCalled()
  })

  it('unmount olunca gözlemciyi keser', () => {
    const { unmount } = render(<Probe />)
    unmount()
    expect(observers[0].disconnect).toHaveBeenCalled()
  })

  it('azaltılmış harekette gözlemci kurmadan görünür başlar', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true })
    render(<Probe />)
    expect(screen.getByText('görünür')).toBeInTheDocument()
    expect(observers).toHaveLength(0)
    vi.restoreAllMocks()
  })
})
