import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import HeroShapes from './HeroShapes.jsx'
import Marquee from './Marquee.jsx'
import Reveal from './Reveal.jsx'

describe('HeroShapes', () => {
  it('4 marka şeklini dekoratif olarak render eder', () => {
    const { container } = render(
      <section>
        <HeroShapes />
      </section>,
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    const shapes = [...container.querySelectorAll('[data-shape]')].map((n) => n.dataset.shape)
    expect(shapes).toEqual(['circle', 'square', 'triangle', 'half'])
  })
})

describe('Marquee', () => {
  it('öğeleri dört kez (kesintisiz döngü için) ve ekran okuyucudan gizli render eder', () => {
    const { container } = render(<Marquee items={['Kodla', 'Tasarla']} />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getAllByText('Kodla', { ignore: 'none' })).toHaveLength(4)
    expect(screen.getAllByText('Tasarla', { ignore: 'none' })).toHaveLength(4)
  })

  it('boş listede hiçbir şey render etmez', () => {
    const { container } = render(<Marquee items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('Reveal', () => {
  it('IntersectionObserver yokken içeriği hemen görünür yapar', () => {
    const { container } = render(
      <Reveal>
        <p>kart</p>
      </Reveal>,
    )
    expect(screen.getByText('kart')).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('is-visible')
  })
})
