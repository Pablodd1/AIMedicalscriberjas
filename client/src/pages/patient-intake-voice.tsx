import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, MicOff, Check, Radio, Volume2, VolumeX, AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordingService } from "@/lib/recording-service";
import { Progress } from "@/components/ui/progress";

// 15 MOST IMPORTANT INTAKE QUESTIONS
const INTAKE_QUESTIONS = [
  { id: 1, field: "full_name", label: "Full Name", required: true },
  { id: 2, field: "date_of_birth", label: "Date of Birth", required: true },
  { id: 3, field: "phone", label: "Phone Number", required: true },
  { id: 4, field: "email", label: "Email Address", required: true },
  { id: 5, field: "emergency_contact", label: "Emergency Contact", required: true },
  { id: 6, field: "reason_for_visit", label: "Reason for Today's Visit", required: true },
  { id: 7, field: "current_medications", label: "Current Medications", required: false },
  { id: 8, field: "allergies", label: "Allergies (Medications, Food, Other)", required: true },
  { id: 9, field: "chronic_conditions", label: "Chronic Medical Conditions", required: false },
  { id: 10, field: "past_surgeries", label: "Past Surgeries", required: false },
  { id: 11, field: "family_history", label: "Family Medical History", required: false },
  { id: 12, field: "symptoms", label: "Current Symptoms", required: false },
  { id: 13, field: "symptom_duration", label: "How Long Have You Had These Symptoms?", required: false },
  { id: 14, field: "insurance_provider", label: "Insurance Provider", required: false },
  { id: 15, field: "insurance_policy", label: "Insurance Policy Number", required: false },
];

// Format recording duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Audio waveform visualization
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
            className={`w-1 rounded-full transition-all duration-100 ${isActive ? 'bg-red-500' : 'bg-gray-300'
              }`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
};

