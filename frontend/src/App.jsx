import { useState, useEffect } from 'react'
import { useAuth } from './auth/AuthContext'
import axios from 'axios'
import { PatientSidebar } from './components/PatientSidebar'
import './App.css'
import { PatientHeader } from './components/PatientHeader'
import { ToolsSidebar } from './components/ToolsSidebar'
import { SummaryPanel } from './components/SummaryPanel'
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
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
      {/* Sticky Patient Header */}
      <PatientHeader patientId={selectedPatientId} />
      {/* Below header: three column professional layout */}
      <div className="flex-1 grid grid-cols-[280px_minmax(0,1fr)_320px] gap-0 overflow-hidden">
        {/* Left Tools Sidebar */}
        <ToolsSidebar patientId={selectedPatientId} summary={null} citations={[]} />
        
        {/* Center Main Content - Summary & Infographics */}
        <div className="overflow-hidden">
          {selectedPatientId ? (
            <SummaryPanel patientId={selectedPatientId} />
          ) : (
            <div className="flex items-center justify-center h-full bg-white dark:bg-slate-800">
              <div className="text-center p-12">
                <div className="inline-flex p-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-2xl mb-6">
                  <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">No Patient Selected</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Choose a patient from the right sidebar to view their clinical summary</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Right Navigation Sidebar (Patient List) */}
        <PatientSidebar 
          selectedPatientId={selectedPatientId}
          onSelectPatient={handleSelectPatient}
        />
      </div>
    </div>
  )
}

export default App
