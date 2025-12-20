import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import multer from 'multer';
import OpenAI from 'openai';

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Session configuration (stateless for serverless)
app.use(session({
  secret: process.env.SESSION_SECRET || 'aims-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper function to get OpenAI client
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.4'
  });
});

// AI Chat endpoint
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be provided as an array' });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = response.choices[0]?.message;
    res.json({
      success: true,
      data: {
        content: assistantMessage?.content,
        role: 'assistant'
      }
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Audio transcription endpoint
app.post('/api/ai/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Check for Deepgram API key first
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    
    if (deepgramApiKey) {
      try {
        const { createClient } = await import('@deepgram/sdk');
        const deepgram = createClient(deepgramApiKey);

        const audioBuffer = req.file.buffer;
        const mimetype = req.file.mimetype || 'audio/webm';

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: 'nova-2-medical',
            smart_format: true,
            punctuate: true,
            paragraphs: true,
            diarize: true,
            language: 'en-US',
            mimetype: mimetype
          }
        );

        if (error) {
          console.error('Deepgram error:', error);
          throw error;
        }

        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        
        return res.json({ 
          transcript,
          provider: 'deepgram-nova-2-medical',
          metadata: {
            confidence: result?.results?.channels?.[0]?.alternatives?.[0]?.confidence,
            duration: result?.metadata?.duration
          }
        });
      } catch (deepgramError) {
        console.error('Deepgram failed, trying OpenAI Whisper:', deepgramError);
      }
    }

    // Fallback to OpenAI Whisper
    const openai = getOpenAIClient();
    if (openai) {
      try {
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
      }
    }

    return res.status(503).json({ 
      error: 'Transcription service not configured. Please set DEEPGRAM_API_KEY or OPENAI_API_KEY.',
      fallbackAvailable: true
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// SOAP note generation endpoint
app.post('/api/ai/generate-soap', async (req: Request, res: Response) => {
  try {
    const { transcript, patientInfo, noteType } = req.body;

    if (!transcript) {
      return res.json({ 
        success: false,
        soap: 'No transcript provided. Please provide consultation text to generate SOAP notes.'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.json({
        success: false,
        soap: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.'
      });
    }

    const sanitizedTranscript = (transcript || '').toString().slice(0, 4000);
    const patientName = patientInfo?.name || 
                        `${patientInfo?.firstName || ''} ${patientInfo?.lastName || ''}`.trim() || 
                        'Unknown';

    const systemPrompt = `You are **AIMS AI Medical Scribe** — a real-time, HIPAA-compliant clinical documentation, coding, and billing assistant.

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
  "human_note": "{{FULL_NOTE_IN_PARAGRAPH_FORM}}\\n\\n---\\nPatient Take-Home Summary (plain English):\\n• ..."
}

**CRITICAL**: Return ONLY valid JSON. Do not include any text outside the JSON object.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Generate comprehensive medical documentation for this consultation.

PATIENT: ${patientName}
NOTE TYPE: ${noteType || 'General Consultation'}

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
      return res.json({ 
        success: false,
        soap: 'Could not generate SOAP notes from the provided transcript.'
      });
    }
    
    try {
      const aimsResponse = JSON.parse(responseContent);
      const humanNote = aimsResponse.human_note || '';
      
      return res.json({ 
        success: true,
        soap: humanNote,
        structuredData: aimsResponse.ehr_payload
      });
    } catch (parseError) {
      return res.json({ 
        success: true,
        soap: responseContent
      });
    }
  } catch (error: any) {
    console.error('SOAP generation error:', error);
    return res.json({ 
      success: false,
      soap: 'An error occurred while generating SOAP notes. Please try again.'
    });
  }
});

// Generate title endpoint
app.post('/api/ai/generate-title', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message must be provided' });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system',
          content: 'Create a very short title (3-5 words) for a conversation that starts with this message. Return only the title, no quotes or additional text.'
        },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 15
    });

    const title = response.choices[0].message.content?.trim() || 'New Conversation';
    res.json({ title });
  } catch (error: any) {
    console.error('Generate title error:', error);
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

// Intake summary generation
app.post('/api/ai/generate-intake-summary', async (req: Request, res: Response) => {
  try {
    const { formId, responses } = req.body;

    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses must be provided as an array' });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

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
      temperature: 0.1,
      max_tokens: 2000
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';
    
    res.json({
      success: true,
      data: {
        summary,
        formId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Intake summary error:', error);
    res.status(500).json({ error: 'Failed to generate intake summary' });
  }
});

// Catch-all for unhandled routes
app.all('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
