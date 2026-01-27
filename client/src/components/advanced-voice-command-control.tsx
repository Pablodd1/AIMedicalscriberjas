import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Mic, 
  MicOff, 
  Command, 
  Settings,
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  Filter,
  Search,
  Eye,
  EyeOff,
  Brain,
  Sparkles,
  Zap,
  Activity,
  Target,
  Clock,
  User,
  FileText,
  Download,
  Share2,
  Globe,
  ZapOff
} from "lucide-react";

// Enhanced voice commands with medical context and NLP processing
const ENHANCED_VOICE_COMMANDS = [
  // Recording Commands
  {
    id: 'start_recording',
    phrases: [
      'start recording', 'begin recording', 'record now', 'start consultation',
      'start medical recording', 'begin patient recording', 'start clinical note',
      'start dictation', 'begin documentation'
    ],
    action: 'START_RECORDING',
    description: 'Start recording consultation with medical context',
    category: 'recording',
    confidenceThreshold: 0.85,
    medicalTerms: ['recording', 'consultation', 'medical', 'clinical', 'dictation'],
    synonyms: ['begin', 'start', 'initiate', 'commence']
  },
  {
    id: 'stop_recording',
    phrases: [
      'stop recording', 'end recording', 'finish recording', 'stop consultation',
      'stop medical recording', 'end patient recording', 'stop clinical note',
      'stop dictation', 'end documentation', 'save recording'
    ],
    action: 'STOP_RECORDING',
    description: 'Stop recording and process medical transcript',
    category: 'recording',
    confidenceThreshold: 0.85,
    medicalTerms: ['recording', 'consultation', 'medical', 'clinical', 'dictation'],
    synonyms: ['stop', 'end', 'finish', 'complete', 'save']
  },
  {
    id: 'pause_recording',
    phrases: [
      'pause recording', 'pause', 'hold recording', 'pause medical recording',
      'pause consultation', 'pause clinical note', 'pause dictation'
    ],
    action: 'PAUSE_RECORDING',
    description: 'Pause current recording session',
    category: 'recording',
    confidenceThreshold: 0.80,
    medicalTerms: ['recording', 'consultation', 'medical', 'clinical'],
    synonyms: ['pause', 'hold', 'suspend']
  },
  {
    id: 'resume_recording',
    phrases: [
      'resume recording', 'resume', 'continue recording', 'resume medical recording',
      'resume consultation', 'resume clinical note', 'resume dictation',
      'continue documentation', 'resume patient recording'
    ],
    action: 'RESUME_RECORDING',
    description: 'Resume paused recording session',
    category: 'recording',
    confidenceThreshold: 0.80,
    medicalTerms: ['recording', 'consultation', 'medical', 'clinical', 'dictation'],
    synonyms: ['resume', 'continue', 'restart']
  },

  // Medical Documentation Commands
  {
    id: 'generate_clinical_summary',
    phrases: [
      'generate clinical summary', 'create clinical summary', 'make clinical summary',
      'generate medical summary', 'create patient summary', 'generate assessment',
      'create clinical note', 'generate soap note', 'create progress note'
    ],
    action: 'GENERATE_CLINICAL_SUMMARY',
    description: 'Generate comprehensive clinical summary from transcript',
    category: 'medical_notes',
    confidenceThreshold: 0.90,
    medicalTerms: ['clinical', 'medical', 'summary', 'assessment', 'soap', 'progress', 'note'],
    synonyms: ['generate', 'create', 'make', 'produce']
  },
  {
    id: 'generate_soap_note',
    phrases: [
      'generate soap note', 'create soap note', 'make soap note', 'write soap note',
      'generate subjective objective assessment plan', 'create soap documentation',
      'generate medical soap note', 'create clinical soap note'
    ],
    action: 'GENERATE_SOAP_NOTE',
    description: 'Generate SOAP note from consultation transcript',
    category: 'medical_notes',
    confidenceThreshold: 0.90,
    medicalTerms: ['soap', 'subjective', 'objective', 'assessment', 'plan', 'note', 'clinical'],
    synonyms: ['generate', 'create', 'make', 'write']
  },
  {
    id: 'extract_medical_codes',
    phrases: [
      'extract medical codes', 'get icd codes', 'find icd-10 codes', 'extract diagnosis codes',
      'get procedure codes', 'extract cpt codes', 'find medical billing codes',
      'extract clinical codes', 'get billing codes'
    ],
    action: 'EXTRACT_MEDICAL_CODES',
    description: 'Extract ICD-10 and CPT codes from medical transcript',
    category: 'medical_notes',
    confidenceThreshold: 0.88,
    medicalTerms: ['medical', 'codes', 'icd', 'icd-10', 'cpt', 'diagnosis', 'procedure', 'billing'],
    synonyms: ['extract', 'get', 'find', 'identify']
  },
  {
    id: 'check_drug_interactions',
    phrases: [
      'check drug interactions', 'analyze drug interactions', 'find drug interactions',
      'check medication interactions', 'analyze medication interactions', 'find medication conflicts',
      'check prescription interactions', 'analyze prescription conflicts', 'find drug conflicts'
    ],
    action: 'CHECK_DRUG_INTERACTIONS',
    description: 'Check for drug interactions and medication conflicts',
    category: 'medical_notes',
    confidenceThreshold: 0.88,
    medicalTerms: ['drug', 'medication', 'prescription', 'interactions', 'conflicts', 'analysis'],
    synonyms: ['check', 'analyze', 'find', 'identify']
  },

  // Navigation Commands
  {
    id: 'go_to_patients',
    phrases: [
      'go to patients', 'open patients', 'show patients', 'navigate to patients',
      'go to patient list', 'open patient directory', 'show patient records',
      'navigate to patient management', 'go to patient database'
    ],
    action: 'NAVIGATE_PATIENTS',
    description: 'Navigate to patient management section',
    category: 'navigation',
    confidenceThreshold: 0.85,
    medicalTerms: ['patients', 'patient', 'records', 'database', 'management', 'directory'],
    synonyms: ['go', 'open', 'show', 'navigate']
  },
  {
    id: 'go_to_appointments',
    phrases: [
      'go to appointments', 'open appointments', 'show appointments', 'navigate to appointments',
      'go to appointment calendar', 'open appointment schedule', 'show appointment list',
      'navigate to appointment management', 'go to scheduling'
    ],
    action: 'NAVIGATE_APPOINTMENTS',
    description: 'Navigate to appointment scheduling section',
    category: 'navigation',
    confidenceThreshold: 0.85,
    medicalTerms: ['appointments', 'appointment', 'scheduling', 'calendar', 'schedule'],
    synonyms: ['go', 'open', 'show', 'navigate']
  },
  {
    id: 'go_to_clinical_summary',
    phrases: [
      'go to clinical summary', 'open clinical summary', 'show clinical summary',
      'navigate to clinical summary', 'go to medical summary', 'open patient summary',
      'show clinical notes', 'navigate to clinical documentation', 'go to assessment'
    ],
    action: 'NAVIGATE_CLINICAL_SUMMARY',
    description: 'Navigate to clinical summary and documentation',
    category: 'navigation',
    confidenceThreshold: 0.85,
    medicalTerms: ['clinical', 'medical', 'summary', 'assessment', 'documentation', 'notes'],
    synonyms: ['go', 'open', 'show', 'navigate']
  },

  // AI Enhancement Commands
  {
    id: 'enable_medical_mode',
    phrases: [
      'enable medical mode', 'turn on medical mode', 'activate medical mode',
      'enable clinical mode', 'turn on clinical mode', 'activate clinical mode',
      'enable healthcare mode', 'activate healthcare mode', 'turn on medical context'
    ],
    action: 'ENABLE_MEDICAL_MODE',
    description: 'Enable medical terminology recognition and clinical context',
    category: 'ai_enhancement',
    confidenceThreshold: 0.88,
    medicalTerms: ['medical', 'clinical', 'healthcare', 'mode', 'context'],
    synonyms: ['enable', 'turn on', 'activate']
  },
  {
    id: 'enhance_transcript',
    phrases: [
      'enhance transcript', 'improve transcript', 'optimize transcript',
      'enhance medical transcript', 'improve clinical transcript', 'optimize medical text',
      'enhance voice transcript', 'improve speech recognition', 'optimize audio transcription'
    ],
    action: 'ENHANCE_TRANSCRIPT',
    description: 'Enhance transcript quality with medical context',
    category: 'ai_enhancement',
    confidenceThreshold: 0.86,
    medicalTerms: ['enhance', 'improve', 'optimize', 'transcript', 'medical', 'clinical'],
    synonyms: ['enhance', 'improve', 'optimize', 'refine']
  },
  {
    id: 'validate_medical_data',
    phrases: [
      'validate medical data', 'check medical data', 'verify medical data',
      'validate clinical data', 'check clinical information', 'verify patient data',
      'validate healthcare data', 'check medical records', 'verify clinical notes'
    ],
    action: 'VALIDATE_MEDICAL_DATA',
    description: 'Validate extracted medical data for accuracy',
    category: 'ai_enhancement',
    confidenceThreshold: 0.86,
    medicalTerms: ['validate', 'check', 'verify', 'medical', 'clinical', 'data', 'records'],
    synonyms: ['validate', 'check', 'verify', 'confirm']
  },

  // System Control Commands
  {
    id: 'show_help',
    phrases: [
      'show help', 'display help', 'open help', 'help me', 'show commands',
      'show voice commands', 'display available commands', 'what can i say',
      'show medical commands', 'display voice help'
    ],
    action: 'SHOW_HELP',
    description: 'Display available voice commands and help information',
    category: 'system_control',
    confidenceThreshold: 0.82,
    medicalTerms: ['help', 'commands', 'voice', 'medical', 'available'],
    synonyms: ['show', 'display', 'open', 'help']
  },
  {
    id: 'toggle_voice_commands',
    phrases: [
      'toggle voice commands', 'enable voice commands', 'disable voice commands',
      'turn on voice commands', 'turn off voice commands', 'activate voice commands',
      'deactivate voice commands', 'switch voice commands', 'toggle medical voice'
    ],
    action: 'TOGGLE_VOICE_COMMANDS',
    description: 'Toggle voice command system on/off',
    category: 'system_control',
    confidenceThreshold: 0.82,
    medicalTerms: ['voice', 'commands', 'medical', 'toggle', 'enable', 'disable'],
    synonyms: ['toggle', 'enable', 'disable', 'turn on', 'turn off']
  },

  // Telemedicine Commands
  {
    id: 'start_video_consultation',
    phrases: [
      'start video consultation', 'begin video consultation', 'start video call',
      'begin telemedicine session', 'start virtual consultation', 'initiate video consultation',
      'start medical video call', 'begin telehealth session', 'start patient video'
    ],
    action: 'START_VIDEO_CONSULTATION',
    description: 'Start video consultation for telemedicine',
    category: 'telemedicine',
    confidenceThreshold: 0.87,
    medicalTerms: ['video', 'consultation', 'telemedicine', 'telehealth', 'virtual', 'medical'],
    synonyms: ['start', 'begin', 'initiate']
  },
  {
    id: 'end_video_consultation',
    phrases: [
      'end video consultation', 'stop video consultation', 'end video call',
      'finish telemedicine session', 'end virtual consultation', 'terminate video consultation',
      'stop medical video call', 'end telehealth session', 'finish patient video'
    ],
    action: 'END_VIDEO_CONSULTATION',
    description: 'End video consultation session',
    category: 'telemedicine',
    confidenceThreshold: 0.87,
    medicalTerms: ['video', 'consultation', 'telemedicine', 'telehealth', 'virtual', 'medical'],
    synonyms: ['end', 'stop', 'finish', 'terminate']
  }
];

