import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { immersiveProgress, fitZoom, useScrollProgress } from './useScrollProgress.js'

describe('immersiveProgress', () => {
  const OPEN = 1000
  const ZOOM = 500
  const LEN = 600

  it('izlek başında kapak kapalı, yaklaşma ve kayma sıfırdır', () => {
    expect(immersiveProgress(-50, OPEN, ZOOM, LEN)).toEqual({ p: 0, z: 0, c: 0 })
  })

  it('açılma sırasında yalnızca p ilerler', () => {
    expect(immersiveProgress(500, OPEN, ZOOM, LEN)).toEqual({ p: 0.5, z: 0, c: 0 })
  })

  it('kapak açılınca yaklaşma başlar, sayfa kımıldamaz', () => {
    expect(immersiveProgress(1250, OPEN, ZOOM, LEN)).toEqual({ p: 1, z: 0.5, c: 0 })
  })

  it('yaklaşma bitince sayfa ekranın içinde kayar', () => {
    expect(immersiveProgress(1800, OPEN, ZOOM, LEN)).toEqual({ p: 1, z: 1, c: 300 })
  })

  it('izlek sonunda kayma sayfanın uzunluğunu aşmaz', () => {
    expect(immersiveProgress(5000, OPEN, ZOOM, LEN)).toEqual({ p: 1, z: 1, c: 600 })
  })

  it('yaklaşma yoksa (zoomDist 0) açılmadan hemen sonra kayma başlar', () => {
    expect(immersiveProgress(1300, OPEN, 0, LEN)).toEqual({ p: 1, z: 0, c: 300 })
  })

  it('sayfa ekrandan kısaysa kayma olmaz', () => {
    expect(immersiveProgress(1800, OPEN, ZOOM, 0)).toEqual({ p: 1, z: 1, c: 0 })
  })

  it('açılma mesafesi 0 ise (pencere yüksekliği 0) p sonlu kalır', () => {
    expect(immersiveProgress(0, 0, 0, 0)).toEqual({ p: 1, z: 0, c: 0 })
  })
})

describe('fitZoom', () => {
  // Merkez o = alan merkezi: yalnızca ölçek test edilir, kaydırma sıfır olmalı.
  const area = { left: 0, top: 64, width: 1440, height: 836 }
  const o = { x: 720, y: 482 }
  const screenAt = (width, height, cx = 720, cy = 482) => ({
    left: cx - width / 2,
    top: cy - height / 2,
    width,
    height,
  })

  it('ekran alandan geniş orandaysa genişliğe oturur, alt üst taşar', () => {
    const fit = fitZoom(screenAt(1000, 600), o, area)
    expect(fit.s).toBeCloseTo(1.44, 5)
    expect(fit.x).toBeCloseTo(0, 5)
    expect(fit.y).toBeCloseTo(0, 5)
    expect(fit.cropY).toBeCloseTo((600 * 1.44 - 836) / 2, 5)
  })

  it('alan ekrandan biraz dar orandaysa yüksekliğe oturur, taşan yanlar azdır, üst alt kırpılmaz', () => {
    const narrow = { left: 0, top: 0, width: 1470, height: 1000 }
    const fit = fitZoom(screenAt(1200, 800, 735, 500), { x: 735, y: 500 }, narrow)
    expect(fit.s).toBeCloseTo(1.25, 5)
    expect(fit.cropY).toBe(0)
  })

  it('ekran merkezi kaymışsa kaydırma onu alanın merkezine getirir', () => {
    const r = screenAt(1000, 600, 620, 400)
    const fit = fitZoom(r, o, area)
    // Dönüşüm: merkez o etrafında ölçek, sonra öteleme. Ekran merkezi alan merkezine düşmeli.
    const mapped = {
      x: o.x + fit.x + fit.s * (620 - o.x),
      y: o.y + fit.y + fit.s * (400 - o.y),
    }
    expect(mapped.x).toBeCloseTo(720, 5)
    expect(mapped.y).toBeCloseTo(482, 5)
  })

  it('dikey pencerede ekranın tamamı görünür: genişliğe oturur, kırpma yerine üst alt boşluk kalır (cropY negatif)', () => {
    const portrait = { left: 0, top: 64, width: 390, height: 780 }
    const fit = fitZoom(screenAt(280, 190, 195, 454), { x: 195, y: 454 }, portrait)
    expect(fit.s).toBeCloseTo(390 / 280, 5)
    expect(fit.cropY).toBeCloseTo((190 * (390 / 280) - 780) / 2, 5)
    expect(fit.cropY).toBeLessThan(0)
  })

  it('çok geniş pencerede de kenardan kenara kaplar: genişliğe oturur, üst alt kırpılır', () => {
    const wide = { left: 0, top: 64, width: 1280, height: 436 }
    const fit = fitZoom(screenAt(1000, 680, 640, 282), { x: 640, y: 282 }, wide)
    expect(fit.s).toBeCloseTo(1.28, 5)
    expect(fit.cropY).toBeCloseTo((680 * 1.28 - 436) / 2, 5)
  })

  // Ekran oranı 1000/600; eşik bu oranın 0.94 katıdır.
  const ratio = 1000 / 600
  const areaAt = (k) => ({ left: 0, top: 0, width: 1000 * ratio * k, height: 1000 })

  it('alan oranı eşiğin hemen üstündeyse (0.95x) kaplar: büyük ölçek seçilir', () => {
    const fit = fitZoom(screenAt(1000, 600), o, areaAt(0.95))
    expect(fit.s).toBeCloseTo(1000 / 600, 5)
  })

  it('alan oranı eşiğin hemen altındaysa (0.93x) sığar: küçük ölçek seçilir', () => {
    const fit = fitZoom(screenAt(1000, 600), o, areaAt(0.93))
    expect(fit.s).toBeCloseTo(ratio * 0.93, 5)
  })
})

