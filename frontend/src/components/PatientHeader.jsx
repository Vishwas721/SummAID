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
  const [showDropdown, setShowDropdown] = useState(false)
  const { user, logout } = useAuth()

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
        
        {/* Patient Selector Dropdown */}
        <div className='relative'>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className='flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all'
          >
            {patient ? (
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]'>{patient.patient_display_name}</span>
                <span className='px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs'>{patient.patient_id}</span>
                {patient.age != null && patient.sex && (
                  <span className='px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs'>{patient.age}{patient.sex}</span>
                )}
              </div>
            ) : (
              <span className='text-sm text-slate-500 dark:text-slate-400'>Select Patient</span>
            )}
            <ChevronDown className='h-4 w-4 text-slate-500' />
          </button>
          {showDropdown && (
            <div className='absolute top-full mt-2 left-0 w-80 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl z-50 max-h-96 overflow-auto'>
              {allPatients.map(p => (
                <button
                  key={p.patient_id}
                  onClick={() => { onSelectPatient(p.patient_id); setShowDropdown(false) }}
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
            </div>
          )}
        </div>
      </div>
      <div className='flex items-center gap-4'>
        <div className='flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300'>
          <UserCircle className='h-4 w-4' />
          <span>{user?.username || 'User'}</span>
          <span className='text-xs text-slate-500'>({localStorage.getItem('user_role')})</span>
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
