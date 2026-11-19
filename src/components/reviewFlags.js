/**
 * Review QA auto-flagging (WS5).
 * Flags are computed client-side from fields the list API already returns —
 * no backend change needed beyond confirm-pending accepting an id list.
 *
 * Flags:
 *  - gps:   no usable GPS on a FIELD record (has_geo === false). Web records are skipped.
 *  - fast:  completed suspiciously fast. Threshold is per survey: a fraction of that
 *           survey's median duration when enough records are loaded, else FAST_SECONDS.
 *  - dup:   the same phone number appears on another loaded record OF THE SAME SURVEY.
 *  - audio: the survey required voice but a FIELD record has none. Web records are skipped.
 *
 * Limits (client-side only): "dup" sees only the records currently loaded (page/filters).
 * For a platform-wide duplicate check, compute it on the server.
 */

export const FAST_SECONDS = 60        // fallback when a survey has too few records for a median
export const MIN_FAST_SECONDS = 15    // never flag anything slower than this as "fast" via ratio
export const FAST_RATIO = 0.3         // fast = under 30% of the survey's median duration
export const FAST_MIN_SAMPLE = 10     // records with a duration needed before trusting the median

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

// Field names match ReviewQA.jsx: survey key = form_key / form_id (top level or payload);
// web records = source 'web' | 'web-survey' or submitted_by 'Web'.
function formKeyOf(it) {
  return String(
    it?.form_key ?? it?.payload?.form_key ?? it?.form_id ?? it?.payload?.form_id ?? it?.answers?._form_key ?? '_all',
  )
}

function isWeb(it) {
  const src = String(it?.source ?? it?.answers?._source ?? '').toLowerCase()
  const by = String(it?.submitted_by ?? '').toLowerCase()
  return src === 'web' || src === 'web-survey' || by === 'web'
}

function durationOf(it) {
  const d = Number(it?.answers?._duration_sec || 0)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function median(nums) {
  if (!nums.length) return 0
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Compute flags for a list of review records.
 * Returns a Map of String(recordId) → [flagKey, …].
 * opts: { fastSeconds, fastRatio, minSample } to override the defaults.
 */
export function computeFlags(items, opts = {}) {
  const fastSeconds = opts.fastSeconds ?? FAST_SECONDS
  const fastRatio = opts.fastRatio ?? FAST_RATIO
  const minSample = opts.minSample ?? FAST_MIN_SAMPLE
  const list = (items || []).filter((it) => it && it.id != null)

  // per-survey duration thresholds + phone counts
  const durations = new Map() // formKey → number[]
  const phoneCounts = new Map() // `${formKey}|${phone}` → count
  for (const it of list) {
    const fk = formKeyOf(it)
    const d = durationOf(it)
    if (d) {
      if (!durations.has(fk)) durations.set(fk, [])
      durations.get(fk).push(d)
    }
    const p = normPhone(it?.answers?.phone)
    if (p) {
      const k = `${fk}|${p}`
      phoneCounts.set(k, (phoneCounts.get(k) || 0) + 1)
    }
  }
  const fastLimit = new Map() // formKey → seconds
  for (const [fk, arr] of durations) {
    fastLimit.set(
      fk,
      arr.length >= minSample ? Math.max(MIN_FAST_SECONDS, fastRatio * median(arr)) : fastSeconds,
    )
  }

  const out = new Map()
  for (const it of list) {
    const fk = formKeyOf(it)
    const flags = []
    const web = isWeb(it)

    if (!web && it.has_geo === false) flags.push('gps')

    const dur = durationOf(it)
    if (dur > 0 && dur < (fastLimit.get(fk) ?? fastSeconds)) flags.push('fast')

    const p = normPhone(it?.answers?.phone)
    if (p && (phoneCounts.get(`${fk}|${p}`) || 0) > 1) flags.push('dup')

    if (!web && it?.answers?._voice_required === true && it.has_voice !== true) flags.push('audio')

    if (flags.length) out.set(String(it.id), flags)
  }
  return out
}

/** Ids of records with no flags — the safe set for "Confirm all unflagged". */
export function unflaggedIds(items, flags) {
  return (items || [])
    .filter((it) => it && it.id != null && !flags.has(String(it.id)))
    .map((it) => it.id)
}
