import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
  Star
} from "lucide-react";

export interface EnhancedRecordingOptions {
  quality: 'low' | 'medium' | 'high' | 'medical';
  format: 'webm' | 'wav' | 'mp3';
  enableNoiseCancellation: boolean;
  enableVoiceActivityDetection: boolean;
  enableAutomaticGainControl: boolean;
  maxDuration: number; // in seconds
  language: string;
  enableLiveTranscription: boolean;
  transcriptionProvider: 'deepgram' | 'openai' | 'google' | 'azure' | 'browser';
}

export interface RecordingMetrics {
  audioLevel: number;
  qualityScore: number;
  noiseLevel: number;
  clippingDetected: boolean;
  estimatedFileSize: number;
  batteryUsage: number;
}

export interface TranscriptionMetrics {
  wordsPerMinute: number;
  confidence: number;
  accuracy: number;
  medicalTermAccuracy: number;
  speakerDiarization: boolean;
  processingLatency: number;
}

interface EnhancedVoiceRecorderProps {
  className?: string;
  onRecordingComplete?: (result: RecordingResult) => void;
  onRecordingError?: (error: RecordingError) => void;
  onTranscriptionUpdate?: (transcript: string, metrics: TranscriptionMetrics) => void;
  onMetricsUpdate?: (metrics: RecordingMetrics) => void;
  options?: Partial<EnhancedRecordingOptions>;
  enableAdvancedFeatures?: boolean;
  enableMedicalMode?: boolean;
  showRealTimeAnalysis?: boolean;
  enableVoiceCommands?: boolean;
}

interface RecordingResult {
  audioBlob: Blob;
  audioUrl: string;
  duration: number;
  transcript?: string;
  metadata: RecordingMetadata;
  metrics: RecordingMetrics;
  transcriptionMetrics?: TranscriptionMetrics;
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
}

interface RecordingError {
  type: 'microphone' | 'transcription' | 'processing' | 'network' | 'permission' | 'browser';
  message: string;
  details?: any;
  recoveryAction?: string;
}

const DEFAULT_OPTIONS: EnhancedRecordingOptions = {
  quality: 'medical',
  format: 'webm',
  enableNoiseCancellation: true,
  enableVoiceActivityDetection: true,
  enableAutomaticGainControl: true,
  maxDuration: 3600, // 1 hour
  language: 'en-US',
  enableLiveTranscription: true,
  transcriptionProvider: 'deepgram'
};

