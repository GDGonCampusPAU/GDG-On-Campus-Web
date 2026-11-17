import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PersonCard from './PersonCard.jsx'

describe('PersonCard', () => {
  it('fotoğraf varsa görseli gösterir, baş harfleri göstermez', () => {
    const { container } = render(<PersonCard person={{ name: 'Ayşe Yılmaz', title: 'Unvan', photo: '/ayse.jpg' }} />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/ayse.jpg')
    expect(screen.getByRole('img', { name: 'Ayşe Yılmaz, Unvan' })).toHaveAttribute('loading', 'lazy')
    expect(screen.queryByText('AY')).not.toBeInTheDocument()
  })

  it('fotoğraf ekran okuyucuya ad ve unvanla tanıtılır, tembel yüklenir', () => {
    render(<PersonCard person={{ name: 'Ayşe Yılmaz', title: 'Jüri Üyesi', photo: '/ayse.jpg' }} />)
    const img = screen.getByRole('img', { name: 'Ayşe Yılmaz, Jüri Üyesi' })
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).toHaveAttribute('decoding', 'async')
    render(<PersonCard person={{ name: 'Mehmet Kaya', title: '', photo: '/m.jpg' }} />)
    expect(screen.getByRole('img', { name: 'Mehmet Kaya' })).toBeInTheDocument()
  })

  it('fotoğraf yoksa baş harfleri gösterir', () => {
    const { container } = render(<PersonCard person={{ name: 'Ayşe Yılmaz', title: 'Unvan', photo: null }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('AY')).toBeInTheDocument()
  })

  it('adı ve unvanı gösterir', () => {
    render(<PersonCard person={{ name: 'Ayşe Yılmaz', title: 'Mühendis', photo: null }} />)
    expect(screen.getByRole('heading', { level: 3, name: 'Ayşe Yılmaz' })).toBeInTheDocument()
    expect(screen.getByText('Mühendis')).toBeInTheDocument()
  })
})
