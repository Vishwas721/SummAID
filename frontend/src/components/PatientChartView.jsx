import { useState } from 'react'
import axios from 'axios'
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '../lib/utils'

export function PatientChartView({ patientId }) {
  const [summary, setSummary] = useState('')
  const [sources, setSources] = useState([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async () => {
    if (!patientId) return
    setGenerating(true)
    setError(null)
    setSummary('')
    setSources([])
    try {
      const url = `${import.meta.env.VITE_API_URL}/summarize/${encodeURIComponent(patientId)}`
      const response = await axios.post(url, {
        // Phase 1: send defaults; future: allow keyword input
        keywords: null,
        max_chunks: 12,
        max_context_chars: 12000
      })
      const data = response.data
      setSummary(data.summary || '(No summary returned)')
      setSources(Array.isArray(data.sources) ? data.sources : [])
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
              {sources.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-xs font-semibold text-card-foreground mb-1">Sources ({sources.length})</h3>
                  <ul className="space-y-1 max-h-48 overflow-auto pr-1">
                    {sources.map((s, idx) => {
                      const meta = s.metadata || {}
                      const page = meta.page ?? meta.page_number ?? '—'
                      const chunkIndex = meta.chunk_index ?? '—'
                      return (
                        <li key={idx} className="text-[11px] leading-snug bg-muted/30 border border-border rounded px-2 py-1 flex flex-col">
                          <span className="font-mono">{s.filepath || '(filepath missing)'} </span>
                          <span className="text-muted-foreground">page: {page} | chunk: {chunkIndex}</span>
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
