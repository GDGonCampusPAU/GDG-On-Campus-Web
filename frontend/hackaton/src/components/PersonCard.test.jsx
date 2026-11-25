import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    expect(screen.queryByRole('button', { name: 'Hakkında' })).not.toBeInTheDocument()
  })

  it('hakkında metni veya web bağlantısı varsa tıklanabilir olur ve modal açar', async () => {
    const user = userEvent.setup()
    render(
      <PersonCard
        person={{
          name: 'Sinan Bakış',
          title: 'Zenmira Kurucusu',
          photo: '/images/sinan-bakis.png',
          bio: 'İlk paragraf.\n\n• Madde bir\n• Madde iki',
          url: 'https://zenmira.com/',
        }}
        tone="red"
      />,
    )
    const btn = screen.getByRole('button', { name: 'Hakkında' })
    await user.click(btn)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('İlk paragraf.')
    expect(dialog).toHaveTextContent('Madde bir')
    const link = screen.getByRole('link', { name: /Web Sitesini Ziyaret Et/ })
    expect(link).toHaveAttribute('href', 'https://zenmira.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    await user.click(screen.getByRole('button', { name: 'Kapat' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
