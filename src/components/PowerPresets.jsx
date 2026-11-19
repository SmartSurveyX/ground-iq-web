import { POWER_DEFS } from '../AdminClientAdmins'

/**
 * Role presets for delegated Sub Client Admin accounts (least privilege).
 * Each preset maps to a subset of the 12 can_* powers; "custom" keeps whatever
 * is currently selected and opens the full toggle list. The server clamps every
 * grant to what the creating Client Admin holds themselves — presets can never
 * exceed that, and the UI clamps the same way so what you see is what is saved.
 */
export const ROLE_PRESETS = [
  {
    id: 'viewer',
    label: 'Viewer',
    icon: '👁',
    hint: 'Read-only — browse analytics, review feed and reports',
    powers: {},
  },
  {
    id: 'reviewer',
    label: 'Reviewer',
    icon: '✓',
    hint: 'Confirm/reject records, proof checks, verify surveyors',
    powers: { can_review_data: true, can_validate_proof: true, can_verify_surveyors: true },
  },
  {
    id: 'builder',
    label: 'Survey Builder',
    icon: '🗂',
    hint: 'Create/edit surveys, question bank, Telugu translation',
    powers: { can_crud_questionnaire: true, can_edit_surveys: true, can_manage_questions: true, can_translate_telugu: true },
  },
  {
    id: 'team',
    label: 'Team Manager',
    icon: '👥',
    hint: 'Assign surveyors to surveys, verify surveyors, run web links',
    powers: { can_assign_surveyors: true, can_verify_surveyors: true, can_web_survey: true },
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: '⚙',
    hint: 'Pick powers one by one from the full list',
    powers: null,
  },
]

const PRESET_POWERS_KEY = '__preset'

/** A preset's powers as they would actually be saved: limited to `maxPowers` if given. */
function clampedPresetPowers(preset, maxPowers) {
  const out = {}
  for (const def of POWER_DEFS) {
    const wanted = !!(preset.powers && preset.powers[def.key])
    out[def.key] = maxPowers ? wanted && !!maxPowers[def.key] : wanted
  }
  return out
}

/**
 * Which named preset (if any) matches a powers object exactly.
 * Pass `maxPowers` so a preset the admin can only partly grant (clamped)
 * is still recognised instead of falling back to "custom".
 */
export function detectPreset(powers = {}, maxPowers) {
  for (const p of ROLE_PRESETS) {
    if (!p.powers) continue
    const expected = clampedPresetPowers(p, maxPowers)
    let match = true
    for (const def of POWER_DEFS) {
      if (!!powers[def.key] !== expected[def.key]) { match = false; break }
    }
    if (match) return p.id
  }
  return 'custom'
}

/**
 * Apply a preset, clamped to what `maxPowers` holds.
 * "custom" (and any unknown id) keeps `current` — it never grants everything.
 */
export function applyPreset(presetId, maxPowers = {}, current = {}) {
  const preset = ROLE_PRESETS.find((p) => p.id === presetId)
  const out = {}
  for (const def of POWER_DEFS) {
    const wanted = preset && preset.powers ? !!preset.powers[def.key] : !!current[def.key]
    out[def.key] = wanted && !!maxPowers[def.key]
  }
  return out
}

const chip = (active, locked) => ({
  fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 99,
  cursor: locked ? 'not-allowed' : 'pointer',
  border: '1px solid ' + (active ? '#4f7dc6' : '#e2e8f0'),
  background: active ? '#eef4fb' : '#f8fafc',
  color: active ? '#1f4e9c' : '#475569',
  opacity: locked ? 0.55 : 1,
})

/**
 * Preset picker: named presets + Custom (opens the 12 toggles).
 * Controlled: the parent owns `preset` and `powers` and re-renders us.
 * `maxPowers` = the granting admin's own powers (the clamp).
 * `lockedKeys` = optional map of keys subject to the clamp; omit it and every
 * power the granting admin does not hold is locked.
 */
export function PresetPicker({ preset, powers = {}, maxPowers = {}, lockedKeys, onPreset, onTogglePower, compact = false }) {
  const isLocked = (key) => (lockedKeys == null ? true : !!lockedKeys[key]) && !maxPowers[key]
  const grantedCount = POWER_DEFS.filter((d) => !!powers[d.key]).length

  const presetTitle = (p) => {
    if (!p.powers) return p.hint
    const missing = POWER_DEFS.filter((d) => p.powers[d.key] && !maxPowers[d.key])
    return missing.length
      ? `${p.hint} (limited — you do not hold: ${missing.map((d) => d.label).join(', ')})`
      : p.hint
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ROLE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={presetTitle(p)}
            aria-pressed={preset === p.id}
            onClick={() => onPreset?.(p.id)}
            style={chip(preset === p.id, false)}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      {(preset === 'custom' || !compact) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {POWER_DEFS.map((def) => {
            const locked = isLocked(def.key)
            const on = !!powers[def.key]
            return (
              <button
                key={def.key}
                type="button"
                disabled={locked}
                aria-pressed={on}
                title={locked
                  ? `${def.label} — you do not have this power yourself`
                  : `${def.label}: ${on ? 'granted' : 'not granted'}`}
                onClick={() => { if (!locked) onTogglePower?.(def.key) }}
                style={chip(on, locked)}
              >
                {locked ? '🔒 ' : ''}{def.icon} {def.label}
              </button>
            )
          })}
        </div>
      )}
      {compact && preset !== 'custom' && (
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
          {grantedCount} of {POWER_DEFS.length} powers granted.
        </div>
      )}
    </div>
  )
}

export { PRESET_POWERS_KEY }
