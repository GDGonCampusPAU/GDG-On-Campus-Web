import { Link } from 'react-router-dom'
import './Button.css'

export default function Button({ to, href, variant = 'primary', children, ...rest }) {
  const className = `btn btn--${variant}`
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
