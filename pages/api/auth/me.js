import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const { rows } = await sql`
    SELECT id, username, created_at, google_id, password_hash FROM users WHERE id = ${req.userId} LIMIT 1`
  const user = rows[0]
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.status(200).json({ user: {
    id: user.id,
    username: user.username,
    created_at: user.created_at,
    isGoogleOnly: !!user.google_id && !user.password_hash,
  } })
})
