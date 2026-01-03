import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, MicOff, Check, Radio, Volume2, VolumeX, AlertCircle, RefreshCw, ShieldCheck, FileText, Activity } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordingService } from "@/lib/recording-service";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

// Full list of 33 questions
const DEFAULT_QUESTIONS = [
  { id: "full_name", text: "Please state your full name.", mandatory: true },
  { id: "date_of_birth", text: "What is your date of birth?", mandatory: true },
  { id: "gender", text: "What is your gender?", mandatory: true },
  { id: "email", text: "What is your email address?", mandatory: true },
  { id: "phone", text: "What is your phone number?", mandatory: true },
  { id: "emergency_contact", text: "Please provide phone number of an emergency contact.", mandatory: true },
  { id: "address", text: "What is your address?", mandatory: false },
  { id: "insurance_provider", text: "Who is your insurance provider?", mandatory: false },
  { id: "insurance_policy_number", text: "What is your insurance policy number?", mandatory: false },
  { id: "policy_holder_name", text: "What is your Policy Holder Name?", mandatory: false },
  { id: "group_number", text: "What is your group number?", mandatory: false },
  { id: "primary_care_physician", text: "Who is your primary care physician?", mandatory: false },
  { id: "current_medications", text: "Please list any medications you are currently taking.", mandatory: false },
  { id: "allergies", text: "Do you have any allergies to medications, food, or other substances?", mandatory: false },
  { id: "chronic_conditions", text: "Do you have any chronic medical conditions?", mandatory: false },
  { id: "past_surgeries", text: "Have you had any surgeries in the past?", mandatory: false },
  { id: "family_medical_history", text: "Is there any significant family medical history we should be aware of?", mandatory: false },
  { id: "reason_for_visit", text: "What brings you in today?", mandatory: false },
  { id: "symptom_description", text: "Can you describe your symptoms in detail?", mandatory: false },
  { id: "symptom_duration", text: "How long have you been experiencing these symptoms?", mandatory: false },
  { id: "symptom_severity", text: "On a scale of 1 to 10, how severe are your symptoms?", mandatory: false },
  { id: "symptoms_before", text: "Have you experienced these symptoms before?", mandatory: false },
  { id: "symptom_triggers", text: "Is there anything that makes the symptoms better or worse?", mandatory: false },
  { id: "occupation", text: "What is your current occupation?", mandatory: false },
  { id: "lifestyle_habits", text: "Do you smoke, drink alcohol, or use recreational drugs?", mandatory: false },
  { id: "exercise_diet", text: "How often do you exercise, and what does your diet typically consist of?", mandatory: false },
  { id: "living_arrangement", text: "Do you live alone, with family, or in another arrangement?", mandatory: false },
  { id: "weight_fever_fatigue", text: "Have you experienced any weight loss, fever, or fatigue recently?", mandatory: false },
  { id: "chest_pain_history", text: "Any history of chest pain, palpitations, or swelling in the legs?", mandatory: false },
  { id: "respiratory_symptoms", text: "Any cough, shortness of breath, or wheezing?", mandatory: false },
  { id: "gastrointestinal_symptoms", text: "Any nausea, vomiting, diarrhea, or constipation?", mandatory: false },
  { id: "musculoskeletal_symptoms", text: "Any joint pain, muscle aches, or weakness?", mandatory: false },
  { id: "neurological_symptoms", text: "Any headaches, dizziness, or numbness?", mandatory: false },
];

