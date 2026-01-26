import { Router } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import { storage as dbStorage } from '../storage';
import {
  requireAuth,
  sendErrorResponse,
  sendSuccessResponse,
  asyncHandler,
  handleOpenAIError,
  AppError,
  handleDatabaseOperation
} from '../error-handler';

import { log, logError } from '../logger';

export const aiRouter = Router();

import { SYSTEM_PROMPTS } from '../prompts';

// Helper function to get OpenAI client for a user
async function getOpenAIClient(userId: number): Promise<OpenAI | null> {
  try {
    const user = await dbStorage.getUser(userId);
    if (!user) return null;

    // Check if user should use their own API key
    if (user.useOwnApiKey) {
      const userApiKey = await dbStorage.getUserApiKey(userId);
      if (userApiKey) {
        return new OpenAI({
          apiKey: userApiKey,
        });
      } else {
        // User is set to use own API key but hasn't provided one
        return null;
      }
    } else {
      // User should use global API key
      const globalApiKey = await dbStorage.getSystemSetting('global_openai_api_key');
      if (globalApiKey) {
        return new OpenAI({
          apiKey: globalApiKey,
        });
      }

      // Fallback to environment variable for backward compatibility
      if (process.env.OPENAI_API_KEY) {
        return new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }
    }

    return null;
  } catch (error) {
    logError('Error getting OpenAI client:', error);
    return null;
  }
}

// Configure multer for file uploads
const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Route to handle chat completion
aiRouter.post('/chat', requireAuth, asyncHandler(async (req, res) => {
  const { messages } = req.body;
  const userId = (req.user as any).id;

  if (!messages || !Array.isArray(messages)) {
    throw new AppError('Messages must be provided as an array', 400, 'INVALID_MESSAGES');
  }

  if (messages.length === 0) {
    throw new AppError('At least one message is required', 400, 'EMPTY_MESSAGES');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    const user = await handleDatabaseOperation(
      () => dbStorage.getUser(userId),
      'Failed to fetch user data'
    );

    const errorMessage = user?.useOwnApiKey
      ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
      : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';

    throw new AppError(errorMessage, 503, 'NO_API_KEY');
  }

  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = response.choices[0]?.message;
    if (!assistantMessage?.content) {
      throw new AppError('No response generated from AI service', 500, 'NO_AI_RESPONSE');
    }

    sendSuccessResponse(res, {
      content: assistantMessage.content,
      role: 'assistant'
    }, 'Chat completion successful');
  } catch (error) {
    logError('OpenAI API error:', error);
    throw handleOpenAIError(error);
  }
}));

// Route to generate a title for a conversation
aiRouter.post('/generate-title', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { message } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ error: 'Message must be provided' });
    }

    const openai = await getOpenAIClient(userId);
    if (!openai) {
      const user = await dbStorage.getUser(userId);
      const errorMessage = user?.useOwnApiKey
        ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
        : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';

      return res.status(400).json({ error: errorMessage });
    }

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system',
          content: 'Create a very short title (3-5 words) for a conversation that starts with this message. Return only the title, no quotes or additional text.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 15
    });

    const title = response.choices[0].message.content?.trim() || 'New Conversation';

    return res.json({ title });
  } catch (error) {
    logError('OpenAI API error:', error);
    return res.status(500).json({ error: 'Failed to generate title' });
  }
});

