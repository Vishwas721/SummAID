import { useEffect, useState, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
// Reliable self-hosted worker import using Vite asset handling. pdf.js v5 exposes pdf.worker.mjs (no .min.js file).
// The ?url suffix tells Vite to emit the asset and give us its resolved URL at build time.
// If this import ever fails, we could add a runtime fallback to a public/ copy, but primary approach should succeed.
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * PdfCitationViewer - Renders a PDF and highlights a target citation text snippet.
 * Props:
 *  - file: Blob URL or ArrayBuffer
 *  - citation: selected citation object with source_full_text
 */
export function PdfCitationViewer({ file, citation }) {
  const [numPages, setNumPages] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Use first 150 chars of citation text for direct matching
  const normalizeText = (txt) => txt.toLowerCase().replace(/[^a-z0-9]/g, '')
  const citationSnippet = (citation?.source_full_text || citation?.source_text_preview || '').slice(0, 200)
  const normalizedCitation = normalizeText(citationSnippet)

  const onLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
    setLoading(false)
  }

  const highlightPage = useCallback((pageNumber) => {
    if (!citation || !normalizedCitation || normalizedCitation.length < 20) {
      console.log('[Highlight] Skipped - no citation or too short', { pageNumber, citation: !!citation })
      return
    }
    // Try multiple selectors to find the page container
    let pageRoot = document.getElementById(`pdf-page-${pageNumber}`)
    if (!pageRoot) {
      const pages = document.querySelectorAll('.react-pdf__Page')
      pageRoot = pages[pageNumber - 1]
    }
    if (!pageRoot) {
      console.log('[Highlight] Page root not found', pageNumber)
      return
    }
    const textLayer = pageRoot.querySelector('.react-pdf__Page__textContent')
    if (!textLayer) {
      console.log('[Highlight] Text layer not found', pageNumber)
      return
    }
    const spans = Array.from(textLayer.querySelectorAll('span'))
    if (!spans.length) {
      console.log('[Highlight] No spans found', pageNumber)
      return
    }
    
    // Clear old highlights
    spans.forEach(s => {
      s.classList.remove('pdf-highlight-span')
      s.style.cssText = ''
    })
    
    // Build full page text with normalized version for matching
    let fullText = ''
    let normalizedFullText = ''
    const spanMap = [] // [{rawStart, rawEnd, normStart, normEnd, spanIndex}]
    
    spans.forEach((span, idx) => {
      const rawTxt = (span.textContent || '')
      const rawStart = fullText.length
      fullText += rawTxt
      const rawEnd = fullText.length
      
      const normTxt = normalizeText(rawTxt)
      const normStart = normalizedFullText.length
      normalizedFullText += normTxt
      const normEnd = normalizedFullText.length
      
      spanMap.push({ rawStart, rawEnd, normStart, normEnd, spanIndex: idx })
    })
    
    // Try to find the citation in normalized text (try multiple lengths)
    let matchStart = -1
    let matchEnd = -1
    
    for (const len of [normalizedCitation.length, Math.floor(normalizedCitation.length * 0.7), Math.floor(normalizedCitation.length * 0.5)]) {
      const searchStr = normalizedCitation.slice(0, len)
      if (searchStr.length < 20) break // too short
      matchStart = normalizedFullText.indexOf(searchStr)
      if (matchStart !== -1) {
        matchEnd = matchStart + searchStr.length
        break
      }
    }
    
    if (matchStart === -1) {
      console.log('[Highlight] Citation not found on page', pageNumber, 'tried:', normalizedCitation.slice(0, 50))
      return
    }
    
    console.log('[Highlight] Found citation at normalized pos', matchStart, '-', matchEnd, 'on page', pageNumber)
    
    // Highlight all spans that overlap with the match range (in normalized space)
    let highlighted = 0
    spanMap.forEach(({ normStart, normEnd, spanIndex }) => {
      if (normEnd > matchStart && normStart < matchEnd) {
        spans[spanIndex].classList.add('pdf-highlight-span')
        spans[spanIndex].style.cssText = 'background-color: rgba(255, 255, 0, 0.3) !important;'
        highlighted++
      }
    })
    
    console.log('[Highlight] Highlighted spans:', highlighted)
  }, [citation, normalizedCitation])

  // Trigger highlight for already rendered pages when snippet changes or pages load
  useEffect(() => {
    if (!loading && numPages) {
      // Slight delay to ensure text layers are mounted
      setTimeout(() => {
        for (let p = 1; p <= numPages; p++) highlightPage(p)
      }, 300)
    }
  }, [loading, numPages, highlightPage])

  if (error) {
    return <div className="flex items-center justify-center h-full text-red-600 text-sm">{String(error)}</div>
  }
  return (
    <div className="w-full h-full overflow-auto">
      {loading && (
        <div className="text-xs text-slate-500 px-2 py-1">Loading PDF…</div>
      )}
      <Document file={file} onLoadSuccess={onLoadSuccess} onLoadError={setError} loading={null}>
        {Array.from(new Array(numPages), (el, index) => (
          <Page
            key={`page_${index + 1}`}
            pageNumber={index + 1}
            width={800}
            onRenderTextLayerSuccess={() => {
              console.log('[PDF] Text layer rendered for page', index + 1)
              highlightPage(index + 1)
            }}
          />
        ))}
      </Document>
    </div>
  )
}

// Inject simple style for highlight spans (inline to avoid relying on Tailwind purge)
const styleElId = 'pdf-highlight-style'
if (!document.getElementById(styleElId)) {
  const styleEl = document.createElement('style')
  styleEl.id = styleElId
  styleEl.textContent = `.pdf-highlight-span{background-color:rgba(255,255,0,0.3) !important;}`
  document.head.appendChild(styleEl)
}