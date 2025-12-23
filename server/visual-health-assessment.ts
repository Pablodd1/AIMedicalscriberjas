import OpenAI from 'openai';
import { storage } from './storage';

export interface VisualHealthAssessment {
  timestamp: string;
  findings: string[];
  concerns: string[];
  recommendations: string[];
  confidence: 'high' | 'medium' | 'low';
  requiresAttention: boolean;
}

/**
 * Analyze patient video frame using GPT-4o Vision for visual health assessment
 * This provides the doctor with AI-powered visual clues about the patient's condition
 */
export async function analyzePatientVisual(
  imageBase64: string,
  patientContext?: {
    name?: string;
    chiefComplaint?: string;
    currentSymptoms?: string;
  }
): Promise<VisualHealthAssessment> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({ apiKey });

  try {
    const systemPrompt = `You are a medical visual assessment AI assistant helping doctors during telemedicine consultations.

**YOUR ROLE:**
Analyze the patient's video frame and provide CLINICAL OBSERVATIONS that can help the doctor assess the patient's condition.

**CRITICAL RULES - ZERO HALLUCINATION:**
1. ONLY report what you DIRECTLY observe in the image
2. Use medical terminology where appropriate (e.g., "diaphoresis" for sweating, "pallor" for pale skin)
3. NEVER diagnose - only provide observations
4. Mark confidence level: high (clearly visible), medium (likely but not certain), low (possible but uncertain)
5. Flag anything that requires immediate medical attention
6. Be culturally sensitive and professional

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
- Nasal flaring (respiratory distress)

🫁 **Respiratory Signs:**
- Breathing pattern (normal, labored, rapid, shallow)
- Use of accessory muscles (visible shoulder movement)
- Chest movement (symmetric, asymmetric)
- Visible cough or respiratory effort

💧 **Hydration/Perfusion:**
- Skin appearance (dry, moist, diaphoretic)
- Visible edema (swelling in face, neck)
- Lip color and moisture

🏥 **Clinical Red Flags:**
- Signs of acute distress
- Difficulty breathing
- Altered consciousness
- Visible trauma or injury
- Severe pain behaviors

📋 **Environmental Observations:**
- Medical equipment visible
- Patient positioning
- Lighting quality (affects assessment accuracy)

**OUTPUT FORMAT:**
Provide a structured JSON response:
{
  "findings": ["Observable finding 1", "Observable finding 2"],
  "concerns": ["Any concerning signs that warrant attention"],
  "recommendations": ["What the doctor should assess further"],
  "confidence": "high|medium|low",
  "requiresAttention": true/false
}

**REMEMBER:**
- You are NOT diagnosing
- You are providing VISUAL OBSERVATIONS to assist the doctor
- Be specific but cautious
- Note image quality issues that limit assessment`;

    const userPrompt = patientContext 
      ? `Patient context:
- Name: ${patientContext.name || 'Not provided'}
- Chief Complaint: ${patientContext.chiefComplaint || 'Not provided'}
- Current Symptoms: ${patientContext.currentSymptoms || 'Not provided'}

Please analyze this patient's video frame and provide visual health observations.`
      : 'Please analyze this patient's video frame and provide visual health observations.';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: 'high' // Use high detail for medical assessment
              }
            }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.2, // Low temperature for consistent, factual observations
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const result = JSON.parse(content);

    return {
      timestamp: new Date().toISOString(),
      findings: result.findings || [],
      concerns: result.concerns || [],
      recommendations: result.recommendations || [],
      confidence: result.confidence || 'medium',
      requiresAttention: result.requiresAttention || false
    };

  } catch (error) {
    console.error('Error in visual health assessment:', error);
    throw error;
  }
}

/**
 * Batch analyze multiple frames to track changes over time
 */
export async function analyzeVisualTimeline(
  frames: { timestamp: string; imageBase64: string }[],
  patientContext?: any
): Promise<{
  assessments: VisualHealthAssessment[];
  trends: string[];
  summary: string;
}> {
  const assessments: VisualHealthAssessment[] = [];

  // Analyze each frame
  for (const frame of frames.slice(0, 5)) { // Limit to 5 frames to manage API costs
    try {
      const assessment = await analyzePatientVisual(frame.imageBase64, patientContext);
      assessments.push(assessment);
    } catch (error) {
      console.error(`Error analyzing frame at ${frame.timestamp}:`, error);
    }
  }

  // Identify trends
  const trends: string[] = [];
  
  // Compare first and last assessment
  if (assessments.length >= 2) {
    const first = assessments[0];
    const last = assessments[assessments.length - 1];
    
    // Check for improving/worsening patterns
    if (last.requiresAttention && !first.requiresAttention) {
      trends.push('⚠️ Condition appears to be worsening - increased concerns noted');
    } else if (!last.requiresAttention && first.requiresAttention) {
      trends.push('✅ Condition appears to be stabilizing - fewer concerns noted');
    }
  }

  // Generate summary
  const allConcerns = assessments.flatMap(a => a.concerns);
  const uniqueConcerns = [...new Set(allConcerns)];
  
  const summary = `Visual assessment timeline (${assessments.length} observations):
${uniqueConcerns.length > 0 ? `Concerns identified: ${uniqueConcerns.join(', ')}` : 'No significant concerns noted'}
${trends.length > 0 ? `\nTrends: ${trends.join('; ')}` : ''}`;

  return {
    assessments,
    trends,
    summary
  };
}
