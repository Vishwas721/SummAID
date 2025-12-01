import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, History } from 'lucide-react'
import { PatientTimeline } from './PatientTimeline'
import { EvolutionCard } from './EvolutionCard'
import { ActionPlanCard } from './ActionPlanCard'
import { VitalTrendsCard } from './VitalTrendsCard'
import { OncologyCard } from './OncologyCard'
import { SpeechCard } from './SpeechCard'

/**
 * SummaryGrid - Modern card-based layout for displaying structured patient summaries.
 * 
 * Replaces single text box with independent, loading cards for:
 * - Evolution (medical journey narrative)
 * - Action Plan (next steps checklist)
 * - Vital Trends (BP/vitals visualization)
 * - Specialty cards (oncology, speech/audiology)
 */
export function SummaryGrid({ patientId }) {
  const [summaryData, setSummaryData] = useState(null)
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [userRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  const [timelineExpanded, setTimelineExpanded] = useState(false)
  const [selectedCitation, setSelectedCitation] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfError, setPdfError] = useState(null)

  useEffect(() => {
    if (patientId && userRole === 'DOCTOR') {
      fetchSummary()
      fetchReports()
    } else {
      setSummaryData(null)
      setReports([])
    }
  }, [patientId, userRole])

  const fetchReports = async () => {
    try {
      const url = `${import.meta.env.VITE_API_URL}/reports/${patientId}`
      const response = await axios.get(url)
      setReports(Array.isArray(response.data) ? response.data : [])
    } catch (e) {
      console.error('Failed to fetch reports:', e)
      setReports([])
    }
  }

  const openCitation = async (citation) => {
    try {
      setPdfError(null)
      setSelectedCitation(citation)
      const apiUrl = import.meta.env.VITE_API_URL
      const res = await fetch(`${apiUrl}/report/${citation.report_id}/pdf`)
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const blob = await res.blob()
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (e) {
      console.error('Failed to open citation PDF:', e)
      setPdfError(e?.message || 'Failed to load PDF')
      setPdfUrl(null)
    }
  }

  const closePdfViewer = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
    setSelectedCitation(null)
    setPdfError(null)
  }

  const fetchSummary = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const url = `${import.meta.env.VITE_API_URL}/summary/${encodeURIComponent(patientId)}`
      const response = await axios.get(url)
      const data = response.data || {}
      
      // Parse structured JSON from summary_text
      let parsedSummary = null
      if (data.summary_text) {
        try {
          parsedSummary = JSON.parse(data.summary_text)
        } catch (e) {
          console.error('Failed to parse summary JSON:', e)
          // Fallback: treat as plain text
          parsedSummary = { 
            universal: {
              evolution: data.summary_text,
              current_status: [],
              plan: []
            }
          }
        }
      }
      
      setSummaryData({
        ...parsedSummary,
        citations: Array.isArray(data.citations) ? data.citations : []
      })
    } catch (e) {
      if (e.response?.status === 404) {
        setSummaryData(null)
      } else {
        console.error('Fetch summary error:', e)
        setError(e.response?.data?.detail || e.message || 'Failed to load summary')
      }
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Loading summary...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-md w-full p-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300 mb-1">Error Loading Summary</p>
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // No data state
  if (!summaryData || !summaryData.universal) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No summary available</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Waiting for MA to generate chart</p>
        </div>
      </div>
    )
  }

  // Card grid layout
  return (
    <div className="h-full w-full overflow-auto bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Clinical Summary</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Patient ID: {patientId} {summaryData.specialty && `• ${summaryData.specialty.toUpperCase()}`}
          </p>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Evolution Card - Always present */}
          <EvolutionCard 
            evolution={summaryData.universal?.evolution} 
            citations={summaryData.citations}
            onOpenCitation={openCitation}
            className="lg:col-span-2"
          />

          {/* Action Plan Card - Always present */}
          <ActionPlanCard 
            currentStatus={summaryData.universal?.current_status || []}
            plan={summaryData.universal?.plan || []}
            citations={summaryData.citations}
            onOpenCitation={openCitation}
          />

          {/* Vital Trends Card - Universal, shown if data exists */}
          <VitalTrendsCard 
            vitalData={summaryData.universal?.vital_trends}
            className="lg:col-span-1"
          />

          {/* Oncology Card - Conditional */}
          {summaryData.oncology && (
            <OncologyCard 
              oncologyData={summaryData.oncology}
              citations={summaryData.citations}
              onOpenCitation={openCitation}
              className="lg:col-span-2"
            />
          )}

          {/* Speech/Audiology Card - Conditional */}
          {summaryData.speech && (
            <SpeechCard 
              speechData={summaryData.speech}
              citations={summaryData.citations}
              onOpenCitation={openCitation}
              className="lg:col-span-2"
            />
          )}
        </div>

        {/* Collapsible Patient Journey Timeline - Bottom Section */}
        {reports.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setTimelineExpanded(!timelineExpanded)}
              className="w-full group flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all shadow-sm hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <History className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Clinical Timeline
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {reports.length} report{reports.length !== 1 ? 's' : ''} • View chronological patient journey
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {timelineExpanded ? 'Hide' : 'Show'}
                </span>
                {timelineExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                )}
              </div>
            </button>

            {/* Animated Timeline Container */}
            <div 
              className={`overflow-hidden transition-all duration-500 ease-in-out ${
                timelineExpanded ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'
              }`}
            >
              <PatientTimeline reports={reports} />
            </div>
          </div>
        )}
      </div>

      {/* Sidebar removed by user request */}

      {/* Parent-managed PDF Viewer Modal */}
      {selectedCitation && (pdfUrl || pdfError) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Original Document</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Report ID: {selectedCitation.report_id} • Chunk: {selectedCitation.source_chunk_id}
                </p>
              </div>
              <button onClick={closePdfViewer} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              {pdfError ? (
                <div className="h-full w-full flex items-center justify-center">
                  <p className="text-sm text-red-600 dark:text-red-400">{pdfError}</p>
                </div>
              ) : (
                <iframe src={pdfUrl} className="w-full h-full" title="PDF Viewer" />
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Cited Text:</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCitation.source_full_text}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
