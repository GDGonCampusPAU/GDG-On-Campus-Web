// Renders form hint text, turning Markdown-style links `[label](href)` into anchors.
// Only http(s) URLs and same-site absolute paths are linked; anything else
// (javascript:, data:, protocol-relative //host, ...) is left as plain text.
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g

export const isSafeHref = (href) => /^https?:\/\/[^\s]+$/i.test(href) || /^\/(?!\/)[^\s]*$/.test(href)

export default function HintText({ text }) {
  if (!text) return null
  const parts = []
  let last = 0
  for (const match of text.matchAll(LINK)) {
    const [full, label, href] = match
    if (!isSafeHref(href)) continue
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(
      <a key={match.index} href={href} target="_blank" rel="noopener noreferrer">
        {label}
      </a>,
    )
    last = match.index + full.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}
