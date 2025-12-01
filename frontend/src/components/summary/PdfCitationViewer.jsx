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

  const snippet = (citation?.source_text_preview || citation?.source_full_text || '').slice(0, 160)
  const normalizedSnippet = snippet.toLowerCase().replace(/\s+/g, ' ').trim()

  const onLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
    setLoading(false)
  }

  const highlightPage = useCallback((pageNumber) => {
    if (!normalizedSnippet || !citation) return
    const textLayer = document.querySelector(`#pdf-page-${pageNumber} .react-pdf__Page__textContent`)
    if (!textLayer) return
    const spans = Array.from(textLayer.querySelectorAll('span'))
    if (!spans.length) return
    const full = spans.map(s => (s.textContent || '').replace(/\s+/g, ' ')).join('')
    const lowered = full.toLowerCase()
    // Find all matches (simple substring; could extend to fuzzy later)
    let startIndex = 0
    while (true) {
      const idx = lowered.indexOf(normalizedSnippet, startIndex)
      if (idx === -1) break
      const endIdx = idx + normalizedSnippet.length
      // Map index range to spans and mark
      let acc = 0
      for (const span of spans) {
        const spanText = (span.textContent || '').replace(/\s+/g, ' ')
        const spanStart = acc
        const spanEnd = acc + spanText.length
        acc = spanEnd
        if (spanEnd < idx) continue
        if (spanStart > endIdx) break
        if (spanStart <= endIdx && spanEnd >= idx) {
          span.classList.add('bg-yellow-300', 'rounded-sm')
        }
      }
      startIndex = endIdx
    }
  }, [normalizedSnippet, citation])

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
            id={`pdf-page-${index + 1}`}
            width={800}
            onRenderTextLayerSuccess={() => highlightPage(index + 1)}
          />
        ))}
      </Document>
    </div>
  )
}