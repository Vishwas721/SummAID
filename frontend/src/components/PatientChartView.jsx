import { useState, useEffect } from 'react'
import axios from 'axios'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '../lib/utils'

// Configure PDF.js worker - use local build from node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export function PatientChartView({ patientId }) {
  const [summary, setSummary] = useState('')
  const [citations, setCitations] = useState([])
  const [expandedCitationIds, setExpandedCitationIds] = useState(new Set())
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  
  // PDF state
  const [reports, setReports] = useState([])
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [loadingReports, setLoadingReports] = useState(false)
  const [pdfError, setPdfError] = useState(null)

  // Fetch reports when patientId changes
  useEffect(() => {
    if (!patientId) return
    const fetchReports = async () => {
      setLoadingReports(true)
      setPdfError(null)
      try {
        const url = `${import.meta.env.VITE_API_URL}/reports/${encodeURIComponent(patientId)}`
        const response = await axios.get(url)
        const reportsList = response.data || []
        setReports(reportsList)
        // Auto-select first report
        if (reportsList.length > 0) {
          setSelectedReportId(reportsList[0].report_id)
          setPageNumber(1)
        } else {
          setSelectedReportId(null)
        }
      } catch (e) {
        console.error('Fetch reports error', e)
        setPdfError(e.response?.data?.detail || e.message || 'Failed to load reports')
      } finally {
        setLoadingReports(false)
      }
    }
    fetchReports()
  }, [patientId])

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
        max_chunks: 12,
        max_context_chars: 12000
      })
      const data = response.data
  setSummary(data.summary_text || '(No summary returned)')
  setCitations(Array.isArray(data.citations) ? data.citations : [])
    } catch (e) {
      console.error('Generate summary error', e)
      setError(e.response?.data?.detail || e.message || 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
    setPageNumber(1)
    setPdfError(null)
  }

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error)
    setPdfError('Failed to load PDF')
  }

  const selectedReport = reports.find(r => r.report_id === selectedReportId)
  const pdfUrl = selectedReportId 
    ? `${import.meta.env.VITE_API_URL}/report-file/${selectedReportId}`
    : null

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel: PDF Viewer */}
        <Panel defaultSize={55} minSize={35} className={cn("bg-card border border-border rounded-md overflow-hidden flex flex-col")}>          
          <div className="px-4 py-3 border-b border-border flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-card-foreground">Report Viewer</h2>
              <span className="text-xs text-muted-foreground font-mono">patient: {patientId}</span>
            </div>
            {/* Report list */}
            {loadingReports ? (
              <div className="text-xs text-muted-foreground">Loading reports...</div>
            ) : reports.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {reports.map(r => (
                  <button
                    key={r.report_id}
                    onClick={() => {
                      setSelectedReportId(r.report_id)
                      setPageNumber(1)
                    }}
                    className={cn(
                      "text-[10px] px-2 py-1 rounded border transition-colors",
                      r.report_id === selectedReportId
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                    )}
                  >
                    {r.filename}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No reports found</div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4 flex flex-col items-center">
            {pdfError && (
              <div className="text-xs text-red-500 mb-2">{pdfError}</div>
            )}
            {pdfUrl ? (
              <div className="flex flex-col items-center gap-2">
                <Document
                  file={pdfUrl}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={<div className="text-xs text-muted-foreground">Loading PDF...</div>}
                >
                  <Page pageNumber={pageNumber} renderTextLayer={true} renderAnnotationLayer={true} />
                </Document>
                {numPages && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className="px-2 py-1 border border-border rounded disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <span className="text-muted-foreground">
                      Page {pageNumber} of {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      className="px-2 py-1 border border-border rounded disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-muted-foreground text-sm">
                {loadingReports ? 'Loading reports...' : 'No report selected'}
              </div>
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors cursor-col-resize" />
        {/* Right Panel: Summary */}
        <Panel defaultSize={45} minSize={25} className={"flex flex-col gap-0"}>
          <div className="bg-card border border-border rounded-md h-full flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-card-foreground">Clinical Summary</h2>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={cn("px-3 py-1.5 text-xs rounded-md border border-border bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed")}
              >
                {generating ? 'Generating…' : 'Generate Summary'}
              </button>
            </div>
            <div className="flex-1 p-4 overflow-auto flex flex-col gap-4">
              {error && (
                <div className="text-xs text-red-500 border border-red-500/40 bg-red-500/5 rounded-md p-2">
                  Error: {error}
                </div>
              )}
              {summary ? (
                <pre className="text-xs whitespace-pre-wrap leading-relaxed font-mono bg-muted/40 p-3 rounded-md border border-border">{summary}</pre>
              ) : generating ? (
                <div className="text-muted-foreground text-sm italic">Generating summary…</div>
              ) : (
                <div className="text-muted-foreground text-sm italic">No summary yet. Click Generate Summary.</div>
              )}
              {citations.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-xs font-semibold text-card-foreground mb-1">Citations ({citations.length})</h3>
                  <ul className="space-y-1 max-h-56 overflow-auto pr-1">
                    {citations.map((c, idx) => {
                      const meta = c.source_metadata || {}
                      const id = c.source_chunk_id ?? idx
                      const isExpanded = expandedCitationIds.has(id)
                      const toggle = () => {
                        setExpandedCitationIds(prev => {
                          const next = new Set(prev)
                          if (next.has(id)) next.delete(id); else next.add(id)
                          return next
                        })
                      }
                      return (
                        <li key={id} className="text-[11px] leading-snug bg-muted/30 border border-border rounded px-2 py-1">
                          <div className="flex justify-between items-center gap-2">
                            <span className="font-mono">chunk #{id}</span>
                            <span className="text-muted-foreground">p{meta.page ?? meta.page_number ?? '—'} · ch{meta.chunk_index ?? '—'}</span>
                            <button onClick={toggle} className="text-primary text-[10px] px-1 py-0.5 border border-transparent hover:border-border rounded">
                              {isExpanded ? 'collapse' : 'expand'}
                            </button>
                          </div>
                          <div className="mt-0.5 text-muted-foreground/90 whitespace-pre-wrap">
                            {isExpanded ? (c.source_full_text || c.source_text_preview) : c.source_text_preview}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
