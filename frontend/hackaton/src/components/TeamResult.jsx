import { useState } from 'react'
import Button from './Button.jsx'
import './TeamResult.css'

/**
 * Başvuru sonrası takım kartı: kaptana paylaşılacak kodu, katılan kişiye onay beklendiğini gösterir.
 * @param {{ team: { name: string, role: 'CAPTAIN' | 'MEMBER', status?: string, code?: string } }} props
 */
export default function TeamResult({ team }) {
  const [copied, setCopied] = useState(/** @type {'' | 'ok' | 'fail'} */ (''))

  if (team.role === 'CAPTAIN' && team.code) {
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(team.code)
        setCopied('ok')
      } catch {
        setCopied('fail')
      }
    }
    return (
      <section className="team-result tone--yellow" aria-labelledby="team-result-title">
        <h3 id="team-result-title" className="team-result__title">
          <strong>{team.name}</strong> takımın kuruldu
        </h3>
        <p className="team-result__label" id="team-result-code-label">Takım kodun</p>
        <p className="team-result__code" aria-labelledby="team-result-code-label">{team.code}</p>
        <p>
          Bu kodu takım arkadaşlarınla paylaş. Kayıt olurken <em>Takımla katılacağım → Takıma katıl</em> seçip bu kodu
          girsinler; katılma istekleri senin onayına düşecek.
        </p>
        <Button variant="ghost" onClick={copy}>
          Kodu kopyala
        </Button>
        <p className="team-result__copied" role="status">
          {copied === 'ok' ? 'Kod kopyalandı.' : copied === 'fail' ? 'Kopyalanamadı; kodu elle not al.' : ''}
        </p>
      </section>
    )
  }

  return (
    <section className="team-result tone--blue" aria-labelledby="team-result-title">
      <h3 id="team-result-title" className="team-result__title">
        <strong>{team.name}</strong> takımına katılma isteğin gönderildi
      </h3>
      <p>Takım kaptanının onaylaması bekleniyor, haber vermek isteyebilirsin :)</p>
    </section>
  )
}
