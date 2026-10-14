import { OAuth2Client } from 'google-auth-library'
import { sql } from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'
import { rateLimit, limited, clientIp } from '../../../lib/security'

// POST { credential } — Google One Tap / Sign In With Google ID token
// Verifies the token, upserts the user (by google_id, falling back to email), issues a session.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { credential } = req.body || {}
  if (typeof credential !== 'string' || !credential) return res.status(400).json({ error: 'Missing credential' })

  // Rate-limit by IP
  if (limited(res, rateLimit('google:ip:' + clientIp(req), { max: 20, windowMs: 15 * 60e3 }))) return

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) return res.status(500).json({ error: 'Google login is not configured on this server' })

  let payload
  try {
    const client = new OAuth2Client(clientId)
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId })
    payload = ticket.getPayload()
  } catch {
    return res.status(401).json({ error: 'Invalid Google credential' })
  }

  const { sub: googleId, email, name, given_name } = payload
  if (!googleId || !email) return res.status(400).json({ error: 'Google account missing required fields' })

  // Ensure table has google_id column (lazy migration)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`

  // Look up by google_id first, then email (handles accounts that pre-existed without Google)
  let { rows } = await sql`SELECT id, username FROM users WHERE google_id = ${googleId} LIMIT 1`
  let user = rows[0]

  if (!user) {
    // Try matching by email for existing password accounts
    const byEmail = await sql`SELECT id, username FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`
    if (byEmail.rows[0]) {
      // Link the Google ID to the existing account
      await sql`UPDATE users SET google_id = ${googleId} WHERE id = ${byEmail.rows[0].id}`
      user = byEmail.rows[0]
    }
  }

  if (!user) {
    // New user — derive a username from their name or email
    const base = (given_name || name || email.split('@')[0])
      .toLowerCase().replace(/[^a-z0-9._+-]/g, '').slice(0, 30) || 'user'
    // Find an unused username
    let username = base, suffix = 1
    while (true) {
      const { rows: taken } = await sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
      if (!taken.length) break
      username = `${base}${suffix++}`
    }
    const { rows: created } = await sql`
      INSERT INTO users (username, password_hash, google_id, email)
      VALUES (${username}, '', ${googleId}, ${email.toLowerCase()})
      RETURNING id, username`
    user = created[0]
  }

  const token = signToken(user.id)
  setSessionCookie(res, token)
  return res.status(200).json({ user: { id: user.id, username: user.username } })
}