describe('useScrollProgress', () => {
  let top = 0

  const mount = (enabled = true) => {
    const el = document.createElement('section')
    el.innerHTML = `
      <div class="laptop-hero__stage">
        <div class="laptop__view">
          <div class="laptop__display"><div class="laptop__page"><div class="laptop__rest"></div></div></div>
        </div>
      </div>`
    document.body.append(el)
    el.getBoundingClientRect = () => ({ top, left: 0, width: 0, height: 0 })
    const page = el.querySelector('.laptop__page')
    // Sayfa ekrandan 1500px uzun: c 0..1500.
    Object.defineProperty(page, 'offsetHeight', { value: 2000 })
    Object.defineProperty(page.parentElement, 'clientHeight', { value: 500 })
    const hook = renderHook(() => useScrollProgress({ current: el }, enabled, { current: page }))
    return { el, ...hook }
  }

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
    top = 0
  })

  const stubWindow = () => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(1000)
    vi.stubGlobal('requestAnimationFrame', (cb) => {
      cb()
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  }

  it('kaydırınca --p, --c ve data-dark güncellenir', () => {
    stubWindow()
    const { el } = mount()
    expect(el.style.getPropertyValue('--p')).toBe('0.000')
    expect(el.dataset.dark).toBe('false')

    top = -600
    window.dispatchEvent(new Event('scroll'))
    expect(el.style.getPropertyValue('--p')).toBe('0.500')
    expect(el.style.getPropertyValue('--c')).toBe('0.0')
    expect(el.dataset.dark).toBe('true')

    // Ölçülemeyen ekranda (jsdom) yaklaşma yoktur: açılma 1200px'te biter, sonrası kayma.
    top = -1500
    window.dispatchEvent(new Event('scroll'))
    expect(el.style.getPropertyValue('--p')).toBe('1.000')
    expect(el.style.getPropertyValue('--c')).toBe('300.0')
  })

  it('kapak kapalıyken klavye odağı gelirse açılma ve yaklaşma sonuna atlar', () => {
    stubWindow()
    const scrollTo = vi.spyOn(window, 'scrollTo')
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(50)
    const { el } = mount()
    top = -50
    const link = document.createElement('a')
    link.matches = (q) => q === ':focus-visible'
    el.querySelector('.laptop__page').append(link)
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: 'instant' })
  })

  it('fareyle odakta ya da kapak açıldıktan sonra kaydırmaz', () => {
    stubWindow()
    const scrollTo = vi.spyOn(window, 'scrollTo')
    const { el } = mount()
    const link = document.createElement('a')
    el.append(link)
    link.matches = () => false
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    top = -1300
    link.matches = () => true
    link.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('unmount olunca dinleyiciler kalkar, gözlemci kopar', () => {
    stubWindow()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect = disconnect
      },
    )
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { el, unmount } = mount()
    const elRemove = vi.spyOn(el, 'removeEventListener')
    unmount()
    expect(disconnect).toHaveBeenCalled()
    for (const type of ['scroll', 'resize']) {
      const handler = add.mock.calls.find(([t]) => t === type)[1]
      expect(remove).toHaveBeenCalledWith(type, handler)
    }
    expect(elRemove).toHaveBeenCalledWith('focusin', expect.any(Function))
  })

  it('enabled false iken hiçbir şey bağlamaz', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const observe = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe
        disconnect() {}
      },
    )
    const { el } = mount(false)
    expect(add).not.toHaveBeenCalled()
    expect(observe).not.toHaveBeenCalled()
    expect(el.style.getPropertyValue('--p')).toBe('')
  })
})
