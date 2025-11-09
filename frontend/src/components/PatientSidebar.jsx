import { useState, useEffect } from 'react'
import axios from 'axios'
import { Users, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

export function PatientSidebar({ selectedPatientId, onSelectPatient }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/patients`)
        setPatients(response.data)
      } catch (err) {
        console.error('Failed to fetch patients:', err)
        setError(err.message || 'Failed to load patients')
      } finally {
        setLoading(false)
      }
    }

    fetchPatients()
  }, [])

  return (
    <div className="w-72 h-screen bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Patients</h2>
        </div>
        {!loading && !error && (
          <p className="text-sm text-muted-foreground mt-1">
            {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {error && (
          <div className="p-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div className="p-4 text-center text-muted-foreground">
            No patients found
          </div>
        )}

        {!loading && !error && patients.length > 0 && (
          <ul className="py-2">
            {patients.map((patient) => {
              const patientId = patient.patient_demo_id || patient
              const displayName = patient.patient_display_name || patientId
              return (
                <li key={patientId}>
                  <button
                    onClick={() => onSelectPatient(patientId)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-accent transition-colors",
                      "border-l-4 border-transparent",
                      "focus:outline-none focus:bg-accent",
                      selectedPatientId === patientId && "bg-accent border-l-primary font-medium"
                    )}
                  >
                    <div className="text-sm text-card-foreground font-medium truncate">
                      {displayName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {patientId}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        SummAID v3-lite Demo
      </div>
    </div>
  )
}
