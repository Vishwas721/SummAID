import { useState } from 'react'
import { MessageSquare, Send, FileText, Pill, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '../lib/utils'
import axios from 'axios'

export function ToolsSidebar({ patientId }) {
  const [userRole] = useState(localStorage.getItem('user_role') || 'DOCTOR')
  const [activeTab, setActiveTab] = useState('chat')
  
  // Chat state
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
  const [safetyCheckDone, setSafetyCheckDone] = useState(false)
  
  // MA role should not see this sidebar at all
  if (userRole !== 'DOCTOR') {
    return null
  }

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

  const handleSafetyCheck = async () => {
    if (!patientId || !drugName.trim()) return
    setSafetyCheckLoading(true)
    setSafetyWarning(null)
    setSafetyCheckDone(false)
    
    try {
      const url = `${import.meta.env.VITE_API_URL}/safety-check/${encodeURIComponent(patientId)}`
      const response = await axios.post(url, {
        drug_name: drugName,
        dosage: dosage || null,
        frequency: frequency || null,
        duration: duration || null
      })
      const data = response.data
      setSafetyWarning(data.warning || null)
      setSafetyCheckDone(true)
    } catch (e) {
      console.error('Safety check error', e)
      setSafetyWarning(`Error: ${e.response?.data?.detail || e.message}`)
      setSafetyCheckDone(false)
    } finally {
      setSafetyCheckLoading(false)
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
                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600 text-xs opacity-80">
                      <p className="font-semibold mb-1">Sources:</p>
                      {msg.citations.map((c, i) => (
                        <p key={i}>• Page {c.page_num || '?'} (chunk {c.chunk_index || '?'})</p>
                      ))}
                    </div>
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
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
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
                  onClick={handleSendMessage}
                  disabled={!patientId || !chatInput.trim() || chatLoading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
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

                {safetyWarning && (
                  <div className={cn(
                    'p-4 rounded-lg border',
                    safetyWarning.toLowerCase().includes('no') || safetyWarning.toLowerCase().includes('safe')
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  )}>
                    <div className="flex items-start gap-2">
                      {safetyWarning.toLowerCase().includes('no') || safetyWarning.toLowerCase().includes('safe') ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Safety Analysis</p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">{safetyWarning}</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
