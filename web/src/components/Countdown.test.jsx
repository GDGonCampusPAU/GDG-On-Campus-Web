import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import Countdown, { getTimeLeft } from './Countdown.jsx'

afterEach(() => vi.useRealTimers())

describe('getTimeLeft', () => {
  const base = new Date('2026-12-01T00:00:00Z').getTime()

  it('kalan süreyi gün/saat/dakika/saniyeye böler', () => {
    const startsAt = '2026-12-02T02:03:04Z'
    expect(getTimeLeft(startsAt, base)).toEqual({
      status: 'counting',
      days: 1,
      hours: 2,
      minutes: 3,
      seconds: 4,
    })
  })

  it('tarih geçmişse started döner', () => {
    expect(getTimeLeft('2026-11-30T00:00:00Z', base)).toEqual({ status: 'started' })
  })

  it('tam şu an started döner', () => {
    expect(getTimeLeft('2026-12-01T00:00:00Z', base)).toEqual({ status: 'started' })
  })

  it('bozuk tarihte invalid döner', () => {
    expect(getTimeLeft('bozuk-tarih', base)).toEqual({ status: 'invalid' })
    expect(getTimeLeft(undefined, base)).toEqual({ status: 'invalid' })
  })

  it('null ve boş dizgede invalid döner', () => {
    expect(getTimeLeft(null, base)).toEqual({ status: 'invalid' })
    expect(getTimeLeft('', base)).toEqual({ status: 'invalid' })
  })
})

describe('Countdown', () => {
  it('değerleri iki haneli gösterir ve her saniye günceller', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'))
    render(<Countdown startsAt="2026-12-02T02:03:04Z" />)
    expect(screen.getByTestId('countdown-days')).toHaveTextContent('01')
    expect(screen.getByTestId('countdown-hours')).toHaveTextContent('02')
    expect(screen.getByTestId('countdown-minutes')).toHaveTextContent('03')
    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('04')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('countdown-seconds')).toHaveTextContent('03')
  })

  it('geçmiş tarihte "Başladı!" gösterir, NaN göstermez', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'))
    render(<Countdown startsAt="2026-01-01T00:00:00Z" />)
    expect(screen.getByText('Başladı!')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('NaN')
  })

  it('bozuk tarihte yedek metin gösterir, NaN göstermez', () => {
    render(<Countdown startsAt="bozuk" />)
    expect(screen.getByText('Tarih yakında açıklanacak')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('NaN')
  })

  it('startsAt null iken yedek metin gösterir', () => {
    render(<Countdown startsAt={null} />)
    expect(screen.getByText('Tarih yakında açıklanacak')).toBeInTheDocument()
  })
})
