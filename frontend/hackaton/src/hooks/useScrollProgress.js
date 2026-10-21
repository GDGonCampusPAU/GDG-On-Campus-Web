import { useEffect } from 'react'

// Kapak açılma mesafesi ve ardından gelen yaklaşma mesafesi, ekran yüksekliğinin bu katlarıdır.
const OPEN_DIST = 1.2
const ZOOM_DIST = 0.9

const clamp01 = (v) => Math.min(1, Math.max(0, v))

// y: izleğe girilen px. Sırayla openDist kapağı açar (p), zoomDist ekrana yaklaşır (z),
// sonrası sayfayı ekranın içinde kaydırır (c, px). Yaklaşma yoksa zoomDist 0 verilir.
export function immersiveProgress(y, openDist, zoomDist, scrollLen) {
  return {
    p: openDist > 0 ? clamp01(y / openDist) : 1,
    z: zoomDist > 0 ? clamp01((y - openDist) / zoomDist) : 0,
    c: Math.min(scrollLen, Math.max(0, y - openDist - zoomDist)),
  }
}

// Yaklaşma sonunda ekranın (r) hedef alanı (t) içinde kapladığı ölçek ve kaydırma.
// o: view'ın dönüşüm merkezi. Hepsi viewport px. Dönüşüm sırası: translate(x, y) scale(s) (merkez o).
// Alanın en-boy oranı ekranınkine yakınsa ya da daha genişse ekran alanı kenardan kenara kaplar: genişliğe oturur,
// üst alt kırpılır (sayfa zaten kayar). Daha diktse (dikey pencere) yanlar kırpılırsa yazı kesilir; ekranın tamamı
// görünür, sayfa üstte ve altta kalan boşluğa taşar (cropY negatif).
export function fitZoom(r, o, t) {
  const aspect = t.width / t.height
  const cover = aspect >= (r.width / r.height) * 0.94

  const sw = t.width / r.width
  const sh = t.height / r.height
  const s = cover ? Math.max(sw, sh) : Math.min(sw, sh)
  const rx = r.left + r.width / 2
  const ry = r.top + r.height / 2
  return {
    s,
    x: t.left + t.width / 2 - o.x - s * (rx - o.x),
    y: t.top + t.height / 2 - o.y - s * (ry - o.y),
    cropY: (r.height * s - t.height) / 2, // alttan taşan px; negatifse ekran alandan kısadır, üstte ve altta |cropY| boşluk kalır
  }
}

