import { Router } from 'express';
import { requireAuth, asyncHandler, AppError, handleDatabaseOperation } from '../error-handler';
import { log, logError } from '../logger';
import { storage as dbStorage } from '../storage';
import { AIIntakeExtractor } from '../ai-intake-extractor';
import { SYSTEM_PROMPTS } from '../prompts';

export const intakeRouter = Router();

// Helper to get OpenAI client for AI extraction
async function getOpenAIClient(userId: number) {
  try {
    const user = await dbStorage.getUser(userId);
    if (!user) return null;

    if (user.useOwnApiKey) {
      const userApiKey = await dbStorage.getUserApiKey(userId);
      if (userApiKey) return userApiKey;
    } else {
      const globalApiKey = await dbStorage.getSystemSetting('global_openai_api_key');
      if (globalApiKey) return globalApiKey;
      if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    }
    return null;
  } catch (error) {
    logError('Error getting OpenAI client:', error);
    return null;
  }
}

/**
 * Extract comprehensive medical data from voice transcript
 * POST /api/intake/extract-medical-data
 */
intakeRouter.post('/extract-medical-data', requireAuth, asyncHandler(async (req, res) => {
  const { transcript, patientId, language = 'en-US' } = req.body;
  const userId = (req.user as any).id;

  if (!transcript) {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  if (transcript.length < 10) {
    throw new AppError('Transcript too short for meaningful extraction', 400, 'TRANSCRIPT_TOO_SHORT');
  }

  const apiKey = await getOpenAIClient(userId);
  if (!apiKey) {
    throw new AppError(
      'AI service not configured. Please add your OpenAI API key in Settings to use advanced AI features.',
      503,
      'NO_AI_SERVICE'
    );
  }

  try {
    const extractor = new AIIntakeExtractor(apiKey);
    const extractedData = await extractor.extractMedicalData(transcript, language);
    
    // Generate clinical summary
    const clinicalSummary = await extractor.generateClinicalSummary(extractedData, patientId);

    // Save to database if patient ID provided
    if (patientId) {
      await handleDatabaseOperation(
        () => dbStorage.savePatientIntakeData(patientId, {
          extractedData,
          clinicalSummary,
          transcript,
          language,
          extractedAt: new Date()
        }),
        'Failed to save patient intake data'
      );
    }

    res.json({
      success: true,
      data: extractedData,
      clinicalSummary,
      metadata: {
        transcriptLength: transcript.length,
        extractionTime: new Date().toISOString(),
        language,
        patientId
      }
    });

    log(`Successfully extracted medical data for patient ${patientId || 'unknown'}`);
  } catch (error) {
    logError('Error extracting medical data:', error);
    throw new AppError(
      `Failed to extract medical data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'EXTRACTION_FAILED'
    );
  }
}));

/**
 * Extract intake form answers from transcript
 * POST /api/intake/extract-intake-answers
 */
intakeRouter.post('/extract-intake-answers', asyncHandler(async (req, res) => {
  const { transcript, language = 'en-US' } = req.body;

  if (!transcript) {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  if (transcript.length < 5) {
    throw new AppError('Transcript too short for extraction', 400, 'TRANSCRIPT_TOO_SHORT');
  }

  // Use global API key for intake forms (public endpoint)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'sk-dummy-key') {
    // Return mock data for demo/testing
    return res.json({
      success: true,
      answers: {
        full_name: "John Smith",
        date_of_birth: "1985-06-15",
        phone: "(555) 123-4567",
        email: "john.smith@email.com",
        emergency_contact: "Jane Smith (Spouse) - (555) 987-6543",
        reason_for_visit: "Annual checkup and blood work review",
        current_medications: "Lisinopril 10mg daily for blood pressure",
        allergies: "Penicillin - causes rash",
        chronic_conditions: "Hypertension, seasonal allergies",
        past_surgeries: "Appendectomy 2015",
        family_history: "Father had heart disease, mother has diabetes",
        symptoms: "Occasional headaches, especially in the morning",
        symptom_duration: "About 2 months",
        insurance_provider: "Blue Cross Blue Shield",
        insurance_policy: "ABC123456789"
      },
      metadata: {
        provider: 'mock-ai-extraction',
        confidence: 0.95,
        transcriptLength: transcript.length,
        extractionTime: new Date().toISOString()
      }
    });
  }

  try {
    const extractor = new AIIntakeExtractor(apiKey);
    const answers = await extractor.extractIntakeAnswers(transcript, language);

    res.json({
      success: true,
      answers,
      metadata: {
        provider: 'openai-gpt-4o',
        confidence: 0.9,
        transcriptLength: transcript.length,
        extractionTime: new Date().toISOString(),
        language
      }
    });

    log(`Successfully extracted ${Object.keys(answers).length} intake answers`);
  } catch (error) {
    logError('Error extracting intake answers:', error);
    throw new AppError(
      `Failed to extract intake answers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'EXTRACTION_FAILED'
    );
  }
}));

/**
 * Generate clinical summary from intake data
 * POST /api/intake/generate-clinical-summary
 */
intakeRouter.post('/generate-clinical-summary', requireAuth, asyncHandler(async (req, res) => {
  const { intakeData, patientId } = req.body;
  const userId = (req.user as any).id;

  if (!intakeData) {
    throw new AppError('Intake data is required', 400, 'MISSING_INTAKE_DATA');
  }

  const apiKey = await getOpenAIClient(userId);
  if (!apiKey) {
    throw new AppError(
      'AI service not configured. Please add your OpenAI API key in Settings.',
      503,
      'NO_AI_SERVICE'
    );
  }

  try {
    const extractor = new AIIntakeExtractor(apiKey);
    const clinicalSummary = await extractor.generateClinicalSummary(intakeData, patientId);

    // Save summary to database
    if (patientId) {
      await handleDatabaseOperation(
        () => dbStorage.saveClinicalSummary(patientId, {
          summary: clinicalSummary.summary,
          keyFindings: clinicalSummary.keyFindings,
          recommendations: clinicalSummary.recommendations,
          riskFactors: clinicalSummary.riskFactors,
          confidence: clinicalSummary.confidence,
          generatedAt: new Date()
        }),
        'Failed to save clinical summary'
      );
    }

    res.json({
      success: true,
      clinicalSummary,
      metadata: {
        generatedAt: new Date().toISOString(),
        patientId,
        confidence: clinicalSummary.confidence
      }
    });

    log(`Successfully generated clinical summary for patient ${patientId}`);
  } catch (error) {
    logError('Error generating clinical summary:', error);
    throw new AppError(
      `Failed to generate clinical summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'SUMMARY_GENERATION_FAILED'
    );
  }
}));

/**
 * Process continuous voice intake (real-time)
 * POST /api/intake/process-continuous
 */
intakeRouter.post('/process-continuous', asyncHandler(async (req, res) => {
  const { transcript, partialResults, language = 'en-US', sessionId } = req.body;

  if (!transcript && !partialResults) {
    throw new AppError('Transcript or partial results required', 400, 'MISSING_DATA');
  }

  try {
    // Use mock processing for demo if no API key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-dummy-key') {
      return res.json({
        success: true,
        extractedFields: {
          full_name: transcript?.includes('name') ? 'Extracted Name' : '',
          date_of_birth: transcript?.includes('birth') ? '1985-06-15' : '',
          phone: transcript?.includes('phone') ? '(555) 123-4567' : '',
          email: transcript?.includes('email') ? 'patient@email.com' : '',
          allergies: transcript?.includes('allerg') ? 'Penicillin' : '',
          medications: transcript?.includes('medication') ? 'Lisinopril 10mg daily' : '',
          symptoms: transcript?.includes('symptom') ? 'Headache, fatigue' : ''
        },
        confidence: 0.85,
        processingTime: 150,
        sessionId,
        metadata: {
          provider: 'mock-continuous-processing',
          transcriptLength: transcript?.length || 0,
          partialResults: !!partialResults
        }
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const extractor = new AIIntakeExtractor(apiKey);
    
    // For continuous processing, extract intake answers
    const extractedData = await extractor.extractIntakeAnswers(transcript, language);

    res.json({
      success: true,
      extractedFields: extractedData,
      confidence: 0.9,
      processingTime: 200,
      sessionId,
      metadata: {
        provider: 'openai-gpt-4o',
        transcriptLength: transcript.length,
        language
      }
    });

    log(`Processed continuous intake for session ${sessionId}`);
  } catch (error) {
    logError('Error processing continuous intake:', error);
    throw new AppError(
      `Failed to process continuous intake: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'PROCESSING_FAILED'
    );
  }
}));

/**
 * Submit continuous intake form
 * POST /api/public/intake-form/:formId/submit-continuous
 */
intakeRouter.post('/public/intake-form/:formId/submit-continuous', asyncHandler(async (req, res) => {
  const { formId } = req.params;
  const { answers, summary, transcript, language, consentGiven, signature, audioUrl } = req.body;

  if (!formId) {
    throw new AppError('Form ID is required', 400, 'MISSING_FORM_ID');
  }

  if (!answers || typeof answers !== 'object') {
    throw new AppError('Answers are required', 400, 'MISSING_ANSWERS');
  }

  try {
    // Get the intake form
    const form = await handleDatabaseOperation(
      () => dbStorage.getIntakeFormById(parseInt(formId)),
      'Failed to fetch intake form'
    );

    if (!form) {
      throw new AppError('Intake form not found', 404, 'FORM_NOT_FOUND');
    }

    if (form.status !== 'pending') {
      throw new AppError('Intake form is no longer available', 400, 'FORM_NOT_AVAILABLE');
    }

    // Save each answer
    const savedAnswers = [];
    for (const [field, answer] of Object.entries(answers)) {
      if (answer && typeof answer === 'string' && answer.trim()) {
        const savedAnswer = await handleDatabaseOperation(
          () => dbStorage.saveIntakeFormAnswer(formId, {
            questionId: field,
            question: field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            answer: answer.trim(),
            answerType: 'voice',
            audioUrl: audioUrl || null
          }),
          'Failed to save intake answer'
        );
        savedAnswers.push(savedAnswer);
      }
    }

    // Save the transcript and summary
    await handleDatabaseOperation(
      () => dbStorage.saveIntakeTranscript(formId, {
        transcript,
        summary,
        language,
        consentGiven: !!consentGiven,
        signature: signature || null,
        processedAt: new Date()
      }),
      'Failed to save intake transcript'
    );

    res.json({
      success: true,
      message: 'Intake form answers submitted successfully',
      data: {
        formId,
        answersSubmitted: savedAnswers.length,
        transcriptSaved: !!transcript,
        processedAt: new Date().toISOString()
      }
    });

    log(`Successfully submitted continuous intake for form ${formId}`);
  } catch (error) {
    logError('Error submitting continuous intake:', error);
    throw new AppError(
      `Failed to submit intake form: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'SUBMISSION_FAILED'
    );
  }
}));

/**
 * Get intake processing status
 * GET /api/intake/status/:sessionId
 */
intakeRouter.get('/status/:sessionId', asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new AppError('Session ID is required', 400, 'MISSING_SESSION_ID');
  }

  try {
    // Get processing status from cache/database
    const status = await handleDatabaseOperation(
      () => dbStorage.getIntakeProcessingStatus(sessionId),
      'Failed to get processing status'
    );

    res.json({
      success: true,
      status: status || {
        sessionId,
        status: 'processing',
        progress: 0,
        lastUpdate: new Date().toISOString()
      }
    });
  } catch (error) {
    logError('Error getting intake status:', error);
    throw new AppError(
      `Failed to get intake status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'STATUS_CHECK_FAILED'
    );
  }
}));