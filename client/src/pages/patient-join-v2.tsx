import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, MicOff, Check, Radio, Volume2, VolumeX, AlertCircle, FileText, Languages } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordingService } from "@/lib/recording-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Helper function to format recording duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Simple audio waveform visualization component
const AudioWaveform: React.FC<{ level: number }> = ({ level }) => {
  const bars = 20;
  const activeCount = Math.floor((level / 100) * bars);
  
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < activeCount;
        const height = isActive ? Math.random() * 60 + 40 : 20;
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${
              isActive ? 'bg-red-500' : 'bg-gray-300'
            }`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
};

// Signature Pad Component
const SignaturePad: React.FC<{ 
  onSignatureChange: (signature: string) => void;
  signature?: string;
}> = ({ onSignatureChange, signature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Draw white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If signature exists, load it
    if (signature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = signature;
    }
  }, [signature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.nativeEvent.offsetX;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.nativeEvent.offsetY;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Save signature as data URL
    const dataUrl = canvas.toDataURL('image/png');
    onSignatureChange(dataUrl);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onSignatureChange('');
  };

  return (
    <div className="space-y-2">
      <div className="border-2 border-gray-300 rounded-md bg-white">
        <canvas
          ref={canvasRef}
          className="w-full h-40 touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={clearSignature}
        className="w-full"
      >
        Clear Signature
      </Button>
    </div>
  );
};

// Define intake form interface
interface IntakeForm {
  id: number;
  patientId: number;
  doctorId: number;
  name: string;
  email: string;
  phone?: string;
  status: string;
  uniqueLink: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  responses?: IntakeFormResponse[];
}

interface IntakeFormResponse {
  id: number;
  formId: number;
  questionId: string;
  question: string;
  answer: string;
  answerType: string;
  audioUrl?: string | null;
  createdAt: string;
}

// Language configuration
const LANGUAGES = [
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'ht-HT', name: 'Kreyòl (Haitian Creole)', flag: '🇭🇹' },
  { code: 'ru-RU', name: 'Русский (Russian)', flag: '🇷🇺' },
];

export default function PatientJoinPageV2() {
  const { uniqueLink } = useParams();
  const { toast } = useToast();
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudioInput, setHasAudioInput] = useState(false);
  const [fullTranscript, setFullTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  
  // Form states
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedAnswers, setExtractedAnswers] = useState<Record<string, string>>({});
  const [aiSummary, setAiSummary] = useState("");
  const [formComplete, setFormComplete] = useState(false);
  
  // Consent and signature states
  const [consentGiven, setConsentGiven] = useState(false);
  const [signature, setSignature] = useState("");
  
  // Fetch intake form details by unique link
  const { data: formData, isLoading, error } = useQuery<IntakeForm>({
    queryKey: [`/api/public/intake-form/${uniqueLink}`],
    enabled: !!uniqueLink,
  });

  // Recording duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      setRecordingDuration(0);
      interval = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Simulate audio level
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        const level = Math.random() * 100;
        setAudioLevel(level);
        setHasAudioInput(level > 5);
      }, 100);
    } else {
      setAudioLevel(0);
      setHasAudioInput(false);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Start continuous recording
  const handleStartRecording = async () => {
    try {
      setRecordingError(null);
      setFullTranscript("");
      setIsRecording(true);
      await recordingService.startRecording();
      
      // Start live transcription with selected language
      try {
        await recordingService.startLiveTranscription(
          (transcript) => {
            setFullTranscript(transcript);
          },
          (error) => {
            console.log("Live transcription error:", error);
          },
          selectedLanguage // Pass selected language
        );
      } catch (liveError) {
        console.log("Live transcription not available, will transcribe after recording");
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      setRecordingError(error instanceof Error ? error.message : "Unknown error");
      toast({
        title: "Recording failed",
        description: "Could not start recording. Please check your microphone permissions.",
        variant: "destructive",
      });
    }
  };

  // Stop recording and process with AI
  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);
    
    try {
      // Stop live transcription if running
      if (recordingService.isLiveTranscribing) {
        recordingService.stopLiveTranscription();
      }
      
      // Stop recording
      await recordingService.stopRecording();
      
      // Get final transcript
      let finalTranscript = fullTranscript;
      if (!finalTranscript) {
        finalTranscript = await recordingService.getTranscript();
      }
      
      if (!finalTranscript) {
        throw new Error("No transcript available");
      }
      
      // Send transcript to AI for answer extraction
      const response = await apiRequest("POST", "/api/ai/extract-intake-answers", {
        transcript: finalTranscript,
        language: selectedLanguage
      });
      
      if (response.answers) {
        setExtractedAnswers(response.answers);
      }
      
      if (response.summary) {
        setAiSummary(response.summary);
      }
      
      toast({
        title: "Processing complete",
        description: "Your answers have been extracted and organized.",
      });
    } catch (error) {
      console.error("Error processing recording:", error);
      toast({
        title: "Processing failed",
        description: "Could not process your recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Submit the complete form
  const handleSubmitForm = async () => {
    if (!formData) return;
    
    if (!consentGiven) {
      toast({
        title: "Consent required",
        description: "Please check the consent box to continue.",
        variant: "destructive",
      });
      return;
    }
    
    if (!signature) {
      toast({
        title: "Signature required",
        description: "Please provide your signature to complete the form.",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Submit all extracted answers
      await apiRequest("POST", `/api/public/intake-form/${formData.id}/submit-continuous`, {
        answers: extractedAnswers,
        summary: aiSummary,
        transcript: fullTranscript,
        language: selectedLanguage,
        consentGiven,
        signature,
        audioUrl: recordingService.getAudioUrl()
      });
      
      // Mark form as completed
      await apiRequest("POST", `/api/public/intake-form/${formData.id}/complete`);
      
      setFormComplete(true);
      toast({
        title: "Form submitted successfully",
        description: "Thank you for completing the intake form.",
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: "Submission failed",
        description: "There was an error submitting the form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !formData) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            The intake form could not be found or has expired. Please contact your healthcare provider.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (formComplete) {
    return (
      <div className="container mx-auto p-4">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">
              <Check className="inline-block mr-2 h-6 w-6 text-green-500" />
              Form Completed
            </CardTitle>
            <CardDescription className="text-center">
              Thank you for completing your intake form.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">
              Your information has been submitted to {formData.name}. They will review your responses and contact you as needed.
            </p>
            <p className="text-sm text-muted-foreground">
              You may close this window now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-6 w-6" />
            Voice Patient Intake Form
          </CardTitle>
          <CardDescription>
            Welcome to {formData.name}'s voice intake form. Simply click the microphone, speak naturally about your health, and our AI will organize your answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Select Your Language / Seleccione su idioma / Chwazi lang ou / Выберите язык
            </Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isRecording || Object.keys(extractedAnswers).length > 0}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(lang => (
                  <SelectItem key={lang.code} value={lang.code}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Recording Section */}
          {!extractedAnswers || Object.keys(extractedAnswers).length === 0 ? (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Click the microphone button below and tell us about yourself in your own words. 
                  Our AI will listen and organize your information.
                </p>
                <div className="flex justify-center">
                  {isRecording ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="lg"
                      onClick={handleStopRecording}
                      className="h-24 w-24 rounded-full relative shadow-lg shadow-red-500/30"
                    >
                      <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30" />
                      <span className="absolute inset-1 rounded-full bg-red-500/20 animate-pulse" />
                      <MicOff className="h-10 w-10 relative z-10" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="default"
                      size="lg"
                      onClick={handleStartRecording}
                      className="h-24 w-24 rounded-full bg-primary hover:bg-primary/90 transition-all"
                      disabled={isProcessing}
                    >
                      <Mic className="h-10 w-10" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Recording Status Display */}
              {isRecording && (
                <div className="p-4 rounded-lg border-2 border-red-200 bg-red-50">
                  {/* Recording Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                          <div className="absolute h-10 w-10 rounded-full bg-red-500/30 animate-ping" />
                          <Radio className="h-5 w-5 text-red-500 relative z-10" />
                        </div>
                      </div>
                      <div>
                        <span className="font-bold text-red-600 text-lg flex items-center gap-2">
                          <span className="animate-pulse">●</span> RECORDING
                        </span>
                        <span className="text-xs text-red-500">Speak naturally</span>
                      </div>
                    </div>
                    <div className="font-mono text-xl text-red-600 bg-white px-3 py-1 rounded border border-red-200">
                      {formatDuration(recordingDuration)}
                    </div>
                  </div>
                  
                  {/* Audio Waveform */}
                  <div className="p-2 bg-white rounded-md mb-3">
                    <AudioWaveform level={audioLevel} />
                  </div>
                  
                  {/* Audio Status */}
                  <div className="flex items-center gap-2 text-sm mb-2">
                    {hasAudioInput ? (
                      <>
                        <Volume2 className="h-4 w-4 text-green-500" />
                        <span className="text-green-700">Audio detected - keep speaking</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-4 w-4 text-amber-500 animate-pulse" />
                        <span className="text-amber-700">Waiting for audio...</span>
                      </>
                    )}
                  </div>
                  
                  {/* Audio Level Bar */}
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                    <div 
                      className="h-full transition-all duration-75 rounded-full bg-gradient-to-r from-red-400 to-red-500"
                      style={{ width: `${Math.max(5, audioLevel)}%` }}
                    />
                  </div>
                  
                  {/* Live Transcript Preview */}
                  {fullTranscript && (
                    <div className="p-3 bg-white rounded border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-700">Live Transcript</span>
                      </div>
                      <p className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                        {fullTranscript}
                      </p>
                    </div>
                  )}
                  
                  {/* Warning if no audio detected */}
                  {!hasAudioInput && recordingDuration > 3 && (
                    <Alert className="border-amber-300 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700 text-sm">
                        No audio detected. Check your microphone is working and not muted.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Processing Indicator */}
              {isProcessing && (
                <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-blue-700 font-medium">
                    Processing your recording with AI...
                  </span>
                </div>
              )}

              {/* Recording Error */}
              {recordingError && !isRecording && (
                <Alert className="border-amber-300 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Recording Issue</AlertTitle>
                  <AlertDescription className="text-amber-700 text-sm">
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      <li>Check that your microphone is connected and not muted</li>
                      <li>Grant microphone permissions when prompted by your browser</li>
                      <li>Try refreshing the page if the issue persists</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            /* Extracted Answers Display */
            <div className="space-y-4">
              <Alert className="border-green-300 bg-green-50">
                <Check className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">AI Processing Complete</AlertTitle>
                <AlertDescription className="text-green-700">
                  Your information has been organized. Please review and sign below to submit.
                </AlertDescription>
              </Alert>

              {/* Display extracted answers */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Your Information:</h3>
                <div className="grid gap-3">
                  {Object.entries(extractedAnswers).map(([key, value]) => (
                    <div key={key} className="p-3 bg-gray-50 rounded-md border">
                      <div className="text-sm font-medium text-gray-600 capitalize mb-1">
                        {key.replace(/_/g, ' ')}
                      </div>
                      <div className="text-sm text-gray-900">{value || "Not provided"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Summary */}
              {aiSummary && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">Summary for Healthcare Provider:</h3>
                  <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                </div>
              )}

              <Separator />

              {/* Consent */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-md border">
                  <Checkbox 
                    id="consent" 
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="consent" className="text-sm font-medium cursor-pointer">
                      I consent to the collection and use of my health information
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      I understand that the information I provide will be used for medical purposes and will be kept confidential in accordance with HIPAA regulations.
                    </p>
                  </div>
                </div>

                {/* Signature */}
                <div className="space-y-2">
                  <Label>Your Signature / Su firma / Siyati ou / Ваша подпись</Label>
                  <SignaturePad 
                    onSignatureChange={setSignature}
                    signature={signature}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmitForm}
                disabled={!consentGiven || !signature || isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Submit Intake Form
                  </>
                )}
              </Button>

              {/* Re-record option */}
              <Button
                onClick={() => {
                  setExtractedAnswers({});
                  setAiSummary("");
                  setFullTranscript("");
                  setSignature("");
                  setConsentGiven(false);
                }}
                variant="outline"
                className="w-full"
              >
                Re-record My Information
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
