import bcrypt from 'bcryptjs'
import { sql } from '../../../lib/db'
import { signToken, setSessionCookie } from '../../../lib/auth'
import { rateLimit, clearLimit, limited, clientIp } from '../../../lib/security'

// compared against when the username doesn't exist, so a miss takes as long as a wrong password
const DUMMY_HASH = '$2a$12$s3c/h4mGbXNYfdSXgyhCGeh5ianM8JeSrhfqiSgZL5PmujtiuZ8ly'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { username, password } = req.body || {}
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) return res.status(400).json({ error: 'Username and password required' })

  // 10 tries per username per 15 min, 30 per IP per 15 min
  const ip = clientIp(req), uKey = 'login:u:' + username.toLowerCase()
  if (limited(res, rateLimit('login:ip:' + ip, { max: 30, windowMs: 15 * 60e3 }))) return
  if (limited(res, rateLimit(uKey, { max: 10, windowMs: 15 * 60e3 }))) return

  const { rows } = await sql`
    SELECT id, username, password_hash FROM users
    WHERE username = ${username.toLowerCase()} LIMIT 1`
  const user = rows[0]

  const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)
  if (!user || !valid) return res.status(401).json({ error: 'Invalid username or password' })
  clearLimit(uKey)

  const token = signToken(user.id)
  setSessionCookie(res, token)
  return res.status(200).json({ user: { id: user.id, username: user.username } })
}
