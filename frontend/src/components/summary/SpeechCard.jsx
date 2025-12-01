import { Ear, Volume2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { AudiogramChart } from './AudiogramChart'

/**
 * SpeechCard - Displays speech/audiology data.
 * 
 * Shows:
 * - Audiogram (hearing thresholds for left/right ear)
 * - Speech test scores (SRT, WRS)
 * - Hearing loss type and severity
 * - Tinnitus status
 * - Amplification recommendation
 */
export function SpeechCard({ speechData, citations, className }) {
  if (!speechData) return null

  const {
    audiogram = {},
    speech_scores = {},
    hearing_loss_type,
    hearing_loss_severity,
    tinnitus,
    amplification
  } = speechData

  // Severity color
  const getSeverityColor = (severity) => {
    if (!severity) return 'slate'
    const s = severity.toLowerCase()
    if (s.includes('mild')) return 'yellow'
    if (s.includes('moderate')) return 'orange'
    if (s.includes('severe')) return 'red'
    if (s.includes('profound')) return 'purple'
    return 'slate'
  }

  const severityColor = getSeverityColor(hearing_loss_severity)

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-shadow",
      className
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-slate-200 dark:border-slate-700">
        <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
          <Ear className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Speech & Audiology</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Hearing assessment</p>
        </div>
      </div>

      {/* Hearing Loss Summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {hearing_loss_type && (
          <div className="p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg">
            <p className="text-xs text-cyan-600 dark:text-cyan-400 font-medium mb-1">Type</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{hearing_loss_type}</p>
          </div>
        )}
        {hearing_loss_severity && (
          <div className={cn(
            "p-3 rounded-lg",
            severityColor === 'yellow' && "bg-yellow-50 dark:bg-yellow-900/20",
            severityColor === 'orange' && "bg-orange-50 dark:bg-orange-900/20",
            severityColor === 'red' && "bg-red-50 dark:bg-red-900/20",
            severityColor === 'purple' && "bg-purple-50 dark:bg-purple-900/20",
            severityColor === 'slate' && "bg-slate-50 dark:bg-slate-900/20"
          )}>
            <p className={cn(
              "text-xs font-medium mb-1",
              severityColor === 'yellow' && "text-yellow-600 dark:text-yellow-400",
              severityColor === 'orange' && "text-orange-600 dark:text-orange-400",
              severityColor === 'red' && "text-red-600 dark:text-red-400",
              severityColor === 'purple' && "text-purple-600 dark:text-purple-400",
              severityColor === 'slate' && "text-slate-600 dark:text-slate-400"
            )}>Severity</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{hearing_loss_severity}</p>
          </div>
        )}
      </div>

      {/* Audiogram Chart */}
      {audiogram && (audiogram.left || audiogram.right) && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Clinical Audiogram</h3>
          <AudiogramChart audiogram={audiogram} />
        </div>
      )}

      {/* Speech Scores */}
      {(speech_scores.srt_db || speech_scores.wrs_percent) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {speech_scores.srt_db && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">SRT</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {speech_scores.srt_db}
                <span className="text-xs text-slate-500 ml-1">dB HL</span>
              </p>
            </div>
          )}
          {speech_scores.wrs_percent && (
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">WRS</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {speech_scores.wrs_percent}
                <span className="text-xs text-slate-500 ml-1">%</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Additional Info */}
      <div className="space-y-2">
        {tinnitus !== null && tinnitus !== undefined && (
          <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
            <Volume2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Tinnitus: <span className="font-semibold">{tinnitus ? 'Present' : 'Absent'}</span>
            </p>
          </div>
        )}
        {amplification && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Amplification</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{amplification}</p>
          </div>
        )}
      </div>
    </div>
  )
}
