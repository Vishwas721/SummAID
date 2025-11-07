import { useState, useEffect } from 'react'
import axios from 'axios'
import { PatientSidebar } from './components/PatientSidebar'
import './App.css'

function App() {
  const [selectedPatientId, setSelectedPatientId] = useState(null)
  const [apiStatus, setApiStatus] = useState('checking...')

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
        <div className="bg-card border-b border-border px-6 py-4">
          <h1 className="text-2xl font-bold text-card-foreground">SummAID</h1>
          <p className="text-sm text-muted-foreground">
            Clinical Intelligence Platform - API Status: {apiStatus}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {selectedPatientId ? (
            <div className="max-w-4xl">
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold text-card-foreground mb-2">
                  Patient Details
                </h2>
                <p className="text-muted-foreground mb-4">
                  Selected Patient ID: <span className="font-mono text-primary">{selectedPatientId}</span>
                </p>
                <div className="text-sm text-muted-foreground">
                  Summary and report viewer will be implemented in the next tasks.
                </div>
              </div>
            </div>
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
