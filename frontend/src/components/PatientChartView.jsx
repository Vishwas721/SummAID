import { useState, useEffect, useCallback } from 'react'
import jsPDF from 'jspdf'
import axios from 'axios'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { FileText, Sparkles, AlertTriangle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2, Eye, EyeOff, MessageSquare, Send } from 'lucide-react'
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
  const [evidenceExpanded, setEvidenceExpanded] = useState(false)
  const [chiefComplaint, setChiefComplaint] = useState('')
  
  // Chat state
  const [activeTab, setActiveTab] = useState('summary') // 'summary' or 'chat'
  const [messages, setMessages] = useState([]) // {role: 'user'|'ai', content: string, citations?: []}
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)

  // Reset summary and citations when patient changes
  useEffect(() => {
    setSummary('')
    setCitations([])
    setExpandedCitationIds(new Set())
    setActiveCitationId(null)
    setActiveCitationText('')
    setError(null)
    setMessages([])
    setChatInput('')
    setChatError(null)
    setActiveTab('summary')
  }, [patientId])

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
        chief_complaint: chiefComplaint || null,
        max_chunks: 20,  // Increased to capture more context including FINDINGS/IMPRESSION sections
        max_context_chars: 16000  // Increased to accommodate more chunks
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

  const handleSendMessage = async () => {
    if (!patientId || !chatInput.trim() || chatLoading) return
    
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatError(null)
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }])
    
    setChatLoading(true)
    try {
      const url = `${import.meta.env.VITE_API_URL}/chat/${encodeURIComponent(patientId)}`
      const response = await axios.post(url, {
        question: userMessage,
        max_chunks: 15,
        max_context_chars: 12000
      })
      const data = response.data
      
      // Add AI response with citations
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: data.answer || '(No answer returned)',
        citations: Array.isArray(data.citations) ? data.citations : []
      }])
    } catch (e) {
      console.error('Chat error', e)
      const errorMsg = e.response?.data?.detail || e.message || 'Unknown error'
      setChatError(errorMsg)
      // Add error message to chat
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Sorry, I encountered an error: ${errorMsg}`,
        isError: true
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 40
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const maxWidth = pageWidth - margin * 2
      let y = margin

      const addHeading = (text) => {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        y = ensurePageSpace(doc, y, 18, margin)
        doc.text(text, margin, y)
        y += 8
        doc.setDrawColor(200)
        doc.line(margin, y, pageWidth - margin, y)
        y += 10
      }

      const addParagraph = (text) => {
        if (!text) return
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        const lines = doc.splitTextToSize(text, maxWidth)
        for (const line of lines) {
          y = ensurePageSpace(doc, y, 14, margin)
          doc.text(line, margin, y)
          y += 14
        }
      }

      const addBullets = (items) => {
        if (!items || items.length === 0) return
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        for (const it of items) {
          const textLines = doc.splitTextToSize(it, maxWidth - 16)
          y = ensurePageSpace(doc, y, 14 * textLines.length, margin)
          doc.text('•', margin, y)
          doc.text(textLines, margin + 12, y)
          y += 14 * textLines.length
        }
      }

      // Title + metadata
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text('AI Summary', margin, y)
      y += 24
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      const ts = new Date().toLocaleString()
      let metaLine = `Patient: ${patientId}`
      doc.text(metaLine, margin, y)
      if (chiefComplaint) {
        doc.text(`Chief Complaint: ${chiefComplaint}`, margin + 220, y)
      }
      y += 16
      doc.text(`Generated: ${ts}`, margin, y)
      y += 20

      // Parse summary into sections
      const raw = summary || ''
      const lines = raw.split(/\r?\n/)
      let section = ''
      let mainStory = ''
      const keyFindings = []
      const evolution = []
      const labRows = []
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i]
        const t = ln.trim()
        if (/^Main Story\s*:/.test(t)) { section = 'main'; continue }
        if (/^Key Findings\s*:/.test(t)) { section = 'key'; continue }
        if (/^Lab Values\s*:/.test(t)) { section = 'labs'; continue }
        if (/^Evolution\s*:/.test(t)) { section = 'evol'; continue }
        if (!t) continue
        if (section === 'main') {
          if (t.startsWith('- ')) {
            mainStory = t.slice(2)
          } else {
            mainStory = (mainStory ? mainStory + ' ' : '') + t
          }
        } else if (section === 'key') {
          keyFindings.push(t.replace(/^\-\s*/, ''))
        } else if (section === 'evol') {
          evolution.push(t.replace(/^\-\s*/, ''))
        } else if (section === 'labs') {
          if (t.startsWith('|') && t.endsWith('|') && !/\|\s*-+\s*\|/.test(t)) {
            const cells = t.split('|').map(s => s.trim()).filter(Boolean)
            if (cells.length >= 4) labRows.push(cells.slice(0, 4))
          }
        }
      }

      // Render summary sections
      if (mainStory) {
        addHeading('Main Story')
        addParagraph(mainStory)
      }
      if (keyFindings.length) {
        addHeading('Key Findings')
        addBullets(keyFindings)
      }
      if (labRows.length) {
        addHeading('Lab Values')
        // Render as simple fixed columns using monospace
        doc.setFont('courier', 'normal')
        doc.setFontSize(10)
        const cols = [100, 180, 120, 80]
        const totalCols = cols.reduce((a, b) => a + b, 0)
        const scale = Math.min(1, (maxWidth) / totalCols)
        const cw = cols.map(w => w * scale)
        const headers = ['Date', 'Test', 'Value', 'Flag']
        y = ensurePageSpace(doc, y, 16, margin)
        let x = margin
        doc.setFont('courier', 'bold')
        headers.forEach((h, i) => { doc.text(h, x, y); x += cw[i] })
        doc.setFont('courier', 'normal')
        y += 10
        for (const row of labRows) {
          y = ensurePageSpace(doc, y, 14, margin)
          let xx = margin
          row.forEach((cell, i) => {
            const clipped = String(cell)
            doc.text(clipped, xx, y)
            xx += cw[i]
          })
          y += 14
        }
        doc.setFont('helvetica', 'normal')
      }
      if (evolution.length) {
        addHeading('Evolution')
        addBullets(evolution)
      }

      // Evidence Sources
      if (citations && citations.length) {
        addHeading(`Evidence Sources (${citations.length})`)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        citations.forEach((c, idx) => {
          const meta = c.source_metadata || {}
          const page = meta.page ?? meta.page_number ?? '—'
          const reportId = meta.report_id ?? c.report_id
          const report = reports.find(r => r.report_id === reportId)
          const label = report ? report.filename : (reportId ? `report ${reportId}` : 'unknown report')
          const line = `• ${label}, page ${page} — ${c.source_text_preview || ''}`
          const wrapped = doc.splitTextToSize(line, maxWidth)
          for (const ln2 of wrapped) {
            y = ensurePageSpace(doc, y, 14, margin)
            doc.text(ln2, margin, y)
            y += 14
          }
        })
      }

      // Save
      const pad = (n) => String(n).padStart(2, '0')
      const d = new Date()
      const fname = `Summary_${patientId}_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.pdf`
      doc.save(fname)
    } catch (e) {
      console.error('PDF generation error', e)
      alert('Failed to generate PDF: ' + (e?.message || e))
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
    <div className="h-full w-full bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel: PDF Viewer */}
        <Panel defaultSize={55} minSize={35} className={cn("bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden flex flex-col shadow-2xl m-4 mr-2")}>          
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500 rounded-md shadow-md">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Medical Reports</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Patient ID:</span>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">{patientId}</span>
              </div>
            </div>
            {/* Report list */}
            {loadingReports ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading reports...</span>
              </div>
            ) : reports.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {reports.map(r => (
                  <button
                    key={r.report_id}
                    onClick={() => {
                      setSelectedReportId(r.report_id)
                      setPageNumber(1)
                    }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 font-medium",
                      r.report_id === selectedReportId
                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white border-blue-600 shadow-lg scale-105"
                        : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-slate-400 hover:shadow-md"
                    )}
                  >
                    {r.filename}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3" />
                <span>No reports found for this patient</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-auto p-6 flex flex-col items-center bg-slate-50 dark:bg-slate-900/50">
            {pdfError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {pdfError}
              </div>
            )}
            {pdfUrl ? (
              <div className="flex flex-col items-center gap-4">
                <div className="shadow-2xl rounded-lg overflow-hidden border-4 border-white dark:border-slate-700">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center gap-2 p-12 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading PDF...
                      </div>
                    }
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
                          return `<mark style="background:rgba(250, 204, 21, 0.4);padding:2px 4px;border-radius:2px;border-bottom:2px solid rgba(251, 191, 36, 0.8);color:inherit;font-weight:inherit;">${str}</mark>`
                        }
                        return str
                      }}
                    />
                  </Document>
                </div>
                {numPages && (
                  <div className="flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                      disabled={pageNumber <= 1}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        pageNumber <= 1
                          ? "opacity-40 cursor-not-allowed text-slate-400"
                          : "hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:scale-110"
                      )}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[100px] text-center">
                      Page {pageNumber} of {numPages}
                    </span>
                    <button
                      onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                      disabled={pageNumber >= numPages}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        pageNumber >= numPages
                          ? "opacity-40 cursor-not-allowed text-slate-400"
                          : "hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:scale-110"
                      )}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-12">
                <FileText className="h-16 w-16 text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {loadingReports ? 'Loading reports...' : 'No report selected'}
                </p>
              </div>
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gradient-to-r from-slate-200 via-blue-200 to-slate-200 dark:from-slate-700 dark:via-blue-800 dark:to-slate-700 hover:from-blue-400 hover:via-purple-400 hover:to-blue-400 transition-all duration-300 cursor-col-resize" />
        {/* Right Panel: Summary & Chat */}
        <Panel defaultSize={45} minSize={25} className={"flex flex-col gap-0 min-h-0"}>
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg h-full flex flex-col shadow-2xl m-4 ml-2 min-h-0">
            {/* Tabs Header */}
            <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30">
              <div className="flex items-center gap-1 mb-3">
                <button
                  onClick={() => setActiveTab('summary')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200",
                    activeTab === 'summary'
                      ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  Summary
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200",
                    activeTab === 'chat'
                      ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat Assistant
                </button>
              </div>
              {/* Action buttons - only show for Summary tab */}
              {activeTab === 'summary' && (
                <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 shadow-md",
                    "flex items-center gap-2",
                    generating 
                      ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 hover:shadow-lg hover:scale-105"
                  )}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Generate Summary
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={!summary && citations.length === 0}
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 shadow-md",
                    !summary && citations.length === 0
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-white dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                  )}
                  title={summary || citations.length > 0 ? "Download PDF" : "Generate a summary first"}
                >
                  Download PDF
                </button>
              </div>
              )}
            </div>
            
            {/* Tab Content */}
            {activeTab === 'summary' ? (
              // Summary Tab Content
              <div className="flex-1 p-5 overflow-hidden flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/50 min-h-0">
              {/* Visit Reason / Chief Complaint input */}
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-3 flex items-center gap-3">
                <label htmlFor="chief-complaint" className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                  Visit Reason / Chief Complaint
                </label>
                <input
                  id="chief-complaint"
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
                  placeholder="e.g., Worsening headaches, chest pain, fever"
                  className="flex-1 text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={cn(
                    "px-3 py-2 text-[11px] font-bold rounded-md transition-all duration-200 shadow-sm",
                    generating
                      ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      : "bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700"
                  )}
                  title="Generate summary with this visit reason"
                >
                  {generating ? 'Working…' : 'Apply'}
                </button>
              </div>
              {error && (
                <div className="text-sm text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold mb-1">Error Generating Summary</p>
                    <p className="text-xs">{error}</p>
                  </div>
                </div>
              )}
              {/* Glass Box: clickable evidence list */}
              {generating && (
                <div className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 animate-pulse">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="font-medium">Generating AI summary...</span>
                </div>
              )}
              {!generating && summary && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-md flex flex-col min-h-0 flex-1">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Summary</h3>
                  </div>
                  <div className="p-4 pb-6 pr-2 text-sm whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 overflow-auto scrollbar-thin flex-1 min-h-0">
                    {summary}
                  </div>
                </div>
              )}
              {!generating && !summary && citations.length === 0 && (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <Sparkles className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No summary yet</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Click Generate Summary to begin</p>
                </div>
              )}
              {!generating && citations.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-md overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      Evidence Sources ({citations.length})
                    </h3>
                    <button
                      onClick={() => setEvidenceExpanded(v => !v)}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-200 transition-colors"
                      title={evidenceExpanded ? 'Collapse evidence' : 'Expand evidence'}
                    >
                      {evidenceExpanded ? <ChevronDown className="h-3 w-3"/> : <ChevronUp className="h-3 w-3"/>}
                      {evidenceExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  <ul className={cn(
                    "space-y-2 overflow-auto overscroll-contain p-3 pr-2 scrollbar-thin",
                    evidenceExpanded ? "max-h-[60vh] pb-6" : "max-h-28"
                  )}>
                    {citations.map((c, idx) => {
                      const meta = c.source_metadata || {}
                      const id = c.source_chunk_id ?? idx
                      const isExpanded = expandedCitationIds.has(id)
                      const page = meta.page ?? meta.page_number ?? 1
                      const reportId = meta.report_id ?? c.report_id ?? null
                      const reportObj = reportId ? reports.find(r => r.report_id === reportId) : null
                      const reportLabel = reportObj ? reportObj.filename : (reportId ? `report ${reportId}` : 'unknown report')
                      const isActive = id === activeCitationId
                      
                      const goToSource = () => {
                        if (!reportId) {
                          console.warn('Citation missing report_id', c)
                          return
                        }
                        if (reportId !== selectedReportId) {
                          setSelectedReportId(reportId)
                        }
                        setPageNumber(Math.max(1, parseInt(page, 10) || 1))
                        setActiveCitationId(id)
                        setActiveCitationText((c.source_full_text || c.source_text_preview || '').toLowerCase())
                      }
                      
                      const toggle = () => {
                        setExpandedCitationIds(prev => {
                          const next = new Set(prev)
                          if (next.has(id)) next.delete(id); else next.add(id)
                          return next
                        })
                      }
                      
                      return (
                        <li key={id} className={cn(
                          "rounded-lg border transition-all duration-200 overflow-hidden group",
                          isActive 
                            ? "border-amber-400 dark:border-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 shadow-lg" 
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md"
                        )}>
                          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                isActive 
                                  ? "bg-amber-500 text-white"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                              )}>
                                #{id}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                Page {page} · Chunk {meta.chunk_index ?? '—'}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full truncate max-w-[120px]" title={reportLabel}>
                                {reportLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={goToSource} 
                                className={cn(
                                  "text-[10px] px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1",
                                  isActive
                                    ? "bg-amber-500 text-white"
                                    : "bg-blue-500 text-white hover:bg-blue-600"
                                )}
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </button>
                              <button 
                                onClick={toggle} 
                                className="text-[10px] px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
                              >
                                {isExpanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                            </div>
                          </div>
                          <button 
                            onClick={goToSource} 
                            className={cn(
                              "w-full text-left px-3 py-2 text-[11px] leading-relaxed transition-colors",
                              isActive 
                                ? "text-amber-900 dark:text-amber-100" 
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                          >
                            {isExpanded ? (c.source_full_text || c.source_text_preview) : c.source_text_preview}
                          </button>
                          {!reportObj && reportId && (
                            <div className="px-3 pb-2">
                              <div className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded border border-amber-200 dark:border-amber-800">
                                ⚠️ Report not loaded in list
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {/* Debug: raw citations JSON */}
                  <details className="m-3 mt-2">
                    <summary className="text-[11px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 transition-colors font-medium">
                      🔍 Debug: View Raw Citations JSON
                    </summary>
                    <pre className="mt-2 text-[10px] whitespace-pre-wrap leading-relaxed font-mono bg-slate-900 dark:bg-slate-950 text-green-400 p-3 rounded-md border border-slate-700 max-h-48 overflow-auto">
                      {JSON.stringify(citations, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
              </div>
            ) : (
              // Chat Tab Content
              <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900/50 min-h-0">
                {/* Messages List */}
                <div className="flex-1 overflow-auto p-4 space-y-3 scrollbar-thin">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8">
                      <MessageSquare className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No messages yet</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Ask me anything about this patient's reports</p>
                      <div className="mt-4 space-y-2 text-xs text-slate-400 dark:text-slate-500 text-left">
                        <p className="italic">"What is the trend in tumor size?"</p>
                        <p className="italic">"What were the white blood cell counts?"</p>
                        <p className="italic">"Are there any abnormal liver findings?"</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-lg px-4 py-3 shadow-sm",
                          msg.role === 'user' 
                            ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                            : msg.isError
                              ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        )}>
                          <div className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                                Sources ({msg.citations.length}):
                              </p>
                              <div className="space-y-1">
                                {msg.citations.slice(0, 3).map((c, cidx) => {
                                  const meta = c.source_metadata || {}
                                  const page = meta.page ?? meta.page_number ?? '—'
                                  const reportId = meta.report_id ?? c.report_id
                                  const report = reports.find(r => r.report_id === reportId)
                                  const label = report ? report.filename : `Report ${reportId}`
                                  
                                  const goToSource = () => {
                                    if (reportId && reportId !== selectedReportId) {
                                      setSelectedReportId(reportId)
                                    }
                                    setPageNumber(Math.max(1, parseInt(page, 10) || 1))
                                    setActiveCitationId(c.source_chunk_id)
                                    setActiveCitationText((c.source_full_text || c.source_text_preview || '').toLowerCase())
                                  }
                                  
                                  return (
                                    <button
                                      key={cidx}
                                      onClick={goToSource}
                                      className="block w-full text-left text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    >
                                      <span className="font-semibold">{label}</span>, p. {page}
                                    </button>
                                  )
                                })}
                                {msg.citations.length > 3 && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                    +{msg.citations.length - 3} more sources
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Input Box */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                      placeholder="Ask a question about this patient..."
                      disabled={chatLoading}
                      className="flex-1 text-sm px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={chatLoading || !chatInput.trim()}
                      className={cn(
                        "px-4 py-3 rounded-lg transition-all duration-200 shadow-md flex items-center gap-2",
                        chatLoading || !chatInput.trim()
                          ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-500 to-blue-600 text-white hover:from-purple-600 hover:to-blue-700 hover:shadow-lg hover:scale-105"
                      )}
                    >
                      <Send className="h-4 w-4" />
                      <span className="text-sm font-bold">Send</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}

// Helpers for PDF generation
function ensurePageSpace(doc, y, needed, margin) {
  const pageHeight = doc.internal.pageSize.getHeight()
  if (y + needed > pageHeight - margin) {
    doc.addPage()
    return margin
  }
  return y
}

