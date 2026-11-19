import { useCallback, useEffect, useState } from 'react'
import { listSubmissions, listSurveys } from '../api'
import { PortalEmpty, PortalSkeleton } from '../PortalUI'

function formatDate(v) {
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
}

/** Raw data — latest submissions, one select + refresh (moved out of AdminPortal). */
export default function DataList() {
  const [surveys, setSurveys] = useState([])
  const [surveyFilter, setSurveyFilter] = useState('')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (survey) => {
    setLoading(true)
    try {
      if (!survey) {
        setItems([])
        return
      }
      const data = await listSubmissions(150, '', { survey })
      setItems(data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    listSurveys()
      .then((d) => { if (alive) setSurveys(d || []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => { void load(surveyFilter) }, [surveyFilter, load])

  return (
    <div className="portal-page">
      <header className="portal-page-head row">
        <div>
          <h1>Raw data</h1>
          <p className="portal-lead">Latest submissions (use Explore for filters)</p>
        </div>
        <label className="field compact">
          <span>By survey</span>
          <select value={surveyFilter} onChange={(e) => setSurveyFilter(e.target.value)}>
            {surveys.length === 0 ? <option value="">Select survey</option> : null}
            {surveys.map((s) => (
              <option key={s.id} value={s.form_key}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn small" onClick={() => void load(surveyFilter)} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
      </header>
      {loading ? (
        <PortalSkeleton rows={5} label="Loading submissions…" />
      ) : !surveyFilter ? (
        <PortalEmpty title="Pick a survey to load raw rows" />
      ) : !items.length ? (
        <PortalEmpty title="No rows yet">
          Collect from the field app or widen the survey filter.
        </PortalEmpty>
      ) : (
        <ul className="user-list">
          {items.map((it) => {
            const a = it.answers || {}
            const title =
              surveys.find((s) => s.form_key === it.form_key)?.title || it.form_key || 'Survey'
            return (
              <li key={it.id}>
                <div>
                  <strong>
                    #{it.id} · {title}
                  </strong>
                  <span className="meta">
                    {' '}
                    {it.submitted_by || a.data_collector || '—'} · {formatDate(it.created_at)} ·{' '}
                    {it.status || 'pending'}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
