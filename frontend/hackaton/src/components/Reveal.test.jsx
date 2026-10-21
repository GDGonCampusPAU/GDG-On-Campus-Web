import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Reveal from './Reveal.jsx'

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
