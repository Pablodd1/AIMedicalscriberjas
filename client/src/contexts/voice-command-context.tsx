import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface VoiceCommand {
  id: string;
  phrase: string[];
  action: string;
  description: string;
  category: 'recording' | 'navigation' | 'notes' | 'telemedicine' | 'intake' | 'general';
  page?: string[];
  icon?: string;
}

interface VoiceCommandState {
  isEnabled: boolean;
  isListening: boolean;
  lastCommand: string | null;
  recognizedCommand: VoiceCommand | null;
  confidence: number;
  supportedCommands: VoiceCommand[];
}

interface VoiceCommandContextType extends VoiceCommandState {
  enableVoiceCommands: () => void;
  disableVoiceCommands: () => void;
  toggleVoiceCommands: () => void;
  startListening: () => void;
  stopListening: () => void;
  addCustomCommand: (command: VoiceCommand) => void;
  removeCustomCommand: (id: string) => void;
  executeCommand: (command: string) => boolean;
}

// Global voice commands available across the application
const GLOBAL_VOICE_COMMANDS: VoiceCommand[] = [
  // Recording Commands
  {
    id: 'start_recording',
    phrase: ['start recording', 'begin recording', 'record now', 'start consultation'],
    action: 'START_RECORDING',
    description: 'Start recording consultation',
    category: 'recording',
    page: ['notes', 'quick-notes', 'telemedicine', 'patient-intake'],
    icon: 'Mic'
  },
  {
    id: 'stop_recording',
    phrase: ['stop recording', 'end recording', 'stop consultation', 'finish recording'],
    action: 'STOP_RECORDING',
    description: 'Stop recording consultation',
    category: 'recording',
    page: ['notes', 'quick-notes', 'telemedicine', 'patient-intake'],
    icon: 'StopCircle'
  },
  {
    id: 'pause_recording',
    phrase: ['pause recording', 'pause'],
    action: 'PAUSE_RECORDING',
    description: 'Pause recording',
    category: 'recording',
    page: ['notes', 'quick-notes', 'telemedicine'],
    icon: 'Pause'
  },
  {
    id: 'resume_recording',
    phrase: ['resume recording', 'resume', 'continue recording'],
    action: 'RESUME_RECORDING',
    description: 'Resume recording',
    category: 'recording',
    page: ['notes', 'quick-notes', 'telemedicine'],
    icon: 'Play'
  },

  // Notes Commands
  {
    id: 'generate_notes',
    phrase: ['generate notes', 'create notes', 'make soap notes', 'generate soap'],
    action: 'GENERATE_NOTES',
    description: 'Generate medical notes from transcript',
    category: 'notes',
    page: ['notes', 'quick-notes', 'telemedicine'],
    icon: 'FileText'
  },
  {
    id: 'save_notes',
    phrase: ['save notes', 'save', 'save document'],
    action: 'SAVE_NOTES',
    description: 'Save current notes',
    category: 'notes',
    page: ['notes', 'quick-notes'],
    icon: 'Save'
  },
  {
    id: 'preview_notes',
    phrase: ['preview notes', 'show preview', 'preview'],
    action: 'PREVIEW_NOTES',
    description: 'Preview medical notes',
    category: 'notes',
    page: ['notes', 'quick-notes'],
    icon: 'Eye'
  },
  {
    id: 'download_notes',
    phrase: ['download notes', 'download document', 'export notes'],
    action: 'DOWNLOAD_NOTES',
    description: 'Download notes as document',
    category: 'notes',
    page: ['notes', 'quick-notes'],
    icon: 'Download'
  },

  // Navigation Commands
  {
    id: 'go_to_notes',
    phrase: ['go to notes', 'open notes', 'medical notes'],
    action: 'NAVIGATE_NOTES',
    description: 'Navigate to medical notes page',
    category: 'navigation',
    icon: 'FileText'
  },
  {
    id: 'go_to_patients',
    phrase: ['go to patients', 'open patients', 'show patients'],
    action: 'NAVIGATE_PATIENTS',
    description: 'Navigate to patients page',
    category: 'navigation',
    icon: 'Users'
  },
  {
    id: 'go_to_appointments',
    phrase: ['go to appointments', 'open appointments', 'show appointments'],
    action: 'NAVIGATE_APPOINTMENTS',
    description: 'Navigate to appointments page',
    category: 'navigation',
    icon: 'Calendar'
  },
  {
    id: 'go_to_dashboard',
    phrase: ['go to dashboard', 'open dashboard', 'home'],
    action: 'NAVIGATE_DASHBOARD',
    description: 'Navigate to dashboard',
    category: 'navigation',
    icon: 'Activity'
  },

  // Telemedicine Commands
  {
    id: 'start_video',
    phrase: ['start video call', 'begin video', 'start consultation'],
    action: 'START_VIDEO_CALL',
    description: 'Start video consultation',
    category: 'telemedicine',
    page: ['telemedicine'],
    icon: 'Video'
  },
  {
    id: 'end_video_call',
    phrase: ['end video call', 'end call', 'hang up', 'disconnect'],
    action: 'END_VIDEO_CALL',
    description: 'End video consultation',
    category: 'telemedicine',
    page: ['telemedicine'],
    icon: 'Phone'
  },

  // Intake Commands
  {
    id: 'start_intake',
    phrase: ['start intake', 'begin intake', 'new intake form'],
    action: 'START_INTAKE',
    description: 'Start patient intake form',
    category: 'intake',
    page: ['patient-intake'],
    icon: 'ClipboardList'
  },
  {
    id: 'voice_intake',
    phrase: ['voice intake', 'voice form', 'fill with voice'],
    action: 'VOICE_INTAKE',
    description: 'Start voice-based intake',
    category: 'intake',
    page: ['patient-intake'],
    icon: 'Mic'
  },

  // General Commands
  {
    id: 'help',
    phrase: ['help', 'what can i say', 'voice commands', 'commands'],
    action: 'SHOW_HELP',
    description: 'Show available voice commands',
    category: 'general',
    icon: 'HelpCircle'
  },
  {
    id: 'toggle_voice',
    phrase: ['toggle voice commands', 'enable voice', 'disable voice'],
    action: 'TOGGLE_VOICE',
    description: 'Toggle voice commands on/off',
    category: 'general',
    icon: 'Mic'
  },
  {
    id: 'clear_form',
    phrase: ['clear form', 'reset form', 'start over'],
    action: 'CLEAR_FORM',
    description: 'Clear current form',
    category: 'general',
    page: ['patient-intake', 'notes', 'quick-notes'],
    icon: 'RefreshCw'
  }
];

