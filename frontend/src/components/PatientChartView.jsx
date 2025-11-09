import { useState, useEffect, useCallback } from 'react'
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
  const [activeCitationId, setActiveCitationId] = useState(null)
  const [activeCitationText, setActiveCitationText] = useState('')
  
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
    setActiveCitationId(null)
    setActiveCitationText('')
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

  // Some rerenders (switching page/report) can cancel an in-flight text layer render.
  // Treat AbortException as benign to avoid noisy console errors.
  const onPageRenderError = useCallback((error) => {
    if (error?.name === 'AbortException') {
      // harmless: a new render started before the previous finished
      return
    }
    console.error('Page render error:', error)
  }, [])

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
                  <Page 
                    pageNumber={pageNumber} 
                    renderTextLayer={true} 
                    renderAnnotationLayer={true}
                    onRenderError={onPageRenderError}
                    customTextRenderer={({ str }) => {
                      if (!activeCitationText) return str
                      const lower = str.toLowerCase()
                      const trimmed = lower.trim()
                      if (trimmed.length > 2 && activeCitationText.includes(trimmed)) {
                        return `<span style="background:rgba(255,230,0,0.6);padding:1px;border-radius:2px;">${str}</span>`
                      }
                      return str
                    }}
                  />
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
              {/* Glass Box: clickable evidence list */}
              {generating && (
                <div className="text-muted-foreground text-sm italic">Generating summary…</div>
              )}
              {!generating && summary && (
                <div className="text-xs whitespace-pre-wrap leading-relaxed font-mono bg-muted/40 p-3 rounded-md border border-border">
                  {summary}
                </div>
              )}
              {!generating && !summary && citations.length === 0 && (
                <div className="text-muted-foreground text-sm italic">No summary yet. Click Generate Summary.</div>
              )}
              {!generating && citations.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-xs font-semibold text-card-foreground mb-1">Evidence ({citations.length}) — click to open source</h3>
                  <ul className="space-y-1 max-h-56 overflow-auto pr-1">
                    {citations.map((c, idx) => {
                      const meta = c.source_metadata || {}
                      const id = c.source_chunk_id ?? idx
                      const isExpanded = expandedCitationIds.has(id)
                      const page = meta.page ?? meta.page_number ?? 1
                      const reportId = c.report_id ?? null
                      const goToSource = () => {
                        if (reportId) {
                          if (reportId !== selectedReportId) {
                            setSelectedReportId(reportId)
                          }
                          setPageNumber(Math.max(1, parseInt(page, 10) || 1))
                          setActiveCitationId(id)
                          setActiveCitationText((c.source_full_text || c.source_text_preview || '').toLowerCase())
                        }
                      }
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
                            <span className="text-muted-foreground">p{page} · ch{meta.chunk_index ?? '—'}</span>
                            <button onClick={goToSource} className="text-primary text-[10px] px-1 py-0.5 border border-transparent hover:border-border rounded">
                              view
                            </button>
                            <button onClick={toggle} className="text-primary text-[10px] px-1 py-0.5 border border-transparent hover:border-border rounded">
                              {isExpanded ? 'collapse' : 'expand'}
                            </button>
                          </div>
                          <button onClick={goToSource} className={cn("mt-0.5 text-left block w-full whitespace-pre-wrap rounded px-1 py-0.5", id===activeCitationId ? "bg-primary/20 text-primary-foreground" : "text-muted-foreground/90 hover:bg-muted/50") }>
                            {isExpanded ? (c.source_full_text || c.source_text_preview) : c.source_text_preview}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {/* Debug: raw citations JSON */}
                  <details className="mt-2">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer">debug: raw citations</summary>
                    <pre className="text-[10px] whitespace-pre-wrap leading-relaxed font-mono bg-muted/40 p-2 rounded-md border border-border max-h-48 overflow-auto">{JSON.stringify(citations, null, 2)}</pre>
                  </details>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
