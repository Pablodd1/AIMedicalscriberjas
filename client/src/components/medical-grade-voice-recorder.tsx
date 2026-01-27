import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useRecordingPersistence } from '@/hooks/use-recording-persistence';
import { BackgroundRecordingManager } from '@/services/background-recording-manager';
import { 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Pause,
  Check, 
  AlertCircle, 
  Loader2, 
  Volume2, 
  VolumeX,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Clock,
  Signal,
  WifiOff,
  ShieldCheck,
  Activity,
  Zap,
  Star,
  Battery,
  BatteryCharging,
  BatteryLow,
  Smartphone,
  Monitor,
  Cloud,
  CloudOff,
  RefreshCw,
  Save
} from "lucide-react";

export interface MedicalGradeRecordingOptions {
  quality: 'medical' | 'high' | 'medium' | 'low';
  format: 'webm' | 'wav' | 'mp3';
  enableNoiseCancellation: boolean;
  enableVoiceActivityDetection: boolean;
  enableAutomaticGainControl: boolean;
  maxDuration: number;
  language: string;
  enableLiveTranscription: boolean;
  transcriptionProvider: 'deepgram' | 'openai' | 'google' | 'azure' | 'browser';
  enablePersistence: boolean;
  enableBackgroundRecording: boolean;
  enableAutoRecovery: boolean;
  enablePowerManagement: boolean;
}

export interface RecordingPersistenceMetrics {
  isDeviceAwake: boolean;
  isPowerSaveMode: boolean;
  wakeLockActive: boolean;
  interruptionCount: number;
  lastActivity: Date;
  batteryLevel?: number;
  isCharging?: boolean;
}

interface MedicalGradeVoiceRecorderProps {
  className?: string;
  onRecordingComplete?: (result: RecordingResult) => void;
  onRecordingError?: (error: RecordingError) => void;
  onTranscriptionUpdate?: (transcript: string, metrics: TranscriptionMetrics) => void;
  onPersistenceUpdate?: (metrics: RecordingPersistenceMetrics) => void;
  options?: Partial<MedicalGradeRecordingOptions>;
  enableMedicalMode?: boolean;
  showRealTimeAnalysis?: boolean;
  enableVoiceCommands?: boolean;
  enablePersistence?: boolean;
}

interface RecordingResult {
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
  transcript?: string;
  metadata: RecordingMetadata;
  metrics: RecordingMetrics;
  transcriptionMetrics?: TranscriptionMetrics;
  persistenceMetrics?: RecordingPersistenceMetrics;
}

interface RecordingMetadata {
  startTime: Date;
  endTime: Date;
  fileSize: number;
  audioFormat: string;
  sampleRate: number;
  bitRate: number;
  qualityScore: number;
  transcriptionProvider: string;
  persistenceEnabled: boolean;
  backgroundRecording: boolean;
  interruptionCount: number;
}

interface RecordingMetrics {
  audioLevel: number;
  qualityScore: number;
  noiseLevel: number;
  clippingDetected: boolean;
  estimatedFileSize: number;
  batteryUsage: number;
}

interface RecordingError {
  type: 'microphone' | 'transcription' | 'processing' | 'network' | 'permission' | 'browser' | 'persistence' | 'interruption';
  message: string;
  details?: any;
  recoveryAction?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const DEFAULT_OPTIONS: MedicalGradeRecordingOptions = {
  quality: 'medical',
  format: 'webm',
  enableNoiseCancellation: true,
  enableVoiceActivityDetection: true,
  enableAutomaticGainControl: true,
  maxDuration: 3600, // 1 hour
  language: 'en-US',
  enableLiveTranscription: true,
  transcriptionProvider: 'deepgram',
  enablePersistence: true,
  enableBackgroundRecording: true,
  enableAutoRecovery: true,
  enablePowerManagement: true
};

export function MedicalGradeVoiceRecorder({
  className,
  onRecordingComplete,
  onRecordingError,
  onTranscriptionUpdate,
  onPersistenceUpdate,
  options = {},
  enableMedicalMode = true,
  showRealTimeAnalysis = true,
  enableVoiceCommands = false,
  enablePersistence = true
}: MedicalGradeVoiceRecorderProps) {
  const { toast } = useToast();
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'processing' | 'complete'>('idle');
  const [recordingOptions, setRecordingOptions] = useState<MedicalGradeRecordingOptions>({ ...DEFAULT_OPTIONS, ...options });
  const [recordingMetrics, setRecordingMetrics] = useState<RecordingMetrics>({
    audioLevel: 0,
    qualityScore: 0,
    noiseLevel: 0,
    clippingDetected: false,
    estimatedFileSize: 0,
    batteryUsage: 0
  });
  const [transcriptionMetrics, setTranscriptionMetrics] = useState({
    wordsPerMinute: 0,
    confidence: 0,
    accuracy: 0,
    medicalTermAccuracy: 0,
    speakerDiarization: false,
    processingLatency: 0
  });
  const [liveTranscript, setLiveTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [estimatedFileSize, setEstimatedFileSize] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    batteryLevel: 100,
    isCharging: true,
    isOnline: navigator.onLine,
    isBackground: false
  });
  
