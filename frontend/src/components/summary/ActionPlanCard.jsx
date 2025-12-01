import { ClipboardList, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * ActionPlanCard - Displays current status and treatment plan as interactive checklists.
 * 
 * Shows:
 * - Current Status: 3-5 bullet points of active conditions/findings
 * - Treatment Plan: 3-5 bullet points of next steps
 */
export function ActionPlanCard({ currentStatus, plan, citations, onOpenCitation, className }) {
  const hasStatus = currentStatus && currentStatus.length > 0
  const hasPlan = plan && plan.length > 0

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-shadow",
      className
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Action Plan</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Status & next steps</p>
        </div>
      </div>

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
