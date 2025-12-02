import { useEffect, useState } from 'react'
import axios from 'axios'
import { ChevronDown, UserCircle, LogOut } from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../auth/AuthContext'

/** Sticky header showing selected patient demographics and patient selector */
export function PatientHeader({ patientId, onSelectPatient }) {
  const [patient, setPatient] = useState(null)
  const [allPatients, setAllPatients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const { user, logout } = useAuth()

  // Filter patients based on search term
  const filteredPatients = allPatients.filter(p => {
    if (!searchTerm.trim()) return true
    const search = searchTerm.toLowerCase()
    const name = (p.patient_display_name || '').toLowerCase()
    const id = String(p.patient_id || '').toLowerCase()
    return name.includes(search) || id.includes(search)
  })

  // Update local patient state whenever selection or list changes
  useEffect(() => {
    if (allPatients.length && patientId != null) {
      const found = allPatients.find(p => String(p.patient_id) === String(patientId))
      setPatient(found || null)
    }
  }, [allPatients, patientId])

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true); setError(null)
        const role = localStorage.getItem('user_role') || 'DOCTOR'
        const endpoint = role === 'DOCTOR'
          ? `${import.meta.env.VITE_API_URL}/patients/doctor`
          : `${import.meta.env.VITE_API_URL}/patients`
        const resp = await axios.get(endpoint)
        const patients = resp.data || []
        setAllPatients(patients)
        if (patientId) {
          const found = patients.find(p => p.patient_id === patientId)
          setPatient(found || null)
        }
      } catch (e) {
        setError(e.message || 'Failed to load patients')
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [patientId])

  return (
    <div className={cn(
      'sticky top-0 z-40 w-full backdrop-blur-sm',
      'bg-white/85 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700',
      'shadow-sm flex items-center justify-between px-6 h-16'
    )}>
      <div className='flex items-center gap-6 min-w-0'>
        <h1 className='text-3xl font-black bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight'>SummAID</h1>
        <div className='border-l border-slate-300 dark:border-slate-600 pl-4 py-1'>
          <p className='text-xs text-slate-600 dark:text-slate-400 font-semibold'>Clinical Intelligence Platform</p>
          <p className='text-[10px] text-slate-500 dark:text-slate-500 italic'>Powered by AI</p>
        </div>
        
        {/* Patient Search Bar */}
        <div className='relative'>
          <input
            type='text'
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setShowSearchResults(true)
            }}
            onFocus={() => setShowSearchResults(true)}
            onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
            placeholder='Search patient by name or ID...'
            className='w-80 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
          />
          {showSearchResults && filteredPatients.length > 0 && (
            <div className='absolute top-full mt-2 left-0 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl z-50 max-h-96 overflow-auto'>
              {filteredPatients.slice(0, 50).map(p => (
                <button
                  key={p.patient_id}
                  onMouseDown={(e) => {
                    // Use onMouseDown to fire before input onBlur
                    e.preventDefault(); // Prevent input blur
                    console.log('PatientHeader: Search result MouseDown for:', p.patient_display_name, 'ID:', p.patient_id);
                    
                    setPatient(p)
                    if (onSelectPatient) {
                        console.log('PatientHeader: Invoking onSelectPatient with ID:', p.patient_id);
                        onSelectPatient(p.patient_id)
                    } else {
                        console.error('PatientHeader: onSelectPatient prop is missing!');
                    }
                    setSearchTerm('')
                    setShowSearchResults(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-200 dark:border-slate-700 last:border-b-0',
                    p.patient_id === patientId && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-sm font-medium text-slate-800 dark:text-slate-200'>{p.patient_display_name}</span>
                    <div className='flex items-center gap-2'>
                      <span className='text-xs text-slate-500'>ID {p.patient_id}</span>
                      {p.age != null && p.sex && (
                        <span className='text-xs text-slate-500'>{p.age}{p.sex}</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {filteredPatients.length > 50 && (
                <div className='px-4 py-2 text-xs text-slate-500 text-center border-t'>
                  Showing first 50 results. Refine search for more.
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Selected Patient Badge */}
        {patient && (
          <div className='flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800'>
            <span className='text-sm font-medium text-slate-700 dark:text-slate-300'>{patient.patient_display_name}</span>
            <span className='px-2 py-0.5 rounded-full bg-blue-500 text-white text-xs'>{patient.patient_id}</span>
            {patient.age != null && patient.sex && (
              <span className='px-2 py-0.5 rounded-full bg-purple-500 text-white text-xs'>{patient.age}{patient.sex}</span>
            )}
          </div>
        )}
      </div>
      <div className='flex items-center gap-4'>
        <div className='flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300'>
          <UserCircle className='h-4 w-4' />
          <span>{user?.username || 'User'}</span>
          <button
            onClick={() => {
              const currentRole = localStorage.getItem('user_role') || 'DOCTOR'
              const newRole = currentRole === 'DOCTOR' ? 'MA' : 'DOCTOR'
              console.log('🔄 Switching role from', currentRole, 'to', newRole)
              localStorage.setItem('user_role', newRole)
              window.location.reload()
            }}
            className='px-2 py-0.5 rounded-full text-xs font-bold transition-all hover:scale-105 cursor-pointer'
            style={{
              background: localStorage.getItem('user_role') === 'DOCTOR' 
                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' 
                : 'linear-gradient(135deg, #10b981, #14b8a6)',
              color: 'white',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
          >
            {localStorage.getItem('user_role') || 'DOCTOR'}
          </button>
        </div>
        <button
          onClick={logout}
          className='flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all'
        >
          <LogOut className='h-3.5 w-3.5' />
          Logout
        </button>
      </div>
    </div>
  )
}
