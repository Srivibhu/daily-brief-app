import bcrypt from 'bcryptjs'
import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'
import { rateLimit, limited, clearLimit, passwordProblem, usernameProblem } from '../../../lib/security'

// PATCH { currentPassword, username?, newPassword? } — update username / password
// DELETE { currentPassword } — permanently delete the account and all its data
export default withAuth(async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') return res.status(405).end()

  const { currentPassword, username, newPassword, googleConfirm } = req.body || {}
  const key = 'account:' + req.userId
  if (limited(res, rateLimit(key, { max: 8, windowMs: 15 * 60e3 }))) return

  // Ensure google_id column exists (lazy migration, same as google.js)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT`
  const { rows } = await sql`SELECT id, username, password_hash, google_id FROM users WHERE id = ${req.userId} LIMIT 1`
  const user = rows[0]
  if (!user) return res.status(404).json({ error: 'User not found' })

  const isGoogleOnly = !!user.google_id && !user.password_hash

  // DELETE — wipe the account and everything belonging to it
  if (req.method === 'DELETE') {
    if (isGoogleOnly) {
      // Google-only accounts: require typing "DELETE" to confirm
      if (googleConfirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm.' })
    } else {
      if (!currentPassword || typeof currentPassword !== 'string') return res.status(400).json({ error: 'Enter your current password' })
      if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
        return res.status(401).json({ error: 'Password is incorrect' })
      }
    }
    clearLimit(key)
    try {
      await sql`DELETE FROM focus_sessions WHERE user_id = ${user.id}`
      await sql`DELETE FROM daily_activity WHERE user_id = ${user.id}`
      await sql`DELETE FROM tasks WHERE user_id = ${user.id}`
      await sql`DELETE FROM tags WHERE user_id = ${user.id}`
      await sql`DELETE FROM pets WHERE user_id = ${user.id}`
      await sql`DELETE FROM users WHERE id = ${user.id}`
      res.setHeader('Set-Cookie', 'token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0')
      return res.status(200).json({ ok: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Could not delete account' })
    }
  }

  // PATCH — require password for password accounts
  if (!currentPassword || typeof currentPassword !== 'string') return res.status(400).json({ error: 'Enter your current password' })
  if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect' })
  }
  clearLimit(key)

  let nextName = user.username
  if (username !== undefined && username.trim().toLowerCase() !== user.username) {
    nextName = username.trim().toLowerCase()
    const badName = usernameProblem(nextName)
    if (badName) return res.status(400).json({ error: badName })
    const { rows: taken } = await sql`SELECT id FROM users WHERE username = ${nextName} AND id <> ${user.id} LIMIT 1`
    if (taken.length) return res.status(409).json({ error: 'Username already taken' })
  }

  let hash = user.password_hash
  if (newPassword) {
    const badPw = passwordProblem(newPassword, nextName)
    if (badPw) return res.status(400).json({ error: badPw.replace(/^Password/, 'New password') })
    hash = await bcrypt.hash(newPassword, 12)
  }

  if (nextName === user.username && hash === user.password_hash) {
    return res.status(200).json({ user: { id: user.id, username: user.username } })
  }

  try {
    const { rows: out } = await sql`
      UPDATE users SET username = ${nextName}, password_hash = ${hash}
      WHERE id = ${user.id} RETURNING id, username`
    return res.status(200).json({ user: out[0] })
  } catch {
    return res.status(500).json({ error: 'Could not update account' })
  }
})
