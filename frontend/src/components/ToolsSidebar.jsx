import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, FileText, Pill, Loader2, AlertTriangle, CheckCircle2, Printer, Download, Mic } from 'lucide-react'
import { cn } from '../lib/utils'
import axios from 'axios'
import jsPDF from 'jspdf'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

export function ToolsSidebar({ patientId }) {
  const [userRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  const [activeTab, setActiveTab] = useState('chat')
  
  // Chat state
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  
  // Speech recognition
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, error: speechError } = useSpeechRecognition()
  
  // Scroll reference for auto-scroll to bottom
  const messagesEndRef = useRef(null)
  const lastProcessedTranscriptRef = useRef('')
  
  // Rx state (DOCTOR only)
  const [drugName, setDrugName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration, setDuration] = useState('')
  const [safetyCheckLoading, setSafetyCheckLoading] = useState(false)
  const [safetyWarning, setSafetyWarning] = useState(null)
  const [safetyCheckDone, setSafetyCheckDone] = useState(false)
  
  // Update chat input when speech recognition provides transcript
  useEffect(() => {
    if (transcript && transcript !== lastProcessedTranscriptRef.current) {
      const newText = transcript.substring(lastProcessedTranscriptRef.current.length)
      if (newText) {
        setChatInput(prev => prev + newText)
        lastProcessedTranscriptRef.current = transcript
      }
    }
  }, [transcript])
  
  // Reset transcript tracking when recognition stops
  useEffect(() => {
    if (!isListening) {
      lastProcessedTranscriptRef.current = ''
      resetTranscript()
    }
  }, [isListening, resetTranscript])
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    // Multiple scroll attempts to ensure it works
    if (messagesEndRef.current) {
      // Immediate scroll
      messagesEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' })
      
      // Delayed scroll for dynamic content
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [messages, chatLoading])
  
  // MA role should not see this sidebar at all
  if (userRole !== 'DOCTOR') {
    return null
  }

  const handleSendMessage = async () => {
    if (!patientId || !chatInput.trim() || chatLoading) return
    
    // Stop any ongoing speech recognition and clear transcript
    if (isListening) {
      stopListening()
    }
    resetTranscript()
    
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatError(null)
    
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
      
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: data.answer || '(No answer returned)',
        citations: Array.isArray(data.citations) ? data.citations : []
      }])
    } catch (e) {
      console.error('Chat error', e)
      const errorMsg = e.response?.data?.detail || e.message || 'Unknown error'
      setChatError(errorMsg)
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `Sorry, I encountered an error: ${errorMsg}`,
        isError: true
      }])
    } finally {
      setChatLoading(false)
    }
  }

  const handlePrintPrescription = () => {
    if (!drugName.trim()) return

    const doc = new jsPDF()
    const margin = 20
    let y = margin

    // Header
    doc.setFontSize(18)
    doc.setFont(undefined, 'bold')
    doc.text('PRESCRIPTION', 105, y, { align: 'center' })
    y += 15

    // Patient info
    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.text(`Patient ID: ${patientId}`, margin, y)
    y += 10
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, y)
    y += 15

    // Prescription details
    doc.setFontSize(13)
    doc.setFont(undefined, 'bold')
    doc.text('Medication:', margin, y)
    y += 8

    doc.setFontSize(11)
    doc.setFont(undefined, 'normal')
    doc.text(`Drug: ${drugName}`, margin + 5, y)
    y += 7
    if (dosage) {
      doc.text(`Dosage: ${dosage}`, margin + 5, y)
      y += 7
    }
    if (frequency) {
      doc.text(`Frequency: ${frequency}`, margin + 5, y)
      y += 7
    }
    if (duration) {
      doc.text(`Duration: ${duration}`, margin + 5, y)
      y += 7
    }

    // Footer
    y += 20
    doc.setFontSize(9)
    doc.setFont(undefined, 'italic')
    doc.text('Generated by SummAID', margin, y)

    // Open in new window for printing
    const pdfBlob = doc.output('blob')
    const blobUrl = URL.createObjectURL(pdfBlob)
    const printWindow = window.open(blobUrl, '_blank')
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
        }, 250)
      }
    } else {
      // Fallback: download
      doc.save(`prescription_patient_${patientId}_${Date.now()}.pdf`)
    }
  }

  // Resolve a PDF/URL from a citation object (similar to SummaryPanel)
  const getCitationUrl = (c) => {
    if (!c) return null
    return (
      c.pdf_url ||
      c.source_url ||
      (c.report_id ? `${import.meta.env.VITE_API_URL}/report-file/${encodeURIComponent(c.report_id)}` : null)
    )
  }

  // Render citations: dedupe, link, and limit displayed items
  const renderCitations = (citations) => {
    if (!Array.isArray(citations) || citations.length === 0) return null

    const seen = new Set()
    const unique = []
    for (const c of citations) {
      const key = `${c.report_id || c.source_url || c.pdf_url || ''}::${c.page_num || c.page || ''}::${c.chunk_index || c.chunk_id || ''}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(c)
    }

    const MAX_SHOW = 6
    const shown = unique.slice(0, MAX_SHOW)

    return (
      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 text-xs opacity-90">
        <p className="font-semibold mb-1">Sources:</p>
        {shown.map((c, i) => {
          const url = getCitationUrl(c)
          const label = c.report_name || c.source_name || `Page ${c.page_num || c.page || '?'} (chunk ${c.chunk_index || c.chunk_id || '?'})`
          return (
            <p key={i} className="truncate">
              {url ? (
                <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                  • {label}
                </a>
              ) : (
                <span>• {label}</span>
              )}
            </p>
          )
        })}

        {unique.length > MAX_SHOW && (
          <p className="text-slate-500 dark:text-slate-400">+{unique.length - MAX_SHOW} more</p>
        )}
      </div>
    )
  }

  const handleSafetyCheck = async () => {
    console.log('🚀 handleSafetyCheck called in ToolsSidebar')
    console.log('   patientId:', patientId)
    console.log('   drugName:', drugName)
    
    if (!patientId || !drugName.trim()) {
      console.log('❌ Early return - missing patientId or drugName')
      return
    }
    
    console.log('✅ Starting safety check...')
    
    try {
      // Reset states
      console.log('   Resetting states...')
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
      
      // Process response
      let newWarning = null
      if (data.has_allergy || data.warnings?.length > 0) {
        console.log('⚠️ Allergies/warnings detected')
        newWarning = {
          hasAllergy: data.has_allergy,
          warnings: data.warnings || [],
          allergyDetails: data.allergy_details || ''
        }
        console.log('   Warning object:', newWarning)
      } else {
        console.log('✅ No allergies found - safe')
      }
      
      // Update states
      console.log('🔄 Updating states: safetyCheckDone=true, safetyCheckLoading=false')
      setSafetyCheckDone(true)
      setSafetyCheckLoading(false)
      setSafetyWarning(newWarning)
      
      console.log('✅ Safety check complete!')
    } catch (e) {
      console.error('❌ Safety check error:', e)
      console.error('   Error message:', e.message)
      console.error('   Error response:', e.response?.data)
      
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

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700">
      {/* Sidebar Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Tools</h3>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all',
            activeTab === 'chat'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </button>
        {userRole === 'DOCTOR' && (
          <button
            onClick={() => setActiveTab('rx')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all',
              activeTab === 'rx'
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            )}
          >
            <Pill className="h-4 w-4" />
            Rx
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {!patientId && (
                <div className="text-center p-6 text-sm text-slate-500 dark:text-slate-400">
                  Select a patient to start chatting
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={cn(
                  'p-3 rounded-lg text-sm',
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white ml-8'
                    : msg.isError
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 mr-8'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-8 border border-slate-200 dark:border-slate-700'
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.citations && msg.citations.length > 0 && (
                    renderCitations(msg.citations)
                  )}
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}
              {chatError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{chatError}</span>
                </div>
              )}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {speechError && (
                <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded">
                  {speechError}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) handleSendMessage() }}
                  placeholder="Ask about patient..."
                  disabled={!patientId || chatLoading}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                />
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onMouseLeave={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={!patientId || chatLoading || !isSupported}
                  className={cn(
                    "px-3 py-2 rounded-lg transition-all",
                    isListening
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600",
                    (!patientId || chatLoading || !isSupported) && "opacity-50 cursor-not-allowed"
                  )}
                  title={isSupported ? "Hold to record voice" : "Voice input not supported"}
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!patientId || !chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {isListening && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Recording... Release to stop
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rx' && userRole === 'DOCTOR' && (
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {!patientId ? (
              <div className="text-center p-6 text-sm text-slate-500 dark:text-slate-400">
                Select a patient to create prescription
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Drug Name *</label>
                  <input
                    type="text"
                    value={drugName}
                    onChange={(e) => setDrugName(e.target.value)}
                    placeholder="e.g., Amoxicillin"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Dosage</label>
                  <input
                    type="text"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g., 500mg"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Frequency</label>
                  <input
                    type="text"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    placeholder="e.g., 3x daily"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g., 7 days"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                
                <button
                  onClick={handleSafetyCheck}
                  disabled={!drugName.trim() || safetyCheckLoading}
                  className="w-full py-2.5 px-4 bg-blue-500 text-white text-sm font-semibold rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {safetyCheckLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking Safety...
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      Safety Check
                    </>
                  )}
                </button>

                {/* Success banner when safe */}
                {safetyCheckDone && !safetyWarning && (
                  <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-green-800 dark:text-green-200 mb-1">✅ Safe</p>
                        <p className="text-xs text-green-700 dark:text-green-300">No documented allergies found for this drug.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Allergy warnings */}
                {safetyWarning && safetyWarning.hasAllergy && (
                  <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Allergy Alert</p>
                        <p className="text-xs text-red-700 dark:text-red-300 mb-2">{safetyWarning.allergyDetails}</p>
                        {safetyWarning.warnings && safetyWarning.warnings.length > 0 && (
                          <ul className="space-y-1">
                            {safetyWarning.warnings.map((w, i) => (
                              <li key={i} className="text-xs text-red-600 dark:text-red-400">• {w}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* General warnings (no specific allergy) */}
                {safetyWarning && !safetyWarning.hasAllergy && safetyWarning.warnings && safetyWarning.warnings.length > 0 && (
                  <div className="p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">⚠️ Warnings</p>
                        <ul className="space-y-1">
                          {safetyWarning.warnings.map((w, i) => (
                            <li key={i} className="text-xs text-yellow-700 dark:text-yellow-300">• {w}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Print Prescription button */}
                <button
                  onClick={handlePrintPrescription}
                  disabled={!drugName.trim() || !safetyCheckDone}
                  className={cn(
                    "w-full py-2.5 px-4 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
                    !drugName.trim() || !safetyCheckDone
                      ? "bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                      : "bg-green-500 text-white hover:bg-green-600"
                  )}
                >
                  <Printer className="h-4 w-4" />
                  {safetyCheckDone ? 'Print Prescription' : 'Run Safety Check First'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
