import { useEffect, useRef, useState } from 'react'

function shouldShowImmediately() {
  return (
    typeof IntersectionObserver === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(shouldShowImmediately)

  useEffect(() => {
    if (visible) return undefined
    const el = ref.current
    if (!el) return undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return [ref, visible]
}
