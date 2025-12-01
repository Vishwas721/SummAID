/**
 * addCitationMarkers - Utility to add [1], [2], etc. markers at end of sections
 * 
 * Example usage:
 * const text = "Patient has hypertension. Blood pressure improved with medication."
 * const marked = addCitationMarkers(text, [0, 1, 2]) // citations to use
 * Result: "Patient has hypertension. Blood pressure improved with medication. [1,2,3]"
 */
export function addCitationMarkers(text, citationIndices = []) {
  if (!text || citationIndices.length === 0) return text
  
  // Add citation numbers at the end
  const markers = citationIndices.map(i => i + 1).join(',')
  return `${text} [${markers}]`
}

/**
 * CitationMarker - Clickable inline citation component
 * 
 * Props:
 * - indices: Array of citation indices (e.g., [0, 1, 2] for [1,2,3])
 * - onClick: Callback when clicked
 */
export function CitationMarker({ indices = [], onClick }) {
  if (indices.length === 0) return null
  
  const numbers = indices.map(i => i + 1).join(',')
  
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center ml-1 px-1.5 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded transition-colors cursor-pointer"
      title="View source citations"
    >
      [{numbers}]
    </button>
  )
}

/**
 * parseCitationMarkersInText - Parse text with [1], [2,3] markers and replace with components
 * 
 * Usage:
 * const parts = parseCitationMarkersInText("Text here [1,2]. More text [3].")
 * parts.forEach((part, idx) => part.isMarker ? <CitationMarker ... /> : <span>{part.text}</span>)
 */
export function parseCitationMarkersInText(text) {
  if (!text) return [{ text: '', isMarker: false }]
  
  // Match [1], [1,2], [1,2,3] patterns
  const regex = /\[(\d+(?:,\d+)*)\]/g
  const parts = []
  let lastIndex = 0
  let match
  
  while ((match = regex.exec(text)) !== null) {
    // Add text before marker
    if (match.index > lastIndex) {
      parts.push({
        text: text.substring(lastIndex, match.index),
        isMarker: false
      })
    }
    
    // Add marker
    const indices = match[1].split(',').map(n => parseInt(n) - 1) // Convert 1-based to 0-based
    parts.push({
      indices,
      isMarker: true
    })
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      text: text.substring(lastIndex),
      isMarker: false
    })
  }
  
  return parts
}
