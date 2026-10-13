import bcrypt from 'bcryptjs'
import { sql } from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'
import { rateLimit, limited, clientIp, passwordProblem, usernameProblem } from '../../../lib/security'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) return res.status(400).json({ error: 'Username and password required' })
  // 5 new accounts per IP per hour
  if (limited(res, rateLimit('register:ip:' + clientIp(req), { max: 5, windowMs: 60 * 60e3 }))) return
  const bad = usernameProblem(username) || passwordProblem(password, username)
  if (bad) return res.status(400).json({ error: bad })

  // Check username availability
  const { rows: existing } = await sql`
    SELECT id FROM users WHERE username = ${username.trim().toLowerCase()} LIMIT 1`
  if (existing.length) return res.status(409).json({ error: 'Username already taken' })

  // Hash password and create user
  const password_hash = await bcrypt.hash(password, 12)
  let user
  try {
    const { rows } = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username.trim().toLowerCase()}, ${password_hash})
      RETURNING id, username`
    user = rows[0]
  } catch {
    return res.status(500).json({ error: 'Registration failed' })
  }

  const token = signToken(user.id)
  setSessionCookie(res, token)
  return res.status(201).json({ user: { id: user.id, username: user.username } })
}
