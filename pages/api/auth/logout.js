import { clearSessionCookie } from '../../../lib/auth'

export default function handler(req, res) {
  clearSessionCookie(res)
  return res.status(200).json({ ok: true })
}
