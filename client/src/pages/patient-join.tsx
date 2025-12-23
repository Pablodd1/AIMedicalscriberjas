import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, MicOff, Send, Check, Radio, Volume2, VolumeX, Activity, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordingService } from "@/lib/recording-service";

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

// Recording troubleshooting component
const RecordingTroubleshoot: React.FC = () => (
  <Alert className="mt-3 border-amber-300 bg-amber-50">
    <AlertCircle className="h-4 w-4 text-amber-600" />
    <AlertTitle className="text-amber-800">Recording Issue</AlertTitle>
    <AlertDescription className="text-amber-700 text-sm">
      <ul className="list-disc list-inside space-y-1 mt-2">
        <li>Check that your microphone is connected and not muted</li>
        <li>Grant microphone permissions when prompted by your browser</li>
        <li>Try refreshing the page if the issue persists</li>
        <li>As an alternative, you can type your answer instead</li>
      </ul>
    </AlertDescription>
  </Alert>
);

// Array of standard intake questions
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

export default function PatientJoinPage() {
  const { uniqueLink } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionResponses, setQuestionResponses] = useState<Record<string, { 
    answer: string, 
    answerType: string, 
    audioUrl?: string,
    questionId: number,
    question: string 
  }>>({});

  // Function to submit a voice response
  const submitVoiceResponse = async (questionId: number, question: string, audioUrl: string) => {
    try {
      const response = await fetch(`/api/public/intake-form/${formData?.id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionId,
          question,
          answer: '',
          answerType: 'voice',
          audioUrl
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit voice response');
      }

      toast({
        title: 'Voice response saved',
        description: 'Your voice response has been saved successfully.',
      });
    } catch (error) {
      console.error('Error submitting voice response:', error);
      toast({
        title: 'Error',
        description: 'Failed to save voice response. Please try again.',
        variant: 'destructive',
      });
    }
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const [formComplete, setFormComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Recording state variables
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasAudioInput, setHasAudioInput] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  
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
  
  // Fetch intake form details by unique link
  const { data: formData, isLoading, error } = useQuery<IntakeForm>({
    queryKey: [`/api/public/intake-form/${uniqueLink}`],
    enabled: !!uniqueLink,
  });

  // Update audio in the questionResponses when recording stops
  useEffect(() => {
    if (!isRecording && recordingService.isRecording) {
      (async () => {
        try {
          await recordingService.stopRecording();
          const transcript = await recordingService.getTranscript();
          
          if (transcript) {
            const currentQuestionData = DEFAULT_QUESTIONS[currentQuestion];
            setQuestionResponses(prev => ({
              ...prev,
              [currentQuestionData.id]: {
                ...prev[currentQuestionData.id],
                answer: transcript,
                answerType: "audio"
              }
            }));
            
            // Automatically focus and populate the textarea
            if (textareaRef.current) {
              textareaRef.current.value = transcript;
              textareaRef.current.focus();
            }
          }
        } catch (error) {
          console.error("Error processing audio:", error);
          toast({
            title: "Audio processing failed",
            description: "We couldn't process your audio. Please try again or type your answer.",
            variant: "destructive",
          });
        }
      })();
    }
  }, [isRecording, currentQuestion, toast]);

  // Update the allQuestionsAnswered state whenever questionResponses changes
  useEffect(() => {
    // Check if all mandatory questions have answers
    const mandatoryQuestions = DEFAULT_QUESTIONS.filter(q => q.mandatory);
    const allMandatoryAnswered = mandatoryQuestions.every(q => 
      questionResponses[q.id] && questionResponses[q.id].answer.trim().length > 0
    );
    setAllQuestionsAnswered(allMandatoryAnswered);
  }, [questionResponses]);

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

  // Simulate audio level (in a real implementation, you'd use Web Audio API)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRecording) {
      interval = setInterval(() => {
        // Simulate audio level between 0-100
        const level = Math.random() * 100;
        setAudioLevel(level);
        setHasAudioInput(level > 5); // Consider input if level > 5%
      }, 100);
    } else {
      setAudioLevel(0);
      setHasAudioInput(false);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  // Start audio recording
  const handleStartRecording = async () => {
    try {
      setRecordingError(null);
      setLiveTranscript("");
      setIsRecording(true);
      await recordingService.startRecording();
      
      // Try to start live transcription if available
      try {
        await recordingService.startLiveTranscription(
          (transcript) => {
            setLiveTranscript(transcript);
          },
          (error) => {
            console.log("Live transcription error:", error);
            // Don't show error to user, will transcribe after recording
          }
        );
      } catch (liveError) {
        // Live transcription not supported, will use post-recording transcription
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

  // Stop audio recording
  const handleStopRecording = async () => {
    setIsRecording(false);
    
    // Stop live transcription if it was running
    if (recordingService.isLiveTranscribing) {
      recordingService.stopLiveTranscription();
    }
  };

  // Save the current question's answer
  const saveCurrentAnswer = () => {
    if (!textareaRef.current) return false;
    
    const answer = textareaRef.current.value.trim();
    const currentQuestionData = DEFAULT_QUESTIONS[currentQuestion];
    
    // Check if mandatory field is empty
    if (currentQuestionData.mandatory && answer.length === 0) {
      toast({
        title: "Required field",
        description: "This question is mandatory. Please provide an answer before continuing.",
        variant: "destructive",
      });
      return false;
    }
    
    if (answer.length === 0) return true; // Allow skipping optional questions
    
    setQuestionResponses(prev => ({
      ...prev,
      [currentQuestionData.id]: {
        ...prev[currentQuestionData.id],
        answer,
        answerType: prev[currentQuestionData.id]?.answerType || "text",
        questionId: currentQuestion + 1,
        question: currentQuestionData.text
      }
    }));
    
    // If not the last question, go to next question
    if (currentQuestion < DEFAULT_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      // Clear the textarea for the next question
      if (textareaRef.current) {
        textareaRef.current.value = questionResponses[DEFAULT_QUESTIONS[currentQuestion + 1]?.id]?.answer || "";
      }
    }
    
    return true;
  };

  // Navigate to previous question
  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      // Set the textarea value to the previous question's answer
      if (textareaRef.current) {
        const prevQuestionId = DEFAULT_QUESTIONS[currentQuestion - 1].id;
        textareaRef.current.value = questionResponses[prevQuestionId]?.answer || "";
      }
    }
  };

  // Navigate to next question
  const handleNextQuestion = () => {
    // Save current answer first - only proceed if validation passes
    const isValid = saveCurrentAnswer();
    if (!isValid) return;
  };

  // Submit all answers to complete the form
  const handleCompleteForm = async () => {
    if (!formData) return;
    
    // Validate current answer before submitting
    const isValid = saveCurrentAnswer();
    if (!isValid) return;
    
    // Check all mandatory fields one more time
    const mandatoryQuestions = DEFAULT_QUESTIONS.filter(q => q.mandatory);
    const missingMandatory = mandatoryQuestions.filter(q => 
      !questionResponses[q.id] || !questionResponses[q.id].answer.trim()
    );
    
    if (missingMandatory.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please answer all mandatory questions before submitting. Missing: ${missingMandatory.map(q => `Q${DEFAULT_QUESTIONS.indexOf(q) + 1}`).join(', ')}`,
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Submit each question response
      for (const question of DEFAULT_QUESTIONS) {
        const response = questionResponses[question.id];
        if (response && response.answer) {
          await apiRequest("POST", `/api/public/intake-form/${formData.id}/responses`, {
            questionId: question.id,
            question: question.text,
            answer: response.answer,
            answerType: response.answerType || "text",
            audioUrl: response.audioUrl
          });
        }
      }
      
      // Mark the form as completed
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
      setIsSubmitting(false);
    }
  };

  // When the textarea input changes, update the current question response
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const currentQuestionData = DEFAULT_QUESTIONS[currentQuestion];
    setQuestionResponses(prev => ({
      ...prev,
      [currentQuestionData.id]: {
        ...prev[currentQuestionData.id],
        answer: e.target.value,
        answerType: "text"
      }
    }));
  };

  // Load existing answer for current question when changing questions
  useEffect(() => {
    if (textareaRef.current) {
      const currentQuestionData = DEFAULT_QUESTIONS[currentQuestion];
      textareaRef.current.value = questionResponses[currentQuestionData.id]?.answer || "";
    }
  }, [currentQuestion, questionResponses]);

  // If there's an error or the form is still loading
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
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <Card className="max-w-3xl mx-auto shadow-lg">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg sm:text-xl md:text-2xl">Patient Intake Form</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Welcome to {formData.name}'s online intake form. Please answer each question either by typing or using voice input.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2 gap-2">
              <h3 className="text-base sm:text-lg font-medium">
                Question {currentQuestion + 1} of {DEFAULT_QUESTIONS.length}
              </h3>
              <div className="text-xs sm:text-sm text-muted-foreground">
                {Object.keys(questionResponses).length} of {DEFAULT_QUESTIONS.length} completed
              </div>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary"
                style={{ width: `${(Object.keys(questionResponses).length / DEFAULT_QUESTIONS.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="mb-6">
            <Label className="text-base sm:text-lg mb-2 block break-words">
              {DEFAULT_QUESTIONS[currentQuestion].text}
              {DEFAULT_QUESTIONS[currentQuestion].mandatory && (
                <span className="text-red-500 ml-1">*</span>
              )}
            </Label>
            {DEFAULT_QUESTIONS[currentQuestion].mandatory && (
              <p className="text-xs sm:text-sm text-muted-foreground mb-2">This field is required</p>
            )}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
              <div className="flex-1 min-w-0">
                <Textarea 
                  ref={textareaRef}
                  placeholder="Type your answer here or click the microphone to record..."
                  className="h-32 sm:h-40 text-sm sm:text-base"
                  onChange={handleTextareaChange}
                  defaultValue={questionResponses[DEFAULT_QUESTIONS[currentQuestion].id]?.answer || ""}
                  data-testid="intake-answer-textarea"
                />
              </div>
              <div className="flex justify-center sm:block">
                {isRecording ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={handleStopRecording}
                    className="h-12 w-12 sm:h-14 sm:w-14 relative shadow-lg shadow-red-500/30 touch-manipulation flex-shrink-0"
                    data-testid="button-stop-recording"
                    aria-label="Stop recording"
                  >
                    {/* Pulsing animation */}
                    <span className="absolute inset-0 rounded-md border-2 border-red-500 animate-ping opacity-30" />
                    <span className="absolute inset-1 rounded-md bg-red-500/20 animate-pulse" />
                    <MicOff className="h-5 w-5 sm:h-6 sm:w-6 relative z-10" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleStartRecording}
                    className="h-12 w-12 sm:h-14 sm:w-14 hover:bg-primary/10 hover:border-primary transition-all touch-manipulation flex-shrink-0"
                    data-testid="button-start-recording"
                    aria-label="Start recording"
                  >
                    <Mic className="h-5 w-5 sm:h-6 sm:w-6" />
                  </Button>
                )}
              </div>
            </div>
            {/* Enhanced Recording Status Display */}
            {isRecording && (
              <div className="mt-4 p-4 rounded-lg border-2 border-red-200 bg-red-50">
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
                        <span className="animate-pulse">●</span> REC
                      </span>
                      <span className="text-xs text-red-500">Live Recording</span>
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
                <div className="flex items-center gap-2 text-sm">
                  {hasAudioInput ? (
                    <>
                      <Volume2 className="h-4 w-4 text-green-500" />
                      <span className="text-green-700">Audio detected - speak clearly</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4 text-amber-500 animate-pulse" />
                      <span className="text-amber-700">Waiting for audio... speak into microphone</span>
                    </>
                  )}
                </div>
                
                {/* Audio Level Bar */}
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full transition-all duration-75 rounded-full bg-gradient-to-r from-red-400 to-red-500"
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>
                
                {/* Live Transcript Preview */}
                {liveTranscript && (
                  <div className="mt-3 p-2 bg-white rounded border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-3 w-3 text-green-500" />
                      <span className="text-xs font-medium text-green-700">Live Transcript</span>
                    </div>
                    <p className="text-sm text-gray-700 italic">"{liveTranscript.slice(-100)}..."</p>
                  </div>
                )}
                
                {/* Warning if no audio detected */}
                {!hasAudioInput && recordingDuration > 3 && (
                  <Alert className="mt-3 border-amber-300 bg-amber-50">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 text-sm">
                      No audio detected. Check your microphone is working and not muted.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Recording Error */}
            {recordingError && !isRecording && (
              <RecordingTroubleshoot />
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevQuestion}
              disabled={currentQuestion === 0}
              data-testid="button-previous-question"
              className="w-full sm:w-auto touch-manipulation min-h-[44px] text-sm sm:text-base"
            >
              Previous
            </Button>
            {currentQuestion < DEFAULT_QUESTIONS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNextQuestion}
                data-testid="button-next-question"
                className="w-full sm:w-auto touch-manipulation min-h-[44px] text-sm sm:text-base"
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!allQuestionsAnswered || isSubmitting}
                onClick={handleCompleteForm}
                data-testid="button-complete-form"
                className="w-full sm:w-auto touch-manipulation min-h-[44px] text-sm sm:text-base"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span>Complete Form</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start border-t pt-4">
          <div className="w-full">
            <h4 className="font-semibold text-sm mb-2">Question Navigation</h4>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_QUESTIONS.map((q, index) => {
                const isAnswered = questionResponses[q.id]?.answer?.length > 0;
                return (
                  <Button
                    key={q.id}
                    variant={currentQuestion === index ? "default" : isAnswered ? "outline" : "ghost"}
                    size="sm"
                    className={`rounded-full w-8 h-8 p-0 ${isAnswered ? "border-primary text-primary" : ""}`}
                    onClick={() => setCurrentQuestion(index)}
                  >
                    {index + 1}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}