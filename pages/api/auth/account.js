import bcrypt from 'bcryptjs'
import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'
import { rateLimit, limited, clearLimit, passwordProblem, usernameProblem } from '../../../lib/security'

// PATCH { currentPassword, username?, newPassword? }
// Any change requires the current password.
export default withAuth(async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const { currentPassword, username, newPassword } = req.body || {}
  if (!currentPassword || typeof currentPassword !== 'string') return res.status(400).json({ error: 'Enter your current password' })
  const key = 'account:' + req.userId
  if (limited(res, rateLimit(key, { max: 8, windowMs: 15 * 60e3 }))) return

  const { rows } = await sql`SELECT id, username, password_hash FROM users WHERE id = ${req.userId} LIMIT 1`
  const user = rows[0]
  if (!user) return res.status(404).json({ error: 'User not found' })
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
