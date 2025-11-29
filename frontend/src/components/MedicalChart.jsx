import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'

/**
 * Parse markdown tables from clinical summary text and extract time-series data
 * Expected format:
 * | Date | Test | Value | Reference Range | Interpretation |
 * | 2024-11-15 | BP Systolic | 120 | 90-120 | Normal |
 */
export function parseLabTable(summaryText) {
  if (!summaryText) return []
  
  const tables = []
  const lines = summaryText.split('\n')
  
  let inTable = false
  let headers = []
  let currentTableData = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Detect table start (header row with pipes)
    if (line.startsWith('|') && line.endsWith('|')) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c)
      
      // Check if this is a separator row (contains dashes)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        inTable = true
        continue
      }
      
      // If we haven't set headers yet, this is the header row
      if (!inTable && cells.length > 0) {
        headers = cells
        continue
      }
      
      // This is a data row
      if (inTable && headers.length > 0) {
        const rowData = {}
        cells.forEach((cell, idx) => {
          if (headers[idx]) {
            rowData[headers[idx].toLowerCase()] = cell
          }
        })
        currentTableData.push(rowData)
      }
    } else if (inTable && currentTableData.length > 0) {
      // End of table
      tables.push({ headers, data: currentTableData })
      inTable = false
      headers = []
      currentTableData = []
    }
  }
  
  // Catch last table if it ends at EOF
  if (inTable && currentTableData.length > 0) {
    tables.push({ headers, data: currentTableData })
  }
  
  return tables
}

/**
 * Extract numeric time-series data from parsed tables
 * Groups by test name and returns chart-ready data
 */
export function extractTimeSeriesData(tables) {
  const seriesMap = new Map()
  
  tables.forEach(table => {
    table.data.forEach(row => {
      const date = row.date || row.timestamp || row['date/time']
      const test = row.test || row.measurement || row.parameter
      const valueStr = row.value || row.result
      
      if (!date || !test || !valueStr) return
      
      // Extract numeric value (handle ranges like "120/80" for BP)
      const numericMatch = valueStr.match(/(\d+(?:\.\d+)?)/g)
      if (!numericMatch) return
      
      const values = numericMatch.map(parseFloat)
      
      // For BP, create separate series for systolic/diastolic
      if (test.toLowerCase().includes('bp') || test.toLowerCase().includes('blood pressure')) {
        if (values.length >= 2) {
          addToSeries(seriesMap, 'BP Systolic', date, values[0], row['reference range'], row.interpretation)
          addToSeries(seriesMap, 'BP Diastolic', date, values[1], row['reference range'], row.interpretation)
        }
      } else {
        addToSeries(seriesMap, test, date, values[0], row['reference range'], row.interpretation)
      }
    })
  })
  
  // Convert map to array and sort by date
  const series = Array.from(seriesMap.entries()).map(([name, points]) => ({
    name,
    data: points.sort((a, b) => new Date(a.date) - new Date(b.date))
  }))
  
  return series
}

function addToSeries(seriesMap, testName, date, value, refRange, interpretation) {
  if (!seriesMap.has(testName)) {
    seriesMap.set(testName, [])
  }
  
  // Parse reference range for chart boundaries
  let refMin = null
  let refMax = null
  if (refRange) {
    const rangeMatch = refRange.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/)
    if (rangeMatch) {
      refMin = parseFloat(rangeMatch[1])
      refMax = parseFloat(rangeMatch[2])
    }
  }
  
  seriesMap.get(testName).push({
    date,
    value,
    refMin,
    refMax,
    interpretation
  })
}

/**
 * Line chart component for a single measurement over time
 */
