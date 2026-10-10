import { useEffect } from 'react'

export function useParallax(ref) {
  useEffect(() => {
    const el = ref.current
    const host = el?.parentElement
    if (!el || !host) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    let frame = 0
    const onMove = (e) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = host.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        el.style.setProperty('--px', (x * 2).toFixed(3))
        el.style.setProperty('--py', (y * 2).toFixed(3))
      })
    }

    host.addEventListener('pointermove', onMove)
    return () => {
      host.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
