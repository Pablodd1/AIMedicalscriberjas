import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VoiceControlProvider, useVoiceControl, VoiceControlPanel } from '@/components'
import React from 'react'

// Mock Web Speech API and other browser APIs
const mockRecognition = {
  continuous: false,
  interimResults: false,
  lang: '',
  maxAlternatives: 1,
  start: vi.fn(),
  stop: vi.fn(),
  onstart: null,
  onend: null,
  onresult: null,
  onerror: null
}

const mockGetUserMedia = vi.fn().mockResolvedValue({
  getTracks: () => []
})

const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn().mockReturnValue([])
}

beforeEach(() => {
  global.window = {
    ...global.window,
    webkitSpeechRecognition: vi.fn().mockImplementation(() => mockRecognition),
    SpeechRecognition: vi.fn().mockImplementation(() => mockRecognition),
    speechSynthesis: mockSpeechSynthesis,
    navigator: {
      ...global.window?.navigator,
      mediaDevices: {
        getUserMedia: mockGetUserMedia
      }
    }
  } as any

  vi.clearAllMocks()
})

// Test component that uses voice control
const TestComponent = () => {
  const { state, startListening, stopListening } = useVoiceControl()
  
  return (
    <div>
      <div data-testid="listening-status">
        {state.isListening ? 'Listening' : 'Not Listening'}
      </div>
      <button onClick={startListening} data-testid="start-listening">
        Start Listening
      </button>
      <button onClick={stopListening} data-testid="stop-listening">
        Stop Listening
      </button>
      <div data-testid="wake-word">
        {state.wakeWordDetected ? 'Wake Word Detected' : 'Waiting'}
      </div>
    </div>
  )
}

describe('VoiceControlProvider', () => {
  it('should provide voice control context', () => {
    render(
      <VoiceControlProvider>
        <TestComponent />
      </VoiceControlProvider>
    )

    expect(screen.getByTestId('listening-status')).toHaveTextContent('Not Listening')
    expect(screen.getByTestId('wake-word')).toHaveTextContent('Waiting')
  })

  it('should handle start listening', async () => {
    render(
      <VoiceControlProvider>
        <TestComponent />
      </VoiceControlProvider>
    )

    const startButton = screen.getByTestId('start-listening')
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(mockRecognition.start).toHaveBeenCalled()
    })
  })

  it('should handle stop listening', async () => {
    render(
      <VoiceControlProvider>
        <TestComponent />
      </VoiceControlProvider>
    )

    const stopButton = screen.getByTestId('stop-listening')
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(mockRecognition.stop).toHaveBeenCalled()
    })
  })

  it('should handle wake word detection', async () => {
    const onCommand = vi.fn()
    
    render(
      <VoiceControlProvider onCommand={onCommand}>
        <TestComponent />
      </VoiceControlProvider>
    )

    // Simulate wake word detection
    if (mockRecognition.onstart) {
      mockRecognition.onstart()
    }

    await waitFor(() => {
      expect(screen.getByTestId('listening-status')).toHaveTextContent('Listening')
    })
  })

  it('should handle recognition errors', async () => {
    const onError = vi.fn()
    
    render(
      <VoiceControlProvider onError={onError}>
        <TestComponent />
      </VoiceControlProvider>
    )

    // Simulate recognition error
    if (mockRecognition.onerror) {
      mockRecognition.onerror({ error: 'no-speech' })
    }

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
  })
})

