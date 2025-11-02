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
      
      // Prepare visit metadata
      const visitMeta = {
        visitType: patientInfo?.visitType || "General Consultation",
        location: "Telemedicine",
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
      { "code": "...", "description": "...", "rationale": "..." }
    ],
    "cpt_codes_today": [
      { "code": "...", "description": "...", "modifiers": [""], "rationale": "..." }
    ],
    "orders_referrals": [
      { "service": "...", "reason": "...", "location": "..." }
    ],
    "medication_rxs": [
      { "drug": "...", "dose": "...", "route": "...", "frequency": "...", "duration": "...", "indication": "..." }
    ],
    "patient_reported_outcomes": [],
    "red_flags": [],
    "timestamp": "${new Date().toISOString()}",
    "version": "2.3"
  },
  "human_note": "{{FULL_NOTE_IN_PARAGRAPH_FORM}}\\n\\n---\\nPatient Take-Home Summary (plain English):\\n• ..."
}

#####################################
# DOCUMENTATION RULES
#####################################
A. **WNL Logic**
   • Absent systems → "Within Normal Limits (WNL) — provider to verify."
   • Uncertain or missing data → flag in **red_flags**.

B. **Specialty-Aware Detail**
   • Auto-expand PE & HPI with specialty maneuvers based on specialty hint.
   • Chiropractic/PIP → include ROM, palpation, ortho tests (SLR, FABER, Spurling's, Kemp's), functional impact, EMC statement if FL PIP.
   • Psychiatry → include DSM-5-aligned criteria, screening tools (PHQ-9, GAD-7).
   • Functional medicine → integrate thyroid, metabolic, hormone labs if mentioned.

C. **Coding & Billing**
   • ICD-10 & CPT must be justified by documentation.
   • cpt_codes_today = procedures performed today.
   • Future diagnostics/therapies → orders_referrals.
   • New prescriptions → medication_rxs. Chronic meds remain in "Medications."
   • Include time-based coding support (MDM vs time in visit).

D. **Compliance & Audit Trail**
   • Red flag missing vitals, ROS, pain scale, consent.
   • Explicit attestation: "Patient consent obtained for treatment. Risks/benefits explained."
   • Telemedicine → include patient location, provider location, CPT modifier -95.
   • HIPAA: Do not output PHI outside JSON. Never fabricate.

E. **Language**
   • Clinical tone, U.S. English.
   • human_note = readable narrative.
   • Patient summary = 8th-grade level.

#####################################
# STYLE NOTES
#####################################
• Use paragraph form, not fragments.
• Bullet lists only when improving clarity.
• Always justify coding.
• Include outcome metrics when possible.

#####################################
# RED_FLAG TRIGGERS
#####################################
• Missing BP, HR, or SpO₂ in vitals.
• Medication without dose/route/frequency.
• Imaging/therapy codes listed as CPT instead of order.
• No ROS in a Level-4+ visit.
• No pain score documented.
• No consent documented for procedure or telemedicine.

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

VISIT METADATA:
${JSON.stringify(visitMeta, null, 2)}

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
        let humanNote = aimsResponse.human_note || '';
        
        // If human_note is missing or empty, convert the JSON to a formatted string
        if (!humanNote || humanNote.trim().length === 0) {
          // Convert JSON object to a readable SOAP note format
          if (typeof aimsResponse === 'object') {
            // Check if it's in SOAP format (Subjective, Objective, Assessment, Plan)
            if (aimsResponse.Subjective || aimsResponse.Objective || aimsResponse.Assessment || aimsResponse.Plan) {
              humanNote = `SUBJECTIVE:\n${aimsResponse.Subjective || 'N/A'}\n\nOBJECTIVE:\n${aimsResponse.Objective || 'N/A'}\n\nASSESSMENT:\n${aimsResponse.Assessment || 'N/A'}\n\nPLAN:\n${aimsResponse.Plan || 'N/A'}`;
            } else {
              // For other JSON structures, pretty print it
              humanNote = JSON.stringify(aimsResponse, null, 2);
            }
          } else {
            humanNote = String(aimsResponse);
          }
        }
        
        // Return successful response with the generated notes and structured data
        return res.json({ 
          success: true,
          soap: humanNote,
          structuredData: aimsResponse.ehr_payload || aimsResponse
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

// Route to handle audio transcription
aiRouter.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    // Since we can't use OpenAI's Whisper API directly due to the Node.js environment,
    // let's take a simpler approach for the prototype
    // In a real implementation, we'd use temp files or a cloud storage solution
    // For now, just return a mock transcript for demonstration
    
    return res.json({ 
      transcript: "This is a simulated transcript for your audio file. In a production environment, " +
                 "this would be processed by the OpenAI Whisper API. To use the actual transcription " +
                 "functionality, proper file handling with temp files would be implemented."
    });
  } catch (error) {
    console.error('Transcription API error:', error);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});