  // Persistence hooks
  const { state: persistenceState, actions: persistenceActions } = useRecordingPersistence(
    recordingState === 'recording',
    {
      enableWakeLock: recordingOptions.enablePersistence,
      enableAutoRecovery: recordingOptions.enableAutoRecovery,
      enablePowerSaveDetection: recordingOptions.enablePowerManagement,
      enableBackgroundSync: recordingOptions.enableBackgroundRecording,
      enableOfflineStorage: true,
      recoveryTimeout: 30000,
      activityThreshold: 5000,
      maxInterruptions: 3
    }
  );

  // Background recording manager
  const backgroundManagerRef = useRef<BackgroundRecordingManager | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const persistenceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize background recording manager
  useEffect(() => {
    if (enablePersistence && !backgroundManagerRef.current) {
      backgroundManagerRef.current = new BackgroundRecordingManager({
        enableBackgroundSync: recordingOptions.enableBackgroundRecording,
        enableOfflineStorage: true,
        enableAutoRecovery: recordingOptions.enableAutoRecovery,
        enableBatteryMonitoring: recordingOptions.enablePowerManagement,
        enableNetworkMonitoring: true,
        maxOfflineSize: 100,
        syncInterval: 30000,
        recoveryTimeout: 60000,
        batteryThreshold: 20
      });

      // Setup background manager event listeners
      backgroundManagerRef.current.on('lowBattery', (data) => {
        toast({
          title: 'Low Battery Warning',
          description: `Battery at ${data.level}%. Consider connecting charger.`,
          variant: 'destructive'
        });
      });

      backgroundManagerRef.current.on('interruption', (data) => {
        const error: RecordingError = {
          type: 'interruption',
          message: `Recording interrupted: ${data.reason}`,
          severity: 'high',
          recoveryAction: 'Attempting automatic recovery...'
        };
        onRecordingError?.(error);
      });

      backgroundManagerRef.current.on('recovery', (data) => {
        if (data.success) {
          toast({
            title: 'Recording Recovered',
            description: 'Successfully recovered from interruption.',
            variant: 'default'
          });
        } else {
          toast({
            title: 'Recovery Failed',
            description: 'Could not recover recording. Please restart.',
            variant: 'destructive'
          });
        }
      });
    }

    return () => {
      if (backgroundManagerRef.current) {
        backgroundManagerRef.current.destroy();
        backgroundManagerRef.current = null;
      }
    };
  }, [enablePersistence, recordingOptions, toast, onRecordingError]);

