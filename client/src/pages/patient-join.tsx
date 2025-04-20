import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Mic, MicOff, Send, Check } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { recordingService } from "@/lib/recording-service";

// Array of standard intake questions
const DEFAULT_QUESTIONS = [
  { id: "reason", text: "What is the reason for your visit today?" },
  { id: "symptoms", text: "What symptoms are you experiencing and how long have they been present?" },
  { id: "medical_history", text: "Do you have any pre-existing medical conditions?" },
  { id: "medications", text: "Are you currently taking any medications? If so, please list them." },
  { id: "allergies", text: "Do you have any allergies to medications or other substances?" },
  { id: "family_history", text: "Is there any relevant family medical history we should know about?" },
  { id: "lifestyle", text: "Please describe your lifestyle (exercise, diet, smoking, alcohol, etc.)" },
];

export default function PatientJoinPage() {
  const { uniqueLink } = useParams();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionResponses, setQuestionResponses] = useState<Record<string, { answer: string, answerType: string, audioUrl?: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allQuestionsAnswered, setAllQuestionsAnswered] = useState(false);
  const [formComplete, setFormComplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
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
    if (Object.keys(questionResponses).length === DEFAULT_QUESTIONS.length) {
      // Check if all questions have answers
      const allAnswered = DEFAULT_QUESTIONS.every(q => 
        questionResponses[q.id] && questionResponses[q.id].answer.trim().length > 0
      );
      setAllQuestionsAnswered(allAnswered);
    } else {
      setAllQuestionsAnswered(false);
    }
  }, [questionResponses]);

  // Start audio recording
  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      await recordingService.startRecording();
    } catch (error) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
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
  };

  // Save the current question's answer
  const saveCurrentAnswer = () => {
    if (!textareaRef.current) return;
    
    const answer = textareaRef.current.value.trim();
    if (answer.length === 0) return;
    
    const currentQuestionData = DEFAULT_QUESTIONS[currentQuestion];
    
    setQuestionResponses(prev => ({
      ...prev,
      [currentQuestionData.id]: {
        ...prev[currentQuestionData.id],
        answer,
        answerType: prev[currentQuestionData.id]?.answerType || "text"
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
    // Save current answer first
    saveCurrentAnswer();
  };

  // Submit all answers to complete the form
  const handleCompleteForm = async () => {
    if (!formData) return;
    
    // Save the current answer first
    saveCurrentAnswer();
    
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
    <div className="container mx-auto p-4">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Patient Intake Form</CardTitle>
          <CardDescription>
            Welcome to {formData.name}'s online intake form. Please answer each question either by typing or using voice input.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">
                Question {currentQuestion + 1} of {DEFAULT_QUESTIONS.length}
              </h3>
              <div className="text-sm text-muted-foreground">
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
            <Label className="text-lg mb-2 block">{DEFAULT_QUESTIONS[currentQuestion].text}</Label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Textarea 
                  ref={textareaRef}
                  placeholder="Type your answer here or use voice recording..."
                  className="h-32"
                  onChange={handleTextareaChange}
                  defaultValue={questionResponses[DEFAULT_QUESTIONS[currentQuestion].id]?.answer || ""}
                />
              </div>
              <div>
                {isRecording ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={handleStopRecording}
                  >
                    <MicOff className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleStartRecording}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {isRecording && (
              <div className="text-sm text-primary mt-2 animate-pulse">
                Recording in progress... Speak clearly and then click stop when finished.
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrevQuestion}
              disabled={currentQuestion === 0}
            >
              Previous
            </Button>
            {currentQuestion < DEFAULT_QUESTIONS.length - 1 ? (
              <Button
                type="button"
                onClick={handleNextQuestion}
              >
                Next
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!allQuestionsAnswered || isSubmitting}
                onClick={handleCompleteForm}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Complete Form
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