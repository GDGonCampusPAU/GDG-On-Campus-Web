import { useState } from 'react'
import PersonCard, { PersonModal } from '../components/PersonCard.jsx'
import SponsorGrid from '../components/SponsorGrid.jsx'
import SectionHeading from '../components/SectionHeading.jsx'
import Reveal from '../components/Reveal.jsx'
import { useEvent } from '../context/EventContext.jsx'
import './Team.css'

const TONES = ['blue', 'red', 'yellow', 'green']

function PeopleSection({ title, eyebrow, people, onSelect }) {
  if (!people || people.length === 0) return null
  return (
    <section className="team__section">
      <SectionHeading eyebrow={eyebrow} title={title} />
      <div className="team__grid">
        {people.map((p, i) => (
          <Reveal key={i}>
            <PersonCard person={p} tone={TONES[i % TONES.length]} onSelect={onSelect} />
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/** @param {{ data?: any }} props Testler için isteğe bağlı veri; verilmezse useEvent() kullanılır. */
export default function Team({ data: dataProp }) {
  const { event } = useEvent()
  const data = dataProp ?? event
  const jury = data.people?.jury ?? []
  const sponsors = data.sponsors ?? []
  const empty = jury.length === 0 && sponsors.length === 0
  const [selected, setSelected] = useState(null)

  return (
    <div className="team container">
      <h1 className="team__title">Ekip</h1>
      {empty && <p>Jüri ve sponsor bilgileri yakında açıklanacak.</p>}
      <PeopleSection
        eyebrow="Değerlendirenler"
        title="Jüri"
        people={jury}
        onSelect={(person, tone) => setSelected({ person, tone })}
      />
      {sponsors.length > 0 && (
        <section className="team__section">
          <SectionHeading eyebrow="Bize güvenenler" title="Sponsorlar" />
          <SponsorGrid sponsors={sponsors} />
        </section>
      )}
      <PersonModal
        person={selected?.person}
        tone={selected?.tone}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}
