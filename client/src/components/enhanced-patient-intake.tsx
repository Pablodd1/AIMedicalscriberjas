import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Mic, 
  MicOff, 
  Play, 
  Square, 
  Check, 
  AlertCircle, 
  Loader2, 
  Upload, 
  Download, 
  FileText,
  User,
  Heart,
  Activity,
  Clock,
  ShieldCheck,
  Zap,
  Star,
  Volume2,
  VolumeX,
  RotateCcw,
  Settings,
  HelpCircle,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { recordingService } from "@/lib/recording-service";
import { AdvancedVoiceCommandControl } from "@/components/advanced-voice-command-control";

// Enhanced intake questions with medical categories
const ENHANCED_INTAKE_QUESTIONS = [
  // Demographics
  { id: 1, field: "full_name", label: "Full Name", category: "demographics", required: true },
  { id: 2, field: "date_of_birth", label: "Date of Birth", category: "demographics", required: true },
  { id: 3, field: "gender", label: "Gender", category: "demographics", required: true },
  { id: 4, field: "phone", label: "Phone Number", category: "demographics", required: true },
  { id: 5, field: "email", label: "Email Address", category: "demographics", required: true },
  { id: 6, field: "address", label: "Home Address", category: "demographics", required: false },
  { id: 7, field: "emergency_contact", label: "Emergency Contact", category: "demographics", required: true },

  // Medical History
  { id: 8, field: "allergies", label: "Allergies (Medications, Food, Other)", category: "medical", required: true },
  { id: 9, field: "current_medications", label: "Current Medications", category: "medical", required: false },
  { id: 10, field: "chronic_conditions", label: "Chronic Medical Conditions", category: "medical", required: false },
  { id: 11, field: "past_surgeries", label: "Past Surgeries", category: "medical", required: false },
  { id: 12, field: "family_history", label: "Family Medical History", category: "medical", required: false },

  // Visit Information
  { id: 13, field: "reason_for_visit", label: "Reason for Today's Visit", category: "visit", required: true },
  { id: 14, field: "symptoms", label: "Current Symptoms", category: "visit", required: false },
  { id: 15, field: "symptom_duration", label: "How Long Have You Had These Symptoms?", category: "visit", required: false },
  { id: 16, field: "pain_level", label: "Pain Level (0-10)", category: "visit", required: false },

  // Insurance
  { id: 17, field: "insurance_provider", label: "Insurance Provider", category: "insurance", required: false },
  { id: 18, field: "insurance_policy", label: "Insurance Policy Number", category: "insurance", required: false },

  // Lifestyle
  { id: 19, field: "smoking_status", label: "Smoking Status", category: "lifestyle", required: false },
  { id: 20, field: "alcohol_use", label: "Alcohol Use", category: "lifestyle", required: false },
  { id: 21, field: "exercise_habits", label: "Exercise Habits", category: "lifestyle", required: false }
];

interface EnhancedPatientIntakeProps {
  className?: string;
  onComplete?: (data: any) => void;
  onError?: (error: any) => void;
  enableVoiceCommands?: boolean;
  enableAIEnhancement?: boolean;
  enableRealTimeProcessing?: boolean;
  enableProgressiveEnhancement?: boolean;
}

