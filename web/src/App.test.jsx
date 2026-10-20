import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

const paths = ['/', '/kayit', '/program', '/ekip']

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App rotaları', () => {
  it.each(paths)('%s rotası tam bir h1 render eder', (path) => {
    renderAt(path)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('bilinmeyen rota 404 sayfası gösterir', () => {
    renderAt('/yok-boyle-bir-sayfa')
    expect(screen.getByRole('heading', { level: 1, name: 'Sayfa bulunamadı' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ana sayfaya dön' })).toHaveAttribute('href', '/')
  })
})
