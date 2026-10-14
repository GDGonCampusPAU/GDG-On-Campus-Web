import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Team from './Team.jsx'
import { initials } from '../components/PersonCard.jsx'
import { event } from '../data/event.js'
import { fixtureEvent } from '../test/fixtures.js'

const renderTeam = (data) =>
  render(
    <MemoryRouter>
      <Team data={data} />
    </MemoryRouter>,
  )

describe('initials', () => {
  it('Türkçe büyük harf kuralını uygular', () => {
    expect(initials('ayşe yılmaz')).toBe('AY')
    expect(initials('ilker şahin')).toBe('İŞ')
  })

  it('tek kelime ve boş isimle çökmez', () => {
    expect(initials('Mentor')).toBe('M')
    expect(initials('   ')).toBe('?')
  })
})

describe('Team sayfası', () => {
  it('jüri, mentor ve sponsor bölümlerini gösterir', () => {
    renderTeam(fixtureEvent)
    expect(screen.getByRole('heading', { level: 2, name: 'Jüri' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Mentorlar' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Sponsorlar' })).toBeInTheDocument()
    expect(screen.getByText(fixtureEvent.people.jury[0].name)).toBeInTheDocument()
  })

  it('logosu olmayan sponsorun adını metin olarak gösterir', () => {
    renderTeam(fixtureEvent)
    expect(screen.getByText('Ana Test')).toBeInTheDocument()
  })

  it('gerçek içerikle çökmeden render eder', () => {
    renderTeam(event)
    expect(screen.getByRole('heading', { level: 1, name: 'Ekip' })).toBeInTheDocument()
  })

  it('aynı veya boş adlı kişilerin hepsini render eder', () => {
    const p = { name: '', title: 'T', photo: null }
    renderTeam({ people: { jury: [p, p], mentors: [] }, sponsors: [] })
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(2)
  })

  it('boş koleksiyonlarda boş başlık göstermez, yedek metin gösterir', () => {
    renderTeam({ people: { jury: [], mentors: [] }, sponsors: [] })
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
    expect(screen.getByText(/yakında açıklanacak/i)).toBeInTheDocument()
  })

  it('yalnızca dolu bölümü gösterir', () => {
    renderTeam({ people: { jury: [{ name: 'A B', title: 'T', photo: null }], mentors: [] }, sponsors: [] })
    expect(screen.getByRole('heading', { level: 2, name: 'Jüri' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Mentorlar' })).not.toBeInTheDocument()
  })
})
