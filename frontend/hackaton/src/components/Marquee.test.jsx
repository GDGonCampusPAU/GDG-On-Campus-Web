import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Marquee from './Marquee.jsx'

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
