import { OAuth2Client } from 'google-auth-library'
import { sql } from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'
import { rateLimit, limited, clientIp } from '../../../lib/security'

// GET ?code=... — OAuth2 authorization code callback.
// Google redirects here after the user picks an account. We exchange the code
// for tokens, verify the ID token, upsert the user, set the session cookie as
// part of a top-level navigation response (so Safari ITP allows it), then send
// the browser to /dashboard.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { code, error: oauthError } = req.query
  if (oauthError) {
    // User denied access or something went wrong on Google's side
    return res.redirect(302, '/login?error=google_denied')
  }
  if (!code) return res.redirect(302, '/login?error=google_no_code')

  // Rate-limit by IP — same limits as the POST handler
  if (limited(res, rateLimit('google:ip:' + clientIp(req), { max: 20, windowMs: 15 * 60e3 }))) return

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return res.redirect(302, '/login?error=google_config')

  const origin = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`
  const redirectUri = `${origin}/api/auth/google-callback`

  let payload
  try {
    const client = new OAuth2Client(clientId, clientSecret, redirectUri)
    const { tokens } = await client.getToken(code)
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: clientId })
    payload = ticket.getPayload()
  } catch {
    return res.redirect(302, '/login?error=google_failed')
  }

  const { sub: googleId, email, name, given_name } = payload
  if (!googleId || !email) return res.redirect(302, '/login?error=google_missing_fields')

  // Lazy migrations
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE`
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`

  // Look up by google_id first, then email (links existing password accounts)
  let { rows } = await sql`SELECT id, username FROM users WHERE google_id = ${googleId} LIMIT 1`
  let user = rows[0]

  if (!user) {
    const byEmail = await sql`SELECT id, username FROM users WHERE email = ${email.toLowerCase()} LIMIT 1`
    if (byEmail.rows[0]) {
      await sql`UPDATE users SET google_id = ${googleId} WHERE id = ${byEmail.rows[0].id}`
      user = byEmail.rows[0]
    }
  }

  if (!user) {
    const base = (given_name || name || email.split('@')[0])
      .toLowerCase().replace(/[^a-z0-9._+-]/g, '').slice(0, 30) || 'user'
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

  // Set the session cookie on this top-level GET response — Safari allows it here
  const token = signToken(user.id)
  setSessionCookie(res, token)

  // Send the browser to the dashboard
  res.redirect(302, '/dashboard')
}
