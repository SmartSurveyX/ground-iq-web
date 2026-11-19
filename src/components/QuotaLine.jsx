/**
 * QuotaLine — the single wording for the record-pool quota, reused everywhere
 * (WS6): "Used 120 / 500 (web 30 reserved)". Red when the pool is exhausted.
 */
export default function QuotaLine({ fieldUsed = 0, cap = 0, webReserved = 0, style = {} }) {
  const used = Number(fieldUsed) || 0
  const c = Number(cap) || 0
  const w = Number(webReserved) || 0
  const left = c > 0 ? Math.max(0, c - used - w) : null
  const hot = c > 0 && left === 0
  return (
    <span
      className="quota-line"
      style={{
        fontSize: 13, fontWeight: 700,
        color: hot ? '#b91c1c' : '#334155',
        background: hot ? '#fef2f2' : '#f8fafc',
        border: '1px solid ' + (hot ? '#fecaca' : '#e2e8f0'),
        borderRadius: 8, padding: '4px 10px', display: 'inline-block',
        ...style,
      }}
      title={c > 0 ? `${c} allocated · ${used} field used · ${w} web reserved · ${left} left` : 'No quota allocated yet'}
    >
      {c > 0
        ? <>Used {used.toLocaleString()} / {c.toLocaleString()}{w > 0 ? <> (web {w.toLocaleString()} reserved)</> : null}</>
        : 'No quota allocated'}
    </span>
  )
}