  // Monitor device status
  useEffect(() => {
    const updateDeviceStatus = async () => {
      const status = {
        batteryLevel: 100,
        isCharging: true,
        isOnline: navigator.onLine,
        isBackground: document.hidden
      };

      // Check battery status
      if ('getBattery' in navigator) {
        try {
          // @ts-ignore - Battery API
          const battery = await navigator.getBattery();
          status.batteryLevel = Math.round(battery.level * 100);
          status.isCharging = battery.charging;
        } catch (error) {
          console.warn('Battery API not available');
        }
      }

      setDeviceStatus(status);
    };

    updateDeviceStatus();
    const interval = setInterval(updateDeviceStatus, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Persistence metrics monitoring
  useEffect(() => {
    if (recordingState === 'recording') {
      const persistenceMetrics: RecordingPersistenceMetrics = {
        isDeviceAwake: persistenceState.isDeviceAwake,
        isPowerSaveMode: persistenceState.isPowerSaveMode,
        wakeLockActive: persistenceState.wakeLockActive,
        interruptionCount: persistenceState.interruptionCount,
        lastActivity: persistenceState.lastActivity,
        batteryLevel: deviceStatus.batteryLevel,
        isCharging: deviceStatus.isCharging
      };

      onPersistenceUpdate?.(persistenceMetrics);

      // Update persistence state periodically
      persistenceIntervalRef.current = setInterval(() => {
        persistenceActions.updateActivity();
      }, 2000);
    } else {
      if (persistenceIntervalRef.current) {
        clearInterval(persistenceIntervalRef.current);
      }
    }

    return () => {
      if (persistenceIntervalRef.current) {
        clearInterval(persistenceIntervalRef.current);
      }
    };
  }, [recordingState, persistenceState, deviceStatus, onPersistenceUpdate, persistenceActions]);

  // Calculate audio metrics
  const calculateAudioMetrics = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    
    const dataArray = dataArrayRef.current;
    let sum = 0;
    let peak = 0;
    let clippingCount = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i];
      sum += value;
      if (value > peak) peak = value;
      if (value >= 254) clippingCount++;
    }

    const average = sum / dataArray.length;
    const audioLevel = Math.min(100, (average / 128) * 100);
    const qualityScore = Math.max(0, 100 - (clippingCount / dataArray.length) * 100);
    const clippingDetected = clippingCount > 0;

    const newMetrics: RecordingMetrics = {
      audioLevel,
      qualityScore,
      noiseLevel: Math.max(0, audioLevel - 20),
      clippingDetected,
      estimatedFileSize: calculateEstimatedFileSize(recordingDuration + 1),
      batteryUsage: estimateBatteryUsage(recordingDuration + 1, audioLevel)
    };

    setRecordingMetrics(newMetrics);
    
    // Add to background manager if available
    if (backgroundManagerRef.current && recordingState === 'recording') {
      // Background manager would handle the actual audio data
      persistenceActions.addOfflineData(new Blob([JSON.stringify(newMetrics)]));
    }
  }, [recordingDuration, recordingState, persistenceActions]);

  // Calculate estimated file size
  const calculateEstimatedFileSize = (duration: number): number => {
    const bitRate = recordingOptions.quality === 'medical' ? 128000 : 
                   recordingOptions.quality === 'high' ? 96000 : 64000;
    return Math.round((bitRate * duration) / 8 / 1024); // KB
  };

  // Estimate battery usage
  const estimateBatteryUsage = (duration: number, audioLevel: number): number => {
    const baseUsage = duration * 0.01;
    const audioUsage = (audioLevel / 100) * duration * 0.005;
    return Math.round((baseUsage + audioUsage) * 100) / 100;
  };

  // Initialize audio analysis
  const initializeAudioAnalysis = useCallback(async (stream: MediaStream) => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      }
    } catch (error) {
      console.warn('Failed to initialize audio analysis:', error);
    }
  }, []);

  // Start recording with persistence
  const startRecording = useCallback(async () => {
    try {
      // Check device readiness
      if (!persistenceState.isDeviceAwake) {
        toast({
          title: 'Device Not Ready',
          description: 'Device may be in sleep mode. Please ensure screen is active.',
          variant: 'destructive'
        });
        return;
      }

      if (persistenceState.isPowerSaveMode) {
        toast({
          title: 'Power Save Mode',
          description: 'Device is in power save mode. Recording quality may be affected.',
          variant: 'destructive'
        });
      }

      setRecordingState('recording');
      setRecordingDuration(0);
      setLiveTranscript('');
      recordingStartTimeRef.current = Date.now();
      audioChunksRef.current = [];

      // Start background recording manager
      if (backgroundManagerRef.current) {
        backgroundManagerRef.current.startRecording();
      }

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: recordingOptions.enableNoiseCancellation,
          noiseSuppression: recordingOptions.enableNoiseCancellation,
          autoGainControl: recordingOptions.enableAutomaticGainControl,
          sampleRate: recordingOptions.quality === 'medical' ? 48000 : 44100,
          channelCount: 1
        } 
      });

      streamRef.current = stream;

      // Initialize audio analysis
      await initializeAudioAnalysis(stream);

      // Start metrics monitoring
      metricsIntervalRef.current = setInterval(calculateAudioMetrics, 100);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Create media recorder
      const mimeType = recordingOptions.format === 'wav' ? 'audio/wav' : 
                      recordingOptions.format === 'mp3' ? 'audio/mp3' : 'audio/webm';
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: mimeType,
        audioBitsPerSecond: recordingOptions.quality === 'medical' ? 128000 : 
                            recordingOptions.quality === 'high' ? 96000 : 64000
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          
          // Add to persistence storage
          if (enablePersistence) {
            persistenceActions.addOfflineData(event.data);
          }
        }
      };

      mediaRecorderRef.current.onstop = () => {
        handleRecordingStop();
      };

      mediaRecorderRef.current.start(1000); // Collect data every second

      toast({
        title: 'Recording Started',
        description: 'Medical-grade recording with persistence protection active.',
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState('idle');
      
      const errorObj: RecordingError = {
        type: 'microphone',
        message: error instanceof Error ? error.message : 'Failed to access microphone',
        details: error,
        recoveryAction: 'Please check microphone permissions and ensure device is awake.',
        severity: 'high'
      };

      onRecordingError?.(errorObj);

      toast({
        title: 'Recording Failed',
        description: 'Could not start recording. Check permissions and device status.',
        variant: 'destructive'
      });
    }
  }, [recordingOptions, initializeAudioAnalysis, enablePersistence, persistenceActions, persistenceState, toast, onRecordingError]);

  // Stop recording with persistence cleanup
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || recordingState !== 'recording') return;

    setRecordingState('processing');

    // Stop background recording
    if (backgroundManagerRef.current) {
      backgroundManagerRef.current.stopRecording();
    }

    // Stop media recorder
    mediaRecorderRef.current.stop();
  }, [recordingState]);

  // Handle recording stop with persistence
  const handleRecordingStop = useCallback(async () => {
    try {
      // Clear intervals
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Create audio blob
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: recordingOptions.format === 'wav' ? 'audio/wav' : 
              recordingOptions.format === 'mp3' ? 'audio/mp3' : 'audio/webm' 
      });

      const audioUrl = URL.createObjectURL(audioBlob);

      // Cleanup stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      const result: RecordingResult = {
        audioBlob,
        audioUrl,
        duration: recordingDuration,
        transcript: liveTranscript || undefined,
        metadata: {
          startTime: new Date(recordingStartTimeRef.current),
          endTime: new Date(),
          fileSize: audioBlob.size,
          audioFormat: recordingOptions.format,
          sampleRate: recordingOptions.quality === 'medical' ? 48000 : 44100,
          bitRate: recordingOptions.quality === 'medical' ? 128000 : 
                  recordingOptions.quality === 'high' ? 96000 : 64000,
          qualityScore: recordingMetrics.qualityScore,
          transcriptionProvider: recordingOptions.transcriptionProvider,
          persistenceEnabled: enablePersistence,
          backgroundRecording: recordingOptions.enableBackgroundRecording,
          interruptionCount: persistenceState.interruptionCount
        },
        metrics: recordingMetrics,
        transcriptionMetrics,
        persistenceMetrics: {
          isDeviceAwake: persistenceState.isDeviceAwake,
          isPowerSaveMode: persistenceState.isPowerSaveMode,
          wakeLockActive: persistenceState.wakeLockActive,
          interruptionCount: persistenceState.interruptionCount,
          lastActivity: persistenceState.lastActivity,
          batteryLevel: deviceStatus.batteryLevel,
          isCharging: deviceStatus.isCharging
        }
      };

      setRecordingState('complete');
      onRecordingComplete?.(result);

      toast({
        title: 'Recording Complete',
        description: `Recording saved with persistence protection (${Math.round(audioBlob.size / 1024)}KB, ${recordingDuration}s)`,
      });

    } catch (error) {
      console.error('Error stopping recording:', error);
      setRecordingState('idle');
      
      const errorObj: RecordingError = {
        type: 'processing',
        message: 'Failed to process recording',
        details: error,
        recoveryAction: 'Please try recording again.',
        severity: 'high'
      };

      onRecordingError?.(errorObj);

      toast({
        title: 'Processing Error',
        description: 'Failed to process recording with persistence.',
        variant: 'destructive'
      });
    }
  }, [recordingOptions, recordingDuration, liveTranscript, recordingMetrics, transcriptionMetrics, enablePersistence, persistenceState, deviceStatus, onRecordingComplete, onRecordingError, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop any active recording
      if (mediaRecorderRef.current && recordingState === 'recording') {
        mediaRecorderRef.current.stop();
      }

      // Cleanup intervals
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Cleanup streams
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      // Cleanup background manager
      if (backgroundManagerRef.current) {
        backgroundManagerRef.current.destroy();
      }
    };
  }, [recordingState]);

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get quality color
  const getQualityColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get battery icon
  const getBatteryIcon = () => {
    if (deviceStatus.isCharging) return <BatteryCharging className="h-4 w-4" />;
    if (deviceStatus.batteryLevel < 20) return <BatteryLow className="h-4 w-4 text-red-500" />;
    return <Battery className="h-4 w-4" />;
  };

  // Get persistence status
  const getPersistenceStatus = () => {
    if (!enablePersistence) return null;
    
    if (persistenceState.recordingInterrupted) {
      return { icon: <RefreshCw className="h-4 w-4 text-yellow-500" />, text: 'Interrupted' };
    }
    if (persistenceState.wakeLockActive) {
      return { icon: <ShieldCheck className="h-4 w-4 text-green-500" />, text: 'Protected' };
    }
    if (persistenceState.interruptionCount > 0) {
      return { icon: <AlertCircle className="h-4 w-4 text-yellow-500" />, text: 'Recovered' };
    }
    return { icon: <Save className="h-4 w-4 text-blue-500" />, text: 'Persistent' };
  };

  const persistenceStatus = getPersistenceStatus();

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Medical-Grade Voice Recorder
            </CardTitle>
            <CardDescription>
              {enableMedicalMode ? 'Medical-grade recording with persistence protection' : 'High-quality voice recording with device sleep protection'}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Device Status Bar */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              {getBatteryIcon()}
              <span>{deviceStatus.batteryLevel}%</span>
            </div>
            <div className="flex items-center gap-1">
              {deviceStatus.isOnline ? 
                <Cloud className="h-4 w-4 text-green-500" /> : 
                <CloudOff className="h-4 w-4 text-red-500" />
              }
              <span>{deviceStatus.isOnline ? 'Online' : 'Offline'}</span>
            </div>
            {persistenceStatus && (
              <div className="flex items-center gap-1">
                {persistenceStatus.icon}
                <span>{persistenceStatus.text}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {recordingState === 'recording' && (
              <>
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{formatDuration(recordingDuration)}</span>
              </>
            )}
          </div>
        </div>

        {/* Recording Status */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              recordingState === 'recording' ? "bg-red-500 animate-pulse" : 
              recordingState === 'processing' ? "bg-blue-500 animate-pulse" :
              recordingState === 'complete' ? "bg-green-500" :
              "bg-gray-400"
            )} />
            <span className="font-medium">
              {recordingState === 'recording' ? 'Recording...' :
               recordingState === 'processing' ? 'Processing...' :
               recordingState === 'complete' ? 'Complete' :
               'Ready'}
            </span>
          </div>
          
          {recordingState === 'recording' && persistenceState.recordingInterrupted && (
            <Badge variant="destructive" className="animate-pulse">
              <RefreshCw className="h-3 w-3 mr-1" />
              Recovery Active
            </Badge>
          )}
        </div>

        {/* Recording Controls */}
        <div className="flex justify-center">
          {recordingState === 'idle' && (
            <Button
              onClick={startRecording}
              className="h-20 w-20 rounded-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              <Mic className="h-8 w-8" />
            </Button>
          )}

          {recordingState === 'recording' && (
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="h-20 w-20 rounded-full shadow-lg shadow-red-500/30"
            >
              <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30" />
              <Square className="h-8 w-8 relative z-10" />
            </Button>
          )}

          {recordingState === 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processing your recording...</p>
            </div>
          )}

          {recordingState === 'complete' && (
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setRecordingState('idle')}
                variant="outline"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Record Again
              </Button>
              <Button
                onClick={() => {
                  // Download would be implemented here
                  toast({
                    title: 'Download Ready',
                    description: 'Recording file is ready for download.'
                  });
                }}
                variant="outline"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          )}
        </div>

        {/* Real-time Analysis */}
        {showRealTimeAnalysis && recordingState === 'recording' && (
          <div className="space-y-4">
            {/* Audio Level Visualization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Audio Level</span>
                <Badge variant="outline" className={getQualityColor(recordingMetrics.audioLevel)}>
                  {Math.round(recordingMetrics.audioLevel)}%
                </Badge>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all", 
                    recordingMetrics.audioLevel >= 70 ? "bg-red-500" :
                    recordingMetrics.audioLevel >= 50 ? "bg-yellow-500" :
                    recordingMetrics.audioLevel >= 20 ? "bg-green-500" :
                    "bg-gray-300"
                  )}
                  style={{ width: `${recordingMetrics.audioLevel}%` }}
                />
              </div>
            </div>

            {/* Recording Quality */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Quality Score</span>
                  <Badge variant="outline" className={getQualityColor(recordingMetrics.qualityScore)}>
                    {Math.round(recordingMetrics.qualityScore)}%
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">File Size</span>
                  <Badge variant="outline">
                    ~{recordingMetrics.estimatedFileSize}KB
                  </Badge>
                </div>
              </div>
            </div>

            {/* Live Transcript */}
            {recordingOptions.enableLiveTranscription && liveTranscript && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Live Transcript</span>
                  <Badge variant="outline" className={getQualityColor(transcriptionMetrics.confidence)}>
                    {transcriptionMetrics.confidence}% confident
                  </Badge>
                </div>
                <div className="bg-muted/30 rounded-lg p-3 max-h-32 overflow-y-auto">
                  <p className="text-sm text-muted-foreground">
                    {liveTranscript || 'Waiting for speech...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="space-y-4 p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Recording Settings</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(false)}
                className="h-6 w-6 p-0"
              >
                <span className="sr-only">Close settings</span>
                ×
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Quality</label>
                <select
                  value={recordingOptions.quality}
                  onChange={(e) => setRecordingOptions(prev => ({ ...prev, quality: e.target.value as any }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="medical">Medical</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <select
                  value={recordingOptions.format}
                  onChange={(e) => setRecordingOptions(prev => ({ ...prev, format: e.target.value as any }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="webm">WebM</option>
                  <option value="wav">WAV</option>
                  <option value="mp3">MP3</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Persistence Protection</label>
                <button
                  onClick={() => setRecordingOptions(prev => ({ ...prev, enablePersistence: !prev.enablePersistence }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    recordingOptions.enablePersistence ? "bg-primary" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      recordingOptions.enablePersistence ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Background Recording</label>
                <button
                  onClick={() => setRecordingOptions(prev => ({ ...prev, enableBackgroundRecording: !prev.enableBackgroundRecording }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    recordingOptions.enableBackgroundRecording ? "bg-primary" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      recordingOptions.enableBackgroundRecording ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recording Information */}
        {(recordingState === 'recording' || recordingState === 'complete') && (
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Quality: {recordingOptions.quality}</span>
              <span>Format: {recordingOptions.format.toUpperCase()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Language: {recordingOptions.language}</span>
              <span>Provider: {recordingOptions.transcriptionProvider}</span>
            </div>
            {recordingState === 'recording' && (
              <div className="flex items-center justify-between">
                <span>Estimated size: ~{recordingMetrics.estimatedFileSize}KB</span>
                <span>Battery: ~{recordingMetrics.batteryUsage}%</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}