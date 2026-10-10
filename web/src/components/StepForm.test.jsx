import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StepForm from './StepForm.jsx'
import { fillPerson, fillUntilConfirm, acceptConsent, next } from '../test/registrationHelpers.js'

const setup = (onSubmit = vi.fn().mockResolvedValue({ ok: true })) => {
  const onSuccess = vi.fn()
  const user = userEvent.setup()
  render(<StepForm onSubmit={onSubmit} onSuccess={onSuccess} />)
  return { user, onSubmit, onSuccess }
}

describe('StepForm', () => {
  it('ilk adımda Kişisel bilgiler başlığını gösterir', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Kişisel bilgiler' })).toBeInTheDocument()
  })

  it('zorunlu alan boşken ilerlemez ve hata gösterir', async () => {
    const { user } = setup()
    await next(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Kişisel bilgiler' })).toBeInTheDocument()
    expect(screen.getByText('Ad ve soyadını yaz.')).toBeInTheDocument()
    expect(screen.getByLabelText('Ad soyad')).toHaveAttribute('aria-invalid', 'true')
  })

  it('geri dönüldüğünde girilen veri korunur', async () => {
    const { user } = setup()
    await fillPerson(user)
    await next(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Takım' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Geri' }))
    expect(screen.getByLabelText('Ad soyad')).toHaveValue('Ayşe Yılmaz')
    expect(screen.getByLabelText('Sınıf')).toHaveValue('2')
  })

  it('onay verilmeden gönderilmez', async () => {
    const { user, onSubmit } = setup()
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    expect(screen.getByText('Devam etmek için onay vermelisin.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('tüm adımlar tamamlanınca gönderir ve onSuccess çağırır', async () => {
    const { user, onSubmit, onSuccess } = setup()
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ fullName: 'Ayşe Yılmaz', consent: true })
  })

  it('sunucu hatasında mesaj ve "Tekrar dene" gösterir, veriyi korur, sonra başarır', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'Sunucu hatası (500). Biraz sonra tekrar dene.' })
      .mockResolvedValueOnce({ ok: true })
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sunucu hatası (500)')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/katılım koşullarını/i)).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('Gönder butonuna çift tıklamada tek istek atar', async () => {
    let resolve
    const onSubmit = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    await acceptConsent(user)
    await user.dblClick(screen.getByRole('button', { name: 'Gönder' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)

    resolve({ ok: true })
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })
})