// Yalnızca LaptopHero içindir: onun sınıf adlarını sorgular.
// İlerlemeyi React state'i yerine --p CSS değişkeniyle yazar; kaydırırken yeniden render olmaz.
// İzlek uzunluğu sayfa yüksekliğinden (pageRef) gelir, sayfanın ekranda kayması --c ile yazılır.
export function useScrollProgress(ref, enabled, pageRef) {
  useEffect(() => {
    const el = ref.current
    const page = pageRef.current
    if (!el || !page || !enabled) return undefined

    let frame = 0
    let scrollLen = 0
    let zoomDist = 0
    let stripe = 0

    // Yaklaşma sonu hâlindeki ekran dikdörtgenini ölçer. flat: bitişte sahne düz 2B sayfadır (data-zoomed),
    // ölçek ve kaydırma ayrı hesaplanır; 3B hâlle aynı dikdörtgeni verirler, geçiş sıçramaz.
    // Alttan taşan kırpılan kısım için sayfa kaydırması o kadar uzar, son satırlar ekranda kalır.
    const measureZoom = (flat) => {
      const view = el.querySelector('.laptop__view')
      const display = el.querySelector('.laptop__display')
      const stage = el.querySelector('.laptop-hero__stage')
      const scale = flat ? '--zs2' : '--zs'
      const keys = ['--p', '--z', scale, '--zx', '--zy', '--zx2', '--zy2']
      const saved = keys.map((k) => el.style.getPropertyValue(k))
      const wasZoomed = el.dataset.zoomed
      el.style.setProperty('--p', '1')
      el.style.setProperty('--z', '1')
      el.style.setProperty(scale, '1')
      el.style.setProperty(flat ? '--zx2' : '--zx', '0px')
      el.style.setProperty(flat ? '--zy2' : '--zy', '0px')
      el.dataset.zoomed = String(flat)
      const navH = parseFloat(getComputedStyle(stage).top) || 0
      // Sahne en üstteyken (kaydırma 0) yapışkan konumundan 1px aşağıda durabilir; ölçüm yapışkan konuma göre.
      const dy = navH - stage.getBoundingClientRect().top
      const box = (node) => {
        const { left, top, width, height } = node.getBoundingClientRect()
        return { left, top: top + dy, width, height }
      }
      const r = box(display)
      const v = box(view)
      const hasLayout = r.width > 0 && v.width > 0
      const ty = hasLayout ? new DOMMatrixReadOnly(getComputedStyle(view).transform).m42 : 0
      const k = hasLayout ? r.width / display.offsetWidth : 1
      keys.forEach((key, i) => (saved[i] ? el.style.setProperty(key, saved[i]) : el.style.removeProperty(key)))
      if (wasZoomed === undefined) delete el.dataset.zoomed
      else el.dataset.zoomed = wasZoomed
      if (!hasLayout) return null

      const t = { left: 0, top: navH, width: document.documentElement.clientWidth, height: window.innerHeight - navH }
      const o = { x: v.left + v.width / 2, y: v.top - ty + v.height / 2 }
      const fit = fitZoom(r, o, t)
      fit.cropLayout = fit.cropY / (k * fit.s)
      return fit
    }

    // Sayfanın geri kalanı pencere genişliğinde düzenlenir ve ekran genişliğine küçültülür (ölçek k).
    // Küçültme layout yüksekliğini küçültmez; fark negatif alt boşlukla kapanır, kaydırma uzunluğu doğru çıkar.
    const fitRest = () => {
      const rest = page.querySelector('.laptop__rest')
      const viewportW = document.documentElement.clientWidth
      const k = Math.min(1, page.clientWidth / viewportW) || 1
      el.style.setProperty('--rest-w', `${viewportW}px`)
      el.style.setProperty('--rest-k', k.toFixed(4))
      el.style.setProperty('--rest-gap', '0px')
      el.style.setProperty('--rest-gap', `${(-rest.offsetHeight * (1 - k)).toFixed(1)}px`)
    }

    const measure = () => {
      fitRest()
      scrollLen = Math.max(0, page.offsetHeight - page.parentElement.clientHeight)
      const fit = measureZoom(false)
      const flat = fit && measureZoom(true)
      zoomDist = fit ? ZOOM_DIST * window.innerHeight : 0 // fit yalnızca ekran ölçülemezse (jsdom) null
      if (fit) {
        scrollLen = Math.max(0, scrollLen + flat.cropLayout)
        // Dikey pencerede ekran alandan kısadır; sayfa bu boşluğa taşar (--clip), kaydırma o kadar kısalır.
        stripe = Math.max(0, -flat.cropLayout)
        el.style.setProperty('--zs', fit.s.toFixed(4))
        el.style.setProperty('--zx', `${fit.x.toFixed(1)}px`)
        el.style.setProperty('--zy', `${fit.y.toFixed(1)}px`)
        el.style.setProperty('--zs2', flat.s.toFixed(4))
        el.style.setProperty('--zx2', `${flat.x.toFixed(1)}px`)
        el.style.setProperty('--zy2', `${flat.y.toFixed(1)}px`)
      }
      el.style.setProperty('--open-dist', `${OPEN_DIST * window.innerHeight}px`)
      el.style.setProperty('--zoom-dist', `${zoomDist}px`)
      el.style.setProperty('--scroll-len', `${scrollLen}px`)
    }
    const update = () => {
      const y = -el.getBoundingClientRect().top
      const { p, z, c } = immersiveProgress(y, OPEN_DIST * window.innerHeight, zoomDist, scrollLen)
      el.style.setProperty('--z', z.toFixed(3))
      // calc() içinde var() ile overflow-clip-margin Chrome'da 0'a düşer; değer doğrudan yazılır.
      el.style.setProperty('--clip', `${(z * stripe).toFixed(1)}px`)
      const zoomed = String(z >= 1)
      if (el.dataset.zoomed !== zoomed) el.dataset.zoomed = zoomed
      el.style.setProperty('--c', c.toFixed(1))
      el.style.setProperty('--p', p.toFixed(3))
      // Zemin yarı yarıya koyulaşınca (LaptopHero.css --bg = 0.5) yazı rengi döner.
      const dark = String(p > 0.3)
      if (el.dataset.dark !== dark) el.dataset.dark = dark
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    // Kapak kapalıyken sayfa saydamdır (--on 0); klavyeyle gelen odak görünsün diye yaklaşma sonuna atlanır.
    const onFocus = (e) => {
      const end = OPEN_DIST * window.innerHeight + zoomDist
      const y = -el.getBoundingClientRect().top
      if (y < end && e.target.matches(':focus-visible')) {
        window.scrollTo({ top: window.scrollY + end - y, behavior: 'instant' })
      }
    }
    const onResize = () => {
      measure()
      onScroll()
    }

    measure()
    update()
    const observer = new ResizeObserver(onResize)
    observer.observe(page)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    el.addEventListener('focusin', onFocus)
    return () => {
      el.removeEventListener('focusin', onFocus)
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(frame)
    }
  }, [ref, enabled, pageRef])
}