// Route to generate SOAP notes from transcript
aiRouter.post('/generate-soap', async (req, res) => {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { transcript, patientInfo, noteType } = req.body;
    const userId = req.user.id;

    if (!transcript) {
      return res.json({
        success: false,
        soap: 'No transcript provided. Please provide consultation text to generate SOAP notes.'
      });
    }

    // Fetch patient history if ID is available
    let patientHistory = "";
    if (patientInfo?.id && !isNaN(parseInt(patientInfo.id))) {
      try {
        const notes = await dbStorage.getMedicalNotesByPatient(parseInt(patientInfo.id), 3);
        if (notes && notes.length > 0) {
          const recent = notes.map(n => 
            `Date: ${new Date(n.createdAt).toLocaleDateString()}\nTitle: ${n.title}\nSummary: ${n.content.substring(0, 300)}...`
          ).join('\n---\n');
          patientHistory = `\n\nPATIENT MEDICAL HISTORY (Recent Visits):\n${recent}`;
        }
      } catch (err) {
        console.error('Error fetching patient history for context', err);
      }
    }

    // Check for mock mode (Demo)
    log(`Checking mock mode: env key=${process.env.OPENAI_API_KEY}`);
    if (process.env.OPENAI_API_KEY === 'sk-dummy-key' || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'mock') {
      log('Using MOCK AI response for demo');
      return res.json({
        success: true,
        soap: `
═══════════════════════════════════════
CLINICAL DOCUMENTATION (DEMO)
═══════════════════════════════════════

📋 PATIENT INFORMATION
• Name: ${patientInfo?.name || 'Unknown'}
• Visit Date: ${new Date().toLocaleDateString()}
• Visit Type: General Consultation

📍 CHIEF COMPLAINT (CC)
"Feeling unwell"

📝 HISTORY OF PRESENT ILLNESS (HPI)
Patient presents with general malaise. (This is a generated demo note because no valid OpenAI key was provided).

═══════════════════════════════════════
ASSESSMENT & DIAGNOSIS
═══════════════════════════════════════

🏥 DIAGNOSES (ICD-10 Codes):
1. R53.81 - Other malaise
   → Rationale: Patient complaint

═══════════════════════════════════════
PLAN
═══════════════════════════════════════

Recommended rest and fluids.
`,
        structuredData: {
          note_sections: {
            ChiefComplaint: "Feeling unwell",
            HPI: "Patient presents with general malaise.",
            Assessment: "General malaise",
            Plan: "Rest and fluids"
          },
          icd10_codes: [
            { code: "R53.81", description: "Other malaise", confidence: "high" }
          ],
          cpt_codes_today: [
            { code: "99213", description: "Office visit, established patient", confidence: "medium" }
          ]
        }
      });
    }

    const openai = await getOpenAIClient(userId);
    if (!openai) {
      const user = await dbStorage.getUser(userId);
      const errorMessage = user?.useOwnApiKey
        ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
        : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';

      return res.json({
        success: false,
        soap: errorMessage
      });
    }

    try {
      // Sanitize inputs

      const sanitizedTranscript = (transcript || '').toString().slice(0, 4000); // Limit length to avoid token issues

      // Extract patient info for the prompt
      const patientName = patientInfo?.name ||
        `${patientInfo?.firstName || ''} ${patientInfo?.lastName || ''}`.trim() ||
        'Unknown';

      const patientInfoString = `Patient: ${patientName}, ID: ${patientInfo?.id || 'Unknown'}`;

      // Prepare visit metadata - use location from patientInfo if provided
      const visitMeta = {
        visitType: patientInfo?.visitType || "General Consultation",
        location: patientInfo?.location || "Office Visit",
        inputSource: patientInfo?.inputSource || "unknown",
        provider: req.user.email || "Provider",
        patientDemographics: {
          name: patientName,
          id: patientInfo?.id || "Unknown",
          dob: patientInfo?.dateOfBirth || "Not provided",
          gender: patientInfo?.gender || "Not provided"
        },
        vitals: patientInfo?.vitals || {},
        specialty: patientInfo?.specialty || "Primary Care"
      };

      // Check for custom prompt if noteType is provided
      let customSystemPrompt: string | null = null;
      if (noteType) {
        try {
          const customPrompt = await dbStorage.getCustomNotePrompt(userId, noteType);
          if (customPrompt && customPrompt.systemPrompt) {
            customSystemPrompt = customPrompt.systemPrompt;
            log(`Using custom prompt for note type: ${noteType}`);
          }
        } catch (error) {
          logError('Error fetching custom prompt:', error);
          // Continue with default prompt
        }
      }

      // Determine which system prompt to use
      const systemPrompt = customSystemPrompt || SYSTEM_PROMPTS.SOAP_NOTE;

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Generate comprehensive medical documentation for this consultation.

VISIT METADATA (use this to determine visit type and location):
${JSON.stringify(visitMeta, null, 2)}
${patientHistory}
${patientHistory}

IMPORTANT: Use the 'location' and 'inputSource' fields above to determine visit context:
- If inputSource is 'voice' or location is 'In-Office' → This is an in-person office visit
- If inputSource is 'telemedicine' or location contains 'Telemedicine' → This is a telemedicine/video visit
- If inputSource is 'text' or 'upload' → Document as the location specifies, default to office visit

TRANSCRIPT:
${sanitizedTranscript}

Return the complete JSON object with ehr_payload and human_note fields.`
          }
        ],
        temperature: 0.3,
        max_tokens: 3000,
        response_format: { type: "json_object" }
      });

      const responseContent = response.choices[0]?.message?.content?.trim() || '';

      if (!responseContent) {
        logError('OpenAI returned empty response');
        return res.json({
          success: false,
          soap: 'Could not generate SOAP notes from the provided transcript. Please try with more detailed text.'
        });
      }

      try {
        // Parse the JSON response
        const aimsResponse = JSON.parse(responseContent);

        // Extract the human-readable note
        const humanNote = aimsResponse.human_note || '';

        // Return successful response with the generated notes and structured data
        return res.json({
          success: true,
          soap: humanNote,
          structuredData: aimsResponse.ehr_payload
        });
      } catch (parseError) {
        logError('Failed to parse AIMS AI response:', parseError);
        // Fallback: return the raw response if JSON parsing fails
        return res.json({
          success: true,
          soap: responseContent
        });
      }

    } catch (openaiError) {
      logError('OpenAI API error:', openaiError);

      // Return a valid JSON response even when OpenAI fails
      return res.json({
        success: false,
        soap: 'There was an error connecting to the AI service. Please try again later.'
      });
    }
  } catch (error) {
    logError('Server error generating SOAP notes:', error);
    // Return a valid JSON response even in case of errors
    return res.json({
      success: false,
      soap: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// Route to handle audio transcription using Deepgram
aiRouter.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Check for Deepgram API key
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

    // Handle mock transcription if no keys are present or mock key is set
    if (!deepgramApiKey && (process.env.OPENAI_API_KEY === 'sk-dummy-key' || !process.env.OPENAI_API_KEY)) {
      log('Using MOCK Transcription for demo');
      return res.json({
        transcript: "This is a simulated transcription. The patient reports experiencing mild fatigue and headaches for the past three days. Vitals are stable. No fever reported.",
        provider: 'mock-transcriber',
        metadata: {
          confidence: 0.99,
          words: 25,
          duration: 15.5,
          paragraphs: 1
        }
      });
    }

    if (!deepgramApiKey) {
      // Fallback to OpenAI Whisper if Deepgram not configured
      const userId = req.user?.id;
      if (userId) {
        const openai = await getOpenAIClient(userId);
        if (openai) {
          try {
            // Create a File object from the buffer for OpenAI
            const file = new File([new Uint8Array(req.file.buffer)], req.file.originalname || 'audio.webm', {
              type: req.file.mimetype || 'audio/webm'
            });

            const transcription = await openai.audio.transcriptions.create({
              file: file,
              model: 'whisper-1',
              language: 'en',
              response_format: 'text'
            });

            return res.json({
              transcript: transcription,
              provider: 'openai-whisper'
            });
          } catch (whisperError) {
            logError('OpenAI Whisper error:', whisperError);
            // Continue to browser speech recognition fallback message
          }
        }
      }

      return res.status(503).json({
        error: 'Transcription service not configured. Please set DEEPGRAM_API_KEY or use browser speech recognition.',
        fallbackAvailable: true
      });
    }

    // Use Deepgram for transcription
    const { createClient } = await import('@deepgram/sdk');
    const deepgram = createClient(deepgramApiKey);

    const audioBuffer = req.file.buffer;
    const mimetype = req.file.mimetype || 'audio/webm';

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2-medical', // Medical-optimized model
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        diarize: true, // Speaker identification
        language: 'en-US',
        mimetype: mimetype
      }
    );

    if (error) {
      logError('Deepgram transcription error:', error);
      return res.status(500).json({ error: 'Transcription failed: ' + error.message });
    }

    // Extract transcript from Deepgram response
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    // Also extract word-level timestamps and speaker diarization if available
    const words = result?.results?.channels?.[0]?.alternatives?.[0]?.words || [];
    const paragraphs = result?.results?.channels?.[0]?.alternatives?.[0]?.paragraphs?.paragraphs || [];

    return res.json({
      transcript,
      provider: 'deepgram-nova-2-medical',
      metadata: {
        confidence: result?.results?.channels?.[0]?.alternatives?.[0]?.confidence,
        words: words.length,
        duration: result?.metadata?.duration,
        paragraphs: paragraphs.length
      }
    });
  } catch (error) {
    logError('Transcription API error:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
});

// Route to generate AI summary for patient intake forms
aiRouter.post('/generate-intake-summary', requireAuth, asyncHandler(async (req, res) => {
  const { formId, responses } = req.body;
  const userId = (req.user as any).id;

  if (!responses || !Array.isArray(responses)) {
    throw new AppError('Responses must be provided as an array', 400, 'INVALID_RESPONSES');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('No OpenAI API key configured', 503, 'NO_API_KEY');
  }

  try {
    const systemPrompt = SYSTEM_PROMPTS.INTAKE_SUMMARY;

    const formattedResponses = responses.map((r: any) =>
      `Q: ${r.question}\nA: ${r.answer || '[No response]'}`
    ).join('\n\n');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a clinical intake summary from these patient responses:\n\n${formattedResponses}` }
      ],
      temperature: 0.1, // Low temperature for factual accuracy
      max_tokens: 2000
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';

    sendSuccessResponse(res, {
      summary,
      formId,
      generatedAt: new Date().toISOString()
    }, 'Intake summary generated successfully');
  } catch (error) {
    logError('Error generating intake summary:', error);
    throw handleOpenAIError(error);
  }
}));

