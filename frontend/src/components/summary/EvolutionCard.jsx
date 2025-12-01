import { BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * EvolutionCard - Displays the patient's medical journey narrative.
 * 
 * Shows a 2-3 sentence summary of how the patient's condition has evolved over time.
 */
export function EvolutionCard({ evolution, citations, className }) {
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

      {/* Optional: Citation indicators */}
      {citations && citations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Based on {citations.length} source{citations.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
