import OpenAI from 'openai';
import { log, logError } from './logger';

export interface MedicalDataExtraction {
  personalInfo: {
    fullName?: string;
    dateOfBirth?: string;
    age?: number;
    gender?: string;
    phone?: string;
    email?: string;
    address?: string;
    emergencyContact?: string;
  };
  
  medicalHistory: {
    allergies: Array<{
      allergen: string;
      reaction: string;
      severity: 'mild' | 'moderate' | 'severe';
    }>;
    medications: Array<{
      name: string;
      dosage?: string;
      frequency?: string;
      purpose?: string;
    }>;
    chronicConditions: string[];
    pastSurgeries: Array<{
      procedure: string;
      date?: string;
      complications?: string;
    }>;
    familyHistory: string[];
  };
  
  currentSymptoms: {
    chiefComplaint: string;
    symptoms: Array<{
      description: string;
      duration: string;
      severity: 'mild' | 'moderate' | 'severe';
      onset: 'sudden' | 'gradual';
      location?: string;
      quality?: string;
      modifyingFactors?: string[];
      associatedSymptoms?: string[];
    }>;
    painAssessment?: {
      location: string;
      intensity: number; // 0-10
      character: string;
      radiation?: string;
      aggravatingFactors?: string[];
      relievingFactors?: string[];
    };
  };
  
  lifestyle: {
    smokingStatus: 'never' | 'former' | 'current';
    alcoholUse: 'never' | 'occasional' | 'weekly' | 'daily';
    exercise: 'sedentary' | 'light' | 'moderate' | 'vigorous';
    diet: string;
    sleep: string;
    stress: string;
  };
  
  insurance: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    subscriberId?: string;
  };
  
  visitDetails: {
    reasonForVisit: string;
    expectations: string;
    previousTreatments: string[];
    currentProviders: string[];
  };
}

