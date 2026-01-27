import OpenAI from 'openai';
import { createClient as createDeepgramClient } from '@deepgram/sdk';
import { log, logError } from '../logger';

// Types and Interfaces
export enum TranscriptionProvider {
  DEEPGRAM_MEDICAL = 'deepgram-medical',
  DEEPGRAM_GENERAL = 'deepgram-general',
  OPENAI_WHISPER = 'openai-whisper',
  GOOGLE_CLOUD_SPEECH = 'google-cloud-speech',
  AZURE_SPEECH = 'azure-speech',
  AMAZON_TRANSCRIBE = 'amazon-transcribe',
  WEB_SPEECH_API = 'web-speech-api'
}

export interface TranscriptionOptions {
  provider?: TranscriptionProvider;
  language: string;
  medicalMode: boolean;
  enableSpeakerDiarization: boolean;
  enablePunctuation: boolean;
  enableFormatting: boolean;
  enableWordTimestamps: boolean;
  enableParagraphs: boolean;
  enableSmartFormatting: boolean;
  vocabulary?: string[];
  customVocabulary?: string[];
  fallbackProvider?: TranscriptionProvider;
  timeout?: number;
  maxRetries?: number;
}

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  provider: TranscriptionProvider;
  duration: number;
  language: string;
  words: TranscribedWord[];
  paragraphs: TranscribedParagraph[];
  medicalTerms: MedicalTerm[];
  speakerDiarization?: SpeakerSegment[];
  metadata: TranscriptionMetadata;
  alternatives?: TranscriptionAlternative[];
}

export interface TranscriptionMetadata {
  processingTime: number;
  audioQuality: number;
  wordCount: number;
  characterCount: number;
  averageConfidence: number;
  modelUsed: string;
  apiVersion: string;
  timestamp: Date;
}

export interface TranscribedWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

export interface TranscribedParagraph {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
  sentences: TranscribedSentence[];
}

export interface TranscribedSentence {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

export interface MedicalTerm {
  term: string;
  type: 'condition' | 'medication' | 'procedure' | 'anatomy' | 'symptom' | 'measurement';
  confidence: number;
  start: number;
  end: number;
  snomedCode?: string;
  icd10Code?: string;
  rxNormCode?: string;
  definition?: string;
}

export interface SpeakerSegment {
  speaker: number;
  start: number;
  end: number;
  text: string;
  confidence: number;
}

export interface TranscriptionAlternative {
  transcript: string;
  confidence: number;
  words: TranscribedWord[];
}

export interface MedicalContext {
  patientId?: number;
  providerId?: number;
  encounterId?: number;
  specialty?: string;
  visitType?: string;
  chiefComplaint?: string;
  currentMedications?: string[];
  allergies?: string[];
  medicalHistory?: string[];
  currentSymptoms?: string[];
}

export interface AdvancedTranscriptionServiceConfig {
  primaryProvider: TranscriptionProvider;
  fallbackProviders: TranscriptionProvider[];
  enableMedicalMode: boolean;
  enableCaching: boolean;
  cacheExpiry: number;
  enableLoadBalancing: boolean;
  enableQualityControl: boolean;
  enableErrorRecovery: boolean;
  maxConcurrentRequests: number;
  requestTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class AdvancedTranscriptionService {
  private config: AdvancedTranscriptionServiceConfig;
  private providers: Map<TranscriptionProvider, any>;
  private medicalContext: MedicalContext | null = null;
  private cache: Map<string, TranscriptionResult>;
  private activeRequests: Map<string, AbortController>;
  private medicalVocabulary: Set<string>;

  constructor(config: Partial<AdvancedTranscriptionServiceConfig> = {}) {
    this.config = {
      primaryProvider: TranscriptionProvider.DEEPGRAM_MEDICAL,
      fallbackProviders: [
        TranscriptionProvider.OPENAI_WHISPER,
        TranscriptionProvider.GOOGLE_CLOUD_SPEECH,
        TranscriptionProvider.WEB_SPEECH_API
      ],
      enableMedicalMode: true,
      enableCaching: true,
      cacheExpiry: 3600000, // 1 hour
      enableLoadBalancing: true,
      enableQualityControl: true,
      enableErrorRecovery: true,
      maxConcurrentRequests: 10,
      requestTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...config
    };

    this.providers = new Map();
    this.cache = new Map();
    this.activeRequests = new Map();
    this.medicalVocabulary = new Set();

    this.initializeProviders();
    this.loadMedicalVocabulary();
  }

  private initializeProviders(): void {
    // Initialize Deepgram
    if (process.env.DEEPGRAM_API_KEY) {
      this.providers.set(TranscriptionProvider.DEEPGRAM_MEDICAL, createDeepgramClient(process.env.DEEPGRAM_API_KEY));
      this.providers.set(TranscriptionProvider.DEEPGRAM_GENERAL, createDeepgramClient(process.env.DEEPGRAM_API_KEY));
    }

    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set(TranscriptionProvider.OPENAI_WHISPER, new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      }));
    }

