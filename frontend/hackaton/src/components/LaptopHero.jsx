import { useRef, useState } from 'react'
import Button from './Button.jsx'
import Countdown from './Countdown.jsx'
import { useScrollProgress } from '../hooks/useScrollProgress.js'
import { KEYBOARD_RATIO, KEYBOARD_URL } from '../lib/keyboard.js'
import './LaptopHero.css'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// children (sayfanın geri kalanı) laptopun ekranı içinde, hero bloğunun altında kayar.
// Hareket azaltılmışsa kayma yoktur; children bölümün ardından düz sayfa olarak gelir.
export default function LaptopHero({ data, children }) {
  const trackRef = useRef(null)
  const pageRef = useRef(null)
  const [scrub] = useState(() => !prefersReducedMotion())
  useScrollProgress(trackRef, scrub, pageRef)

  const dates = (data.days ?? []).map((d) => d.date)

  const text = (
    <div className="laptop-hero__text">
      <p className="laptop-hero__theme">{data.theme}</p>
      <h1 className="laptop-hero__title">
        <span>{data.organizer}</span> <strong>{data.name}</strong>
      </h1>
      <p className="laptop-hero__tagline">{data.tagline}</p>
      <div className="laptop-hero__actions">
        <Button to="/kayit">Kayıt Ol</Button>
        <Button to="/program" variant="ghost">
          Programı Gör
        </Button>
      </div>
    </div>
  )

  const when = (
    <>
      <Countdown startsAt={data.startsAt} />
      <p className="laptop-hero__meta">{data.location}</p>
    </>
  )

  const editor = (
    <>
      <div className="laptop__bar">etkinlik.js</div>
      <ol className="laptop__code">
        <li className="c-comment">// {data.theme}</li>
        <li>
          <span className="c-key">const</span> etkinlik = {'{'}
        </li>
        <li className="in">
          ad: <span className="c-str">"{data.name}"</span>,
        </li>
        <li className="in">
          konum: <span className="c-str">"{data.location}"</span>,
        </li>
        <li className="in">
          tarih: [{dates.map((d, i) => (
            <span key={d}>
              {i > 0 && ', '}
              <span className="c-str">"{d}"</span>
            </span>
          ))}],
        </li>
        <li>{'}'}</li>
        <li>
          <span className="c-fn">kayitOl</span>()<span className="laptop__caret" />
        </li>
      </ol>
    </>
  )

  return (
    <>
      <section
        ref={trackRef}
        className={`laptop-hero${scrub ? ' laptop-hero--scrub' : ''}`}
        data-dark={scrub ? 'false' : 'true'}
      >
        <div className="laptop-hero__stage container">
          {scrub && (
            <p className="laptop-hero__banner" aria-hidden="true">
              <span>{data.organizer}</span> <strong>{data.name}</strong>
            </p>
          )}

          {/* Ekranın içi gerçek sayfadır, ekran okuyucudan gizlenmez. */}
          <div className="laptop">
            <div className="laptop__view">
              <i className="laptop__shadow" />
              <div className="laptop__scene">
                <div className="laptop__base">
                  <i className="laptop__keys" style={{ '--keys': KEYBOARD_URL, '--keys-ratio': KEYBOARD_RATIO }} />
                </div>
                <div className="laptop__lip" />
                <div className="laptop__lid">
                  <div className="laptop__back">
                    <i className="tone--blue" />
                    <i className="tone--red" />
                    <i className="tone--yellow" />
                    <i className="tone--green" />
                  </div>
                  <div className="laptop__screen">
                    <div className="laptop__display">
                      <div className="laptop__page" ref={pageRef}>
                        <div className="laptop__intro">
                          <div className="laptop__intro-main">
                            {text}
                            {when}
                          </div>
                          <div className="laptop__editor" aria-hidden="true">
                            {editor}
                          </div>
                        </div>
                        {scrub && <div className="laptop__rest">{children}</div>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {!scrub && children}
    </>
  )
}
