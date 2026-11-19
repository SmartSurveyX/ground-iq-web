import { useEffect, useState } from 'react'
import AdminContactRequests from './AdminContactRequests'
import AdminSeats from './AdminSeats'
import { getContactRequests, getSeatRequests } from './api'

/**
 * Inbox (WS7) — Contact Requests + Seat Requests with live pending counts.
 * The parent (AdminPortal) reads the counts for the sidebar badge via
 * exportInboxCounts below.
 */
let inboxCountListeners = []

export function notifyInboxCounts(counts) {
  for (const fn of inboxCountListeners) fn(counts)
}

export async function fetchInboxCounts() {
  const [contacts, seats] = await Promise.all([
    getContactRequests().catch(() => ({ items: [] })),
    getSeatRequests().catch(() => ({ items: [] })),
  ])
  const newContacts = (contacts.items || []).filter((r) => r.status !== 'handled').length
  const pendingSeats = (seats.items || []).filter((r) => !r.decision && r.status !== 'approved' && r.status !== 'denied').length
  const counts = { contacts: newContacts, seats: pendingSeats }
  notifyInboxCounts(counts)
  return counts
}

export default function AdminInbox({ onToast }) {
  const [tab, setTab] = useState('contact')
  const [counts, setCounts] = useState({ contacts: 0, seats: 0 })

  useEffect(() => {
    inboxCountListeners.push(setCounts)
    void fetchInboxCounts()
    return () => { inboxCountListeners = inboxCountListeners.filter((f) => f !== setCounts) }
  }, [])

  return (
    <div className="page-pad">
      <div className="admin-subtabs" style={{ marginBottom: 12 }}>
        <button type="button" className={tab === 'contact' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('contact')}>
          Contact Requests{counts.contacts > 0 ? ` (${counts.contacts} new)` : ''}
        </button>
        <button type="button" className={tab === 'seats' ? 'map-tab active' : 'map-tab'} onClick={() => setTab('seats')}>
          Seat Requests{counts.seats > 0 ? ` (${counts.seats} pending)` : ''}
        </button>
      </div>
      {tab === 'contact' ? <AdminContactRequests onToast={onToast} /> : <AdminSeats onToast={onToast} />}
    </div>
  )
}
