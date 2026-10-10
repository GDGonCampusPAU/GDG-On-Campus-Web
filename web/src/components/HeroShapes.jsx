import { useRef } from 'react'
import { useParallax } from '../hooks/useParallax.js'
import './HeroShapes.css'

export default function HeroShapes() {
  const ref = useRef(null)
  useParallax(ref)

  return (
    <div className="hero-shapes" ref={ref}>
      <svg viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <g className="shape" data-shape="circle" style={{ '--depth': 1.2 }}>
          <g className="shape__drift" style={{ '--dx': '18px', '--dy': '-24px', '--rot': '0deg', '--dur': '11s' }}>
            <circle cx="170" cy="170" r="110" fill="var(--blue)" />
          </g>
        </g>
        <g className="shape" data-shape="square" style={{ '--depth': 0.8 }}>
          <g className="shape__drift" style={{ '--dx': '-20px', '--dy': '16px', '--rot': '16deg', '--dur': '13s' }}>
            <rect x="370" y="90" width="150" height="150" fill="var(--red)" />
          </g>
        </g>
        <g className="shape" data-shape="triangle" style={{ '--depth': 1.5 }}>
          <g className="shape__drift" style={{ '--dx': '22px', '--dy': '-14px', '--rot': '-10deg', '--dur': '15s' }}>
            <polygon points="110,540 250,310 390,540" fill="var(--yellow)" />
          </g>
        </g>
        <g className="shape" data-shape="half" style={{ '--depth': 1 }}>
          <g className="shape__drift" style={{ '--dx': '-16px', '--dy': '-20px', '--rot': '8deg', '--dur': '12s' }}>
            <path d="M 390 480 A 100 100 0 0 1 590 480 Z" fill="var(--green)" />
          </g>
        </g>
      </svg>
    </div>
  )
}
