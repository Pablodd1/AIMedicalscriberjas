import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VoiceRecognitionEngine } from '@/core/VoiceRecognitionEngine'
import { NaturalLanguageProcessor } from '@/core/NaturalLanguageProcessor'
import { ActionExecutor } from '@/core/ActionExecutor'
import { HealthcareWorkflowEngine } from '@/core/HealthcareWorkflowEngine'
import type { 
  VoiceRecognitionConfig, 
  VoiceCommand, 
  VoiceFeedback, 
  UserPreferences,
  VoiceControlState 
} from '@/types'

interface VoiceControlProviderProps {
  children: React.ReactNode
  config?: Partial<VoiceRecognitionConfig>
  preferences?: Partial<UserPreferences>
  onCommand?: (command: VoiceCommand) => void
  onError?: (error: Error) => void
  onStateChange?: (state: VoiceControlState) => void
}

export const VoiceControlContext = React.createContext<{
  state: VoiceControlState
  startListening: () => Promise<void>
  stopListening: () => void
  updatePreferences: (preferences: Partial<UserPreferences>) => void
  updateConfig: (config: Partial<VoiceRecognitionConfig>) => void
  isSupported: boolean
}>({
  state: {
    isListening: false,
    isProcessing: false,
    isMuted: false,
    wakeWordDetected: false,
    recentCommands: [],
    errors: [],
    config: {
      wakeWord: 'Hey Healthcare',
      languages: ['en-US'],
      confidenceThreshold: 0.7,
      timeoutMs: 5000,
      noiseThreshold: 0.1,
      sampleRate: 44100,
      bufferSize: 2048
    },
    preferences: {
      language: 'en-US',
      accent: 'american',
      wakeWord: 'Hey Healthcare',
      microphoneSensitivity: 5,
      voiceSpeed: 1.0,
      commandAliases: {},
      enabledCategories: ['navigation', 'ui-action', 'healthcare', 'accessibility'],
      audioFeedback: true,
      visualFeedback: true
    }
  },
  startListening: async () => {},
  stopListening: () => {},
  updatePreferences: () => {},
  updateConfig: () => {},
  isSupported: false
})

export const VoiceControlProvider: React.FC<VoiceControlProviderProps> = ({
  children,
  config: userConfig,
  preferences: userPreferences,
  onCommand,
  onError,
  onStateChange
}) => {
  const [state, setState] = useState<VoiceControlState>(() => ({
    isListening: false,
    isProcessing: false,
    isMuted: false,
    wakeWordDetected: false,
    recentCommands: [],
    errors: [],
    config: {
      wakeWord: 'Hey Healthcare',
      languages: ['en-US'],
      confidenceThreshold: 0.7,
      timeoutMs: 5000,
      noiseThreshold: 0.1,
      sampleRate: 44100,
      bufferSize: 2048,
      ...userConfig
    },
    preferences: {
      language: 'en-US',
      accent: 'american',
      wakeWord: 'Hey Healthcare',
      microphoneSensitivity: 5,
      voiceSpeed: 1.0,
      commandAliases: {},
      enabledCategories: ['navigation', 'ui-action', 'healthcare', 'accessibility'],
      audioFeedback: true,
      visualFeedback: true,
      ...userPreferences
    }
  }))

  const [recognitionEngine] = useState(() => new VoiceRecognitionEngine(state.config))
  const [nlpProcessor] = useState(() => new NaturalLanguageProcessor())
  const [actionExecutor] = useState(() => new ActionExecutor())
  const [workflowEngine] = useState(() => new HealthcareWorkflowEngine())
  const [isSupported] = useState(() => {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
  })

  // Initialize voice recognition engine
  useEffect(() => {
    const handleWakeWordDetected = (data: any) => {
      setState(prev => ({ ...prev, wakeWordDetected: true }))
      provideFeedback({
        type: 'success',
        message: 'Listening for your command...',
        duration: 2000,
        speak: state.preferences.audioFeedback
      })
    }

    const handleCommandRecognized = async (data: any) => {
      const command = data as VoiceCommand
      
      setState(prev => ({
        ...prev,
        currentCommand: command,
        recentCommands: [command, ...prev.recentCommands.slice(0, 9)]
      }))

      // Process command through NLP
      const processedCommand = nlpProcessor.parseCommand(command.action, command.confidence)
      
      if (processedCommand) {
        onCommand?.(processedCommand)
        
        // Execute the command
        try {
          await actionExecutor.executeCommand(processedCommand)
          provideFeedback({
            type: 'success',
            message: 'Command executed successfully',
            duration: 1500,
            speak: state.preferences.audioFeedback
          })
        } catch (error) {
          handleError(error as Error)
        }
      } else {
        provideFeedback({
          type: 'error',
          message: 'Command not recognized. Please try again.',
          duration: 3000,
          speak: state.preferences.audioFeedback
        })
      }
    }

    const handleError = (error: any) => {
      const errorObj = error instanceof Error ? error : new Error(error.message || 'Unknown error')
      
      setState(prev => ({
        ...prev,
        errors: [errorObj, ...prev.errors.slice(0, 9)]
      }))

      onError?.(errorObj)

      provideFeedback({
        type: 'error',
        message: errorObj.message || 'An error occurred',
        duration: 5000,
        speak: state.preferences.audioFeedback
      })
    }

    const handleListening = () => {
      setState(prev => ({ ...prev, isListening: true }))
    }

    const handleStopped = () => {
      setState(prev => ({ ...prev, isListening: false, wakeWordDetected: false }))
    }

    recognitionEngine.on('wake-word-detected', handleWakeWordDetected)
    recognitionEngine.on('command-recognized', handleCommandRecognized)
    recognitionEngine.on('error', handleError)
    recognitionEngine.on('listening', handleListening)
    recognitionEngine.on('stopped', handleStopped)

    return () => {
      recognitionEngine.removeAllListeners()
    }
  }, [recognitionEngine, nlpProcessor, actionExecutor, onCommand, onError, state.preferences.audioFeedback])

  // Notify state changes
  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  const provideFeedback = useCallback((feedback: VoiceFeedback) => {
    if (state.preferences.visualFeedback) {
      // This would trigger visual feedback in the UI
      window.dispatchEvent(new CustomEvent('voice-feedback', { detail: feedback }))
    }

    if (feedback.speak && state.preferences.audioFeedback && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(feedback.message)
      utterance.rate = state.preferences.voiceSpeed
      speechSynthesis.speak(utterance)
    }
  }, [state.preferences.visualFeedback, state.preferences.audioFeedback, state.preferences.voiceSpeed])

  const startListening = useCallback(async () => {
    try {
      await recognitionEngine.start()
      setState(prev => ({ ...prev, isListening: true }))
    } catch (error) {
      handleError(error as Error)
    }
  }, [recognitionEngine])

  const stopListening = useCallback(() => {
    recognitionEngine.stop()
    setState(prev => ({ 
      ...prev, 
      isListening: false, 
      isProcessing: false, 
      wakeWordDetected: false 
    }))
  }, [recognitionEngine])

  const updatePreferences = useCallback((preferences: Partial<UserPreferences>) => {
    setState(prev => ({
      ...prev,
      preferences: { ...prev.preferences, ...preferences }
    }))
  }, [])

  const updateConfig = useCallback((config: Partial<VoiceRecognitionConfig>) => {
    const newConfig = { ...state.config, ...config }
    setState(prev => ({ ...prev, config: newConfig }))
    recognitionEngine.updateConfig(newConfig)
  }, [state.config, recognitionEngine])

  const handleError = useCallback((error: Error) => {
    setState(prev => ({
      ...prev,
      errors: [error, ...prev.errors.slice(0, 9)]
    }))
    onError?.(error)
  }, [onError])

  const value = {
    state,
    startListening,
    stopListening,
    updatePreferences,
    updateConfig,
    isSupported
  }

  return (
    <VoiceControlContext.Provider value={value}>
      {children}
      <VoiceControlUI />
    </VoiceControlContext.Provider>
  )
}

