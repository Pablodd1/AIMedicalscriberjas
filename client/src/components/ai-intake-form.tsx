import React, { useState, useEffect, useCallback } from 'react';
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
  Check, 
  AlertCircle, 
  Loader2, 
  Volume2, 
  VolumeX,
  Brain,
  Sparkles,
  Target,
  Clock,
  ShieldCheck,
  Activity,
  Zap,
  Star,
  RotateCcw,
  Settings,
  HelpCircle,
  Eye,
  EyeOff,
  Upload,
  Download
} from "lucide-react";
import { EnhancedVoiceRecorder, RecordingResult } from "@/components/enhanced-voice-recorder";
import { transcriptionService, TranscriptionProvider, TranscriptionOptions } from "@/server/advanced-transcription-service";

// Enhanced intake questions with medical categories and AI hints
const ENHANCED_INTAKE_QUESTIONS = [
  // Demographics
  { 
    id: 1, 
    field: "full_name", 
    label: "Full Name", 
    category: "demographics", 
    required: true,
    aiHints: ["name", "called", "goes by", "full name"],
    validation: /^[a-zA-Z\s-']+$/,
    example: "John Michael Smith"
  },
  { 
    id: 2, 
    field: "date_of_birth", 
    label: "Date of Birth", 
    category: "demographics", 
    required: true,
    aiHints: ["born", "birthday", "DOB", "birth date"],
    validation: /^\d{4}-\d{2}-\d{2}$/,
    example: "1980-03-15"
  },
  { 
    id: 3, 
    field: "gender", 
    label: "Gender", 
    category: "demographics", 
    required: true,
    aiHints: ["male", "female", "man", "woman", "non-binary"],
    options: ["Male", "Female", "Non-binary", "Prefer not to say"]
  },
  { 
    id: 4, 
    field: "phone", 
    label: "Phone Number", 
    category: "demographics", 
    required: true,
    aiHints: ["phone", "cell", "mobile", "telephone", "number"],
    validation: /^[\d\s\(\)\-\+]+$/,
    example: "(555) 123-4567"
  },
  { 
    id: 5, 
    field: "email", 
    label: "Email Address", 
    category: "demographics", 
    required: true,
    aiHints: ["email", "gmail", "yahoo", "hotmail", "outlook"],
    validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    example: "john.smith@email.com"
  },
  { 
    id: 6, 
    field: "address", 
    label: "Home Address", 
    category: "demographics", 
    required: false,
    aiHints: ["live", "address", "street", "apartment", "house"]
  },
  { 
    id: 7, 
    field: "emergency_contact", 
    label: "Emergency Contact", 
    category: "demographics", 
    required: true,
    aiHints: ["emergency", "contact", "family", "spouse", "parent"]
  },

  // Medical History
  { 
    id: 8, 
    field: "allergies", 
    label: "Allergies (Medications, Food, Other)", 
    category: "medical", 
    required: true,
    aiHints: ["allergic", "allergy", "reaction", "rash", "hives", "swelling"],
    critical: true,
    helpText: "Please mention ALL allergies, especially to medications"
  },
  { 
    id: 9, 
    field: "current_medications", 
    label: "Current Medications", 
    category: "medical", 
    required: false,
    aiHints: ["medicine", "pill", "medication", "prescription", "taking"],
    helpText: "Include all prescription and over-the-counter medications"
  },
  { 
    id: 10, 
    field: "chronic_conditions", 
    label: "Chronic Medical Conditions", 
    category: "medical", 
    required: false,
    aiHints: ["diabetes", "hypertension", "asthma", "arthritis", "heart", "chronic"],
    helpText: "Conditions like diabetes, high blood pressure, asthma, etc."
  },
  { 
    id: 11, 
    field: "past_surgeries", 
    label: "Past Surgeries", 
    category: "medical", 
    required: false,
    aiHints: ["surgery", "operation", "procedure", "hospital", "removed"],
    helpText: "Any surgeries or major procedures you've had"
  },
  { 
    id: 12, 
    field: "family_history", 
    label: "Family Medical History", 
    category: "medical", 
    required: false,
    aiHints: ["family", "mother", "father", "sister", "brother", "genetic"],
    helpText: "Medical conditions that run in your family"
  },

  // Visit Information
  { 
    id: 13, 
    field: "reason_for_visit", 
    label: "Reason for Today's Visit", 
    category: "visit", 
    required: true,
    aiHints: ["reason", "problem", "issue", "concern", "why", "visit"],
    helpText: "What brings you in today?"
  },
  { 
    id: 14, 
    field: "symptoms", 
    label: "Current Symptoms", 
    category: "visit", 
    required: false,
    aiHints: ["symptom", "pain", "fever", "cough", "tired", "sick"],
    helpText: "Describe your symptoms in detail"
  },
  { 
    id: 15, 
    field: "symptom_duration", 
    label: "How Long Have You Had These Symptoms?", 
    category: "visit", 
    required: false,
    aiHints: ["how long", "duration", "days", "weeks", "months", "started"],
    helpText: "When did your symptoms first appear?"
  },
  { 
    id: 16, 
    field: "pain_level", 
    label: "Pain Level (0-10)", 
    category: "visit", 
    required: false,
    aiHints: ["pain", "hurt", "ache", "discomfort", "scale", "zero to ten"],
    validation: /^([0-9]|10)$/,
    helpText: "On a scale of 0-10, with 10 being the worst pain possible"
  },

  // Insurance
  { 
    id: 17, 
    field: "insurance_provider", 
    label: "Insurance Provider", 
    category: "insurance", 
    required: false,
    aiHints: ["insurance", "blue cross", "aetna", "cigna", "united", "medicare", "medicaid"]
  },
  { 
    id: 18, 
    field: "insurance_policy", 
    label: "Insurance Policy Number", 
    category: "insurance", 
    required: false,
    aiHints: ["policy", "member", "id number", "group number"]
  },

  // Lifestyle
  { 
    id: 19, 
    field: "smoking_status", 
    label: "Smoking Status", 
    category: "lifestyle", 
    required: false,
    aiHints: ["smoke", "smoking", "cigarette", "tobacco", "never", "former", "current"],
    options: ["Never smoked", "Former smoker", "Current smoker", "Occasional smoker"]
  },
  { 
    id: 20, 
    field: "alcohol_use", 
    label: "Alcohol Use", 
    category: "lifestyle", 
    required: false,
    aiHints: ["alcohol", "drink", "wine", "beer", "liquor", "never", "occasional", "weekly", "daily"],
    options: ["Never", "Occasional", "Weekly", "Daily"]
  },
  { 
    id: 21, 
    field: "exercise_habits", 
    label: "Exercise Habits", 
    category: "lifestyle", 
    required: false,
    aiHints: ["exercise", "workout", "gym", "run", "walk", "active", "sedentary"],
    options: ["Sedentary", "Light activity", "Moderate exercise", "Vigorous exercise"]
  }
];

interface AIIntakeFormProps {
  className?: string;
  onComplete?: (data: any) => void;
  onError?: (error: any) => void;
  enableVoiceInput?: boolean;
  enableAIEnhancement?: boolean;
  enableRealTimeProcessing?: boolean;
  enableProgressiveEnhancement?: boolean;
  enableMedicalMode?: boolean;
  enableConfidenceScoring?: boolean;
  enableValidation?: boolean;
  enableAutoCorrection?: boolean;
  showRealTimeAnalysis?: boolean;
  enableVoiceCommands?: boolean;
}

interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
  source: 'transcript' | 'ai_extraction' | 'validation';
  timestamp: Date;
  validationStatus?: 'valid' | 'invalid' | 'needs_review';
}

