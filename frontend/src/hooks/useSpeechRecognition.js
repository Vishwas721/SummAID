import { useState, useEffect, useRef } from 'react'

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

  useEffect(() => {
    if (!isSupported) return

    // Initialize SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()

    // Configuration
    recognition.continuous = false // Stop after user finishes speaking
    recognition.interimResults = true // Show partial results as user speaks
    recognition.lang = 'en-US' // Language setting

    // Event handlers
    recognition.onstart = () => {
      console.log('🎤 Speech recognition started')
      setIsListening(true)
      setError(null)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''

      // Process all results
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' '
        } else {
          interimTranscript += transcriptPiece
        }
      }

      // Update transcript (prioritize final results)
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript)
        console.log('✅ Final transcript:', finalTranscript)
      } else if (interimTranscript) {
        console.log('🔄 Interim transcript:', interimTranscript)
      }
    }

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error)
      
      // User-friendly error messages
      const errorMessages = {
        'no-speech': 'No speech detected. Please try again.',
        'audio-capture': 'Microphone not available or blocked.',
        'not-allowed': 'Microphone permission denied.',
        'network': 'Network error. Check your connection.',
        'aborted': 'Speech recognition aborted.'
      }

      setError(errorMessages[event.error] || `Error: ${event.error}`)
      setIsListening(false)
    }

    recognition.onend = () => {
      console.log('🛑 Speech recognition ended')
      setIsListening(false)
    }

    recognitionRef.current = recognition

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isSupported])

  const startListening = () => {
    if (!isSupported) {
      setError('Speech recognition not supported in this browser')
      return
    }

    if (recognitionRef.current && !isListening) {
      try {
        setTranscript('') // Clear previous transcript
        setError(null)
        recognitionRef.current.start()
      } catch (err) {
        console.error('Failed to start recognition:', err)
        setError('Failed to start microphone')
      }
    }
  }

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
    }
  }

  const resetTranscript = () => {
    setTranscript('')
  }

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
