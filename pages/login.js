import { useState } from 'react'
import { useRouter } from 'next/router'
import ThemeToggle from '../components/ThemeToggle'

export default function Login() {
  const router = useRouter()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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
      <div className="panel" style={{ width: 360, maxWidth: '100%', padding: 32, background: 'var(--s1)' }}>
        <div className="top-bar" style={{ display: 'block', marginBottom: 22 }}>
          <h1>Daily Brief</h1>
          <div className="sub">{mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}</div>
        </div>
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
