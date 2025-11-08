import { useState, useEffect } from 'react'
import { useAuth } from './auth/AuthContext'
import axios from 'axios'
import { PatientSidebar } from './components/PatientSidebar'
import './App.css'
import { PatientChartView } from './components/PatientChartView'

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
        setApiStatus(`connected - ${response.data.message || ''}`)
      } catch (error) {
        console.error('API Error:', error)
        setApiStatus('error connecting')
      }
    }

    checkApiHealth()
  }, [])

  const handleSelectPatient = (patientId) => {
    console.log('Selected patient:', patientId)
    setSelectedPatientId(patientId)
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <PatientSidebar 
        selectedPatientId={selectedPatientId}
        onSelectPatient={handleSelectPatient}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-card-foreground">SummAID</h1>
            <p className="text-sm text-muted-foreground">Clinical Intelligence Platform - API Status: {apiStatus}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">user: {user?.username || '—'}</span>
            <button onClick={logout} className="text-xs px-2 py-1 rounded border border-border bg-muted hover:bg-muted/70">Logout</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {selectedPatientId ? (
            <PatientChartView patientId={selectedPatientId} />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <p className="text-lg mb-2">No patient selected</p>
                <p className="text-sm">Select a patient from the sidebar to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
