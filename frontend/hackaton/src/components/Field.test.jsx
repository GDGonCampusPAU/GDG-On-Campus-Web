import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import Field from './Field.jsx'
import StickyCta from './StickyCta.jsx'

describe('Field and StickyCta components', () => {
  test('Field wires label, hint, required class and error status attributes', () => {
    const { container } = render(
      <Field id="team" label="Takım Adı" hint="En fazla 4 kişi" error="Bu alan zorunlu" required>
        <input id="team" type="text" />
      </Field>,
    )
    expect(container.firstChild).toHaveClass('field--required', 'field--invalid')
    expect(screen.getByLabelText('Takım Adı')).toBeInTheDocument()
    expect(document.getElementById('team-hint')).toHaveTextContent('En fazla 4 kişi')
    expect(document.getElementById('team-error')).toHaveTextContent('Bu alan zorunlu')
  })

  test('StickyCta renders registration call to action link', () => {
    render(
      <MemoryRouter>
        <StickyCta />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: 'Kayıt Ol' })).toHaveAttribute('href', '/kayit')
  })
})

