import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  recordingService, 
  generateSoapNotes, 
  saveConsultationNote,
  createMedicalNoteFromConsultation 
} from "@/lib/recording-service";
import {
  Mic,
  StopCircle,
  Upload,
  FileText,
  Loader2,
  ClipboardCopy,
  Download,
  FileSignature,
  AlertCircle,
  CheckCircle,
  XCircle,
  Radio,
  Volume2,
  VolumeX,
  Settings,
  RefreshCw,
  Waves,
  CircleDot,
  Zap,
  Activity,
  HelpCircle,
  ChevronRight,
  Save,
} from "lucide-react";
import { SignaturePad, SignatureDisplay, SignatureData } from "@/components/signature-pad";
import { cn } from "@/lib/utils";

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGeneratedNotes: (notes: string) => void;
  patientInfo: any;
  noteType?: string;
}

// Recording status types
type RecordingStatus = 'idle' | 'initializing' | 'recording' | 'stopping' | 'processing' | 'error';

interface RecordingState {
  status: RecordingStatus;
  error?: string;
  audioLevel: number;
  duration: number;
  hasAudioInput: boolean;
}

export function ConsultationModal({
  isOpen,
  onClose,
  onGeneratedNotes,
  patientInfo,
  noteType = 'initial',
}: ConsultationModalProps) {
  const [activeTab, setActiveTab] = useState("live-recording");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [notes, setNotes] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [consultationId, setConsultationId] = useState<number | null>(null);
  
  // Enhanced recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    status: 'idle',
    error: undefined,
    audioLevel: 0,
    duration: 0,
    hasAudioInput: false,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  const { toast } = useToast();

  // Reset all state variables to clear the modal
  const resetModalState = () => {
    setActiveTab("live-recording");
    setIsProcessing(false);
    setTranscript("");
    setNotes("");
    setLiveTranscript("");
    setConsultationId(null);
    setIsSaving(false);
    setIsDownloading(false);
    setSignatureData(null);
    setRecordingState({
      status: 'idle',
      error: undefined,
      audioLevel: 0,
      duration: 0,
      hasAudioInput: false,
    });
    
    // Cleanup audio context
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  };

  // Monitor audio levels for visual feedback
  const startAudioLevelMonitoring = async (stream: MediaStream) => {
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateLevel = () => {
        if (!analyserRef.current || recordingState.status !== 'recording') return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const normalizedLevel = Math.min(100, (average / 128) * 100);
        
        setRecordingState(prev => ({
          ...prev,
          audioLevel: normalizedLevel,
          hasAudioInput: normalizedLevel > 5,
        }));
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (error) {
      console.error("Error starting audio level monitoring:", error);
    }
  };

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  };

  const handleStartRecording = async () => {
    try {
      setRecordingState(prev => ({ ...prev, status: 'initializing', error: undefined }));
      
      // Request microphone access and get stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Start audio recording
      await recordingService.startRecording();
      
      // Start audio level monitoring
      startAudioLevelMonitoring(stream);
      
      // Start duration timer
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
      
      setRecordingState(prev => ({
        ...prev,
        status: 'recording',
        duration: 0,
      }));
      
      // Try to start live transcription
      try {
        await recordingService.startLiveTranscription(
          (text: string) => {
            setLiveTranscript(text);
          },
          (error: string) => {
            console.error("Live transcription error:", error);
          }
        );
      } catch (liveTranscriptionError) {
        console.log("Live transcription not available:", liveTranscriptionError);
        toast({
          title: "Live Transcription Unavailable",
          description: "Recording will continue. Transcription will happen after you stop.",
        });
      }
      
    } catch (error) {
      console.error("Failed to start recording:", error);
      setRecordingState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : "Could not access microphone",
      }));
      toast({
        title: "Recording Failed",
        description: "Could not start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    try {
      setRecordingState(prev => ({ ...prev, status: 'stopping' }));
      
      // Stop audio level monitoring
      stopAudioLevelMonitoring();
      
      // Stop duration timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      
      // Stop live transcription if running
      recordingService.stopLiveTranscription();
      
      // Stop audio recording
      await recordingService.stopRecording();
      
      setRecordingState(prev => ({ ...prev, status: 'processing' }));
      
      // Get transcript
      let finalTranscript = recordingService.getLiveTranscript() || liveTranscript;
      
      if (!finalTranscript.trim()) {
        try {
          finalTranscript = await recordingService.getTranscript();
        } catch (backendError) {
          console.error("Backend transcription failed:", backendError);
          setRecordingState(prev => ({
            ...prev,
            status: 'error',
            error: "Could not transcribe audio. Please try again or use text input.",
          }));
          return;
        }
      }
      
      setTranscript(finalTranscript);
      setRecordingState(prev => ({ ...prev, status: 'idle' }));
      
      if (finalTranscript.trim()) {
        generateNotes(finalTranscript, 'voice');
      } else {
        toast({
          title: "No Speech Detected",
          description: "No speech was detected. Please try recording again or use text input.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setRecordingState(prev => ({
        ...prev,
        status: 'error',
        error: "An error occurred while stopping the recording.",
      }));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await recordingService.processAudioFile(file);
      setTranscript(text);
      generateNotes(text, 'upload');
    } catch (error) {
      console.error("Failed to process audio file:", error);
      toast({
        title: "Error",
        description: "Failed to process the audio file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const generateNotes = async (text: string, inputSource?: 'voice' | 'text' | 'upload') => {
    try {
      setIsProcessing(true);
      
      if (!text || text.trim().length < 10) {
        toast({
          title: "Not enough text",
          description: "Please provide more text to generate meaningful SOAP notes",
          variant: "destructive",
        });
        return;
      }
      
      if (!patientInfo || !patientInfo.id) {
        toast({
          title: "Patient information required",
          description: "Please select a patient before generating notes",
          variant: "destructive",
        });
        return;
      }
      
      const source = inputSource || (activeTab === 'live-recording' ? 'voice' : activeTab === 'upload' ? 'upload' : 'text');
      const generatedNotes = await generateSoapNotes(text, patientInfo, noteType, source);
      
      setNotes(generatedNotes);
      
      if (generatedNotes.includes("error") || generatedNotes.includes("failed")) {
        toast({
          title: "Note generation limited",
          description: "The notes were generated with limited information. Please review and edit as needed.",
        });
      } else {
        toast({
          title: "Success",
          description: "Comprehensive medical documentation generated successfully",
        });
      }
    } catch (error) {
      console.error("Failed to generate notes:", error);
      toast({
        title: "Error",
        description: "Failed to generate notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTextInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscript(e.target.value);
  };

  const saveTranscriptToDatabase = async () => {
    if (!transcript || !patientInfo) return;

    try {
      setIsSaving(true);
      const recordingMethod = activeTab;
      const patientName = patientInfo.firstName 
        ? `${patientInfo.firstName} ${patientInfo.lastName || ''}`
        : patientInfo.name || 'Patient';
      const title = `Consultation with ${patientName} - ${new Date().toLocaleString()}`;
      const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const doctorId = userData?.id || 1;
      
      const savedNote = await saveConsultationNote(
        patientInfo.id,
        doctorId,
        transcript,
        recordingMethod,
        title
      );

      setConsultationId(savedNote.id);
      toast({
        title: "Saved",
        description: "Consultation transcript saved to database",
      });
      return savedNote;
    } catch (error) {
      console.error("Failed to save transcript:", error);
      toast({
        title: "Error",
        description: "Failed to save consultation transcript",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadNotes = async () => {
    if (!notes) return;

    try {
      setIsDownloading(true);
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      
      const docSections = [];
      const noteTitle = `Medical Documentation - ${new Date().toLocaleDateString('en-US')}`;
      
      docSections.push(new Paragraph({ text: noteTitle, heading: HeadingLevel.TITLE }));
      docSections.push(new Paragraph({
        children: [new TextRun({
          text: `Comprehensive SOAP Note • Generated ${new Date().toLocaleDateString('en-US')}`,
          italics: true, size: 20,
        })],
      }));
      docSections.push(new Paragraph({ text: "" }));
      
      if (patientInfo) {
        docSections.push(new Paragraph({ text: "Patient Information", heading: HeadingLevel.HEADING_1 }));
        const patientName = `${patientInfo.firstName || ''} ${patientInfo.lastName || ''}`.trim();
        if (patientName) {
          docSections.push(new Paragraph({
            children: [
              new TextRun({ text: "Name: ", bold: true }),
              new TextRun({ text: patientName }),
            ],
          }));
        }
        docSections.push(new Paragraph({ text: "" }));
      }
      
      docSections.push(new Paragraph({ text: "Medical Documentation", heading: HeadingLevel.HEADING_1 }));
      notes.split('\n').forEach(line => {
        docSections.push(new Paragraph({ children: [new TextRun({ text: line, size: 24 })] }));
      });
      
      docSections.push(new Paragraph({ text: "" }));
      docSections.push(new Paragraph({
        children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, italics: true, size: 20 })],
      }));
      
      const doc = new Document({ sections: [{ properties: {}, children: docSections }] });
      const docxBuffer = await Packer.toBuffer(doc);
      
      const blob = new Blob([docxBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medical-note-${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({ title: "Downloaded", description: "Notes downloaded as Word document" });
    } catch (error) {
      console.error("Failed to download notes:", error);
      toast({ title: "Download Failed", description: "Failed to generate Word document", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUseNotes = async () => {
    if (!transcript || !notes) return;

    try {
      let consultId = consultationId;
      if (!consultId) {
        const savedConsultation = await saveTranscriptToDatabase();
        if (savedConsultation) consultId = savedConsultation.id;
      }

      const patientName = patientInfo.firstName 
        ? `${patientInfo.firstName} ${patientInfo.lastName || ''}`
        : patientInfo.name || 'Patient';
      const title = `SOAP Note for ${patientName} - ${new Date().toLocaleString()}`;
      const userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const doctorId = userData?.id || 1;
      
      if (consultId) {
        await createMedicalNoteFromConsultation(consultId, patientInfo.id, doctorId, notes, 'soap', title);
      }

      onGeneratedNotes(notes);
      resetModalState();
      onClose();
    } catch (error) {
      console.error("Failed to use notes:", error);
      toast({ title: "Error", description: "Failed to save medical note", variant: "destructive" });
    }
  };

  const handleModalClose = () => {
    // Stop any ongoing recording
    if (recordingState.status === 'recording') {
      recordingService.stopRecording();
      recordingService.stopLiveTranscription();
      stopAudioLevelMonitoring();
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    }
    resetModalState();
    onClose();
  };

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Audio Waveform Visualization Component
  const AudioWaveform = ({ audioLevel }: { audioLevel: number }) => {
    const bars = 12;
    return (
      <div className="flex items-center justify-center gap-[2px] h-8">
        {[...Array(bars)].map((_, i) => {
          // Calculate height based on audio level and position (center bars higher)
          const centerDistance = Math.abs(i - (bars - 1) / 2);
          const baseHeight = Math.max(0.15, 1 - (centerDistance / (bars / 2)) * 0.6);
          const levelMultiplier = Math.max(0.2, audioLevel / 100);
          const randomFactor = 0.7 + Math.random() * 0.3;
          const height = baseHeight * levelMultiplier * randomFactor;
          
          return (
            <div
              key={i}
              className={cn(
                "w-1 rounded-full transition-all duration-75",
                audioLevel > 50 ? "bg-green-500" : audioLevel > 20 ? "bg-amber-500" : "bg-red-400"
              )}
              style={{ 
                height: `${Math.max(4, height * 32)}px`,
                animationDelay: `${i * 50}ms`
              }}
            />
          );
        })}
      </div>
    );
  };

  // Troubleshooting Guide Component
  const RecordingTroubleshoot = () => (
    <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
      <div className="flex items-start gap-2">
        <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-2">
          <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">Recording Not Working?</p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Check that your microphone is connected and not muted
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Ensure browser has microphone permission (check address bar)
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Try refreshing the page and allowing microphone access
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Close other apps that might be using the microphone
            </li>
            <li className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Speak clearly and closer to the microphone
            </li>
          </ul>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 text-amber-700 border-amber-300 hover:bg-amber-100"
            onClick={() => {
              // Reset and retry
              setRecordingState(prev => ({ ...prev, status: 'idle', error: undefined }));
              handleStartRecording();
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry Recording
          </Button>
        </div>
      </div>
    </div>
  );

  // Recording Status Indicator Component
  const RecordingIndicator = () => {
    const { status, audioLevel, duration, hasAudioInput, error } = recordingState;
    
    if (status === 'idle') return null;
    
    return (
      <div className="mt-4 p-4 rounded-lg border bg-background">
        {/* Status Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {status === 'recording' && (
              <>
                <div className="relative">
                  <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                    <div className="absolute h-10 w-10 rounded-full bg-red-500/30 animate-ping" />
                    <div className="absolute h-8 w-8 rounded-full bg-red-500/20 animate-pulse" style={{ animationDelay: '150ms' }} />
                    <Radio className="h-5 w-5 text-red-500 relative z-10" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-red-500 text-lg flex items-center gap-2">
                    <span className="animate-pulse">●</span> REC
                  </span>
                  <span className="text-xs text-muted-foreground">Live Recording</span>
                </div>
              </>
            )}
            {status === 'initializing' && (
              <>
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-blue-500">Initializing...</span>
                  <span className="text-xs text-muted-foreground">Connecting to microphone</span>
                </div>
              </>
            )}
            {status === 'stopping' && (
              <>
                <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-amber-500">Stopping...</span>
                  <span className="text-xs text-muted-foreground">Finalizing recording</span>
                </div>
              </>
            )}
            {status === 'processing' && (
              <>
                <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-purple-500 animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-purple-500">Processing Audio...</span>
                  <span className="text-xs text-muted-foreground">Transcribing speech to text</span>
                </div>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-red-500">Recording Error</span>
                  <span className="text-xs text-muted-foreground">See troubleshooting below</span>
                </div>
              </>
            )}
          </div>
          
          {status === 'recording' && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-xl px-4 py-1 bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400">
                {formatDuration(duration)}
              </Badge>
            </div>
          )}
        </div>
        
        {/* Audio Level Indicator with Waveform */}
        {status === 'recording' && (
          <div className="space-y-3">
            {/* Waveform Visualization */}
            <div className="p-3 bg-muted/30 rounded-lg">
              <AudioWaveform audioLevel={audioLevel} />
            </div>
            
            {/* Audio Status Bar */}
            <div className="flex items-center gap-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
                hasAudioInput ? "bg-green-100 dark:bg-green-950" : "bg-amber-100 dark:bg-amber-950"
              )}>
                {hasAudioInput ? (
                  <Volume2 className="h-5 w-5 text-green-500" />
                ) : (
                  <VolumeX className="h-5 w-5 text-amber-500 animate-pulse" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {hasAudioInput ? "Audio Detected" : "Waiting for Audio..."}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Level: {Math.round(audioLevel)}%
                  </span>
                </div>
                {/* Visual Audio Level Bar */}
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-75 rounded-full",
                      audioLevel > 50 ? "bg-gradient-to-r from-green-400 to-green-500" 
                        : audioLevel > 20 ? "bg-gradient-to-r from-amber-400 to-amber-500" 
                        : "bg-gradient-to-r from-red-400 to-red-500"
                    )}
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>
              </div>
            </div>
            
            {/* Status Messages */}
            <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-sm">
              <Zap className="h-4 w-4" />
              <span>Speak clearly into your microphone. Recording will be transcribed automatically.</span>
            </div>
            
            {/* Warning if no audio for extended time */}
            {!hasAudioInput && duration > 3 && (
              <>
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Audio Detected</AlertTitle>
                  <AlertDescription>
                    We're not detecting any audio input. Please check that your microphone is working properly and not muted.
                  </AlertDescription>
                </Alert>
                <RecordingTroubleshoot />
              </>
            )}
          </div>
        )}
        
        {/* Error Display with Troubleshooting */}
        {status === 'error' && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Recording Error</AlertTitle>
              <AlertDescription>{error || 'An unknown error occurred while recording.'}</AlertDescription>
            </Alert>
            <RecordingTroubleshoot />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Consultation Recording & Documentation</DialogTitle>
          <DialogDescription>
            Record, upload, or paste a consultation to generate comprehensive medical documentation with HPI, DX, CPT, E&M coding, and treatment plans.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="live-recording">
                <Mic className="h-4 w-4 mr-2" />
                Live Recording
              </TabsTrigger>
              <TabsTrigger value="upload-recording">
                <Upload className="h-4 w-4 mr-2" />
                Upload Audio
              </TabsTrigger>
              <TabsTrigger value="text-paste">
                <ClipboardCopy className="h-4 w-4 mr-2" />
                Paste Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="live-recording" className="space-y-4 mt-4">
              <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-muted/20">
                {recordingState.status === 'recording' ? (
                  <Button
                    variant="destructive"
                    size="lg"
                    className="w-40 h-40 rounded-full flex flex-col gap-2 relative shadow-lg shadow-red-500/30"
                    onClick={handleStopRecording}
                  >
                    {/* Multiple pulsing ring animations for better visibility */}
                    <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-30" />
                    <span className="absolute inset-2 rounded-full border-2 border-red-400 animate-pulse" />
                    <span className="absolute inset-4 rounded-full bg-red-500/10 animate-pulse" style={{ animationDelay: '200ms' }} />
                    
                    {/* Rotating ring indicator */}
                    <span className="absolute inset-0 rounded-full border-t-4 border-white/50 animate-spin" style={{ animationDuration: '2s' }} />
                    
                    <div className="relative z-10 flex flex-col items-center">
                      <StopCircle className="h-12 w-12" />
                      <span className="text-sm font-bold mt-1">STOP</span>
                      <span className="text-xs opacity-80">Recording</span>
                    </div>
                  </Button>
                ) : recordingState.status === 'initializing' || recordingState.status === 'stopping' || recordingState.status === 'processing' ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-36 h-36 rounded-full flex flex-col gap-2"
                    disabled
                  >
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <span className="text-sm">
                      {recordingState.status === 'initializing' ? 'Starting...' : 
                       recordingState.status === 'stopping' ? 'Stopping...' : 'Processing...'}
                    </span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-36 h-36 rounded-full flex flex-col gap-2 hover:bg-primary/10 hover:border-primary transition-all"
                    onClick={handleStartRecording}
                  >
                    <Mic className="h-10 w-10" />
                    <span className="text-sm">Start Recording</span>
                  </Button>
                )}
                
                <p className="text-sm text-muted-foreground mt-4 text-center max-w-md">
                  {recordingState.status === 'recording'
                    ? "Recording in progress. Speak clearly into your microphone. Click stop when finished."
                    : recordingState.status === 'error'
                    ? "Recording failed. Please check your microphone and try again."
                    : "Click to start recording. Your audio will be transcribed and used to generate medical documentation."}
                </p>
              </div>
              
              {/* Recording Status Indicator */}
              <RecordingIndicator />
              
              {/* Live transcript display */}
              {liveTranscript && recordingState.status === 'recording' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-medium">Live Transcript</h3>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  </div>
                  <div className="p-4 border rounded-md bg-green-50 dark:bg-green-950/20 max-h-[150px] overflow-y-auto border-green-200 dark:border-green-800">
                    <p className="whitespace-pre-wrap text-sm">{liveTranscript}</p>
                  </div>
                </div>
              )}

              {transcript && recordingState.status === 'idle' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-medium">Final Transcript</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(transcript);
                          toast({ title: "Copied", description: "Transcript copied to clipboard" });
                        }}
                      >
                        <ClipboardCopy className="h-4 w-4 mr-2" />
                        Copy
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const blob = new Blob([transcript], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
                          link.click();
                          URL.revokeObjectURL(url);
                          toast({ title: "Downloaded", description: "Transcript downloaded" });
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveTranscriptToDatabase}
                        disabled={isSaving || !patientInfo}
                      >
                        {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}
                      </Button>
                    </div>
                  </div>
                  <div className="p-4 border rounded-md bg-blue-50 dark:bg-blue-950/20 max-h-[150px] overflow-y-auto border-blue-200 dark:border-blue-800">
                    <p className="whitespace-pre-wrap">{transcript}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload-recording" className="space-y-4 mt-4">
              <Alert className="bg-purple-50 dark:bg-purple-950/20 border-purple-200">
                <Upload className="h-4 w-4 text-purple-600" />
                <AlertTitle className="text-purple-900 dark:text-purple-100">Upload Audio File</AlertTitle>
                <AlertDescription className="text-purple-700 dark:text-purple-300 text-sm">
                  Upload any audio format (MP3, WAV, M4A, AAC, FLAC, OGG, etc.). 
                  Maximum file size: 50MB. The audio will be transcribed automatically.
                </AlertDescription>
              </Alert>
              
              <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                <input
                  type="file"
                  accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.webm,.mp4,.mov"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="lg"
                  className="w-36 h-36 rounded-full flex flex-col gap-2 hover:bg-primary/10 hover:border-primary"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-10 w-10 animate-spin" /> : <Upload className="h-10 w-10" />}
                  <span className="text-sm font-medium">{isProcessing ? "Processing..." : "Upload Audio"}</span>
                </Button>
                <div className="text-center mt-4 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports: MP3, WAV, M4A, AAC, FLAC, OGG, WebM, MP4
                  </p>
                </div>
              </div>

              {transcript && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Transcript</h3>
                    <Button variant="outline" size="sm" onClick={saveTranscriptToDatabase} disabled={isSaving || !patientInfo}>
                      {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : "Save Transcript"}
                    </Button>
                  </div>
                  <div className="p-4 border rounded-md bg-muted/50 max-h-[150px] overflow-y-auto">
                    <p className="whitespace-pre-wrap">{transcript}</p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="text-paste" className="space-y-4 mt-4">
              <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
                <ClipboardCopy className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900 dark:text-blue-100">Paste or Type Transcription</AlertTitle>
                <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
                  Already have a transcription? Paste it here! Or type consultation notes directly.
                  The AI will generate professional SOAP notes from your text.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Consultation Text</Label>
                  {transcript.trim() && (
                    <Button variant="outline" size="sm" onClick={saveTranscriptToDatabase} disabled={isSaving || !patientInfo}>
                      {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Paste or type consultation text here. For example:&#10;&#10;Patient reports chest pain for 3 days. Pain is sharp, rated 7/10. Occurs with exertion. No radiation. Patient has history of hypertension. Taking Lisinopril 10mg daily. Vital signs: BP 145/92, HR 88, RR 16, Temp 98.6F..."
                  className="min-h-[250px] font-mono text-sm"
                  onChange={handleTextInput}
                  value={transcript}
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setTranscript("");
                      toast({ title: "Cleared", description: "Text cleared" });
                    }}
                    disabled={!transcript.trim()}
                    className="flex-1"
                  >
                    Clear Text
                  </Button>
                  <Button
                    onClick={() => generateNotes(transcript, 'text')}
                    disabled={!transcript.trim() || isProcessing}
                    className="flex-1"
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-2" />Generate SOAP Notes</>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {notes && (
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Generated Medical Documentation</h3>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(notes);
                      toast({ title: "Copied", description: "Documentation copied to clipboard" });
                    }}
                  >
                    <ClipboardCopy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDownloadNotes} disabled={isDownloading}>
                    {isDownloading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Downloading...</>
                    ) : (
                      <><Download className="h-4 w-4 mr-2" />Download</>
                    )}
                  </Button>
                  <SignaturePad
                    compact
                    documentTitle="Medical Documentation"
                    documentType="consultation"
                    patientName={patientInfo?.firstName ? `${patientInfo.firstName} ${patientInfo.lastName || ''}` : patientInfo?.name}
                    onSignatureComplete={(data) => {
                      setSignatureData(data);
                      toast({ title: "Signature Captured", description: "Your electronic signature has been added." });
                    }}
                  />
                </div>
              </div>
              <div className="p-4 border rounded-md bg-muted/50 max-h-[300px] overflow-y-auto">
                <pre className="whitespace-pre-wrap font-sans text-sm">{notes}</pre>
              </div>
              
              {signatureData && (
                <div className="mt-2">
                  <SignatureDisplay signatureData={signatureData} showDetails={false} />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="mt-6 flex sm:justify-between justify-center flex-wrap gap-2">
            <Button variant="outline" onClick={handleModalClose}>
              Cancel
            </Button>
            <Button onClick={handleUseNotes} disabled={!notes}>
              Use This Documentation
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
