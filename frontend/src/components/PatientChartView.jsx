import { useState } from 'react'
import axios from 'axios'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '../lib/utils'

export function PatientChartView({ patientId }) {
  const [summary, setSummary] = useState('')
  const [citations, setCitations] = useState([])
  const [expandedCitationIds, setExpandedCitationIds] = useState(new Set())
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

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

  return (
    <div className="h-full w-full">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Left Panel: PDF Placeholder */}
        <Panel defaultSize={55} minSize={35} className={cn("bg-card border border-border rounded-md overflow-hidden flex flex-col")}>          
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-card-foreground">Report Viewer</h2>
            <span className="text-xs text-muted-foreground font-mono">patient: {patientId}</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-muted-foreground text-sm">
              PDF viewer placeholder<br/>Coming in Task 10
            </div>
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
