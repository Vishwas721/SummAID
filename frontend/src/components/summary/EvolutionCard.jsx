import { useMemo, useState } from 'react'
import { BookOpen, Edit2, Save, X, Clock, FileText } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * EvolutionCard - Displays the patient's medical journey narrative.
 * 
 * Shows a 2-3 sentence summary of how the patient's condition has evolved over time.
 * Supports doctor editing with save/cancel functionality.
 */
export function EvolutionCard({ 
  evolution, 
  citations, 
  onOpenCitation, 
  className,
  userRole,
  patientId,
  onSave
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(evolution || '')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [viewMode, setViewMode] = useState('timeline') // 'timeline' | 'narrative' | 'points'
  const [highlight, setHighlight] = useState(true)

  // Lightweight client-side parsing for a more interactive view
  const parsedEvents = useMemo(() => {
    if (!evolution) return []
    const text = evolution
    const sentences = text.split(/\n+|(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean)
    const dateRegexes = [
      /\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/, // 2025-12-01
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?\b/i, // Dec 1, 2025
      /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?\b/i // 1 Dec 2025
    ]
    const keywords = [
      { key: 'diagnos', label: 'Diagnosis', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
      { key: 'admit', label: 'Admission', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
      { key: 'discharg', label: 'Discharge', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
      { key: 'surg', label: 'Surgery', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
      { key: 'chem', label: 'Chemo', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
      { key: 'radiat', label: 'Radiation', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
      { key: 'medicat', label: 'Medication', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
      { key: 'allerg', label: 'Allergy', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
      { key: 'follow', label: 'Follow-up', color: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' },
    ]
    const events = sentences.map((s, idx) => {
      const dateMatch = dateRegexes.find(r => r.test(s))
      const dateText = dateMatch ? (s.match(dateMatch) || [])[0] : null
      const tags = keywords.filter(k => s.toLowerCase().includes(k.key)).map(k => ({ label: k.label, color: k.color }))
      return { id: idx, sentence: s, dateText, tags }
    })
    // Heuristic: stable order but prefer dated sentences first
    const withDate = events.filter(e => e.dateText)
    const withoutDate = events.filter(e => !e.dateText)
    return [...withDate, ...withoutDate]
  }, [evolution])

  const handleEdit = () => {
    setEditedContent(evolution || '')
    setIsEditing(true)
    setSaveSuccess(false)
  }

  const handleCancel = () => {
    setEditedContent(evolution || '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`http://localhost:8002/patients/${patientId}/summary/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          section: 'medical_journey',
          content: editedContent,
          edited_by: localStorage.getItem('user_email') || 'doctor@example.com'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save edit')
      }

      const result = await response.json()
      setIsEditing(false)
      setSaveSuccess(true)
      
      // Call parent callback if provided
      if (onSave) {
        onSave(result.summary)
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error) {
      console.error('Error saving edit:', error)
      alert('Failed to save edit. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const canEdit = userRole === 'DOCTOR'

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-shadow",
      className
    )}>
      {/* Card Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
            <BookOpen className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Medical Journey</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Clinical evolution</p>
          </div>
        </div>
        
        {/* View mode + Edit controls */}
        <div className="flex items-center gap-2">
          {/* Toggle narrative/timeline */}
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden">
            <button
              onClick={() => setViewMode('timeline')}
              className={cn('px-2 py-1 text-xs flex items-center gap-1', viewMode==='timeline' ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')}
              title="Timeline view"
            >
              <Clock className="h-3.5 w-3.5" /> Timeline
            </button>
            <button
              onClick={() => setViewMode('narrative')}
              className={cn('px-2 py-1 text-xs flex items-center gap-1 border-l border-slate-300 dark:border-slate-600', viewMode==='narrative' ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')}
              title="Narrative view"
            >
              <FileText className="h-3.5 w-3.5" /> Narrative
            </button>
            <button
              onClick={() => setViewMode('points')}
              className={cn('px-2 py-1 text-xs flex items-center gap-1 border-l border-slate-300 dark:border-slate-600', viewMode==='points' ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')}
              title="Point-wise view"
            >
              • Points
            </button>
          </div>
          {/* Highlight toggle */}
          <label className="ml-2 flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={highlight} onChange={(e)=>setHighlight(e.target.checked)} />
            Highlight
          </label>

          {canEdit && (
          <div className="flex items-center gap-2 ml-2">
            {saveSuccess && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                Saved ✓
              </span>
            )}
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  disabled={isSaving}
                  className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Save className="h-4 w-4" />
                </button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {isEditing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full min-h-[120px] p-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-y"
            placeholder="Enter medical journey text..."
          />
        ) : evolution ? (
          viewMode === 'timeline' ? (
            <ul className="space-y-3">
              {parsedEvents.map(ev => (
                <li key={ev.id} className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {ev.dateText && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                          {ev.dateText}
                        </span>
                      )}
                      {ev.tags.slice(0,3).map((t, i) => (
                        <span key={i} className={cn('px-2 py-0.5 rounded-md text-xs font-medium', t.color)}>{t.label}</span>
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {highlight ? (
                        <span dangerouslySetInnerHTML={{
                          __html: ev.sentence
                            .replace(/(diagnos\w+)/ig, '<strong>$1</strong>')
                            .replace(/(surg\w+)/ig, '<strong>$1</strong>')
                            .replace(/(chem\w+)/ig, '<strong>$1</strong>')
                            .replace(/(radiat\w+)/ig, '<strong>$1</strong>')
                            .replace(/(medicat\w+|drug|therapy)/ig, '<strong>$1</strong>')
                            .replace(/(allerg\w+)/ig, '<mark class=\"bg-pink-200 dark:bg-pink-900/40\">$1</mark>')
                        }} />
                      ) : ev.sentence}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : viewMode === 'points' ? (
            <ul className="space-y-2">
              {parsedEvents.map(ev => (
                <li key={ev.id} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-400"></span>
                  <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {highlight ? (
                      <span dangerouslySetInnerHTML={{
                        __html: ev.sentence
                          .replace(/\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\b/g, '') // drop names
                          .replace(/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*(?:\s+\d{4})?\b/ig, '') // drop dates
                          .replace(/\b(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/g, '')
                          .replace(/^(\s*[-•]\s*)/, '')
                          .replace(/(diagnos\w+)/ig, '<strong>$1</strong>')
                          .replace(/(surg\w+)/ig, '<strong>$1</strong>')
                          .replace(/(chem\w+)/ig, '<strong>$1</strong>')
                          .replace(/(radiat\w+)/ig, '<strong>$1</strong>')
                          .replace(/(medicat\w+|drug|therapy)/ig, '<strong>$1</strong>')
                          .replace(/(allerg\w+)/ig, '<mark class=\"bg-pink-200 dark:bg-pink-900/40\">$1</mark>')
                      }} />
                    ) : (
                      ev.sentence
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {highlight ? (
                <span dangerouslySetInnerHTML={{
                  __html: (evolution || '')
                    .replace(/(diagnos\w+)/ig, '<strong>$1</strong>')
                    .replace(/(surg\w+)/ig, '<strong>$1</strong>')
                    .replace(/(chem\w+)/ig, '<strong>$1</strong>')
                    .replace(/(radiat\w+)/ig, '<strong>$1</strong>')
                    .replace(/(medicat\w+|drug|therapy)/ig, '<strong>$1</strong>')
                    .replace(/(allerg\w+)/ig, '<mark class=\"bg-pink-200 dark:bg-pink-900/40\">$1</mark>')
                }} />
              ) : evolution}
            </p>
          )
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">
            No evolution data available
          </p>
        )}
      </div>

      {/* Sources: clickable citation numbers for this section */}
      {citations && citations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500 dark:text-slate-400">Sources:</span>
            {(citations.slice(0, 6)).map((c, idx) => (
              <button
                key={`${c.source_chunk_id}-${idx}`}
                onClick={() => onOpenCitation && onOpenCitation(c)}
                className="px-1.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded"
                title={c.source_text_preview}
              >
                [{idx + 1}]
              </button>
            ))}
            {citations.length > 6 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">+{citations.length - 6} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