export class AIIntakeExtractor {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Extract comprehensive medical data from voice transcript
   */
  async extractMedicalData(transcript: string, language: string = 'en-US'): Promise<MedicalDataExtraction> {
    try {
      log('Starting medical data extraction from transcript');
      
      const systemPrompt = `You are an expert medical data extraction AI. Your task is to analyze patient voice transcripts and extract structured medical information with high accuracy.

EXTRACTION RULES:
1. Be extremely thorough - capture ALL medical information mentioned
2. Use medical terminology and standard clinical formats
3. Flag any unclear or ambiguous information
4. Include confidence levels for each extraction
5. Follow HIPAA compliance standards
6. Use SNOMED CT terminology where applicable

REQUIRED EXTRACTIONS:
- Personal demographics (name, DOB, contact info)
- Complete medical history (allergies, medications, conditions, surgeries)
- Detailed symptom analysis with clinical descriptors
- Pain assessment using standard scales
- Lifestyle factors affecting health
- Insurance information
- Visit-specific details

OUTPUT FORMAT: Return a structured JSON object with all medical data extracted from the transcript.`;

      const extractionPrompt = `Extract comprehensive medical data from this patient voice transcript:

TRANSCRIPT:
"${transcript}"

LANGUAGE: ${language}

Please provide a complete medical data extraction including:
1. Personal information (name, date of birth, contact details)
2. Medical history (allergies, current medications, chronic conditions, past surgeries, family history)
3. Current symptoms and chief complaint with detailed clinical description
4. Pain assessment if mentioned (location, intensity 0-10, character, radiation)
5. Lifestyle factors (smoking, alcohol, exercise, diet, sleep, stress)
6. Insurance information
7. Visit details (reason for visit, expectations, previous treatments)

Be thorough and capture ALL medical information mentioned, even if incomplete. Flag uncertain information appropriately.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extractionPrompt }
        ],
        temperature: 0.1, // Low temperature for accuracy
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const extractedData = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      log(`Successfully extracted medical data: ${Object.keys(extractedData).length} categories`);
      
      return this.validateAndCleanExtraction(extractedData);
    } catch (error) {
      logError('Error extracting medical data:', error);
      throw new Error(`Failed to extract medical data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract intake form answers from transcript
   */
  async extractIntakeAnswers(transcript: string, language: string = 'en-US'): Promise<Record<string, string>> {
    try {
      log('Extracting intake form answers from transcript');
      
      const systemPrompt = `You are a medical intake form processor. Extract answers to standard medical intake questions from patient voice transcripts.

EXTRACTION GUIDELINES:
1. Map responses to standard intake form fields
2. Use clinical terminology and standard formats
3. Include all relevant details mentioned
4. Flag missing required information
5. Use appropriate medical abbreviations and codes
6. Maintain patient privacy and HIPAA compliance

STANDARD INTAKE FIELDS:
- full_name: Patient's complete legal name
- date_of_birth: Date of birth (MM/DD/YYYY format)
- gender: Male/Female/Other
- phone: Contact phone number
- email: Email address
- emergency_contact: Name and relationship
- reason_for_visit: Chief complaint
- current_medications: All current medications with dosages
- allergies: Allergies to medications, foods, environmental factors
- chronic_conditions: Ongoing medical conditions
- past_surgeries: Previous surgical procedures with dates
- family_history: Relevant family medical history
- symptoms: Current symptoms and their duration
- symptom_duration: How long symptoms have been present
- insurance_provider: Insurance company name
- insurance_policy: Policy or member number

OUTPUT: Return a JSON object with field names as keys and extracted answers as values.`;

      const extractionPrompt = `Extract intake form answers from this patient voice transcript:

TRANSCRIPT:
"${transcript}"

LANGUAGE: ${language}

Extract answers for all standard intake form fields. If information is not mentioned, indicate as "Not provided". Be thorough and capture all details mentioned by the patient.`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: extractionPrompt }
        ],
        temperature: 0.2,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const answers = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      log(`Successfully extracted ${Object.keys(answers).length} intake form answers`);
      
      return answers;
    } catch (error) {
      logError('Error extracting intake answers:', error);
      throw new Error(`Failed to extract intake answers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate clinical summary for doctor
   */
  async generateClinicalSummary(extractedData: MedicalDataExtraction, patientId?: number): Promise<{
    summary: string;
    keyFindings: string[];
    recommendations: string[];
    riskFactors: string[];
    confidence: number;
  }> {
    try {
      log('Generating clinical summary for doctor review');
      
      const systemPrompt = `You are an experienced medical practitioner creating clinical summaries. Generate concise, actionable summaries for healthcare providers.

SUMMARY GUIDELINES:
1. Focus on clinically relevant information
2. Highlight urgent or concerning findings
3. Use standard medical terminology
4. Include differential diagnosis considerations
5. Recommend appropriate next steps
6. Flag any red flags or safety concerns
7. Use evidence-based medicine principles
8. Maintain HIPAA compliance

OUTPUT FORMAT:
- Summary: Brief overview (2-3 paragraphs)
- Key Findings: Bullet points of important clinical data
- Recommendations: Actionable next steps
- Risk Factors: Patient-specific risk considerations
- Confidence: Assessment reliability (0-1 scale)`;

      const summaryPrompt = `Create a clinical summary for this patient intake data:

${JSON.stringify(extractedData, null, 2)}

Patient ID: ${patientId || 'New Patient'}

Provide a comprehensive clinical summary including:
1. Patient overview and presenting concerns
2. Relevant medical history and risk factors
3. Current symptoms and their clinical significance
4. Recommended diagnostic workup or treatment plan
5. Any urgent concerns requiring immediate attention`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: summaryPrompt }
        ],
        temperature: 0.3,
        max_tokens: 1500,
        response_format: { type: "json_object" }
      });

      const summaryData = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      log('Successfully generated clinical summary');
      
      return summaryData;
    } catch (error) {
      logError('Error generating clinical summary:', error);
      throw new Error(`Failed to generate clinical summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate and clean extracted medical data
   */
  private validateAndCleanExtraction(data: any): MedicalDataExtraction {
    const cleaned: MedicalDataExtraction = {
      personalInfo: {
        fullName: this.cleanString(data.personalInfo?.fullName),
        dateOfBirth: this.validateDate(data.personalInfo?.dateOfBirth),
        age: this.validateNumber(data.personalInfo?.age),
        gender: this.validateGender(data.personalInfo?.gender),
        phone: this.cleanPhone(data.personalInfo?.phone),
        email: this.cleanEmail(data.personalInfo?.email),
        address: this.cleanString(data.personalInfo?.address),
        emergencyContact: this.cleanString(data.personalInfo?.emergencyContact)
      },
      medicalHistory: {
        allergies: this.validateAllergies(data.medicalHistory?.allergies),
        medications: this.validateMedications(data.medicalHistory?.medications),
        chronicConditions: this.validateStringArray(data.medicalHistory?.chronicConditions),
        pastSurgeries: this.validateSurgeries(data.medicalHistory?.pastSurgeries),
        familyHistory: this.validateStringArray(data.medicalHistory?.familyHistory)
      },
      currentSymptoms: {
        chiefComplaint: this.cleanString(data.currentSymptoms?.chiefComplaint),
        symptoms: this.validateSymptoms(data.currentSymptoms?.symptoms),
        painAssessment: this.validatePainAssessment(data.currentSymptoms?.painAssessment)
      },
      lifestyle: {
        smokingStatus: this.validateSmokingStatus(data.lifestyle?.smokingStatus),
        alcoholUse: this.validateAlcoholUse(data.lifestyle?.alcoholUse),
        exercise: this.validateExercise(data.lifestyle?.exercise),
        diet: this.cleanString(data.lifestyle?.diet),
        sleep: this.cleanString(data.lifestyle?.sleep),
        stress: this.cleanString(data.lifestyle?.stress)
      },
      insurance: {
        provider: this.cleanString(data.insurance?.provider),
        policyNumber: this.cleanString(data.insurance?.policyNumber),
        groupNumber: this.cleanString(data.insurance?.groupNumber),
        subscriberId: this.cleanString(data.insurance?.subscriberId)
      },
      visitDetails: {
        reasonForVisit: this.cleanString(data.visitDetails?.reasonForVisit),
        expectations: this.cleanString(data.visitDetails?.expectations),
        previousTreatments: this.validateStringArray(data.visitDetails?.previousTreatments),
        currentProviders: this.validateStringArray(data.visitDetails?.currentProviders)
      }
    };

    return cleaned;
  }

  // Validation helper methods
  private cleanString(str: any): string {
    return typeof str === 'string' ? str.trim() : '';
  }

  private validateDate(date: any): string {
    if (typeof date !== 'string') return '';
    // Basic date validation - could be enhanced with regex
    return date.trim();
  }

  private validateNumber(num: any): number | undefined {
    const parsed = parseInt(num);
    return isNaN(parsed) ? undefined : parsed;
  }

  private validateGender(gender: any): string {
    const validGenders = ['male', 'female', 'other', 'prefer not to say'];
    const cleanGender = this.cleanString(gender).toLowerCase();
    return validGenders.includes(cleanGender) ? cleanGender : '';
  }

  private cleanPhone(phone: any): string {
    const cleanPhone = this.cleanString(phone).replace(/[^\d+\-\s()]/g, '');
    return cleanPhone.length >= 10 ? cleanPhone : '';
  }

  private cleanEmail(email: any): string {
    const cleanEmail = this.cleanString(email).toLowerCase();
    return cleanEmail.includes('@') && cleanEmail.includes('.') ? cleanEmail : '';
  }

  private validateAllergies(allergies: any): any[] {
    if (!Array.isArray(allergies)) return [];
    return allergies.filter(allergy => 
      allergy.allergen && typeof allergy.allergen === 'string'
    ).slice(0, 20); // Limit to 20 allergies
  }

  private validateMedications(medications: any): any[] {
    if (!Array.isArray(medications)) return [];
    return medications.filter(med => 
      med.name && typeof med.name === 'string'
    ).slice(0, 30); // Limit to 30 medications
  }

  private validateStringArray(arr: any): string[] {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => typeof item === 'string').map(item => this.cleanString(item)).slice(0, 50);
  }

  private validateSurgeries(surgeries: any): any[] {
    if (!Array.isArray(surgeries)) return [];
    return surgeries.filter(surgery => 
      surgery.procedure && typeof surgery.procedure === 'string'
    ).slice(0, 20);
  }

  private validateSymptoms(symptoms: any): any[] {
    if (!Array.isArray(symptoms)) return [];
    return symptoms.filter(symptom => 
      symptom.description && typeof symptom.description === 'string'
    ).slice(0, 25);
  }

  private validatePainAssessment(pain: any): any {
    if (!pain || typeof pain !== 'object') return undefined;
    return {
      location: this.cleanString(pain.location),
      intensity: this.validateNumber(pain.intensity),
      character: this.cleanString(pain.character),
      radiation: this.cleanString(pain.radiation),
      aggravatingFactors: this.validateStringArray(pain.aggravatingFactors),
      relievingFactors: this.validateStringArray(pain.relievingFactors)
    };
  }

  private validateSmokingStatus(status: any): string {
    const validStatuses = ['never', 'former', 'current'];
    const cleanStatus = this.cleanString(status).toLowerCase();
    return validStatuses.includes(cleanStatus) ? cleanStatus : 'never';
  }

  private validateAlcoholUse(use: any): string {
    const validUses = ['never', 'occasional', 'weekly', 'daily'];
    const cleanUse = this.cleanString(use).toLowerCase();
    return validUses.includes(cleanUse) ? cleanUse : 'never';
  }

  private validateExercise(exercise: any): string {
    const validLevels = ['sedentary', 'light', 'moderate', 'vigorous'];
    const cleanExercise = this.cleanString(exercise).toLowerCase();
    return validLevels.includes(cleanExercise) ? cleanExercise : 'sedentary';
  }
}