const VoiceControlUI: React.FC = () => {
  const { state } = React.useContext(VoiceControlContext)
  const [feedback, setFeedback] = useState<VoiceFeedback | null>(null)
  const [audioLevel, setAudioLevel] = useState(0)

  useEffect(() => {
    const handleFeedback = (event: CustomEvent) => {
      setFeedback(event.detail)
      setTimeout(() => setFeedback(null), event.detail.duration || 3000)
    }

    window.addEventListener('voice-feedback', handleFeedback as EventListener)
    return () => window.removeEventListener('voice-feedback', handleFeedback as EventListener)
  }, [])

  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (state.isListening) {
      interval = setInterval(() => {
        // This would get audio level from recognition engine
        setAudioLevel(Math.random() * 100)
      }, 100)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [state.isListening])

  const getMicrophoneColor = () => {
    if (state.isProcessing) return 'bg-green-500'
    if (state.wakeWordDetected) return 'bg-blue-500'
    if (state.isListening) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const getMicrophoneAnimation = () => {
    if (state.isListening && !state.wakeWordDetected) {
      return 'animate-pulse'
    }
    if (state.wakeWordDetected) {
      return 'animate-bounce'
    }
    return ''
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`mb-4 p-4 rounded-lg shadow-lg max-w-sm ${
              feedback.type === 'success' ? 'bg-green-100 text-green-800' :
              feedback.type === 'error' ? 'bg-red-100 text-red-800' :
              feedback.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}
          >
            <p className="text-sm font-medium">{feedback.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className={`relative w-16 h-16 rounded-full ${getMicrophoneColor()} ${getMicrophoneAnimation()} shadow-lg cursor-pointer`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v4a3 3 0 01-3 3z"
            />
          </svg>
        </div>

        {/* Audio level indicator */}
        {state.isListening && (
          <div 
            className="absolute -inset-2 rounded-full border-2 border-current opacity-30"
            style={{
              transform: `scale(${1 + (audioLevel / 100) * 0.3})`,
              transition: 'transform 0.1s ease-out'
            }}
          />
        )}
      </motion.div>

      {state.isListening && state.currentCommand && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-20 right-0 bg-white rounded-lg shadow-lg p-3 min-w-max"
        >
          <p className="text-sm text-gray-600">Heard: "{state.currentCommand.action}"</p>
          <p className="text-xs text-gray-500">Confidence: {(state.currentCommand.confidence * 100).toFixed(1)}%</p>
        </motion.div>
      )}
    </div>
  )
}

export const useVoiceControl = () => {
  const context = React.useContext(VoiceControlContext)
  if (context === undefined) {
    throw new Error('useVoiceControl must be used within a VoiceControlProvider')
  }
  return context
}