import { useState, useEffect } from 'react'
import axios from 'axios'
import { Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function SummaryPanel({ patientId }) {
  const [summary, setSummary] = useState('')
  const [citations, setCitations] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [chartPrepared, setChartPrepared] = useState(false)
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  
  useEffect(() => {
    setSummary('')
    setCitations([])
    setError(null)
    setChartPrepared(false)
    
    if (userRole === 'DOCTOR' && patientId) {
      fetchPersistedSummary()
    }
  }, [patientId, userRole])

  const fetchPersistedSummary = async () => {
    if (!patientId) return
    setGenerating(true)
    setError(null)
    setSummary('')
    setCitations([])
    
    try {
      const url = `${import.meta.env.VITE_API_URL}/summary/${encodeURIComponent(patientId)}`
      const response = await axios.get(url)
      const data = response.data || {}
      setSummary(data.summary_text || '')
      setCitations(Array.isArray(data.citations) ? data.citations : [])
      setChartPrepared(!!data.summary_text)
    } catch (e) {
      if (e.response?.status === 404) {
        setSummary('')
        setCitations([])
        setChartPrepared(false)
      } else {
        console.error('Fetch summary error', e)
        setError(e.response?.data?.detail || e.message || 'Failed to load summary')
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleGenerate = async () => {
    if (!patientId) return
    setGenerating(true)
    setError(null)
    setSummary('')
    setCitations([])
    
    try {
      const url = `${import.meta.env.VITE_API_URL}/summarize/${encodeURIComponent(patientId)}`
      const response = await axios.post(url, {
        keywords: null,
        chief_complaint: chiefComplaint || null,
        max_chunks: 20,
        max_context_chars: 16000
      })
      const data = response.data
      setSummary(data.summary_text || '(No summary returned)')
      setCitations(Array.isArray(data.citations) ? data.citations : [])
      
      if (userRole === 'MA') {
        setChartPrepared(true)
      }
    } catch (e) {
      console.error('Generate summary error', e)
      setError(e.response?.data?.detail || e.message || 'Unknown error')
      setChartPrepared(false)
    } finally {
      setGenerating(false)
    }
  }
  
  // For MA: Show chart preparation interface, not summary
  if (userRole === 'MA') {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-slate-800 p-8">
        <div className="max-w-3xl w-full">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-blue-900 rounded-2xl shadow-2xl border-2 border-purple-200 dark:border-purple-800 p-12">
            <div className="text-center mb-8">
              <div className="inline-flex p-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full shadow-lg mb-4">
                <Sparkles className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Prepare Patient Chart</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">Enter chief complaint and generate the clinical summary for doctor review</p>
            </div>
            
            {!patientId ? (
              <div className="text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                <p className="text-slate-500 dark:text-slate-400">Please select a patient to prepare their chart</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Visit Reason / Chief Complaint
                  </label>
                  <input
                    type="text"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="e.g., Worsening headaches, chest pain, fever"
                    className="w-full text-sm px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
                  />
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-300">Error</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {chartPrepared && !generating && !error && (
                  <div className="mb-6 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
                    <div className="flex flex-col items-center gap-3">
                      <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-700 dark:text-green-300">Chart Prepared Successfully!</p>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          The summary has been generated and is ready for the doctor to review.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={cn(
                    "w-full py-4 text-base font-bold rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center gap-3",
                    generating
                      ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 hover:shadow-xl hover:scale-105"
                  )}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Preparing Chart...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Prepare Patient Chart
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  // DOCTOR view continues below
  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800">
      {/* Summary Header */}
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Clinical Summary</h2>
          </div>
          {userRole === 'DOCTOR' && (
            <button
              onClick={fetchPersistedSummary}
              disabled={generating}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                generating 
                  ? 'bg-slate-300 dark:bg-slate-600 text-slate-500' 
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
              )}
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 inline animate-spin mr-1" /> : null}
              Refresh
            </button>
          )}
        </div>

        {userRole === 'MA' && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate() }}
              placeholder="Chief complaint (optional)"
              className="flex-1 text-sm px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={cn(
                'px-4 py-2 text-sm font-semibold rounded-md transition-all flex items-center gap-2 whitespace-nowrap',
                generating
                  ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </button>
          </div>
        )}

        {userRole === 'DOCTOR' && !chartPrepared && !generating && (
          <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md border border-amber-200 dark:border-amber-800">
            Awaiting chart preparation by MA
          </div>
        )}
      </div>

      {/* Summary Content */}
      <div className="flex-1 overflow-auto p-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-xs">{error}</div>
          </div>
        )}

        {generating && (
          <div className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{userRole === 'DOCTOR' ? 'Loading prepared summary...' : 'Analyzing patient records...'}</span>
          </div>
        )}

        {!generating && chartPrepared && userRole === 'MA' && (
          <div className="mb-6 p-6 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
              <div className="text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-300">Chart Prepared Successfully!</p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  The summary has been generated and is ready for the doctor to review.
                </p>
              </div>
            </div>
          </div>
        )}

        {!generating && summary && (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 mt-6 pb-2 border-b-2 border-blue-500">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3 mt-5 flex items-center gap-2"><span className="inline-block w-1 h-6 bg-blue-500 rounded"></span>{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2 mt-4">{children}</h3>,
                p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{children}</p>,
                ul: ({ children }) => <ul className="mb-4 space-y-1.5 ml-4">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 space-y-1.5 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed pl-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-slate-100">{children}</strong>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-6 shadow-md rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-600">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">{children}</thead>,
                tbody: ({ children }) => <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">{children}</tbody>,
                tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">{children}</tr>,
                th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-600 last:border-r-0">{children}</th>,
                td: ({ children }) => <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-700 last:border-r-0">{children}</td>,
              }}
            >
              {summary}
            </ReactMarkdown>
          </div>
        )}

        {!generating && !summary && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <Sparkles className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            {userRole === 'MA' ? (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No summary generated</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Enter chief complaint and click Generate</p>
              </>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No prepared summary yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Waiting for MA to prepare chart</p>
              </>
            )}
          </div>
        )}

        {!generating && citations.length > 0 && (
          <details className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-4">
            <summary className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 mb-2">
              📎 View Evidence Sources ({citations.length})
            </summary>
            <ul className="space-y-2 mt-2 max-h-64 overflow-auto">
              {citations.map((c, idx) => {
                const meta = c.source_metadata || {}
                const id = c.source_chunk_id ?? idx
                const page = meta.page ?? meta.page_number ?? 1
                return (
                  <li key={id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:shadow-md transition-all p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400">#{id}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Page {page}</span>
                    </div>
                    <div className="text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
                      {c.source_text_preview}
                    </div>
                  </li>
                )
              })}
            </ul>
          </details>
        )}
      </div>

      {/* Infographics Placeholder */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-4">
        <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">📊 Infographics</div>
        <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">
          Visual charts and trends coming soon
        </div>
      </div>
    </div>
  )
}
