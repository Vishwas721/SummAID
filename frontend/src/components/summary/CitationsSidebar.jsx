import { useState } from 'react'
import { FileText, X, ExternalLink, ChevronRight } from 'lucide-react'

/**
 * CitationsSidebar - Right-side panel displaying source citations for summary
 * 
 * Features:
 * - Shows all source chunks used to generate summary
 * - Click citation to view full text or open PDF
 * - Embedded PDF viewer for original documents
 * - Collapsible for more screen space
 */
export function CitationsSidebar({ citations = [], isOpen, onToggle, onOpenCitation, disableModal = false }) {
  const [selectedCitation, setSelectedCitation] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null)

  const handleCitationClick = async (citation) => {
    // If parent provided a handler, delegate to it (preferred)
    if (onOpenCitation) {
      onOpenCitation(citation)
      return
    }

    // Fallback: handle locally
    setSelectedCitation(citation)
    if (citation.report_id) {
      try {
        const apiUrl = import.meta.env.VITE_API_URL
        const pdfResponse = await fetch(`${apiUrl}/report/${citation.report_id}/pdf`)
        if (pdfResponse.ok) {
          const blob = await pdfResponse.blob()
          const url = URL.createObjectURL(blob)
          setPdfUrl(url)
        } else {
          console.error('Failed to fetch PDF:', pdfResponse.statusText)
          setPdfUrl(null)
        }
      } catch (error) {
        console.error('Error fetching PDF:', error)
        setPdfUrl(null)
      }
    }
  }

  const closePdfViewer = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl)
    }
    setPdfUrl(null)
    setSelectedCitation(null)
  }

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-l-lg shadow-lg z-50 transition-all"
        title="Show Citations"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    )
  }

  return (
    <>
      {/* Citations Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 shadow-2xl z-40 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Source Citations
            </h2>
            <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-full">
              {citations.length}
            </span>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Hide Citations"
          >
            <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Citations List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {citations.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No citations available</p>
            </div>
          ) : (
            citations.map((citation, index) => (
              <button
                key={`${citation.source_chunk_id}-${index}`}
                onClick={() => handleCitationClick(citation)}
                className="w-full text-left p-3 bg-slate-50 dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-200 dark:border-slate-700 rounded-lg transition-all hover:shadow-md group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-medium text-indigo-600 dark:text-indigo-400">
                    #{citation.source_chunk_id}
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex-shrink-0" />
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-3">
                  {citation.source_text_preview}
                </p>
                {citation.source_metadata?.report_type && (
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {citation.source_metadata.report_type}
                    </span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Click citation to view original PDF • All citations are source-verified
          </p>
        </div>
      </div>

      {/* PDF Viewer Modal (disabled if parent manages modal) */}
      {!disableModal && selectedCitation && pdfUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Original Document
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Report ID: {selectedCitation.report_id} • Chunk: {selectedCitation.source_chunk_id}
                </p>
              </div>
              <button
                onClick={closePdfViewer}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 overflow-hidden">
              <iframe
                src={pdfUrl}
                className="w-full h-full"
                title="PDF Viewer"
              />
            </div>

            {/* Modal Footer with Citation Text */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                Cited Text:
              </p>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {selectedCitation.source_full_text}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
