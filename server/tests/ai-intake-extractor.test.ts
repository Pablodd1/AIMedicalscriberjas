import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIIntakeExtractor } from '../ai-intake-extractor';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    }))
  };
});

// Mock logger
vi.mock('../logger', () => ({
  log: vi.fn(),
  logError: vi.fn()
}));

describe('AIIntakeExtractor', () => {
  let extractor: AIIntakeExtractor;
  let mockOpenAI: any;

  beforeEach(() => {
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Create extractor with mock API key
    extractor = new AIIntakeExtractor('test-api-key');
    
    // Replace the internal OpenAI instance with our mock
    (extractor as any).openai = mockOpenAI;
  });

  describe('extractMedicalData', () => {
    it('should extract comprehensive medical data from transcript', async () => {
      const mockTranscript = "My name is John Smith, born June 15 1985. I have chest pain for 3 days, rated 7 out of 10. I take Lisinopril 10mg daily for blood pressure. I'm allergic to penicillin, it causes rash. No smoking, occasional alcohol.";
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              personalInfo: {
                fullName: "John Smith",
                dateOfBirth: "1985-06-15",
                age: 39,
                gender: "male"
              },
              currentSymptoms: {
                chiefComplaint: "Chest pain for 3 days",
                symptoms: [{
                  description: "Chest pain",
                  duration: "3 days",
                  severity: "severe",
                  intensity: 7
                }]
              },
              medicalHistory: {
                medications: [{
                  name: "Lisinopril",
                  dosage: "10mg daily",
                  purpose: "blood pressure"
                }],
                allergies: [{
                  allergen: "penicillin",
                  reaction: "rash",
                  severity: "moderate"
                }]
              },
              lifestyle: {
                smokingStatus: "never",
                alcoholUse: "occasional"
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.extractMedicalData(mockTranscript, 'en-US');

      expect(result.personalInfo.fullName).toBe("John Smith");
      expect(result.personalInfo.dateOfBirth).toBe("1985-06-15");
      expect(result.currentSymptoms.symptoms[0].intensity).toBe(7);
      expect(result.medicalHistory.medications[0].name).toBe("Lisinopril");
      expect(result.lifestyle.smokingStatus).toBe("never");
    });

    it('should handle missing or incomplete data gracefully', async () => {
      const mockTranscript = "My name is Jane. I don't remember when I was born.";
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              personalInfo: {
                fullName: "Jane",
                dateOfBirth: "",
                age: null
              },
              currentSymptoms: {
                chiefComplaint: "",
                symptoms: []
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.extractMedicalData(mockTranscript, 'en-US');

      expect(result.personalInfo.fullName).toBe("Jane");
      expect(result.personalInfo.dateOfBirth).toBe("");
      expect(result.personalInfo.age).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      const mockTranscript = "Test transcript";
      
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));

      await expect(extractor.extractMedicalData(mockTranscript, 'en-US'))
        .rejects.toThrow('Failed to extract medical data: API Error');
    });
  });

  describe('extractIntakeAnswers', () => {
    it('should extract standard intake form answers', async () => {
      const mockTranscript = "My name is John Smith, born June 15 1985. Phone is 555-123-4567, email john@email.com. Emergency contact is Jane Smith, my wife. Reason for visit is annual checkup. I take Lisinopril 10mg daily. Allergic to penicillin, causes rash. Insurance is Blue Cross Blue Shield.";
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              full_name: "John Smith",
              date_of_birth: "1985-06-15",
              phone: "555-123-4567",
              email: "john@email.com",
              emergency_contact: "Jane Smith (wife)",
              reason_for_visit: "annual checkup",
              current_medications: "Lisinopril 10mg daily",
              allergies: "penicillin - causes rash",
              insurance_provider: "Blue Cross Blue Shield"
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.extractIntakeAnswers(mockTranscript, 'en-US');

      expect(result.full_name).toBe("John Smith");
      expect(result.date_of_birth).toBe("1985-06-15");
      expect(result.phone).toBe("555-123-4567");
      expect(result.emergency_contact).toBe("Jane Smith (wife)");
      expect(result.insurance_provider).toBe("Blue Cross Blue Shield");
    });

    it('should handle Spanish language extraction', async () => {
      const mockTranscript = "Me llamo María García, nacida el 15 de junio de 1985. Teléfono 555-123-4567.";
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              full_name: "María García",
              date_of_birth: "1985-06-15",
              phone: "555-123-4567"
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.extractIntakeAnswers(mockTranscript, 'es-ES');

      expect(result.full_name).toBe("María García");
      expect(result.date_of_birth).toBe("1985-06-15");
    });
  });

  describe('generateClinicalSummary', () => {
    it('should generate comprehensive clinical summary', async () => {
      const mockExtractedData = {
        personalInfo: {
          fullName: "John Smith",
          dateOfBirth: "1985-06-15",
          age: 39
        },
        currentSymptoms: {
          chiefComplaint: "Chest pain for 3 days",
          symptoms: [{
            description: "Chest pain",
            duration: "3 days",
            severity: "severe",
            intensity: 7
          }]
        },
        medicalHistory: {
          medications: [{
            name: "Lisinopril",
            dosage: "10mg daily"
          }]
        }
      };

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: "John Smith, 39-year-old male, presents with chest pain for 3 days, rated 7/10 in intensity. Currently taking Lisinopril for blood pressure management. Recommend cardiac evaluation including ECG and troponin levels.",
              keyFindings: [
                "39-year-old male with chest pain",
                "Symptom duration: 3 days",
                "Pain intensity: 7/10",
                "On Lisinopril for hypertension"
              ],
              recommendations: [
                "Obtain 12-lead ECG",
                "Check cardiac enzymes (troponin)",
                "Consider chest X-ray",
                "Monitor vital signs"
              ],
              riskFactors: [
                "Hypertension (on Lisinopril)",
                "Male gender",
                "Age 39"
              ],
              confidence: 0.92
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.generateClinicalSummary(mockExtractedData, 123);

      expect(result.summary).toContain("John Smith");
      expect(result.summary).toContain("39-year-old");
      expect(result.keyFindings).toHaveLength(4);
      expect(result.recommendations).toContain("Obtain 12-lead ECG");
      expect(result.confidence).toBe(0.92);
    });

    it('should handle complex medical cases', async () => {
      const complexData = {
        personalInfo: {
          fullName: "Sarah Johnson",
          dateOfBirth: "1975-03-20",
          age: 48
        },
        currentSymptoms: {
          chiefComplaint: "Severe abdominal pain and nausea",
          symptoms: [
            {
              description: "Abdominal pain",
              duration: "2 days",
              severity: "severe",
              location: "right lower quadrant",
              intensity: 8
            },
            {
              description: "Nausea and vomiting",
              duration: "1 day",
              severity: "moderate"
            }
          ],
          painAssessment: {
            location: "right lower quadrant",
            intensity: 8,
            character: "sharp, stabbing"
          }
        },
        medicalHistory: {
          pastSurgeries: [{
            procedure: "Appendectomy",
            date: "2015"
          }]
        }
      };

      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              summary: "Sarah Johnson, 48-year-old female, presents with severe right lower quadrant abdominal pain (8/10) and nausea. Pain is sharp and stabbing, duration 2 days. Previous appendectomy in 2015. Differential diagnosis includes diverticulitis, ovarian pathology, or adhesions from prior surgery.",
              keyFindings: [
                "48-year-old female with RLQ pain",
                "Pain intensity 8/10, sharp character",
                "Associated nausea and vomiting",
                "Previous appendectomy (2015)"
              ],
              recommendations: [
                "Obtain CT abdomen/pelvis",
                "Check CBC and CMP",
                "Consider pelvic ultrasound",
                "Surgical consultation if acute abdomen"
              ],
              riskFactors: [
                "Age 48, female",
                "Previous abdominal surgery",
                "Severe pain (8/10)"
              ],
              confidence: 0.88
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.generateClinicalSummary(complexData);

      expect(result.summary).toContain("Sarah Johnson");
      expect(result.summary).toContain("right lower quadrant");
      expect(result.keyFindings).toContain("48-year-old female with RLQ pain");
      expect(result.recommendations).toContain("Obtain CT abdomen/pelvis");
    });
  });

  describe('data validation', () => {
    it('should validate and clean extracted data', async () => {
      const mockTranscript = "Test transcript for validation";
      
      const mockResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              personalInfo: {
                fullName: "  John Doe  ",
                dateOfBirth: "1985-06-15",
                age: "thirty-five", // Invalid age
                gender: "invalid",
                phone: "555-1234", // Too short
                email: "not-an-email"
              }
            })
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      const result = await extractor.extractMedicalData(mockTranscript);

      // Should clean whitespace
      expect(result.personalInfo.fullName).toBe("John Doe");
      
      // Should validate date format
      expect(result.personalInfo.dateOfBirth).toBe("1985-06-15");
      
      // Should handle invalid age
      expect(result.personalInfo.age).toBeUndefined();
      
      // Should validate gender
      expect(result.personalInfo.gender).toBe("");
      
      // Should validate phone
      expect(result.personalInfo.phone).toBe("");
      
      // Should validate email
      expect(result.personalInfo.email).toBe("");
    });
  });

  describe('error handling', () => {
    it('should handle invalid JSON response', async () => {
      const mockTranscript = "Test transcript";
      
      const mockResponse = {
        choices: [{
          message: {
            content: "invalid json {"
          }
        }]
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockResponse);

      await expect(extractor.extractMedicalData(mockTranscript, 'en-US'))
        .rejects.toThrow('Failed to extract medical data');
    });

    it('should handle empty transcript', async () => {
      await expect(extractor.extractMedicalData('', 'en-US'))
        .rejects.toThrow('Transcript too short for meaningful extraction');
    });

    it('should handle very short transcript', async () => {
      await expect(extractor.extractMedicalData('Hi', 'en-US'))
        .rejects.toThrow('Transcript too short for meaningful extraction');
    });
  });
});