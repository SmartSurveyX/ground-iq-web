import { useState } from 'react'
import AdminAudit from './AdminAudit'
import AdminErrors from './AdminErrors'

/**
 * Logs (WS7) — Errors + Audit in one governance screen.
 */
export default function AdminLogs({ onToast }) {
  const [tab, setTab] = useState('errors')
  return (
    <div className="page-pad">
      <div className="admin-subtabs" style={{ marginBottom: 12 }}>
        <button type="button" className={tab === 'errors' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('errors')}>
          Errors
        </button>
        <button type="button" className={tab === 'audit' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('audit')}>
          Audit Log
        </button>
      </div>
      {tab === 'errors' ? <AdminErrors onToast={onToast} /> : <AdminAudit onToast={onToast} />}
    </div>
  )
}
