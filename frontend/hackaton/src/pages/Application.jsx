import { Navigate, useLocation } from 'react-router-dom'
import Button from '../components/Button.jsx'
import './Application.css'

// Yer tutucu bölümler: içerikleri sonraki adımlarda gerçek verilerle doldurulacak.
const SECTIONS = [
  {
    id: 'team',
    tone: 'blue',
    title: 'Takım bilgisi',
    text: 'Takım adın, takımdaki rolün ve takım arkadaşların burada görünecek.',
  },
  {
    id: 'edit',
    tone: 'green',
    title: 'Bilgilerimi değiştir',
    text: 'Başvuru bilgilerini güncelleyebileceğin form yakında burada olacak.',
    action: 'Bilgilerimi düzenle',
  },
  {
    id: 'status',
    tone: 'yellow',
    title: 'Onay durumum',
    text: 'Başvurun değerlendirildiğinde sonucu ve ekibin notunu burada göreceksin.',
  },
]

const formatDate = (iso) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })
}

/** Daha önce başvurmuş, e-postası doğrulanmış katılımcının sayfası. Kayıt sayfası buraya yönlendirir. */
export default function Application() {
  const { state } = useLocation()
  const identity = state?.identity
  // Doğrulama bilgisi yalnız yönlendirmeyle gelir; doğrudan açılışta önce e-posta doğrulanmalı.
  if (!identity?.participant?.email) return <Navigate to="/kayit" replace />

  const submittedAt = state.submission?.submittedAt
  const submittedLabel = submittedAt ? formatDate(submittedAt) : null

  return (
    <div className="application container">
      <header className="application__header">
        <h1 className="application__title">Başvurum</h1>
        <p className="application__intro">
          <strong>{identity.participant.email}</strong> adresiyle bu etkinliğe zaten başvurdun. Başvurunla ilgili
          her şeyi bu sayfadan takip edebileceksin.
        </p>
        {submittedLabel && (
          <p className="application__date">
            Başvuru tarihi · <time dateTime={submittedAt}>{submittedLabel}</time>
          </p>
        )}
      </header>

      <ul className="application__grid">
        {SECTIONS.map((section) => (
          <li key={section.id} className={`application__card tone--${section.tone}`}>
            <section aria-labelledby={`application-${section.id}`}>
              <span className="application__tag">Yakında</span>
              <h2 id={`application-${section.id}`} className="application__card-title">
                {section.title}
              </h2>
              <p>{section.text}</p>
              {section.action && (
                <Button variant="ghost" disabled aria-describedby={`application-${section.id}`}>
                  {section.action}
                </Button>
              )}
            </section>
          </li>
        ))}
      </ul>

      <div className="application__actions">
        <Button to="/program">Programı Gör</Button>
        <Button to="/" variant="ghost">
          Ana sayfaya dön
        </Button>
      </div>
    </div>
  )
}
