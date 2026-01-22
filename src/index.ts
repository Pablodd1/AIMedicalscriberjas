export { VoiceRecognitionEngine } from './core/VoiceRecognitionEngine'
export { NaturalLanguageProcessor } from './core/NaturalLanguageProcessor'
export { ElementDetector } from './core/ElementDetector'
export { ActionExecutor } from './core/ActionExecutor'
export { HealthcareWorkflowEngine } from './core/HealthcareWorkflowEngine'

export { 
  VoiceControl, 
  VoiceControlPanel, 
  useVoiceControl 
} from './components'

export type {
  VoiceCommand,
  VoiceRecognitionConfig,
  UserPreferences,
  ElementDescriptor,
  Workflow,
  WorkflowStep,
  PatientInfo,
  CheckInWorkflow,
  VoiceFeedback,
  CommandCategory,
  VoiceControlState,
  ErrorHandler
} from './types'