// Route to get patient consultation context (previous notes, history, etc.)
aiRouter.get('/patient-context/:patientId', requireAuth, asyncHandler(async (req, res) => {
  const patientId = parseInt(req.params.patientId);
  const userId = (req.user as any).id;

  if (isNaN(patientId)) {
    throw new AppError('Invalid patient ID', 400, 'INVALID_PATIENT_ID');
  }

  try {
    // Fetch patient data
    const patient = await dbStorage.getPatient(patientId);
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }

    // Fetch patient's medical notes (last 5)
    const recentNotes = await dbStorage.getMedicalNotesByPatient(patientId, 5);

    // Fetch prescriptions
    const prescriptions = await dbStorage.getPrescriptionsByPatient(patientId);
    const activePrescriptions = prescriptions.filter(p => p.isActive);

    // Fetch medical alerts
    const alerts = await dbStorage.getMedicalAlertsByPatient(patientId);
    const activeAlerts = alerts.filter(a => a.isActive);

    // Fetch medical history entries
    const historyEntries = await dbStorage.getMedicalHistoryEntriesByPatient(patientId);

    // Fetch recent activity
    const activities = await dbStorage.getPatientActivity(patientId);
    const recentActivities = activities.slice(0, 10);

    // Build last visit summary if there are notes
    let lastVisitSummary = null;
    if (recentNotes.length > 0) {
      const lastNote = recentNotes[0];
      lastVisitSummary = {
        date: lastNote.createdAt,
        title: lastNote.title,
        type: lastNote.type,
        contentPreview: lastNote.content.substring(0, 500) + (lastNote.content.length > 500 ? '...' : '')
      };
    }

    // Calculate age from DOB
    let age = null;
    if (patient.dateOfBirth) {
      const dob = new Date(patient.dateOfBirth);
      const today = new Date();
      age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    const context = {
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName || ''}`.trim(),
        age,
        dateOfBirth: patient.dateOfBirth,
        email: patient.email,
        phone: patient.phone,
        address: patient.address
      },
      medicalHistory: patient.medicalHistory,
      historyEntries: historyEntries.map(h => ({
        category: h.category,
        title: h.title,
        description: h.description,
        date: h.date
      })),
      activeMedications: activePrescriptions.map(p => ({
        name: p.medicationName,
        dosage: p.dosage,
        frequency: p.frequency,
        instructions: p.instructions
      })),
      activeAlerts: activeAlerts.map(a => ({
        type: a.type,
        severity: a.severity,
        title: a.title,
        description: a.description
      })),
      lastVisit: lastVisitSummary,
      recentNotes: recentNotes.map(n => ({
        id: n.id,
        title: n.title,
        type: n.type,
        date: n.createdAt,
        preview: n.content.substring(0, 200)
      })),
      recentActivity: recentActivities.map(a => ({
        type: a.activityType,
        title: a.title,
        date: a.date
      })),
      totalVisits: medicalNotes.length
    };

    sendSuccessResponse(res, context, 'Patient context retrieved successfully');
  } catch (error) {
    logError('Error fetching patient context:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch patient context', 500, 'CONTEXT_FETCH_ERROR');
  }
}));

// Route to generate AI pre-consultation summary from patient history
aiRouter.post('/pre-consultation-summary', requireAuth, asyncHandler(async (req, res) => {
  const { patientId, patientContext } = req.body;
  const userId = (req.user as any).id;

  if (!patientContext) {
    throw new AppError('Patient context is required', 400, 'MISSING_CONTEXT');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('No OpenAI API key configured', 503, 'NO_API_KEY');
  }

  try {
    const systemPrompt = `You are a medical assistant preparing a concise pre-consultation summary for a physician.

CRITICAL RULES FOR ZERO HALLUCINATION:
1. ONLY summarize information from the provided patient context
2. If data is missing, explicitly state "[Not documented]"
3. NEVER fabricate or assume any medical information
4. Highlight any active alerts or concerning patterns
5. Note any gaps in documentation that need attention

Create a brief, scannable summary with:
1. Patient Snapshot (key demographics, chief concerns)
2. Active Problems/Diagnoses
3. Current Medications (with any concerns about interactions)
4. Recent Visit Summary (what was addressed, any pending items)
5. Active Alerts (allergies, warnings)
6. Suggested Focus Areas for This Visit

Keep it concise - the physician should be able to review in 30 seconds.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate a pre-consultation summary for this patient:\n\n${JSON.stringify(patientContext, null, 2)}` }
      ],
      temperature: 0.1,
      max_tokens: 1000
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';

    sendSuccessResponse(res, {
      summary,
      patientId,
      generatedAt: new Date().toISOString()
    }, 'Pre-consultation summary generated successfully');
  } catch (error) {
    logError('Error generating pre-consultation summary:', error);
    throw handleOpenAIError(error);
  }
}));

// Route to extract intake answers from continuous recording transcript (PUBLIC - No auth required)
aiRouter.post('/extract-intake-answers', asyncHandler(async (req, res) => {
  const { transcript, language, questions } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  // Use global OpenAI API key for public intake forms
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OpenAI API not configured', 503, 'NO_API_KEY');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const languageNames: Record<string, string> = {
      'en-US': 'English',
      'es-ES': 'Spanish (Español)',
      'ht-HT': 'Haitian Creole (Kreyòl)',
      'ru-RU': 'Russian (Русский)'
    };

    const systemPrompt = SYSTEM_PROMPTS.INTAKE_SUMMARY;
    
    let extractInstructions = "";
    if (questions && Array.isArray(questions) && questions.length > 0) {
      extractInstructions = `Extract answers for these specific fields:\n${JSON.stringify(questions, null, 2)}`;
    } else {
      extractInstructions = `Extract standard medical intake fields including: full_name, date_of_birth, gender, medication_list, allergies, medical_history, and chief_complaint.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Patient transcript:\n\n${transcript}\n\n${extractInstructions}` }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(content);

    sendSuccessResponse(res, {
      answers: parsed.answers || (parsed.summary ? parsed : {}), // Fallback in case AI doesn't follow strict structure
      summary: parsed.summary || '',
      language,
      extractedAt: new Date().toISOString()
    }, 'Intake answers extracted successfully');
  } catch (error) {
    logError('Error extracting intake answers:', error);
    throw handleOpenAIError(error);
  }
}));
// Route for AI visual health assessment during telemedicine
aiRouter.post('/visual-health-assessment', requireAuth, upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Image file is required', 400, 'MISSING_IMAGE');
  }

  const { patientName, chiefComplaint, currentSymptoms } = req.body;

  try {
    const { analyzePatientVisual } = await import('../visual-health-assessment');

    // Convert image buffer to base64
    const imageBase64 = req.file.buffer.toString('base64');

    const assessment = await analyzePatientVisual(imageBase64, {
      name: patientName,
      chiefComplaint,
      currentSymptoms
    });

    sendSuccessResponse(res, assessment, 'Visual health assessment completed');
  } catch (error) {
    logError('Error in visual health assessment:', error);
    throw new AppError('Visual health assessment failed', 500, 'ASSESSMENT_ERROR');
  }
}));

// Route to save telemedicine transcript
aiRouter.post('/save-telemedicine-transcript', requireAuth, asyncHandler(async (req, res) => {
  const { roomId, transcript, consultationId } = req.body;
  const userId = (req.user as any).id;

  if (!transcript || !Array.isArray(transcript)) {
    throw new AppError('Transcript must be provided as an array', 400, 'INVALID_TRANSCRIPT');
  }

  try {
    // Get the full transcript text
    const fullTranscript = transcript.join('\n');

    // Save to database (you can expand this to save to consultation notes)
    const result = {
      consultationId,
      roomId,
      transcript: fullTranscript,
      lineCount: transcript.length,
      savedAt: new Date().toISOString(),
      savedBy: userId
    };

    sendSuccessResponse(res, result, 'Transcript saved successfully');
  } catch (error) {
    logError('Error saving transcript:', error);
    throw new AppError('Failed to save transcript', 500, 'SAVE_ERROR');
  }
}));
