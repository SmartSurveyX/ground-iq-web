import { useEffect, useRef, useState } from 'react'
import AdminContactRequests from './AdminContactRequests'
import AdminSeats from './AdminSeats'
import { getContactRequests, getSeatRequests } from './api'

/**
 * Inbox (WS7) — Contact Requests + Seat Requests with live pending counts.
 *
 * Sidebar badge (AdminPortal, Super Admin only):
 *   const inbox = useInboxCounts()
 *   badge = inbox.contacts + inbox.seats
 *   call fetchInboxCounts() on mount, every 60s, and on the SSE notification event.
 *
 * Child screens must call onChanged?.() after each successful action
 * (mark handled / approve / deny) so counts refresh immediately.
 */
const EMPTY = { contacts: 0, seats: 0 }
let current = EMPTY
const listeners = new Set()

export function notifyInboxCounts(counts) {
  current = counts
  listeners.forEach((fn) => fn(counts))
}

export async function fetchInboxCounts() {
  try {
    const [contacts, seats] = await Promise.all([getContactRequests(), getSeatRequests()])
    const counts = {
      // TODO: tighten to the exact "new" status value your API returns
      contacts: (contacts.items || []).filter((r) => r.status !== 'handled').length,
      seats: (seats.items || []).filter((r) => r.status !== 'approved' && r.status !== 'denied').length,
    }
    notifyInboxCounts(counts)
    return counts
  } catch {
    // keep last known counts on failure — never show a false "0 pending"
    return current
  }
}

export function useInboxCounts() {
  const [counts, setCounts] = useState(current)
  useEffect(() => {
    listeners.add(setCounts)
    return () => {
      listeners.delete(setCounts)
    }
  }, [])
  return counts
}

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
