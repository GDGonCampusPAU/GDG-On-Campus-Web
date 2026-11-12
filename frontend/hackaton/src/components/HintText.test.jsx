import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Field from './Field.jsx'
import HintText, { isSafeHref } from './HintText.jsx'
import StepForm from './StepForm.jsx'

describe('HintText', () => {
  test('renders plain text unchanged', () => {
    const { container } = render(<HintText text="Detaylı metin aşağıdadır." />)
    expect(container.textContent).toBe('Detaylı metin aşağıdadır.')
    expect(container.querySelector('a')).toBeNull()
  })

  test('turns markdown links into safe new-tab anchors and keeps surrounding text', () => {
    const { container } = render(
      <HintText text="Lütfen [KVKK Aydınlatma Metni](/kvkk) ve [Gizlilik](https://pau.edu.tr/gizlilik) sayfalarını okuyun." />,
    )
    expect(container.textContent).toBe('Lütfen KVKK Aydınlatma Metni ve Gizlilik sayfalarını okuyun.')
    const kvkk = screen.getByRole('link', { name: 'KVKK Aydınlatma Metni' })
    expect(kvkk).toHaveAttribute('href', '/kvkk')
    expect(kvkk).toHaveAttribute('target', '_blank')
    expect(kvkk).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByRole('link', { name: 'Gizlilik' })).toHaveAttribute('href', 'https://pau.edu.tr/gizlilik')
  })

  test('never links dangerous or protocol-relative targets', () => {
    for (const href of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,x', '//evil.example/x', 'evil.example']) {
      expect(isSafeHref(href)).toBe(false)
      const { container, unmount } = render(<HintText text={`[tıkla](${href})`} />)
      expect(container.querySelector('a')).toBeNull()
      expect(container.textContent).toBe(`[tıkla](${href})`)
      unmount()
    }
  })

  test('Field and StepForm checkbox hints both render the link', () => {
    render(
      <Field id="x" label="X" hint="Bkz. [metin](/kvkk)">
        <input id="x" />
      </Field>,
    )
    expect(screen.getByRole('link', { name: 'metin' })).toHaveAttribute('href', '/kvkk')

    const steps = [{
      id: 'consent', title: 'Onay', fields: [{
        id: 'kvkkConsent', label: 'KVKK onayı', kind: 'checkbox', required: 'yes',
        hint: '[KVKK Aydınlatma Metni](/kvkk)', options: [{ value: 'accepted', label: 'Kabul ediyorum' }],
      }],
    }]
    render(<StepForm steps={steps} onSubmit={() => {}} />)
    expect(screen.getByRole('link', { name: 'KVKK Aydınlatma Metni' })).toHaveAttribute('href', '/kvkk')
  })
})
