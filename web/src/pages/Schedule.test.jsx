import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Schedule from './Schedule.jsx'
import { event } from '../data/event.js'

describe('Schedule', () => {
  it('her gün için bir başlık ve program öğelerini gösterir', () => {
    render(<Schedule data={event} />)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(event.days.length)
    expect(screen.getByText('Açılış ve tanışma')).toBeInTheDocument()
    expect(screen.getByText('Ödül töreni')).toBeInTheDocument()
  })

  it('tür etiketini Türkçe gösterir', () => {
    render(<Schedule data={event} />)
    expect(screen.getAllByText('Workshop').length).toBeGreaterThan(0)
  })

  it('ilk gün sekmesi seçili başlar ve sekme tıklaması seçimi değiştirir', async () => {
    const user = userEvent.setup()
    render(<Schedule data={event} />)
    const first = screen.getByRole('tab', { name: '1. Gün' })
    const second = screen.getByRole('tab', { name: '2. Gün' })
    expect(first).toHaveAttribute('aria-selected', 'true')
    expect(second).toHaveAttribute('aria-selected', 'false')
    await user.click(second)
    expect(second).toHaveAttribute('aria-selected', 'true')
    expect(first).toHaveAttribute('aria-selected', 'false')
  })

  it('gün yokken yedek metin gösterir', () => {
    render(<Schedule data={{ days: [] }} />)
    expect(screen.getByText('Program yakında açıklanacak.')).toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
  })
})
