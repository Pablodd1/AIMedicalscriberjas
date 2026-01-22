import { EventEmitter } from 'events'
import type { VoiceRecognitionConfig, VoiceCommand, CommandContext } from '@/types'

export class VoiceRecognitionEngine extends EventEmitter {
  private recognition: any
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private microphone: MediaStreamAudioSourceNode | null = null
  private isListening = false
  private isProcessing = false
  private config: VoiceRecognitionConfig
  private wakeWordBuffer: string[] = []
  private readonly WAKE_WORD_BUFFER_SIZE = 3
  private recognitionTimeout: NodeJS.Timeout | null = null
  private silenceTimeout: NodeJS.Timeout | null = null

  constructor(config: VoiceRecognitionConfig) {
    super()
    this.config = config
    this.initializeSpeechRecognition()
  }

  private initializeSpeechRecognition(): void {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser')
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = this.config.languages[0] || 'en-US'
    this.recognition.maxAlternatives = 5

    this.setupRecognitionEvents()
  }

  private setupRecognitionEvents(): void {
    this.recognition.onstart = () => {
      this.isListening = true
      this.emit('listening')
    }

    this.recognition.onend = () => {
      this.isListening = false
      this.emit('stopped')
      
      // Auto-restart if should be listening
      if (this.isProcessing) {
        setTimeout(() => this.start(), 100)
      }
    }

    this.recognition.onerror = (event: any) => {
      this.handleRecognitionError(event)
    }

    this.recognition.onresult = (event: any) => {
      this.processRecognitionResult(event)
    }
  }

  private async processRecognitionResult(event: any): Promise<void> {
    const results = event.results
    const lastResult = results[results.length - 1]
    
    if (!lastResult) return

    const transcript = lastResult[0].transcript.trim().toLowerCase()
    const confidence = lastResult[0].confidence

    // Clear silence timeout on new speech
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
    }

    // Check for wake word
    if (!this.isProcessing && this.detectWakeWord(transcript)) {
      this.isProcessing = true
      this.emit('wake-word-detected', {
        transcript,
        confidence,
        timestamp: new Date()
      })
      
      // Set timeout for command completion
      this.recognitionTimeout = setTimeout(() => {
        this.isProcessing = false
        this.emit('command-timeout')
      }, this.config.timeoutMs)
      
      return
    }

    // Process command if wake word detected
    if (this.isProcessing && transcript.length > 0) {
      if (confidence >= this.config.confidenceThreshold) {
        this.processCommand(transcript, confidence)
      } else {
        this.emit('low-confidence', { transcript, confidence })
      }
    }

    // Set silence timeout
    this.silenceTimeout = setTimeout(() => {
      if (this.isProcessing) {
        this.isProcessing = false
        this.emit('silence-timeout')
      }
    }, 2000)
  }

  private detectWakeWord(transcript: string): boolean {
    const wakeWord = this.config.wakeWord.toLowerCase()
    
    // Add to buffer
    this.wakeWordBuffer.push(transcript)
    if (this.wakeWordBuffer.length > this.WAKE_WORD_BUFFER_SIZE) {
      this.wakeWordBuffer.shift()
    }

    // Check current transcript and buffer
    const combinedText = [...this.wakeWordBuffer, transcript].join(' ')
    
    return combinedText.includes(wakeWord) || 
           transcript.startsWith(wakeWord) || 
           transcript.endsWith(wakeWord)
  }

  private processCommand(transcript: string, confidence: number): void {
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout)
    }

    const command: VoiceCommand = {
      id: `cmd_${Date.now()}`,
      category: 'system',
      action: transcript,
      description: `Voice command: ${transcript}`,
      confidence,
      timestamp: new Date()
    }

    this.emit('command-recognized', command)
    this.isProcessing = false
  }

  private handleRecognitionError(event: any): void {
    let errorMessage = 'Unknown error'
    
    switch (event.error) {
      case 'no-speech':
        errorMessage = 'No speech detected'
        break
      case 'audio-capture':
        errorMessage = 'Microphone access denied'
        break
      case 'network':
        errorMessage = 'Network error occurred'
        break
      case 'not-allowed':
        errorMessage = 'Permission denied'
        break
      case 'service-not-allowed':
        errorMessage = 'Speech recognition service not available'
        break
    }

    this.emit('error', {
      type: 'recognition',
      message: errorMessage,
      code: event.error,
      retryable: event.error !== 'not-allowed'
    })
  }

  public async start(): Promise<void> {
    if (this.isListening) return

    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: this.config.sampleRate
        } 
      })

      this.setupAudioContext(stream)
      this.recognition.start()
    } catch (error) {
      this.emit('error', {
        type: 'permission',
        message: 'Microphone access denied',
        retryable: false
      })
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop()
    }
    
    if (this.recognitionTimeout) {
      clearTimeout(this.recognitionTimeout)
    }
    
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
    }
    
    this.isProcessing = false
  }

  private setupAudioContext(stream: MediaStream): void {
    this.audioContext = new AudioContext()
    this.analyser = this.audioContext.createAnalyser()
    this.microphone = this.audioContext.createMediaStreamSource(stream)
    
    this.analyser.fftSize = this.config.bufferSize
    this.analyser.smoothingTimeConstant = 0.8
    this.microphone.connect(this.analyser)
  }

  public getAudioLevel(): number {
    if (!this.analyser) return 0

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount)
    this.analyser.getByteFrequencyData(dataArray)
    
    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
    return Math.min(100, (average / 255) * 100)
  }

  public isWakeWordMode(): boolean {
    return !this.isProcessing
  }

  public updateConfig(newConfig: Partial<VoiceRecognitionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    if (this.recognition) {
      this.recognition.lang = this.config.languages[0] || 'en-US'
    }
  }

  public destroy(): void {
    this.stop()
    
    if (this.audioContext) {
      this.audioContext.close()
    }
    
    if (this.recognition) {
      this.recognition.onresult = null
      this.recognition.onerror = null
      this.recognition.onend = null
      this.recognition.onstart = null
    }
    
    this.removeAllListeners()
  }
}