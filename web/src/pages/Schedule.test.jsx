import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Schedule from './Schedule.jsx'
import { event, typeLabels } from '../data/event.js'
import { fixtureEvent } from '../test/fixtures.js'

describe('Schedule', () => {
  it('her gün için bir başlık ve program öğelerini gösterir', () => {
    render(<Schedule data={event} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(event.days.length)
    const first = event.days[0].items[0]
    expect(screen.getByText(first.title)).toBeInTheDocument()
    const last = event.days.at(-1).items.at(-1)
    expect(screen.getByText(last.title)).toBeInTheDocument()
  })

  it('tür etiketini Türkçe gösterir', () => {
    render(<Schedule data={fixtureEvent} />)
    expect(screen.getByText(typeLabels.workshop)).toBeInTheDocument()
  })

  it('ilk gün sekmesi seçili başlar ve sekme tıklaması seçimi değiştirir', async () => {
    const user = userEvent.setup()
    render(<Schedule data={fixtureEvent} />)
    const [firstDay, secondDay] = fixtureEvent.days
    const first = screen.getByRole('tab', { name: firstDay.label })
    const second = screen.getByRole('tab', { name: secondDay.label })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveAttribute('aria-selected', 'false')
    await user.click(second)
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
  })

  it('aynı etiketli günleri ayrı sekme olarak render eder', () => {
    const day = { label: 'Gün', date: 'x', items: [] }
    render(<Schedule data={{ days: [day, day] }} />)
    expect(screen.getAllByRole('tab')).toHaveLength(2)
  })

  it('gün yokken yedek metin gösterir', () => {
    render(<Schedule data={{ days: [] }} />)
    expect(screen.getByText('Program yakında açıklanacak.')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
