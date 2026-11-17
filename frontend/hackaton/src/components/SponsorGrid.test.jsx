import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(screen.getByRole('img', { name: 'Logolu' })).toHaveAttribute('loading', 'lazy')
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

  it('ana sponsora tıklayınca kanatlanıp uçar, kendi animasyonu bitince iner; destek sponsor etkilenmez', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <SponsorGrid
        sponsors={[
          { name: 'Ana', tier: 'main', logo: null, url: null },
          { name: 'Destek', tier: 'support', logo: null, url: null },
        ]}
      />,
    )
    const main = screen.getByText('Ana').closest('.sponsor')
    const wings = () => container.querySelectorAll('.sponsor__wing')
    // jsdom has no AnimationEvent, so React listens for the webkit-prefixed name and ignores fireEvent.animationEnd
    const animationEnd = (el) => fireEvent(el, new Event('webkitAnimationEnd', { bubbles: true }))

    await user.click(screen.getByText('Destek'))
    expect(container.querySelector('.is-flying')).toBeNull()
    expect(wings()).toHaveLength(0)

    await user.click(screen.getByText('Ana'))
    expect(main).toHaveClass('is-flying')
    expect(wings()).toHaveLength(2)

    animationEnd(wings()[0])
    expect(main).toHaveClass('is-flying')

    animationEnd(main)
    expect(main).not.toHaveClass('is-flying')
    expect(wings()).toHaveLength(0)
  })

  it('boş listede hiçbir şey render etmez', () => {
    const { container } = render(<SponsorGrid sponsors={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
