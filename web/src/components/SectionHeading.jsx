import './SectionHeading.css'

export default function SectionHeading({ eyebrow, title, children }) {
  return (
    <header className="section-heading">
      {eyebrow && <p className="section-heading__eyebrow">{eyebrow}</p>}
      <h2 className="section-heading__title">{title}</h2>
      {children && <p className="section-heading__text">{children}</p>}
    </header>
  )
}
