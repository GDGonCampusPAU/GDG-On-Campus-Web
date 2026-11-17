import { useEffect } from 'react'

// Açık sekmede bakım modunun açıldığını fark eder. Site tek sayfalık uygulama olduğundan sayfalar arası gezinme
// sunucuya gitmez; bakım açılınca kullanıcı yenileyene kadar eski sayfada kalırdı. Bakım açıkken nginx (ve Vite
// geliştirme sunucusu) her sayfa isteğine 503 + bakım sayfası döner; o anda sayfa yenilenir ve bakım ekranı gelir.
// Kayıt formu taslağı cihazda tutulduğu için yenileme yazılanları kaybettirmez. Bakımdan çıkışı bakım sayfası
// kendisi izler (public/maintenance.html).
export const MAINTENANCE_POLL_MS = 10000

const reload = () => window.location.reload()

/** @param {{ interval?: number, onMaintenance?: () => void }} [options] */
export function useMaintenanceWatch({ interval = MAINTENANCE_POLL_MS, onMaintenance = reload } = {}) {
  useEffect(() => {
    if (typeof fetch !== 'function') return undefined
    let busy = false
    const check = async () => {
      // Arka plandaki sekme istek atmaz; sekmeye dönülünce hemen bakılır.
      if (busy || document.visibilityState !== 'visible') return
      busy = true
      try {
        const response = await fetch('/', { method: 'HEAD', cache: 'no-store' })
        // Yalnız 503 bakım demektir; deploy sırasındaki kısa 502 ya da ağ hatası yok sayılır.
        if (response.status === 503) onMaintenance()
      } catch {
        /* çevrimdışı ya da sunucu yeniden başlıyor: bir sonraki turda tekrar bakılır */
      } finally {
        busy = false
      }
    }
    const timer = setInterval(check, interval)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [interval, onMaintenance])
}
