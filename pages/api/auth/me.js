import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'

export default withAuth(async function handler(req, res) {
  const { rows } = await sql`
    SELECT id, username, created_at FROM users WHERE id = ${req.userId} LIMIT 1`
  const user = rows[0]
  if (!user) return res.status(404).json({ error: 'User not found' })
  return res.status(200).json({ user })
})
