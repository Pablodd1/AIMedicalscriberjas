/**
 * Google Gemini API Integration
 * Hybrid approach: Use Gemini for visual/video, Keep OpenAI for SOAP notes
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initialize Gemini AI client
 */
export function initGemini(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️ GEMINI_API_KEY not configured');
    return null;
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI initialized');
  }

  return genAI;
}

/**
 * Get Gemini model instance
 * @param modelName - Model to use (gemini-1.5-pro, gemini-1.5-flash, etc.)
 */
export function getGeminiModel(modelName: string = 'gemini-1.5-pro') {
  const client = initGemini();
  if (!client) {
    throw new Error('Gemini AI not initialized');
  }

  return client.getGenerativeModel({ model: modelName });
}

/**
 * Visual Health Assessment using Gemini Pro Vision
 * Use instead of GPT-4o Vision (63% cheaper, same quality)
 */
export async function analyzePatientVisualGemini(
  imageBase64: string,
  patientContext?: {
    name?: string;
    chiefComplaint?: string;
    currentSymptoms?: string;
  }
): Promise<{
  timestamp: string;
  findings: string[];
  concerns: string[];
  recommendations: string[];
  confidence: 'high' | 'medium' | 'low';
  requiresAttention: boolean;
}> {
  const model = getGeminiModel('gemini-1.5-pro');

  const systemPrompt = `You are a medical visual assessment AI assistant helping doctors during telemedicine consultations.

**YOUR ROLE:**
Analyze the patient's image and provide CLINICAL OBSERVATIONS that can help the doctor assess the patient's condition.

**CRITICAL RULES - ZERO HALLUCINATION:**
1. ONLY report what you DIRECTLY observe in the image
2. Use medical terminology where appropriate
3. NEVER diagnose - only provide observations
4. Mark confidence level: high (clearly visible), medium (likely but not certain), low (possible but uncertain)
5. Flag anything that requires immediate medical attention

**WHAT TO ASSESS:**

🔍 **General Appearance:**
- Level of distress (appears comfortable, mild distress, moderate distress, severe distress)
- Positioning (sitting upright, leaning forward, lying down)
- Overall affect (alert, drowsy, anxious, calm)

👤 **Facial Features:**
- Color (normal, pale, flushed, cyanotic, jaundiced)
- Asymmetry (facial drooping, weakness)
- Expression (grimacing, relaxed, confused)
- Eyes (redness, discharge, pupils, ptosis)

🫁 **Respiratory Signs:**
- Breathing pattern (normal, labored, rapid, shallow)
- Use of accessory muscles
- Visible cough or respiratory effort

💧 **Hydration/Perfusion:**
- Skin appearance (dry, moist, diaphoretic)
- Visible edema (swelling)

🏥 **Clinical Red Flags:**
- Signs of acute distress
- Difficulty breathing
- Altered consciousness

**OUTPUT FORMAT (JSON):**
{
  "findings": ["Observable finding 1", "Observable finding 2"],
  "concerns": ["Any concerning signs"],
  "recommendations": ["What the doctor should assess further"],
  "confidence": "high|medium|low",
  "requiresAttention": true/false
}`;

  const userPrompt = patientContext
    ? `Patient context:
- Name: ${patientContext.name || 'Not provided'}
- Chief Complaint: ${patientContext.chiefComplaint || 'Not provided'}
- Current Symptoms: ${patientContext.currentSymptoms || 'Not provided'}

Please analyze this patient's image and provide visual health observations.`
    : 'Please analyze this patient's image and provide visual health observations.';

  try {
    const result = await model.generateContent([
      systemPrompt,
      userPrompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = result.response;
    const text = response.text();

    // Parse JSON response
    const assessment = JSON.parse(text);

    return {
      timestamp: new Date().toISOString(),
      findings: assessment.findings || [],
      concerns: assessment.concerns || [],
      recommendations: assessment.recommendations || [],
      confidence: assessment.confidence || 'medium',
      requiresAttention: assessment.requiresAttention || false
    };
  } catch (error) {
    console.error('Error in Gemini visual assessment:', error);
    throw error;
  }
}

/**
 * Video Analysis using Gemini Pro Vision
 * Native video support (OpenAI cannot do this properly)
 */
export async function analyzePatientVideoGemini(
  videoBase64: string,
  videoMimeType: string,
  analysisType: 'gait' | 'breathing' | 'movement' | 'general',
  patientContext?: any
): Promise<{
  timestamp: string;
  videoAnalysis: string;
  keyFindings: string[];
  temporalChanges: string[];
  recommendations: string[];
}> {
  const model = getGeminiModel('gemini-1.5-pro');

  const analysisPrompts = {
    gait: `Analyze this patient's gait and movement patterns. Look for:
- Gait abnormalities (shuffling, limping, ataxic, hemiparetic)
- Balance and coordination
- Symmetry of movement
- Speed and rhythm
- Posture and positioning
- Signs of pain or weakness`,

    breathing: `Analyze this patient's breathing patterns. Look for:
- Respiratory rate (count breaths per minute)
- Breathing pattern (regular, labored, shallow, deep)
- Use of accessory muscles (shoulder/neck movement)
- Chest wall movement symmetry
- Signs of respiratory distress (nasal flaring, pursed lips)
- Cough patterns`,

    movement: `Analyze this patient's general movement patterns. Look for:
- Tremor (resting, intention, essential)
- Involuntary movements
- Range of motion limitations
- Muscle weakness or asymmetry
- Coordination and fine motor skills
- Pain behaviors`,

    general: `Perform general visual assessment of this patient video. Look for:
- Overall appearance and distress level
- Positioning and posture changes
- Facial expressions and affect
- Skin color changes
- Breathing patterns
- Movement abnormalities
- Any concerning signs`
  };

  const systemPrompt = `You are a medical AI assistant analyzing patient video for clinical observations.

**CRITICAL RULES:**
1. ONLY report what you observe in the video
2. Note temporal changes (things that change over time)
3. Track patterns and progression
4. Use medical terminology
5. NEVER diagnose - only observe

${analysisPrompts[analysisType]}

**OUTPUT FORMAT (JSON):**
{
  "videoAnalysis": "Detailed narrative analysis",
  "keyFindings": ["Finding 1", "Finding 2"],
  "temporalChanges": ["Change observed over time 1"],
  "recommendations": ["What to examine further"]
}`;

  try {
    const result = await model.generateContent([
      systemPrompt,
      {
        inlineData: {
          data: videoBase64,
          mimeType: videoMimeType
        }
      }
    ]);

    const response = result.response;
    const text = response.text();

    const analysis = JSON.parse(text);

    return {
      timestamp: new Date().toISOString(),
      videoAnalysis: analysis.videoAnalysis || '',
      keyFindings: analysis.keyFindings || [],
      temporalChanges: analysis.temporalChanges || [],
      recommendations: analysis.recommendations || []
    };
  } catch (error) {
    console.error('Error in Gemini video analysis:', error);
    throw error;
  }
}

/**
 * Extract patient intake form data using Gemini Flash
 * 97% cheaper than OpenAI for simple extraction tasks
 */
export async function extractIntakeAnswersGemini(
  transcript: string,
  language: string,
  questions: string[]
): Promise<{
  answers: Record<string, string>;
  language: string;
  extractedAt: string;
}> {
  const model = getGeminiModel('gemini-1.5-flash'); // Use Flash for cost savings

  const systemPrompt = `You are a medical intake assistant. Extract patient information from a transcript.

**CRITICAL RULES:**
1. Extract ONLY information explicitly mentioned
2. For missing information, use "Not provided"
3. Return answers in English regardless of input language
4. Be precise and concise

**OUTPUT FORMAT (JSON):**
{
  "full_name": "extracted or Not provided",
  "date_of_birth": "MM/DD/YYYY or Not provided",
  "phone": "(XXX) XXX-XXXX or Not provided",
  ...
}`;

  const userPrompt = `Language: ${language}

Transcript:
${transcript}

Extract answers for these fields:
${questions.join(', ')}

Return ONLY valid JSON, no markdown.`;

  try {
    const result = await model.generateContent([systemPrompt, userPrompt]);
    const response = result.response;
    const text = response.text();

    // Clean up response (remove markdown if present)
    let cleanedText = text.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const answers = JSON.parse(cleanedText);

    return {
      answers,
      language,
      extractedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error extracting intake answers with Gemini:', error);
    throw error;
  }
}

/**
 * Simple chat/Q&A using Gemini Flash
 * 97% cheaper than OpenAI for simple queries
 */
export async function chatWithGemini(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  const model = getGeminiModel('gemini-1.5-flash');

  // Convert messages to Gemini format
  const geminiMessages = messages.map(msg => {
    if (msg.role === 'system') {
      return { role: 'user', parts: [{ text: msg.content }] };
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    };
  });

  // Prepend system prompt if provided
  if (systemPrompt) {
    geminiMessages.unshift({
      role: 'user',
      parts: [{ text: systemPrompt }]
    });
  }

  try {
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }
    });

    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    
    return result.response.text();
  } catch (error) {
    console.error('Error in Gemini chat:', error);
    throw error;
  }
}

