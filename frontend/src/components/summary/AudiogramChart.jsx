import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

/**
 * AudiogramChart - Clinical audiogram with standard formatting.
 * 
 * Displays hearing thresholds with:
 * - Inverted Y-axis (0 dB at top = better hearing, 120 dB at bottom = worse)
 * - Red solid line with circles for Right Ear
 * - Blue dashed line with X markers for Left Ear
 * - Standard audiometric frequencies (500Hz - 8000Hz)
 */
export function AudiogramChart({ audiogram, className = '' }) {
  if (!audiogram || (!audiogram.left && !audiogram.right)) {
    return null
  }

  // Standard audiometric frequencies
  const frequencies = ['500', '1000', '2000', '4000', '8000']
  
  // Transform data for Recharts
  const chartData = frequencies.map(freq => {
    const freqKey = `${freq}Hz`
    return {
      frequency: freq,
      left: audiogram.left?.[freqKey] || null,
      right: audiogram.right?.[freqKey] || null
    }
  }).filter(d => d.left !== null || d.right !== null)

  if (chartData.length === 0) return null

  // Custom dot shapes for audiogram symbols
  const CircleDot = (props) => {
    const { cx, cy, fill } = props
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#fff" stroke={fill} strokeWidth={2.5} />
      </g>
    )
  }

  const CrossDot = (props) => {
    const { cx, cy, fill } = props
    const size = 6
    return (
      <g>
        <line x1={cx - size} y1={cy - size} x2={cx + size} y2={cy + size} stroke={fill} strokeWidth={2.5} />
        <line x1={cx - size} y1={cy + size} x2={cx + size} y2={cy - size} stroke={fill} strokeWidth={2.5} />
      </g>
    )
  }

  return (
    <div className={className}>
      <div className="h-64 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData}
            margin={{ top: 10, right: 20, left: 20, bottom: 30 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#e2e8f0" 
              strokeOpacity={0.5}
            />
            <XAxis 
              dataKey="frequency" 
              tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }}
              stroke="#94a3b8"
              label={{ 
                value: 'Frequency (Hz)', 
                position: 'insideBottom', 
                offset: -20, 
                fontSize: 12,
                fill: '#475569'
              }}
            />
            <YAxis 
              domain={[0, 120]}
              ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]}
              tick={{ fontSize: 11, fill: '#64748b' }}
              stroke="#94a3b8"
              label={{ 
                value: 'Hearing Level (dB HL)', 
                angle: -90, 
                position: 'insideLeft', 
                fontSize: 12,
                fill: '#475569',
                offset: 0
              }}
              reversed={true}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
              formatter={(value, name) => {
                if (value === null) return ['N/A', name]
                return [`${value} dB HL`, name]
              }}
              labelFormatter={(label) => `${label} Hz`}
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
              iconType="line"
            />
            
            {/* Right Ear - Red circles (O) */}
            <Line 
              type="monotone"
              dataKey="right" 
              stroke="#ef4444"
              strokeWidth={2.5}
              name="Right Ear (O)"
              dot={<CircleDot />}
              activeDot={{ r: 8, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
            
            {/* Left Ear - Blue crosses (X) */}
            <Line 
              type="monotone"
              dataKey="left" 
              stroke="#3b82f6"
              strokeWidth={2.5}
              name="Left Ear (X)"
              dot={<CrossDot />}
              activeDot={{ r: 8, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend with clinical symbols */}
      <div className="flex items-center justify-center gap-6 mt-3 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="6" fill="none" stroke="#ef4444" strokeWidth="2.5" />
          </svg>
          <span className="font-medium">Right Ear (O)</span>
        </div>
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20">
            <line x1="4" y1="4" x2="16" y2="16" stroke="#3b82f6" strokeWidth="2.5" />
            <line x1="4" y1="16" x2="16" y2="4" stroke="#3b82f6" strokeWidth="2.5" />
          </svg>
          <span className="font-medium">Left Ear (X)</span>
        </div>
        <span className="text-xs text-slate-400">↑ Better • ↓ Worse</span>
      </div>
      
      {/* Hearing loss severity reference */}
      <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">Hearing Loss Classification:</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div>
            <span className="font-medium text-green-600 dark:text-green-400">0-20 dB:</span>
            <span className="text-slate-600 dark:text-slate-400 ml-1">Normal</span>
          </div>
          <div>
            <span className="font-medium text-yellow-600 dark:text-yellow-400">21-40 dB:</span>
            <span className="text-slate-600 dark:text-slate-400 ml-1">Mild</span>
          </div>
          <div>
            <span className="font-medium text-orange-600 dark:text-orange-400">41-70 dB:</span>
            <span className="text-slate-600 dark:text-slate-400 ml-1">Moderate</span>
          </div>
          <div>
            <span className="font-medium text-red-600 dark:text-red-400">71-90 dB:</span>
            <span className="text-slate-600 dark:text-slate-400 ml-1">Severe</span>
          </div>
          <div>
            <span className="font-medium text-purple-600 dark:text-purple-400">91+ dB:</span>
            <span className="text-slate-600 dark:text-slate-400 ml-1">Profound</span>
          </div>
        </div>
      </div>
    </div>
  )
}
