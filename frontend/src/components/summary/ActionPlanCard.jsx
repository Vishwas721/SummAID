import { useState } from 'react'
import { ClipboardList, CheckCircle2, Circle, Edit2, Save, X } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * ActionPlanCard - Displays current status and treatment plan as interactive checklists.
 * 
 * Shows:
 * - Current Status: 3-5 bullet points of active conditions/findings
 * - Treatment Plan: 3-5 bullet points of next steps
 * Supports doctor editing with save/cancel functionality.
 */
export function ActionPlanCard({ 
  currentStatus, 
  plan, 
  citations, 
  onOpenCitation, 
  className,
  userRole,
  patientId,
  onSave
}) {
  const hasStatus = currentStatus && currentStatus.length > 0
  const hasPlan = plan && plan.length > 0

  // Combine current status and plan into single editable text
  const combinedText = [
    hasStatus ? `Current Status:\n${currentStatus.map(s => `• ${s}`).join('\n')}` : '',
    hasPlan ? `Treatment Plan:\n${plan.map(p => `• ${p}`).join('\n')}` : ''
  ].filter(Boolean).join('\n\n')

  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(combinedText)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleEdit = () => {
    setEditedContent(combinedText)
    setIsEditing(true)
    setSaveSuccess(false)
  }

  const handleCancel = () => {
    setEditedContent(combinedText)
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
          section: 'action_plan',
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
          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Action Plan</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Status & next steps</p>
          </div>
        </div>
        
        {/* Edit/Save/Cancel Buttons */}
        {canEdit && (
          <div className="flex items-center gap-2">
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

      {/* Content */}
      {isEditing ? (
        <textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="w-full min-h-[200px] p-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-y"
          placeholder="Enter current status and treatment plan..."
        />
      ) : (
        <>
          {/* Current Status Section */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="inline-block w-1 h-4 bg-amber-500 rounded"></span>
              Current Status
            </h3>
            {hasStatus ? (
              <ul className="space-y-2">
                {currentStatus.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <Circle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No current status data</p>
            )}
          </div>

          {/* Treatment Plan Section */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <span className="inline-block w-1 h-4 bg-green-500 rounded"></span>
              Treatment Plan
            </h3>
            {hasPlan ? (
              <ul className="space-y-2">
                {plan.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">No treatment plan data</p>
            )}
          </div>
        </>
      )}
      {/* Sources */}
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