export function MedicalLineChart({ seriesData, title, unit = '', color = '#3b82f6' }) {
  if (!seriesData || seriesData.data.length === 0) {
    return null
  }
  
  const data = seriesData.data
  const hasRefRange = data.some(d => d.refMin !== null && d.refMax !== null)
  const refMin = hasRefRange ? data[0].refMin : null
  const refMax = hasRefRange ? data[0].refMax : null
  
  return (
    <div className="my-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        {title || seriesData.name}
        {unit && <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">({unit})</span>}
      </h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11 }}
            stroke="#64748b"
          />
          <YAxis 
            tick={{ fontSize: 11 }}
            stroke="#64748b"
            unit={unit}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '12px'
            }}
            formatter={(value) => [`${value}${unit}`, 'Value']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
          />
          
          {/* Reference range lines */}
          {refMin !== null && (
            <ReferenceLine 
              y={refMin} 
              stroke="#10b981" 
              strokeDasharray="3 3"
              label={{ value: 'Min Normal', position: 'right', fontSize: 10, fill: '#10b981' }}
            />
          )}
          {refMax !== null && (
            <ReferenceLine 
              y={refMax} 
              stroke="#10b981" 
              strokeDasharray="3 3"
              label={{ value: 'Max Normal', position: 'right', fontSize: 10, fill: '#10b981' }}
            />
          )}
          
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 4 }}
            activeDot={{ r: 6 }}
            name={seriesData.name}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {/* Show latest value */}
      {data.length > 0 && (
        <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>Latest: <strong className="text-slate-800 dark:text-slate-200">{data[data.length - 1].value}{unit}</strong></span>
          {data[data.length - 1].interpretation && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              data[data.length - 1].interpretation.toLowerCase().includes('high') 
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : data[data.length - 1].interpretation.toLowerCase().includes('low')
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            }`}>
              {data[data.length - 1].interpretation}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Detect and render charts for common vital signs and lab values
 */
export function MedicalChartsPanel({ summaryText }) {
  if (!summaryText) return null
  
  const tables = parseLabTable(summaryText)
  const series = extractTimeSeriesData(tables)
  
  if (series.length === 0) return null
  
  // Group by category
  const vitals = series.filter(s => 
    ['bp systolic', 'bp diastolic', 'heart rate', 'temperature', 'respiratory rate', 'spo2', 'pulse', 'weight', 'height', 'bmi']
      .some(v => s.name.toLowerCase().includes(v))
  )
  
  const labs = series.filter(s => !vitals.includes(s))
  
  // Color palette
  const colors = {
    'BP Systolic': '#ef4444',
    'BP Diastolic': '#f97316',
    'Heart Rate': '#ec4899',
    'Temperature': '#f59e0b',
    'Respiratory Rate': '#8b5cf6',
    'SpO2': '#3b82f6',
    'Weight': '#10b981',
    'BMI': '#06b6d4'
  }
  
  // Unit mapping
  const units = {
    'BP Systolic': ' mmHg',
    'BP Diastolic': ' mmHg',
    'Heart Rate': ' bpm',
    'Temperature': ' °F',
    'Respiratory Rate': ' /min',
    'SpO2': '%',
    'Weight': ' kg',
    'Height': ' cm',
    'BMI': ''
  }
  
  return (
    <div className="my-8">
      {vitals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-blue-500 rounded"></span>
            Vital Signs Trends
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {vitals.map((s, idx) => {
              const colorKey = Object.keys(colors).find(k => s.name.toLowerCase().includes(k.toLowerCase()))
              const color = colorKey ? colors[colorKey] : '#3b82f6'
              
              const unitKey = Object.keys(units).find(k => s.name.toLowerCase().includes(k.toLowerCase()))
              const unit = unitKey ? units[unitKey] : ''
              
              return (
                <MedicalLineChart 
                  key={idx}
                  seriesData={s}
                  color={color}
                  unit={unit}
                />
              )
            })}
          </div>
        </div>
      )}
      
      {labs.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <span className="inline-block w-1 h-6 bg-purple-500 rounded"></span>
            Laboratory Results Trends
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {labs.map((s, idx) => (
              <MedicalLineChart 
                key={idx}
                seriesData={s}
                color="#8b5cf6"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
