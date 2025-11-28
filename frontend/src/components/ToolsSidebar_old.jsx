import { useState } from 'react'
import { MessageSquare, Send, FileText, Download, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import axios from 'axios'
import jsPDF from 'jspdf'

export function ToolsSidebar({ patientId, summary, citations }) {
  const [userRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  const [activeTab, setActiveTab] = useState('chat')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState(null)
  
  // Rx state (DOCTOR only)
  const [drugName, setDrugName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [duration, setDuration] = useState('')
  const [safetyCheckLoading, setSafetyCheckLoading] = useState(false)
  const [safetyWarning, setSafetyWarning] = useState(null)

  const handleSendMessage = async () => {
    if (!patientId || !chatInput.trim() || chatLoading) return
    
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

  const handleDownloadPdf = () => {
    if (!summary) return
    try {
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const margin = 50
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const maxWidth = pageWidth - margin * 2
      let y = margin

      // Header
      doc.setFillColor(37, 99, 235)
      doc.rect(0, 0, pageWidth, 60, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.setTextColor(255, 255, 255)
      doc.text('SummAID', margin, 35)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Clinical Summary Report', margin, 48)
      
      // Patient info box
      y = 80
      const boxHeight = 55
      doc.setTextColor(0, 0, 0)
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(1)
      doc.roundedRect(margin, y, maxWidth, boxHeight, 3, 3, 'S')
      
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.text('Patient ID:', margin + 10, y + 20)
      doc.setFont('helvetica', 'normal')
      doc.text(String(patientId), margin + 80, y + 20)
      
      const ts = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      const tsWidth = doc.getTextWidth(`Generated: ${ts}`)
      doc.text(`Generated: ${ts}`, margin + maxWidth - tsWidth - 10, y + 20)
      doc.setTextColor(0, 0, 0)
      
      y += boxHeight + 20

      // Summary content
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(11)
      doc.setTextColor(30, 41, 59)
      const lines = doc.splitTextToSize(summary, maxWidth)
      for (const line of lines) {
        if (y + 16 > pageHeight - margin) {
          doc.addPage()
          y = margin
        }
        doc.text(line, margin, y)
        y += 16
      }

      // Footer
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text('This document is AI-generated. Verify all clinical decisions with source records.', 
        margin, pageHeight - 20)
      doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, 
        pageWidth - margin - 30, pageHeight - 20)

      const pad = (n) => String(n).padStart(2, '0')
      const d = new Date()
      const fname = `SummAID_Clinical_Summary_Patient_${patientId}_${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.pdf`
      doc.save(fname)
    } catch (e) {
      console.error('PDF generation error', e)
      alert('Failed to generate PDF: ' + (e?.message || e))
    }
  }

  return (
    <div className="h-full flex flex-col bg-white/80 dark:bg-slate-800/80 backdrop-blur border-r border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Tools</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Chat & Actions</p>
      </div>

      {/* Tab Selector */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex gap-1">
        <button
          onClick={() => setActiveTab('chat')}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
            activeTab === 'chat'
              ? 'bg-blue-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          )}
        >
          <MessageSquare className="h-3 w-3 inline mr-1" />
          Chat
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={cn(
            'flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
            activeTab === 'actions'
              ? 'bg-blue-500 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
          )}
        >
          <FileText className="h-3 w-3 inline mr-1" />
          Actions
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {activeTab === 'chat' ? (
          <>
            {/* Chat Messages */}
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-4">
                  <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No messages</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Ask about patient reports</p>
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div className={cn(
                      'max-w-[85%] rounded-lg px-3 py-2 shadow-sm text-xs',
                      msg.role === 'user' 
                        ? 'bg-blue-500 text-white'
                        : msg.isError
                          ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    )}>
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 shadow-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Chat Input */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
              {chatError && (
                <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-[10px] text-red-700 dark:text-red-300 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                  <span>{chatError}</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                  placeholder="Ask a question..."
                  disabled={chatLoading || !patientId}
                  className="flex-1 text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={chatLoading || !chatInput.trim() || !patientId}
                  className={cn(
                    'px-3 py-2 rounded-md transition-all',
                    chatLoading || !chatInput.trim() || !patientId
                      ? 'bg-slate-200 dark:bg-slate-600 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  )}
                >
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto p-4 space-y-3">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">Quick Actions</div>
            
            {/* Export PDF */}
            <button
              onClick={handleDownloadPdf}
              disabled={!summary || !patientId}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all text-left',
                !summary || !patientId
                  ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30'
              )}
            >
              <Download className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">Export PDF</div>
                <div className="text-[10px] opacity-75">Download summary as PDF</div>
              </div>
            </button>

            {!patientId && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 italic text-center mt-6">
                Select a patient to enable actions
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
