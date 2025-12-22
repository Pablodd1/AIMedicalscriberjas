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

export const aiRouter = Router();

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
    console.error('Error getting OpenAI client:', error);
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
  const userId = req.user.id;

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
    console.error('OpenAI API error:', error);
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
    console.error('OpenAI API error:', error);
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
            console.log(`Using custom prompt for note type: ${noteType}`);
          }
        } catch (error) {
          console.error('Error fetching custom prompt:', error);
          // Continue with default prompt
        }
      }

      // Determine which system prompt to use
      const systemPrompt = customSystemPrompt || `You are **AIMS AI Medical Scribe** — a real-time, HIPAA-compliant clinical documentation, coding, and billing assistant.

Your composite roles:
• Board-certified physician (all specialties)
• Certified Professional Coder & Biller
• Medical Scribe trained in AMA, CMS, Medicare, and Florida PIP standards

#############################################
# CRITICAL: ZERO HALLUCINATION PROTOCOL
#############################################
⚠️ ABSOLUTE RULES - VIOLATION IS UNACCEPTABLE:
1. ONLY document information EXPLICITLY stated in the transcript
2. If information is NOT mentioned, use "[Not documented in this encounter]"
3. NEVER fabricate, assume, or infer:
   - Vital signs not provided → "[Vitals not documented]"
   - Medications not mentioned → "[Per patient history - verify current list]"
   - Diagnoses not discussed → DO NOT create diagnoses
   - Physical exam findings not described → "[Exam deferred/not performed]"
   - Lab values not stated → "[Labs pending/not available]"
4. For any uncertain information, mark as "[Needs clarification]"
5. Quote patient directly when documenting subjective complaints

SOURCE MARKERS (use these in documentation):
- [Patient reported]: Direct patient statement
- [Per provider]: Information from healthcare provider
- [Per medical record]: Information from patient's existing record
- [Not documented]: Information not provided in this encounter
- [Needs clarification]: Information unclear or incomplete

#####################################
# OUTPUT — RETURN **ONE** JSON OBJECT
#####################################
{
  "ehr_payload": {
    "note_sections": {
      "PatientDemographics": "...",
      "ChiefComplaint": "...",
      "HPI": "...",
      "ROS": "...",
      "Medications": "...",
      "Allergies": "...",
      "PMH": "...",
      "PSH": "...",
      "FamilyHistory": "...",
      "SocialHistory": "...",
      "Vitals": "...",
      "PhysicalExam": "...",
      "Assessment": "...",
      "Plan": "...",
      "MedicalDecisionMaking": "...",
      "FollowUp": "...",
      "Consent": "..."
    },
    "icd10_codes": [
      { "code": "...", "description": "...", "rationale": "...", "confidence": "high|medium|low", "supporting_text": "..." }
    ],
    "cpt_codes_today": [
      { "code": "...", "description": "...", "modifiers": [""], "rationale": "...", "linked_dx": "...", "confidence": "high|medium|low" }
    ],
    "evaluation_coding": {
      "em_code": "...",
      "em_level": "...",
      "mdm_complexity": "straightforward|low|moderate|high",
      "time_spent_minutes": null,
      "coding_method": "mdm|time",
      "justification": "..."
    },
    "orders_referrals": [
      { "service": "...", "reason": "...", "location": "..." }
    ],
    "medication_rxs": [
      { "drug": "...", "dose": "...", "route": "...", "frequency": "...", "duration": "...", "indication": "..." }
    ],
    "patient_reported_outcomes": [],
    "red_flags": [],
    "verification_report": {
      "documented_items": 0,
      "inferred_items": 0,
      "missing_items": [],
      "needs_clarification": []
    },
    "timestamp": "${new Date().toISOString()}",
    "version": "2.4"
  },
  "human_note": "{{STRUCTURED_CLINICAL_NOTE}}"
}

The human_note MUST be a comprehensive, well-formatted clinical document with these EXACT sections:

═══════════════════════════════════════
CLINICAL DOCUMENTATION
═══════════════════════════════════════

📋 PATIENT INFORMATION
• Name: [Patient Name]
• DOB: [Date of Birth]  
• Visit Date: [Today's Date]
• Visit Type: [Office Visit/Telemedicine]
• Provider: [Provider Name]

📍 CHIEF COMPLAINT (CC)
[Primary reason for visit in patient's own words]

📝 HISTORY OF PRESENT ILLNESS (HPI)
[Comprehensive narrative including: Location, Quality, Severity, Duration, Timing, Context, Modifying factors, Associated signs/symptoms - use OLDCARTS or SOCRATES mnemonic]

📊 REVIEW OF SYSTEMS (ROS)
[List all systems reviewed, mark as positive (+), negative (-), or not reviewed]
• Constitutional: 
• HEENT:
• Cardiovascular:
• Respiratory:
• GI:
• Musculoskeletal:
• Neurological:
• Psychiatric:
• [Other relevant systems]

💊 CURRENT MEDICATIONS
[List all current medications with dose, route, frequency]

⚠️ ALLERGIES
[List all allergies with reaction type]

📜 PAST MEDICAL/SURGICAL HISTORY
[Relevant past conditions, surgeries, hospitalizations]

👥 FAMILY/SOCIAL HISTORY
[Relevant family medical history and social factors]

📈 VITAL SIGNS
[BP, HR, RR, Temp, O2 Sat, Weight, Height, BMI - mark "[Not documented]" if not provided]

🔍 PHYSICAL EXAMINATION
[Detailed exam findings organized by body system]

═══════════════════════════════════════
ASSESSMENT & DIAGNOSIS
═══════════════════════════════════════

🏥 DIAGNOSES (ICD-10 Codes):
1. [Diagnosis] - [ICD-10 Code]
   → Rationale: [Why this diagnosis based on documentation]
   → Supporting Evidence: "[Quote from transcript]"

📋 DIFFERENTIAL DIAGNOSES:
[List other conditions considered if applicable]

═══════════════════════════════════════
TREATMENT PLAN
═══════════════════════════════════════

💉 PROCEDURES PERFORMED TODAY:
[List any procedures with CPT codes]

💊 PRESCRIPTIONS (RX):
1. [Medication] [Dose] [Route] [Frequency] x [Duration]
   → Indication: [Why prescribed]
   → Rationale: [Clinical reasoning]

📋 ORDERS & REFERRALS:
[Labs, imaging, referrals ordered]

📚 PATIENT EDUCATION:
[Instructions given to patient]

📅 FOLLOW-UP:
[Return visit timing and instructions]

═══════════════════════════════════════
BILLING & CODING SUMMARY
═══════════════════════════════════════

📊 E&M CODING:
• CPT Code: [99XXX]
• Level: [Level 1-5]
• Coding Method: [MDM/Time-Based]
• MDM Complexity: [Straightforward/Low/Moderate/High]
• Time Spent: [XX minutes if time-based]
• Justification: [Why this level is supported]

💰 CPT CODES FOR TODAY'S SERVICES:
| Code | Description | Modifier | Linked DX | Confidence |
[Table of CPT codes]

🏷️ ICD-10 DIAGNOSIS CODES:
| Code | Description | Confidence | Supporting Text |
[Table of diagnosis codes]

⚠️ COMPLIANCE ALERTS:
[List any red flags or missing documentation that needs attention]

═══════════════════════════════════════
ATTESTATION
═══════════════════════════════════════
I have personally reviewed the patient's history and symptoms, examined the patient as documented, and rendered my professional medical opinion. This documentation accurately reflects the services provided.

---
📋 PATIENT TAKE-HOME SUMMARY (Plain Language):
• What we found: [Simple explanation]
• What this means: [Plain language diagnosis]
• What to do: [Action items for patient]
• When to return: [Follow-up instructions]
• Warning signs: [Red flags to watch for]

#####################################
# DOCUMENTATION RULES
#####################################
A. **Zero Inference Policy**
   • If not explicitly stated → "[Not documented in this encounter]"
   • Absent systems → DO NOT assume WNL without explicit statement
   • Uncertain or missing data → flag in **red_flags** AND **verification_report.missing_items**

B. **Specialty-Aware Detail**
   • Auto-expand PE & HPI with specialty maneuvers based on specialty hint.
   • Chiropractic/PIP → include ROM, palpation, ortho tests (SLR, FABER, Spurling's, Kemp's), functional impact, EMC statement if FL PIP.
   • Psychiatry → include DSM-5-aligned criteria, screening tools (PHQ-9, GAD-7).
   • Functional medicine → integrate thyroid, metabolic, hormone labs if mentioned.

C. **Coding & Billing - WITH CONFIDENCE LEVELS**
   • ICD-10 & CPT must be DIRECTLY justified by transcript documentation
   • Each code must have:
     - confidence: "high" (explicitly discussed), "medium" (strongly implied), "low" (reasonable inference)
     - supporting_text: Quote from transcript supporting the code
   • cpt_codes_today = procedures performed today ONLY
   • linked_dx = ICD-10 code supporting medical necessity
   • Future diagnostics/therapies → orders_referrals (NOT CPT)
   • New prescriptions → medication_rxs. Chronic meds remain in "Medications."

D. **Compliance & Audit Trail**
   • Red flag missing vitals, ROS, pain scale, consent
   • Explicit attestation: "Patient consent obtained for treatment. Risks/benefits explained."
   • If visit is Telemedicine/Video → include patient location, provider location, CPT modifier -95
   • If visit is Office Visit/In-Person → document as standard encounter (no -95 modifier needed)
   • HIPAA: Do not output PHI outside JSON. Never fabricate.

E. **Language**
   • Clinical tone, U.S. English.
   • human_note = readable narrative with source markers
   • Patient summary = 8th-grade level.

#####################################
# RED_FLAG TRIGGERS
#####################################
• Missing BP, HR, or SpO₂ in vitals.
• Medication without dose/route/frequency.
• Imaging/therapy codes listed as CPT instead of order.
• No ROS documented.
• No pain score documented.
• No consent documented for procedure or telemedicine.
• Any "low" confidence codes that need provider verification.

**CRITICAL**: Return ONLY valid JSON. Do not include any text outside the JSON object.`;

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
        console.error('OpenAI returned empty response');
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
        console.error('Failed to parse AIMS AI response:', parseError);
        // Fallback: return the raw response if JSON parsing fails
        return res.json({ 
          success: true,
          soap: responseContent
        });
      }
      
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError);
      
      // Return a valid JSON response even when OpenAI fails
      return res.json({ 
        success: false,
        soap: 'There was an error connecting to the AI service. Please try again later.'
      });
    }
  } catch (error) {
    console.error('Server error generating SOAP notes:', error);
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
    
    if (!deepgramApiKey) {
      // Fallback to OpenAI Whisper if Deepgram not configured
      const userId = req.user?.id;
      if (userId) {
        const openai = await getOpenAIClient(userId);
        if (openai) {
          try {
            // Create a File object from the buffer for OpenAI
            const file = new File([req.file.buffer], req.file.originalname || 'audio.webm', {
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
            console.error('OpenAI Whisper error:', whisperError);
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
      console.error('Deepgram transcription error:', error);
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
    console.error('Transcription API error:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio: ' + (error instanceof Error ? error.message : 'Unknown error') });
  }
});

// Route to generate AI summary for patient intake forms
aiRouter.post('/generate-intake-summary', requireAuth, asyncHandler(async (req, res) => {
  const { formId, responses } = req.body;
  const userId = req.user.id;

  if (!responses || !Array.isArray(responses)) {
    throw new AppError('Responses must be provided as an array', 400, 'INVALID_RESPONSES');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('No OpenAI API key configured', 503, 'NO_API_KEY');
  }

  try {
    const systemPrompt = `You are a medical intake specialist creating a clinical summary from patient intake responses.

CRITICAL RULES FOR ZERO HALLUCINATION:
1. ONLY include information EXPLICITLY provided in the patient responses
2. If information is unclear or missing, mark it as "[Not provided]" or "[Needs clarification]"
3. NEVER fabricate, assume, or infer medical details not stated
4. Use exact quotes from patient when relevant

Create a structured clinical summary with these sections:
- Patient Demographics (name, DOB, contact info)
- Chief Complaint / Reason for Visit
- Medical History (conditions, surgeries, family history)
- Current Medications
- Allergies
- Social History (occupation, lifestyle)
- Review of Systems (symptoms reported)
- Risk Factors Identified
- Priority Concerns for Provider

Format as a clear, professional intake summary for physician review.`;

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
    console.error('Error generating intake summary:', error);
    throw handleOpenAIError(error);
  }
}));

// Route to get patient consultation context (previous notes, history, etc.)
aiRouter.get('/patient-context/:patientId', requireAuth, asyncHandler(async (req, res) => {
  const patientId = parseInt(req.params.patientId);
  const userId = req.user.id;

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
    const medicalNotes = await dbStorage.getMedicalNotesByPatient(patientId);
    const recentNotes = medicalNotes.slice(0, 5);

    // Fetch prescriptions
    const prescriptions = await dbStorage.getPrescriptionsByPatient(patientId);
    const activePrescriptions = prescriptions.filter(p => p.isActive);

    // Fetch medical alerts
    const alerts = await dbStorage.getMedicalAlertsByPatient(patientId);
    const activeAlerts = alerts.filter(a => a.isActive);

    // Fetch medical history entries
    const historyEntries = await dbStorage.getMedicalHistoryEntriesByPatient(patientId);

    // Fetch recent activity
    const activities = await dbStorage.getPatientActivityByPatient(patientId);
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
    console.error('Error fetching patient context:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to fetch patient context', 500, 'CONTEXT_FETCH_ERROR');
  }
}));

// Route to generate AI pre-consultation summary from patient history
aiRouter.post('/pre-consultation-summary', requireAuth, asyncHandler(async (req, res) => {
  const { patientId, patientContext } = req.body;
  const userId = req.user.id;

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
    console.error('Error generating pre-consultation summary:', error);
    throw handleOpenAIError(error);
  }
}));

// Route to extract intake answers from continuous recording transcript
aiRouter.post('/extract-intake-answers', asyncHandler(async (req, res) => {
  const { transcript, language } = req.body;

  if (!transcript || typeof transcript !== 'string') {
    throw new AppError('Transcript is required', 400, 'MISSING_TRANSCRIPT');
  }

  // For public intake forms, use environment API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('No OpenAI API key configured', 503, 'NO_API_KEY');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const systemPrompt = `You are a medical intake assistant. Extract patient information from a transcript of them speaking about their health.

CRITICAL RULES:
1. Extract ONLY information that is explicitly stated in the transcript
2. For missing information, use "Not provided"
3. NEVER make assumptions or fill in details not mentioned
4. Organize information into standard intake form fields
5. Be culturally sensitive - the patient may be speaking English, Spanish, Haitian Creole, or Russian

Extract the following fields (if mentioned):
- full_name: Patient's full name
- date_of_birth: Date of birth (format: MM/DD/YYYY if possible)
- gender: Gender identity
- email: Email address
- phone: Phone number
- emergency_contact: Emergency contact phone
- address: Full address
- insurance_provider: Insurance company name
- insurance_policy_number: Policy number
- policy_holder_name: Name of policy holder
- group_number: Insurance group number
- primary_care_physician: PCP name
- current_medications: List of current medications
- allergies: Medication/food allergies
- chronic_conditions: Chronic medical conditions
- past_surgeries: Previous surgeries
- family_medical_history: Family health history
- reason_for_visit: Chief complaint/reason for visit
- symptom_description: Detailed symptom description
- symptom_duration: How long symptoms have lasted
- symptom_severity: Severity rating (if mentioned)
- symptoms_before: Whether symptoms occurred before
- symptom_triggers: What makes symptoms better/worse
- occupation: Current job
- lifestyle_habits: Smoking, alcohol, drug use
- exercise_diet: Exercise frequency and diet
- living_arrangement: Living situation
- weight_fever_fatigue: Recent weight loss, fever, or fatigue
- chest_pain_history: Cardiac symptom history
- respiratory_symptoms: Cough, shortness of breath, wheezing
- gastrointestinal_symptoms: GI symptoms
- musculoskeletal_symptoms: Joint/muscle pain
- neurological_symptoms: Headaches, dizziness, numbness

Return ONLY a JSON object with two fields:
1. "answers": object with field names as keys and extracted values as values
2. "summary": a brief 2-3 sentence clinical summary for the healthcare provider

Example:
{
  "answers": {
    "full_name": "John Doe",
    "reason_for_visit": "Persistent cough for 2 weeks",
    "symptom_description": "Dry cough, worse at night",
    "allergies": "Penicillin"
  },
  "summary": "Patient presents with a 2-week history of dry cough that worsens at night. Reports allergy to Penicillin. No other significant symptoms mentioned."
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Language: ${language}\n\nTranscript:\n${transcript}` }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const result = response.choices[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(result);
    
    sendSuccessResponse(res, {
      answers: parsed.answers || {},
      summary: parsed.summary || '',
      language,
      processedAt: new Date().toISOString()
    }, 'Intake answers extracted successfully');
  } catch (error) {
    console.error('Error extracting intake answers:', error);
    throw handleOpenAIError(error);
  }
}));

// Extract structured answers from patient intake transcript (PUBLIC - No auth required)
aiRouter.post('/extract-intake-answers', asyncHandler(async (req, res) => {
  const { transcript, language, questions } = req.body;

  if (!transcript) {
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
      en: 'English',
      es: 'Spanish (Español)',
      ht: 'Haitian Creole (Kreyòl)',
      ru: 'Russian (Русский)'
    };

    const systemPrompt = `You are a medical intake assistant. Extract structured information from patient recordings.

CRITICAL INSTRUCTIONS:
1. The patient spoke in ${languageNames[language] || 'English'}
2. Extract ONLY information explicitly mentioned by the patient
3. If something is not mentioned, use "[Not mentioned]"
4. Return answers in English regardless of input language
5. Be precise and concise
6. Format dates as MM/DD/YYYY
7. For phone numbers, use format: (XXX) XXX-XXXX if US
8. Extract medication names, allergies, and conditions accurately

Return ONLY a JSON object with the extracted answers. Do not include any markdown, explanations, or additional text.

Example format:
{
  "full_name": "John Smith",
  "date_of_birth": "01/15/1980",
  "phone": "(555) 123-4567",
  "current_medications": "Lisinopril 10mg daily, Metformin 500mg twice daily",
  "allergies": "Penicillin - causes rash",
  "reason_for_visit": "Persistent cough for 2 weeks",
  ...
}`;

    const userPrompt = `Patient transcript:\n\n${transcript}\n\nExtract answers for these fields:\n${JSON.stringify(questions, null, 2)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    
    let answers = {};
    try {
      answers = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      answers = {};
    }
    
    sendSuccessResponse(res, {
      answers,
      language,
      extractedAt: new Date().toISOString()
    }, 'Answers extracted successfully');
  } catch (error) {
    console.error('Error extracting intake answers:', error);
    throw handleOpenAIError(error);
  }
}));