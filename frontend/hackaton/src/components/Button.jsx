import { Link } from 'react-router-dom'
import './Button.css'

/**
 * Link (`to`), dış bağlantı (`href`) veya düğme olarak render edilir.
 * @param {{ to?: string, href?: string, variant?: string, size?: 'md' | 'sm', children?: import('react').ReactNode } & Record<string, any>} props
 */
export default function Button({ to, href, variant = 'primary', size = 'md', children, ...rest }) {
  const className = `btn btn--${variant}${size === 'sm' ? ' btn--sm' : ''}`
  if (to) {
    return (
      <Link to={to} className={className} {...rest}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={className} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" className={className} {...rest}>
      {children}
    </button>
  )
}