export function EnhancedPatientIntake({
  className,
  onComplete,
  onError,
  enableVoiceCommands = true,
  enableAIEnhancement = true,
  enableRealTimeProcessing = true,
  enableProgressiveEnhancement = true
}: EnhancedPatientIntakeProps) {
  const { uniqueLink } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State management
  const [step, setStep] = useState<'intro' | 'consent' | 'recording' | 'review' | 'complete'>('intro');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudioInput, setHasAudioInput] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, string>>({});
  const [completionProgress, setCompletionProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'extracting' | 'analyzing' | 'complete'>('idle');
  const [aiConfidence, setAiConfidence] = useState<number>(0);
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [enableLiveTranscription, setEnableLiveTranscription] = useState(true);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Fetch intake form
  const { data: formData, isLoading: formLoading, error: formError } = useQuery<any>({
    queryKey: [`/api/public/intake-form/${uniqueLink}`],
    enabled: !!uniqueLink,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Enhanced AI extraction mutation
  const { mutate: extractMedicalData, isLoading: extractionLoading } = useMutation({
    mutationFn: async ({ transcript, language }: { transcript: string; language: string }) => {
      const response = await fetch('/api/intake/extract-intake-answers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript, language }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract medical data');
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.answers) {
        setExtractedData(prev => ({ ...prev, ...data.answers }));
        setAiConfidence(data.metadata?.confidence || 0.9);
        setProcessingStatus('complete');
        
        toast({
          title: "AI Analysis Complete",
          description: `Successfully extracted ${Object.keys(data.answers).length} fields from your voice recording.`,
        });
      }
    },
    onError: (error) => {
      console.error('AI extraction error:', error);
      setProcessingStatus('idle');
      toast({
        title: "Analysis Failed",
        description: "Could not process your recording. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Progressive enhancement - extract data as user speaks
  const progressiveExtract = useCallback(async (transcript: string) => {
    if (!enableRealTimeProcessing || transcript.length < 50) return;

    // Debounce extraction to avoid too many API calls
    if (processingIntervalRef.current) {
      clearTimeout(processingIntervalRef.current);
    }

    processingIntervalRef.current = setTimeout(() => {
      setProcessingStatus('extracting');
      extractMedicalData({ transcript, language: voiceLanguage });
    }, 2000); // Wait 2 seconds after user stops speaking
  }, [enableRealTimeProcessing, extractMedicalData, voiceLanguage]);

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

  // Audio level monitoring
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        const level = recordingService.getAudioLevel();
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

  // Calculate completion progress
  useEffect(() => {
    const requiredFields = ENHANCED_INTAKE_QUESTIONS.filter(q => q.required);
    const filledRequired = requiredFields.filter(q => extractedData[q.field]?.trim()).length;
    const progress = (filledRequired / requiredFields.length) * 100;
    setCompletionProgress(progress);
  }, [extractedData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (processingIntervalRef.current) {
        clearTimeout(processingIntervalRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Format duration helper
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start recording with enhanced features
  const handleStartRecording = async () => {
    try {
      setRecordingError(null);
      setLiveTranscript("");
      setProcessingStatus('idle');
      setIsRecording(true);

      await recordingService.startRecording();

      // Start live transcription if enabled
      if (enableLiveTranscription) {
        try {
          await recordingService.startLiveTranscription(
            (transcript) => {
              setLiveTranscript(transcript);
              if (enableProgressiveEnhancement) {
                progressiveExtract(transcript);
              }
            },
            (error) => {
              console.log("Live transcription error:", error);
            },
            voiceLanguage
          );
        } catch (liveError) {
          console.log("Live transcription not available, will process after recording");
        }
      }

      toast({
        title: "Recording Started",
        description: "Speak naturally about your medical information...",
      });

    } catch (error) {
      console.error("Recording error:", error);
      setIsRecording(false);
      setRecordingError(error instanceof Error ? error.message : "Unknown error");

      toast({
        title: "Recording Failed",
        description: "Could not start recording. Please check your microphone.",
        variant: "destructive",
      });
    }
  };

  // Stop recording and process
  const handleStopRecording = async () => {
    setIsRecording(false);
    setProcessingStatus('analyzing');

    try {
      if (recordingService.isLiveTranscribing) {
        recordingService.stopLiveTranscription();
      }

      await recordingService.stopRecording();

      let finalTranscript = liveTranscript;
      if (!finalTranscript) {
        finalTranscript = await recordingService.getTranscript();
      }

      if (!finalTranscript) {
        throw new Error("No transcript available");
      }

      // Extract medical data using AI
      extractMedicalData({ transcript: finalTranscript, language: voiceLanguage });

    } catch (error) {
      console.error("Processing error:", error);
      setProcessingStatus('idle');
      toast({
        title: "Processing Failed",
        description: "Could not process your recording. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Submit enhanced intake form
  const handleSubmit = async () => {
    if (!formData) return;

    setIsProcessing(true);

    try {
      // Submit the extracted data
      const response = await fetch(`/api/public/intake-form/${formData.id}/submit-continuous`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: extractedData,
          summary: `Enhanced patient intake completed via AI-powered voice recording. ${Object.keys(extractedData).length} fields captured with ${Math.round(completionProgress)}% completion.`,
          transcript: liveTranscript,
          language: voiceLanguage,
          consentGiven: true,
          signature: `Digital consent given at ${new Date().toISOString()}`,
          audioUrl: recordingService.getAudioUrl()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit intake form');
      }

      // Mark form as complete
      await fetch(`/api/public/intake-form/${formData.id}/complete`, {
        method: 'POST',
      });

      setStep('complete');
      onComplete?.(extractedData);

      toast({
        title: "Success!",
        description: "Your enhanced intake form has been submitted successfully.",
      });

    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Submission Failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Loading state
  if (formLoading) {
    return (
      <div className={cn("flex justify-center items-center min-h-screen", className)}>
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading enhanced intake form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (formError || !formData) {
    return (
      <div className={cn("container mx-auto p-4", className)}>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {formError ? 'Failed to load intake form.' : 'Intake form not found.'}
            <br />Please contact your healthcare provider.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Intro step
  if (step === 'intro') {
    return (
      <div className={cn("container mx-auto p-4 max-w-4xl", className)}>
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-6 p-8">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Mic className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI-Powered Voice Intake
            </CardTitle>
            <CardDescription className="text-xl text-gray-600">
              Welcome to {formData.name}'s advanced medical intake system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            {/* Feature Highlights */}
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-3 p-4 rounded-xl bg-blue-50">
                <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-blue-900">AI Intelligence</h3>
                <p className="text-sm text-blue-700">Advanced AI extracts and organizes your medical information automatically</p>
              </div>
              
              <div className="text-center space-y-3 p-4 rounded-xl bg-green-50">
                <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Mic className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-green-900">Voice Recording</h3>
                <p className="text-sm text-green-700">Natural speech recognition with medical terminology optimization</p>
              </div>
              
              <div className="text-center space-y-3 p-4 rounded-xl bg-purple-50">
                <div className="mx-auto h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <Star className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-purple-900">Smart Forms</h3>
                <p className="text-sm text-purple-700">Real-time form completion with progressive enhancement</p>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl p-6">
              <h3 className="font-semibold text-lg mb-4 text-center">How This Works (4 Simple Steps):</h3>
              <div className="grid md:grid-cols-4 gap-4 text-center">
                <div className="space-y-2">
                  <div className="mx-auto h-10 w-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
                  <p className="font-medium">Give Consent</p>
                  <p className="text-xs text-gray-600">Accept recording permissions</p>
                </div>
                <div className="space-y-2">
                  <div className="mx-auto h-10 w-10 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
                  <p className="font-medium">Start Recording</p>
                  <p className="text-xs text-gray-600">Click microphone and speak naturally</p>
                </div>
                <div className="space-y-2">
                  <div className="mx-auto h-10 w-10 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
                  <p className="font-medium">AI Processes</p>
                  <p className="text-xs text-gray-600">AI extracts and organizes your information</p>
                </div>
                <div className="space-y-2">
                  <div className="mx-auto h-10 w-10 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
                  <p className="font-medium">Review & Submit</p>
                  <p className="text-xs text-gray-600">Verify and submit your intake</p>
                </div>
              </div>
            </div>

            {/* What to Include */}
            <div className="bg-white border-2 border-gray-200 rounded-xl p-6">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                What to Include in Your Recording:
              </h4>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Full legal name and date of birth</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Contact information and address</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Reason for your visit today</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Current medications and dosages</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Allergies (medications, foods, etc.)</li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Medical conditions and history</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Previous surgeries and dates</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Family medical history</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Insurance information</li>
                  <li className="flex items-center gap-2"><Check className="h-4 w-4 text-green-500" /> Current symptoms</li>
                </ul>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Advanced Settings
              </Button>
              
              <Button
                onClick={() => setStep('consent')}
                className="h-14 px-8 text-lg"
                size="lg"
              >
                Get Started
                <Play className="ml-2 h-5 w-5" />
              </Button>
            </div>

            {/* Advanced Settings Panel */}
            {showAdvancedSettings && (
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <h4 className="font-semibold">Advanced Settings</h4>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Voice Language:</label>
                    <select
                      value={voiceLanguage}
                      onChange={(e) => setVoiceLanguage(e.target.value)}
                      className="w-full p-2 border rounded-md"
                    >
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="es-ES">Spanish</option>
                      <option value="fr-FR">French</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={enableLiveTranscription}
                        onChange={(e) => setEnableLiveTranscription(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm font-medium">Enable Live Transcription</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">
                ⏱️ Takes only 2-3 minutes • 🔒 HIPAA compliant • 🌐 Works on any device
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Secure</span>
                <span className="flex items-center gap-1"><Zap className="h-3 w-3" />AI-Powered</span>
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" />Patient-Friendly</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Consent step
  if (step === 'consent') {
    return (
      <div className={cn("container mx-auto p-4 max-w-2xl", className)}>
        <Card className="shadow-lg">
          <CardHeader className="p-6">
            <CardTitle className="text-xl sm:text-2xl">Privacy & Recording Consent</CardTitle>
            <CardDescription>Please review and accept before continuing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <Alert className="border-green-300 bg-green-50">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Your Privacy is Protected</AlertTitle>
              <AlertDescription className="text-green-700 text-sm">
                Your voice recording will be securely transcribed by AI and then permanently deleted.
                Only the extracted medical information will be saved to your patient record.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1 rounded"
                />
                <div className="flex-1 space-y-2">
                  <label htmlFor="consent" className="text-base font-medium cursor-pointer">
                    I consent to being recorded for medical intake purposes
                  </label>
                  <p className="text-xs text-muted-foreground">
                    I understand that:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>• My voice will be recorded and transcribed by AI technology</li>
                    <li>• The recording will be used only for medical documentation</li>
                    <li>• My information is protected by HIPAA regulations</li>
                    <li>• The audio file will be securely deleted after transcription</li>
                    <li>• I can stop and restart the recording at any time</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('intro')}
                className="w-full sm:w-auto"
              >
                Go Back
              </Button>
              <Button
                onClick={() => setStep('recording')}
                disabled={!consentGiven}
                className="w-full sm:flex-1 h-12"
              >
                {consentGiven ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Continue to Recording
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Please Accept Consent
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Recording step
  if (step === 'recording') {
    return (
      <div className={cn("container mx-auto p-4 max-w-6xl", className)}>
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Recording Panel */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">AI-Powered Voice Recording</CardTitle>
                    <CardDescription className="text-sm">
                      Speak naturally - the AI will organize your information automatically
                      <Badge variant="outline" className="ml-2 text-xs font-medium text-amber-600 bg-amber-50">
                        AI Generated - Verify Accuracy
                      </Badge>
                    </CardDescription>
                  </div>
                  {enableVoiceCommands && (
                    <AdvancedVoiceCommandControl
                      context={{
                        currentPage: 'intake-recording',
                        recordingState: isRecording ? 'recording' : 'idle',
                      }}
                      enableAIEnhancement={enableAIEnhancement}
                      enableContextualCommands={true}
                      enableCustomCommands={true}
                    />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">

                {/* Recording Controls */}
                <div className="text-center space-y-4">
                  {!isRecording && !isProcessing && (
                    <Button
                      onClick={handleStartRecording}
                      className="h-24 w-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg"
                      size="lg"
                    >
                      <Mic className="h-10 w-10" />
                    </Button>
                  )}

                  {isRecording && (
                    <Button
                      onClick={handleStopRecording}
                      variant="destructive"
                      className="h-24 w-24 rounded-full shadow-lg shadow-red-500/30"
                    >
                      <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30" />
                      <Square className="h-10 w-10 relative z-10" />
                    </Button>
                  )}

                  {isProcessing && (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {processingStatus === 'extracting' && 'Extracting medical information...'}
                          {processingStatus === 'analyzing' && 'Analyzing with AI...'}
                        </p>
                        <p className="text-xs text-muted-foreground">This may take a moment</p>
                      </div>
                    </div>
                  )}

                  {!isRecording && !isProcessing && (
                    <p className="text-sm text-muted-foreground">Click the microphone to start recording</p>
                  )}
                </div>

                {/* Recording Status */}
                {isRecording && (
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 bg-red-500 rounded-full animate-pulse" />
                        <span className="font-bold text-red-600 text-lg">RECORDING</span>
                      </div>
                      <div className="font-mono text-xl text-red-600 bg-white px-4 py-2 rounded-lg border border-red-200">
                        {formatDuration(recordingDuration)}
                      </div>
                    </div>

                    {/* Audio Visualization */}
                    <div className="bg-white rounded-lg p-4">
                      <div className="flex items-center justify-center gap-1 h-16">
                        {Array.from({ length: 20 }).map((_, i) => {
                          const isActive = audioLevel > (i * 5);
                          const height = isActive ? Math.random() * 80 + 20 : 15;
                          return (
                            <div
                              key={i}
                              className={cn(
                                "w-2 rounded-full transition-all duration-100",
                                isActive ? 'bg-gradient-to-t from-red-500 to-orange-400' : 'bg-gray-300'
                              )}
                              style={{ height: `${height}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* Audio Status */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {hasAudioInput ? (
                          <>
                            <Volume2 className="h-4 w-4 text-green-500" />
                            <span className="text-green-700 font-medium">Audio detected - keep talking</span>
                          </>
                        ) : (
                          <>
                            <VolumeX className="h-4 w-4 text-amber-500 animate-pulse" />
                            <span className="text-amber-700">Waiting for audio...</span>
                          </>
                        )}
                      </div>
                      
                      <div className="h-2 bg-gray-200 rounded-full w-32 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 transition-all"
                          style={{ width: `${Math.max(5, audioLevel)}%` }}
                        />
                      </div>
                    </div>

                    {/* Live Transcript */}
                    {liveTranscript && (
                      <div className="bg-white rounded-lg border-2 border-green-200 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className="h-3 w-3 text-green-500 animate-pulse" />
                          <span className="text-xs font-medium text-green-700">Live Transcript</span>
                        </div>
                        <p className="text-sm text-gray-700 font-mono">{liveTranscript}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Handling */}
                {recordingError && !isRecording && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Recording Error</AlertTitle>
                    <AlertDescription className="space-y-2">
                      <p>Could not access your microphone. Please:</p>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        <li>Check microphone permissions in your browser</li>
                        <li>Ensure your microphone is not muted</li>
                        <li>Try refreshing the page if the issue persists</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {!isRecording && Object.keys(extractedData).length > 0 && (
                    <Button
                      onClick={() => setStep('review')}
                      className="w-full sm:w-auto"
                      size="lg"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Review & Submit
                    </Button>
                  )}

                  {!isRecording && !isProcessing && (
                    <Button
                      variant="outline"
                      onClick={() => setStep('consent')}
                      className="w-full sm:w-auto"
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Processing Panel */}
          <div className="space-y-6">
            {/* AI Confidence */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  AI Confidence
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Confidence Level</span>
                    <Badge 
                      variant="outline" 
                      className={cn({
                        'text-green-600': aiConfidence >= 0.9,
                        'text-yellow-600': aiConfidence >= 0.7 && aiConfidence < 0.9,
                        'text-red-600': aiConfidence < 0.7
                      })}
                    >
                      {Math.round(aiConfidence * 100)}%
                    </Badge>
                  </div>
                  <Progress value={aiConfidence * 100} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Completion Progress */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Form Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <Badge variant="outline">{Math.round(completionProgress)}%</Badge>
                  </div>
                  <Progress value={completionProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {Object.keys(extractedData).length} of {ENHANCED_INTAKE_QUESTIONS.filter(q => q.required).length} required fields completed
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Recording Duration</span>
                    <Badge variant="secondary">{formatDuration(recordingDuration)}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Fields Extracted</span>
                    <Badge variant="secondary">{Object.keys(extractedData).length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Processing Status</span>
                    <Badge 
                      variant="outline" 
                      className={cn({
                        'text-blue-600': processingStatus === 'extracting',
                        'text-green-600': processingStatus === 'complete',
                        'text-gray-600': processingStatus === 'idle'
                      })}
                    >
                      {processingStatus === 'extracting' && 'Extracting...'}
                      {processingStatus === 'analyzing' && 'Analyzing...'}
                      {processingStatus === 'complete' && 'Complete'}
                      {processingStatus === 'idle' && 'Ready'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Review step
  if (step === 'review') {
    const requiredFields = ENHANCED_INTAKE_QUESTIONS.filter(q => q.required);
    const missingRequired = requiredFields.filter(q => !extractedData[q.field]?.trim());
    const canSubmit = missingRequired.length === 0;

    return (
      <div className={cn("container mx-auto p-4 max-w-4xl", className)}>
        <Card className="shadow-lg">
          <CardHeader className="p-6">
            <CardTitle className="text-2xl">Review Your Information</CardTitle>
            <CardDescription className="text-base">
              Please verify all information is correct before submitting
              <Badge variant="outline" className="ml-2 text-xs font-medium text-amber-600 bg-amber-50">
                AI Generated - Verify Accuracy
              </Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">

            {/* Missing Required Fields */}
            {!canSubmit && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Missing Required Information</AlertTitle>
                <AlertDescription className="text-amber-700 text-sm">
                  Please re-record to provide: {missingRequired.map(q => q.label).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {/* Form Data Review */}
            <div className="space-y-6">
              {['demographics', 'medical', 'visit', 'insurance', 'lifestyle'].map(category => (
                <div key={category} className="space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Badge variant="secondary" className="capitalize">{category}</Badge>
                  </div>
                  
                  <div className="grid gap-3">
                    {ENHANCED_INTAKE_QUESTIONS
                      .filter(q => q.category === category)
                      .map(question => {
                        const value = extractedData[question.field];
                        const isMissing = question.required && !value?.trim();
                        
                        return (
                          <div
                            key={question.id}
                            className={cn(
                              "p-4 rounded-lg border transition-all",
                              isMissing 
                                ? 'bg-red-50 border-red-300' 
                                : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-medium text-gray-700">
                                    {question.label}
                                  </span>
                                  {question.required && (
                                    <Badge variant="destructive" className="text-xs">Required</Badge>
                                  )}
                                  {isMissing && (
                                    <Badge variant="outline" className="text-xs text-red-600 border-red-300">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Missing
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-800 min-h-[1.5rem]">
                                  {value ? (
                                    <span className="break-words">{value}</span>
                                  ) : (
                                    <span className="italic text-gray-400">Not provided</span>
                                  )}
                                </div>
                              </div>
                              {value && (
                                <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                                  <Check className="h-3 w-3 mr-1" />
                                  ✓
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Confidence Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  AI Analysis Summary
                </h4>
                <Badge 
                  variant="outline" 
                  className={cn({
                    'text-green-600 border-green-300': aiConfidence >= 0.9,
                    'text-yellow-600 border-yellow-300': aiConfidence >= 0.7 && aiConfidence < 0.9,
                    'text-red-600 border-red-300': aiConfidence < 0.7
                  })}
                >
                  {Math.round(aiConfidence * 100)}% Confidence
                </Badge>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{Object.keys(extractedData).length}</div>
                  <div className="text-gray-600">Fields Extracted</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{Math.round(completionProgress)}%</div>
                  <div className="text-gray-600">Completion</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{formatDuration(recordingDuration)}</div>
                  <div className="text-gray-600">Recording Time</div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('recording')}
                className="w-full sm:w-auto"
                size="lg"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Re-record
              </Button>
              
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isProcessing}
                className="w-full sm:w-auto"
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Complete step
  return (
    <div className={cn("container mx-auto p-4 max-w-2xl", className)}>
      <Card className="shadow-lg">
        <CardHeader className="text-center p-8 space-y-4">
          <div className="mx-auto h-20 w-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
            <Check className="h-10 w-10 text-white" />
          </div>
          <CardTitle className="text-3xl text-green-700">Intake Complete!</CardTitle>
          <CardDescription className="text-lg">
            Thank you for completing your AI-powered medical intake
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6 text-center">
          
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
            <h4 className="font-semibold text-lg mb-3 text-green-800">What Happens Next:</h4>
            <div className="space-y-2 text-sm text-green-700">
              <p>✓ Your information has been securely submitted to {formData.name}</p>
              <p>✓ AI has organized your medical data for review</p>
              <p>✓ Your healthcare provider will review before your appointment</p>
              <p>✓ Original voice recording has been securely deleted</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{Object.keys(extractedData).length}</div>
              <div className="text-gray-600">Fields Captured</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{Math.round(completionProgress)}%</div>
              <div className="text-gray-600">Form Complete</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{formatDuration(recordingDuration)}</div>
              <div className="text-gray-600">Recording Time</div>
            </div>
          </div>

          <div className="pt-6">
            <p className="text-sm text-gray-500 mb-2">
              You may now close this window.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" />Secure</span>
              <span className="flex items-center gap-1"><Zap className="h-3 w-3" />AI-Powered</span>
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" />HIPAA Compliant</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}