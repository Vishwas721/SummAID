import { useState, useEffect } from 'react'
import axios from 'axios'
import { PatientSidebar } from '../components/PatientSidebar'
import { PatientHeader } from '../components/PatientHeader'
import { ToolsSidebar } from '../components/ToolsSidebar'
import { SummaryPanel } from '../components/SummaryPanel'
import '../App.css'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../lib/utils'

export default function Dashboard() {
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking...')
  const { user, logout } = useAuth()

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
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
    setSelectedPatientId(patientId)
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950">
      {/* Sticky Patient Header */}
      <PatientHeader patientId={selectedPatientId} onSelectPatient={handleSelectPatient} />
      
      {/* Below header: full-width ToolsSidebar for DOCTOR */}
      <div className="flex-1 overflow-hidden">
        {localStorage.getItem('user_role') === 'DOCTOR' ? (
          <ToolsSidebar patientId={selectedPatientId} />
        ) : (
          <div className="w-full h-full overflow-auto">
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
                  <p className="text-sm text-slate-500 dark:text-slate-400">Select a patient from the header dropdown to view their clinical summary</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
