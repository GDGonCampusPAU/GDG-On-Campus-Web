import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import Application from './Application.jsx'

const renderAt = (state) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/basvurum', state }]}>
      <Routes>
        <Route path="/basvurum" element={<Application />} />
        <Route path="/kayit" element={<h1>Kayıt sayfası</h1>} />
      </Routes>
    </MemoryRouter>,
  )

const identity = { token: 't', participant: { email: 'ayse@example.com' } }

describe('Başvurum sayfası', () => {
  it('doğrulama bilgisi olmadan açılırsa kayıt sayfasına yönlendirir', () => {
    renderAt(undefined)
    expect(screen.getByRole('heading', { name: 'Kayıt sayfası' })).toBeInTheDocument()
  })

  it('e-postayı, başvuru tarihini ve üç yer tutucu bölümü gösterir', () => {
    renderAt({ identity, submission: { submitted: true, status: 'PENDING', submittedAt: '2026-11-14T10:30:00.000Z' } })
    expect(screen.getByRole('heading', { level: 1, name: 'Başvurum' })).toBeInTheDocument()
    expect(screen.getByText('ayse@example.com')).toBeInTheDocument()
    expect(screen.getByText(/14 Kasım 2026/)).toHaveAttribute('datetime', '2026-11-14T10:30:00.000Z')

    for (const title of ['Takım bilgisi', 'Bilgilerimi değiştir', 'Onay durumum']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument()
    }
    expect(screen.getAllByText('Yakında')).toHaveLength(3)
    // Düzenleme henüz yok: düğme görünür ama devre dışı.
    expect(screen.getByRole('button', { name: 'Bilgilerimi düzenle' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Programı Gör' })).toHaveAttribute('href', '/program')
  })

  it('tarih yoksa veya geçersizse tarihsiz açıklama gösterir', () => {
    renderAt({ identity, submission: { submitted: true, submittedAt: 'geçersiz' } })
    expect(screen.queryByRole('time')).not.toBeInTheDocument()
    expect(document.querySelector('time')).toBeNull()
    expect(screen.getByText(/zaten başvurdun/)).toBeInTheDocument()
  })
})
