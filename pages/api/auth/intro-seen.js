import { withAuth } from '../../../lib/auth'
import { sql } from '../../../lib/db'

// POST — mark the intro as seen for the authenticated user.
// Called when the Everfall tour ends so the flag survives across devices and account re-logins.
export default withAuth(async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  await sql`UPDATE users SET intro_seen = TRUE WHERE id = ${req.userId}`
  return res.status(200).json({ ok: true })
})
