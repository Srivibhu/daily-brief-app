import jwt from 'jsonwebtoken'
import { parse, serialize } from 'cookie'

const JWT_SECRET = process.env.JWT_SECRET
const COOKIE_NAME = 'db_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days — "remember me" by default

// Sign a JWT containing the user id
export function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '30d' })
}

// Verify and decode a JWT; returns { sub: userId } or null
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

// Set the session cookie on the response
export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  }))
}

// Clear the session cookie
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  }))
}

// Parse and verify the session cookie from the request
// Returns userId string or null
export function getUserFromRequest(req) {
  const cookies = parse(req.headers.cookie || '')
  const token = cookies[COOKIE_NAME]
  if (!token) return null
  const payload = verifyToken(token)
  return payload ? payload.sub : null
}

// Higher-order helper: wrap an API handler requiring auth
// Injects userId into req.userId; returns 401 if not authenticated
export function withAuth(handler) {
  return (req, res) => {
    const userId = getUserFromRequest(req)
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    req.userId = userId
    return handler(req, res)
  }
}
