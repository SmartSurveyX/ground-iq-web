/**
 * Review QA auto-flagging (WS5).
 * Flags are computed client-side from fields the list API already returns —
 * no backend change needed beyond confirm-pending accepting an id list.
 *
 * Flags:
 *  - gps:   no usable GPS on the record (has_geo === false)
 *  - fast:  completed suspiciously fast (_duration_sec below FAST_SECONDS)
 *  - dup:   the same phone number appears on another loaded record
 *  - audio: the survey required voice but the record has none
 */

export const FAST_SECONDS = 60

export const FLAG_LABELS = {
  gps: '📍 No GPS',
  fast: '⏱ Very fast',
  dup: '📞 Duplicate phone',
  audio: '🎙 Missing audio',
}

function normPhone(s) {
  const d = String(s ?? '').replace(/\D/g, '')
  return d.length >= 6 ? d.slice(-10) : ''
}

/**
 * Compute flags for a list of review records.
 * Returns a Map of String(recordId) → [flagKey, …].
 */
export function computeFlags(items) {
  const phoneCounts = new Map()
  for (const it of items) {
    const p = normPhone(it?.answers?.phone)
    if (p) phoneCounts.set(p, (phoneCounts.get(p) || 0) + 1)
  }
  const out = new Map()
  for (const it of items) {
    const list = []
    if (it.has_geo === false) list.push('gps')
    const dur = Number(it?.answers?._duration_sec || 0)
    if (dur > 0 && dur < FAST_SECONDS) list.push('fast')
    const p = normPhone(it?.answers?.phone)
    if (p && (phoneCounts.get(p) || 0) > 1) list.push('dup')
    if (it?.answers?._voice_required === true && it.has_voice !== true) list.push('audio')
    if (list.length) out.set(String(it.id), list)
  }
  return out
}
