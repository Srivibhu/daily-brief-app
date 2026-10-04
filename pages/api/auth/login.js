import bcrypt from 'bcryptjs'
import { sql } from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' })

  const { rows } = await sql`
    SELECT id, username, password_hash FROM users
    WHERE username = ${username.toLowerCase()} LIMIT 1`
  const user = rows[0]

  if (!user) return res.status(401).json({ error: 'Invalid username or password' })

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' })

  const token = signToken(user.id)
  setSessionCookie(res, token)
  return res.status(200).json({ user: { id: user.id, username: user.username } })
}
