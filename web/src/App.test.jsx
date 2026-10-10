import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from './App.jsx'

const paths = ['/', '/kayit', '/program', '/ekip']

describe('App rotaları', () => {
  it.each(paths)('%s rotası tam bir h1 render eder', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
