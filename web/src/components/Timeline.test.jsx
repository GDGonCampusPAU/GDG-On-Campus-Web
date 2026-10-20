import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Timeline from './Timeline.jsx'
import { typeLabels } from '../data/event.js'

const item = (over) => ({ time: '09:00', title: 'Başlık', description: 'açıklama', type: 'opening', ...over })

describe('Timeline', () => {
  it('bilinen türün Türkçe etiketini ve rengini kullanır', () => {
    const { container } = render(<Timeline items={[item({ type: 'workshop' })]} />)
    expect(screen.getByText(typeLabels.workshop)).toBeInTheDocument()
    expect(container.querySelector('li')).toHaveClass('tone--green')
  })

  it('bilinmeyen türde ham tür adını etiket, mavi tonu yedek olarak kullanır', () => {
    const { container } = render(<Timeline items={[item({ type: 'bilinmeyen-tur' })]} />)
    expect(screen.getByText('bilinmeyen-tur')).toBeInTheDocument()
    expect(container.querySelector('li')).toHaveClass('tone--blue')
  })

  it('aynı saat ve başlıklı öğelerin hepsini render eder', () => {
    render(<Timeline items={[item(), item()]} />)
    expect(screen.getAllByRole('heading', { level: 3, name: 'Başlık' })).toHaveLength(2)
  })
})
