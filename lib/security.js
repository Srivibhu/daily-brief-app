// Small server-side guards: rate limits for the auth endpoints, password and username rules, link checks.

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory, per server instance. On Vercel each warm function keeps its own counts, so this slows
// down guessing rather than stopping a distributed attack; a shared store (Upstash/Vercel KV) can
// replace `hits` later without touching the callers.
const hits = new Map() // key -> array of timestamps (ms)

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown'
}

// Returns null when allowed, or the number of seconds to wait.
export function rateLimit(key, { max, windowMs }) {
  const now = Date.now()
  const list = (hits.get(key) || []).filter(t => now - t < windowMs)
  if (list.length >= max) { hits.set(key, list); return Math.ceil((windowMs - (now - list[0])) / 1000) }
  list.push(now); hits.set(key, list)
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k)
  return null
}

// Forget a key's failures (e.g. after a successful login)
export function clearLimit(key) { hits.delete(key) }

// Responds 429 and returns true when the request is over a limit
export function limited(res, wait) {
  if (wait === null) return false
  res.setHeader('Retry-After', String(wait))
  res.status(429).json({ error: `Too many attempts. Try again in ${wait > 90 ? Math.ceil(wait / 60) + ' minutes' : wait + ' seconds'}.` })
  return true
}

// ── Rules ─────────────────────────────────────────────────────────────────────
const COMMON = new Set(['password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'letmein1', 'welcome1', 'abc12345', 'football', 'baseball', 'sunshine', 'princess', 'dailybrief', '11111111', '00000000'])

export function passwordProblem(pw, username = '') {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters'
  if (pw.length > 200) return 'Password is too long'
  const low = pw.toLowerCase()
  if (COMMON.has(low)) return 'That password is too common. Pick something less guessable'
  if (username && low === String(username).toLowerCase()) return "Password can't be the same as your username"
  if (/^(.)\1+$/.test(pw)) return 'Password needs more than one repeated character'
  return null
}

export function usernameProblem(name) {
  if (typeof name !== 'string') return 'Username required'
  const n = name.trim()
  if (n.length < 3) return 'Username must be at least 3 characters'
  if (n.length > 40) return 'Username must be 40 characters or fewer'
  if (!/^[a-z0-9._@+-]+$/i.test(n)) return 'Use letters, numbers and . _ @ + - only'
  return null
}

// Only plain web links are stored for tasks (no javascript:, data: and the like)
export function cleanLink(link) {
  if (!link) return ''
  const s = String(link).trim().slice(0, 2000)
  try { const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s); return /^https?:$/.test(u.protocol) ? u.href : '' } catch { return '' }
}
