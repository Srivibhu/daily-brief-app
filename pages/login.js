import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/ThemeToggle'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

// Mobile browsers (Safari ITP in particular) silently drop cookies set on
// cross-origin fetch responses, so the GIS popup/button flow doesn't work there.
// We detect mobile and use a full-page redirect flow instead — the cookie is set
// on a top-level GET response which all browsers accept.
function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleDiv = useRef(null)
  const [mobile, setMobile] = useState(false)

  // Detect mobile after mount (avoid SSR mismatch)
  useEffect(() => { setMobile(isMobileBrowser()) }, [])

  // Show error from redirect callback (e.g. ?error=google_denied)
  useEffect(() => {
    const { error: e } = router.query
    if (!e) return
    const msgs = {
      google_denied: 'Google sign-in was cancelled.',
      google_no_code: 'Google sign-in failed — no code returned.',
      google_failed: 'Google sign-in failed. Please try again.',
      google_config: 'Google login is not configured on this server.',
      google_missing_fields: 'Google account is missing required fields.',
    }
    setError(msgs[e] || 'Google sign-in failed.')
  }, [router.query])

  // Load Google Identity Services and render the button — desktop only
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || mobile) return
    const el = googleDiv.current
    if (!el) return

    function init() {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
      })
      window.google.accounts.id.renderButton(el, {
        type: 'standard',
        shape: 'rectangular',
        theme: 'outline',
        text: 'continue_with',
        size: 'large',
        width: el.offsetWidth || 280,
        logo_alignment: 'center',
      })
    }

    if (window.google?.accounts?.id) {
      init()
    } else {
      const script = document.getElementById('google-gsi') || (() => {
        const s = document.createElement('script')
        s.id = 'google-gsi'
        s.src = 'https://accounts.google.com/gsi/client'
        s.async = true
        s.defer = true
        document.head.appendChild(s)
        return s
      })()
      script.addEventListener('load', init)
      return () => script.removeEventListener('load', init)
    }
  }, [mobile]) // eslint-disable-line

  async function handleGoogleCredential({ credential }) {
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Google sign-in failed'); setLoading(false); return }
      router.push('/dashboard')
    } catch {
      setError('Network error'); setLoading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      router.push('/dashboard')
    } catch {
      setError('Network error'); setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <ThemeToggle className="login-theme" />
      <div className="panel login-card">
        <div className="login-head">
          <h1>Daily Brief</h1>
          <div className="sub">{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}</div>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            {mobile ? (
              // Full-page redirect — cookie is set on the top-level GET response,
              // which Safari and all mobile browsers accept (unlike fetch POST responses).
              <a href="/api/auth/google-redirect" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '10px 16px', borderRadius: 4, border: '1px solid var(--border)',
                background: 'var(--card)', color: 'var(--ink)', textDecoration: 'none',
                fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500, boxSizing: 'border-box',
              }}>
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.1 33.9 29.6 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z"/>
                  <path fill="#34A853" d="M6.3 14.7l7 5.1C15.1 16.1 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 16.1 3 9.3 7.9 6.3 14.7z"/>
                  <path fill="#FBBC05" d="M24 45c5.5 0 10.4-1.9 14.2-5l-6.6-5.4C29.6 36.1 27 37 24 37c-5.5 0-10.2-3.5-11.8-8.4l-7 5.4C8.5 41.6 15.7 45 24 45z"/>
                  <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.4-2.4 4.4-4.5 5.8l6.6 5.4C41.5 36.4 45 31 45 24c0-1.4-.1-2.7-.5-4z"/>
                </svg>
                Continue with Google
              </a>
            ) : (
              // Desktop: GIS-rendered button (popup flow works fine without ITP interference)
              <div ref={googleDiv} style={{ display: 'flex', justifyContent: 'center', minHeight: 44, marginBottom: 4 }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--sub)', whiteSpace: 'nowrap' }}>or with username</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          </>
        )}

        <form onSubmit={submit}>
          <div className="field-label" style={{ marginTop: 0 }}>Username</div>
          <input className="due-input" style={{ width: '100%', padding: '9px 10px', fontSize: 13 }} value={username}
            onChange={e => setUsername(e.target.value)} placeholder="your_name" autoComplete="username" required />
          <div className="field-label">Password</div>
          <input className="due-input" style={{ width: '100%', padding: '9px 10px', fontSize: 13 }} type="password" value={password}
            onChange={e => setPassword(e.target.value)} placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          {error && (
            <div style={{ background: 'rgba(184,50,50,.08)', border: '1px solid rgba(184,50,50,.3)', borderRadius: 5, padding: '8px 12px',
              fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--red)', marginTop: 14 }}>{error}</div>
          )}
          <button type="submit" className="btn" disabled={loading} style={{ width: '100%', padding: 11, fontSize: 13, marginTop: 18 }}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 18, fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--sub)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', color: 'var(--blue)', fontSize: 12, cursor: 'pointer', border: 'none', padding: 0 }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
