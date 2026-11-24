import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import ProjectUploadCard from './ProjectUploadCard.jsx'

const setup = (props = {}) => {
  const go = vi.fn()
  const onExpired = vi.fn()
  const start = vi.fn().mockResolvedValue({ url: 'https://proje.example.com/#t=abc' })
  render(<ul><ProjectUploadCard team={{ status: 'APPROVED' }} open start={start} onExpired={onExpired} go={go} {...props} /></ul>)
  return { go, onExpired, start, user: userEvent.setup() }
}

describe('Proje Yükleme kartı', () => {
  it('onaylı üye butona basınca anahtar alınır ve proje sitesine geçilir', async () => {
    const { go, start, user } = setup()
    await user.click(screen.getByRole('button', { name: 'Proje Yükleme' }))
    expect(start).toHaveBeenCalledTimes(1)
    expect(go).toHaveBeenCalledWith('https://proje.example.com/#t=abc')
  })

  it('takımı olmayan ve onay bekleyen için buton yok, ne yapacağı yazar', () => {
    const { unmount } = render(<ul><ProjectUploadCard team={null} open start={vi.fn()} onExpired={vi.fn()} /></ul>)
    expect(screen.getByText(/önce bir takım kurmalı/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    unmount()
    render(<ul><ProjectUploadCard team={{ status: 'PENDING' }} open start={vi.fn()} onExpired={vi.fn()} /></ul>)
    expect(screen.getByText(/Kaptanın katılma isteğini onaylayınca/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('yükleme kapalıyken site yalnız görüntüleme için açılır', () => {
    setup({ open: false })
    expect(screen.getByText(/Proje yükleme kapatıldı/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Projemi gör' })).toBeInTheDocument()
  })

  it('hata mesajı gösterilir; oturum düştüyse yeniden doğrulamaya yönlendirilir', async () => {
    const start = vi.fn().mockRejectedValueOnce(Object.assign(new Error('Proje yükleme şu an kullanılamıyor.'), { status: 503 }))
    const { go, onExpired, user } = setup({ start })
    await user.click(screen.getByRole('button', { name: 'Proje Yükleme' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Proje yükleme şu an kullanılamıyor.')
    expect(go).not.toHaveBeenCalled()
    start.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }))
    await user.click(screen.getByRole('button', { name: 'Proje Yükleme' }))
    expect(onExpired).toHaveBeenCalled()
  })
})
