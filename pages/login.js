import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/ThemeToggle'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const googleDiv = useRef(null)

  // Load Google Identity Services and render the button
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
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
  }, []) // eslint-disable-line

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
            <div ref={googleDiv} style={{ display: 'flex', justifyContent: 'center', minHeight: 44, marginBottom: 4 }} />
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
