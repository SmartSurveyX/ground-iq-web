/**
 * Option-list text helpers shared by the question editors.
 *
 * The editors accept a "comma-separated" field, but real options often contain
 * a comma ("Yes, and it was already there"). Splitting on every comma tears
 * such an option in two, so the parser keeps commas that sit inside double
 * quotes and also treats semicolons / newlines as separators.
 *
 *   Yes, and it was already there, No   →  ["Yes", "and it was already there", "No"]  ✗ old
 *   "Yes, and it was already there", No →  ["Yes, and it was already there", "No"]    ✓ new
 *
 * joinOptionText() re-quotes any option that would otherwise be split again,
 * so round-tripping text → list → text is stable.
 */
export function splitOptionText(text) {
  const raw = String(text ?? '')
  if (!raw.trim()) return []
  const out = []
  let buf = ''
  let quote = null
  for (const ch of raw) {
    if (quote) {
      if (ch === quote) quote = null
      else buf += ch
      continue
    }
    if (ch === '"' || ch === '“') {
      // Straight quotes close with themselves; smart quotes with their partner.
      quote = ch === '“' ? '”' : ch
      continue
    }
    if (ch === ',' || ch === '，' || ch === ';' || ch === '\n' || ch === '\r') {
      const value = buf.trim()
      if (value) out.push(value)
      buf = ''
      continue
    }
    buf += ch
  }
  const last = buf.trim()
  if (last) out.push(last)
  return out
}

/** Join options back into the editable text, quoting options with separators. */
export function joinOptionText(list) {
  return (Array.isArray(list) ? list : [])
    .map((option) => String(option ?? '').trim())
    .filter(Boolean)
    .map((option) => (/[",;，\n\r]/.test(option) ? `"${option.replace(/"/g, "'")}"` : option))
    .join(', ')
}
