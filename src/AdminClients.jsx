import { useCallback, useEffect, useRef, useState } from 'react'
import AdminClientAdminsScreen from './AdminClientAdmins'
import AdminCompaniesScreen from './AdminCompanies'
import { deactivateWebFillLink, listActiveWebFillLinks } from './api'

/**
 * Clients (WS7) — Companies + Client Admins in one governance screen,
 * plus the platform-wide active web-links table (moved from Web survey).
 *
 * Tabs mount on first visit and then stay mounted (hidden), so unsaved
 * form state in Client Admins / Companies survives switching tabs.
 */
export default function AdminClients({ onToast }) {
  const [tab, setTab] = useState('admins')
  const [visited, setVisited] = useState({ admins: true })
  const [links, setLinks] = useState([])
  const [linksLoading, setLinksLoading] = useState(true)
  const [linksError, setLinksError] = useState('')
  const [busyToken, setBusyToken] = useState('')
  const alive = useRef(true)

  const loadLinks = useCallback(async () => {
    setLinksLoading(true)
    setLinksError('')
    try {
      const d = await listActiveWebFillLinks()
      if (alive.current) setLinks(d.items || [])
    } catch (e) {
      // keep last known list; show an error instead of a false "No active web links"
      if (alive.current) setLinksError(e?.message || 'Could not load web links')
    } finally {
      if (alive.current) setLinksLoading(false)
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void loadLinks()
    return () => {
      alive.current = false
    }
  }, [loadLinks])

  const pick = (t) => {
    setTab(t)
    setVisited((v) => (v[t] ? v : { ...v, [t]: true }))
  }

  async function deactivate(token) {
    if (busyToken) return
    if (!window.confirm('Deactivate this web link? Responses will stop immediately.')) return
    setBusyToken(token)
    try {
      await deactivateWebFillLink(token)
      onToast?.('Web link deactivated', 'ok')
      await loadLinks()
    } catch (e) {
      onToast?.(e.message || 'Deactivate failed', 'error')
    } finally {
      if (alive.current) setBusyToken('')
    }
  }

  const tabClass = (t) => (tab === t ? 'map-tab active' : 'map-tab')

  return (
    <div className="page-pad">
      <div className="admin-subtabs" style={{ marginBottom: 12 }}>
        <button type="button" className={tabClass('admins')} onClick={() => pick('admins')}>
          Client Admins
        </button>
        <button type="button" className={tabClass('companies')} onClick={() => pick('companies')}>
          Companies
        </button>
        <button type="button" className={tabClass('links')} onClick={() => pick('links')}>
          Web links{linksError ? '' : ` (${links.length})`}
        </button>
      </div>

      {visited.admins && (
        <div style={{ display: tab === 'admins' ? 'block' : 'none' }}>
          <AdminClientAdminsScreen onToast={onToast} />
        </div>
      )}

      {visited.companies && (
        <div style={{ display: tab === 'companies' ? 'block' : 'none' }}>
          <AdminCompaniesScreen onToast={onToast} />
        </div>
      )}

      {tab === 'links' && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <h3 style={{ margin: 0 }}>Active web links (all clients)</h3>
            <button type="button" className="btn small" onClick={() => void loadLinks()} disabled={linksLoading}>
              {linksLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Deactivate here to stop responses instantly. Per-survey sharing lives on each survey's Share tab.
          </p>

          {linksError && (
            <p className="muted" style={{ color: '#b91c1c' }}>
              {linksError} — showing last loaded list.
            </p>
          )}

          {linksLoading && links.length === 0 ? (
            <p className="muted">Loading…</p>
          ) : links.length === 0 && !linksError ? (
            <p className="muted">No active web links.</p>
          ) : (
            <ul className="user-list">
              {links.map((l) => (
                <li key={l.token}>
                  <div style={{ width: '100%' }}>
                    <strong>{l.title || l.form_key}</strong>
                    <div className="meta" style={{ wordBreak: 'break-all' }}>
                      {l.form_key} · quota {l.max_uses} · used {l.use_count || 0}
                      {l.owner_name || l.created_by_name ? ` · ${l.owner_name || l.created_by_name}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn small danger"
                    disabled={busyToken === l.token}
                    onClick={() => void deactivate(l.token)}
                  >
                    {busyToken === l.token ? 'Deactivating…' : 'Deactivate'}
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
