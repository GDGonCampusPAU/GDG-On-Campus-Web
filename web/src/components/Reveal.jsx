import { useReveal } from '../hooks/useReveal.js'
import './Reveal.css'

export default function Reveal({ children, className = '' }) {
  const [ref, visible] = useReveal()
  return (
    <div ref={ref} className={`reveal${visible ? ' is-visible' : ''} ${className}`.trim()}>
      {children}
    </div>
  )
}
