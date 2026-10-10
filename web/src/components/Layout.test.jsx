import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Layout from './Layout.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<p>içerik</p>} />
          <Route path="kayit" element={<p>form</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout', () => {
  it('içeriği main içinde gösterir', () => {
    renderAt('/')
    expect(screen.getByRole('main')).toHaveTextContent('içerik')
  })

  it('sabit CTA ana sayfada vardır (navbar + sabit çubuk)', () => {
    renderAt('/')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(2)
  })

  it('sabit CTA /kayit sayfasında yoktur', () => {
    renderAt('/kayit')
    expect(screen.getAllByRole('link', { name: 'Kayıt Ol' })).toHaveLength(1)
  })
})
