import { Router } from 'express';
import { requireAuth, asyncHandler, AppError, handleDatabaseOperation } from '../error-handler';
import { log, logError } from '../logger';
import { transcriptionService, TranscriptionProvider, TranscriptionOptions } from '../advanced-transcription-service';
import { AIIntakeExtractor } from '../ai-intake-extractor';
import OpenAI from 'openai';

export const aiIntakeRouter = Router();

// Helper function to get OpenAI client for a user
async function getOpenAIClient(userId: number): Promise<OpenAI | null> {
  try {
    const user = await dbStorage.getUser(userId);
    if (!user) return null;

    if (user.useOwnApiKey) {
      const userApiKey = await dbStorage.getUserApiKey(userId);
      if (userApiKey) {
        return new OpenAI({ apiKey: userApiKey });
      }
    } else {
      const globalApiKey = await dbStorage.getSystemSetting('global_openai_api_key');
      if (globalApiKey) {
        return new OpenAI({ apiKey: globalApiKey });
      }
      if (process.env.OPENAI_API_KEY) {
        return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      }
    }
    return null;
  } catch (error) {
    logError('Error getting OpenAI client:', error);
    return null;
  }
}

/**
 * Advanced transcription with medical context
 * POST /api/ai-intake/transcribe-medical
 */
