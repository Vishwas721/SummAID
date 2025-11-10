import { useState, useEffect } from 'react'
import axios from 'axios'
import { Users, Loader2, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

export function PatientSidebar({ selectedPatientId, onSelectPatient }) {
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  const filteredPatients = patients.filter(patient => {
    const name = patient.patient_display_name?.toLowerCase() || ''
    const id = patient.patient_id?.toString() || ''
    const search = searchTerm.toLowerCase()
    return name.includes(search) || id.includes(search)
  })

  return (
    <>
      {/* Collapse/Expand Toggle Button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-50 transition-all duration-300",
          "w-8 h-16 bg-gradient-to-r from-blue-500 to-purple-600",
          "text-white rounded-r-lg shadow-lg",
          "flex items-center justify-center",
          "hover:from-blue-600 hover:to-purple-700 hover:w-10",
          "transition-all duration-200",
          isCollapsed ? "left-0" : "left-80"
        )}
      >
        {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>

      <div className={cn(
        "h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-xl transition-all duration-300 overflow-hidden",
        isCollapsed ? "w-0 min-w-0" : "w-80 min-w-80"
      )}>

      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg shadow-lg">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Patients
            </h2>
            {!loading && !error && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {filteredPatients.length} of {patients.length} patient{patients.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        
        {/* Search Box */}
        {!loading && !error && patients.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all placeholder:text-slate-400"
            />
          </div>
        )}
      </div>

      {/* Patient List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {loading && (
          <div className="flex flex-col items-center justify-center p-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading patients...</p>
          </div>
        )}

        {error && (
          <div className="m-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Error Loading Patients</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && patients.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Users className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No patients found</p>
          </div>
        )}

        {!loading && !error && filteredPatients.length === 0 && patients.length > 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Search className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No patients match your search</p>
          </div>
        )}

        {!loading && !error && filteredPatients.length > 0 && (
          <ul className="space-y-2">
            {filteredPatients.map((patient) => {
              const patientId = patient.patient_id
              const displayName = patient.patient_display_name
              const isSelected = selectedPatientId === patientId
              
              return (
                <li key={patientId} className="group">
                  <button
                    onClick={() => onSelectPatient(patientId)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-lg transition-all duration-200",
                      "border-l-4 relative overflow-hidden",
                      "focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2",
                      isSelected 
                        ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 border-l-blue-500 shadow-md scale-[1.02]" 
                        : "bg-white dark:bg-slate-800/50 border-l-transparent hover:border-l-slate-300 dark:hover:border-l-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 hover:shadow-sm hover:scale-[1.01]"
                    )}
                  >
                    <div className={cn(
                      "text-sm font-semibold truncate transition-colors",
                      isSelected 
                        ? "text-blue-700 dark:text-blue-300" 
                        : "text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white"
                    )}>
                      {displayName}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        isSelected
                          ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      )}>
                        ID: {patientId}
                      </span>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 pointer-events-none" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">SummAID</span>
          <span className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full text-[10px] font-bold shadow-sm">
            v3-lite
          </span>
        </div>
      </div>
    </div>
    </>
  )
}
