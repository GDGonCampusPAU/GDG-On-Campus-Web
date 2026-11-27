import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import VoteCard from './VoteCard.jsx'

const criteria = [
  { key: 'technical', label: 'Teknik Uygulama ve İşlevsellik' },
  { key: 'demo', label: 'Demo ve Sunum Performansı' },
]
const base = { open: true, eligible: true, canVote: true, reason: null, voted: false, current: { team: 't2', teamName: 'Beta', position: 2 }, criteria }

describe('Katılımcı oylaması', () => {
  it('değerlendirme kapalıyken görünmez', async () => {
    const load = vi.fn(async () => ({ ...base, open: false }))
    const { container } = render(<VoteCard load={load} cast={vi.fn()} onExpired={vi.fn()} />)
    await vi.waitFor(() => expect(load).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    ['NO_TEAM', /Bir takımda olmadığın için oy veremezsin/],
    ['PENDING', /kaptanın katılma isteğini henüz onaylamadı/],
    ['NOT_COMPETING', /yarışan takımlar listesinde değil/],
  ])('oy hakkı yoksa nedenini söyler: %s', async (notEligible, text) => {
    render(<VoteCard load={async () => ({ ...base, eligible: false, canVote: false, reason: 'NOT_ELIGIBLE', notEligible })} cast={vi.fn()} onExpired={vi.fn()} />)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Oyumu gönder/ })).toBeNull()
  })

  it('bütün kriterler seçilmeden gönderilemez; gönderince teşekkür eder', async () => {
    const cast = vi.fn(async () => ({}))
    render(<VoteCard load={async () => base} cast={cast} onExpired={vi.fn()} />)
    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { name: /2\. Beta için oy ver/ })).toBeInTheDocument()
    const send = screen.getByRole('button', { name: /Oyumu gönder/ })
    expect(send).toBeDisabled()
    expect(send).toHaveTextContent('2 kriter eksik')
    // İlk kriter önce 5, sonra 4 (değiştirilebilir); ikinci kriter 3.
    await user.click(screen.getAllByRole('radio', { name: '5' })[0])
    await user.click(screen.getAllByRole('radio', { name: '3' })[1])
    await user.click(screen.getAllByRole('radio', { name: '4' })[0])
    expect(send).toBeEnabled()
    await user.click(send)
    expect(cast).toHaveBeenCalledWith('t2', { technical: 4, demo: 3 })
    expect(await screen.findByText(/için oyun alındı/)).toBeInTheDocument()
  })

  it('kendi takımı sunarken ve oy verdikten sonra form göstermez', async () => {
    const { unmount } = render(<VoteCard load={async () => ({ ...base, canVote: false, reason: 'OWN_TEAM' })} cast={vi.fn()} onExpired={vi.fn()} />)
    expect(await screen.findByText(/kendi takımına oy veremezsin/)).toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    unmount()
    render(<VoteCard load={async () => ({ ...base, canVote: false, reason: 'VOTED', voted: true })} cast={vi.fn()} onExpired={vi.fn()} />)
    expect(await screen.findByText(/için oyun alındı/)).toBeInTheDocument()
  })

  it('sunucu reddederse mesajı gösterir; oturum düştüyse yeniden doğrulamaya yönlendirir', async () => {
    const onExpired = vi.fn()
    const cast = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Bu takımın oylaması kapandı ya da henüz açılmadı.'), { status: 409 }))
      .mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }))
    render(<VoteCard load={async () => base} cast={cast} onExpired={onExpired} />)
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: /Beta için oy ver/ })
    for (const radio of screen.getAllByRole('radio', { name: '4' })) await user.click(radio)
    await user.click(screen.getByRole('button', { name: 'Oyumu gönder' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('oylaması kapandı')
    await user.click(screen.getByRole('button', { name: 'Oyumu gönder' }))
    expect(onExpired).toHaveBeenCalled()
  })
})
