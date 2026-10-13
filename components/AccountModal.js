import { useEffect, useState } from 'react'
import { api } from '../lib/util'

// Change username and/or password. Both need the current password.
export default function AccountModal({ user, onSaved, onClose, onExport, onSignOut }) {
  const [username, setUsername] = useState(user?.username || '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null) // { ok, text }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const nameChanged = username.trim().toLowerCase() !== (user?.username || '')
  const pwChanged = next.length > 0

  async function save(e) {
    e.preventDefault()
    setMsg(null)
    if (!nameChanged && !pwChanged) return setMsg({ ok: false, text: 'Nothing to change.' })
    if (pwChanged && next !== confirm) return setMsg({ ok: false, text: "New passwords don't match." })
    if (!current) return setMsg({ ok: false, text: 'Enter your current password to save.' })
    setBusy(true)
    const body = { currentPassword: current }
    if (nameChanged) body.username = username
    if (pwChanged) body.newPassword = next
    try {
      const d = await api('/api/auth/account', { method: 'PATCH', body })
      if (d?.user) {
        onSaved(d.user)
        setUsername(d.user.username); setCurrent(''); setNext(''); setConfirm('')
        setMsg({ ok: true, text: [nameChanged && 'Username updated', pwChanged && 'Password updated'].filter(Boolean).join(' · ') + '.' })
      } else setMsg({ ok: false, text: d?.error || 'Could not save.' })
    } catch { setMsg({ ok: false, text: 'Network error.' }) }
    setBusy(false)
  }

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <form className="modal account-sheet" onSubmit={save} role="dialog" aria-modal="true" aria-label="Account settings">
        <div className="detail-head">
          <h2>Account</h2>
          <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <label className="acct-field">
          <span>Username</span>
          <input className="field-input" value={username} autoComplete="username" onChange={e => setUsername(e.target.value)} />
          <small>Your greeting uses this name.</small>
        </label>

        <div className="acct-group">Change password</div>
        <label className="acct-field">
          <span>New password</span>
          <input className="field-input" type="password" value={next} autoComplete="new-password" placeholder="Leave blank to keep" onChange={e => setNext(e.target.value)} />
        </label>
        <label className="acct-field">
          <span>Confirm new password</span>
          <input className="field-input" type="password" value={confirm} autoComplete="new-password" onChange={e => setConfirm(e.target.value)} />
        </label>

        <label className="acct-field acct-current">
          <span>Current password</span>
          <input className="field-input" type="password" value={current} autoComplete="current-password" onChange={e => setCurrent(e.target.value)} />
          <small>Needed to save any change.</small>
        </label>

        {msg && <p className={`acct-msg${msg.ok ? ' ok' : ''}`} role="status">{msg.text}</p>}
        <div className="detail-footer">
          <button type="button" className="link-btn" onClick={onClose}>Close</button>
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
        {(onExport || onSignOut) && (
          <div className="acct-more">
            {onExport && <button type="button" className="link-btn" onClick={onExport}>Export my data</button>}
            {onSignOut && <button type="button" className="link-btn danger" onClick={onSignOut}>Sign out</button>}
          </div>
        )}
      </form>
    </div>
  )
}