const VoiceCommandContext = createContext<VoiceCommandContextType | undefined>(undefined);

export const VoiceCommandProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [recognizedCommand, setRecognizedCommand] = useState<VoiceCommand | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [supportedCommands, setSupportedCommands] = useState<VoiceCommand[]>(GLOBAL_VOICE_COMMANDS);

  const recognitionRef = useRef<any>(null);
  const currentPageRef = useRef<string>('');

  // Get current page from URL
  useEffect(() => {
    const path = window.location.pathname;
    const pageName = path.split('/')[1] || 'dashboard';
    currentPageRef.current = pageName;
  }, []);

  // Filter commands based on current page
  const getAvailableCommands = useCallback(() => {
    const currentPage = currentPageRef.current;
    return supportedCommands.filter(cmd => 
      !cmd.page || cmd.page.includes(currentPage) || cmd.category === 'general'
    );
  }, [supportedCommands]);

  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript.toLowerCase().trim();
        
        if (event.results[last].isFinal) {
          setLastCommand(transcript);
          processVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        let errorMessage = 'Voice recognition error occurred';
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage = 'Microphone not available. Please check permissions.';
            break;
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access.';
            break;
          case 'network':
            errorMessage = 'Network error. Please check your connection.';
            break;
        }
        
        toast({
          title: "Voice Command Error",
          description: errorMessage,
          variant: "destructive"
        });
      };

      recognition.onend = () => {
        setIsListening(false);
        // Auto-restart if still enabled
        if (isEnabled) {
          setTimeout(() => {
            if (isEnabled) {
              recognition.start();
              setIsListening(true);
            }
          }, 1000);
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isEnabled, toast]);

  // Process voice command
  const processVoiceCommand = useCallback((transcript: string) => {
    const availableCommands = getAvailableCommands();
    
    for (const command of availableCommands) {
      for (const phrase of command.phrase) {
        if (transcript.includes(phrase.toLowerCase())) {
          setRecognizedCommand(command);
          setConfidence(0.9);
          executeVoiceAction(command.action);
          return true;
        }
      }
    }
    
    return false;
  }, [getAvailableCommands]);

  // Execute voice action
  const executeVoiceAction = useCallback((action: string) => {
    console.log(`Executing voice command: ${action}`);
    
    try {
      switch (action) {
        // Recording Actions
        case 'START_RECORDING':
          if (window.startRecording) window.startRecording();
          break;
        case 'STOP_RECORDING':
          if (window.stopRecording) window.stopRecording();
          break;
        case 'PAUSE_RECORDING':
          if (window.pauseRecording) window.pauseRecording();
          break;
        case 'RESUME_RECORDING':
          if (window.resumeRecording) window.resumeRecording();
          break;

        // Notes Actions
        case 'GENERATE_NOTES':
          if (window.generateNotes) window.generateNotes();
          break;
        case 'SAVE_NOTES':
          if (window.saveNotes) window.saveNotes();
          break;
        case 'PREVIEW_NOTES':
          if (window.previewNotes) window.previewNotes();
          break;
        case 'DOWNLOAD_NOTES':
          if (window.downloadNotes) window.downloadNotes();
          break;

        // Navigation Actions
        case 'NAVIGATE_NOTES':
          window.location.href = '/notes';
          break;
        case 'NAVIGATE_PATIENTS':
          window.location.href = '/patients';
          break;
        case 'NAVIGATE_APPOINTMENTS':
          window.location.href = '/appointments';
          break;
        case 'NAVIGATE_DASHBOARD':
          window.location.href = '/dashboard';
          break;

        // Telemedicine Actions
        case 'START_VIDEO_CALL':
          if (window.startVideoCall) window.startVideoCall();
          break;
        case 'END_VIDEO_CALL':
          if (window.endVideoCall) window.endVideoCall();
          break;

        // Intake Actions
        case 'START_INTAKE':
          if (window.startIntake) window.startIntake();
          break;
        case 'VOICE_INTAKE':
          if (window.voiceIntake) window.voiceIntake();
          break;

        // General Actions
        case 'SHOW_HELP':
          showVoiceCommandHelp();
          break;
        case 'TOGGLE_VOICE':
          toggleVoiceCommands();
          break;
        case 'CLEAR_FORM':
          if (window.clearForm) window.clearForm();
          break;

        default:
          console.warn(`Unknown voice action: ${action}`);
      }

      toast({
        title: "Voice Command Executed",
        description: `${recognizedCommand?.description || action}`,
        duration: 2000
      });
    } catch (error) {
      console.error('Error executing voice command:', error);
      toast({
        title: "Voice Command Failed",
        description: "Failed to execute voice command",
        variant: "destructive"
      });
    }
  }, [recognizedCommand, toast]);

  // Show voice command help
  const showVoiceCommandHelp = useCallback(() => {
    const availableCommands = getAvailableCommands();
    const commandList = availableCommands
      .map(cmd => `• "${cmd.phrase[0]}" - ${cmd.description}`)
      .join('\n');
    
    toast({
      title: "Available Voice Commands",
      description: commandList,
      duration: 10000
    });
  }, [getAvailableCommands, toast]);

  // Voice control functions
  const enableVoiceCommands = useCallback(() => {
    if (!recognitionRef.current) {
      initializeRecognition();
    }
    setIsEnabled(true);
    toast({
      title: "Voice Commands Enabled",
      description: "You can now use voice commands to control the application.",
    });
  }, [initializeRecognition, toast]);

  const disableVoiceCommands = useCallback(() => {
    setIsEnabled(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    toast({
      title: "Voice Commands Disabled",
      description: "Voice commands have been turned off.",
    });
  }, [toast]);

  const toggleVoiceCommands = useCallback(() => {
    if (isEnabled) {
      disableVoiceCommands();
    } else {
      enableVoiceCommands();
    }
  }, [isEnabled, enableVoiceCommands, disableVoiceCommands]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const addCustomCommand = useCallback((command: VoiceCommand) => {
    setSupportedCommands(prev => [...prev, command]);
    toast({
      title: "Custom Voice Command Added",
      description: `"${command.phrase[0]}" has been added to voice commands.`,
    });
  }, [toast]);

  const removeCustomCommand = useCallback((id: string) => {
    setSupportedCommands(prev => prev.filter(cmd => cmd.id !== id));
    toast({
      title: "Voice Command Removed",
      description: "Custom voice command has been removed.",
    });
  }, [toast]);

  const executeCommand = useCallback((command: string): boolean => {
    return processVoiceCommand(command.toLowerCase());
  }, [processVoiceCommand]);

  // Auto-start if enabled
  useEffect(() => {
    if (isEnabled && recognitionRef.current) {
      startListening();
    }
  }, [isEnabled, startListening]);

  // Initialize recognition on mount
  useEffect(() => {
    initializeRecognition();
  }, [initializeRecognition]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const value: VoiceCommandContextType = {
    isEnabled,
    isListening,
    lastCommand,
    recognizedCommand,
    confidence,
    supportedCommands,
    enableVoiceCommands,
    disableVoiceCommands,
    toggleVoiceCommands,
    startListening,
    stopListening,
    addCustomCommand,
    removeCustomCommand,
    executeCommand,
  };

  return (
    <VoiceCommandContext.Provider value={value}>
      {children}
    </VoiceCommandContext.Provider>
  );
};

export const useVoiceCommands = () => {
  const context = useContext(VoiceCommandContext);
  if (context === undefined) {
    throw new Error('useVoiceCommands must be used within a VoiceCommandProvider');
  }
  return context;
};

// Extend global Window interface for voice command callbacks
declare global {
  interface Window {
    startRecording?: () => void;
    stopRecording?: () => void;
    pauseRecording?: () => void;
    resumeRecording?: () => void;
    generateNotes?: () => void;
    saveNotes?: () => void;
    previewNotes?: () => void;
    downloadNotes?: () => void;
    startVideoCall?: () => void;
    endVideoCall?: () => void;
    startIntake?: () => void;
    voiceIntake?: () => void;
    clearForm?: () => void;
  }
}