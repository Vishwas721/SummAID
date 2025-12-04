import { useState, useEffect, useCallback, useRef } from 'react'
import jsPDF from 'jspdf'
import axios from 'axios'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { FileText, Sparkles, AlertTriangle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Loader2, Eye, EyeOff, MessageSquare, Send, CheckCircle2, Plus, X } from 'lucide-react'
import { cn } from '../lib/utils'
import Highlighter from 'react-highlight-words'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Configure PDF.js worker - use local build from node_modules
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

console.log('📄 PatientChartView.jsx module loaded')
console.log('   API URL:', import.meta.env.VITE_API_URL)

export function PatientChartView({ patientId }) {
  console.log('🏗️ PatientChartView component render - patientId:', patientId)
  
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
  
  // Role-based state
  const [userRole, setUserRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  const [chartPrepared, setChartPrepared] = useState(false)
  
  // Chat state
  const [activeTab, setActiveTab] = useState('summary') // 'summary', 'chat', or 'rx'
  const [messages, setMessages] = useState([]) // {role: 'user'|'ai', content: string, citations?: []}
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  
  // Prescription (Rx) state
  const [drugName, setDrugName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration, setDuration] = useState('')
  const [safetyCheckLoading, setSafetyCheckLoading] = useState(false)
  const [safetyWarning, setSafetyWarning] = useState(null)
  const [safetyCheckDone, setSafetyCheckDone] = useState(false)

  // Debug logging for safety check state changes
  useEffect(() => {
    console.log('🔍 Safety Check State Update:', { safetyCheckLoading, safetyCheckDone, safetyWarning })
  }, [safetyCheckLoading, safetyCheckDone, safetyWarning])
  
  // Annotations state (Doctor view)
  const [noteText, setNoteText] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteError, setNoteError] = useState(null)
  const [noteSaved, setNoteSaved] = useState(false)
  
  // Text highlighting and annotation state
  const [selectedText, setSelectedText] = useState('')
  const [selectionPosition, setSelectionPosition] = useState(null)
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [annotationNote, setAnnotationNote] = useState('')
  const [annotations, setAnnotations] = useState([]) // {annotation_id, selected_text, note, created_at}
  const [loadingAnnotations, setLoadingAnnotations] = useState(false)
  const summaryRef = useRef(null)

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
    setChartPrepared(false)
    setNoteText('')
    setNoteError(null)
    setNoteSaved(false)
    setAnnotations([])
    setSelectedText('')
    setSelectionPosition(null)
    setShowAnnotationModal(false)
    
    // Clear PDF cache and state
    pageCacheRef.current.clear()
    setPageImage(null)
    setReports([])
    setSelectedReportId(null)
    
    // For doctor, fetch persisted summary instead of generating
    if (userRole === 'DOCTOR' && patientId) {
      fetchPersistedSummary()
    }
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
      
      // Set success state for MA
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

  // Fetch persisted summary for Doctor view
  const fetchPersistedSummary = async () => {
    if (!patientId) return
    setGenerating(true)
    setError(null)
    setSummary('')
    setCitations([])
    setActiveCitationId(null)
    setActiveCitationText('')
    try {
      const url = `${import.meta.env.VITE_API_URL}/summary/${encodeURIComponent(patientId)}`
      const response = await axios.get(url)
      const data = response.data || {}
      setSummary(data.summary_text || '')
      setCitations(Array.isArray(data.citations) ? data.citations : [])
      setChartPrepared(!!data.summary_text)
    } catch (e) {
      if (e.response?.status === 404) {
        // Not prepared yet
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

  const handleSaveNote = async () => {
    if (!patientId || !noteText.trim() || noteSaving) return
    setNoteSaving(true)
    setNoteError(null)
    setNoteSaved(false)
    try {
      const url = `${import.meta.env.VITE_API_URL}/annotate`
      const response = await axios.post(url, {
        patient_id: patientId,
        doctor_note: noteText.trim()
      })
      if (response && response.data) {
        setNoteSaved(true)
        setNoteText('')
        // Auto-hide success after a short delay
        setTimeout(() => setNoteSaved(false), 2500)
      }
    } catch (e) {
      console.error('Save annotation error', e)
      setNoteError(e.response?.data?.detail || e.message || 'Failed to save note')
    } finally {
      setNoteSaving(false)
    }
  }

  // Handle text selection in summary
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    
    if (text && text.length > 0 && summaryRef.current?.contains(selection.anchorNode)) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      
      setSelectedText(text)
      setSelectionPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX + (rect.width / 2)
      })
    } else {
      setSelectedText('')
      setSelectionPosition(null)
    }
  }, [])

  // Fetch annotations for current patient
  const fetchAnnotations = useCallback(async () => {
    if (!patientId) return
    setLoadingAnnotations(true)
    try {
      const url = `${import.meta.env.VITE_API_URL}/annotations/${encodeURIComponent(patientId)}`
      const response = await axios.get(url)
      setAnnotations(response.data || [])
    } catch (e) {
      console.error('Fetch annotations error', e)
    } finally {
      setLoadingAnnotations(false)
    }
  }, [patientId])

  // Load annotations when summary is generated
  useEffect(() => {
    if (summary && patientId) {
      fetchAnnotations()
    }
  }, [summary, patientId, fetchAnnotations])

  // Handle saving annotation with selected text
  const handleSaveAnnotation = async () => {
    if (!patientId || !selectedText || !annotationNote.trim()) return
    
    setNoteSaving(true)
    setNoteError(null)
    try {
      const url = `${import.meta.env.VITE_API_URL}/annotate`
      const response = await axios.post(url, {
        patient_id: patientId,
        doctor_note: annotationNote.trim(),
        selected_text: selectedText
      })
      
      if (response && response.data) {
        // Add new annotation to list
        setAnnotations(prev => [response.data, ...prev])
        
        // Reset state
        setAnnotationNote('')
        setShowAnnotationModal(false)
        setSelectedText('')
        setSelectionPosition(null)
        
        // Clear selection
        window.getSelection()?.removeAllRanges()
      }
    } catch (e) {
      console.error('Save annotation error', e)
      setNoteError(e.response?.data?.detail || e.message || 'Failed to save annotation')
    } finally {
      setNoteSaving(false)
    }
  }

  // Handle safety check for prescription
  const handleSafetyCheck = async () => {
    console.log('🚀 handleSafetyCheck called')
    console.log('   patientId:', patientId)
    console.log('   drugName:', drugName)
    console.log('   drugName.trim():', drugName.trim())
    
    if (!patientId || !drugName.trim()) {
      console.log('❌ Early return - missing patientId or drugName')
      return
    }
    
    console.log('✅ Starting safety check...')
    
    try {
      // Reset states synchronously
      console.log('   Resetting all states...')
      setSafetyCheckLoading(true)
      setSafetyWarning(null)
      setSafetyCheckDone(false)
      
      const url = `${import.meta.env.VITE_API_URL}/safety-check/${encodeURIComponent(patientId)}`
      const payload = { drug_name: drugName.trim() }
      console.log('📡 Making API request:')
      console.log('   URL:', url)
      console.log('   Payload:', payload)
      
      const response = await axios.post(url, payload)
      console.log('📥 Response received:')
      console.log('   Status:', response.status)
      console.log('   Full response:', response)
      
      const data = response.data
      console.log('📦 Response data:', JSON.stringify(data, null, 2))
      console.log('   has_allergy:', data.has_allergy)
      console.log('   warnings:', data.warnings)
      console.log('   allergy_details:', data.allergy_details)
      
      // Process response and update states together
      let newWarning = null
      if (data.has_allergy || data.warnings?.length > 0) {
        console.log('⚠️ Allergies/warnings detected - preparing warning state')
        newWarning = {
          hasAllergy: data.has_allergy,
          warnings: data.warnings || [],
          allergyDetails: data.allergy_details || ''
        }
        console.log('   Warning object:', newWarning)
      } else {
        console.log('✅ No allergies found - will show GREEN SUCCESS banner')
      }
      
      // Update all states together
      console.log('🔄 Updating states: safetyCheckDone=true, safetyCheckLoading=false')
      setSafetyCheckDone(true)
      setSafetyCheckLoading(false)
      if (newWarning) {
        console.log('   Also setting safetyWarning:', newWarning)
        setSafetyWarning(newWarning)
      } else {
        console.log('   safetyWarning remains null (safe)')
      }
      
      console.log('✅ Safety check complete!')
    } catch (e) {
      console.error('❌ Safety check error:', e)
      console.error('   Error message:', e.message)
      console.error('   Error response:', e.response)
      console.error('   Error response data:', e.response?.data)
      
      const errorWarning = {
        hasAllergy: false,
        warnings: ['Safety check failed: ' + (e.response?.data?.detail || e.message)],
        allergyDetails: ''
      }
      console.log('   Setting error warning:', errorWarning)
      setSafetyCheckDone(true)
      setSafetyCheckLoading(false)
      setSafetyWarning(errorWarning)
    }
  }

  // Generate prescription PDF
  const handlePrintPrescription = () => {
    if (!drugName.trim()) return

    const doc = new jsPDF()
    const margin = 20
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let y = margin

    // Draw colored header background with gradient effect (simulate with multiple rects)
    doc.setFillColor(59, 130, 246) // Blue-500
    doc.rect(0, 0, pageWidth, 40, 'F')
    doc.setFillColor(37, 99, 235) // Blue-600
    doc.rect(0, 30, pageWidth, 10, 'F')

    // Medical cross symbol in header
    doc.setFontSize(24)
    doc.setTextColor(255, 255, 255)
    doc.text('✚', margin, 25)

    // Header title
    doc.setFontSize(22)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('MEDICAL PRESCRIPTION', pageWidth / 2, 27, { align: 'center' })
    y = 55

    // Patient info section with colored background
    doc.setFillColor(241, 245, 249) // Slate-100
    doc.roundedRect(margin - 5, y - 5, pageWidth - 2 * margin + 10, 25, 3, 3, 'F')
    
    doc.setTextColor(30, 41, 59) // Slate-800
    doc.setFontSize(11)
    doc.setFont(undefined, 'bold')
    doc.text('Patient:', margin, y)
    doc.setFont(undefined, 'normal')
    doc.text(`${reports[0]?.patient_name || 'Unknown'}`, margin + 30, y)
    
    y += 7
    doc.setFont(undefined, 'bold')
    doc.text('Date:', margin, y)
    doc.setFont(undefined, 'normal')
    doc.text(`${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin + 30, y)
    
    y += 7
    doc.setFont(undefined, 'bold')
    doc.text('System:', margin, y)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(59, 130, 246) // Blue-500
    doc.text('SummAID', margin + 30, y)
    
    y += 20

    // Rx symbol with colored circle background
    doc.setFillColor(16, 185, 129) // Emerald-500
    doc.circle(margin + 12, y + 5, 12, 'F')
    doc.setFontSize(28)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Rx', margin + 5, y + 10)
    
    y += 25

    // Medication section with border
    doc.setDrawColor(59, 130, 246) // Blue-500
    doc.setLineWidth(0.5)
    doc.rect(margin, y, pageWidth - 2 * margin, 50, 'S')
    
    y += 10
    doc.setFontSize(13)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(37, 99, 235) // Blue-600
    doc.text('MEDICATION DETAILS', margin + 5, y)
    
    y += 10
    doc.setFontSize(11)
    doc.setTextColor(30, 41, 59) // Slate-800
    doc.setFont(undefined, 'bold')
    doc.text('Drug:', margin + 10, y)
    doc.setFont(undefined, 'normal')
    doc.text(`${drugName}`, margin + 35, y)
    
    if (dosage) {
      y += 7
      doc.setFont(undefined, 'bold')
      doc.text('Dosage:', margin + 10, y)
      doc.setFont(undefined, 'normal')
      doc.text(`${dosage}`, margin + 35, y)
    }
    
    if (frequency) {
      y += 7
      doc.setFont(undefined, 'bold')
      doc.text('Frequency:', margin + 10, y)
      doc.setFont(undefined, 'normal')
      doc.text(`${frequency}`, margin + 35, y)
    }
    
    if (duration) {
      y += 7
      doc.setFont(undefined, 'bold')
      doc.text('Duration:', margin + 10, y)
      doc.setFont(undefined, 'normal')
      doc.text(`${duration}`, margin + 35, y)
    }

    // Safety warning if present (with red alert box)
    if (safetyWarning && safetyWarning.hasAllergy) {
      y += 20
      doc.setFillColor(254, 226, 226) // Red-100
      doc.setDrawColor(220, 38, 38) // Red-600
      doc.setLineWidth(1)
      doc.roundedRect(margin - 5, y - 5, pageWidth - 2 * margin + 10, 25, 3, 3, 'FD')
      
      doc.setTextColor(220, 38, 38) // Red-600
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('⚠ ALLERGY ALERT', margin, y)
      
      y += 8
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.setTextColor(153, 27, 27) // Red-800
      doc.text(safetyWarning.allergyDetails || 'Patient has known allergies', margin, y)
      y += 15
    } else {
      y += 20
    }

    // Footer section
    y = pageHeight - 50
    doc.setDrawColor(203, 213, 225) // Slate-300
    doc.setLineWidth(0.5)
    doc.line(margin, y, pageWidth - margin, y)
    
    y += 10
    doc.setFontSize(10)
    doc.setTextColor(30, 41, 59) // Slate-800
    doc.setFont(undefined, 'bold')
    doc.text('Doctor Signature:', margin, y)
    doc.setFont(undefined, 'normal')
    doc.text('_________________________', margin + 45, y)
    
    // Bottom badge
    y = pageHeight - 20
    doc.setFillColor(59, 130, 246) // Blue-500
    doc.roundedRect(margin, y - 3, 60, 8, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('Powered by SummAID', margin + 30, y + 2, { align: 'center' })

    // Prepare filename
    const fname = `prescription_${drugName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`

    try {
      // Try to open PDF in new window and trigger print
      const blob = doc.output('blob')
      const url = URL.createObjectURL(blob)
      const win = window.open('about:blank')
      if (win) {
        // Write an iframe hosting the blob URL so browser handles rendering/printing
        win.document.write(`<!doctype html><html><head><title>${fname}</title></head><body style="margin:0">
          <iframe src="${url}" style="border:0; width:100%; height:100vh;"></iframe>
          </body></html>`)
        win.document.close()
        // Attempt to focus and print (may be blocked without user gesture in some browsers)
        win.focus()
        // Give the iframe some time to load before calling print
        setTimeout(() => {
          try { win.print() } catch (e) { console.warn('Auto-print failed, user can print manually', e) }
        }, 500)
      } else {
        // Popup blocked — fallback to download
        doc.save(fname)
      }
    } catch (e) {
      console.error('Prescription PDF generation/display error', e)
      // Last-resort fallback to download
      try { doc.save(fname) } catch (_) { alert('Failed to generate prescription PDF') }
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
      const margin = 50
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const maxWidth = pageWidth - margin * 2
      let y = margin

      // Professional header with logo placeholder
      doc.setFillColor(37, 99, 235) // Blue header
      doc.rect(0, 0, pageWidth, 60, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(255, 255, 255)
      doc.text('SummAID', margin, 35)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Clinical Summary Report', margin, 48)
      
      // Patient info box - adjust height based on content
      y = 80
      const boxHeight = chiefComplaint ? 70 : 55
      doc.setTextColor(0, 0, 0)
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(1)
      doc.roundedRect(margin, y, maxWidth, boxHeight, 3, 3, 'S')
      
      // Patient ID (left side)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Patient ID:', margin + 10, y + 20)
      doc.setFont('helvetica', 'normal')
      doc.text(String(patientId), margin + 80, y + 20)
      
      // Generated timestamp (right side, aligned properly)
      const ts = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      const tsWidth = doc.getTextWidth(`Generated: ${ts}`)
      doc.text(`Generated: ${ts}`, margin + maxWidth - tsWidth - 10, y + 20)
      doc.setTextColor(0, 0, 0)
      
      // Chief Complaint (below, if exists)
      if (chiefComplaint) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(11)
        doc.text('Chief Complaint:', margin + 10, y + 42)
        doc.setFont('helvetica', 'normal')
        const ccText = doc.splitTextToSize(chiefComplaint, maxWidth - 130)
        doc.text(ccText, margin + 120, y + 42)
      }
      
      y += boxHeight + 20
      doc.setTextColor(0, 0, 0)

      // Helper functions
      const addSectionHeader = (text) => {
        y = ensurePageSpace(doc, y, 25, margin)
        doc.setFillColor(241, 245, 249) // Light slate background
        doc.roundedRect(margin, y - 5, maxWidth, 20, 2, 2, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(13)
        doc.setTextColor(15, 23, 42) // Slate 900
        doc.text(text, margin + 8, y + 10)
        y += 25
        doc.setTextColor(0, 0, 0)
      }

      const addParagraph = (text, indent = 0) => {
        if (!text) return
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(30, 41, 59) // Slate 800
        const lines = doc.splitTextToSize(text, maxWidth - indent)
        for (const line of lines) {
          y = ensurePageSpace(doc, y, 16, margin)
          doc.text(line, margin + indent, y)
          y += 16
        }
        y += 4 // Extra spacing after paragraph
      }

      const addBullets = (items) => {
        if (!items || items.length === 0) return
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        doc.setTextColor(30, 41, 59)
        for (const item of items) {
          const bulletIndent = 15
          const textLines = doc.splitTextToSize(item, maxWidth - bulletIndent - 5)
          y = ensurePageSpace(doc, y, 16 * textLines.length + 4, margin)
          
          // Draw bullet point
          doc.setFillColor(59, 130, 246) // Blue bullet
          doc.circle(margin + 5, y - 3, 2, 'F')
          
          doc.text(textLines, margin + bulletIndent, y)
          y += 16 * textLines.length + 4
        }
      }

      const addTable = (rows, headers) => {
        if (!rows || rows.length === 0) return
        
        const colWidths = [80, 200, 120, 100]
        const rowHeight = 20
        const headerHeight = 24
        
        y = ensurePageSpace(doc, y, headerHeight + rowHeight * Math.min(rows.length, 3), margin)
        
        // Table header
        doc.setFillColor(37, 99, 235) // Blue header
        doc.rect(margin, y, maxWidth, headerHeight, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.setTextColor(255, 255, 255)
        
        let xPos = margin + 8
        headers.forEach((header, i) => {
          doc.text(header, xPos, y + headerHeight / 2 + 3)
          xPos += colWidths[i]
        })
        
        y += headerHeight
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        
        // Table rows with alternating colors
        rows.forEach((row, rowIdx) => {
          y = ensurePageSpace(doc, y, rowHeight, margin)
          
          if (rowIdx % 2 === 0) {
            doc.setFillColor(248, 250, 252) // Light background for even rows
            doc.rect(margin, y, maxWidth, rowHeight, 'F')
          }
          
          xPos = margin + 8
          row.forEach((cell, i) => {
            const cellText = String(cell || '—')
            // Highlight abnormal flags
            if (i === 3 && (cellText.includes('High') || cellText.includes('Low') || cellText.includes('Loss'))) {
              doc.setTextColor(220, 38, 38) // Red for abnormal
              doc.setFont('helvetica', 'bold')
            } else if (i === 3 && cellText.includes('Normal')) {
              doc.setTextColor(22, 163, 74) // Green for normal
            }
            
            doc.text(cellText, xPos, y + rowHeight / 2 + 3)
            doc.setTextColor(0, 0, 0)
            doc.setFont('helvetica', 'normal')
            xPos += colWidths[i]
          })
          
          y += rowHeight
        })
        
        y += 10 // Spacing after table
      }

      // Parse summary content - handle ALL possible header formats
      const raw = summary || ''
      console.log('PDF Debug - Raw summary:', raw.substring(0, 500))
      
      const lines = raw.split(/\r?\n/)
      const sections = []
      let currentSection = null
      let currentContent = []
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const trimmed = line.trim()
        
        // Skip empty lines
        if (!trimmed) {
          continue
        }
        
        // Detect section headers in multiple formats:
        let isHeader = false
        let headerText = ''
        
        // 1. ## Markdown headers
        if (trimmed.startsWith('##')) {
          isHeader = true
          headerText = trimmed.replace(/^##\s*/, '').trim()
        }
        // 2. **Bold** headers (standalone on their own line)
        else if (/^\*\*[A-Z].+\*\*$/.test(trimmed)) {
          isHeader = true
          headerText = trimmed.replace(/^\*\*|\*\*$/g, '').trim()
        }
        // 3. Plain "Section Name:" format
        else if (/^[A-Z][A-Za-z\s&,'()-]+:\s*$/.test(trimmed)) {
          isHeader = true
          headerText = trimmed.replace(/:$/, '').trim()
        }
        // 4. ALL CAPS headers (like "KEY FINDINGS" or "LAB VALUES")
        else if (/^[A-Z][A-Z\s&'()-]+$/.test(trimmed) && trimmed.length > 3 && !trimmed.includes('|')) {
          isHeader = true
          headerText = trimmed
        }
        
        if (isHeader) {
          // Save previous section
          if (currentSection && currentContent.length > 0) {
            sections.push({
              title: currentSection,
              content: currentContent.join('\n')
            })
          }
          currentSection = headerText
          currentContent = []
        } else {
          currentContent.push(trimmed)
        }
      }
      
      // Save last section
      if (currentSection && currentContent.length > 0) {
        sections.push({
          title: currentSection,
          content: currentContent.join('\n')
        })
      }
      
      console.log('PDF Debug - Parsed sections:', sections.map(s => s.title))

      // If no sections found, treat entire summary as one block
      if (sections.length === 0 && raw.trim()) {
        sections.push({
          title: 'Clinical Summary',
          content: raw.trim()
        })
      }

      // Render all sections in order (they're already in document order)
      for (const section of sections) {
        const { title, content } = section
        if (!content || !content.trim()) continue
        
        console.log(`PDF Debug - Rendering section: ${title}`)
        addSectionHeader(title)
        
        // Parse section content
        const sectionLines = content.split('\n').filter(l => l.trim())
        const bullets = []
        const tableRows = []
        let paragraph = ''
        let inTable = false
        
        for (const line of sectionLines) {
          const trimmed = line.trim()
          
          // Table detection
          if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            // Check if this is a separator row (all cells are just dashes/hyphens)
            const isSeparatorRow = /^\|[\s\-|]+\|$/.test(trimmed) && !trimmed.includes(' ')
            
            if (!isSeparatorRow) {
              const cells = trimmed.split('|').map(s => s.trim()).filter(Boolean)
              console.log(`PDF Debug - Table row parsed:`, cells)
              if (cells.length >= 3) {
                tableRows.push(cells.slice(0, 4))
                inTable = true
              }
            } else {
              console.log(`PDF Debug - Skipping separator row:`, trimmed)
            }
            continue
          }
          
          // Bullet points
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            bullets.push(trimmed.replace(/^[-*]\s*/, ''))
          } else if (!inTable) {
            paragraph += (paragraph ? ' ' : '') + trimmed
          }
        }
        
        // Render content
        if (paragraph) {
          console.log(`PDF Debug - Adding paragraph: ${paragraph.substring(0, 100)}`)
          addParagraph(paragraph, 5)
        }
        if (bullets.length > 0) {
          console.log(`PDF Debug - Adding ${bullets.length} bullets`)
          addBullets(bullets)
        }
        if (tableRows.length > 0) {
          console.log(`PDF Debug - Adding table with ${tableRows.length} rows`, tableRows)
          
          // Check if first row looks like headers (contains words like Date, Test, Value, Flag)
          const firstRow = tableRows[0].map(c => c.toLowerCase())
          const isHeaderRow = firstRow.some(cell => 
            ['date', 'test', 'value', 'flag', 'time', 'result'].includes(cell)
          )
          
          let headers, dataRows
          if (isHeaderRow) {
            // First row is headers, rest are data
            headers = tableRows[0]
            dataRows = tableRows.slice(1)
          } else {
            // No header row, use default headers and all rows are data
            headers = ['Date', 'Test', 'Value', 'Flag']
            dataRows = tableRows
          }
          
          console.log(`PDF Debug - Headers:`, headers, `Data rows:`, dataRows.length)
          
          if (dataRows.length > 0) {
            addTable(dataRows, headers)
          }
        }
      }

      // Footer on last page
      const addFooter = () => {
        doc.setFontSize(8)
        doc.setTextColor(150, 150, 150)
        doc.text('This document is AI-generated. Verify all clinical decisions with source records.', 
          margin, pageHeight - 20)
        doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, 
          pageWidth - margin - 30, pageHeight - 20)
      }
      
      addFooter()

      // Save with professional filename
      const pad = (n) => String(n).padStart(2, '0')
      const d = new Date()
      const fname = `SummAID_Clinical_Summary_Patient_${patientId}_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.pdf`
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

  // Lazy PDF URL: only resolve when a report is selected
  const pdfUrl = selectedReportId ? `${import.meta.env.VITE_API_URL}/report-file/${selectedReportId}` : null

  // Simple page render cache (data URLs) to avoid re-rendering already visited pages
  const pageCacheRef = useRef(new Map())
  const [pageImage, setPageImage] = useState(null)

  const capturePageCanvas = () => {
    const canvases = document.querySelectorAll('.react-pdf__Page canvas')
    if (canvases && canvases[0]) {
      try {
        const dataUrl = canvases[0].toDataURL('image/png')
        const key = `${selectedReportId}-${pageNumber}`
        pageCacheRef.current.set(key, dataUrl)
        setPageImage(dataUrl)
      } catch {}
    }
  }

  useEffect(() => {
    console.log('useEffect - activeCitationText:', activeCitationText ? 'YES' : 'NO', 'pageNumber:', pageNumber)
    // Disable cache when highlighting active citation to show text layer
    if (activeCitationText) {
      console.log('Setting pageImage to NULL to force text layer render')
      setPageImage(null)
      return
    }
    
    const key = `${selectedReportId}-${pageNumber}`
    // If cached, use image immediately
    if (pageCacheRef.current.has(key)) {
      console.log('Using CACHED image for page', pageNumber)
      setPageImage(pageCacheRef.current.get(key))
    } else {
      console.log('No cache - will render PDF for page', pageNumber)
      setPageImage(null)
    }
  }, [pageNumber, selectedReportId, activeCitationText])

  // MA View - Simplified
  if (userRole === 'MA') {
    return (
      <div className="h-full w-full bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-blue-900">
        <div className="h-full flex items-center justify-center p-8">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 mb-4">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                Prepare Patient Chart
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Patient ID: <span className="font-semibold text-blue-600 dark:text-blue-400">{patientId}</span>
              </p>
            </div>

            {/* Reports List (Read-only for MA) */}
            {loadingReports ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading reports...</span>
              </div>
            ) : reports.length > 0 ? (
              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                  Available Reports ({reports.length}):
                </p>
                <div className="flex flex-wrap gap-2">
                  {reports.map(r => (
                    <div
                      key={r.report_id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      {r.filename}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">No reports found for this patient</p>
              </div>
            )}

            {/* Chief Complaint Input */}
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

            {/* Error Display */}
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

            {/* Success State */}
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

            {/* Prepare Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || !reports.length}
              className={cn(
                "w-full py-4 text-base font-bold rounded-lg transition-all duration-200 shadow-lg flex items-center justify-center gap-3",
                generating || !reports.length
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
          </div>
        </div>
      </div>
    )
  }

  // Doctor View - Full UI
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
                      setActiveCitationId(null)
                      setActiveCitationText('')
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
                  {pageImage ? (
                    <img src={pageImage} alt={`Page ${pageNumber}`} className="block max-w-full h-auto" />
                  ) : (
                    <Document
                      key={`${patientId}-${selectedReportId}-${activeCitationId || 'default'}`}
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
                        onRenderSuccess={(page) => {
                          console.log('Page rendered - activeCitationText:', activeCitationText ? 'YES' : 'NO')
                          if (!activeCitationText) {
                            capturePageCanvas(page)
                          }
                        }}
                        customTextRenderer={({ str }) => {
                          console.log('customTextRenderer called - str length:', str?.length || 0, 'activeCitationText:', activeCitationText ? 'YES' : 'NO')
                          if (!activeCitationText || !str) return str
                          const lower = str.toLowerCase()
                          const trimmed = lower.trim()
                          // Match individual words/tokens from the citation - more flexible
                          if (trimmed.length > 3) {
                            // Split citation into significant words
                            const citationWords = activeCitationText.split(/\s+/).filter(w => w.length > 3)
                            const strWords = trimmed.split(/\s+/).filter(w => w.length > 3)
                            // Highlight if any significant word from this chunk appears in citation
                            const hasMatch = strWords.some(word => citationWords.includes(word))
                            if (hasMatch) {
                              console.log('HIGHLIGHTING:', trimmed.substring(0, 50))
                              return `<mark style="background:rgba(250, 204, 21, 0.4);padding:2px 4px;border-radius:2px;border-bottom:2px solid rgba(251, 191, 36, 0.8);color:inherit;font-weight:inherit;">${str}</mark>`
                            }
                          }
                          return str
                        }}
                      />
                    </Document>
                  )}
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
        <Panel defaultSize={45} minSize={25} className="flex flex-col gap-0 min-h-0">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg h-full flex flex-col shadow-2xl m-4 ml-2 min-h-0">
            {/* Tabs Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                      activeTab === 'summary'
                        ? "bg-blue-500 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Summary
                  </button>
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                      activeTab === 'chat'
                        ? "bg-blue-500 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('rx')}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                      activeTab === 'rx'
                        ? "bg-blue-500 text-white"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Rx
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPdf}
                    disabled={!summary}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                      !summary
                        ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                    )}
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
            
            {/* Tab Content - single expression with nested ternaries to avoid adjacency parse issues */}
            {activeTab === 'summary' ? (
              <div className="flex-1 overflow-hidden flex flex-col bg-white dark:bg-slate-800 min-h-0">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                  {userRole === 'MA' ? (
                    <div className="flex items-center gap-2">
                      <input
                        id="chief-complaint"
                        type="text"
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate() }}
                        placeholder="Chief complaint (optional)"
                        className="flex-1 text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className={cn(
                          "px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                          generating
                            ? "bg-slate-300 dark:bg-slate-600 text-slate-500 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        )}
                      >
                        {generating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Generating
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Generate
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {chartPrepared ? 'Prepared summary available' : 'Awaiting chart preparation by MA'}
                      </div>
                      <button
                        onClick={fetchPersistedSummary}
                        disabled={generating}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
                          generating ? "bg-slate-300 dark:bg-slate-600 text-slate-500" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                        )}
                      >
                        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                        {generating ? 'Loading' : 'Refresh'}
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-auto p-4 min-h-0">
                  {error && (
                    <div className="mb-4 text-sm text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-md p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div className="text-xs">{error}</div>
                    </div>
                  )}
                  {generating && (
                    <div className="flex items-center gap-3 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md border border-blue-200 dark:border-blue-800">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{userRole === 'DOCTOR' ? 'Loading prepared summary...' : 'Analyzing patient records...'}</span>
                    </div>
                  )}
                  {!generating && summary && (
                    <div className="prose prose-sm dark:prose-invert max-w-none relative">
                      <div ref={summaryRef} onMouseUp={handleTextSelection} className="select-text">
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
                            em: ({ children }) => <em className="italic text-slate-600 dark:text-slate-400">{children}</em>,
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-6 shadow-md rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="min-w-full divide-y divide-slate-300 dark:divide-slate-600">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-700">{children}</thead>,
                            tbody: ({ children }) => <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">{children}</tbody>,
                            tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">{children}</tr>,
                            th: ({ children }) => <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-r border-slate-200 dark:border-slate-600 last:border-r-0">{children}</th>,
                            td: ({ children }) => <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-700 last:border-r-0">{children}</td>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-2 my-4 italic text-slate-700 dark:text-slate-300">{children}</blockquote>,
                            code: ({ children, inline }) => 
                              inline 
                                ? <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">{children}</code>
                                : <code className="block bg-slate-100 dark:bg-slate-800 p-3 rounded-md text-xs font-mono overflow-x-auto">{children}</code>
                          }}
                        >
                          {summary}
                        </ReactMarkdown>
                      </div>
                      {selectedText && selectionPosition && (
                        <div className="fixed z-50 animate-in fade-in duration-200" style={{ top: `${selectionPosition.top + 5}px`, left: `${selectionPosition.left}px`, transform: 'translateX(-50%)' }}>
                          <button onClick={() => setShowAnnotationModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md shadow-lg hover:bg-blue-700 transition-all">
                            <Plus className="h-3.5 w-3.5" />
                            Note
                          </button>
                        </div>
                      )}
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
                    <details className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3">
                      <summary className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 mb-2">📎 View Evidence Sources ({citations.length})</summary>
                      <ul className="space-y-2 mt-2 max-h-64 overflow-auto">
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
                            if (!reportId) return
                            const fullText = (c.source_full_text || c.source_text_preview || '').toLowerCase()
                            console.log('Citation clicked - text length:', fullText.length, 'preview:', fullText.substring(0, 100))
                            // Clear cache to force fresh render with text layer
                            pageCacheRef.current.clear()
                            // Set citation data - useEffect will handle pageImage
                            if (reportId !== selectedReportId) setSelectedReportId(reportId)
                            setPageNumber(Math.max(1, parseInt(page, 10) || 1))
                            setActiveCitationId(id)
                            setActiveCitationText(fullText)
                          }
                          const toggle = () => {
                            setExpandedCitationIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
                          }
                          return (
                            <li key={id} className={cn("rounded-lg border transition-all duration-200 overflow-hidden group", isActive ? "border-amber-400 dark:border-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30 shadow-lg" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md")}> 
                              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", isActive ? "bg-amber-500 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400")}>#{id}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Page {page} · Chunk {meta.chunk_index ?? '—'}</span>
                                  <span className="text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full truncate max-w-[120px]" title={reportLabel}>{reportLabel}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={goToSource} className={cn("text-[10px] px-2 py-1 rounded-md font-medium transition-all flex items-center gap-1", isActive ? "bg-amber-500 text-white" : "bg-blue-500 text-white hover:bg-blue-600")}> <Eye className="h-3 w-3" /> View </button>
                                  <button onClick={toggle} className="text-[10px] px-2 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"> {isExpanded ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} </button>
                                </div>
                              </div>
                              <button onClick={goToSource} className={cn("w-full text-left px-3 py-2 text-[11px] leading-relaxed transition-colors", isActive ? "text-amber-900 dark:text-amber-100" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800")}>{isExpanded ? (c.source_full_text || c.source_text_preview) : c.source_text_preview}</button>
                            </li>
                          )
                        })}
                      </ul>
                    </details>
                  )}
                </div>
              </div>
            ) : activeTab === 'chat' ? (
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
            ) : (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-auto p-4">
                  <div className="max-w-2xl mx-auto space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                        Write Prescription
                      </h3>
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        Complete the form below and run a safety check before printing
                      </p>
                    </div>
                    
                    {/* DEBUG STATE PANEL - Remove this after debugging */}
                    <div className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md p-2 text-xs font-mono">
                      <div className="font-bold text-gray-700 dark:text-gray-300 mb-1">🐛 Debug State:</div>
                      <div className="space-y-0.5 text-gray-600 dark:text-gray-400">
                        <div>safetyCheckLoading: <span className="font-bold text-blue-600">{String(safetyCheckLoading)}</span></div>
                        <div>safetyCheckDone: <span className="font-bold text-green-600">{String(safetyCheckDone)}</span></div>
                        <div>safetyWarning: <span className="font-bold text-orange-600">{safetyWarning ? JSON.stringify(safetyWarning) : 'null'}</span></div>
                      </div>
                    </div>
                    
                    {/* Safety Status Banner */}
                    {(() => {
                      console.log('🎨 Rendering safety banners...')
                      console.log('   safetyCheckDone:', safetyCheckDone)
                      console.log('   safetyWarning:', safetyWarning)
                      console.log('   Should show green banner:', safetyCheckDone && !safetyWarning)
                      return null
                    })()}
                    {safetyCheckDone && !safetyWarning && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-md p-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-300">Safe: no documented allergies found for this drug.</span>
                      </div>
                    )}
                    {safetyWarning && safetyWarning.hasAllergy && (
                      <div className="bg-red-50 dark:bg-red-900/30 border border-red-500 dark:border-red-700 rounded-md p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">Allergy Alert: {drugName}</p>
                            <p className="text-xs text-red-600 dark:text-red-400">{safetyWarning.allergyDetails}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {safetyWarning && !safetyWarning.hasAllergy && safetyWarning.warnings && safetyWarning.warnings.length > 0 && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-md p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Warnings</p>
                            <ul className="space-y-0.5">
                              {safetyWarning.warnings.map((w,i)=>(<li key={i} className="text-[11px] text-yellow-700 dark:text-yellow-300">• {w}</li>))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Drug Name */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Drug Name *
                      </label>
                      <input
                        type="text"
                        value={drugName}
                        onChange={(e) => {
                          console.log('💊 Drug name changed:', e.target.value)
                          setDrugName(e.target.value)
                          console.log('   Resetting safetyCheckDone = false')
                          setSafetyCheckDone(false)
                          console.log('   Resetting safetyWarning = null')
                          setSafetyWarning(null)
                        }}
                        placeholder="e.g., Amoxicillin"
                        className="w-full text-sm px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    
                    {/* Dosage */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Dosage
                      </label>
                      <input
                        type="text"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        placeholder="e.g., 500mg"
                        className="w-full text-sm px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    
                    {/* Frequency */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Frequency
                      </label>
                      <input
                        type="text"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        placeholder="e.g., 3 times daily"
                        className="w-full text-sm px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    
                    {/* Duration */}
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                        Duration
                      </label>
                      <input
                        type="text"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        placeholder="e.g., 7 days"
                        className="w-full text-sm px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    
                    {/* Safety & Print Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          alert('Button clicked! Check console for logs.')
                          console.log('🖱️ Safety Check button clicked')
                          console.log('drugName:', drugName)
                          console.log('patientId:', patientId)
                          console.log('safetyCheckLoading:', safetyCheckLoading)
                          handleSafetyCheck()
                        }}
                        disabled={!drugName.trim() || safetyCheckLoading}
                        className={cn(
                          "flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                          !drugName.trim() || safetyCheckLoading
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                            : safetyCheckDone
                            ? "bg-green-500 text-white hover:bg-green-600"
                            : "bg-orange-500 text-white hover:bg-orange-600"
                        )}
                      >
                        {safetyCheckLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Checking...
                          </>
                        ) : safetyCheckDone ? (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Safety Check Complete
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4" />
                            Safety Check
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={handlePrintPrescription}
                        disabled={!drugName.trim() || !safetyCheckDone || (safetyWarning && safetyWarning.hasAllergy)}
                        className={cn(
                          "flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                          (!drugName.trim() || !safetyCheckDone || (safetyWarning && safetyWarning.hasAllergy))
                            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        )}
                      >
                        <FileText className="h-4 w-4" />
                        {!safetyCheckDone ? 'Run Safety Check First' : (safetyWarning && safetyWarning.hasAllergy) ? 'Cannot Prescribe - Allergy' : 'Print Prescription'}
                      </button>
                    </div>
                    
                    {/* (Old inline safety blocks replaced by consolidated banner above) */}
                  </div>
                </div>
              </div>
            )}
            
            {/* Clinical Notes */}
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 p-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Clinical Notes
                </h4>
                {noteSaved && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    Saved
                  </span>
                )}
              </div>
              
              {/* List of specific annotations */}
              {annotations.length > 0 && (
                <details className="mb-3 group">
                  <summary className="text-[10px] font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1 mb-1 select-none">
                    <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                    Specific Annotations ({annotations.length})
                  </summary>
                  <div className="space-y-2 max-h-32 overflow-y-auto pr-1 pl-2 mt-1">
                    {annotations.map((ann, idx) => (
                      <div key={idx} className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-xs">
                        <div className="font-medium text-slate-700 dark:text-slate-300 mb-1 border-l-2 border-yellow-400 pl-2 italic">
                          "{ann.selected_text}"
                        </div>
                        <div className="text-slate-600 dark:text-slate-400 pl-2">
                          {ann.doctor_note || ann.note}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {noteError && (
                <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>{noteError}</span>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  placeholder="Add clinical note..."
                  className="flex-1 text-xs px-2 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                />
                <button
                  onClick={handleSaveNote}
                  disabled={noteSaving || !noteText.trim()}
                  className={cn(
                    "px-3 py-2 text-xs font-medium rounded-md transition-all self-start",
                    noteSaving || !noteText.trim()
                      ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  )}
                >
                  {noteSaving ? 'Saving' : 'Save'}
                </button>
              </div>
          </div>
        </div>
      </Panel>
      </PanelGroup>
      
      {/* Annotation Modal */}
      {showAnnotationModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Add Annotation</h3>
              <button
                onClick={() => {
                  setShowAnnotationModal(false)
                  setAnnotationNote('')
                  setSelectedText('')
                  setSelectionPosition(null)
                  window.getSelection()?.removeAllRanges()
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Selected Text:
                </label>
                <div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2 text-slate-700 dark:text-slate-300">
                  "{selectedText}"
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                  Your Note:
                </label>
                <textarea
                  value={annotationNote}
                  onChange={(e) => setAnnotationNote(e.target.value)}
                  placeholder="e.g., Check again in 3 months"
                  rows={3}
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  autoFocus
                />
              </div>
              
              {noteError && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>{noteError}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowAnnotationModal(false)
                  setAnnotationNote('')
                  setSelectedText('')
                  setSelectionPosition(null)
                  window.getSelection()?.removeAllRanges()
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAnnotation}
                disabled={noteSaving || !annotationNote.trim()}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                  noteSaving || !annotationNote.trim()
                    ? "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-blue-500 text-white hover:bg-blue-600"
                )}
              >
                {noteSaving ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    Save Annotation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
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