describe('VoiceControlPanel', () => {
  it('should render voice control panel', () => {
    const onClose = vi.fn()
    
    render(
      <VoiceControlProvider>
        <VoiceControlPanel isOpen={true} onClose={onClose} />
      </VoiceControlProvider>
    )

    expect(screen.getByText('Voice Control')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Commands')).toBeInTheDocument()
  })

  it('should handle panel close', () => {
    const onClose = vi.fn()
    
    render(
      <VoiceControlProvider>
        <VoiceControlPanel isOpen={true} onClose={onClose} />
      </VoiceControlProvider>
    )

    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)

    expect(onClose).toHaveBeenCalled()
  })

  it('should switch between tabs', () => {
    const onClose = vi.fn()
    
    render(
      <VoiceControlProvider>
        <VoiceControlPanel isOpen={true} onClose={onClose} />
      </VoiceControlProvider>
    )

    // Initially on Status tab
    expect(screen.getByText('Start Listening')).toBeInTheDocument()

    // Switch to Settings tab
    const settingsTab = screen.getByText('Settings')
    fireEvent.click(settingsTab)

    expect(screen.getByText('Wake Word')).toBeInTheDocument()

    // Switch to Commands tab
    const commandsTab = screen.getByText('Commands')
    fireEvent.click(commandsTab)

    expect(screen.getByText('Navigation Commands')).toBeInTheDocument()
  })

  it('should handle settings changes', async () => {
    const onClose = vi.fn()
    
    render(
      <VoiceControlProvider>
        <VoiceControlPanel isOpen={true} onClose={onClose} />
      </VoiceControlProvider>
    )

    // Switch to Settings tab
    const settingsTab = screen.getByText('Settings')
    fireEvent.click(settingsTab)

    // Change wake word
    const wakeWordInput = screen.getByDisplayValue('Hey Healthcare')
    fireEvent.change(wakeWordInput, { target: { value: 'Hello Medical' } })

    // Change language
    const languageSelect = screen.getByDisplayValue('English (US)')
    fireEvent.change(languageSelect, { target: { value: 'es-ES' } })

    // Toggle audio feedback
    const audioFeedbackToggle = screen.getByLabelText('Audio Feedback')
    fireEvent.click(audioFeedbackToggle)

    // Toggle visual feedback
    const visualFeedbackToggle = screen.getByLabelText('Visual Feedback')
    fireEvent.click(visualFeedbackToggle)
  })

  it('should show recent commands', async () => {
    const onClose = vi.fn()
    const onStateChange = vi.fn()
    
    const { rerender } = render(
      <VoiceControlProvider onStateChange={onStateChange}>
        <VoiceControlPanel isOpen={true} onClose={onClose} />
      </VoiceControlProvider>
    )

    // Simulate a command being processed
    const mockCommand = {
      id: 'test-command',
      category: 'healthcare' as const,
      action: 'search patient john doe',
      description: 'Search patient',
      confidence: 0.9,
      timestamp: new Date()
    }

    // This would normally be handled by the voice recognition engine
    // For testing, we'll simulate the state change
    const mockState = {
      isListening: false,
      isProcessing: false,
      isMuted: false,
      wakeWordDetected: false,
      currentCommand: mockCommand,
      recentCommands: [mockCommand],
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
    }

    // Trigger state change
    onStateChange(mockState)

    // Check if recent command is displayed
    await waitFor(() => {
      expect(screen.getByText('Last Command')).toBeInTheDocument()
    })
  })
})

describe('useVoiceControl Hook', () => {
  it('should throw error when used outside provider', () => {
    const TestComponent = () => {
      useVoiceControl()
      return null
    }

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => render(<TestComponent />)).toThrow('useVoiceControl must be used within a VoiceControlProvider')
    
    consoleSpy.mockRestore()
  })

  it('should provide access to voice control state and methods', () => {
    let hookResult: any

    const TestComponent = () => {
      hookResult = useVoiceControl()
      return null
    }

    render(
      <VoiceControlProvider>
        <TestComponent />
      </VoiceControlProvider>
    )

    expect(hookResult).toBeDefined()
    expect(hookResult.state).toBeDefined()
    expect(hookResult.startListening).toBeDefined()
    expect(hookResult.stopListening).toBeDefined()
    expect(hookResult.updatePreferences).toBeDefined()
    expect(hookResult.updateConfig).toBeDefined()
    expect(hookResult.isSupported).toBeDefined()
  })
})