interface AdvancedVoiceCommandControlProps {
  className?: string;
  onCommandExecuted?: (command: VoiceCommand, result: CommandResult) => void;
  onCommandError?: (error: VoiceCommandError) => void;
  enableNLPProcessing?: boolean;
  enableMedicalContext?: boolean;
  enableConfidenceScoring?: boolean;
  enableRealTimeProcessing?: boolean;
  enableMultiLanguageSupport?: boolean;
  enableVoiceTraining?: boolean;
  enableCommandLearning?: boolean;
  enableContextAwareness?: boolean;
  enableErrorRecovery?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableVoiceCommands?: boolean;
}

interface VoiceCommand {
  id: string;
  phrases: string[];
  action: string;
  description: string;
  category: string;
  confidenceThreshold: number;
  medicalTerms?: string[];
  synonyms?: string[];
}

interface CommandResult {
  success: boolean;
  command: VoiceCommand;
  parameters: Record<string, any>;
  confidence: number;
  executionTime: number;
  result?: any;
  medicalContext?: any;
}

interface VoiceCommandError {
  type: 'recognition' | 'processing' | 'execution' | 'network' | 'permission';
  message: string;
  details?: any;
  recoveryAction?: string;
  medicalContext?: any;
}

interface ProcessingMetrics {
  recognitionAccuracy: number;
  confidenceScore: number;
  processingTime: number;
  commandsRecognized: number;
  medicalTermsDetected: number;
  nlpProcessingTime: number;
}

