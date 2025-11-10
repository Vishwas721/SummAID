import { useState, useEffect } from 'react'
import { useAuth } from './auth/AuthContext'
import axios from 'axios'
import { PatientSidebar } from './components/PatientSidebar'
import './App.css'
import { PatientChartView } from './components/PatientChartView'
import { cn } from './lib/utils'

function App() {
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking...')
  const { user, logout } = useAuth()

  useEffect(() => {
    // Check API health when component mounts
    const checkApiHealth = async () => {
      try {
        // Use environment variable for API URL
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/`)
        console.log('API Response:', response.data)
        setApiStatus('connected')
      } catch (error) {
        console.error('API Error:', error)
        setApiStatus('error')
      }
    }

    checkApiHealth()
  }, [])

  const handleSelectPatient = (patientId) => {
    console.log('Selected patient:', patientId)
    setSelectedPatientId(patientId)
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
      {/* Sidebar */}
      <PatientSidebar 
        selectedPatientId={selectedPatientId}
        onSelectPatient={handleSelectPatient}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-lg blur-sm opacity-50 group-hover:opacity-75 transition duration-300 animate-pulse"></div>
              <h1 className="relative text-5xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight hover:scale-105 transition-transform duration-300 cursor-default">
                SummAID
              </h1>
            </div>
            <div className="border-l border-slate-300 dark:border-slate-600 pl-4 py-1">
              <p className="text-sm text-slate-600 dark:text-slate-400 font-semibold tracking-wide">Clinical Intelligence Platform</p>
              <p className="text-xs text-slate-500 dark:text-slate-500 italic">Powered by AI</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-2 h-2 rounded-full",
              apiStatus.includes('connected') ? "bg-green-500" : apiStatus.includes('checking') ? "bg-yellow-500 animate-pulse" : "bg-red-500"
            )} />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {user?.username || 'User'}
            </div>
            <button 
              onClick={logout} 
              className="text-xs font-medium px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all shadow-sm hover:shadow-md"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {selectedPatientId ? (
            <PatientChartView patientId={selectedPatientId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-12">
                <div className="inline-flex p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-2xl mb-6">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Patient Selected</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Select a patient from the sidebar to view their medical reports and generate AI-powered clinical summaries
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
