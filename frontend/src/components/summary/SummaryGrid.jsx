import { useState, useEffect } from 'react'
import axios from 'axios'
import { Loader2, AlertTriangle, ChevronDown, ChevronUp, History, Download } from 'lucide-react'
import { PatientTimeline } from './PatientTimeline'
import { EvolutionCard } from './EvolutionCard'
import { ActionPlanCard } from './ActionPlanCard'
import { VitalTrendsCard } from './VitalTrendsCard'
import { OncologyCard } from './OncologyCard'
import { SpeechCard } from './SpeechCard'
import { PdfCitationViewer } from './PdfCitationViewer'

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
    console.log('🚨🚨🚨 SummaryGrid: useEffect TRIGGERED');
    console.log('🔑 patientId:', patientId, 'Type:', typeof patientId);
    console.log('👤 userRole:', userRole);
    console.log('✅ Should fetch?', patientId && userRole === 'DOCTOR');
    
    if (patientId && userRole === 'DOCTOR') {
      console.log('🚀 SummaryGrid: CALLING fetchSummary and fetchReports');
      fetchSummary()
      fetchReports()
    } else {
      console.log('❌ SummaryGrid: NOT fetching - clearing data');
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
    console.log('🔥🔥🔥 SummaryGrid.fetchSummary CALLED for patientId:', patientId);
    console.log('🌐 VITE_API_URL:', import.meta.env.VITE_API_URL);
    
    setLoading(true)
    setError(null)
    
    try {
      const url = `${import.meta.env.VITE_API_URL}/summary/${encodeURIComponent(patientId)}`
      console.log('📡 SummaryGrid: Fetching from URL:', url);
      
      const response = await axios.get(url)
      console.log('✅✅✅ SummaryGrid: Response received, status:', response.status);
      console.log('📦 SummaryGrid: Response data:', response.data);
      
      const data = response.data || {}
      
      // Parse structured JSON from summary_text (now in AIResponseSchema format)
      let parsedSummary = null
      if (data.summary_text) {
        console.log('📝 SummaryGrid: summary_text exists, length:', data.summary_text.length);
        try {
          parsedSummary = JSON.parse(data.summary_text)
          console.log('✅ SummaryGrid: Successfully parsed AIResponseSchema:', parsedSummary);
          console.log('📊 Structure check - universal:', !!parsedSummary.universal, 'oncology:', !!parsedSummary.oncology, 'speech:', !!parsedSummary.speech);
        } catch (e) {
          console.error('❌ SummaryGrid: Failed to parse summary JSON:', e)
          // Fallback: treat as plain text
          parsedSummary = { 
            universal: {
              evolution: data.summary_text,
              current_status: [],
              plan: []
            }
          }
          console.log('⚠️ SummaryGrid: Using fallback plain text structure');
        }
      } else {
        console.log('❌ SummaryGrid: No summary_text in response');
      }
      
      console.log('💾 SummaryGrid: Setting summaryData state');
      setSummaryData({
        ...parsedSummary,
        citations: Array.isArray(data.citations) ? data.citations : []
      })
      console.log('🎉 SummaryGrid: Summary data set successfully');
    } catch (e) {
      console.log('💥💥💥 SummaryGrid: CATCH BLOCK - Error occurred');
      console.log('Error object:', e);
      console.log('Error response:', e.response);
      console.log('Error status:', e.response?.status);
      
      if (e.response?.status === 404) {
        console.log('⚠️ SummaryGrid: 404 Not Found - setting summaryData to null');
        setSummaryData(null)
      } else {
        console.error('❌ SummaryGrid: Fetch summary error:', e)
        setError(e.response?.data?.detail || e.message || 'Failed to load summary')
      }
    } finally {
      console.log('🏁 SummaryGrid: Finally block - setting loading=false');
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              title="Export the AI-generated clinical summary (without original report text) as a PDF for sharing or EHR upload."
              onClick={() => {
                try {
                  import('jspdf').then(async (mod) => {
                    const JsPDF = mod.jsPDF || mod.default
                    const doc = new JsPDF({ unit: 'pt', format: 'a4' })
                    const lineHeight = 14
                    const marginX = 40
                    const pageHeight = doc.internal.pageSize.getHeight()
                    const pageWidth = doc.internal.pageSize.getWidth()
                    const maxWidth = pageWidth - marginX * 2
                    let cursorY = 50
                    const writeLine = (text, opts = {}) => {
                      const lines = doc.splitTextToSize(String(text ?? ''), maxWidth)
                      lines.forEach(l => {
                        if (cursorY > pageHeight - 40) { doc.addPage(); cursorY = 50 }
                        doc.text(l, marginX, cursorY, opts)
                        cursorY += lineHeight
                      })
                    }
                    doc.setFontSize(16)
                    doc.text('Clinical Summary', marginX, cursorY)
                    cursorY += 24
                    doc.setFontSize(10)
                    writeLine(`Patient ID: ${patientId}`)
                    cursorY += 6
                    doc.setFontSize(12); doc.text('Evolution', marginX, cursorY); cursorY += 18
                    doc.setFontSize(10); writeLine(summaryData.universal?.evolution || 'N/A')
                    cursorY += 10
                    doc.setFontSize(12); doc.text('Current Status', marginX, cursorY); cursorY += 18
                    doc.setFontSize(10); (summaryData.universal?.current_status || []).forEach((s,i) => writeLine(`${i+1}. ${s}`))
                    cursorY += 10
                    doc.setFontSize(12); doc.text('Plan', marginX, cursorY); cursorY += 18
                    doc.setFontSize(10); (summaryData.universal?.plan || []).forEach((p,i) => writeLine(`${i+1}. ${p}`))

                    // Inject chart snapshots (Vital Trends + Oncology) if present
                    try {
                      const { default: html2canvas } = await import('html2canvas')
                      
                      // Capture Vital Trends chart
                      const vitalEl = document.getElementById('vital-trends-card')
                      if (vitalEl) {
                        const canvas = await html2canvas(vitalEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
                        const imgData = canvas.toDataURL('image/png')
                        const imgWidth = maxWidth
                        const imgHeight = canvas.height * (imgWidth / canvas.width)
                        if (cursorY + imgHeight > pageHeight - 40) { doc.addPage(); cursorY = 50 }
                        cursorY += 10; doc.setFontSize(12); doc.text('Vital Trends (Chart)', marginX, cursorY); cursorY += 16
                        doc.addImage(imgData, 'PNG', marginX, cursorY, imgWidth, imgHeight)
                        cursorY += imgHeight + 10
                      }

                      // Capture Oncology card (includes tumor size trend chart)
                      const oncoEl = document.getElementById('oncology-card')
                      if (oncoEl) {
                        const canvas = await html2canvas(oncoEl, { backgroundColor: '#ffffff', scale: 2, useCORS: true })
                        const imgData = canvas.toDataURL('image/png')
                        const imgWidth = maxWidth
                        const imgHeight = canvas.height * (imgWidth / canvas.width)
                        if (cursorY + imgHeight > pageHeight - 40) { doc.addPage(); cursorY = 50 }
                        cursorY += 10; doc.setFontSize(12); doc.text('Oncology (Chart)', marginX, cursorY); cursorY += 16
                        doc.addImage(imgData, 'PNG', marginX, cursorY, imgWidth, imgHeight)
                        cursorY += imgHeight + 10
                      }
                    } catch (e) {
                      // If chart capture fails, continue without blocking export
                      console.warn('Chart capture skipped:', e)
                    }

                    if (summaryData.oncology) {
                      cursorY += 10; doc.setFontSize(12); doc.text('Oncology', marginX, cursorY); cursorY += 18; doc.setFontSize(10)
                      Object.entries(summaryData.oncology).forEach(([k,v]) => writeLine(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`))
                    }
                    if (summaryData.speech) {
                      cursorY += 10; doc.setFontSize(12); doc.text('Speech/Audiology', marginX, cursorY); cursorY += 18; doc.setFontSize(10)
                      Object.entries(summaryData.speech).forEach(([k,v]) => writeLine(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`))
                    }
                    
                    // Footer note (citations available separately)
                    cursorY += 20
                    doc.setFontSize(8)
                    doc.setTextColor(100, 100, 100)
                    writeLine('This summary is AI-generated from medical records. Source citations available via "Export All Citations" button.')
                    
                    doc.save(`clinical_summary_${patientId}.pdf`)
                  })
                } catch (e) {
                  console.error('Summary PDF export failed', e)
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm"
            >
              Export Summary PDF
            </button>
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* DEBUG: Log summaryData structure */}
          {console.log('📊 SummaryGrid RENDER - summaryData:', summaryData)}
          {console.log('📊 Has universal?', !!summaryData.universal)}
          {console.log('📊 Has oncology?', !!summaryData.oncology)}
          {console.log('📊 Has speech?', !!summaryData.speech)}
          {console.log('📊 Has vital_trends?', !!summaryData.universal?.vital_trends)}
          
          {/* Evolution Card - Always present */}
          <EvolutionCard 
            evolution={summaryData.universal?.evolution} 
            citations={(summaryData.citations.filter(c => Array.isArray(c.sections) && c.sections.includes('evolution'))
              .concat(!summaryData.citations.some(c => Array.isArray(c.sections) && c.sections.includes('evolution')) ? summaryData.citations : []))}
            onOpenCitation={openCitation}
            className="lg:col-span-2"
          />

          {/* Action Plan Card - Always present */}
          <ActionPlanCard 
            currentStatus={summaryData.universal?.current_status || []}
            plan={summaryData.universal?.plan || []}
            citations={(summaryData.citations.filter(c => Array.isArray(c.sections) && (c.sections.includes('recommendations') || c.sections.includes('key_findings')))
              .concat(!summaryData.citations.some(c => Array.isArray(c.sections) && (c.sections.includes('recommendations') || c.sections.includes('key_findings'))) ? summaryData.citations : []))}
            onOpenCitation={openCitation}
          />

          {/* Vital Trends Card - Universal, shown when data exists */}
          <VitalTrendsCard 
            vitalData={summaryData.universal?.vital_trends || summaryData.vital_trends}
            className="lg:col-span-1"
          />

          {/* Oncology Card - Only show for oncology patients */}
          {summaryData.oncology && (
            <OncologyCard 
              oncologyData={summaryData.oncology}
              citations={(summaryData.citations.filter(c => Array.isArray(c.sections) && c.sections.includes('oncology'))
                .concat(!summaryData.citations.some(c => Array.isArray(c.sections) && c.sections.includes('oncology')) ? summaryData.citations : []))}
              onOpenCitation={openCitation}
              className="lg:col-span-2"
            />
          )}

          {/* Speech/Audiology Card - Only show for speech/hearing patients */}
          {summaryData.speech && (
            <SpeechCard 
              speechData={summaryData.speech}
              citations={(summaryData.citations.filter(c => Array.isArray(c.sections) && c.sections.includes('speech'))
                .concat(!summaryData.citations.some(c => Array.isArray(c.sections) && c.sections.includes('speech')) ? summaryData.citations : []))}
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
                    <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
                      {pdfError ? (
                        <div className="h-full w-full flex items-center justify-center">
                          <p className="text-sm text-red-600 dark:text-red-400">{pdfError}</p>
                        </div>
                      ) : (
                        <PdfCitationViewer file={pdfUrl} citation={selectedCitation} />
                      )}
                    </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Cited Text:</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{selectedCitation.source_full_text}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          title="Download original report PDF (clinician/legal reference)"
                          onClick={() => {
                            if (!pdfUrl) return
                            const a = document.createElement('a')
                            a.href = pdfUrl
                            a.download = `report_${selectedCitation.report_id}.pdf`
                            a.click()
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-300 hover:bg-slate-400 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded"
                        >
                          <Download className="h-3.5 w-3.5" /> Original Report
                        </button>
                        <button
                          onClick={() => {
                            const blob = new Blob([selectedCitation.source_full_text], { type: 'text/plain' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `citation_chunk_${selectedCitation.source_chunk_id}.txt`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded"
                        >
                          Export Text
                        </button>
                        <button
                          onClick={() => {
                            try {
                              const all = summaryData.citations.map(c => `Chunk ${c.source_chunk_id} (report ${c.report_id}, sections: ${c.sections?.join(',')})\n${c.source_full_text}\n\n`).join('')
                              const blob = new Blob([all], { type: 'text/plain' })
                              const url = URL.createObjectURL(blob)
                              const a = document.createElement('a')
                              a.href = url
                              a.download = `all_citations_patient_${patientId}.txt`
                              a.click()
                              URL.revokeObjectURL(url)
                            } catch (e) {
                              console.error('Export citations failed', e)
                            }
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                        >
                          Export All Citations
                        </button>
                      </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
