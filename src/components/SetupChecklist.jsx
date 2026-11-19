import { useMemo } from 'react'

/**
 * Setup checklist for brand-new Client Admins (Overview page).
 * Four steps: create survey → add surveyors → share a link → review records.
 * Progress comes from live data, not localStorage — the steps stay honest.
 * Hidden once every step is done (the admin has onboarded).
 */
export default function SetupChecklist({ surveys = [], surveyorCount = 0, stats = {}, onNav }) {
  const steps = useMemo(() => {
    const hasLiveLink = surveys.some((s) => {
      const l = s.web_link
      return l && !l.expired && !l.deactivated && !s.ended
    })
    const confirmed = Number(stats?.field_confirmed || 0)
    return [
      { id: 'survey', label: 'Create your first survey', hint: 'Surveys & Forms → + New Survey', done: surveys.length > 0, page: 'surveys' },
      { id: 'team', label: 'Add surveyors', hint: 'Surveyors & Quotas → + Add surveyors', done: Number(surveyorCount) > 0, page: 'users' },
      { id: 'share', label: 'Share a survey link (or QR)', hint: 'Open the survey → Share tab → generate link', done: hasLiveLink, page: 'surveys' },
      { id: 'review', label: 'Review your first records', hint: 'Review QA → Confirm or Reject', done: confirmed > 0, page: 'review' },
    ]
  }, [surveys, surveyorCount, stats])

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length) return null

  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <section className="chart-card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Get started — {doneCount} of {steps.length} done</h3>
        <span style={{ fontSize: 12, color: doneCount === steps.length ? '#15803d' : '#4f7dc6', fontWeight: 700 }}>{pct}%</span>
      </header>
      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: doneCount === steps.length ? '#16a34a' : '#4f7dc6' }} />
      </div>
      {steps.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onNav?.({ page: s.page })}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
            padding: '9px 12px', marginBottom: 6, borderRadius: 10,
            border: '1px solid ' + (s.done ? '#bbf7d0' : '#e2e8f0'),
            background: s.done ? '#f0fdf4' : '#fff',
            cursor: 'pointer',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 800,
            background: s.done ? '#16a34a' : '#eef4fb', color: s.done ? '#fff' : '#1f4e9c',
          }}>
            {s.done ? '✓' : ''}
          </span>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: s.done ? '#15803d' : '#1e293b' }}>
              {s.label}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>{s.hint}</span>
          </span>
          {!s.done && <span style={{ fontSize: 12, color: '#4f7dc6', fontWeight: 700 }}>Go →</span>}
        </button>
      ))}
    </section>
  )
}