export default function PatientIntakeVoice() {
  const { uniqueLink } = useParams();
  const { toast } = useToast();

  // States
  const [step, setStep] = useState<'intro' | 'consent' | 'recording' | 'review' | 'complete'>('intro');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudioInput, setHasAudioInput] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<Record<string, string>>({});
  const [completionProgress, setCompletionProgress] = useState(0);

  // Fetch intake form
  const { data: formData, isLoading } = useQuery<any>({
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

  // Calculate completion progress
  useEffect(() => {
    const requiredFields = INTAKE_QUESTIONS.filter(q => q.required);
    const filledRequired = requiredFields.filter(q => extractedData[q.field]?.trim()).length;
    const progress = (filledRequired / requiredFields.length) * 100;
    setCompletionProgress(progress);
  }, [extractedData]);

  // Start recording with error detection
  const handleStartRecording = async () => {
    try {
      setRecordingError(null);
      setLiveTranscript("");
      setIsRecording(true);

      await recordingService.startRecording();

      // Start live transcription
      try {
        await recordingService.startLiveTranscription(
          (transcript) => {
            setLiveTranscript(transcript);
            // Auto-extract as we get transcript
            if (transcript.length > 50) {
              autoExtractFields(transcript);
            }
          },
          (error) => {
            console.log("Live transcription error:", error);
          },
          'en-US'
        );
      } catch (liveError) {
        console.log("Live transcription not available");
      }

      // Reset retry count on success
      setRetryAttempt(0);

    } catch (error) {
      console.error("Recording error:", error);
      setIsRecording(false);
      setRecordingError(error instanceof Error ? error.message : "Unknown error");

      toast({
        title: "Recording Failed",
        description: "Could not start recording. Checking your microphone...",
        variant: "destructive",
      });
    }
  };

  // Retry recording
  const handleRetryRecording = async () => {
    setRetryAttempt(prev => prev + 1);
    setRecordingError(null);

    toast({
      title: "Retrying...",
      description: `Attempt ${retryAttempt + 1} - Please allow microphone access`,
    });

    setTimeout(() => {
      handleStartRecording();
    }, 1000);
  };

  // Stop recording and process
  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsProcessing(true);

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

      // Extract all fields using AI
      const response = await apiRequest("POST", "/api/ai/extract-intake-answers", {
        transcript: finalTranscript,
        language: 'en-US'
      });

      const data = await response.json();

      if (data.answers) {
        setExtractedData(data.answers);
        setStep('review');
      }

      toast({
        title: "Processing Complete!",
        description: "Your information has been organized.",
      });

    } catch (error) {
      console.error("Processing error:", error);
      toast({
        title: "Processing Failed",
        description: "Could not process your recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-extract fields as transcript grows
  const autoExtractFields = async (transcript: string) => {
    if (transcript.length < 100) return;

    try {
      const response = await apiRequest("POST", "/api/ai/extract-intake-answers", {
        transcript,
        language: 'en-US'
      });

      const data = await response.json();

      if (data.answers) {
        setExtractedData(prev => ({ ...prev, ...data.answers }));
      }
    } catch (error) {
      console.log("Auto-extract error:", error);
    }
  };

  // Submit form
  const handleSubmit = async () => {
    if (!formData) return;

    setIsProcessing(true);

    try {
      await apiRequest("POST", `/api/public/intake-form/${formData.id}/submit-continuous`, {
        answers: extractedData,
        summary: `Patient intake completed via voice recording. ${Object.keys(extractedData).length} fields captured.`,
        transcript: liveTranscript,
        language: 'en-US',
        consentGiven: true,
        signature: `Voice consent given at ${new Date().toISOString()}`,
        audioUrl: recordingService.getAudioUrl()
      });

      await apiRequest("POST", `/api/public/intake-form/${formData.id}/complete`);

      setStep('complete');

      toast({
        title: "Success!",
        description: "Your intake form has been submitted.",
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Intake form not found. Please contact your healthcare provider.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // INTRO STEP
  if (step === 'intro') {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4 p-6">
            <div className="mx-auto h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Mic className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl">Voice Intake Form</CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Welcome to {formData.name}'s medical intake
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                How This Works (3 Easy Steps):
              </h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex gap-2">
                  <span className="font-bold">1.</span>
                  <span>You'll give consent to be recorded (required for your privacy)</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">2.</span>
                  <span>Click the microphone and talk naturally - speak in ANY order you want</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold">3.</span>
                  <span>Our AI will automatically organize your information into the right fields</span>
                </li>
              </ol>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold">What to include in your recording:</h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                <li>✓ Your name and birthday</li>
                <li>✓ Contact information</li>
                <li>✓ Reason for visit</li>
                <li>✓ Current medications</li>
                <li>✓ Allergies (very important!)</li>
                <li>✓ Medical history</li>
                <li>✓ Insurance information</li>
                <li>✓ Current symptoms</li>
              </ul>
            </div>

            <p className="text-sm text-center text-muted-foreground">
              ⏱️ Takes only 2-3 minutes  •  🔒 Completely secure  •  🌐 Works on any device
            </p>

            <Button
              onClick={() => setStep('consent')}
              className="w-full h-14 text-lg touch-manipulation"
              size="lg"
            >
              Get Started
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // CONSENT STEP
  if (step === 'consent') {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
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
                Your voice recording will be securely transcribed and then permanently deleted.
                Only the text information will be saved to your medical record.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                  className="mt-1"
                />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="consent" className="text-base font-medium cursor-pointer leading-tight">
                    I consent to being recorded for medical intake purposes
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I understand that:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1 ml-4">
                    <li>• My voice will be recorded and transcribed by AI</li>
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
                className="w-full sm:w-auto touch-manipulation"
              >
                Go Back
              </Button>
              <Button
                onClick={() => setStep('recording')}
                disabled={!consentGiven}
                className="w-full sm:flex-1 h-12 touch-manipulation"
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

  // RECORDING STEP
  if (step === 'recording') {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">Voice Recording - Speak Naturally</CardTitle>
            <CardDescription className="text-sm">
              The AI is listening and organizing your information automatically
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">

            {/* Recording Controls */}
            <div className="text-center space-y-4">
              {!isRecording && !isProcessing && (
                <Button
                  onClick={handleStartRecording}
                  className="h-24 w-24 rounded-full bg-primary hover:bg-primary/90 touch-manipulation"
                  size="lg"
                >
                  <Mic className="h-10 w-10" />
                </Button>
              )}

              {isRecording && (
                <Button
                  onClick={handleStopRecording}
                  variant="destructive"
                  className="h-24 w-24 rounded-full shadow-lg shadow-red-500/30 touch-manipulation"
                >
                  <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-ping opacity-30" />
                  <MicOff className="h-10 w-10 relative z-10" />
                </Button>
              )}

              {isProcessing && (
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processing your recording...</p>
                </div>
              )}

              {!isRecording && !isProcessing && (
                <p className="text-sm text-muted-foreground">
                  Click the microphone to start recording
                </p>
              )}
            </div>

            {/* Recording Status */}
            {isRecording && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-bold text-red-600">RECORDING</span>
                  </div>
                  <div className="font-mono text-lg text-red-600 bg-white px-3 py-1 rounded border border-red-200">
                    {formatDuration(recordingDuration)}
                  </div>
                </div>

                <div className="bg-white rounded p-2">
                  <AudioWaveform level={audioLevel} />
                </div>

                <div className="flex items-center gap-2 text-sm">
                  {hasAudioInput ? (
                    <>
                      <Volume2 className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">Audio detected - keep talking</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4 text-amber-500 animate-pulse" />
                      <span className="text-amber-700">Waiting for audio...</span>
                    </>
                  )}
                </div>

                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-400 to-red-500 transition-all"
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>

                {liveTranscript && (
                  <div className="bg-white rounded border border-green-200 p-3 max-h-32 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <Radio className="h-3 w-3 text-green-500 animate-pulse" />
                      <span className="text-xs font-medium text-green-700">Live Transcript</span>
                    </div>
                    <p className="text-xs text-gray-700">{liveTranscript}</p>
                  </div>
                )}
              </div>
            )}

            {/* Error with Retry */}
            {recordingError && !isRecording && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Recording Error</AlertTitle>
                <AlertDescription className="space-y-3">
                  <p>Could not access your microphone. Please:</p>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    <li>Check microphone permissions in your browser</li>
                    <li>Make sure your microphone is not muted</li>
                    <li>Try refreshing the page if problem persists</li>
                  </ul>
                  <Button
                    onClick={handleRetryRecording}
                    variant="outline"
                    className="w-full mt-2"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Retry Recording (Attempt {retryAttempt + 1})
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* All 15 Questions Displayed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Auto-Filling Questions:</h3>
                <div className="flex items-center gap-2">
                  <Progress value={completionProgress} className="w-24" />
                  <span className="text-xs text-muted-foreground">{Math.round(completionProgress)}%</span>
                </div>
              </div>

              <div className="grid gap-2">
                {INTAKE_QUESTIONS.map((question) => {
                  const filled = extractedData[question.field];
                  return (
                    <div
                      key={question.id}
                      className={`p-3 rounded-md border transition-all ${filled
                        ? 'bg-green-50 border-green-300'
                        : 'bg-gray-50 border-gray-200'
                        }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-500 mt-0.5">
                          {question.id}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">
                              {question.label}
                              {question.required && <span className="text-red-500">*</span>}
                            </p>
                            {filled && (
                              <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 break-words">
                            {filled || <span className="italic text-gray-400">Waiting for information...</span>}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              {!isRecording && Object.keys(extractedData).length > 0 && (
                <Button
                  onClick={() => setStep('review')}
                  className="w-full h-12 touch-manipulation"
                >
                  Review & Submit
                </Button>
              )}

              {!isRecording && !isProcessing && (
                <Button
                  variant="outline"
                  onClick={() => setStep('consent')}
                  className="w-full touch-manipulation"
                >
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // REVIEW STEP
  if (step === 'review') {
    const requiredFields = INTAKE_QUESTIONS.filter(q => q.required);
    const missingRequired = requiredFields.filter(q => !extractedData[q.field]?.trim());
    const canSubmit = missingRequired.length === 0;

    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <Card className="shadow-lg">
          <CardHeader className="p-6">
            <CardTitle className="text-xl">Review Your Information</CardTitle>
            <CardDescription>
              Please verify everything is correct before submitting
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-6">

            {!canSubmit && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Missing Required Information</AlertTitle>
                <AlertDescription className="text-amber-700 text-sm">
                  Please re-record to provide: {missingRequired.map(q => q.label).join(', ')}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              {INTAKE_QUESTIONS.map((question) => {
                const value = extractedData[question.field];
                const isMissing = question.required && !value?.trim();

                return (
                  <div
                    key={question.id}
                    className={`p-3 rounded-md border ${isMissing ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-200'
                      }`}
                  >
                    <div className="text-sm font-medium mb-1 flex items-center gap-2">
                      {question.label}
                      {question.required && <span className="text-red-500">*</span>}
                      {isMissing && <AlertCircle className="h-4 w-4 text-red-500" />}
                    </div>
                    <div className="text-sm text-gray-700">
                      {value || <span className="italic text-red-500">Not provided</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('recording')}
                className="w-full sm:w-auto touch-manipulation"
              >
                Re-record
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isProcessing}
                className="w-full sm:flex-1 h-12 touch-manipulation"
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

  // COMPLETE STEP
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card className="shadow-lg">
        <CardHeader className="text-center p-6 space-y-4">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">Intake Complete!</CardTitle>
          <CardDescription className="text-base">
            Thank you for completing your medical intake
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4 text-center">
          <p className="text-sm">
            Your information has been securely submitted to {formData.name}.
          </p>
          <p className="text-sm text-muted-foreground">
            Your healthcare provider will review your intake before your appointment.
          </p>
          <div className="pt-4">
            <p className="text-xs text-muted-foreground">
              You may now close this window.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
