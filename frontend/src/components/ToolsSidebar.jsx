import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Send, FileText, Pill, Loader2, AlertTriangle, CheckCircle2, Printer, Download, Mic, X } from 'lucide-react'
import { cn } from '../lib/utils'
import axios from 'axios'
import jsPDF from 'jspdf'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { SummaryPanel } from './SummaryPanel'
import { SummaryGrid } from './summary/SummaryGrid'

export function ToolsSidebar({ patientId }) {
  const [userRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')

  // Active tab
  const [activeTab, setActiveTab] = useState('chat')

  // Chat
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)

  // Speech
  const { isListening, transcript, startListening, stopListening, resetTranscript, isSupported, error: speechError } = useSpeechRecognition()
  const lastProcessedTranscriptRef = useRef('')

  // Scroll anchor
  const messagesEndRef = useRef(null)

  // Rx
  const [drugName, setDrugName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration, setDuration] = useState('')
  const [safetyCheckLoading, setSafetyCheckLoading] = useState(false)
  const [safetyWarning, setSafetyWarning] = useState(null)
  const [safetyCheckDone, setSafetyCheckDone] = useState(false)

  useEffect(() => {
    if (transcript && transcript !== lastProcessedTranscriptRef.current) {
      const newText = transcript.substring(lastProcessedTranscriptRef.current.length)
      if (newText) setChatInput((p) => p + newText)
      lastProcessedTranscriptRef.current = transcript
    }
  }, [transcript])

  useEffect(() => {
    if (!isListening) {
      lastProcessedTranscriptRef.current = ''
      resetTranscript()
    }
  }, [isListening, resetTranscript])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [messages, chatLoading])

  if (userRole !== 'DOCTOR') return null



  const handleSendMessage = async () => {
    if (!patientId || !chatInput.trim() || chatLoading) return
    if (isListening) stopListening()
    resetTranscript()

    const text = chatInput.trim()
    setChatInput('')
    setMessages((p) => [...p, { role: 'user', content: text }])
    setChatLoading(true)
    setChatError(null)

    try {
      const url = `${import.meta.env.VITE_API_URL}/chat/${encodeURIComponent(patientId)}`
      const resp = await axios.post(url, { question: text, max_chunks: 15, max_context_chars: 12000 })
      const data = resp.data || {}
      setMessages((p) => [...p, { role: 'ai', content: data.answer || '(No answer)', citations: Array.isArray(data.citations) ? data.citations : [] }])
    } catch (e) {
      const err = e.response?.data?.detail || e.message || 'Unknown error'
      setChatError(err)
      setMessages((p) => [...p, { role: 'ai', content: `Error: ${err}`, isError: true }])
    } finally {
      setChatLoading(false)
    }
  }

  const getCitationUrl = (c) => {
    if (!c) return null
    return c.pdf_url || c.source_url || (c.report_id ? `${import.meta.env.VITE_API_URL}/report-file/${encodeURIComponent(c.report_id)}` : null)
  }

  const renderCitations = (citations) => {
    if (!Array.isArray(citations) || citations.length === 0) return null
    const seen = new Set(); const uniq = []
    for (const c of citations) {
      const key = `${c.report_id||''}::${c.page_num||c.page||''}::${c.chunk_index||c.chunk_id||''}`
      if (seen.has(key)) continue
      seen.add(key); uniq.push(c)
    }
    const MAX = 6
    return (
      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 text-xs opacity-90">
        <p className="font-semibold mb-1">Sources:</p>
        {uniq.slice(0, MAX).map((c, i) => {
          const url = getCitationUrl(c)
          const label = c.report_name || c.source_name || `Page ${c.page_num||c.page||'?'} (chunk ${c.chunk_index||c.chunk_id||'?'})`
          return (
            <p key={i} className="truncate">{url ? <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">• {label}</a> : <span>• {label}</span>}</p>
          )
        })}
        {uniq.length > MAX && <p className="text-slate-500 dark:text-slate-400">+{uniq.length - MAX} more</p>}
      </div>
    )
  }

  const handleSafetyCheck = async () => {
    if (!patientId || !drugName.trim()) return
    setSafetyCheckLoading(true); setSafetyWarning(null); setSafetyCheckDone(false)
    try {
      const url = `${import.meta.env.VITE_API_URL}/safety-check/${encodeURIComponent(patientId)}`
      const resp = await axios.post(url, { drug_name: drugName.trim() })
      const data = resp.data || {}
      const newWarning = (data.has_allergy || (data.warnings && data.warnings.length)) ? { hasAllergy: data.has_allergy, warnings: data.warnings || [], allergyDetails: data.allergy_details || '' } : null
      setSafetyWarning(newWarning)
      setSafetyCheckDone(true)
    } catch (e) {
      setSafetyWarning({ hasAllergy: false, warnings: ['Safety check failed: ' + (e.response?.data?.detail || e.message)], allergyDetails: '' })
      setSafetyCheckDone(true)
    } finally {
      setSafetyCheckLoading(false)
    }
  }

  const handlePrintPrescription = () => {
    if (!drugName.trim()) return
    const doc = new jsPDF(); const margin = 20; let y = margin
    doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text('PRESCRIPTION', 105, y, { align: 'center' }); y += 15
    doc.setFontSize(11); doc.setFont(undefined, 'normal'); doc.text(`Patient ID: ${patientId}`, margin, y); y += 10
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, y); y += 15
    doc.setFontSize(13); doc.setFont(undefined, 'bold'); doc.text('Medication:', margin, y); y += 8
    doc.setFontSize(11); doc.setFont(undefined, 'normal'); doc.text(`Drug: ${drugName}`, margin + 5, y); y += 7
    if (dosage) { doc.text(`Dosage: ${dosage}`, margin + 5, y); y += 7 }
    if (frequency) { doc.text(`Frequency: ${frequency}`, margin + 5, y); y += 7 }
    if (duration) { doc.text(`Duration: ${duration}`, margin + 5, y); y += 7 }
    y += 20; doc.setFontSize(9); doc.setFont(undefined, 'italic'); doc.text('Generated by SummAID', margin, y)
    const pdfBlob = doc.output('blob'); const blobUrl = URL.createObjectURL(pdfBlob); const w = window.open(blobUrl, '_blank')
    if (w) { w.onload = () => setTimeout(() => w.print(), 250) } else { doc.save(`prescription_patient_${patientId}_${Date.now()}.pdf`) }
  }

  return (
    <div className="h-full flex bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:bg-slate-900">
      {/* Vertical Sidebar */}
      <div className="w-64 bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:bg-slate-950 flex flex-col border-r border-slate-200 dark:border-slate-700 shadow-xl">
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-white/50 backdrop-blur-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Tools</h3>
        </div>

        <div className="flex flex-col p-3 gap-2">
          <button 
            onClick={() => setActiveTab('summary')} 
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'summary' 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
            )}
          >
            <FileText className="h-5 w-5"/> 
            SUMMARY
          </button>

          <button 
            onClick={() => setActiveTab('chat')} 
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
              activeTab === 'chat' 
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
                : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
            )}
          >
            <MessageSquare className="h-5 w-5"/> 
            CHATBOT
          </button>

          {userRole === 'DOCTOR' && (
            <button 
              onClick={() => setActiveTab('rx')} 
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'rx' 
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30' 
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600'
              )}
            >
              <Pill className="h-5 w-5"/> 
              RX
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
        {activeTab === 'summary' && (
          <div className="flex-1 overflow-auto">
            <SummaryGrid patientId={patientId} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-auto p-4 space-y-3">
              {!patientId ? (
                <div className="text-center p-12 text-slate-500 dark:text-slate-400">
                  <MessageSquare className="h-20 w-20 mx-auto mb-6 opacity-30" />
                  <p className="text-xl font-semibold mb-2">Select a patient to start chatting</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 px-6">
                  <div className="max-w-2xl mx-auto">
                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-xl">
                      <MessageSquare className="h-10 w-10 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-3">Ask About Patient</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8">Get instant answers from the patient's medical records, lab results, and clinical notes.</p>
                    
                    <div className="grid gap-3 text-left">
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setChatInput("What are the patient's current medications?")}>
                        <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">💊 Current Medications</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">"What are the patient's current medications?"</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setChatInput("What are the latest lab results?")}>
                        <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-1">🧪 Lab Results</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">"What are the latest lab results?"</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setChatInput("Does the patient have any allergies?")}>
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">⚠️ Allergies</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">"Does the patient have any allergies?"</p>
                      </div>
                      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => setChatInput("What is the diagnosis and treatment plan?")}>
                        <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-1">🩺 Diagnosis & Plan</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">"What is the diagnosis and treatment plan?"</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              
              {messages.map((m,i)=> (
                <div key={i} className={cn('w-full my-2 flex', m.role==='user' ? 'justify-end pr-8' : 'justify-start pl-8')}>
                  <div
                    className={cn(
                      'p-3 rounded-lg text-sm max-w-[75%] break-words',
                      m.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : m.isError
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-white dark:bg-slate-800 border'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.citations && m.citations.length>0 && renderCitations(m.citations)}
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="w-full my-2 flex justify-start pl-8">
                  <div className="p-3 rounded-lg text-sm bg-white dark:bg-slate-800 border flex items-center gap-3 max-w-[50%]">
                    <div className="flex items-center gap-1">
                      <span className="inline-block w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                      <span className="inline-block w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.12s' }} />
                      <span className="inline-block w-2.5 h-2.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.24s' }} />
                    </div>
                    <span className="text-xs text-slate-500">Thinking...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t bg-white dark:bg-slate-800">
              {speechError && <div className="mb-2 p-2 bg-red-50 text-red-700 text-xs rounded">{speechError}</div>}
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>{ if (e.key==='Enter' && !chatLoading) handleSendMessage() }} placeholder="Ask about patient..." disabled={!patientId || chatLoading} className="flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-slate-700" />
                <button onMouseDown={startListening} onMouseUp={stopListening} onMouseLeave={stopListening} onTouchStart={startListening} onTouchEnd={stopListening} disabled={!patientId || chatLoading || !isSupported} className={cn('px-3 py-2 rounded-lg', isListening ? 'bg-red-500 text-white' : 'bg-slate-200') } title={isSupported ? 'Hold to record' : 'Not supported'}><Mic className="h-4 w-4"/></button>
                <button onClick={handleSendMessage} disabled={!patientId || !chatInput.trim() || chatLoading} className="px-4 py-2 bg-blue-500 text-white rounded-lg"><Send className="h-4 w-4"/></button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rx' && userRole === 'DOCTOR' && (
          <div className="flex-1 overflow-auto p-6">
            {!patientId ? (
              <div className="text-center p-12 text-slate-500 dark:text-slate-400">
                <Pill className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a patient to create prescription</p>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">Digital Prescription</h2>
                
                <div><label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Drug Name *</label><input className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={drugName} onChange={(e)=>setDrugName(e.target.value)} placeholder="e.g., Amoxicillin"/></div>
                <div><label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Dosage</label><input className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={dosage} onChange={(e)=>setDosage(e.target.value)} placeholder="e.g., 500mg"/></div>
                <div><label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Frequency</label><input className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={frequency} onChange={(e)=>setFrequency(e.target.value)} placeholder="e.g., 3x daily"/></div>
                <div><label className="block text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Duration</label><input className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" value={duration} onChange={(e)=>setDuration(e.target.value)} placeholder="e.g., 7 days"/></div>

                <button onClick={handleSafetyCheck} disabled={!drugName.trim() || safetyCheckLoading} className="w-full py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2">
                  {safetyCheckLoading ? <><Loader2 className="h-5 w-5 animate-spin"/> Checking Safety...</> : <><AlertTriangle className="h-5 w-5"/> Safety Check</>}
                </button>

                {safetyCheckDone && !safetyWarning && (
                  <div className="p-4 rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-900/20"><div className="flex items-start gap-3"><CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400"/><div><p className="text-base font-semibold text-green-800 dark:text-green-200">✅ Safe to Prescribe</p><p className="text-sm text-green-700 dark:text-green-300">No documented allergies found for this drug.</p></div></div></div>
                )}

                {safetyWarning && safetyWarning.hasAllergy && (
                  <div className="p-4 rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-900/20"><div className="flex items-start gap-3"><AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400"/><div><p className="text-base font-semibold text-red-800 dark:text-red-200">⚠️ Allergy Alert</p><p className="text-sm text-red-700 dark:text-red-300 mb-2">{safetyWarning.allergyDetails}</p>{safetyWarning.warnings && safetyWarning.warnings.length > 0 && <ul className="space-y-1 text-sm">{safetyWarning.warnings.map((w,i)=><li key={i} className="text-red-600 dark:text-red-400">• {w}</li>)}</ul>}</div></div></div>
                )}

                {safetyWarning && !safetyWarning.hasAllergy && safetyWarning.warnings && safetyWarning.warnings.length > 0 && (
                  <div className="p-4 rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"><div className="flex items-start gap-3"><AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400"/><div><p className="text-base font-semibold text-yellow-800 dark:text-yellow-200">⚠️ Warnings</p><ul className="space-y-1 text-sm">{safetyWarning.warnings.map((w,i)=><li key={i} className="text-yellow-700 dark:text-yellow-300">• {w}</li>)}</ul></div></div></div>
                )}

                <button onClick={handlePrintPrescription} disabled={!drugName.trim() || !safetyCheckDone} className={cn('w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2', !drugName.trim() || !safetyCheckDone ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-500 text-white hover:bg-green-600') }><Printer className="h-5 w-5"/>{safetyCheckDone ? 'Print Prescription' : 'Run Safety Check First'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
