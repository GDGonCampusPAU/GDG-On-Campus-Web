import { useState } from 'react'
import Button from './Button.jsx'

/** Tarayıcıyı başka adrese götürür; testte yerine sahte işlev verilir (jsdom'da location değiştirilemez). */
const navigate = (url) => window.location.assign(url)

/**
 * "Başvurum" sayfasındaki Proje Yükleme kartı. Onaylı takım üyesi butona basınca backend 24 saatlik bir
 * giriş anahtarı üretir ve kişi proje sitesine (proje.gdgocpamukkale.com) geçer; o gün içinde siteye
 * doğrudan girince de aynı sayfa açılır. Takımın linki ortaktır: bir üyenin eklediğini herkes görür.
 * @param {object} props
 * @param {null | { status: string }} props.team
 * @param {boolean} props.open Yönetici proje yüklemeyi kapattıysa false: site yalnız görüntüleme için açılır.
 * @param {() => Promise<{ url: string }>} props.start
 * @param {() => void} props.onExpired
 * @param {(url: string) => void} [props.go]
 */
export default function ProjectUploadCard({ team, open, start, onExpired, go = navigate }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = team?.status === 'APPROVED'

  const openSite = async () => {
    setBusy(true)
    setError('')
    try {
      const { url } = await start()
      go(url)
    } catch (e) {
      if (e?.status === 401) onExpired()
      else setError(e?.message || 'Proje sayfası açılamadı. Tekrar dene.')
      setBusy(false)
    }
  }

  let text
  if (!team) text = 'Proje yüklemek için önce bir takım kurmalı ya da bir takıma katılmalısın.'
  else if (!ready) text = 'Kaptanın katılma isteğini onaylayınca takımının projesini buradan yükleyebilirsin.'
  else if (!open) text = 'Proje yükleme kapatıldı. Takımının GitHub linkini ve commit geçmişini görüntüleyebilirsin.'
  else text = 'Takımının GitHub proje linkini ekle; commitlerini anlık takip et. Link takımındaki herkes için ortaktır.'

  return (
    <li className="application__card tone--green">
      <section aria-labelledby="application-project">
        <span className="application__tag">Projem</span>
        <h2 id="application-project" className="application__card-title">Proje Yükleme</h2>
        <p>{text}</p>
        {ready && (
          <Button onClick={openSite} disabled={busy}>
            {busy ? 'Açılıyor…' : open ? 'Proje Yükleme' : 'Projemi gör'}
          </Button>
        )}
        <p className="application__note" role="alert" hidden={!error}>
          {error}
        </p>
      </section>
    </li>
  )
}