export function EnhancedVoiceRecorder({
  className,
  onRecordingComplete,
  onRecordingError,
  onTranscriptionUpdate,
  onMetricsUpdate,
  options = {},
  enableAdvancedFeatures = true,
  enableMedicalMode = false,
  showRealTimeAnalysis = true,
  enableVoiceCommands = false
}: EnhancedVoiceRecorderProps) {
  const { toast } = useToast();
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'paused' | 'processing' | 'complete'>('idle');
  const [recordingOptions, setRecordingOptions] = useState<EnhancedRecordingOptions>({ ...DEFAULT_OPTIONS, ...options });
  const [recordingMetrics, setRecordingMetrics] = useState<RecordingMetrics>({
    audioLevel: 0,
    qualityScore: 0,
    noiseLevel: 0,
    clippingDetected: false,
    estimatedFileSize: 0,
    batteryUsage: 0
  });
  const [transcriptionMetrics, setTranscriptionMetrics] = useState<TranscriptionMetrics>({
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
      noiseLevel: Math.max(0, audioLevel - 20), // Simplified noise estimation
      clippingDetected,
      estimatedFileSize: calculateEstimatedFileSize(recordingDuration + 1),
      batteryUsage: estimateBatteryUsage(recordingDuration + 1, audioLevel)
    };

    setRecordingMetrics(newMetrics);
    onMetricsUpdate?.(newMetrics);
  }, [recordingDuration, onMetricsUpdate]);

  // Calculate estimated file size
  const calculateEstimatedFileSize = (duration: number): number => {
    const bitRate = recordingOptions.quality === 'medical' ? 128000 : 
                   recordingOptions.quality === 'high' ? 96000 : 64000;
    return Math.round((bitRate * duration) / 8 / 1024); // KB
  };

  // Estimate battery usage
  const estimateBatteryUsage = (duration: number, audioLevel: number): number => {
    const baseUsage = duration * 0.01; // 1% per minute base
    const audioUsage = (audioLevel / 100) * duration * 0.005; // Additional usage based on audio level
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

  // Initialize live transcription
  const initializeLiveTranscription = useCallback(async () => {
    if (!recordingOptions.enableLiveTranscription) return;

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        console.warn('Speech recognition not supported in this browser');
        return;
      }

      speechRecognitionRef.current = new SpeechRecognition();
      speechRecognitionRef.current.continuous = true;
      speechRecognitionRef.current.interimResults = true;
      speechRecognitionRef.current.lang = recordingOptions.language;

      let finalTranscript = '';

      speechRecognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        const currentTranscript = finalTranscript + interimTranscript;
        setLiveTranscript(currentTranscript);

        // Calculate transcription metrics
        const words = currentTranscript.split(/\s+/).filter(word => word.length > 0);
        const wordsPerMinute = Math.round((words.length / Math.max(1, recordingDuration)) * 60);
        const confidence = event.results[event.results.length - 1][0].confidence || 0.8;

        const newMetrics: TranscriptionMetrics = {
          wordsPerMinute,
          confidence: Math.round(confidence * 100),
          accuracy: Math.round(confidence * 95), // Simplified accuracy estimation
          medicalTermAccuracy: enableMedicalMode ? Math.round(confidence * 90) : 0,
          speakerDiarization: false,
          processingLatency: 0
        };

        setTranscriptionMetrics(newMetrics);
        onTranscriptionUpdate?.(currentTranscript, newMetrics);
      };

      speechRecognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        handleTranscriptionError(event.error);
      };

      speechRecognitionRef.current.start();
    } catch (error) {
      console.error('Failed to initialize live transcription:', error);
    }
  }, [recordingOptions.enableLiveTranscription, recordingOptions.language, recordingDuration, enableMedicalMode, onTranscriptionUpdate]);

  // Handle transcription errors
  const handleTranscriptionError = useCallback((error: string) => {
    const errorObj: RecordingError = {
      type: 'transcription',
      message: `Transcription error: ${error}`,
      recoveryAction: 'Browser speech recognition encountered an error. Recording will continue without live transcription.'
    };

    onRecordingError?.(errorObj);
    
    toast({
      title: 'Transcription Issue',
      description: 'Live transcription is not available. Recording will continue normally.',
      variant: 'destructive'
    });
  }, [onRecordingError, toast]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      setRecordingState('recording');
      setRecordingDuration(0);
      setLiveTranscript('');
      recordingStartTimeRef.current = Date.now();
      audioChunksRef.current = [];

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
        }
      };

      mediaRecorderRef.current.onstop = () => {
        handleRecordingStop();
      };

      mediaRecorderRef.current.start(1000); // Collect data every second

      // Initialize live transcription
      await initializeLiveTranscription();

      toast({
        title: 'Recording Started',
        description: 'Speak clearly into your microphone. Live transcription is active.',
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      setRecordingState('idle');
      
      const errorObj: RecordingError = {
        type: 'microphone',
        message: error instanceof Error ? error.message : 'Failed to access microphone',
        details: error,
        recoveryAction: 'Please check microphone permissions and ensure your microphone is not being used by another application.'
      };

      onRecordingError?.(errorObj);

      toast({
        title: 'Recording Failed',
        description: 'Could not start recording. Please check microphone permissions.',
        variant: 'destructive'
      });
    }
  }, [recordingOptions, initializeAudioAnalysis, calculateAudioMetrics, initializeLiveTranscription, onRecordingError, toast]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || recordingState !== 'recording') return;

    setRecordingState('processing');

    // Stop live transcription
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }

    // Stop media recorder
    mediaRecorderRef.current.stop();
  }, [recordingState]);

  // Handle recording stop
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
          transcriptionProvider: recordingOptions.transcriptionProvider
        },
        metrics: recordingMetrics,
        transcriptionMetrics: transcriptionMetrics
      };

      setRecordingState('complete');
      onRecordingComplete?.(result);

      toast({
        title: 'Recording Complete',
        description: `Recording saved (${Math.round(audioBlob.size / 1024)}KB, ${recordingDuration}s)`,
      });

    } catch (error) {
      console.error('Error stopping recording:', error);
      setRecordingState('idle');
      
      const errorObj: RecordingError = {
        type: 'processing',
        message: 'Failed to process recording',
        details: error,
        recoveryAction: 'Please try recording again. If the problem persists, refresh the page.'
      };

      onRecordingError?.(errorObj);

      toast({
        title: 'Processing Error',
        description: 'Failed to process recording. Please try again.',
        variant: 'destructive'
      });
    }
  }, [recordingOptions, recordingDuration, liveTranscript, recordingMetrics, transcriptionMetrics, onRecordingComplete, onRecordingError, toast]);

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

  // Get audio level color
  const getAudioLevelColor = (level: number): string => {
    if (level >= 70) return 'bg-red-500';
    if (level >= 50) return 'bg-yellow-500';
    if (level >= 20) return 'bg-green-500';
    return 'bg-gray-300';
  };

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Enhanced Voice Recorder
            </CardTitle>
            <CardDescription>
              {enableMedicalMode ? 'Medical-grade recording with AI transcription' : 'High-quality voice recording with real-time analysis'}
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
          
          {recordingState === 'recording' && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm">{formatDuration(recordingDuration)}</span>
            </div>
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
                  // Download recording
                  const result = {
                    audioUrl: '', // Would need to be passed from parent
                    metadata: {} as RecordingMetadata
                  };
                  const link = document.createElement('a');
                  link.href = result.audioUrl;
                  link.download = `recording-${new Date().toISOString()}.webm`;
                  link.click();
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
                  className={cn("h-full transition-all", getAudioLevelColor(recordingMetrics.audioLevel))}
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Language</label>
                <select
                  value={recordingOptions.language}
                  onChange={(e) => setRecordingOptions(prev => ({ ...prev, language: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Max Duration</label>
                <select
                  value={recordingOptions.maxDuration}
                  onChange={(e) => setRecordingOptions(prev => ({ ...prev, maxDuration: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="600">10 minutes</option>
                  <option value="1800">30 minutes</option>
                  <option value="3600">1 hour</option>
                  <option value="7200">2 hours</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Live Transcription</label>
                <button
                  onClick={() => setRecordingOptions(prev => ({ ...prev, enableLiveTranscription: !prev.enableLiveTranscription }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    recordingOptions.enableLiveTranscription ? "bg-primary" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      recordingOptions.enableLiveTranscription ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Noise Cancellation</label>
                <button
                  onClick={() => setRecordingOptions(prev => ({ ...prev, enableNoiseCancellation: !prev.enableNoiseCancellation }))}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    recordingOptions.enableNoiseCancellation ? "bg-primary" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      recordingOptions.enableNoiseCancellation ? "translate-x-6" : "translate-x-1"
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