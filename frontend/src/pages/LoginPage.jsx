import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('demo')
  const [password, setPassword] = useState('demo')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const onSubmit = (e) => {
    e.preventDefault()
    // Accept any credentials (or demo/demo) for this fake login
    try {
      login(username || 'demo')
      navigate('/', { replace: true })
    } catch (e) {
      setError('Login failed')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-card-foreground mb-2">SummAID Demo Login</h1>
        <p className="text-sm text-muted-foreground mb-4">Use demo/demo or any credentials.</p>
        {error && (
          <div className="text-xs text-red-500 border border-red-500/40 bg-red-500/5 rounded-md p-2 mb-2">{error}</div>
        )}
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="username">Username</label>
            <input
              id="username"
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="demo"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="demo"
            />
          </div>
          <button
            type="submit"
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-primary text-primary-foreground hover:opacity-90"
          >
            Login
          </button>
        </form>
      </div>
    </div>
  )
}
