import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

/**
 * VitalTrendsCard - Displays vital signs trends (BP, HR, etc.) with visualization.
 * 
 * Universal card that shows up when vital_trends data exists in the summary.
 * Renders line charts for blood pressure, heart rate, and other vitals.
 */
export function VitalTrendsCard({ vitalData, className }) {
  // If no data, don't render
  if (!vitalData || (!vitalData.blood_pressure && !vitalData.heart_rate)) {
    return null
  }

  // Parse BP data if exists
  const bpData = vitalData.blood_pressure || []
  const hrData = vitalData.heart_rate || []
  
  // Combine into chart data
  const chartData = bpData.map((bp, idx) => ({
    date: bp.date || `Reading ${idx + 1}`,
    systolic: bp.systolic,
    diastolic: bp.diastolic,
    hr: hrData[idx]?.bpm || null
  }))

  // Calculate trends
  const getLatestValue = (data, key) => {
    if (!data || data.length === 0) return null
    return data[data.length - 1]?.[key]
  }

  const getTrend = (data, key) => {
    if (!data || data.length < 2) return 'stable'
    const recent = data[data.length - 1]?.[key]
    const previous = data[data.length - 2]?.[key]
    if (!recent || !previous) return 'stable'
    if (recent > previous + 5) return 'up'
    if (recent < previous - 5) return 'down'
    return 'stable'
  }

  const latestBP = bpData.length > 0 ? bpData[bpData.length - 1] : null
  const systolicTrend = getTrend(bpData, 'systolic')
  const diastolicTrend = getTrend(bpData, 'diastolic')
  const hrTrend = getTrend(hrData, 'bpm')

  const TrendIcon = (trend) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-red-500" />
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-green-500" />
    return <Minus className="h-4 w-4 text-slate-400" />
  }

  return (
    <div className={cn(
      "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 hover:shadow-xl transition-shadow",
      className
    )}>
      {/* Card Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <div className="p-2 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Vital Trends</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Blood pressure & heart rate</p>
        </div>
      </div>

      {/* Latest Readings */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {latestBP && (
          <>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Systolic</p>
                {TrendIcon(systolicTrend)}
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {latestBP.systolic}
                <span className="text-sm text-slate-500 ml-1">mmHg</span>
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Diastolic</p>
                {TrendIcon(diastolicTrend)}
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {latestBP.diastolic}
                <span className="text-sm text-slate-500 ml-1">mmHg</span>
              </p>
            </div>
          </>
        )}
        {hrData.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg col-span-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Heart Rate</p>
              {TrendIcon(hrTrend)}
            </div>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {hrData[hrData.length - 1].bpm}
              <span className="text-sm text-slate-500 ml-1">bpm</span>
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#cbd5e1"
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }}
                stroke="#cbd5e1"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px' }}
              />
              <Line 
                type="monotone" 
                dataKey="systolic" 
                stroke="#ef4444" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Systolic"
              />
              <Line 
                type="monotone" 
                dataKey="diastolic" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Diastolic"
              />
              {hrData.length > 0 && (
                <Line 
                  type="monotone" 
                  dataKey="hr" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Heart Rate"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
