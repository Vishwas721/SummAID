import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const STORAGE_KEY = 'summAidAuth'

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed?.loggedIn) {
          setIsAuthenticated(true)
          setUser(parsed.user || { username: 'demo' })
        }
      }
    } catch (e) {
      console.warn('Auth init failed', e)
    }
  }, [])

  const login = (username = 'demo') => {
    setIsAuthenticated(true)
    setUser({ username })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ loggedIn: true, user: { username } }))
    } catch {}
  }

  const logout = () => {
    setIsAuthenticated(false)
    setUser(null)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  const value = useMemo(() => ({ isAuthenticated, user, login, logout }), [isAuthenticated, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