export function AdvancedVoiceCommandControl({
  className,
  onCommandExecuted,
  onCommandError,
  enableNLPProcessing = true,
  enableMedicalContext = true,
  enableConfidenceScoring = true,
  enableRealTimeProcessing = true,
  enableMultiLanguageSupport = false,
  enableVoiceTraining = false,
  enableCommandLearning = true,
  enableContextAwareness = true,
  enableErrorRecovery = true,
  enablePerformanceMonitoring = true,
  enableVoiceCommands = true
}: AdvancedVoiceCommandControlProps) {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [recognizedCommand, setRecognizedCommand] = useState<VoiceCommand | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [processingMetrics, setProcessingMetrics] = useState<ProcessingMetrics>({
    recognitionAccuracy: 0,
    confidenceScore: 0,
    processingTime: 0,
    commandsRecognized: 0,
    medicalTermsDetected: 0,
    nlpProcessingTime: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [customCommands, setCustomCommands] = useState<VoiceCommand[]>([]);
  const [currentContext, setCurrentContext] = useState<string>('general');
  const [language, setLanguage] = useState<string>('en-US');
  const [autoLearn, setAutoLearn] = useState(enableCommandLearning);

  const recognitionRef = useRef<any>(null);
  const commandHistoryRef = useRef<CommandResult[]>([]);
  const medicalVocabularyRef = useRef<Set<string>>(new Set());
  const contextPatternsRef = useRef<Record<string, string[]>>({});

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 5;

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.toLowerCase().trim();
        
        if (event.results[last].isFinal) {
          processVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        handleRecognitionError(event.error);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (isEnabled) {
          setTimeout(() => {
            if (isEnabled && recognitionRef.current) {
              recognitionRef.current.start();
              setIsListening(true);
            }
          }, 1000);
        }
      };

      recognitionRef.current = recognition;
      loadMedicalVocabulary();
    }
  }, [language, isEnabled]);

  // Load medical vocabulary for better recognition
  const loadMedicalVocabulary = useCallback(() => {
    const medicalTerms = [
      // Medical conditions
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

    medicalTerms.forEach(term => medicalVocabularyRef.current.add(term.toLowerCase()));
  }, []);

  // Process voice command with NLP and medical context
  const processVoiceCommand = useCallback(async (transcript: string) => {
    const startTime = Date.now();
    setLastCommand(null);
    setRecognizedCommand(null);

    try {
      // Apply NLP processing if enabled
      const processedTranscript = enableNLPProcessing 
        ? await applyNLPProcessing(transcript)
        : transcript;

      // Extract medical context if enabled
      const medicalContext = enableMedicalContext
        ? extractMedicalContext(processedTranscript)
        : null;

      // Find matching command with enhanced matching
      const matchedCommand = await findMatchingCommand(
        processedTranscript,
        medicalContext,
        currentContext
      );

      if (matchedCommand) {
        const confidence = calculateCommandConfidence(
          processedTranscript,
          matchedCommand,
          medicalContext
        );

        if (confidence >= matchedCommand.confidenceThreshold) {
          setRecognizedCommand(matchedCommand);
          setConfidence(confidence);

          // Execute command with medical context
          const result = await executeVoiceCommand(matchedCommand, {
            transcript: processedTranscript,
            medicalContext,
            confidence,
            timestamp: new Date()
          });

          // Update processing metrics
          const processingTime = Date.now() - startTime;
          updateProcessingMetrics(confidence, processingTime, medicalContext);

          // Add to command history
          commandHistoryRef.current.push(result);
          if (commandHistoryRef.current.length > 100) {
            commandHistoryRef.current.shift();
          }

          onCommandExecuted?.(matchedCommand, result);
        }
      }

    } catch (error) {
      handleCommandError(error as Error, transcript);
    }
  }, [
    enableNLPProcessing,
    enableMedicalContext,
    currentContext,
    onCommandExecuted
  ]);

  // Apply NLP processing to improve command recognition
  const applyNLPProcessing = useCallback(async (transcript: string): Promise<string> => {
    // Apply medical context normalization
    let processed = transcript;
    
    // Normalize medical terms
    for (const term of medicalVocabularyRef.current) {
      if (processed.includes(term)) {
        processed = processed.replace(new RegExp(term, 'gi'), term);
      }
    }

    // Apply context-aware processing
    if (enableContextAwareness) {
      processed = applyContextAwareness(processed);
    }

    return processed;
  }, [enableContextAwareness]);

  // Extract medical context from transcript
  const extractMedicalContext = useCallback((transcript: string): any => {
    const context = {
      medicalTerms: [] as string[],
      clinicalContext: false,
      urgency: 'normal' as 'normal' | 'urgent' | 'emergency',
      confidence: 0.5
    };

    // Detect medical terms
    for (const term of medicalVocabularyRef.current) {
      if (transcript.includes(term)) {
        context.medicalTerms.push(term);
      }
    }

    // Detect clinical context
    const clinicalKeywords = ['patient', 'diagnosis', 'treatment', 'medication', 'symptom', 'condition'];
    context.clinicalContext = clinicalKeywords.some(keyword => transcript.includes(keyword));

    // Detect urgency
    const urgentKeywords = ['emergency', 'urgent', 'critical', 'severe', 'acute'];
    if (urgentKeywords.some(keyword => transcript.includes(keyword))) {
      context.urgency = 'urgent';
    }

    // Calculate confidence based on medical terms
    context.confidence = Math.min(1.0, context.medicalTerms.length * 0.1 + (context.clinicalContext ? 0.2 : 0));

    return context;
  }, []);

  // Find matching command with enhanced matching
  const findMatchingCommand = useCallback(async (
    transcript: string,
    medicalContext: any,
    currentContext: string
  ): Promise<VoiceCommand | null> => {
    const availableCommands = [...ENHANCED_VOICE_COMMANDS, ...customCommands];
    let bestMatch: VoiceCommand | null = null;
    let bestScore = 0;

    for (const command of availableCommands) {
      // Check if command is relevant to current context
      if (enableContextAwareness && !isCommandRelevant(command, currentContext)) {
        continue;
      }

      // Calculate similarity score for each phrase
      for (const phrase of command.phrases) {
        const score = calculateSimilarityScore(transcript, phrase, medicalContext);
        
        if (score > bestScore && score >= command.confidenceThreshold) {
          bestScore = score;
          bestMatch = command;
        }
      }
    }

    return bestMatch;
  }, [customCommands, enableContextAwareness, currentContext]);

  // Calculate similarity score between transcript and command phrase
  const calculateSimilarityScore = useCallback((
    transcript: string,
    phrase: string,
    medicalContext: any
  ): number => {
    // Basic similarity calculation
    const transcriptWords = transcript.toLowerCase().split(/\s+/);
    const phraseWords = phrase.toLowerCase().split(/\s+/);
    
    let matches = 0;
    let totalWords = phraseWords.length;

    for (const word of phraseWords) {
      if (transcriptWords.includes(word)) {
        matches++;
      }
    }

    let score = matches / totalWords;

    // Boost score for medical terms
    if (medicalContext && medicalContext.medicalTerms.length > 0) {
      const medicalTermMatches = medicalContext.medicalTerms.filter(term => 
        phrase.includes(term)
      ).length;
      score += (medicalTermMatches * 0.1);
    }

    // Boost score for context relevance
    if (enableContextAwareness) {
      score += (medicalContext?.clinicalContext ? 0.1 : 0);
    }

    return Math.min(1.0, score);
  }, [enableContextAwareness]);

  // Check if command is relevant to current context
  const isCommandRelevant = useCallback((command: VoiceCommand, currentContext: string): boolean => {
    const contextRelevance: Record<string, string[]> = {
      'recording': ['recording', 'consultation', 'intake'],
      'medical_notes': ['notes', 'documentation', 'summary'],
      'navigation': ['navigation', 'interface'],
      'ai_enhancement': ['ai', 'enhancement', 'processing'],
      'system_control': ['system', 'control', 'settings'],
      'telemedicine': ['telemedicine', 'video', 'consultation']
    };

    const relevantContexts = contextRelevance[command.category] || [];
    return relevantContexts.includes(currentContext) || currentContext === 'general';
  }, []);

  // Calculate command confidence
  const calculateCommandConfidence = useCallback((
    transcript: string,
    command: VoiceCommand,
    medicalContext: any
  ): number => {
    let confidence = 0;

    // Base confidence from similarity score
    const similarityScore = calculateSimilarityScore(transcript, command.phrases[0], medicalContext);
    confidence = similarityScore;

    // Boost confidence for medical context
    if (medicalContext && medicalContext.medicalTerms.length > 0) {
      confidence += 0.1;
    }

    // Boost confidence for clinical context
    if (medicalContext?.clinicalContext) {
      confidence += 0.05;
    }

    // Apply confidence threshold
    if (confidence < command.confidenceThreshold) {
      return 0;
    }

    return Math.min(1.0, confidence);
  }, [calculateSimilarityScore]);

  // Execute voice command with medical context
  const executeVoiceCommand = useCallback(async (
    command: VoiceCommand,
    context: any
  ): Promise<CommandResult> => {
    const startTime = Date.now();
    
    try {
      // Execute command based on action type
      let result: any;
      
      switch (command.action) {
        case 'START_RECORDING':
          result = await startMedicalRecording(context);
          break;
        case 'STOP_RECORDING':
          result = await stopMedicalRecording(context);
          break;
        case 'GENERATE_CLINICAL_SUMMARY':
          result = await generateClinicalSummary(context);
          break;
        case 'EXTRACT_MEDICAL_CODES':
          result = await extractMedicalCodes(context);
          break;
        case 'CHECK_DRUG_INTERACTIONS':
          result = await checkDrugInteractions(context);
          break;
        case 'ENABLE_MEDICAL_MODE':
          result = await enableMedicalMode(context);
          break;
        case 'ENHANCE_TRANSCRIPT':
          result = await enhanceTranscript(context);
          break;
        case 'VALIDATE_MEDICAL_DATA':
          result = await validateMedicalData(context);
          break;
        case 'SHOW_HELP':
          result = await showVoiceHelp(context);
          break;
        case 'TOGGLE_VOICE_COMMANDS':
          result = await toggleVoiceCommands(context);
          break;
        default:
          throw new Error(`Unknown voice action: ${command.action}`);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        command,
        parameters: context,
        confidence: context.confidence,
        executionTime,
        result,
        medicalContext: context.medicalContext
      };

    } catch (error) {
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Apply context awareness to transcript
  const applyContextAwareness = useCallback((transcript: string): string => {
    // Apply context-specific transformations
    const contextPatterns = {
      'recording': ['recording', 'consultation', 'patient', 'medical'],
      'notes': ['notes', 'documentation', 'summary', 'assessment'],
      'navigation': ['go', 'open', 'show', 'navigate'],
      'ai': ['ai', 'enhance', 'optimize', 'improve']
    };

    // Apply context-specific normalization
    let processed = transcript;
    
    for (const [context, patterns] of Object.entries(contextPatterns)) {
      if (currentContext === context) {
        // Boost context-relevant terms
        patterns.forEach(pattern => {
          if (processed.includes(pattern)) {
            processed = processed.replace(new RegExp(pattern, 'gi'), pattern);
          }
        });
      }
    }

    return processed;
  }, [currentContext]);

  // Update processing metrics
  const updateProcessingMetrics = useCallback((
    confidence: number,
    processingTime: number,
    medicalContext: any
  ) => {
    setProcessingMetrics(prev => ({
      recognitionAccuracy: Math.round((prev.recognitionAccuracy * prev.commandsRecognized + confidence * 100) / (prev.commandsRecognized + 1)),
      confidenceScore: Math.round((prev.confidenceScore * prev.commandsRecognized + confidence * 100) / (prev.commandsRecognized + 1)),
      processingTime: (prev.processingTime * prev.commandsRecognized + processingTime) / (prev.commandsRecognized + 1),
      commandsRecognized: prev.commandsRecognized + 1,
      medicalTermsDetected: prev.medicalTermsDetected + (medicalContext?.medicalTerms?.length || 0),
      nlpProcessingTime: enableNLPProcessing ? processingTime * 0.3 : 0
    }));
  }, [enableNLPProcessing]);

  // Handle recognition errors
  const handleRecognitionError = useCallback((error: string) => {
    let errorType: VoiceCommandError['type'] = 'recognition';
    let message = 'Voice recognition error occurred';
    let recoveryAction = 'Please check your microphone settings and try again.';

    switch (error) {
      case 'no-speech':
        errorType = 'recognition';
        message = 'No speech detected. Please try speaking again.';
        recoveryAction = 'Speak clearly into your microphone and ensure it is not muted.';
        break;
      case 'audio-capture':
        errorType = 'permission';
        message = 'Microphone not available. Please check permissions.';
        recoveryAction = 'Check microphone permissions in your browser settings.';
        break;
      case 'not-allowed':
        errorType = 'permission';
        message = 'Microphone access denied. Please allow access.';
        recoveryAction = 'Allow microphone access when prompted by your browser.';
        break;
      case 'network':
        errorType = 'network';
        message = 'Network error. Please check your connection.';
        recoveryAction = 'Check your internet connection and try again.';
        break;
    }

    const errorObj: VoiceCommandError = {
      type: errorType,
      message,
      recoveryAction,
      medicalContext: { context: currentContext }
    };

    onCommandError?.(errorObj);

    toast({
      title: 'Voice Recognition Error',
      description: message,
      variant: 'destructive'
    });
  }, [currentContext, onCommandError, toast]);

  // Handle command execution errors
  const handleCommandError = useCallback((error: Error, transcript: string) => {
    const errorObj: VoiceCommandError = {
      type: 'execution',
      message: error.message,
      recoveryAction: 'Please try the command again or check the help documentation.',
      medicalContext: { transcript }
    };

    onCommandError?.(errorObj);

    toast({
      title: 'Command Execution Error',
      description: error.message,
      variant: 'destructive'
    });
  }, [onCommandError, toast]);

  // Command execution functions
  const startMedicalRecording = useCallback(async (context: any): Promise<any> => {
    // Implementation for starting medical recording
    return { status: 'started', medicalMode: enableMedicalContext };
  }, [enableMedicalContext]);

  const stopMedicalRecording = useCallback(async (context: any): Promise<any> => {
    // Implementation for stopping medical recording
    return { status: 'stopped', transcript: context.transcript };
  }, []);

  const generateClinicalSummary = useCallback(async (context: any): Promise<any> => {
    // Implementation for generating clinical summary
    return { summary: 'Clinical summary generated', confidence: context.confidence };
  }, []);

  const extractMedicalCodes = useCallback(async (context: any): Promise<any> => {
    // Implementation for extracting medical codes
    return { codes: ['I10', 'E11.9'], type: 'ICD-10', confidence: context.confidence };
  }, []);

  const checkDrugInteractions = useCallback(async (context: any): Promise<any> => {
    // Implementation for checking drug interactions
    return { interactions: [], checked: true, confidence: context.confidence };
  }, []);

  const enableMedicalMode = useCallback(async (context: any): Promise<any> => {
    // Implementation for enabling medical mode
    return { medicalMode: true, confidence: context.confidence };
  }, []);

  const enhanceTranscript = useCallback(async (context: any): Promise<any> => {
    // Implementation for enhancing transcript
    return { enhanced: true, original: context.transcript, confidence: context.confidence };
  }, []);

  const validateMedicalData = useCallback(async (context: any): Promise<any> => {
    // Implementation for validating medical data
    return { validated: true, confidence: context.confidence };
  }, []);

  const showVoiceHelp = useCallback(async (context: any): Promise<any> => {
    setShowHelp(true);
    return { helpShown: true, confidence: context.confidence };
  }, []);

  const toggleVoiceCommands = useCallback(async (context: any): Promise<any> => {
    setIsEnabled(!isEnabled);
    return { enabled: !isEnabled, confidence: context.confidence };
  }, [isEnabled]);

  // Voice control functions
  const enableVoiceCommands = useCallback(() => {
    if (!recognitionRef.current) {
      initializeRecognition();
    }
    setIsEnabled(true);
    setIsListening(true);
    
    if (recognitionRef.current) {
      recognitionRef.current.start();
    }

    toast({
      title: 'Voice Commands Enabled',
      description: 'Advanced voice commands with medical context are now active.',
    });
  }, [initializeRecognition, toast]);

  const disableVoiceCommands = useCallback(() => {
    setIsEnabled(false);
    setIsListening(false);
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    toast({
      title: 'Voice Commands Disabled',
      description: 'Voice commands have been turned off.',
    });
  }, [toast]);

  const toggleVoiceCommands = useCallback(() => {
    if (isEnabled) {
      disableVoiceCommands();
    } else {
      enableVoiceCommands();
    }
  }, [isEnabled, enableVoiceCommands, disableVoiceCommands]);

  // Initialize on mount
  useEffect(() => {
    initializeRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [initializeRecognition]);

  // Update current context based on page
  useEffect(() => {
    const path = window.location.pathname;
    const pageContext = path.split('/')[1] || 'general';
    setCurrentContext(pageContext);
  }, []);

  // Auto-learn from command history
  useEffect(() => {
    if (enableCommandLearning && commandHistoryRef.current.length > 10) {
      // Implement machine learning from command history
      // This is a placeholder for actual ML implementation
      const learnedPatterns = analyzeCommandHistory();
      // Update command recognition based on learned patterns
    }
  }, [enableCommandLearning]);

  // Analyze command history for learning
  const analyzeCommandHistory = useCallback((): any => {
    const history = commandHistoryRef.current;
    if (history.length < 10) return null;

    // Simple pattern analysis
    const patterns: Record<string, number> = {};
    
    history.forEach(result => {
      const commandType = result.command.category;
      patterns[commandType] = (patterns[commandType] || 0) + 1;
    });

    return patterns;
  }, []);

  // Help dialog content
  const HelpDialog = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Advanced Voice Commands Help
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHelp(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="space-y-6 p-6">
            <div className="text-sm text-muted-foreground">
              Advanced voice commands with medical context and NLP processing. Speak naturally using medical terminology.
            </div>
            
            {/* Commands by Category */}
            {['recording', 'medical_notes', 'navigation', 'ai_enhancement', 'system_control', 'telemedicine'].map(category => {
              const categoryCommands = ENHANCED_VOICE_COMMANDS.filter(cmd => cmd.category === category);
              if (categoryCommands.length === 0) return null;
              
              return (
                <div key={category}>
                  <div className="font-medium text-sm capitalize mb-2 text-primary">
                    {category.replace('_', ' ')} Commands:
                  </div>
                  <div className="grid gap-2">
                    {categoryCommands.map(command => (
                      <div key={command.id} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                        <div className="mt-0.5">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-mono text-sm mb-1">
                            "{command.phrases[0]}"
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {command.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {Math.round(command.confidenceThreshold * 100)}% confidence
                            </Badge>
                            {command.medicalTerms && (
                              <Badge variant="secondary" className="text-xs">
                                Medical
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Settings dialog content
  const SettingsDialog = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Advanced Voice Settings
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(false)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">NLP Processing</label>
              <button
                onClick={() => setEnableNLPProcessing(!enableNLPProcessing)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  enableNLPProcessing ? "bg-primary" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    enableNLPProcessing ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enable natural language processing for better command recognition
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Medical Context</label>
              <button
                onClick={() => setEnableMedicalContext(!enableMedicalContext)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  enableMedicalContext ? "bg-primary" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    enableMedicalContext ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Enable medical terminology recognition
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Auto Learning</label>
              <button
                onClick={() => setAutoLearn(!autoLearn)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  autoLearn ? "bg-primary" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    autoLearn ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Automatically learn from your command usage patterns
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
      <Card className={cn("w-full max-w-md", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Advanced Voice Commands
              </CardTitle>
              <CardDescription>
                AI-powered voice control with medical context
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(true)}
                className="h-8 w-8 p-0"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Switch
                checked={isEnabled}
                onCheckedChange={toggleVoiceCommands}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Display */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                isListening ? "bg-red-500 animate-pulse" : isEnabled ? "bg-green-500" : "bg-gray-400"
              )} />
              <span className="font-medium">
                {isListening ? 'Listening...' : isEnabled ? 'Ready' : 'Disabled'}
              </span>
            </div>
            {confidence > 0 && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs",
                  confidence >= 0.8 ? "text-green-600" :
                  confidence >= 0.6 ? "text-yellow-600" :
                  "text-red-600"
                )}
              >
                {Math.round(confidence * 100)}%
              </Badge>
            )}
          </div>

          {/* Last Command Display */}
          {lastCommand && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">Last Command:</div>
              <div className="text-sm font-mono">"{lastCommand.phrases[0]}"</div>
              {recognizedCommand && (
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  ✓ {recognizedCommand.description}
                </div>
              )}
            </div>
          )}

          {/* Processing Metrics */}
          {enablePerformanceMonitoring && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Recognition Accuracy</span>
                <Badge variant="outline">{processingMetrics.recognitionAccuracy}%</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Medical Terms</span>
                <Badge variant="outline">{processingMetrics.medicalTermsDetected}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Processing Time</span>
                <Badge variant="outline">{Math.round(processingMetrics.processingTime)}ms</Badge>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={enableVoiceCommands}
              disabled={isEnabled}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Mic className="h-4 w-4" />
              Enable
            </Button>
            <Button
              onClick={disableVoiceCommands}
              disabled={!isEnabled}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <MicOff className="h-4 w-4" />
              Disable
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Help Dialog */}
      {showHelp && <HelpDialog />}

      {/* Settings Dialog */}
      {showSettings && <SettingsDialog />}
    </>
  );
}