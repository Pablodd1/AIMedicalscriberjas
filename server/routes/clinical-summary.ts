import { Router } from 'express';
import { requireAuth, asyncHandler, AppError, handleDatabaseOperation } from '../error-handler';
import { log, logError } from '../logger';
import OpenAI from 'openai';

export const clinicalSummaryRouter = Router();

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
 * Generate clinical summary from patient data
 * POST /api/clinical-summary/generate
 */
clinicalSummaryRouter.post('/generate', requireAuth, asyncHandler(async (req, res) => {
  const { 
    transcript, 
    extractedFields, 
    patientId, 
    encounterId, 
    specialty = 'primary_care',
    enableMedicalInsights = true,
    enableConfidenceScoring = true,
    summaryType = 'soap'
  } = req.body;
  const userId = (req.user as any).id;

  if (!transcript && !extractedFields) {
    throw new AppError('Either transcript or extracted fields are required', 400, 'MISSING_INPUT_DATA');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const startTime = Date.now();

    // Prepare input data
    const inputData = await prepareClinicalData(transcript, extractedFields, patientId, encounterId);

    // Generate clinical summary based on type
    let clinicalSummary;
    switch (summaryType) {
      case 'soap':
        clinicalSummary = await generateSOAPNote(openai, inputData, specialty);
        break;
      case 'progress':
        clinicalSummary = await generateProgressNote(openai, inputData, specialty);
        break;
      case 'consultation':
        clinicalSummary = await generateConsultationNote(openai, inputData, specialty);
        break;
      case 'discharge':
        clinicalSummary = await generateDischargeSummary(openai, inputData, specialty);
        break;
      default:
        clinicalSummary = await generateSOAPNote(openai, inputData, specialty);
    }

    // Extract medical codes
    clinicalSummary.icd10Codes = await extractICD10Codes(openai, clinicalSummary);
    clinicalSummary.cptCodes = await extractCPTCodes(openai, clinicalSummary);

    // Check drug interactions
    clinicalSummary.drugInteractions = await checkDrugInteractions(openai, clinicalSummary);

    // Assess risk level
    clinicalSummary.riskLevel = await assessRiskLevel(openai, clinicalSummary);
    clinicalSummary.criticalAlerts = await generateCriticalAlerts(openai, clinicalSummary);

    // Generate medical insights if enabled
    if (enableMedicalInsights) {
      clinicalSummary.medicalInsights = await generateMedicalInsights(openai, clinicalSummary);
    }

    // Calculate confidence score if enabled
    if (enableConfidenceScoring) {
      clinicalSummary.confidence = calculateClinicalConfidence(clinicalSummary);
    }

    const processingTime = Date.now() - startTime;

    // Save clinical summary to database
    await handleDatabaseOperation(
      () => dbStorage.saveClinicalSummary({
        userId,
        patientId,
        encounterId,
        summaryType,
        chiefComplaint: clinicalSummary.chiefComplaint,
        historyOfPresentIllness: clinicalSummary.historyOfPresentIllness,
        assessment: clinicalSummary.assessment,
        plan: clinicalSummary.plan,
        icd10Codes: clinicalSummary.icd10Codes,
        cptCodes: clinicalSummary.cptCodes,
        medicalDecisionMaking: clinicalSummary.medicalDecisionMaking,
        confidence: clinicalSummary.confidence,
        riskLevel: clinicalSummary.riskLevel,
        drugInteractions: clinicalSummary.drugInteractions,
        criticalAlerts: clinicalSummary.criticalAlerts,
        medicalInsights: clinicalSummary.medicalInsights,
        generatedAt: new Date()
      }),
      'Failed to save clinical summary'
    );

    res.json({
      success: true,
      data: clinicalSummary,
      processingTime,
      generatedAt: new Date().toISOString()
    });

    log(`Clinical summary generated for user ${userId}, patient ${patientId}, type ${summaryType}`);

  } catch (error) {
    logError('Clinical summary generation error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Extract ICD-10 codes from clinical summary
 * POST /api/clinical-summary/extract-icd10-codes
 */
clinicalSummaryRouter.post('/extract-icd10-codes', requireAuth, asyncHandler(async (req, res) => {
  const { summary, chiefComplaint, medicalHistory, enableMedicalMode = true } = req.body;
  const userId = (req.user as any).id;

  if (!summary) {
    throw new AppError('Summary text is required', 400, 'MISSING_SUMMARY');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode
      ? `You are an expert medical coding AI. Extract ICD-10 codes from clinical documentation with high accuracy.

ICD-10 CODING RULES:
1. Only extract codes that are clearly indicated in the text
2. Include both the code and accurate description
3. Assign confidence levels based on text clarity
4. Mark the most likely primary diagnosis
5. Use standard ICD-10-CM format (e.g., I10, E11.9)
6. Prioritize specificity when possible

RETURN FORMAT:
{
  "codes": [
    {
      "code": "string",
      "description": "string",
      "confidence": number (0-1),
      "isPrimary": boolean
    }
  ]
}`
      : `Extract medical condition codes from clinical text. Return ICD-10 codes with descriptions and confidence scores.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract ICD-10 codes from this clinical documentation:\n\nSummary: ${summary}\n${chiefComplaint ? `Chief Complaint: ${chiefComplaint}` : ''}\n${medicalHistory ? `Medical History: ${medicalHistory}` : ''}` }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No ICD-10 codes extracted');
    }

    const result = JSON.parse(content);
    const icd10Codes = result.codes || [];

    res.json({
      success: true,
      data: {
        codes: icd10Codes,
        extractionTime: Date.now(),
        totalCodes: icd10Codes.length,
        primaryCode: icd10Codes.find((code: any) => code.isPrimary)
      }
    });

    log(`ICD-10 codes extracted for user ${userId}: ${icd10Codes.length} codes`);

  } catch (error) {
    logError('ICD-10 extraction error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Extract CPT codes from clinical summary
 * POST /api/clinical-summary/extract-cpt-codes
 */
clinicalSummaryRouter.post('/extract-cpt-codes', requireAuth, asyncHandler(async (req, res) => {
  const { summary, procedures, enableMedicalMode = true } = req.body;
  const userId = (req.user as any).id;

  if (!summary) {
    throw new AppError('Summary text is required', 400, 'MISSING_SUMMARY');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode
      ? `You are an expert medical coding AI. Extract CPT codes from clinical documentation.

CPT CODING RULES:
1. Extract procedure and service codes mentioned in the text
2. Include both the code and accurate description
3. Assign confidence levels based on text clarity
4. Categorize codes (e.g., Evaluation & Management, Procedures, Diagnostics)
5. Use standard CPT format (e.g., 99213, 93000)

RETURN FORMAT:
{
  "codes": [
    {
      "code": "string",
      "description": "string",
      "confidence": number (0-1),
      "category": "string"
    }
  ]
}`
      : `Extract medical procedure codes from clinical text. Return CPT codes with descriptions and confidence scores.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Extract CPT codes from this clinical documentation:\n\nSummary: ${summary}\n${procedures ? `Procedures: ${procedures}` : ''}` }
      ],
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No CPT codes extracted');
    }

    const result = JSON.parse(content);
    const cptCodes = result.codes || [];

    res.json({
      success: true,
      data: {
        codes: cptCodes,
        extractionTime: Date.now(),
        totalCodes: cptCodes.length
      }
    });

    log(`CPT codes extracted for user ${userId}: ${cptCodes.length} codes`);

  } catch (error) {
    logError('CPT extraction error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Check drug interactions
 * POST /api/clinical-summary/check-drug-interactions
 */
clinicalSummaryRouter.post('/check-drug-interactions', requireAuth, asyncHandler(async (req, res) => {
  const { medications, patientId, enableMedicalMode = true } = req.body;
  const userId = (req.user as any).id;

  if (!medications || !Array.isArray(medications)) {
    throw new AppError('Medications array is required', 400, 'MISSING_MEDICATIONS');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode
      ? `You are an expert clinical pharmacology AI. Analyze drug interactions with medical accuracy.

DRUG INTERACTION ANALYSIS RULES:
1. Identify potential interactions between all medication pairs
2. Assess severity (mild, moderate, severe)
3. Describe interaction mechanism
4. Explain clinical significance
5. Provide management recommendations
6. Consider patient-specific factors when available

RETURN FORMAT:
{
  "interactions": [
    {
      "medication1": "string",
      "medication2": "string", 
      "severity": "mild|moderate|severe",
      "description": "string",
      "mechanism": "string",
      "clinicalSignificance": "string",
      "management": "string"
    }
  ]
}`
      : `Analyze drug interactions between medications. Return interaction details with severity and management recommendations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze drug interactions for these medications:\n\n${medications.join(', ')}\n${patientId ? `Patient ID: ${patientId}` : ''}` }
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No drug interactions analyzed');
    }

    const result = JSON.parse(content);
    const interactions = result.interactions || [];

    res.json({
      success: true,
      data: {
        interactions,
        totalInteractions: interactions.length,
        severeInteractions: interactions.filter((i: any) => i.severity === 'severe').length,
        moderateInteractions: interactions.filter((i: any) => i.severity === 'moderate').length,
        mildInteractions: interactions.filter((i: any) => i.severity === 'mild').length
      }
    });

    log(`Drug interactions analyzed for user ${userId}: ${interactions.length} interactions`);

  } catch (error) {
    logError('Drug interaction analysis error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Assess patient risk level
 * POST /api/clinical-summary/assess-risk
 */
clinicalSummaryRouter.post('/assess-risk', requireAuth, asyncHandler(async (req, res) => {
  const { clinicalSummary, patientId, enableMedicalMode = true } = req.body;
  const userId = (req.user as any).id;

  if (!clinicalSummary) {
    throw new AppError('Clinical summary is required', 400, 'MISSING_CLINICAL_SUMMARY');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode
      ? `You are an expert clinical risk assessment AI. Evaluate patient risk levels based on clinical data.

RISK ASSESSMENT CRITERIA:
1. LOW: Minimal risk factors, stable conditions, routine care
2. MODERATE: Some risk factors, requires monitoring
3. HIGH: Multiple risk factors, needs close follow-up
4. CRITICAL: Severe conditions, immediate attention needed

CONSIDER:
- Chief complaint severity
- Medical history complexity
- Medication interactions
- Age and comorbidities
- Social determinants
- Previous adverse events

RETURN FORMAT:
{
  "riskLevel": "low|moderate|high|critical",
  "confidence": number (0-1),
  "riskFactors": ["list of identified risk factors"],
  "rationale": "detailed explanation"
}`
      : `Assess patient risk level based on clinical summary. Return risk level with confidence and rationale.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Assess risk level for this patient:\n\nChief Complaint: ${clinicalSummary.chiefComplaint}\nHistory: ${clinicalSummary.historyOfPresentIllness}\nAssessment: ${clinicalSummary.assessment}\nPlan: ${clinicalSummary.plan}\nMedications: ${clinicalSummary.drugInteractions.length} interactions\n${patientId ? `Patient ID: ${patientId}` : ''}` }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No risk assessment generated');
    }

    const result = JSON.parse(content);

    res.json({
      success: true,
      data: {
        riskLevel: result.riskLevel,
        confidence: result.confidence,
        riskFactors: result.riskFactors,
        rationale: result.rationale
      }
    });

    log(`Risk assessment completed for user ${userId}: ${result.riskLevel} risk`);

  } catch (error) {
    logError('Risk assessment error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Generate critical alerts
 * POST /api/clinical-summary/generate-critical-alerts
 */
clinicalSummaryRouter.post('/generate-critical-alerts', requireAuth, asyncHandler(async (req, res) => {
  const { clinicalSummary, patientId, enableMedicalMode = true } = req.body;
  const userId = (req.user as any).id;

  if (!clinicalSummary) {
    throw new AppError('Clinical summary is required', 400, 'MISSING_CLINICAL_SUMMARY');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode
      ? `You are an expert clinical safety AI. Generate critical alerts for patient safety.

CRITICAL ALERT GENERATION RULES:
1. Identify life-threatening conditions
2. Flag severe drug interactions
3. Highlight allergy concerns
4. Alert on dosage errors
5. Monitor for contraindications
6. Consider patient-specific risk factors

ALERT TYPES:
- allergy: Potential allergic reactions
- contraindication: Treatment contraindications
- drug_interaction: Dangerous medication combinations
- dosage: Incorrect dosing concerns
- monitoring: Need for enhanced monitoring

RETURN FORMAT:
{
  "criticalAlerts": [
    {
      "type": "allergy|contraindication|drug_interaction|dosage|monitoring",
      "severity": "low|moderate|high|critical",
      "title": "brief alert title",
      "description": "detailed explanation",
      "actionRequired": "specific actions needed",
      "confidence": number (0-1)
    }
  ]
}`
      : `Generate critical safety alerts from clinical summary. Focus on patient safety concerns.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate critical alerts for this clinical summary:\n\nChief Complaint: ${clinicalSummary.chiefComplaint}\nAssessment: ${clinicalSummary.assessment}\nPlan: ${clinicalSummary.plan}\nICD-10 Codes: ${clinicalSummary.icd10Codes.map(c => c.code).join(', ')}\nDrug Interactions: ${clinicalSummary.drugInteractions.length}\n${patientId ? `Patient ID: ${patientId}` : ''}` }
      ],
      temperature: 0.1,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No critical alerts generated');
    }

    const result = JSON.parse(content);
    const criticalAlerts = result.criticalAlerts || [];

    res.json({
      success: true,
      data: {
        criticalAlerts,
        totalAlerts: criticalAlerts.length,
        highSeverityAlerts: criticalAlerts.filter((alert: any) => 
          ['high', 'critical'].includes(alert.severity)
        ).length
      }
    });

    log(`Critical alerts generated for user ${userId}: ${criticalAlerts.length} alerts`);

  } catch (error) {
    logError('Critical alerts generation error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Generate medical insights
 * POST /api/clinical-summary/generate-medical-insights
 */
clinicalSummaryRouter.post('/generate-medical-insights', requireAuth, asyncHandler(async (req, res) => {
  const { clinicalSummary, patientId, enableMedicalMode = true } = req.body;
  const userId = (req.user as any).id;

  if (!clinicalSummary) {
    throw new AppError('Clinical summary is required', 400, 'MISSING_CLINICAL_SUMMARY');
  }

  const openai = await getOpenAIClient(userId);
  if (!openai) {
    throw new AppError('AI service not configured', 503, 'NO_AI_SERVICE');
  }

  try {
    const systemPrompt = enableMedicalMode
      ? `You are an expert clinical insights AI. Generate medical insights to support clinical decision making.

MEDICAL INSIGHTS GENERATION RULES:
1. Identify potential diagnosis considerations
2. Suggest appropriate diagnostic workup
3. Recommend treatment options
4. Highlight monitoring needs
5. Suggest follow-up care
6. Consider evidence-based guidelines
7. Flag quality measures opportunities

INSIGHT TYPES:
- diagnosis_suggestion: Consider additional diagnoses
- treatment_recommendation: Suggest treatment options
- monitoring_alert: Recommend monitoring
- follow_up_needed: Suggest follow-up care

RETURN FORMAT:
{
  "medicalInsights": [
    {
      "type": "diagnosis_suggestion|treatment_recommendation|monitoring_alert|follow_up_needed",
      "confidence": number (0-1),
      "description": "insight description",
      "rationale": "detailed reasoning",
      "evidence": ["supporting evidence"],
      "priority": "low|medium|high",
      "actionItems": ["specific actions"]
    }
  ]
}`
      : `Generate medical insights from clinical summary to support clinical decision making.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate medical insights from this clinical summary:\n\nChief Complaint: ${clinicalSummary.chiefComplaint}\nHistory: ${clinicalSummary.historyOfPresentIllness}\nAssessment: ${clinicalSummary.assessment}\nPlan: ${clinicalSummary.plan}\nICD-10 Codes: ${clinicalSummary.icd10Codes.map(c => c.code).join(', ')}\nRisk Level: ${clinicalSummary.riskLevel}\n${patientId ? `Patient ID: ${patientId}` : ''}` }
      ],
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('No medical insights generated');
    }

    const result = JSON.parse(content);
    const medicalInsights = result.medicalInsights || [];

    res.json({
      success: true,
      data: {
        medicalInsights,
        totalInsights: medicalInsights.length,
        highPriorityInsights: medicalInsights.filter((insight: any) => 
          insight.priority === 'high'
        ).length
      }
    });

    log(`Medical insights generated for user ${userId}: ${medicalInsights.length} insights`);

  } catch (error) {
    logError('Medical insights generation error:', error);
    throw handleOpenAIError(error);
  }
}));

/**
 * Get clinical summary by ID
 * GET /api/clinical-summary/:summaryId
 */
clinicalSummaryRouter.get('/:summaryId', requireAuth, asyncHandler(async (req, res) => {
  const summaryId = parseInt(req.params.summaryId);
  const userId = (req.user as any).id;

  if (isNaN(summaryId)) {
    throw new AppError('Invalid summary ID', 400, 'INVALID_SUMMARY_ID');
  }

  try {
    const summary = await dbStorage.getClinicalSummary(summaryId, userId);

    if (!summary) {
      throw new AppError('Clinical summary not found', 404, 'SUMMARY_NOT_FOUND');
    }

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    logError('Clinical summary retrieval error:', error);
    if (error instanceof AppError) throw error;
    throw new AppError('Failed to retrieve clinical summary', 500, 'SUMMARY_RETRIEVAL_ERROR');
  }
}));

/**
 * Get clinical summaries for patient
 * GET /api/clinical-summary/patient/:patientId
 */
clinicalSummaryRouter.get('/patient/:patientId', requireAuth, asyncHandler(async (req, res) => {
  const patientId = parseInt(req.params.patientId);
  const userId = (req.user as any).id;
  const { limit = 10, offset = 0 } = req.query;

  if (isNaN(patientId)) {
    throw new AppError('Invalid patient ID', 400, 'INVALID_PATIENT_ID');
  }

  try {
    const summaries = await dbStorage.getClinicalSummariesByPatient(
      patientId, 
      userId, 
      parseInt(limit as string), 
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: summaries,
      total: summaries.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

  } catch (error) {
    logError('Clinical summaries retrieval error:', error);
    throw new AppError('Failed to retrieve clinical summaries', 500, 'SUMMARIES_RETRIEVAL_ERROR');
  }
}));

/**
 * Update clinical summary
 * PUT /api/clinical-summary/:summaryId
 */
clinicalSummaryRouter.put('/:summaryId', requireAuth, asyncHandler(async (req, res) => {
  const summaryId = parseInt(req.params.summaryId);
  const userId = (req.user as any).id;
  const updates = req.body;

  if (isNaN(summaryId)) {
    throw new AppError('Invalid summary ID', 400, 'INVALID_SUMMARY_ID');
  }

  try {
    const updatedSummary = await handleDatabaseOperation(
      () => dbStorage.updateClinicalSummary(summaryId, userId, updates),
      'Failed to update clinical summary'
    );

    res.json({
      success: true,
      data: updatedSummary
    });

    log(`Clinical summary updated for user ${userId}: ${summaryId}`);

  } catch (error) {
    logError('Clinical summary update error:', error);
    throw new AppError('Failed to update clinical summary', 500, 'SUMMARY_UPDATE_ERROR');
  }
}));

/**
 * Delete clinical summary
 * DELETE /api/clinical-summary/:summaryId
 */
clinicalSummaryRouter.delete('/:summaryId', requireAuth, asyncHandler(async (req, res) => {
  const summaryId = parseInt(req.params.summaryId);
  const userId = (req.user as any).id;

  if (isNaN(summaryId)) {
    throw new AppError('Invalid summary ID', 400, 'INVALID_SUMMARY_ID');
  }

  try {
    await handleDatabaseOperation(
      () => dbStorage.deleteClinicalSummary(summaryId, userId),
      'Failed to delete clinical summary'
    );

    res.json({
      success: true,
      message: 'Clinical summary deleted successfully'
    });

    log(`Clinical summary deleted for user ${userId}: ${summaryId}`);

  } catch (error) {
    logError('Clinical summary deletion error:', error);
    throw new AppError('Failed to delete clinical summary', 500, 'SUMMARY_DELETION_ERROR');
  }
}));

// Helper functions

async function prepareClinicalData(transcript?: string, extractedFields?: any, patientId?: number, encounterId?: number): Promise<any> {
  return {
    transcript,
    extractedFields,
    patientId,
    encounterId,
    timestamp: new Date().toISOString()
  };
}

async function generateSOAPNote(openai: OpenAI, inputData: any, specialty: string): Promise<any> {
  const systemPrompt = `You are an expert medical documentation AI. Generate a comprehensive SOAP note from patient data.

SOAP NOTE REQUIREMENTS:
- Subjective: Patient's chief complaint and history
- Objective: Physical findings and test results
- Assessment: Medical diagnosis and analysis
- Plan: Treatment plan and follow-up

Use proper medical terminology and clinical language. Be thorough but concise.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate SOAP note from this data:\n\n${JSON.stringify(inputData, null, 2)}\n\nSpecialty: ${specialty}` }
    ],
    temperature: 0.2,
    max_tokens: 2000,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('No SOAP note generated');
  }

  return JSON.parse(content);
}

async function generateProgressNote(openai: OpenAI, inputData: any, specialty: string): Promise<any> {
  const systemPrompt = `You are an expert medical documentation AI. Generate a comprehensive progress note.

PROGRESS NOTE REQUIREMENTS:
- Patient status update
- Response to treatment
- Changes in condition
- Plan modifications
- Follow-up needs

Use proper medical terminology and clinical language.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate progress note from this data:\n\n${JSON.stringify(inputData, null, 2)}\n\nSpecialty: ${specialty}` }
    ],
    temperature: 0.2,
    max_tokens: 1500,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('No progress note generated');
  }

  return JSON.parse(content);
}

async function generateConsultationNote(openai: OpenAI, inputData: any, specialty: string): Promise<any> {
  const systemPrompt = `You are an expert medical documentation AI. Generate a comprehensive consultation note.

CONSULTATION NOTE REQUIREMENTS:
- Reason for consultation
- Consultant findings
- Recommendations
- Coordination of care
- Follow-up plans

Use proper medical terminology and clinical language.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate consultation note from this data:\n\n${JSON.stringify(inputData, null, 2)}\n\nSpecialty: ${specialty}` }
    ],
    temperature: 0.2,
    max_tokens: 1800,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('No consultation note generated');
  }

  return JSON.parse(content);
}

async function generateDischargeSummary(openai: OpenAI, inputData: any, specialty: string): Promise<any> {
  const systemPrompt = `You are an expert medical documentation AI. Generate a comprehensive discharge summary.

DISCHARGE SUMMARY REQUIREMENTS:
- Hospital course summary
- Final diagnoses
- Discharge medications
- Follow-up instructions
- Patient education
- Return precautions

Use proper medical terminology and clinical language.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate discharge summary from this data:\n\n${JSON.stringify(inputData, null, 2)}\n\nSpecialty: ${specialty}` }
    ],
    temperature: 0.2,
    max_tokens: 2500,
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('No discharge summary generated');
  }

  return JSON.parse(content);
}

function calculateClinicalConfidence(clinicalSummary: any): number {
  // Calculate confidence based on various factors
  const factors = [
    clinicalSummary.icd10Codes?.length > 0 ? 0.9 : 0.7,
    clinicalSummary.drugInteractions?.length >= 0 ? 0.8 : 0.6,
    clinicalSummary.chiefComplaint ? 0.85 : 0.5,
    clinicalSummary.assessment ? 0.9 : 0.6,
    clinicalSummary.plan ? 0.85 : 0.5
  ];

  return Math.round(factors.reduce((sum, factor) => sum + factor, 0) / factors.length * 100);
}