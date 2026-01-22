import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { VoiceRecognitionEngine } from '@/core/VoiceRecognitionEngine'
import type { VoiceRecognitionConfig, VoiceCommand } from '@/types'

// Mock Web Speech API
global.window = {
  ...global.window,
  webkitSpeechRecognition: vi.fn().mockImplementation(() => ({
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
  })),
  SpeechRecognition: vi.fn().mockImplementation(() => ({
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
  })),
  navigator: {
    ...global.window.navigator,
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => []
      })
    }
  }
} as any

describe('VoiceRecognitionEngine', () => {
  let engine: VoiceRecognitionEngine
  let config: VoiceRecognitionConfig

  beforeEach(() => {
    config = {
      wakeWord: 'Hey Healthcare',
      languages: ['en-US'],
      confidenceThreshold: 0.7,
      timeoutMs: 5000,
      noiseThreshold: 0.1,
      sampleRate: 44100,
      bufferSize: 2048
    }
    engine = new VoiceRecognitionEngine(config)
  })

  afterEach(() => {
    engine.destroy()
  })

  describe('Initialization', () => {
    it('should initialize with provided config', () => {
      expect(engine).toBeDefined()
    })

    it('should throw error if speech recognition not supported', () => {
      const originalSpeechRecognition = (window as any).SpeechRecognition
      const originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition
      
      delete (window as any).SpeechRecognition
      delete (window as any).webkitSpeechRecognition

      expect(() => new VoiceRecognitionEngine(config)).toThrow('Speech recognition not supported')

      // Restore
      if (originalSpeechRecognition) {
        (window as any).SpeechRecognition = originalSpeechRecognition
      }
      if (originalWebkitSpeechRecognition) {
        (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition
      }
    })
  })

  describe('Wake Word Detection', () => {
    it('should detect wake word in transcript', async () => {
      const mockRecognition = (engine as any).recognition
      const wakeWordPromise = new Promise<void>((resolve) => {
        engine.on('wake-word-detected', () => {
          resolve()
        })
      })

      // Simulate recognition result with wake word
      const mockEvent = {
        results: [{
          0: { transcript: 'hey healthcare', confidence: 0.9 },
          isFinal: true
        }]
      }

      mockRecognition.onresult(mockEvent)
      
      await expect(wakeWordPromise).resolves.toBeUndefined()
    })

    it('should not trigger wake word detection when processing', () => {
      const mockRecognition = (engine as any).recognition
      const wakeWordSpy = vi.fn()
      
      engine.on('wake-word-detected', wakeWordSpy)
      
      // Set processing state
      ;(engine as any).isProcessing = true

      const mockEvent = {
        results: [{
          0: { transcript: 'hey healthcare', confidence: 0.9 },
          isFinal: true
        }]
      }

      mockRecognition.onresult(mockEvent)
      
      expect(wakeWordSpy).not.toHaveBeenCalled()
    })
  })

  describe('Command Recognition', () => {
    it('should process command after wake word', async () => {
      const mockRecognition = (engine as any).recognition
      const commandPromise = new Promise<VoiceCommand>((resolve) => {
        engine.on('command-recognized', (command: VoiceCommand) => {
          resolve(command)
        })
      })

      // First, trigger wake word
      const wakeWordEvent = {
        results: [{
          0: { transcript: 'hey healthcare', confidence: 0.9 },
          isFinal: true
        }]
      }
      mockRecognition.onresult(wakeWordEvent)

      // Then, process command
      const commandEvent = {
        results: [{
          0: { transcript: 'search patient john doe', confidence: 0.85 },
          isFinal: true
        }]
      }
      mockRecognition.onresult(commandEvent)

      const command = await commandPromise
      expect(command.action).toBe('search patient john doe')
      expect(command.confidence).toBe(0.85)
    })

    it('should filter low confidence commands', () => {
      const mockRecognition = (engine as any).recognition
      const lowConfidenceSpy = vi.fn()
      const commandSpy = vi.fn()
      
      engine.on('low-confidence', lowConfidenceSpy)
      engine.on('command-recognized', commandSpy)

      // Set processing state
      ;(engine as any).isProcessing = true

      const mockEvent = {
        results: [{
          0: { transcript: 'search patient', confidence: 0.5 }, // Below threshold
          isFinal: true
        }]
      }

      mockRecognition.onresult(mockEvent)
      
      expect(lowConfidenceSpy).toHaveBeenCalled()
      expect(commandSpy).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle recognition errors', () => {
      const mockRecognition = (engine as any).recognition
      const errorSpy = vi.fn()
      
      engine.on('error', errorSpy)

      const mockErrorEvent = { error: 'no-speech' }
      mockRecognition.onerror(mockErrorEvent)
      
      expect(errorSpy).toHaveBeenCalledWith({
        type: 'recognition',
        message: 'No speech detected',
        code: 'no-speech',
        retryable: true
      })
    })

    it('should handle permission denied errors', () => {
      const mockRecognition = (engine as any).recognition
      const errorSpy = vi.fn()
      
      engine.on('error', errorSpy)

      const mockErrorEvent = { error: 'not-allowed' }
      mockRecognition.onerror(mockErrorEvent)
      
      expect(errorSpy).toHaveBeenCalledWith({
        type: 'permission',
        message: 'Permission denied',
        code: 'not-allowed',
        retryable: false
      })
    })
  })

  describe('Audio Level Detection', () => {
    it('should return audio level', () => {
      // Mock AudioContext and analyser
      ;(engine as any).audioContext = {
        createAnalyser: vi.fn().mockReturnValue({
          fftSize: 2048,
          smoothingTimeConstant: 0.8,
          getByteFrequencyData: vi.fn((array) => {
            // Fill with mock data
            for (let i = 0; i < array.length; i++) {
              array[i] = 128 // Medium level
            }
          })
        })
      }

      const level = engine.getAudioLevel()
      expect(level).toBeGreaterThanOrEqual(0)
      expect(level).toBeLessThanOrEqual(100)
    })

    it('should return 0 when no analyser available', () => {
      const level = engine.getAudioLevel()
      expect(level).toBe(0)
    })
  })

  describe('State Management', () => {
    it('should update config', () => {
      const newConfig = { confidenceThreshold: 0.8 }
      engine.updateConfig(newConfig)
      
      expect((engine as any).config.confidenceThreshold).toBe(0.8)
    })

    it('should handle wake word mode', () => {
      ;(engine as any).isProcessing = false
      expect(engine.isWakeWordMode()).toBe(true)
      
      ;(engine as any).isProcessing = true
      expect(engine.isWakeWordMode()).toBe(false)
    })
  })

  describe('Start/Stop Listening', () => {
    it('should start listening', async () => {
      const mockRecognition = (engine as any).recognition
      
      await engine.start()
      
      expect(mockRecognition.start).toHaveBeenCalled()
    })

    it('should stop listening', () => {
      const mockRecognition = (engine as any).recognition
      
      engine.stop()
      
      expect(mockRecognition.stop).toHaveBeenCalled()
    })

    it('should handle microphone permission errors', async () => {
      const originalGetUserMedia = window.navigator.mediaDevices.getUserMedia
      window.navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'))

      const errorSpy = vi.fn()
      engine.on('error', errorSpy)

      await engine.start()
      
      expect(errorSpy).toHaveBeenCalledWith({
        type: 'permission',
        message: 'Microphone access denied',
        retryable: false
      })

      // Restore
      window.navigator.mediaDevices.getUserMedia = originalGetUserMedia
    })
  })
})