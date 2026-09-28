import { useState } from 'react'
import { useRouter } from 'next/router'

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
        body: JSON.stringify({ username: username.trim(), password })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      router.push('/dashboard')
    } catch {
      setError('Network error'); setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)'
    }}>
      <div style={{
        width: 360, background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: 36
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: 'var(--text)', fontFamily: 'Georgia, serif' }}>
          Daily Brief
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 28 }}>
          {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace'}
        </p>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
              Username
            </label>
            <input
              value={username} onChange={e => setUsername(e.target.value)}
              placeholder="your_name" autoComplete="username" required
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>
          {error && (
            <div style={{ background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: 6,
              padding: '8px 12px', fontSize: 13, color: '#fca5a5', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={loading}
            style={{ width: '100%', padding: '11px', fontSize: 15 }}>
            {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text2)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', color: 'var(--accent)', fontSize: 13, cursor: 'pointer',
              border: 'none', padding: 0 }}>
            {mode === 'login' ? 'Register' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
