import PersonCard from '../components/PersonCard.jsx'
import SponsorGrid from '../components/SponsorGrid.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import Reveal from '../components/Reveal.jsx'
import { event } from '../data/event.js'
import './Team.css'

const TONES = ['blue', 'red', 'yellow', 'green']

function PeopleSection({ title, eyebrow, people }) {
  if (!people || people.length === 0) return null
  return (
    <section className="team__section">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="team__grid">
        {people.map((p, i) => (
          <Reveal key={i}>
            <PersonCard person={p} tone={TONES[i % TONES.length]} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export default function Team({ data = event }) {
  const jury = data.people?.jury ?? []
  const mentors = data.people?.mentors ?? []
  const sponsors = data.sponsors ?? []
  const empty = jury.length === 0 && mentors.length === 0 && sponsors.length === 0

  return (
    <div className="team container">
      <h1 className="team__title">Ekip</h1>
      {empty && <p>Jüri, mentor ve sponsor bilgileri yakında açıklanacak.</p>}
      <PeopleSection eyebrow="Değerlendirenler" title="Jüri" people={jury} />
      <PeopleSection eyebrow="Yanında olanlar" title="Mentorlar" people={mentors} />
      {sponsors.length > 0 && (
        <section className="team__section">
          <SectionHeading eyebrow="Bize güvenenler" title="Sponsorlar" />
          <SponsorGrid sponsors={sponsors} />
        </section>
      )}
    </div>
  )
}
