import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for Web Speech API speech recognition
 * Returns: { isListening, transcript, startListening, stopListening, isSupported, error }
 */
export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState(null)
  const recognitionRef = useRef(null)

  // Check if Web Speech API is supported
  const isSupported = 
    typeof window !== 'undefined' && 
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        console.log('🧹 Unmounting useSpeechRecognition: Aborting active recognition')
        try {
          recognitionRef.current.abort()
        } catch (e) {
          // Ignore
        }
      }
    }
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      console.error('❌ Speech recognition not supported')
      setError('Speech recognition not supported in this browser')
      return
    }

    // Prevent restarting if already listening
    if (isListening || recognitionRef.current) {
        console.log('⚠️ startListening called but already listening or instance exists. Ignoring.')
        return
    }

    console.log('🚀 startListening called. Current isListening:', isListening)

    // 2. Create new instance
    try {
      console.log('🆕 Creating new SpeechRecognition instance...')
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true // Keep listening while button is held
      recognition.interimResults = true
      recognition.lang = 'en-US'

      // 3. Attach handlers
      recognition.onstart = () => {
        console.log('🟢 Event: onstart fired')
        setIsListening(true)
        setError(null)
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPiece = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPiece + ' '
          } else {
            interimTranscript += transcriptPiece
          }
        }

        if (finalTranscript) {
          console.log('📝 Final result:', finalTranscript)
          setTranscript(prev => prev + finalTranscript)
        } else if (interimTranscript) {
          console.log('🔄 Interim:', interimTranscript)
        }
      }

      recognition.onerror = (event) => {
        console.error('🔴 Event: onerror fired:', event.error)
        
        const errorMessages = {
          'no-speech': 'No speech detected. Please try again.',
          'audio-capture': 'Microphone not available or blocked.',
          'not-allowed': 'Microphone permission denied.',
          'network': 'Network error. Check your connection.',
          'aborted': 'Speech recognition aborted.'
        }
        
        // Only set error if it's not an intentional abort
        if (event.error !== 'aborted') {
            setError(errorMessages[event.error] || `Error: ${event.error}`)
        }
        setIsListening(false)
      }

      recognition.onend = () => {
        console.log('🏁 Event: onend fired')
        setIsListening(false)
        recognitionRef.current = null // Clear ref so we can start again
      }

      recognitionRef.current = recognition
      
      // 4. Start
      console.log('▶️ Calling recognition.start()')
      recognition.start()

    } catch (err) {
      console.error('💥 Exception in startListening:', err)
      setError(`Failed to start: ${err.message}`)
      setIsListening(false)
    }
  }, [isSupported, isListening]) // Added isListening to dep array for logging, though not strictly needed for logic

  const stopListening = useCallback(() => {
    console.log('🛑 stopListening called')
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop()
        console.log('✅ Called recognition.stop()')
      } catch (err) {
        console.error('❌ Error calling stop():', err)
      }
    } else {
        console.log('⚠️ stopListening ignored (not listening or no instance)')
    }
  }, [isListening])

  const resetTranscript = useCallback(() => {
    console.log('✨ resetTranscript called')
    setTranscript('')
  }, [])

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    isSupported,
    error
  }
}
