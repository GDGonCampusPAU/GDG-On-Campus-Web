import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StepForm from './StepForm.jsx'
import { normalize, validateStep } from '../lib/registration.js'

const teamField = {
  id: 'team',
  label: 'Nasıl katılacaksın?',
  kind: 'team',
  required: 'yes',
  hint: 'Takımlar en fazla 4 kişi.',
  options: [
    { value: 'create', label: 'Takım kur' },
    { value: 'join', label: 'Takıma katıl' },
  ],
}
const steps = [{ title: 'Takım durumu', fields: [teamField] }]

const setup = ({ lookupTeam, onSubmit = vi.fn().mockResolvedValue({ ok: true }) } = {}) => {
  const user = userEvent.setup()
  render(<StepForm steps={steps} onSubmit={onSubmit} lookupTeam={lookupTeam} />)
  return { user, onSubmit }
}
const next = (user) => user.click(screen.getByRole('button', { name: 'İleri' }))
const send = (user) => user.click(screen.getByRole('button', { name: 'Gönder' }))

describe('Takım alanı', () => {
  it('bireysel seçenek yoktur; doğrudan kur / katıl sorulur, seçmeden ilerlenemez', async () => {
    const { user } = setup()
    expect(screen.getAllByRole('radio').map((r) => r.closest('label').textContent)).toEqual(['Takım kur', 'Takıma katıl'])
    expect(screen.queryByText(/Bireysel/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Takım adı')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Takım kodu')).not.toBeInTheDocument()
    await next(user)
    expect(screen.getByText('Takım kur ya da bir takıma katıl.')).toBeInTheDocument()
  })

  it('admin metinlerini kullanır; seçenekleri olmayan (eski) alanda varsayılan metinler çıkar', () => {
    const custom = { ...teamField, options: [{ value: 'create', label: 'Yeni takım aç' }, { value: 'join', label: 'Koda katıl' }] }
    const { unmount } = render(<StepForm steps={[{ title: 'T', fields: [custom] }]} onSubmit={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Yeni takım aç' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Koda katıl' })).toBeInTheDocument()
    unmount()
    const legacy = { ...teamField, options: [{ value: 'solo', label: 'Bireysel' }, { value: 'team', label: 'Takımla' }] }
    render(<StepForm steps={[{ title: 'T', fields: [legacy] }]} onSubmit={vi.fn()} />)
    expect(screen.getAllByRole('radio').map((r) => r.closest('label').textContent)).toEqual(['Takım kur', 'Takıma katıl'])
  })

  it('eski taslaktaki bireysel seçim seçilmemiş sayılır, gönderilemez', async () => {
    const user = userEvent.setup()
    render(<StepForm steps={steps} onSubmit={vi.fn()} initialData={{ team: { mode: 'solo' } }} />)
    expect(screen.getAllByRole('radio').every((r) => !r.checked)).toBe(true)
    await next(user)
    expect(screen.getByText('Takım kur ya da bir takıma katıl.')).toBeInTheDocument()
  })

  it('takım oluşturmada ad istenir, kısa ad reddedilir, ad sadeleştirilerek gönderilir', async () => {
    const { user, onSubmit } = setup()
    await user.click(screen.getByRole('radio', { name: 'Takım kur' }))
    await user.type(screen.getByLabelText('Takım adı'), 'K')
    await next(user)
    expect(screen.getByText('Takım adı 2-40 karakter olmalı.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Takım adı'), 'od   Kurtları ')
    await next(user)
    expect(screen.getByText('Takım kuracak: Kod Kurtları')).toBeInTheDocument()
    await send(user)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ team: { mode: 'create', name: 'Kod Kurtları' } }))
  })

  it('takıma katılmada kod büyük harfe çevrilir, takım önizlenir ve kod gönderilir', async () => {
    const lookupTeam = vi.fn().mockResolvedValue({ name: 'Yıldızlar', size: 2, maxSize: 4, full: false })
    const { user, onSubmit } = setup({ lookupTeam })
    await user.click(screen.getByRole('radio', { name: 'Takıma katıl' }))
    const input = screen.getByLabelText('Takım kodu')
    await user.type(input, 'ab-12 cd9')
    expect(input).toHaveValue('AB12CD')
    expect(await screen.findByText(/Yıldızlar takımına katılma isteği göndereceksin \(2\/4 kişi\)/)).toBeInTheDocument()
    expect(lookupTeam).toHaveBeenLastCalledWith('AB12CD')
    await next(user)
    expect(screen.getByText('Takıma katılacak · kod AB12CD')).toBeInTheDocument()
    await send(user)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ team: { mode: 'join', code: 'AB12CD' } }))
  })

  it('eksik kod ilerletmez; bulunamayan ve dolu takımlar açıkça söylenir', async () => {
    const lookupTeam = vi.fn(async (code) => {
      if (code === 'FULL11') return { name: 'Dolu Ekip', size: 4, maxSize: 4, full: true }
      throw Object.assign(new Error('yok'), { status: 404 })
    })
    const { user } = setup({ lookupTeam })
    await user.click(screen.getByRole('radio', { name: 'Takıma katıl' }))
    const input = screen.getByLabelText('Takım kodu')
    await user.type(input, 'AB1')
    expect(lookupTeam).not.toHaveBeenCalled()
    await next(user)
    expect(screen.getByText('Takım kodu 6 harf ve rakamdan oluşur.')).toBeInTheDocument()
    await user.type(input, 'XYZ')
    expect(await screen.findByText(/Bu kodla bir takım bulunamadı/)).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'full11')
    expect(await screen.findByText(/Dolu Ekip takımı dolu \(4\/4 kişi\)/)).toBeInTheDocument()
  })

  it('normalize yalnız seçili moda ait anahtarları bırakır', () => {
    const v = (team) => normalize(steps, { team }).team
    expect(v({ mode: 'create', name: '  A  B ', code: 'XX' })).toEqual({ mode: 'create', name: 'A B' })
    expect(v({ mode: 'join', code: ' ab12cd ', name: 'eski' })).toEqual({ mode: 'join', code: 'AB12CD' })
    expect(v({ mode: 'solo', name: 'x' })).toEqual({ mode: '' })
    expect(v({ mode: 'team' })).toEqual({ mode: '' })
    expect(v(undefined)).toEqual({ mode: '' })
    expect(validateStep(steps[0], { team: { mode: 'join', code: 'AB12CD' } })).toEqual({})
  })
})