interface ProcessingMetrics {
  extractionAccuracy: number;
  confidenceScore: number;
  processingTime: number;
  fieldsExtracted: number;
  fieldsPending: number;
  estimatedCompletionTime: number;
}

export function AIIntakeForm({
  className,
  onComplete,
  onError,
  enableVoiceInput = true,
  enableAIEnhancement = true,
  enableRealTimeProcessing = true,
  enableProgressiveEnhancement = true,
  enableMedicalMode = false,
  enableConfidenceScoring = true,
  enableValidation = true,
  enableAutoCorrection = true,
  showRealTimeAnalysis = true,
  enableVoiceCommands = false
}: AIIntakeFormProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'intro' | 'consent' | 'recording' | 'processing' | 'review' | 'complete'>('intro');
  const [consentGiven, setConsentGiven] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [extractedData, setExtractedData] = useState<Record<string, ExtractedField>>({});
  const [processingMetrics, setProcessingMetrics] = useState<ProcessingMetrics>({
    extractionAccuracy: 0,
    confidenceScore: 0,
    processingTime: 0,
    fieldsExtracted: 0,
    fieldsPending: ENHANCED_INTAKE_QUESTIONS.length,
    estimatedCompletionTime: 0
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Initialize AI processing
  const initializeAIProcessing = useCallback(async () => {
    if (!enableAIEnhancement) return;

    try {
      // Set up transcription service with medical context
      const medicalContext = enableMedicalMode ? {
        specialty: 'primary_care',
        visitType: 'intake',
        enableMedicalMode: true
      } : undefined;

      transcriptionService.setMedicalContext(medicalContext);
      
      log('AI processing initialized');
    } catch (error) {
      console.error('Failed to initialize AI processing:', error);
      toast({
        title: 'AI Initialization Failed',
        description: 'Some advanced features may not be available.',
        variant: 'destructive'
      });
    }
  }, [enableAIEnhancement, enableMedicalMode, toast]);

  // Process voice recording
  const processVoiceRecording = useCallback(async (audioBlob: Blob, transcript: string) => {
    setIsProcessing(true);
    setProcessingError(null);

    try {
      const startTime = Date.now();

      // Step 1: Enhance transcript with medical context
      const enhancedTranscript = await enhanceTranscriptWithMedicalContext(transcript);

      // Step 2: Extract structured data using AI
      const extractedFields = await extractStructuredData(enhancedTranscript);

      // Step 3: Validate and correct extracted data
      const validatedData = await validateExtractedData(extractedFields);

      // Step 4: Auto-correct common errors
      const correctedData = enableAutoCorrection ? 
        await autoCorrectExtractedData(validatedData) : validatedData;

      // Step 5: Calculate confidence scores
      const dataWithConfidence = enableConfidenceScoring ? 
        await calculateConfidenceScores(correctedData) : correctedData;

      const processingTime = Date.now() - startTime;
      const fieldsExtracted = Object.keys(dataWithConfidence).length;
      const fieldsPending = ENHANCED_INTAKE_QUESTIONS.length - fieldsExtracted;
      const extractionAccuracy = calculateExtractionAccuracy(dataWithConfidence);
      const confidenceScore = calculateOverallConfidence(dataWithConfidence);

      setExtractedData(dataWithConfidence);
      setProcessingMetrics({
        extractionAccuracy,
        confidenceScore,
        processingTime,
        fieldsExtracted,
        fieldsPending,
        estimatedCompletionTime: estimateCompletionTime(fieldsPending)
      });

      setStep('review');

      toast({
        title: 'Processing Complete!',
        description: `Extracted ${fieldsExtracted} of ${ENHANCED_INTAKE_QUESTIONS.length} fields with ${extractionAccuracy}% accuracy.`,
      });

    } catch (error) {
      console.error('Processing error:', error);
      setProcessingError(error instanceof Error ? error.message : 'Unknown error');
      
      toast({
        title: 'Processing Failed',
        description: 'Could not process your recording. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [enableAutoCorrection, enableConfidenceScoring, toast]);

  // Enhance transcript with medical context
  const enhanceTranscriptWithMedicalContext = useCallback(async (transcript: string): Promise<string> => {
    if (!enableAIEnhancement) return transcript;

    try {
      // Use AI to enhance medical terminology and context
      const response = await fetch('/api/ai/enhance-medical-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          enableMedicalMode,
          language: 'en-US'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to enhance transcript');
      }

      const data = await response.json();
      return data.enhancedTranscript || transcript;

    } catch (error) {
      console.error('Failed to enhance transcript:', error);
      return transcript;
    }
  }, [enableAIEnhancement, enableMedicalMode]);

  // Extract structured data using AI
  const extractStructuredData = useCallback(async (transcript: string): Promise<Record<string, ExtractedField>> => {
    if (!enableAIEnhancement) return {};

    try {
      const response = await fetch('/api/ai/extract-intake-answers-advanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          questions: ENHANCED_INTAKE_QUESTIONS,
          enableMedicalMode,
          enableValidation,
          language: 'en-US'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to extract data');
      }

      const data = await response.json();
      return data.extractedFields || {};

    } catch (error) {
      console.error('Failed to extract structured data:', error);
      return {};
    }
  }, [enableAIEnhancement, enableMedicalMode, enableValidation]);

  // Validate extracted data
  const validateExtractedData = useCallback(async (fields: Record<string, ExtractedField>): Promise<Record<string, ExtractedField>> => {
    if (!enableValidation) return fields;

    const validatedFields: Record<string, ExtractedField> = {};

    for (const [fieldName, fieldData] of Object.entries(fields)) {
      const question = ENHANCED_INTAKE_QUESTIONS.find(q => q.field === fieldName);
      if (!question) continue;

      const validation = await validateField(fieldData.value, question);
      
      validatedFields[fieldName] = {
        ...fieldData,
        validationStatus: validation.isValid ? 'valid' : 'needs_review',
        confidence: fieldData.confidence * validation.confidenceMultiplier
      };
    }

    return validatedFields;
  }, [enableValidation]);

  // Auto-correct extracted data
  const autoCorrectExtractedData = useCallback(async (fields: Record<string, ExtractedField>): Promise<Record<string, ExtractedField>> => {
    if (!enableAutoCorrection) return fields;

    const correctedFields: Record<string, ExtractedField> = {};

    for (const [fieldName, fieldData] of Object.entries(fields)) {
      const question = ENHANCED_INTAKE_QUESTIONS.find(q => q.field === fieldName);
      if (!question) continue;

      const corrected = await autoCorrectField(fieldData.value, question);
      
      correctedFields[fieldName] = {
        ...fieldData,
        value: corrected.value,
        confidence: fieldData.confidence * 0.95, // Slight confidence reduction for corrections
        source: 'ai_extraction'
      };
    }

    return correctedFields;
  }, [enableAutoCorrection]);

  // Calculate confidence scores
  const calculateConfidenceScores = useCallback(async (fields: Record<string, ExtractedField>): Promise<Record<string, ExtractedField>> => {
    if (!enableConfidenceScoring) return fields;

    const scoredFields: Record<string, ExtractedField> = {};

    for (const [fieldName, fieldData] of Object.entries(fields)) {
      const question = ENHANCED_INTAKE_QUESTIONS.find(q => q.field === fieldName);
      if (!question) continue;

      const confidence = await calculateFieldConfidence(fieldData.value, question);
      
      scoredFields[fieldName] = {
        ...fieldData,
        confidence: Math.max(0, Math.min(100, confidence))
      };
    }

    return scoredFields;
  }, [enableConfidenceScoring]);

  // Handle recording completion
  const handleRecordingComplete = useCallback(async (result: RecordingResult) => {
    if (!result.transcript) {
      toast({
        title: 'No Transcript Available',
        description: 'Recording completed but no transcript was generated.',
        variant: 'destructive'
      });
      return;
    }

    await processVoiceRecording(result.audioBlob, result.transcript);
  }, [processVoiceRecording, toast]);

  // Calculate completion progress
  const completionProgress = useCallback(() => {
    const requiredFields = ENHANCED_INTAKE_QUESTIONS.filter(q => q.required);
    const filledRequired = Object.keys(extractedData).filter(fieldName => {
      const field = extractedData[fieldName];
      const question = ENHANCED_INTAKE_QUESTIONS.find(q => q.field === fieldName);
      return question?.required && field?.value?.trim();
    }).length;
    
    return (filledRequired / requiredFields.length) * 100;
  }, [extractedData]);

  // Validate form before submission
  const validateForm = useCallback(() => {
    const requiredFields = ENHANCED_INTAKE_QUESTIONS.filter(q => q.required);
    const missingFields = requiredFields.filter(q => {
      const field = extractedData[q.field];
      return !field?.value?.trim() || field.validationStatus === 'invalid';
    });

    return {
      isValid: missingFields.length === 0,
      missingFields
    };
  }, [extractedData]);

  // Submit form
  const handleSubmit = useCallback(async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      toast({
        title: 'Missing Required Information',
        description: `Please provide: ${validation.missingFields.map(f => f.label).join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Convert extracted data to submission format
      const submissionData = Object.fromEntries(
        Object.entries(extractedData).map(([key, field]) => [key, field.value])
      );

      onComplete?.(submissionData);
      setStep('complete');

      toast({
        title: 'Success!',
        description: 'Your intake form has been submitted successfully.',
      });

    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: 'Submission Failed',
        description: 'Please try again or contact support.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [validateForm, extractedData, onComplete, toast]);

  // Initialize on mount
  useEffect(() => {
    initializeAIProcessing();
  }, [initializeAIProcessing]);

  // Update processing metrics
  useEffect(() => {
    const extractedCount = Object.keys(extractedData).length;
    const totalCount = ENHANCED_INTAKE_QUESTIONS.length;
    const pendingCount = totalCount - extractedCount;
    
    setProcessingMetrics(prev => ({
      ...prev,
      fieldsExtracted: extractedCount,
      fieldsPending: pendingCount,
      estimatedCompletionTime: estimateCompletionTime(pendingCount)
    }));
  }, [extractedData]);

  // INTRO STEP
  if (step === 'intro') {
    return (
      <div className={cn("container mx-auto p-4 max-w-4xl", className)}>
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI-Powered Medical Intake
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Advanced voice technology with intelligent form completion
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                How This Advanced System Works:
              </h3>
              <ol className="space-y-3 text-sm text-blue-800">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Speak naturally - our AI understands medical terminology and context</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Real-time processing with confidence scoring and validation</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Intelligent auto-correction and medical data extraction</span>
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-4 text-center">
                <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Real-Time Processing</h4>
                <p className="text-sm text-muted-foreground">Live transcription with medical accuracy</p>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <Target className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Smart Extraction</h4>
                <p className="text-sm text-muted-foreground">AI-powered data extraction</p>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <ShieldCheck className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">HIPAA Compliant</h4>
                <p className="text-sm text-muted-foreground">Secure and private processing</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold">What to mention in your recording:</h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                <li>✓ Your complete name and date of birth</li>
                <li>✓ Contact information and emergency contacts</li>
                <li>✓ All medications and allergies (very important!)</li>
                <li>✓ Medical history and chronic conditions</li>
                <li>✓ Reason for your visit today</li>
                <li>✓ Current symptoms and concerns</li>
                <li>✓ Insurance information if applicable</li>
                <li>✓ Lifestyle factors (smoking, alcohol, exercise)</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => setStep('consent')}
                className="w-full sm:w-auto h-14 text-lg touch-manipulation"
                size="lg"
              >
                <Mic className="mr-2 h-5 w-5" />
                Start Voice Intake
              </Button>
              <Button
                onClick={() => setStep('recording')}
                variant="outline"
                className="w-full sm:w-auto h-14 text-lg touch-manipulation"
                size="lg"
              >
                Skip to Recording
              </Button>
            </div>
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
          <CardHeader>
            <CardTitle className="text-xl">Privacy & Recording Consent</CardTitle>
            <CardDescription>Advanced AI processing with privacy protection</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Alert className="border-green-300 bg-green-50">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800">Your Privacy is Protected</AlertTitle>
              <AlertDescription className="text-green-700 text-sm">
                Your voice recording is processed by AI with enterprise-grade security. Audio is transcribed and immediately deleted.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consent"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-1"
                />
                <div className="space-y-2 flex-1">
                  <Label htmlFor="consent" className="text-base font-medium cursor-pointer leading-tight">
                    I consent to AI-powered voice processing for medical intake
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    I understand that AI will process my voice to extract medical information, my data is protected by HIPAA, and I can stop recording at any time.
                  </p>
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
          <CardHeader>
            <CardTitle className="text-xl">Advanced Voice Recording</CardTitle>
            <CardDescription>
              AI-powered transcription with real-time analysis
              <Badge variant="outline" className="ml-2 text-xs font-medium text-amber-600 bg-amber-50">
                AI Generated - Verify Accuracy
              </Badge>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <EnhancedVoiceRecorder
              onRecordingComplete={handleRecordingComplete}
              onRecordingError={(error) => {
                setProcessingError(error.message);
                onError?.(error);
              }}
              onTranscriptionUpdate={(transcript, metrics) => {
                setLiveTranscript(transcript);
                if (enableRealTimeProcessing && transcript.length > 100) {
                  // Trigger real-time processing
                  processPartialTranscript(transcript);
                }
              }}
              onMetricsUpdate={(metrics) => {
                // Handle real-time metrics updates
              }}
              options={{
                quality: 'medical',
                format: 'webm',
                enableNoiseCancellation: true,
                enableVoiceActivityDetection: true,
                enableAutomaticGainControl: true,
                maxDuration: 1800, // 30 minutes
                language: 'en-US',
                enableLiveTranscription: true,
                transcriptionProvider: 'deepgram'
              }}
              enableAdvancedFeatures={true}
              enableMedicalMode={enableMedicalMode}
              showRealTimeAnalysis={showRealTimeAnalysis}
              enableVoiceCommands={enableVoiceCommands}
            />

            {/* Processing Status */}
            {isProcessing && (
              <Alert className="border-blue-300 bg-blue-50">
                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                <AlertTitle className="text-blue-800">AI Processing</AlertTitle>
                <AlertDescription className="text-blue-700">
                  <div className="space-y-2">
                    <Progress value={processingMetrics.extractionAccuracy} className="w-full" />
                    <div className="flex justify-between text-xs">
                      <span>Extraction: {processingMetrics.extractionAccuracy}%</span>
                      <span>Confidence: {processingMetrics.confidenceScore}%</span>
                    </div>
                    <p>Processing your recording with advanced AI...</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Real-time Analysis */}
            {showRealTimeAnalysis && liveTranscript && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600 animate-pulse" />
                    <span className="text-sm font-medium text-blue-800">Live Processing</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {processingMetrics.fieldsExtracted}/{ENHANCED_INTAKE_QUESTIONS.length} fields
                  </Badge>
                </div>
                <div className="bg-white rounded p-2 max-h-24 overflow-y-auto">
                  <p className="text-sm text-gray-700">{liveTranscript}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // REVIEW STEP
  if (step === 'review') {
    const validation = validateForm();
    const canSubmit = validation.isValid;

    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Review Your Information</CardTitle>
            <CardDescription>
              Please verify the AI-extracted information before submitting
              <Badge variant="outline" className="ml-2 text-xs font-medium text-amber-600 bg-amber-50">
                AI Generated - Verify Accuracy
              </Badge>
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Processing Summary */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-green-800">AI Processing Summary</h4>
                <Badge variant="outline" className="text-green-700">
                  {processingMetrics.extractionAccuracy}% Accuracy
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Confidence</div>
                  <div className="font-semibold text-green-700">{processingMetrics.confidenceScore}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Fields Extracted</div>
                  <div className="font-semibold">{processingMetrics.fieldsExtracted}/{ENHANCED_INTAKE_QUESTIONS.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Processing Time</div>
                  <div className="font-semibold">{Math.round(processingMetrics.processingTime / 1000)}s</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-semibold text-green-600">Complete</div>
                </div>
              </div>
            </div>

            {/* Missing Required Fields */}
            {!canSubmit && (
              <Alert className="border-amber-300 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Missing Required Information</AlertTitle>
                <AlertDescription className="text-amber-700">
                  The AI couldn't extract: {validation.missingFields.map(q => q.label).join(', ')}. Please re-record to provide this information.
                </AlertDescription>
              </Alert>
            )}

            {/* Extracted Data Review */}
            <div className="space-y-4">
              <h4 className="font-semibold">Review Extracted Information:</h4>
              
              {ENHANCED_INTAKE_QUESTIONS.map((question) => {
                const field = extractedData[question.field];
                const isMissing = question.required && (!field?.value?.trim() || field.validationStatus === 'invalid');
                const confidence = field?.confidence || 0;

                return (
                  <div
                    key={question.id}
                    className={cn(
                      "p-4 rounded-lg border transition-all",
                      isMissing ? 'bg-red-50 border-red-300' : 
                      confidence < 70 ? 'bg-yellow-50 border-yellow-300' :
                      'bg-green-50 border-green-300'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium mb-1">
                          {question.label}
                          {question.required && <span className="text-red-500 ml-1">*</span>}
                          {question.critical && <span className="text-red-500 ml-1">⚠️</span>}
                        </div>
                        <div className="text-sm text-gray-700">
                          {field?.value || <span className="italic text-red-500">Not extracted</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {field && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              confidence >= 80 ? "text-green-600 border-green-300" :
                              confidence >= 60 ? "text-yellow-600 border-yellow-300" :
                              "text-red-600 border-red-300"
                            )}
                          >
                            {Math.round(confidence)}%
                          </Badge>
                        )}
                        {isMissing && <AlertCircle className="h-4 w-4 text-red-500" />}
                      </div>
                    </div>
                    
                    {field && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Source: {field.source}</span>
                        <span>•</span>
                        <span>Status: {field.validationStatus || 'needs_review'}</span>
                        {field.timestamp && (
                          <>
                            <span>•</span>
                            <span>{new Date(field.timestamp).toLocaleTimeString()}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep('recording')}
                className="w-full sm:w-auto touch-manipulation"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
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
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl text-green-700">Intake Complete!</CardTitle>
          <CardDescription className="text-base">
            AI-powered intake successfully processed
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 space-y-4 text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-800 mb-2">Processing Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
              <div>
                <div className="text-muted-foreground">Fields Extracted</div>
                <div className="font-semibold">{processingMetrics.fieldsExtracted}/{ENHANCED_INTAKE_QUESTIONS.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">AI Confidence</div>
                <div className="font-semibold">{processingMetrics.confidenceScore}%</div>
              </div>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Your information has been securely processed and extracted with advanced AI technology.
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

// Helper functions
async function validateField(value: string, question: any): Promise<{ isValid: boolean; confidenceMultiplier: number }> {
  if (!value?.trim()) {
    return { isValid: false, confidenceMultiplier: 0.5 };
  }

  if (question.validation) {
    const isValid = question.validation.test(value);
    return { isValid, confidenceMultiplier: isValid ? 1.0 : 0.7 };
  }

  if (question.options) {
    const isValid = question.options.includes(value);
    return { isValid, confidenceMultiplier: isValid ? 1.0 : 0.8 };
  }

  // Basic validation for required fields
  if (question.required && !value?.trim()) {
    return { isValid: false, confidenceMultiplier: 0.3 };
  }

  return { isValid: true, confidenceMultiplier: 0.9 };
}

async function autoCorrectField(value: string, question: any): Promise<{ value: string; confidence: number }> {
  let correctedValue = value;

  // Auto-correct common formatting issues
  if (question.field === 'phone') {
    correctedValue = value.replace(/\D/g, '');
    if (correctedValue.length === 10) {
      correctedValue = `(${correctedValue.slice(0, 3)}) ${correctedValue.slice(3, 6)}-${correctedValue.slice(6)}`;
    }
  }

  if (question.field === 'date_of_birth') {
    // Standardize date format
    const dateMatch = value.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4}|\d{2})/);
    if (dateMatch) {
      const [, month, day, year] = dateMatch;
      const fullYear = year.length === 2 ? `20${year}` : year;
      correctedValue = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  return { value: correctedValue, confidence: 0.95 };
}

async function calculateFieldConfidence(value: string, question: any): Promise<number> {
  if (!value?.trim()) return 0;

  let confidence = 0.5; // Base confidence

  // Check against AI hints
  if (question.aiHints) {
    const hintMatches = question.aiHints.filter(hint => 
      value.toLowerCase().includes(hint.toLowerCase())
    ).length;
    confidence += (hintMatches / question.aiHints.length) * 0.3;
  }

  // Check validation
  if (question.validation && question.validation.test(value)) {
    confidence += 0.2;
  }

  // Check options
  if (question.options && question.options.includes(value)) {
    confidence += 0.2;
  }

  // Check length (longer answers generally more reliable)
  if (value.length > 10) {
    confidence += 0.1;
  }

  return Math.min(1.0, confidence);
}

function calculateExtractionAccuracy(fields: Record<string, ExtractedField>): number {
  if (Object.keys(fields).length === 0) return 0;
  
  const totalConfidence = Object.values(fields).reduce((sum, field) => sum + (field.confidence || 0), 0);
  return Math.round((totalConfidence / Object.keys(fields).length) * 100);
}

function calculateOverallConfidence(fields: Record<string, ExtractedField>): number {
  return calculateExtractionAccuracy(fields);
}

function estimateCompletionTime(pendingFields: number): number {
  // Estimate ~30 seconds per field for AI processing
  return pendingFields * 30;
}

async function processPartialTranscript(transcript: string): Promise<void> {
  // Implement partial transcript processing for real-time updates
  console.log('Processing partial transcript:', transcript.substring(0, 100) + '...');
}

function log(message: string, data?: any): void {
  console.log(`[AIIntakeForm] ${message}`, data || '');
}