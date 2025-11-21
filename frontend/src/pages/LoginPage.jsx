import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { UserCircle, Stethoscope } from 'lucide-react'

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleRoleLogin = (role) => {
    // Store role in localStorage
    localStorage.setItem('user_role', role)
    // Login with role as username for demo
    login(role === 'MA' ? 'Medical Assistant' : 'Doctor')
    // Redirect to dashboard
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-2">
            SummAID
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Select your role to continue</p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={() => handleRoleLogin('MA')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 shadow-sm hover:shadow-md group"
          >
            <UserCircle className="h-6 w-6 text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            <span>Login as Medical Assistant</span>
          </button>
          
          <button
            onClick={() => handleRoleLogin('DOCTOR')}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 text-base font-semibold rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
          >
            <Stethoscope className="h-6 w-6" />
            <span>Login as Doctor</span>
          </button>
        </div>
        
        <p className="mt-6 text-xs text-center text-slate-500 dark:text-slate-400">
          Demo environment • All data is fictional
        </p>
      </div>
    </div>
  )
}