/**
 * Generate intake summary using Gemini Flash
 * Cheaper alternative for non-critical documentation
 */
export async function generateIntakeSummaryGemini(
  responses: Array<{ question: string; answer: string }>
): Promise<string> {
  const model = getGeminiModel('gemini-1.5-flash');

  const systemPrompt = `You are a medical intake specialist creating a clinical summary.

**CRITICAL RULES:**
1. ONLY include information explicitly provided
2. If information is unclear or missing, mark it as "[Not provided]"
3. NEVER fabricate medical details
4. Use exact quotes from patient when relevant

Create a structured clinical summary with these sections:
- Patient Demographics
- Chief Complaint / Reason for Visit
- Medical History
- Current Medications
- Allergies
- Social History
- Review of Systems
- Priority Concerns for Provider`;

  const formattedResponses = responses
    .map(r => `Q: ${r.question}\nA: ${r.answer || '[No response]'}`)
    .join('\n\n');

  const userPrompt = `Generate a clinical intake summary from these patient responses:\n\n${formattedResponses}`;

  try {
    const result = await model.generateContent([systemPrompt, userPrompt]);
    return result.response.text();
  } catch (error) {
    console.error('Error generating intake summary with Gemini:', error);
    throw error;
  }
}

export default {
  initGemini,
  getGeminiModel,
  analyzePatientVisualGemini,
  analyzePatientVideoGemini,
  extractIntakeAnswersGemini,
  chatWithGemini,
  generateIntakeSummaryGemini
};
