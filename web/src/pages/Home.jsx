import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import Countdown from '../components/Countdown.jsx'
import HeroShapes from '../components/HeroShapes.jsx'
import Marquee from '../components/Marquee.jsx'
import Reveal from '../components/Reveal.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import SponsorGrid from '../components/SponsorGrid.jsx'
import { event } from '../data/event.js'
import './Home.css'

export default function Home({ data = event }) {
  const about = data.about ?? []
  const prizes = data.prizes ?? []
  const sponsors = data.sponsors ?? []

  return (
    <>
      <section className="hero">
        <HeroShapes />
        <div className="hero__content container">
          <p className="hero__eyebrow">{data.theme}</p>
          <h1 className="hero__title">
            <span className="hero__light">{data.organizer}</span> <strong>{data.name}</strong>
          </h1>
          <p className="hero__tagline">{data.tagline}</p>
          <Countdown startsAt={data.startsAt} />
          <p className="hero__meta">{data.location}</p>
          <div className="hero__actions">
            <Button to="/kayit">Kayıt Ol</Button>
            <Button to="/program" variant="ghost">
              Programı Gör
            </Button>
          </div>
        </div>
      </section>

      <Marquee items={data.marquee} />

      {about.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Tanıtım" title="Neden katılmalısın?" />
          <div className="home-grid">
            {about.map((card) => (
              <Reveal key={card.title}>
                <article className={`home-card tone--${card.color}`}>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {prizes.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Ödüller" title="Kazananları bekleyen ödüller" />
          <div className="home-grid">
            {prizes.map((prize) => (
              <Reveal key={prize.title}>
                <article className={`home-card home-card--prize tone--${prize.color}`}>
                  <span className="home-card__place">{prize.place}</span>
                  <h3>{prize.title}</h3>
                  <p>{prize.description}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {sponsors.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Destekçiler" title="Sponsorlarımız" />
          <SponsorGrid sponsors={sponsors} compact />
          <p className="home-section__more">
            <Link to="/ekip">Jüri, mentor ve tüm sponsorlar</Link>
          </p>
        </section>
      )}

      <section className="closing">
        <div className="closing__inner container">
          <h2>Takımını kur, yerini ayırt.</h2>
          <p>Kontenjan sınırlı. Kayıt yaklaşık 2 dakika sürer.</p>
          <Button to="/kayit" variant="secondary">
            Kayıt Ol
          </Button>
        </div>
      </section>
    </>
  )
}
