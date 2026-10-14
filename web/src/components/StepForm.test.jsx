import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import StepForm from './StepForm.jsx'
import { fillPerson, fillUntilConfirm, next } from '../test/registrationHelpers.js'

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

  it('tüm adımlar tamamlanınca gönderir ve onSuccess çağırır', async () => {
    const { user, onSubmit, onSuccess } = setup()
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit.mock.calls[0][0]).toEqual({
      fullName: 'Ayşe Yılmaz',
      email: 'ayse@example.com',
      phone: '0555 123 45 67',
      department: 'Bilgisayar Mühendisliği',
      year: '2',
      teamName: 'Kod Kurtları',
      teamRole: 'founder',
      teammates: '',
      interests: ['web'],
      level: 'beginner',
    })
  })

  it('sunucu hatasında mesaj ve "Tekrar dene" gösterir, veriyi korur, sonra başarır', async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'Sunucu hatası (500). Biraz sonra tekrar dene.' })
      .mockResolvedValueOnce({ ok: true })
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sunucu hatası (500)')
    expect(onSuccess).not.toHaveBeenCalled()
    expect(screen.getByText('Ayşe Yılmaz')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('onSubmit reddedilirse yedek mesaj gösterir, "Tekrar dene" ile yeniden denenebilir', async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error('patladı'))
      .mockResolvedValueOnce({ ok: true })
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bir şeyler ters gitti. Tekrar dene.')
    expect(onSuccess).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })

  it('Takım arıyorum rolünde takım adı boş bırakılıp ilerlenebilir', async () => {
    const { user } = setup()
    await fillPerson(user)
    await next(user)
    await user.selectOptions(screen.getByLabelText('Rol'), 'looking')
    expect(screen.getByText('Takım arıyorsan boş bırakabilirsin.')).toBeInTheDocument()
    expect(screen.getByLabelText('Takım adı')).toHaveAttribute('aria-describedby', 'teamName-hint')
    await next(user)
    expect(screen.getByRole('heading', { level: 2, name: 'İlgi alanları' })).toBeInTheDocument()
  })

  it('aynı anda gelen iki submit olayında tek istek atar', async () => {
    let resolve
    const onSubmit = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    const { user, onSuccess } = setup(onSubmit)
    await fillUntilConfirm(user)
    const form = screen.getByRole('button', { name: 'Gönder' }).closest('form')
    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    expect(onSubmit).toHaveBeenCalledTimes(1)

    await act(async () => resolve({ ok: true }))
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1))
  })

  it('İleri sonrası odak yeni adımın başlığına gider', async () => {
    const { user } = setup()
    await fillPerson(user)
    await next(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Takım' })).toHaveFocus()
  })

  it('başarısız İleri odağı ilk geçersiz alana taşır', async () => {
    const { user } = setup()
    await next(user)
    expect(screen.getByLabelText('Ad soyad')).toHaveFocus()
  })

  it('StrictMode altında ilk açılışta odağı başlığa taşımaz', () => {
    render(
      <StrictMode>
        <StepForm onSubmit={vi.fn()} onSuccess={vi.fn()} />
      </StrictMode>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Kişisel bilgiler' })).not.toHaveFocus()
  })
})
