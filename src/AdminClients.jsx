import { useEffect, useState } from 'react'
import AdminClientAdminsScreen from './AdminClientAdmins'
import AdminCompaniesScreen from './AdminCompanies'
import { deactivateWebFillLink, listActiveWebFillLinks } from './api'

/**
 * Clients (WS7) — Companies + Client Admins in one governance screen,
 * plus the platform-wide active web-links table (moved from Web survey).
 */
export default function AdminClients({ onToast }) {
  const [tab, setTab] = useState('admins')
  const [links, setLinks] = useState([])
  const [linksLoading, setLinksLoading] = useState(true)

  const loadLinks = async () => {
    setLinksLoading(true)
    try {
      const d = await listActiveWebFillLinks()
      setLinks(d.items || [])
    } catch {
      setLinks([])
    } finally {
      setLinksLoading(false)
    }
  }

  useEffect(() => { void loadLinks() }, [])

  async function deactivate(token) {
    if (!window.confirm('Deactivate this web link? Responses will stop immediately.')) return
    try {
      await deactivateWebFillLink(token)
      onToast?.('Web link deactivated', 'ok')
      await loadLinks()
    } catch (e) {
      onToast?.(e.message || 'Deactivate failed', 'error')
    }
  }

  return (
    <div className="page-pad">
      <div className="admin-subtabs" style={{ marginBottom: 12 }}>
        <button type="button" className={tab === 'admins' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('admins')}>
          Client Admins
        </button>
        <button type="button" className={tab === 'companies' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('companies')}>
          Companies
        </button>
        <button type="button" className={tab === 'links' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('links')}>
          Web links ({links.length})
        </button>
      </div>

      {tab === 'admins' && <AdminClientAdminsScreen onToast={onToast} />}
      {tab === 'companies' && <AdminCompaniesScreen onToast={onToast} />}

      {tab === 'links' && (
        <div className="card" style={{ marginBottom: 14 }}>
          <h3>Active web links (all clients)</h3>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Deactivate here to stop responses instantly. Per-survey sharing lives on each survey's Share tab.
          </p>
          {linksLoading ? (
            <p className="muted">Loading…</p>
          ) : links.length === 0 ? (
            <p className="muted">No active web links.</p>
          ) : (
            <ul className="user-list">
              {links.map((l) => (
                <li key={l.token}>
                  <div style={{ width: '100%' }}>
                    <strong>{l.title || l.form_key}</strong>
                    <div className="meta" style={{ wordBreak: 'break-all' }}>
                      {l.form_key} · quota {l.max_uses} · used {l.use_count || 0}
                    </div>
                  </div>
                  <button type="button" className="btn small danger" onClick={() => void deactivate(l.token)}>
                    Deactivate
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
