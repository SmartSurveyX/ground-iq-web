import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createUser,
  deleteUser,
  disableUser,
  enableUser,
  getStoredUser,
  listUsers,
  updateUser,
} from './api'
import { POWER_DEFS } from './AdminClientAdmins'
import { PortalSkeleton } from './PortalUI'

/**
 * Sub Client Admins — the Client Admin's delegation screen.
 * Each sub admin logs into the same portal and can do only what the Client
 * Admin grants here. A Client Admin can never grant a power they do not hold
 * themselves (server enforces the same clamp). Seats: default 2 per client,
 * Super Admin raises via max_sub_admins; 0 = unlimited.
 */
function initialsOf(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

const EMPTY_FORM = { username: '', name: '', phone: '', email: '', password: '' }

export default function AdminSubAdminsScreen({ onToast }) {
  const me = useMemo(() => getStoredUser() || {}, [])
  const seatCap = Number(me.max_sub_admins) || 0
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formPowers, setFormPowers] = useState(() => {
    // Default: the Client Admin's own powers ("same like" delegation)
    const o = {}
    for (const p of POWER_DEFS) o[p.key] = !!me[p.key]
    return o
  })
  const [drafts, setDrafts] = useState({})   // userId -> powers draft
  const [created, setCreated] = useState(null)
  const [openId, setOpenId] = useState(null)

  const load = useCallback(async (opts = {}) => {
    if (!opts.silent) setLoading(true)
    try {
      const d = await listUsers()
      setUsers(Array.isArray(d?.users) ? d.users : Array.isArray(d) ? d : [])
    } catch (e) {
      if (!opts.silent) onToast?.(e.message || 'Could not load sub admins', 'error')
    } finally {
      if (!opts.silent) setLoading(false)
    }
  }, [onToast])

  useEffect(() => { void load() }, [load])

  const subs = users.filter((u) => u.role === 'sub_client_admin')
  const seatsUsed = subs.length
  const seatsUnlimited = seatCap === 0
  const seatsFull = !seatsUnlimited && seatsUsed >= seatCap

  const myPowers = (key) => !!me[key]

  const toggleFormPower = (key) => {
    // A Client Admin can only delegate powers they hold themselves
    if (!myPowers(key)) return
    setFormPowers((p) => ({ ...p, [key]: !p[key] }))
  }

  async function handleCreate(e) {
    e.preventDefault()
    const typedUser = form.username.trim()
    if (!typedUser) return onToast?.('Enter a username', 'error')
    if (!form.password || form.password.length < 8) {
      return onToast?.('Password must be at least 8 characters', 'error')
    }
    if (seatsFull) {
      return onToast?.(`Sub Admin limit reached — max ${seatCap}. Ask Super Admin to raise it.`, 'error')
    }
    setSaving(true)
    try {
      const grants = {}
      for (const p of POWER_DEFS) grants[p.key] = !!formPowers[p.key]
      const res = await createUser({
        username: typedUser,
        password: form.password,
        name: (form.name || typedUser).trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        role: 'sub_client_admin',
        target_quota: 0,
        ...grants,
      })
      const createdUser = res?.user || {}
      const loginName = String(createdUser.username || typedUser).trim().toLowerCase()
      onToast?.(`Sub Client Admin created · username: ${loginName}`, 'ok')
      setCreated({ username: loginName, password: form.password, name: createdUser.name || form.name || loginName })
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      onToast?.(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function savePowers(u) {
    const id = Number(u.id)
    const draft = drafts[id] || null
    if (!draft) return
    setSaving(true)
    try {
      const body = {}
      // Always send every power so partial drafts cannot wipe others
      for (const p of POWER_DEFS) body[p.key] = !!draft[p.key]
      const res = await updateUser(id, body)
      if (res?.error) throw new Error(res.error)
      setUsers((list) => list.map((row) => (Number(row.id) === id ? { ...row, ...body } : row)))
      setDrafts((d) => {
        const next = { ...d }
        delete next[id]
        return next
      })
      const granted = POWER_DEFS.filter((p) => body[p.key]).length
      onToast?.(`Saved @${u.username} · ${granted}/${POWER_DEFS.length} features. They must re-login for changes.`, 'ok')
    } catch (e) {
      onToast?.(e.message || 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function removeSub(u) {
    if (!window.confirm(`Delete sub admin @${u.username}? They will lose portal access immediately.`)) return
    try {
      await deleteUser(Number(u.id))
      onToast?.(`Deleted @${u.username}`, 'ok')
      await load()
    } catch (e) {
      onToast?.(e.message || 'Delete failed', 'error')
    }
  }

  async function toggleActive(u) {
    try {
      if (u.active !== false) await disableUser(Number(u.id))
      else await enableUser(Number(u.id))
      setUsers((list) => list.map((row) => (Number(row.id) === Number(u.id) ? { ...row, active: u.active === false } : row)))
      onToast?.(u.active === false ? `Disabled @${u.username}` : `Enabled @${u.username}`, 'ok')
    } catch (e) {
      onToast?.(e.message || 'Update failed', 'error')
    }
  }

  const draftFor = (u) => {
    const id = Number(u.id)
    if (drafts[id]) return drafts[id]
    const o = {}
    for (const p of POWER_DEFS) o[p.key] = !!u[p.key]
    return o
  }
  const setDraftFor = (u, key) => {
    const id = Number(u.id)
    const current = draftFor(u)
    const next = { ...current, [key]: !current[key] }
    setDrafts((d) => ({ ...d, [id]: next }))
  }
  const dirtyCount = (u) => {
    const id = Number(u.id)
    const draft = drafts[id]
    if (!draft) return 0
    return POWER_DEFS.filter((p) => !!draft[p.key] !== !!u[p.key]).length
  }

  return (
    <div className="page-pad" style={{ maxWidth: 980, margin: '0 auto', padding: '18px 16px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Sub Client Admins</h2>
        <span style={{
          fontSize: 12, fontWeight: 700, color: seatsFull ? '#b91c1c' : '#15803d',
          background: seatsFull ? '#fef2f2' : '#f0fdf4', border: '1px solid #e2e8f0',
          padding: '4px 10px', borderRadius: 99,
        }}>
          {seatsUnlimited ? `${seatsUsed} sub admin${seatsUsed === 1 ? '' : 's'} · unlimited seats` : `${seatsUsed} of ${seatCap} seats used`}
        </span>
      </div>
      <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569' }}>
        Sub admins sign in on this portal with their own login and can only use the powers you grant below.
        They cannot see or manage other sub admins or your own account. Default 2 seats — Super Admin can raise them.
      </p>

      {created && (
        <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac', fontSize: 13 }}>
          <strong style={{ color: '#15803d' }}>Sub admin created ✓</strong> — share these credentials now
          (they are shown only once):{' '}
          <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 6 }}>{created.username}</code> /{' '}
          <code style={{ background: '#fff', padding: '2px 6px', borderRadius: 6 }}>{created.password}</code>
          <button type="button" className="btn small" style={{ marginLeft: 8 }} onClick={() => setCreated(null)}>Dismiss</button>
        </div>
      )}

      {/* create form */}
      <form
        onSubmit={handleCreate}
        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16, marginBottom: 18 }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Create a sub client admin</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            style={{ flex: 1, minWidth: 140, minHeight: 42, fontSize: 14, border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '0 10px' }}
          />
          <input
            placeholder="Display name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={{ flex: 1, minWidth: 140, minHeight: 42, fontSize: 14, border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '0 10px' }}
          />
          <input
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            style={{ flex: 1, minWidth: 140, minHeight: 42, fontSize: 14, border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '0 10px' }}
          />
          <input
            type="email"
            placeholder="Email (optional — credentials sent here)"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={{ flex: 1, minWidth: 160, minHeight: 42, fontSize: 14, border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '0 10px' }}
          />
          <input
            type="password"
            placeholder="Password (min 8)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            style={{ flex: 1, minWidth: 160, minHeight: 42, fontSize: 14, border: '1.5px solid #cbd5e1', borderRadius: 8, padding: '0 10px' }}
          />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', margin: '12px 0 6px' }}>
          Powers (defaults to your own; you can only delegate what you have)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {POWER_DEFS.map((p) => {
            const locked = !myPowers(p.key)
            return (
              <button
                key={p.key}
                type="button"
                title={locked ? `${p.label} — you do not have this power yourself` : p.hint}
                onClick={() => toggleFormPower(p.key)}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 99,
                  cursor: locked ? 'not-allowed' : 'pointer',
                  border: '1px solid ' + (formPowers[p.key] ? '#4f7dc6' : '#e2e8f0'),
                  background: formPowers[p.key] ? '#eef4fb' : '#f8fafc',
                  color: locked ? '#94a3b8' : formPowers[p.key] ? '#1f4e9c' : '#475569',
                  opacity: locked ? 0.55 : 1,
                }}
              >
                {p.icon} {p.label}
              </button>
            )
          })}
        </div>
        <button
          type="submit"
          className="btn primary"
          disabled={saving || seatsFull}
          style={{ marginTop: 12, minHeight: 44, fontSize: 14, fontWeight: 700, width: '100%' }}
        >
          {seatsFull ? 'Seat limit reached' : saving ? 'Creating…' : '＋ Create sub client admin'}
        </button>
      </form>

      {/* list */}
      {loading ? (
        <PortalSkeleton rows={3} />
      ) : subs.length === 0 ? (
        <div style={{ padding: '26px 10px', textAlign: 'center', color: '#64748b', fontSize: 14, background: '#f8fafc', borderRadius: 12 }}>
          No sub client admins yet — create one above.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {subs.map((u) => {
            const open = openId === Number(u.id)
            const draft = draftFor(u)
            const dirty = dirtyCount(u)
            return (
              <div key={String(u.id)} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', background: '#eef4fb', color: '#1f4e9c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14,
                  }}>
                    {initialsOf(u.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                      {u.name || u.username}{' '}
                      <span style={{ fontSize: 11, fontWeight: 600, color: u.active !== false ? '#15803d' : '#b91c1c' }}>
                        {u.active !== false ? '· active' : '· disabled'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>@{u.username}{u.phone ? ` · ${u.phone}` : ''}</div>
                  </div>
                  <button type="button" className="btn small" onClick={() => setOpenId(open ? null : Number(u.id))}>
                    {open ? 'Hide' : 'Powers'}
                    {dirty > 0 ? ` · ${dirty}` : ''}
                  </button>
                  <button type="button" className="btn small" onClick={() => void toggleActive(u)}>
                    {u.active !== false ? 'Disable' : 'Enable'}
                  </button>
                  <button type="button" className="btn small danger" onClick={() => void removeSub(u)}>Delete</button>
                </div>
                {open && (
                  <div style={{ marginTop: 12, borderTop: '1px solid #eef2f7', paddingTop: 12 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {POWER_DEFS.map((p) => {
                        const locked = !myPowers(p.key)
                        const on = !!draft[p.key]
                        return (
                          <button
                            key={p.key}
                            type="button"
                            title={locked ? `${p.label} — you do not have this power yourself` : p.hint}
                            onClick={() => setDraftFor(u, p.key)}
                            style={{
                              fontSize: 12, fontWeight: 700, padding: '6px 10px', borderRadius: 99,
                              cursor: locked ? 'not-allowed' : 'pointer',
                              border: '1px solid ' + (on ? '#4f7dc6' : '#e2e8f0'),
                              background: on ? '#eef4fb' : '#f8fafc',
                              color: locked ? '#94a3b8' : on ? '#1f4e9c' : '#475569',
                              opacity: locked ? 0.55 : 1,
                            }}
                          >
                            {p.icon} {p.label}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={saving || dirty === 0}
                      onClick={() => void savePowers(u)}
                      style={{ minHeight: 40, fontSize: 13, fontWeight: 700 }}
                    >
                      {saving ? 'Saving…' : dirty > 0 ? `Save ${dirty} change${dirty === 1 ? '' : 's'}` : 'Saved'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
