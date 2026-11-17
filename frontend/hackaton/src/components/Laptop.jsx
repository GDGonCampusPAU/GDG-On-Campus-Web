import { KEYBOARD_RATIO, KEYBOARD_URL } from '../lib/keyboard.js'
import './LaptopHero.css'
import './Laptop.css'

/**
 * The home page laptop, standing open (LaptopHero without the scroll animation).
 * `children` are drawn on the display; `displayProps` go to the display element
 * (e.g. a click handler: offsetX/Y on it are measured on the screen surface, through the 3D tilt).
 * @param {{ children?: import('react').ReactNode, displayProps?: Record<string, any>, className?: string, displayRef?: import('react').Ref<HTMLDivElement> }} props
 */
export default function Laptop({ children, displayProps = {}, className = '', displayRef }) {
  return (
    <div className={`laptop laptop--static ${className}`.trim()}>
      <div className="laptop__view">
        <i className="laptop__shadow" />
        <div className="laptop__scene">
          <div className="laptop__base">
            <i className="laptop__keys" style={/** @type {import('react').CSSProperties} */ ({ '--keys': KEYBOARD_URL, '--keys-ratio': KEYBOARD_RATIO })} />
          </div>
          <div className="laptop__lip" />
          <div className="laptop__lid">
            <div className="laptop__screen">
              <div {...displayProps} ref={displayRef} className={`laptop__display ${displayProps.className ?? ''}`.trim()}>
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
