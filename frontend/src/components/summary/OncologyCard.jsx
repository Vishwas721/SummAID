import { Heart, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

/**
 * OncologyCard - Displays oncology-specific data.
 * 
 * Shows:
 * - Tumor size trend chart
 * - TNM staging
 * - Cancer type and grade
 * - Biomarkers (ER, PR, HER2, etc.)
 * - Treatment response
 */
export function OncologyCard({ oncologyData, citations, className }) {
  if (!oncologyData) return null

  const {
    tumor_size_trend = [],
    tnm_staging,
    cancer_type,
    grade,
    biomarkers = {},
    treatment_response
  } = oncologyData

  // Prepare tumor size chart data with status
  const tumorChartData = tumor_size_trend.map(t => ({
    date: t.date || 'Unknown',
    size: t.size_cm || 0,
    status: t.status || null
  }))

  // Calculate tumor trend (use AI-provided status if available)
  const getTumorTrend = () => {
    if (tumorChartData.length === 0) return 'stable'
    
    // Use latest measurement's status if available
    const latestStatus = tumorChartData[tumorChartData.length - 1].status
    if (latestStatus) {
      return latestStatus.toLowerCase() // IMPROVING, WORSENING, STABLE
    }
    
    // Fallback: calculate from measurements
    if (tumorChartData.length < 2) return 'stable'
    const latest = tumorChartData[tumorChartData.length - 1].size
    const previous = tumorChartData[tumorChartData.length - 2].size
    if (latest > previous) return 'worsening'
    if (latest < previous) return 'improving'
    return 'stable'
  }

  const tumorTrend = getTumorTrend()

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-shadow",
      className
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
          <Heart className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Oncology</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cancer metrics & staging</p>
        </div>
      </div>

      {/* Cancer Type & Grade */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {cancer_type && (
          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1">Cancer Type</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{cancer_type}</p>
          </div>
        )}
        {grade && (
          <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
            <p className="text-xs text-pink-600 dark:text-pink-400 font-medium mb-1">Grade</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{grade}</p>
          </div>
        )}
        {tnm_staging && (
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg col-span-2">
            <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-1">TNM Staging</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{tnm_staging}</p>
          </div>
        )}
      </div>

      {/* Tumor Size Trend */}
      {tumorChartData.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Tumor Size Trend</h3>
            <div className="flex items-center gap-1.5">
              {(tumorTrend === 'worsening' || tumorTrend === 'up') && (
                <>
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">WORSENING</span>
                </>
              )}
              {(tumorTrend === 'improving' || tumorTrend === 'down') && (
                <>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">IMPROVING</span>
                </>
              )}
              {tumorTrend === 'stable' && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">STABLE</span>
              )}
            </div>
          </div>
          
          {tumorChartData.length > 1 ? (
            <div className="h-40 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tumorChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    stroke="#cbd5e1"
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    label={{ value: 'cm', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '11px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="size" 
                    stroke="#a855f7" 
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#a855f7' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Latest: <span className="font-semibold">{tumorChartData[0].size} cm</span> ({tumorChartData[0].date})
              </p>
            </div>
          )}
        </div>
      )}

      {/* Biomarkers */}
      {Object.keys(biomarkers).length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Biomarkers</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(biomarkers).map(([key, value]) => (
              <div key={key} className="p-2 bg-slate-50 dark:bg-slate-900/50 rounded border border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">{key}</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{String(value)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Treatment Response */}
      {treatment_response && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">Treatment Response</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{treatment_response}</p>
        </div>
      )}
    </div>
  )
}
