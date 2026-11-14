import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button.jsx'
import GuideRobot from '../components/GuideRobot.jsx'
import Laptop from '../components/Laptop.jsx'
import { GLASS_HEIGHT, GLASS_WIDTH, createGlass, crackPath } from '../lib/glassCrack.js'
import './NotFound.css'

const LINES = {
  ask: 'Kaybolmuş görünüyorsun. Seni geri götürmemi ister misin?',
  waiting: 'Tamamdır, burada bekliyorum. Camı tıklatırsan gelirim.',
  upset: 'Az yavaş dokun! Bak, kırdın…',
}
// The robot needs a moment to get up before it speaks.
const GET_UP_MS = 900

/**
 * 404: a robot inside the laptop offers to take the visitor back.
 * "Hayır" → it lies down to wait; knocking on the glass cracks it (once, it does not break),
 * the robot gets up, a little cross and sad, and shows the way back.
 * @param {{ random?: () => number }} props `random` only for tests.
 */
export default function NotFound({ random = Math.random }) {
  const navigate = useNavigate()
  const [stage, setStage] = useState(/** @type {'ask' | 'waiting' | 'knocked' | 'upset'} */ ('ask'))
  const [crack, setCrack] = useState(/** @type {import('../lib/glassCrack.js').Crack | null} */ (null))
  const [hit, setHit] = useState(false)
  const displayRef = useRef(/** @type {HTMLDivElement | null} */ (null))
  const backRef = useRef(/** @type {HTMLAnchorElement | null} */ (null))
  const timer = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])
  // Keyboard users follow the story: the glass is the next thing to press, then "Geri dön".
  useEffect(() => {
    if (stage === 'waiting') displayRef.current?.focus()
    if (stage === 'upset') backRef.current?.focus()
  }, [stage])

  const knock = (x, y) => {
    if (stage !== 'waiting') return
    setCrack(createGlass().hit(x, y, 0.45, random))
    setHit(true)
    setStage('knocked')
    timer.current = window.setTimeout(() => setStage('upset'), GET_UP_MS)
  }

  const waiting = stage === 'waiting'
  const displayProps = {
    className: `not-found__screen is-${stage}`,
    ...(waiting && {
      role: 'button',
      tabIndex: 0,
      'aria-label': 'Camı tıklat',
      onPointerDown: (/** @type {import('react').PointerEvent<HTMLDivElement>} */ event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        const { offsetX, offsetY } = event.nativeEvent
        const box = event.currentTarget
        knock((offsetX / box.clientWidth) * GLASS_WIDTH, (offsetY / box.clientHeight) * GLASS_HEIGHT)
      },
      onKeyDown: (/** @type {import('react').KeyboardEvent} */ event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        knock(GLASS_WIDTH * 0.72, GLASS_HEIGHT * 0.38)
      },
    }),
  }
  const mood = stage === 'ask' ? 'talk' : stage === 'upset' ? 'upset' : 'lying'
  const said = stage === 'knocked' ? null : LINES[stage]

  return (
    <section className="not-found container">
      <p className="not-found__code">404</p>
      <h1 className="not-found__title">Sayfa bulunamadı</h1>

      <Laptop className={hit ? 'is-hit' : ''} displayRef={displayRef} displayProps={displayProps}>
        <GuideRobot mood={mood} className="not-found__robot" />

        <div className="not-found__bubble" aria-live="polite" hidden={!said}>
          <p className="not-found__line">{said}</p>
          {stage === 'ask' && (
            <div className="not-found__choices">
              <Button size="sm" onClick={() => navigate('/')}>
                Evet
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStage('waiting')}>
                Hayır, burayı çok sevdim
              </Button>
            </div>
          )}
          {stage === 'upset' && (
            <div className="not-found__choices">
              <Button size="sm" to="/" ref={backRef}>
                Geri dön
              </Button>
            </div>
          )}
        </div>

        {crack && (
          <svg className="not-found__glass" viewBox={`0 0 ${GLASS_WIDTH} ${GLASS_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <radialGradient id="not-found-impact">
                <stop offset="0" stopColor="#fff" stopOpacity=".7" />
                <stop offset=".4" stopColor="#fff" stopOpacity=".15" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle className="not-found__impact" cx={crack.x} cy={crack.y} r="18" fill="url(#not-found-impact)" />
            {crack.lines.map((line, i) => (
              <g key={i}>
                <path className="not-found__crack-shadow" d={crackPath(line)} pathLength={1} strokeWidth={line.width * 1.9} transform="translate(1.2 1.4)" />
                <path className="not-found__crack" d={crackPath(line)} pathLength={1} strokeWidth={line.width} />
              </g>
            ))}
          </svg>
        )}
      </Laptop>
    </section>
  )
}
