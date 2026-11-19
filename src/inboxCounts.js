import { useEffect, useState } from 'react'
import { getContactRequests, getSeatRequests } from './api'

/**
 * Pending Inbox counts (Contact Requests + Seat Requests).
 *
 * Lives outside AdminInbox so the Client Admin portal can import the counters
 * without pulling the whole Inbox screen into the main bundle.
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
