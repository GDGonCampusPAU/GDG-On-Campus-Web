// Router içinde render: sayfalar Link/NavLink kullandığı için testlerde MemoryRouter gerekir.
import { render as rtlRender } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

export function render(ui, { route = '/', ...options } = {}) {
  return rtlRender(ui, {
    wrapper: ({ children }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>,
    ...options,
  })
}
