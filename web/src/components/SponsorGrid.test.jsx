import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SponsorGrid from './SponsorGrid.jsx'

describe('SponsorGrid', () => {
  it('url varsa yeni sekmede ve noopener noreferrer ile açılan bağlantı verir', () => {
    render(<SponsorGrid sponsors={[{ name: 'Bağlı', tier: 'main', logo: null, url: 'https://example.com/' }]} />)
    const link = screen.getByRole('link', { name: 'Bağlı' })
    expect(link).toHaveAttribute('href', 'https://example.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('url yoksa bağlantı vermez, adı metin olarak gösterir', () => {
    render(<SponsorGrid sponsors={[{ name: 'Düz', tier: 'support', logo: null, url: null }]} />)
    expect(screen.getByText('Düz')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('logo varsa ad alt metniyle görseli gösterir', () => {
    render(<SponsorGrid sponsors={[{ name: 'Logolu', tier: 'main', logo: '/logo.png', url: null }]} />)
    expect(screen.getByRole('img', { name: 'Logolu' })).toHaveAttribute('src', '/logo.png')
  })

  it('ana sponsoru destek sponsorlarının önüne alır', () => {
    render(
      <SponsorGrid
        sponsors={[
          { name: 'Destek A', tier: 'support', logo: null, url: null },
          { name: 'Ana', tier: 'main', logo: null, url: null },
          { name: 'Destek B', tier: 'support', logo: null, url: null },
        ]}
      />,
    )
    const names = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(names).toEqual(['Ana', 'Destek A', 'Destek B'])
  })

  it('aynı veya boş adlı sponsorları da hepsini render eder', () => {
    render(
      <SponsorGrid
        sponsors={[
          { name: '', tier: 'support', logo: null, url: null },
          { name: 'Aynı', tier: 'support', logo: null, url: null },
          { name: 'Aynı', tier: 'support', logo: null, url: null },
        ]}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('boş listede hiçbir şey render etmez', () => {
    const { container } = render(<SponsorGrid sponsors={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
