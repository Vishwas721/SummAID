import { useState, useEffect, Children } from 'react'
import axios from 'axios'
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, X, Download } from 'lucide-react'
import { cn } from '../lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import jsPDF from 'jspdf'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { MedicalChartsPanel } from './MedicalChart'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export function SummaryPanel({ patientId }) {
  console.log('🎨 SummaryPanel RENDER - patientId prop:', patientId, 'Type:', typeof patientId);
  
  const [summary, setSummary] = useState('')
  const [citations, setCitations] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [chartPrepared, setChartPrepared] = useState(false)
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [userRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  const [selectedCitation, setSelectedCitation] = useState(null)
  const [pdfPanel, setPdfPanel] = useState({ open: false, src: null, page: 1, title: '', search: '' })
  // Edit state for doctor to modify and save official summary
  const [editMode, setEditMode] = useState(false)
  const [editedText, setEditedText] = useState('')
  
  console.log('🔍 Current state: summary length:', summary.length, 'generating:', generating, 'error:', error, 'chartPrepared:', chartPrepared);
  
  // PDF Viewer State
  const [numPages, setNumPages] = useState(null)
  const [pdfPageNumber, setPdfPageNumber] = useState(1)
  const [pdfLoading, setPdfLoading] = useState(false)

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
    setPdfLoading(false)
  }

  // Sync internal PDF page state when panel opens/changes
  useEffect(() => {
    if (pdfPanel.open && pdfPanel.page) {
      setPdfPageNumber(Number(pdfPanel.page) || 1)
    }
  }, [pdfPanel.open, pdfPanel.page, pdfPanel.src])
  const addInlineCitations = (text) => {
    if (!citations.length) return text
    
    // Split into paragraphs and add citation superscripts at end of each
    const paragraphs = text.split('\n\n')
    return paragraphs.map((para, idx) => {
      if (!para.trim() || para.startsWith('#') || para.startsWith('-') || para.startsWith('*')) {
        return para
      }
      // Add citations as superscript numbers at end of each paragraph
      const citationNums = citations.slice(0, 3).map((_, i) => `[${i + 1}]`).join('')
      return `${para} ${citationNums}`
    }).join('\n\n')
  }

  const [debugInfo, setDebugInfo] = useState({ status: 'idle', url: '', error: null, response: null })

  useEffect(() => {
    console.log('🚨🚨🚨 SummaryPanel: useEffect TRIGGERED');
    console.log('🔑 patientId:', patientId, 'Type:', typeof patientId, 'Truthiness:', !!patientId);
    console.log('👤 userRole:', userRole);
    console.log('✅ Should fetch?', userRole === 'DOCTOR' && patientId);
    
    setSummary('')
    setCitations([])
    setError(null)
    setChartPrepared(false)
    setChiefComplaint('')
    setDebugInfo(prev => ({ ...prev, status: 'reset', error: null }))
    
    if (userRole === 'DOCTOR' && patientId) {
      console.log('🚀🚀🚀 CALLING fetchPersistedSummary NOW');
      fetchPersistedSummary()
      
      // Poll for updates every 5 seconds
      const pollInterval = setInterval(() => {
        console.log('⏰ Poll interval triggered for patient:', patientId);
        fetchPersistedSummary()
      }, 5000)
      
      return () => {
        console.log('🧹 Cleanup: clearing poll interval');
        clearInterval(pollInterval)
      }
    } else {
      console.log('❌ NOT fetching because userRole=' + userRole + ' patientId=' + patientId);
    }
  }, [patientId, userRole])

  const fetchPersistedSummary = async () => {
    console.log('🔥🔥🔥 fetchPersistedSummary CALLED');
    console.log('🔑 Current patientId:', patientId, 'Type:', typeof patientId);
    console.log('🌍 VITE_API_URL:', import.meta.env.VITE_API_URL);
    
    if (!patientId) {
      console.log('❌❌❌ fetchPersistedSummary: No patientId provided - ABORTING')
      return
    }
    
    console.log('⚙️ Setting generating=true');
    setGenerating(true)
    setError(null)
    
    const url = `${import.meta.env.VITE_API_URL}/summary/${encodeURIComponent(patientId)}?t=${Date.now()}`
    console.log('🌐 Full URL constructed:', url);
    setDebugInfo({ status: 'fetching', url, error: null, response: null })

    try {
      console.log('📡 About to call axios.get...');
      const response = await axios.get(url)
      console.log('✅✅✅ axios.get SUCCESS');
      console.log('📦 Response status:', response.status);
      console.log('📦 Response headers:', response.headers);
      const data = response.data || {}
      console.log('📊 Response data:', data);
      console.log('📝 summary_text length:', data.summary_text?.length || 0);
      console.log('📎 citations count:', data.citations?.length || 0);
      
      console.log('💾 Setting state: summary');
      setSummary(data.summary_text || '')
      console.log('💾 Setting state: editedText');
      setEditedText(data.summary_text || '')
      console.log('💾 Setting state: citations');
      setCitations(Array.isArray(data.citations) ? data.citations : [])
      console.log('💾 Setting state: chartPrepared');
      setChartPrepared(!!data.summary_text)
      console.log('💾 Setting state: debugInfo');
      setDebugInfo({ status: 'success', url, error: null, response: data })
      console.log('🎉🎉🎉 Summary loaded successfully!');
    } catch (e) {
      console.log('💥💥💥 AXIOS ERROR CAUGHT');
      console.log('Error object:', e);
      console.log('Error response:', e.response);
      console.log('Error response status:', e.response?.status);
      console.log('Error response data:', e.response?.data);
      console.log('Error message:', e.message);
      
      const errorMsg = e.response?.data?.detail || e.message || 'Failed to load summary'
      setDebugInfo({ status: 'error', url, error: errorMsg, response: e.response?.status })
      
      if (e.response?.status === 404) {
        console.log('⚠️⚠️⚠️ Summary not found (404) for patient:', patientId)
        setSummary('')
        setCitations([])
        setChartPrepared(false)
      } else {
        console.error('❌❌❌ Fetch summary error for patient', patientId)
        setError(errorMsg)
      }
    } finally {
      console.log('🏁 fetchPersistedSummary COMPLETE - setting generating=false');
      setGenerating(false)
    }
  }

  const handleSaveEditedSummary = async () => {
    if (!patientId) return
    try {
      setGenerating(true)
      const url = `${import.meta.env.VITE_API_URL}/save_summary`
      const response = await axios.post(url, {
        patient_id: Number(patientId),
        summary_text: editedText
      })
      const data = response.data || {}
      setSummary(data.summary_text || editedText)
      setEditedText(data.summary_text || editedText)
      setEditMode(false)
      setChartPrepared(true)
    } catch (e) {
      console.error('Save edited summary error', e)
      setError(e.response?.data?.detail || e.message || 'Failed to save summary')
    } finally {
      setGenerating(false)
    }
  }

  const handleExportPDF = () => {
    if (!summary) return

    const doc = new jsPDF()
    const margin = 20
    const pageWidth = doc.internal.pageSize.getWidth()
    const maxWidth = pageWidth - margin * 2
    let y = margin

    // Header
    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text('Clinical Summary', margin, y)
    y += 10

    // Patient info
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.text(`Patient ID: ${patientId}`, margin, y)
    y += 6
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y)
    y += 12

    // Summary content
    doc.setFontSize(11)
    const lines = doc.splitTextToSize(summary.replace(/[#*]/g, ''), maxWidth)
    lines.forEach(line => {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += 6
    })

    // Save
    doc.save(`summary_patient_${patientId}_${Date.now()}.pdf`)
  }

  const handleGenerate = async () => {
    if (!patientId) {
      console.log('❌ handleGenerate: No patientId provided')
      return
    }
    setGenerating(true)
    setError(null)
    setSummary('')
    setCitations([])
    
    try {
      const url = `${import.meta.env.VITE_API_URL}/summarize/${encodeURIComponent(patientId)}`
      console.log('🚀 MA: Generating summary for patient:', patientId, 'URL:', url)
      console.log('📝 Chief complaint:', chiefComplaint || '(none)')
      const response = await axios.post(url, {
        keywords: null,
        chief_complaint: chiefComplaint || null,
        max_chunks: 20,
        max_context_chars: 16000
      })
      const data = response.data
      console.log('✅ MA: Summary generated successfully')
      console.log('📊 Response data:', data)
      setSummary(data.summary_text || '(No summary returned)')
      setEditedText(data.summary_text || '(No summary returned)')
      setCitations(Array.isArray(data.citations) ? data.citations : [])
      setChartPrepared(true)
    } catch (e) {
      console.error('❌ MA: Generate summary error for patient', patientId, ':', e)
      console.error('Error response:', e.response?.data)
      setError(e.response?.data?.detail || e.message || 'Unknown error')
      setChartPrepared(false)
    } finally {
      setGenerating(false)
    }
  }

  // Resolve a PDF URL from a citation object (backend should provide one)
  const getCitationPdfUrl = (c) => {
    if (!c) return null
    return (
      c.pdf_url ||
      c.source_url ||
      c.report_url ||
      (c.report_id ? `${import.meta.env.VITE_API_URL}/report-file/${encodeURIComponent(c.report_id)}` : null)
    )
  }

  const handleOpenCitation = (idx) => {
    setSelectedCitation(idx)
    const c = citations[idx]
    const src = getCitationPdfUrl(c)
    const page = c?.source_metadata?.page ?? c?.source_metadata?.page_number ?? 1
    const search = (c?.source_text_preview || '').slice(0, 160)
    setPdfPanel({ open: true, src, page, title: c?.report_name || 'Medical Record', search })
  }

  // Deterministically map a text block to one citation index
  const pickCitationForText = (text) => {
    if (!citations.length) return null
    let sum = 0
    for (let i = 0; i < text.length; i++) sum = (sum + text.charCodeAt(i)) >>> 0
    return sum % citations.length
  }

  const getPdfHash = (page, search) => {
    const params = []
    if (page) params.push(`page=${page}`)
    if (search) params.push(`search=${encodeURIComponent(search)}`)
    return params.length ? `#${params.join('&')}` : ''
  }

  // MA VIEW: Chart Preparation Interface
  if (userRole === 'MA') {
    return (
      <div className="h-full w-full overflow-auto bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
        <div className="w-full px-8 py-8">
          <div className="w-full bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 rounded-2xl shadow-2xl border-2 border-purple-200 dark:border-purple-800 p-12">
            <div className="text-center mb-8">
              <div className="inline-flex p-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full shadow-lg mb-4">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">Prepare Patient Chart</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Generate clinical summary for doctor review</p>
            </div>
            
            {!patientId ? (
              <div className="text-center p-10 bg-white/50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-lg text-slate-500 dark:text-slate-400">Please select a patient from the header</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                    Visit Reason / Chief Complaint
                  </label>
                  <textarea
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="e.g., Worsening headaches for 3 days, accompanied by nausea..."
                    rows={6}
                    className="w-full text-sm px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-600 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Optional: Helps focus the summary on relevant findings</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg animate-in fade-in">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-700 dark:text-red-300">Generation Error</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {chartPrepared && !generating && !error && (
                  <div className="mb-6 p-8 bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-700 rounded-xl animate-in zoom-in">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-green-500 rounded-full">
                        <CheckCircle2 className="h-12 w-12 text-white" />
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">Chart Prepared!</p>
                        <p className="text-sm text-green-600 dark:text-green-400">
                          Clinical summary generated successfully. Ready for doctor review.
                        </p>
                        <p className="text-xs text-green-500 dark:text-green-500 mt-3">
                          Select a different patient or change chief complaint to generate a new summary.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {!chartPrepared && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className={cn(
                      "w-full py-5 text-lg font-bold rounded-xl transition-all duration-300 shadow-xl flex items-center justify-center gap-3",
                      generating
                        ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 text-white hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98]"
                    )}
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin" />
                        Analyzing Records...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-6 w-6" />
                        Generate Summary
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // DOCTOR VIEW: Summary Display (with right-side PDF preview on citation click)
  return (
    <div className={cn("h-full w-full grid", pdfPanel.open ? "grid-cols-[minmax(0,1fr)_minmax(420px,44vw)]" : "grid-cols-1") }>
      {/* Left: Summary content */}
      <div className="h-full w-full overflow-auto p-6">
        {/* DEBUG OVERLAY - REMOVE IN PRODUCTION */}
        <div className="mb-4 p-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 text-xs font-mono text-slate-600 dark:text-slate-400 rounded">
          <p><strong>DEBUG INFO:</strong></p>
          <p>Patient ID: {String(patientId)} ({typeof patientId})</p>
          <p>User Role: {userRole}</p>
          <p>Fetch Status: {debugInfo?.status}</p>
          <p>Fetch URL: {debugInfo?.url}</p>
          <p>Fetch Error: {debugInfo?.error}</p>
          <p>Response Code: {debugInfo?.response?.status || 'N/A'}</p>
          <button 
            onClick={fetchPersistedSummary}
            className="mt-2 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            FORCE FETCH
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        )}

        {generating && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-blue-600 dark:text-blue-400">Loading prepared summary...</span>
          </div>
        )}

        {!generating && !summary && patientId && (
          <div className="flex flex-col items-center justify-center py-20">
            <Sparkles className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-2">No prepared summary yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
              Waiting for MA to generate chart for Patient ID: {patientId}
            </p>
            <button
              onClick={() => fetchPersistedSummary()}
              disabled={generating}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2 className={cn("h-4 w-4", generating && "animate-spin")} />
              Check for Updates
            </button>
          </div>
        )}

        {!generating && summary && !editMode && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="flex items-start justify-between mb-3">
              <div />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  className="text-xs px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Export PDF
                </button>
                <button
                  onClick={() => { setEditMode(true); setEditedText(summary) }}
                  className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
                >
                  Edit
                </button>
              </div>
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 mt-6 pb-2 border-b-2 border-blue-500">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 mt-5 flex items-center gap-2"><span className="inline-block w-1 h-6 bg-blue-500 rounded"></span>{children}</h2>,
                p: ({ children }) => {
                  const text = Children.toArray(children).map(ch => typeof ch === 'string' ? ch : '').join(' ')
                  const idx = pickCitationForText(text)
                  return (
                    <p className="mb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {children}
                      {idx !== null && (
                        <button
                          onClick={() => handleOpenCitation(idx)}
                          className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-600 border border-blue-300 dark:border-blue-700 rounded-full transition-all align-super cursor-pointer"
                          title={`View source ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      )}
                    </p>
                  )
                },
                ul: ({ children }) => <ul className="mb-4 space-y-1.5 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 space-y-1.5 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => {
                  const text = Children.toArray(children).map(ch => typeof ch === 'string' ? ch : '').join(' ')
                  const idx = pickCitationForText(text)
                  return (
                    <li className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {children}
                      {idx !== null && (
                        <button
                          onClick={() => handleOpenCitation(idx)}
                          className="ml-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-white hover:bg-blue-500 dark:hover:bg-blue-600 border border-blue-300 dark:border-blue-700 rounded-full transition-all align-super cursor-pointer"
                          title={`View source ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      )}
                    </li>
                  )
                },
                strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-6 shadow-md rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-600">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">{children}</thead>,
                tbody: ({ children }) => <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">{children}</tr>,
                th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase">{children}</th>,
                td: ({ children }) => <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">{children}</td>,
              }}
            >
              {summary}
            </ReactMarkdown>
            
            {/* Medical Charts - automatically parse and display charts from tables */}
            <MedicalChartsPanel summaryText={summary} />
          </div>
        )}

        {/* Edit mode: textarea + save/cancel */}
        {!generating && editMode && (
          <div className="max-w-none">
            <div className="mb-3 flex items-center justify-end gap-2">
              <button
                onClick={() => { setEditMode(false); setEditedText(summary) }}
                className="text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditedSummary}
                disabled={generating}
                className="text-xs px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600"
              >
                {generating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={18}
              className="w-full text-sm px-4 py-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        )}



        {/* Footnotes removed per UX request */}

        {!generating && citations.length > 0 && false && (
          <details className="mt-8 border-t border-slate-200 dark:border-slate-700 pt-6">
            <summary className="text-sm font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 mb-3">
              📎 View Evidence Sources ({citations.length})
            </summary>
            <div className="grid gap-3 mt-4">
              {citations.map((c, idx) => {
                const meta = c.source_metadata || {}
                const page = meta.page ?? meta.page_number ?? 1
                return (
                  <div key={idx} className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                        Citation {idx + 1}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Page {page}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {c.source_text_preview}
                    </p>
                  </div>
                )
              })}
            </div>
          </details>
        )}
      </div>

      {/* Right: PDF Preview panel */}
      {pdfPanel.open && (
        <div className="h-full w-full border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <div className="flex-1 min-w-0 mr-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">Source</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{pdfPanel.title}</p>
            </div>
            
            {/* PDF Controls */}
            <div className="flex items-center gap-2">
              {numPages && (
                <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600 px-1 py-0.5">
                  <button
                    onClick={() => setPdfPageNumber(p => Math.max(1, p - 1))}
                    disabled={pdfPageNumber <= 1}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-xs font-mono w-12 text-center">{pdfPageNumber} / {numPages}</span>
                  <button
                    onClick={() => setPdfPageNumber(p => Math.min(numPages, p + 1))}
                    disabled={pdfPageNumber >= numPages}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded disabled:opacity-30"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}
              
              {pdfPanel.src && (
                <a
                  href={pdfPanel.src}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              
              <button
                onClick={() => setPdfPanel({ open: false, src: null, page: 1, title: '', search: '' })}
                className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-900/50 overflow-auto flex justify-center p-4">
            {pdfPanel.src ? (
              <div className="shadow-lg">
                <Document
                  file={pdfPanel.src}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex flex-col items-center gap-2 p-10">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                      <span className="text-sm text-slate-500">Loading document...</span>
                    </div>
                  }
                  error={
                    <div className="flex flex-col items-center gap-2 p-10 text-red-500">
                      <AlertTriangle className="h-8 w-8" />
                      <span className="text-sm">Failed to load PDF</span>
                    </div>
                  }
                >
                  <Page 
                    pageNumber={pdfPageNumber} 
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                    width={400} // Base width, will scale with container if needed
                    className="bg-white shadow-sm"
                    customTextRenderer={({ str }) => {
                      // Simple highlighting logic
                      if (!pdfPanel.search || !str) return str
                      const searchTerms = pdfPanel.search.toLowerCase().split(/\s+/).filter(w => w.length > 3)
                      const strLower = str.toLowerCase()
                      if (searchTerms.some(term => strLower.includes(term))) {
                        return `<mark style="background:rgba(250, 204, 21, 0.4);padding:2px 0;border-radius:2px;">${str}</mark>`
                      }
                      return str
                    }}
                  />
                </Document>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No document source available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
