import { useEffect, useRef, useState } from 'react'
import AdminContactRequests from './AdminContactRequests'
import AdminSeats from './AdminSeats'
import { fetchInboxCounts, useInboxCounts } from './inboxCounts'

/**
 * Inbox (WS7) — Contact Requests + Seat Requests with live pending counts.
 * The counters themselves live in ./inboxCounts so AdminPortal can show the
 * sidebar badge without importing this screen.
 *
 * Child screens must call onChanged?.() after each successful action
 * (mark handled / approve / deny) so counts refresh immediately.
 */
export default function AdminInbox({ onToast }) {
  const [tab, setTab] = useState('contact')
  const counts = useInboxCounts()
  const userPicked = useRef(false)

  useEffect(() => {
    let alive = true
    fetchInboxCounts().then((c) => {
      // open on Seat Requests if only seats are pending (and user hasn't clicked yet)
      if (alive && !userPicked.current && c.contacts === 0 && c.seats > 0) setTab('seats')
    })
    return () => {
      alive = false
    }
  }, [])

  const pick = (t) => {
    userPicked.current = true
    setTab(t)
  }

  return (
    <div className="page-pad">
      <div className="admin-subtabs" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={tab === 'contact' ? 'map-tab active' : 'map-tab'}
          onClick={() => pick('contact')}
        >
          Contact Requests{counts.contacts > 0 ? ` (${counts.contacts} new)` : ''}
        </button>
        <button
          type="button"
          className={tab === 'seats' ? 'map-tab active' : 'map-tab'}
          onClick={() => pick('seats')}
        >
          Seat Requests{counts.seats > 0 ? ` (${counts.seats} pending)` : ''}
        </button>
      </div>
      {tab === 'contact' ? (
        <AdminContactRequests onToast={onToast} onChanged={fetchInboxCounts} />
      ) : (
        <AdminSeats onToast={onToast} onChanged={fetchInboxCounts} />
      )}
    </div>
  )
}
