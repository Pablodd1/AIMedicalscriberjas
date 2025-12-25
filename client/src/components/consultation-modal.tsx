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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
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
  Pause,
  Play,
} from "lucide-react";
import { useRecording } from "@/contexts/recording-context";
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [signatureData, setSignatureData] = useState<SignatureData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [consultationId, setConsultationId] = useState<number | null>(null);

  const {
    isRecording,
    isPaused,
    duration,
    liveTranscript,
    audioLevel: contextAudioLevel,
    patientInfo: contextPatientInfo,
    startRecording: startGlobalRecording,
    stopRecording: stopGlobalRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
    error: contextError,
  } = useRecording();

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived recording status for UI
  const status = contextError ? 'error' : (isRecording ? (isPaused ? 'paused' : 'recording') : (isProcessing ? 'processing' : 'idle'));
  const hasAudioInput = contextAudioLevel > 5;
  const audioLevel = contextAudioLevel;
  const error = contextError;

  // Reset all state variables to clear the modal
  const resetModalState = () => {
    setActiveTab("live-recording");
    setIsProcessing(false);
    setTranscript("");
    setNotes("");
    setConsultationId(null);
    setIsSaving(false);
    setIsDownloading(false);
    setSignatureData(null);
  };

  const stopAudioLevelMonitoring = () => {
    // This logic should now be handled within the useRecording hook
    // or removed if the context provides the audio level directly.
  };

  const handleStartRecording = async () => {
    try {
      await startGlobalRecording(patientInfo);
    } catch (error) {
      // Error handled by context and toast
    }
  };

  const handleStopRecording = async () => {
    try {
      setIsProcessing(true);
      const finalTranscript = await stopGlobalRecording();

      setTranscript(finalTranscript);

      if (finalTranscript.trim()) {
        generateNotes(finalTranscript, 'voice');
      } else {
        setIsProcessing(false);
        toast({
          title: "No Speech Detected",
          description: "No speech was detected. Please try recording again or use text input.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      setIsProcessing(false);
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

      const blob = new Blob([new Uint8Array(docxBuffer)], {
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
    // We NO LONGER stop recording on close. 
    // The GlobalRecordingBar will handle it if the user navigates away.
    // If they were just reviewing notes, we reset
    if (!isRecording) {
      resetModalState();
      resetRecording();
    }
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
              resetRecording();
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

  // Quick Patient Consent Component
  const PatientConsentArea = () => {
    const [hasConsented, setHasConsented] = useState(false);
    return (
      <div className="mb-4 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <Checkbox
              id="patient-consent"
              checked={hasConsented}
              onCheckedChange={(checked: boolean | "indeterminate") => setHasConsented(!!checked)}
              className="h-5 w-5 border-blue-400 data-[state=checked]:bg-blue-600"
            />
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="patient-consent"
              className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer"
            >
              Patient Consent for Conversation Recording
            </Label>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              "I am using an AI medical scribe to help me take accurate notes so I can focus more on you.
              The conversation will be recorded and transcribed securely. Do you consent to this?"
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Recording Status Indicator Component
  const RecordingIndicator = () => {

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
            {status === 'paused' && (
              <>
                <div className="h-10 w-10 rounded-full bg-medical-yellow/20 flex items-center justify-center">
                  <Pause className="h-5 w-5 text-medical-yellow fill-current" />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-medical-yellow">Paused</span>
                  <span className="text-xs text-muted-foreground">Recording is currently paused</span>
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

          {(status === 'recording' || status === 'paused') && (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={cn(
                "font-mono text-xl px-4 py-1",
                status === 'paused'
                  ? "bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800 text-yellow-600 dark:text-yellow-400"
                  : "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400"
              )}>
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
              {/* Patient Consent Area - Now always visible or prominent during recording */}
              {status !== 'recording' && status !== 'processing' && <PatientConsentArea />}

              <div className="flex flex-col items-center justify-center p-6 border rounded-lg bg-muted/20 relative overflow-hidden min-h-[200px] transition-all duration-500 ease-in-out">
                {status === 'recording' ? (
                  <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-300">
                    <div className="flex flex-col items-center gap-6">
                      <div className="flex items-center gap-6">
                        {isPaused ? (
                          <Button
                            variant="outline"
                            size="lg"
                            className="w-24 h-24 rounded-full flex flex-col gap-1 border-medical-yellow text-medical-yellow hover:bg-medical-yellow/10"
                            onClick={resumeRecording}
                          >
                            <Play className="h-8 w-8 fill-current" />
                            <span className="text-xs font-bold">RESUME</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="lg"
                            className="w-24 h-24 rounded-full flex flex-col gap-1 border-medical-yellow text-medical-yellow hover:bg-medical-yellow/10"
                            onClick={pauseRecording}
                          >
                            <Pause className="h-8 w-8" />
                            <span className="text-xs font-bold">PAUSE</span>
                          </Button>
                        )}

                        <Button
                          variant="destructive"
                          size="lg"
                          className="w-32 h-32 rounded-full flex flex-col gap-2 relative shadow-lg shadow-red-500/30 transition-all hover:scale-105"
                          onClick={handleStopRecording}
                        >
                          {/* Pulsing rings only when NOT paused */}
                          {!isPaused && (
                            <>
                              <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-30" />
                              <span className="absolute inset-2 rounded-full border-2 border-red-400 animate-pulse" />
                            </>
                          )}
                          <span className="absolute inset-0 rounded-full border-t-4 border-white/50 animate-spin" style={{ animationDuration: '2s', display: isPaused ? 'none' : 'block' }} />

                          <div className="relative z-10 flex flex-col items-center">
                            <StopCircle className="h-10 w-10" />
                            <span className="text-sm font-bold mt-1">STOP</span>
                          </div>
                        </Button>
                      </div>
                    </div>

                    {/* Live transcription display MOVED CLOSER to the button */}
                    {liveTranscript && (
                      <div className="w-full mt-6 space-y-2 animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Live Transcription</span>
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        </div>
                        <div className="relative">
                          <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-green-50/50 dark:from-green-950/20 to-transparent z-10 pointer-events-none rounded-t-lg" />
                          <div className="p-4 border-2 border-green-200 dark:border-green-800 rounded-lg bg-green-50/40 dark:bg-green-950/10 min-h-[80px] max-h-[350px] overflow-y-auto shadow-inner transition-all duration-300">
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 font-medium italic">
                              {liveTranscript}
                              <span className="inline-block w-1.5 h-4 bg-green-500 ml-1 animate-pulse align-middle" />
                            </p>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-green-50/50 dark:from-green-950/20 to-transparent z-10 pointer-events-none rounded-b-lg" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : status === 'processing' ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-32 h-32 rounded-full flex flex-col gap-2"
                    disabled
                  >
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm">Processing...</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-32 h-32 rounded-full flex flex-col gap-2 hover:bg-primary/10 hover:border-primary transition-all shadow-md group"
                    onClick={handleStartRecording}
                  >
                    <Mic className="h-8 w-8 group-hover:scale-110 transition-transform" />
                    <span className="text-sm font-semibold">Start Recording</span>
                  </Button>
                )}

                <p className="text-xs text-muted-foreground mt-4 text-center max-w-sm">
                  {status === 'recording'
                    ? (isPaused ? "Recording paused. Resume to continue." : "Recording in progress. Click STOP when finished.")
                    : status === 'error'
                      ? "Recording failed. Please check your microphone."
                      : "Click button to start recording. Transcription occurs in real-time."}
                </p>
              </div>

              {/* Recording Status Indicator - Compact Version */}
              <RecordingIndicator />

              {transcript && status === 'idle' && (
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
                    patientName={patientInfo?.firstName ? `${patientInfo.firstName} ${patientInfo.lastName || ''}` : (patientInfo?.name || 'Patient')}
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
