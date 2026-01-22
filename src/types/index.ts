export interface VoiceCommand {
  id: string
  category: CommandCategory
  action: string
  description: string
  confidence: number
  timestamp: Date
  entities?: Record<string, any>
  context?: CommandContext
}

export interface CommandContext {
  currentPage?: string
  previousCommands: string[]
  userPreferences: UserPreferences
  sessionId: string
}

export interface UserPreferences {
  language: string
  accent: string
  wakeWord: string
  microphoneSensitivity: number
  voiceSpeed: number
  commandAliases: Record<string, string>
  enabledCategories: string[]
  audioFeedback: boolean
  visualFeedback: boolean
}

export interface VoiceRecognitionConfig {
  wakeWord: string
  languages: string[]
  confidenceThreshold: number
  timeoutMs: number
  noiseThreshold: number
  sampleRate: number
  bufferSize: number
}

export interface ElementDescriptor {
  tagName: string
  textContent?: string
  ariaLabel?: string
  dataCommand?: string
  dataTestId?: string
  id?: string
  className?: string
  role?: string
  type?: string
}

export interface WorkflowStep {
  id: string
  type: 'navigation' | 'click' | 'input' | 'wait' | 'confirm' | 'api' | 'condition'
  target?: ElementDescriptor
  action?: string
  parameters?: Record<string, any>
  timeout?: number
  retryCount?: number
  confirmationRequired?: boolean
  nextStep?: string
  condition?: {
    type: 'element_exists' | 'text_matches' | 'api_response'
    expected: any
  }
}

export interface Workflow {
  id: string
  name: string
  description: string
  category: string
  steps: WorkflowStep[]
  requiresConfirmation: boolean
  rollbackSteps?: WorkflowStep[]
}

export interface PatientInfo {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  phoneNumber: string
  email?: string
  address?: string
  insuranceNumber?: string
  medicalRecordNumber?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
}

export interface CheckInWorkflow extends PatientInfo {
  appointmentId?: string
  visitType: 'routine' | 'urgent' | 'follow-up' | 'new-patient'
  copay?: number
  insuranceVerified: boolean
  signatureRequired: boolean
  signatureData?: string
  timestamp: Date
  status: 'waiting' | 'checked-in' | 'cancelled'
}

export interface VoiceFeedback {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
  speak?: boolean
}

export interface SecurityConfig {
  encryptAudio: boolean
  localProcessing: boolean
  requireAuthentication: boolean
  dataRetentionDays: number
  sensitiveActions: string[]
  confirmationRequired: boolean
}

export interface AnalyticsEvent {
  eventType: 'command_executed' | 'error_occurred' | 'workflow_completed' | 'user_feedback'
  commandId: string
  success: boolean
  latency: number
  confidence: number
  timestamp: Date
  userId?: string
  sessionId: string
  metadata?: Record<string, any>
}

export type CommandCategory = 
  | 'navigation'
  | 'ui-action'
  | 'workflow'
  | 'accessibility'
  | 'system'
  | 'healthcare'
  | 'patient-management'

export interface VoiceControlState {
  isListening: boolean
  isProcessing: boolean
  isMuted: boolean
  wakeWordDetected: boolean
  currentCommand?: VoiceCommand
  recentCommands: VoiceCommand[]
  errors: Error[]
  config: VoiceRecognitionConfig
  preferences: UserPreferences
}

export interface ErrorHandler {
  type: 'recognition' | 'parsing' | 'execution' | 'network' | 'permission'
  message: string
  retryable: boolean
  fallback?: string
  code?: string
}

export interface CommandAlias {
  original: string
  alias: string
  confidence: number
}