// Format recording duration
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Audio waveform visualization
const AudioWaveform: React.FC<{ level: number }> = ({ level }) => {
  const bars = 30;
  const activeCount = Math.floor((level / 100) * bars);

  return (
    <div className="flex items-center justify-center gap-1 h-8">
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < activeCount;
        const height = isActive ? Math.random() * 100 : 20;
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${isActive ? 'bg-red-500' : 'bg-gray-200'
              }`}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
};

export default function PatientJoinPage() {
  const { uniqueLink } = useParams();
  const { toast } = useToast();

  // States
  const [step, setStep] = useState<'intro' | 'consent' | 'form' | 'complete'>('intro');
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
    const requiredFields = DEFAULT_QUESTIONS.filter(q => q.mandatory);
    const filledRequired = requiredFields.filter(q => extractedData[q.id]?.trim()).length;
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

  // Stop recording and final process
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

      if (finalTranscript) {
        // Final extraction pass
        await autoExtractFields(finalTranscript);
      }

      toast({
        title: "Recording Paused",
        description: "Review your answers and continue recording if needed.",
      });

    } catch (error) {
      console.error("Processing error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-extract fields using AI
  const autoExtractFields = async (transcript: string) => {
    if (transcript.length < 20) return;

    try {
      const response = await apiRequest("POST", "/api/ai/extract-intake-answers", {
        transcript,
        language: 'en-US',
        // Pass the question IDs we are looking for
        questions: DEFAULT_QUESTIONS.map(q => q.id)
      });

      const data = await response.json();

      if (data.answers) {
        setExtractedData(prev => ({ ...prev, ...data.answers }));
      }
    } catch (error) {
      console.log("Auto-extract error:", error);
    }
  };

  // Manual input handler
  const handleInputChange = (id: string, value: string) => {
    setExtractedData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  // Submit form
  const handleSubmit = async () => {
    if (!formData) return;

    const requiredFields = DEFAULT_QUESTIONS.filter(q => q.mandatory);
    const missingRequired = requiredFields.filter(q => !extractedData[q.id]?.trim());

    if (missingRequired.length > 0) {
        toast({
            title: "Missing Information",
            description: `Please fill in: ${missingRequired.slice(0, 3).map(q => q.text.split('?')[0]).join(', ')}...`,
            variant: "destructive"
        });
        return;
    }

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
      <div className="container mx-auto p-4 max-w-2xl min-h-screen flex items-center justify-center">
        <Card className="shadow-xl border-t-4 border-t-primary w-full">
          <CardHeader className="text-center space-y-4 p-8">
            <div className="mx-auto h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
              <Mic className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold">Voice Intake Form</CardTitle>
            <CardDescription className="text-lg">
              Welcome to {formData.name}'s medical intake
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-8">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2 text-lg">
                <ShieldCheck className="h-6 w-6" />
                Easy & Secure Process
              </h3>
              <p className="text-blue-800">
                  Instead of typing, you can simply <strong>talk naturally</strong>. Our secure AI will listen and fill out the form for you automatically.
              </p>
              <ul className="grid grid-cols-1 gap-2 text-sm text-blue-800 ml-1">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600"/> Speak in any order</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600"/> Review before submitting</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-blue-600"/> HIPAA Compliant & Secure</li>
              </ul>
            </div>

            <Button
              onClick={() => setStep('consent')}
              className="w-full h-14 text-lg font-semibold shadow-md transition-all hover:scale-[1.02]"
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
      <div className="container mx-auto p-4 max-w-2xl min-h-screen flex items-center justify-center">
        <Card className="shadow-xl w-full">
          <CardHeader className="p-8">
            <CardTitle className="text-2xl">Privacy Consent</CardTitle>
            <CardDescription>Required for voice processing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-8 pt-0">
            <div className="space-y-4 bg-gray-50 p-6 rounded-xl border">
              <div className="flex items-start gap-4">
                <Checkbox
                  id="consent"
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                  className="mt-1 h-6 w-6"
                />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="consent" className="text-lg font-medium cursor-pointer leading-tight">
                    I consent to being recorded for medical documentation
                  </Label>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Your voice recording will be securely transcribed by AI to complete your medical intake form. The audio is encrypted and used solely for this medical encounter.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                variant="ghost"
                onClick={() => setStep('intro')}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep('form')}
                disabled={!consentGiven}
                className="w-full sm:flex-1 h-12 text-lg"
              >
                Continue to Form
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // COMPLETE STEP
  if (step === 'complete') {
    return (
      <div className="container mx-auto p-4 max-w-2xl min-h-screen flex items-center justify-center">
        <Card className="shadow-xl border-t-4 border-t-green-500 w-full text-center">
          <CardHeader className="p-10 space-y-6">
            <div className="mx-auto h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-3xl text-green-800">All Done!</CardTitle>
            <CardDescription className="text-xl">
              Your intake form has been successfully submitted.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-10 pt-0">
            <p className="text-muted-foreground mb-8">
              Your healthcare provider has received your information. You may now close this page.
            </p>
            <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                className="w-full"
            >
                Start New Form
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MAIN FORM STEP (LIST VIEW)
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Sticky Header with Recording Controls */}
      <div className="sticky top-0 z-50 bg-white shadow-md border-b">
        <div className="container mx-auto max-w-4xl p-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900 hidden sm:block">Intake Form</h2>
                    <div className="flex items-center gap-2">
                        <Progress value={completionProgress} className="h-2 w-24 sm:w-40" />
                        <span className="text-xs font-medium text-gray-600">{Math.round(completionProgress)}%</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {isRecording ? (
                        <div className="flex items-center gap-3 bg-red-50 px-4 py-2 rounded-full border border-red-100">
                            <div className="relative">
                                <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
                                <div className="h-3 w-3 bg-red-600 rounded-full"></div>
                            </div>
                            <span className="font-mono font-medium text-red-600 w-12">{formatDuration(recordingDuration)}</span>
                            <div className="hidden sm:block w-24">
                                <AudioWaveform level={audioLevel} />
                            </div>
                            <Button 
                                onClick={handleStopRecording} 
                                variant="destructive" 
                                size="sm"
                                className="h-8 px-3 rounded-full"
                            >
                                Stop
                            </Button>
                        </div>
                    ) : (
                        <Button 
                            onClick={handleStartRecording} 
                            className={`rounded-full gap-2 transition-all ${isProcessing ? 'opacity-80' : 'hover:scale-105'}`}
                            disabled={isProcessing}
                        >
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                            {isProcessing ? 'Processing...' : 'Start Recording'}
                        </Button>
                    )}
                </div>
            </div>
            
            {/* Live Transcript Preview (visible when recording) */}
            {isRecording && liveTranscript && (
                <div className="mt-2 text-xs text-gray-500 truncate border-t pt-2">
                    <span className="font-semibold text-primary">Live: </span> "{liveTranscript.slice(-100)}"
                </div>
            )}
        </div>
      </div>

      <div className="container mx-auto max-w-4xl p-4 space-y-6 mt-4">
        {/* Intro Banner */}
        <Alert className="bg-blue-50 border-blue-200">
            <FileText className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-medium">Voice Mode Active</AlertTitle>
            <AlertDescription className="text-blue-700 text-sm">
                Scroll down and verify the questions. You can speak naturally to fill them out, or type if you prefer.
            </AlertDescription>
        </Alert>

        {/* Questions List */}
        <div className="space-y-4">
            {DEFAULT_QUESTIONS.map((question, index) => {
                const value = extractedData[question.id] || "";
                const isFilled = value.length > 0;
                
                return (
                    <Card key={question.id} id={question.id} className={`transition-all duration-300 ${isFilled ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
                        <CardHeader className="p-4 pb-2">
                            <div className="flex items-start gap-3">
                                <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-xs font-bold text-gray-600 mt-0.5">
                                    {index + 1}
                                </span>
                                <div className="flex-1">
                                    <Label htmlFor={`q-${question.id}`} className="text-base font-medium text-gray-900 block leading-tight">
                                        {question.text}
                                        {question.mandatory && <span className="text-red-500 ml-1">*</span>}
                                    </Label>
                                </div>
                                {isFilled && <Check className="h-5 w-5 text-green-500 flex-shrink-0 animate-in zoom-in" />}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                            {['symptom_description', 'current_medications', 'family_medical_history'].includes(question.id) ? (
                                <Textarea 
                                    id={`q-${question.id}`}
                                    placeholder={isRecording ? "Listening..." : "Type or say your answer..."}
                                    value={value}
                                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                                    className={`min-h-[80px] bg-white ${isFilled ? 'border-green-200' : ''}`}
                                />
                            ) : (
                                <Input 
                                    id={`q-${question.id}`}
                                    placeholder={isRecording ? "Listening..." : "Type or say your answer..."}
                                    value={value}
                                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                                    className={`bg-white ${isFilled ? 'border-green-200' : ''}`}
                                />
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>

        {/* Bottom Submit Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 shadow-lg z-40">
            <div className="container mx-auto max-w-4xl flex items-center justify-between gap-4">
                <div className="hidden sm:block text-sm text-muted-foreground">
                    {Math.round(completionProgress)}% Complete
                </div>
                <Button 
                    size="lg" 
                    className="w-full sm:w-auto ml-auto text-lg px-8 shadow-md"
                    onClick={handleSubmit}
                    disabled={isRecording || isProcessing}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Analyzing & Submitting...
                        </>
                    ) : (
                        <>
                            Submit Intake
                            <Check className="ml-2 h-5 w-5" />
                        </>
                    )}
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