aiIntakeRouter.post('/transcribe-medical', requireAuth, asyncHandler(async (req, res) => {
  const { audioData, options = {} } = req.body;
  const userId = (req.user as any).id;

  if (!audioData) {
    throw new AppError('Audio data is required', 400, 'MISSING_AUDIO_DATA');
  }

  try {
    const transcriptionOptions: TranscriptionOptions = {
      provider: options.provider || TranscriptionProvider.DEEPGRAM_MEDICAL,
      language: options.language || 'en-US',
      medicalMode: true,
      enableSpeakerDiarization: options.enableSpeakerDiarization || false,
      enablePunctuation: true,
      enableFormatting: true,
      enableWordTimestamps: true,
      enableParagraphs: true,
      enableSmartFormatting: true,
      vocabulary: options.vocabulary || [],
      customVocabulary: options.customVocabulary || [],
      fallbackProvider: options.fallbackProvider || TranscriptionProvider.OPENAI_WHISPER,
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3
    };

    // Set medical context for transcription
    transcriptionService.setMedicalContext({
      patientId: options.patientId,
      providerId: userId,
      specialty: options.specialty || 'primary_care',
      visitType: options.visitType || 'intake',
      chiefComplaint: options.chiefComplaint,
      currentMedications: options.currentMedications,
      allergies: options.allergies,
      medicalHistory: options.medicalHistory
    });

    // Convert base64 audio to buffer
    const audioBuffer = Buffer.from(audioData, 'base64');

    // Perform transcription with medical context
    const result = await transcriptionService.transcribeAudio(audioBuffer, transcriptionOptions);

    // Extract medical terminology and insights
    const medicalInsights = extractMedicalInsights(result);

    // Save transcription result to database
    await handleDatabaseOperation(
      () => dbStorage.saveMedicalTranscription({
        userId,
        transcript: result.transcript,
        medicalTerms: result.medicalTerms,
        confidence: result.confidence,
        provider: result.provider,
        duration: result.duration,
        language: result.language,
        metadata: result.metadata,
        medicalInsights
      }),
      'Failed to save medical transcription'
    );

    res.json({
      success: true,
      data: {
        transcript: result.transcript,
        medicalTerms: result.medicalTerms,
        confidence: result.confidence,
        provider: result.provider,
        duration: result.duration,
        language: result.language,
        metadata: result.metadata,
        medicalInsights
      },
      processingTime: result.metadata.processingTime
    });

    log(`Medical transcription completed for user ${userId} with ${result.confidence}% confidence`);

  } catch (error) {
    logError('Medical transcription error:', error);
    throw new AppError(
      `Medical transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'MEDICAL_TRANSCRIPTION_FAILED'
    );
  }
}));

/**
 * Enhanced medical transcript processing
 * POST /api/ai-intake/enhance-medical-transcript
 */
aiIntakeRouter.post('/enhance-medical-transcript', requireAuth, asyncHandler(async (req, res) => {
  const { transcript, enableMedicalMode = false, language = 'en-US' } = req.body;
  const userId = (req.user as any).id;

  if (!transcript) {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode 
      ? `You are an expert medical transcription enhancement AI. Your task is to improve medical transcripts while preserving accuracy and clinical terminology.

ENHANCEMENT RULES:
1. Correct obvious medical terminology errors while preserving clinical accuracy
2. Standardize medication names using proper medical nomenclature
3. Improve formatting and punctuation for readability
4. Preserve all medical details and numerical values
5. Maintain HIPAA compliance by not adding any information not present in the original
6. Use SNOMED CT terminology where applicable
7. Flag any unclear or ambiguous medical terms

DO NOT:
- Add any information not present in the original transcript
- Change medical meanings or interpretations
- Remove any clinically relevant information
- Make assumptions about medical conditions

Return only the enhanced transcript text, no additional commentary.`
      : `You are a transcription enhancement AI. Improve readability and accuracy while preserving all original information.

ENHANCEMENT RULES:
1. Correct obvious spelling and grammar errors
2. Improve punctuation and formatting
3. Standardize common terms and abbreviations
4. Preserve all original information and meaning
5. Maintain natural speech flow

Return only the enhanced transcript text, no additional commentary.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enhance this ${language} medical transcript:\n\n${transcript}` }
      ],
      temperature: 0.1,
      max_tokens: 4000
    });

    const enhancedTranscript = response.choices[0]?.message?.content?.trim() || transcript;

    res.json({
      success: true,
      data: {
        originalTranscript: transcript,
        enhancedTranscript,
        language,
        medicalMode: enableMedicalMode,
        processingTime: response.usage?.total_tokens || 0
      }
    });

    log(`Medical transcript enhancement completed for user ${userId}`);

  } catch (error) {
    logError('Medical transcript enhancement error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Advanced intake answer extraction with AI
 * POST /api/ai-intake/extract-intake-answers-advanced
 */
aiIntakeRouter.post('/extract-intake-answers-advanced', requireAuth, asyncHandler(async (req, res) => {
  const { transcript, questions, enableMedicalMode = false, enableValidation = true, language = 'en-US' } = req.body;
  const userId = (req.user as any).id;

  if (!transcript) {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  if (!questions || !Array.isArray(questions)) {
    throw new AppError('Questions array is required', 400, 'MISSING_QUESTIONS');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const aiExtractor = new AIIntakeExtractor(openai.apiKey);
    
    // Set medical context if enabled
    if (enableMedicalMode) {
      aiExtractor.setMedicalContext({
        specialty: 'primary_care',
        visitType: 'intake',
        enableValidation
      });
    }

    // Extract structured data from transcript
    const extractedData = await aiExtractor.extractMedicalData(transcript, language);

    // Map extracted data to question fields
    const extractedFields: Record<string, any> = {};
    
    for (const question of questions) {
      const fieldValue = extractFieldValue(extractedData, question);
      
      if (fieldValue) {
        extractedFields[question.field] = {
          field: question.field,
          value: fieldValue.value,
          confidence: fieldValue.confidence,
          source: 'ai_extraction',
          timestamp: new Date(),
          validationStatus: enableValidation ? 'needs_review' : 'valid'
        };
      }
    }

    // Perform validation if enabled
    if (enableValidation) {
      const validatedFields = await validateExtractedFields(extractedFields, questions);
      Object.assign(extractedFields, validatedFields);
    }

    res.json({
      success: true,
      data: {
        extractedFields,
        extractionAccuracy: calculateExtractionAccuracy(extractedFields),
        processingTime: Date.now(),
        transcriptLength: transcript.length,
        medicalMode: enableMedicalMode,
        validationEnabled: enableValidation
      }
    });

    log(`Advanced intake extraction completed for user ${userId} with ${Object.keys(extractedFields).length} fields extracted`);

  } catch (error) {
    logError('Advanced intake extraction error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Generate AI-powered clinical summary from intake data
 * POST /api/ai-intake/generate-clinical-summary
 */
aiIntakeRouter.post('/generate-clinical-summary', requireAuth, asyncHandler(async (req, res) => {
  const { extractedFields, patientId, encounterId, specialty = 'primary_care' } = req.body;
  const userId = (req.user as any).id;

  if (!extractedFields) {
    throw new AppError('Extracted fields are required', 400, 'MISSING_EXTRACTED_FIELDS');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = `You are an expert medical documentation AI. Generate a comprehensive clinical summary from patient intake data.

CLINICAL DOCUMENTATION REQUIREMENTS:
1. Use proper medical terminology and clinical language
2. Organize information in standard medical format (Chief Complaint, History, Assessment, Plan)
3. Include relevant medical codes (ICD-10, SNOMED CT) where applicable
4. Flag any critical information (allergies, severe conditions)
5. Maintain HIPAA compliance
6. Use objective, factual language
7. Include confidence levels for AI-extracted information

OUTPUT FORMAT:
- Chief Complaint (CC)
- History of Present Illness (HPI)
- Past Medical History (PMH)
- Medications
- Allergies
- Social History
- Family History
- Review of Systems (pertinent)
- Assessment and Plan

Be thorough but concise. Flag any missing critical information.`;

    const formattedData = formatExtractedDataForSummary(extractedFields);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a clinical summary from this intake data:\n\n${JSON.stringify(formattedData, null, 2)}\n\nSpecialty: ${specialty}` }
      ],
      temperature: 0.2,
      max_tokens: 2000
    });

    const clinicalSummary = response.choices[0]?.message?.content?.trim() || '';

    // Extract medical codes and critical flags
    const structuredData = extractStructuredClinicalData(clinicalSummary);

    // Save clinical summary to database
    await handleDatabaseOperation(
      () => dbStorage.saveClinicalSummary({
        userId,
        patientId,
        encounterId,
        summary: clinicalSummary,
        structuredData,
        specialty,
        confidence: calculateSummaryConfidence(extractedFields)
      }),
      'Failed to save clinical summary'
    );

    res.json({
      success: true,
      data: {
        clinicalSummary,
        structuredData,
        specialty,
        confidence: calculateSummaryConfidence(extractedFields),
        generatedAt: new Date().toISOString()
      }
    });

    log(`Clinical summary generated for user ${userId} and patient ${patientId}`);

  } catch (error) {
    logError('Clinical summary generation error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Validate extracted intake fields
 * POST /api/ai-intake/validate-fields
 */
aiIntakeRouter.post('/validate-fields', requireAuth, asyncHandler(async (req, res) => {
  const { fields, questions } = req.body;
  const userId = (req.user as any).id;

  if (!fields || !questions) {
    throw new AppError('Fields and questions are required', 400, 'MISSING_DATA');
  }

  try {
    const validatedFields = await validateExtractedFields(fields, questions);

    res.json({
      success: true,
      data: {
        validatedFields,
        validationTime: Date.now(),
        totalFields: Object.keys(fields).length,
        validFields: Object.values(validatedFields).filter((f: any) => f.validationStatus === 'valid').length
      }
    });

    log(`Field validation completed for user ${userId}`);

  } catch (error) {
    logError('Field validation error:', error);
    throw new AppError('Field validation failed', 500, 'VALIDATION_FAILED');
  }
}));

/**
 * Get AI intake processing metrics
 * GET /api/ai-intake/metrics/:patientId
 */
aiIntakeRouter.get('/metrics/:patientId', requireAuth, asyncHandler(async (req, res) => {
  const patientId = parseInt(req.params.patientId);
  const userId = (req.user as any).id;

  if (isNaN(patientId)) {
    throw new AppError('Invalid patient ID', 400, 'INVALID_PATIENT_ID');
  }

  try {
    const metrics = await dbStorage.getAIIntakeMetrics(patientId, userId);

    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    logError('AI intake metrics error:', error);
    throw new AppError('Failed to retrieve AI intake metrics', 500, 'METRICS_ERROR');
  }
}));

/**
 * Process real-time transcription updates
 * POST /api/ai-intake/process-partial
 */
aiIntakeRouter.post('/process-partial', requireAuth, asyncHandler(async (req, res) => {
  const { transcript, partialResults = {} } = req.body;
  const userId = (req.user as any).id;

  if (!transcript) {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  try {
    // Process partial transcript for real-time updates
    const processedResults = await processPartialTranscript(transcript, partialResults);

    res.json({
      success: true,
      data: {
        processedResults,
        processingTime: Date.now(),
        transcriptLength: transcript.length
      }
    });

    log(`Partial transcript processed for user ${userId}`);

  } catch (error) {
    logError('Partial transcript processing error:', error);
    throw new AppError('Partial transcript processing failed', 500, 'PARTIAL_PROCESSING_FAILED');
  }
}));

// Helper functions

function extractFieldValue(extractedData: any, question: any): { value: string; confidence: number } | null {
  // Map extracted medical data to question fields
  const fieldMapping: Record<string, string> = {
    'full_name': 'personalInfo.fullName',
    'date_of_birth': 'personalInfo.dateOfBirth',
    'gender': 'personalInfo.gender',
    'phone': 'personalInfo.phone',
    'email': 'personalInfo.email',
    'address': 'personalInfo.address',
    'emergency_contact': 'personalInfo.emergencyContact',
    'allergies': 'medicalHistory.allergies',
    'current_medications': 'medicalHistory.medications',
    'chronic_conditions': 'medicalHistory.chronicConditions',
    'past_surgeries': 'medicalHistory.pastSurgeries',
    'family_history': 'medicalHistory.familyHistory',
    'reason_for_visit': 'visitDetails.reasonForVisit',
    'symptoms': 'currentSymptoms.symptoms',
    'symptom_duration': 'currentSymptoms.duration',
    'pain_level': 'currentSymptoms.painAssessment.intensity',
    'insurance_provider': 'insurance.provider',
    'insurance_policy': 'insurance.policyNumber',
    'smoking_status': 'lifestyle.smokingStatus',
    'alcohol_use': 'lifestyle.alcoholUse',
    'exercise_habits': 'lifestyle.exercise'
  };

  const mapping = fieldMapping[question.field];
  if (!mapping) return null;

  const value = getNestedValue(extractedData, mapping);
  if (!value) return null;

  return {
    value: typeof value === 'object' ? JSON.stringify(value) : String(value),
    confidence: 0.8 // Default confidence for extracted fields
  };
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function validateExtractedFields(fields: Record<string, any>, questions: any[]): Promise<Record<string, any>> {
  const validatedFields: Record<string, any> = {};

  for (const question of questions) {
    const field = fields[question.field];
    if (!field) continue;

    let isValid = true;
    let confidenceMultiplier = 1.0;

    // Required field validation
    if (question.required && !field.value?.trim()) {
      isValid = false;
      confidenceMultiplier = 0.3;
    }

    // Pattern validation
    if (question.validation && field.value) {
      const isPatternValid = question.validation.test(field.value);
      if (!isPatternValid) {
        isValid = false;
        confidenceMultiplier = 0.7;
      }
    }

    // Options validation
    if (question.options && field.value) {
      const isOptionValid = question.options.includes(field.value);
      if (!isOptionValid) {
        isValid = false;
        confidenceMultiplier = 0.8;
      }
    }

    validatedFields[question.field] = {
      ...field,
      validationStatus: isValid ? 'valid' : 'needs_review',
      confidence: field.confidence * confidenceMultiplier
    };
  }

  return validatedFields;
}

function calculateExtractionAccuracy(fields: Record<string, any>): number {
  if (Object.keys(fields).length === 0) return 0;
  
  const totalConfidence = Object.values(fields).reduce((sum: number, field: any) => {
    return sum + (field.confidence || 0);
  }, 0);
  
  return Math.round((totalConfidence / Object.keys(fields).length) * 100);
}

function extractMedicalInsights(transcriptionResult: any): any {
  const insights = {
    medicalTermsFound: transcriptionResult.medicalTerms?.length || 0,
    conditions: [] as string[],
    medications: [] as string[],
    allergies: [] as string[],
    symptoms: [] as string[],
    confidence: transcriptionResult.confidence,
    criticalFlags: [] as string[]
  };

  // Extract medical terms by category
  if (transcriptionResult.medicalTerms) {
    transcriptionResult.medicalTerms.forEach((term: any) => {
      switch (term.type) {
        case 'condition':
          insights.conditions.push(term.term);
          break;
        case 'medication':
          insights.medications.push(term.term);
          break;
        case 'symptom':
          insights.symptoms.push(term.term);
          break;
      }

      // Check for critical terms
      const criticalTerms = ['allergy', 'severe', 'emergency', 'urgent', 'life-threatening'];
      if (criticalTerms.some(ct => term.term.toLowerCase().includes(ct))) {
        insights.criticalFlags.push(`Critical: ${term.term}`);
      }
    });
  }

  return insights;
}

function formatExtractedDataForSummary(extractedFields: Record<string, any>): string {
  const sections: string[] = [];

  for (const [fieldName, field] of Object.entries(extractedFields)) {
    if (field.value) {
      sections.push(`${fieldName}: ${field.value} (confidence: ${Math.round((field.confidence || 0) * 100)}%)`);
    }
  }

  return sections.join('\n');
}

function extractStructuredClinicalData(clinicalSummary: string): any {
  // Extract structured data from clinical summary
  // This is a simplified implementation - in a real scenario, you'd use NLP techniques
  
  return {
    chiefComplaint: extractSection(clinicalSummary, 'Chief Complaint'),
    history: extractSection(clinicalSummary, 'History'),
    assessment: extractSection(clinicalSummary, 'Assessment'),
    plan: extractSection(clinicalSummary, 'Plan'),
    icd10Codes: extractICD10Codes(clinicalSummary),
    confidence: 0.8
  };
}

function extractSection(text: string, sectionName: string): string {
  const regex = new RegExp(`${sectionName}:\\s*([^\\n]+)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : '';
}

function extractICD10Codes(text: string): string[] {
  const icd10Regex = /\b[A-Z]\d{2}\.\d{1,2}\b/g;
  const matches = text.match(icd10Regex);
  return matches || [];
}

function calculateSummaryConfidence(extractedFields: Record<string, any>): number {
  return calculateExtractionAccuracy(extractedFields);
}

async function processPartialTranscript(transcript: string, partialResults: any): Promise<any> {
  // Process partial transcript for real-time updates
  // This is a simplified implementation
  
  return {
    processedTranscript: transcript,
    confidence: 0.7,
    medicalTerms: [],
    updatedResults: partialResults
  };
}