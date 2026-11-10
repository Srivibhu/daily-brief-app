import { OAuth2Client } from 'google-auth-library'

// GET — build the Google OAuth2 authorization URL and redirect the browser there.
// Used by mobile clients where the GIS popup/iframe flow fails to set cookies
// (Safari ITP drops Set-Cookie on cross-origin fetch responses).
export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return res.status(500).json({ error: 'Google login is not configured' })

  const origin = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.host}`
  const redirectUri = `${origin}/api/auth/google-callback`

  const client = new OAuth2Client(clientId, clientSecret, redirectUri)
  const url = client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
  })

  res.redirect(302, url)
}
