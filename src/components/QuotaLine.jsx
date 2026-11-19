/**
 * QuotaLine — the single wording for the record-pool quota, reused everywhere (WS6).
 *
 *   Capped:     "Used 120 / 500 (web 30 reserved) · 350 left"
 *   Unlimited:  "120 used · Unlimited"            (cap 0 = unlimited, per server rule)
 *
 * The cap is consumed by field-used + web-reserved, so "left" = cap - used - reserved.
 * Colours: red when the pool is exhausted, amber when 90%+ is taken.
 */
const LEVELS = {
  ok: { color: '#334155', bg: '#f8fafc', border: '#e2e8f0' },
  warn: { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  hot: { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
}

export default function QuotaLine({ fieldUsed = 0, cap = 0, webReserved = 0, style = {} }) {
  const used = Math.max(0, Number(fieldUsed) || 0)
  const c = Math.max(0, Number(cap) || 0)
  const w = Math.max(0, Number(webReserved) || 0)

  const capped = c > 0
  const taken = used + w
  const left = capped ? Math.max(0, c - taken) : null
  const level = capped && left === 0 ? 'hot' : capped && taken / c >= 0.9 ? 'warn' : 'ok'
  const L = LEVELS[level]

  const reserved = w > 0 ? ` (web ${w.toLocaleString()} reserved)` : ''
  const text = capped
    ? `Used ${used.toLocaleString()} / ${c.toLocaleString()}${reserved} · ${left.toLocaleString()} left`
    : `${used.toLocaleString()} used${reserved} · Unlimited`

  const detail = capped
    ? `${c.toLocaleString()} allocated · ${used.toLocaleString()} field used · ${w.toLocaleString()} web reserved · ${left.toLocaleString()} left`
    : `${used.toLocaleString()} field used · ${w.toLocaleString()} web reserved · no cap set (unlimited)`

  return (
    <span
      className="quota-line"
      role="status"
      aria-label={detail}
      title={detail}
      style={{
        fontSize: 13,
        fontWeight: 700,
        color: L.color,
        background: L.bg,
        border: '1px solid ' + L.border,
        borderRadius: 8,
        padding: '4px 10px',
        display: 'inline-block',
        ...style,
      }}
    >
      {text}
    </span>
  )
}
