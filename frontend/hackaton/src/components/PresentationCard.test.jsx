import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PresentationCard from './PresentationCard.jsx'

const order = [
  { position: 1, name: 'Alfa', state: 'CLOSED' },
  { position: 2, name: 'Beta', state: 'VOTING' },
  { position: 3, name: 'Gama', state: 'WAITING' },
  { position: 4, name: 'Delta', state: 'WAITING' },
]
const open = { open: true, current: { name: 'Beta', position: 2 }, order }

describe('Sunum sırası kartı', () => {
  it('değerlendirme kapalıyken görünmez', async () => {
    const load = vi.fn(async () => ({ open: false, current: null, order: [] }))
    const { container } = render(<PresentationCard teamName="Gama" load={load} />)
    await vi.waitFor(() => expect(load).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('sunan takımı, kendi sırasını ve önündeki takım sayısını gösterir', async () => {
    render(<PresentationCard teamName="Delta" load={async () => open} />)
    expect(await screen.findByText(/Şu an sunuyor:/)).toHaveTextContent('2. Beta')
    expect(screen.getByText(/Takımınızın sırası: 4\. Önünüzde 1 takım var\./)).toBeInTheDocument()
    expect(screen.getByText('Sizin takımınız').closest('li')).toHaveTextContent('Delta')
  })

  it('sıra kendisindeyse bunu söyler; sıradaki ise hazır olmasını', async () => {
    const { unmount } = render(<PresentationCard teamName="Beta" load={async () => open} />)
    expect(await screen.findByText(/Sıra sizde!/)).toBeInTheDocument()
    unmount()
    render(<PresentationCard teamName="Gama" load={async () => open} />)
    expect(await screen.findByText(/Sıradaki takım sizsiniz/)).toBeInTheDocument()
  })
})
