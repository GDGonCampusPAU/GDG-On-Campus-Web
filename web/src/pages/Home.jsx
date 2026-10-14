import { Link } from 'react-router-dom'
import Button from '../components/Button.jsx'
import LaptopHero from '../components/LaptopHero.jsx'
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
    <LaptopHero data={data}>
      <Marquee items={data.marquee} />

      {about.length > 0 && (
        <section className="home-section container">
          <SectionHeading eyebrow="Tanıtım" title="Neden katılmalısın?" />
          <div className="home-grid">
            {about.map((card, i) => (
              <Reveal key={i}>
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
            {prizes.map((prize, i) => (
              <Reveal key={i}>
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
    </LaptopHero>
  )
}
