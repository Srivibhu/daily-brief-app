import bcrypt from 'bcryptjs'
import { sql } from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' })
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  // Check username availability
  const { rows: existing } = await sql`
    SELECT id FROM users WHERE username = ${username.toLowerCase()} LIMIT 1`
  if (existing.length) return res.status(409).json({ error: 'Username already taken' })

  // Hash password and create user
  const password_hash = await bcrypt.hash(password, 12)
  let user
  try {
    const { rows } = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${username.toLowerCase()}, ${password_hash})
      RETURNING id, username`
    user = rows[0]
  } catch {
    return res.status(500).json({ error: 'Registration failed' })
  }

  const token = signToken(user.id)
  setSessionCookie(res, token)
  return res.status(201).json({ user: { id: user.id, username: user.username } })
}
