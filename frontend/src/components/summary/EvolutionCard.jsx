import { BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * EvolutionCard - Displays the patient's medical journey narrative.
 * 
 * Shows a 2-3 sentence summary of how the patient's condition has evolved over time.
 */
export function EvolutionCard({ evolution, citations, onOpenCitation, className }) {
  return (
    <div className={cn(
      "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-shadow",
      className
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Medical Journey</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Clinical evolution</p>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {evolution ? (
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {evolution}
          </p>
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
