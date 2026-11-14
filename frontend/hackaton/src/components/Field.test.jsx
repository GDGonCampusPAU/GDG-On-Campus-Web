import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import Field, { Hint } from './Field.jsx'
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


describe('Hint links', () => {
  test('turns https and same-site Markdown links into anchors and leaves other schemes as text', () => {
    render(<Hint id="kvkk" text={'Lütfen [KVKK Aydınlatma Metni](https://example.org/kvkk) ve [SSS](/sss) okuyun. [kötü](javascript:alert(1)) [dış](//evil.test) [ters](/\\evil.test)'} />)
    expect(screen.getByRole('link', { name: 'KVKK Aydınlatma Metni' })).toHaveAttribute('href', 'https://example.org/kvkk')
    expect(screen.getByRole('link', { name: 'SSS' })).toHaveAttribute('href', '/sss')
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(document.getElementById('kvkk-hint')).toHaveTextContent('Lütfen KVKK Aydınlatma Metni ve SSS okuyun. [kötü](javascript:alert(1)) [dış](//evil.test) [ters](/\\evil.test)')
  })
})