    // Initialize Web Speech API (browser-based)
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      this.providers.set(TranscriptionProvider.WEB_SPEECH_API, {
        SpeechRecognition: (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      });
    }

    log(`Initialized ${this.providers.size} transcription providers`);
  }

  private loadMedicalVocabulary(): void {
    // Load medical terminology for better transcription accuracy
    const medicalTerms = [
      // Common medical conditions
      'hypertension', 'diabetes', 'asthma', 'arthritis', 'migraine', 'depression', 'anxiety',
      'pneumonia', 'bronchitis', 'sinusitis', 'gastroenteritis', 'constipation', 'diarrhea',
      'insomnia', 'fatigue', 'dizziness', 'nausea', 'vomiting', 'fever', 'headache',
      
      // Medical procedures
      'examination', 'diagnosis', 'treatment', 'medication', 'prescription', 'injection',
      'surgery', 'operation', 'therapy', 'rehabilitation', 'consultation', 'follow-up',
      'blood test', 'x-ray', 'ultrasound', 'mri', 'ct scan', 'endoscopy', 'colonoscopy',
      
      // Anatomy
      'heart', 'lung', 'liver', 'kidney', 'stomach', 'intestine', 'brain', 'spine',
      'muscle', 'joint', 'bone', 'nerve', 'artery', 'vein', 'capillary', 'tissue',
      
      // Medical measurements
      'temperature', 'blood pressure', 'heart rate', 'respiratory rate', 'oxygen saturation',
      'weight', 'height', 'body mass index', 'cholesterol', 'glucose', 'hemoglobin',
      
      // Medications
      'aspirin', 'ibuprofen', 'acetaminophen', 'antibiotics', 'antihistamines', 'steroids',
      'insulin', 'metformin', 'lisinopril', 'atorvastatin', 'omeprazole', 'albuterol'
    ];

    medicalTerms.forEach(term => this.medicalVocabulary.add(term.toLowerCase()));
    log(`Loaded ${this.medicalVocabulary.size} medical terms into vocabulary`);
  }

  public setMedicalContext(context: MedicalContext): void {
    this.medicalContext = context;
    log('Updated medical context for transcription');
  }

  public async transcribeAudio(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(audioBuffer, options);

    // Check cache first
    if (this.config.enableCaching) {
      const cachedResult = this.cache.get(cacheKey);
      if (cachedResult && this.isCacheValid(cachedResult)) {
        log('Returning cached transcription result');
        return cachedResult;
      }
    }

    // Try primary provider first
    let result: TranscriptionResult | null = null;
    let lastError: Error | null = null;

    const providersToTry = [
      options.provider || this.config.primaryProvider,
      ...this.config.fallbackProviders
    ];

    for (const provider of providersToTry) {
      if (!this.providers.has(provider)) {
        log(`Provider ${provider} not available, trying next`);
        continue;
      }

      try {
        result = await this.transcribeWithProvider(provider, audioBuffer, options);
        if (result) {
          log(`Successfully transcribed with ${provider}`);
          break;
        }
      } catch (error) {
        lastError = error as Error;
        logError(`Transcription failed with ${provider}:`, error);
        
        if (this.config.enableErrorRecovery) {
          // Try to recover from specific errors
          const recovered = await this.attemptErrorRecovery(error, provider, audioBuffer, options);
          if (recovered) {
            result = recovered;
            break;
          }
        }
      }
    }

    if (!result) {
      throw new Error(`All transcription providers failed. Last error: ${lastError?.message}`);
    }

    // Cache the result
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, result);
    }

    const processingTime = Date.now() - startTime;
    log(`Transcription completed in ${processingTime}ms using ${result.provider}`);

    return result;
  }

  private async transcribeWithProvider(
    provider: TranscriptionProvider,
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const providerInstance = this.providers.get(provider);
    if (!providerInstance) {
      throw new Error(`Provider ${provider} not initialized`);
    }

    switch (provider) {
      case TranscriptionProvider.DEEPGRAM_MEDICAL:
      case TranscriptionProvider.DEEPGRAM_GENERAL:
        return await this.transcribeWithDeepgram(provider, providerInstance, audioBuffer, options);

      case TranscriptionProvider.OPENAI_WHISPER:
        return await this.transcribeWithOpenAI(providerInstance, audioBuffer, options);

      case TranscriptionProvider.WEB_SPEECH_API:
        return await this.transcribeWithWebSpeech(audioBuffer, options);

      default:
        throw new Error(`Provider ${provider} not implemented`);
    }
  }

  private async transcribeWithDeepgram(
    provider: TranscriptionProvider,
    deepgram: any,
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    
    const requestOptions: any = {
      model: provider === TranscriptionProvider.DEEPGRAM_MEDICAL ? 'nova-2-medical' : 'nova-2',
      punctuate: options.enablePunctuation,
      paragraphs: options.enableParagraphs,
      diarize: options.enableSpeakerDiarization,
      smart_format: options.enableFormatting,
      language: this.mapLanguageToDeepgram(options.language),
      utterances: true,
      filler_words: false,
      profanity_filter: false
    };

    // Add medical vocabulary if in medical mode
    if (options.medicalMode && options.vocabulary && options.vocabulary.length > 0) {
      requestOptions.keywords = options.vocabulary.map(term => `${term}:5`);
    }

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(audioBuffer, requestOptions);

    if (error) {
      throw new Error(`Deepgram transcription failed: ${error.message}`);
    }

    const processingTime = Date.now() - startTime;
    
    // Extract transcript and metadata
    const transcript = result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const paragraphs = result.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];
    const confidence = result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

    // Extract medical terms if in medical mode
    const medicalTerms = options.medicalMode ? this.extractMedicalTerms(transcript, words) : [];

    // Extract speaker diarization if enabled
    let speakerDiarization: SpeakerSegment[] | undefined;
    if (options.enableSpeakerDiarization && result.results?.channels?.[0]?.alternatives?.[0]?.words) {
      speakerDiarization = this.extractSpeakerDiarization(result.results.channels[0].alternatives[0].words);
    }

    return {
      transcript,
      confidence,
      provider,
      duration: result.metadata?.duration || 0,
      language: options.language,
      words: words.map((word: any) => ({
        word: word.word,
        start: word.start,
        end: word.end,
        confidence: word.confidence || confidence,
        speaker: word.speaker,
        punctuated_word: word.punctuated_word
      })),
      paragraphs: paragraphs.map((para: any) => ({
        text: para.text,
        start: para.start,
        end: para.end,
        confidence: para.confidence || confidence,
        speaker: para.speaker,
        sentences: para.sentences || []
      })),
      medicalTerms,
      speakerDiarization,
      metadata: {
        processingTime,
        audioQuality: 0, // Could be calculated from audio analysis
        wordCount: words.length,
        characterCount: transcript.length,
        averageConfidence: confidence,
        modelUsed: requestOptions.model,
        apiVersion: 'v1',
        timestamp: new Date()
      }
    };
  }

  private async transcribeWithOpenAI(
    openai: OpenAI,
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();

    // Create a File object from the buffer
    const file = new File([audioBuffer], 'audio.webm', { 
      type: 'audio/webm' 
    });

    const requestOptions: any = {
      file: file,
      model: 'whisper-1',
      language: this.mapLanguageToOpenAI(options.language),
      response_format: 'verbose_json'
    };

    // Add medical context if available
    if (options.medicalMode && this.medicalContext) {
      requestOptions.prompt = this.generateMedicalPrompt();
    }

    const response = await openai.audio.transcriptions.create(requestOptions);

    const processingTime = Date.now() - startTime;

    // Parse the response
    const transcript = response.text;
    const words = response.words || [];
    const confidence = response.confidence || 0.9; // Whisper doesn't provide confidence by default

    // Extract medical terms if in medical mode
    const medicalTerms = options.medicalMode ? this.extractMedicalTerms(transcript, words) : [];

    return {
      transcript,
      confidence,
      provider: TranscriptionProvider.OPENAI_WHISPER,
      duration: response.duration || 0,
      language: options.language,
      words: words.map((word: any) => ({
        word: word.word,
        start: word.start,
        end: word.end,
        confidence: word.confidence || confidence,
        speaker: word.speaker
      })),
      paragraphs: this.convertToParagraphs(transcript, words),
      medicalTerms,
      metadata: {
        processingTime,
        audioQuality: 0,
        wordCount: transcript.split(/\s+/).length,
        characterCount: transcript.length,
        averageConfidence: confidence,
        modelUsed: 'whisper-1',
        apiVersion: 'v1',
        timestamp: new Date()
      }
    };
  }

  private async transcribeWithWebSpeech(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    // Web Speech API is primarily for live transcription
    // For file transcription, we'll convert to a data URL and use a simple approach
    
    const audioBase64 = audioBuffer.toString('base64');
    const dataUrl = `data:audio/webm;base64,${audioBase64}`;

    // This is a simplified implementation - in a real scenario, you'd need to:
    // 1. Convert the audio to the correct format
    // 2. Implement proper audio processing
    // 3. Handle browser compatibility issues

    return {
      transcript: '[Web Speech API transcription not implemented for file processing]',
      confidence: 0.5,
      provider: TranscriptionProvider.WEB_SPEECH_API,
      duration: 0,
      language: options.language,
      words: [],
      paragraphs: [],
      medicalTerms: [],
      metadata: {
        processingTime: 0,
        audioQuality: 0,
        wordCount: 0,
        characterCount: 0,
        averageConfidence: 0.5,
        modelUsed: 'web-speech-api',
        apiVersion: 'v1',
        timestamp: new Date()
      }
    };
  }

  private extractMedicalTerms(transcript: string, words: any[]): MedicalTerm[] {
    const medicalTerms: MedicalTerm[] = [];
    const transcriptLower = transcript.toLowerCase();

    // Check for medical vocabulary
    for (const [term, termInfo] of Object.entries(this.getMedicalVocabulary())) {
      if (transcriptLower.includes(term.toLowerCase())) {
        const startIndex = transcriptLower.indexOf(term.toLowerCase());
        const startWord = this.findWordAtPosition(words, startIndex);
        const endWord = this.findWordAtPosition(words, startIndex + term.length);

        medicalTerms.push({
          term,
          type: termInfo.type,
          confidence: 0.9,
          start: startWord?.start || 0,
          end: endWord?.end || 0,
          snomedCode: termInfo.snomedCode,
          icd10Code: termInfo.icd10Code,
          rxNormCode: termInfo.rxNormCode,
          definition: termInfo.definition
        });
      }
    }

    return medicalTerms;
  }

  private extractSpeakerDiarization(words: any[]): SpeakerSegment[] {
    const speakerSegments: SpeakerSegment[] = [];
    let currentSpeaker = words[0]?.speaker;
    let currentSegment = {
      speaker: currentSpeaker,
      start: words[0]?.start || 0,
      end: words[0]?.end || 0,
      text: words[0]?.word || '',
      confidence: words[0]?.confidence || 0
    };

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (word.speaker !== currentSpeaker) {
        speakerSegments.push(currentSegment);
        currentSpeaker = word.speaker;
        currentSegment = {
          speaker: currentSpeaker,
          start: word.start,
          end: word.end,
          text: word.word,
          confidence: word.confidence
        };
      } else {
        currentSegment.text += ' ' + word.word;
        currentSegment.end = word.end;
        currentSegment.confidence = (currentSegment.confidence + word.confidence) / 2;
      }
    }

    speakerSegments.push(currentSegment);
    return speakerSegments;
  }

  private async attemptErrorRecovery(
    error: any,
    provider: TranscriptionProvider,
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult | null> {
    log(`Attempting error recovery for ${provider} error:`, error);

    // Implement specific recovery strategies based on error type
    if (error.message?.includes('rate limit')) {
      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      try {
        return await this.transcribeWithProvider(provider, audioBuffer, options);
      } catch (retryError) {
        logError('Retry failed:', retryError);
        return null;
      }
    }

    if (error.message?.includes('network')) {
      // Try with reduced quality or timeout
      const reducedOptions = { ...options, timeout: options.timeout ? options.timeout * 2 : 60000 };
      try {
        return await this.transcribeWithProvider(provider, audioBuffer, reducedOptions);
      } catch (networkRetryError) {
        logError('Network retry failed:', networkRetryError);
        return null;
      }
    }

    return null;
  }

  private generateCacheKey(audioBuffer: Buffer, options: TranscriptionOptions): string {
    const crypto = require('crypto');
    const audioHash = crypto.createHash('md5').update(audioBuffer).digest('hex');
    const optionsHash = crypto.createHash('md5').update(JSON.stringify(options)).digest('hex');
    return `${audioHash}-${optionsHash}`;
  }

  private isCacheValid(result: TranscriptionResult): boolean {
    const now = new Date();
    const resultTime = result.metadata.timestamp;
    const age = now.getTime() - resultTime.getTime();
    return age < this.config.cacheExpiry;
  }

  private mapLanguageToDeepgram(language: string): string {
    const languageMap: Record<string, string> = {
      'en-US': 'en-US',
      'en-GB': 'en-GB',
      'es-ES': 'es',
      'fr-FR': 'fr',
      'de-DE': 'de',
      'it-IT': 'it',
      'pt-BR': 'pt-BR',
      'nl-NL': 'nl',
      'ru-RU': 'ru'
    };
    return languageMap[language] || 'en-US';
  }

  private mapLanguageToOpenAI(language: string): string {
    const languageMap: Record<string, string> = {
      'en-US': 'en',
      'en-GB': 'en',
      'es-ES': 'es',
      'fr-FR': 'fr',
      'de-DE': 'de',
      'it-IT': 'it',
      'pt-BR': 'pt',
      'nl-NL': 'nl',
      'ru-RU': 'ru'
    };
    return languageMap[language] || 'en';
  }

  private generateMedicalPrompt(): string {
    if (!this.medicalContext) return '';

    const context = this.medicalContext;
    let prompt = 'Medical transcription context:\n';

    if (context.specialty) {
      prompt += `Specialty: ${context.specialty}\n`;
    }

    if (context.chiefComplaint) {
      prompt += `Chief Complaint: ${context.chiefComplaint}\n`;
    }

    if (context.currentMedications && context.currentMedications.length > 0) {
      prompt += `Current Medications: ${context.currentMedications.join(', ')}\n`;
    }

    if (context.allergies && context.allergies.length > 0) {
      prompt += `Allergies: ${context.allergies.join(', ')}\n`;
    }

    if (context.medicalHistory && context.medicalHistory.length > 0) {
      prompt += `Medical History: ${context.medicalHistory.join(', ')}\n`;
    }

    return prompt;
  }

  private getMedicalVocabulary(): Record<string, any> {
    return {
      'hypertension': { type: 'condition', snomedCode: '38341003', icd10Code: 'I10' },
      'diabetes': { type: 'condition', snomedCode: '73211009', icd10Code: 'E11.9' },
      'asthma': { type: 'condition', snomedCode: '195967001', icd10Code: 'J45.909' },
      'migraine': { type: 'condition', snomedCode: '37796009', icd10Code: 'G43.909' },
      'depression': { type: 'condition', snomedCode: '35489007', icd10Code: 'F32.9' },
      'anxiety': { type: 'condition', snomedCode: '48694002', icd10Code: 'F41.9' },
      'aspirin': { type: 'medication', rxNormCode: '1191' },
      'ibuprofen': { type: 'medication', rxNormCode: '5640' },
      'metformin': { type: 'medication', rxNormCode: '6809' },
      'lisinopril': { type: 'medication', rxNormCode: '29046' }
    };
  }

  private findWordAtPosition(words: any[], position: number): any {
    // Simple implementation - in a real scenario, you'd need more sophisticated word position mapping
    return words[Math.floor(position / 5)] || words[0];
  }

  private convertToParagraphs(transcript: string, words: any[]): TranscribedParagraph[] {
    // Simple paragraph conversion - split on double newlines or sentence endings
    const paragraphs = transcript.split(/\n\n|\r\n\r\n/);
    return paragraphs.map((text, index) => ({
      text: text.trim(),
      start: index === 0 ? 0 : words[Math.floor(index * words.length / paragraphs.length)]?.start || 0,
      end: index === paragraphs.length - 1 ? 
        words[words.length - 1]?.end || 0 : 
        words[Math.floor((index + 1) * words.length / paragraphs.length)]?.end || 0,
      confidence: 0.9,
      speaker: 0,
      sentences: []
    }));
  }

  // Public methods for managing the service
  public setPrimaryProvider(provider: TranscriptionProvider): void {
    this.config.primaryProvider = provider;
    log(`Set primary provider to ${provider}`);
  }

  public addFallbackProvider(provider: TranscriptionProvider): void {
    if (!this.config.fallbackProviders.includes(provider)) {
      this.config.fallbackProviders.push(provider);
      log(`Added ${provider} as fallback provider`);
    }
  }

  public enableMedicalMode(): void {
    this.config.enableMedicalMode = true;
    log('Enabled medical mode for transcription');
  }

  public disableMedicalMode(): void {
    this.config.enableMedicalMode = false;
    log('Disabled medical mode for transcription');
  }

  public clearCache(): void {
    this.cache.clear();
    log('Cleared transcription cache');
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public getProviderStatus(): Record<TranscriptionProvider, boolean> {
    const status: Record<TranscriptionProvider, boolean> = {} as any;
    
    for (const provider of Object.values(TranscriptionProvider)) {
      status[provider] = this.providers.has(provider);
    }

    return status;
  }

  public getActiveRequestsCount(): number {
    return this.activeRequests.size;
  }

  public abortRequest(requestId: string): void {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
      log(`Aborted request ${requestId}`);
    }
  }

  public abortAllRequests(): void {
    for (const [requestId, controller] of this.activeRequests) {
      controller.abort();
      log(`Aborted request ${requestId}`);
    }
    this.activeRequests.clear();
  }
}

// Export singleton instance
export const transcriptionService = new AdvancedTranscriptionService();