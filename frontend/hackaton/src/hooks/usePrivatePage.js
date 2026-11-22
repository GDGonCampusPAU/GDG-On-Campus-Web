import { useLayoutEffect } from 'react'

/**
 * Arama motorlarına kapalı, dış sitelere adres sızdırmayan sayfa.
 * Üretimde ilk istekler için aynı başlıkları nginx da ekler.
 * @param {string} title
 */
export function usePrivatePage(title) {
  useLayoutEffect(() => {
    const previous = document.title
    document.title = title
    const metas = [['robots', 'noindex'], ['referrer', 'no-referrer']].map(([name, content]) => {
      const meta = document.createElement('meta')
      meta.name = name
      meta.content = content
      document.head.append(meta)
      return meta
    })
    return () => {
      document.title = previous
      metas.forEach((meta) => meta.remove())
    }
  }, [title])
}
