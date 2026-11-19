import { useState } from 'react'
import AdminCharts from './AdminCharts'
import AdminAnalyze from './AdminAnalyze'

/**
 * Explore — merged analytics exploration (WS2): Excel-style charts and the
 * live feed behind one entry point. Replaces the old 'charts' and 'report'
 * pages, which still land here for backward compatibility.
 */
export default function AdminExplore({ initialMode = 'charts', onToast }) {
  const [mode, setMode] = useState(initialMode === 'live' ? 'live' : 'charts')
  return (
    <div>
      <div className="admin-subtabs" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className={mode === 'charts' ? 'map-tab active' : 'map-tab'}
          onClick={() => setMode('charts')}
        >
          Charts
        </button>
        <button
          type="button"
          className={mode === 'live' ? 'map-tab active' : 'map-tab'}
          onClick={() => setMode('live')}
        >
          Live Feed
        </button>
      </div>
      {mode === 'charts' ? <AdminCharts /> : <AdminAnalyze onToast={onToast || (() => {})} />}
    </div>
  )
}
