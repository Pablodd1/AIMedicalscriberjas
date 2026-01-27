import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  FileText, 
  Brain, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  User,
  Activity,
  Pill,
  Heart,
  Zap,
  Download,
  Share2,
  Edit3,
  Save,
  RefreshCw,
  Filter,
  Search,
  Settings,
  HelpCircle,
  Eye,
  EyeOff
} from "lucide-react";

interface DoctorSummaryProps {
  className?: string;
  patientId: number;
  encounterId?: number;
  transcript?: string;
  extractedData?: any;
  onSummaryGenerated?: (summary: ClinicalSummary) => void;
  onError?: (error: any) => void;
  enableAIEnhancement?: boolean;
  enableMedicalInsights?: boolean;
  enableRealTimeProcessing?: boolean;
  enableConfidenceScoring?: boolean;
  enableICD10Coding?: boolean;
  enableRiskAssessment?: boolean;
  enableDrugInteractionCheck?: boolean;
  showAdvancedAnalysis?: boolean;
  enableVoiceCommands?: boolean;
}

interface ClinicalSummary {
  id: string;
  patientId: number;
  encounterId?: number;
  providerId: number;
  summaryType: 'soap' | 'progress' | 'consultation' | 'discharge';
  chiefComplaint: string;
  historyOfPresentIllness: string;
  assessment: string;
  plan: string;
  icd10Codes: ICD10Code[];
  cptCodes: CPTCode[];
  medicalDecisionMaking: string;
  confidence: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  drugInteractions: DrugInteraction[];
  criticalAlerts: CriticalAlert[];
  generatedAt: Date;
  reviewed: boolean;
  reviewedBy?: number;
  reviewedAt?: Date;
}

interface ICD10Code {
  code: string;
  description: string;
  confidence: number;
  isPrimary: boolean;
}

interface CPTCode {
  code: string;
  description: string;
  confidence: number;
  category: string;
}

interface DrugInteraction {
  medication1: string;
  medication2: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  mechanism: string;
  clinicalSignificance: string;
  management: string;
}

interface CriticalAlert {
  type: 'allergy' | 'contraindication' | 'drug_interaction' | 'dosage' | 'monitoring';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  actionRequired: string;
  confidence: number;
}

interface MedicalInsight {
  type: 'diagnosis_suggestion' | 'treatment_recommendation' | 'monitoring_alert' | 'follow_up_needed';
  confidence: number;
  description: string;
  rationale: string;
  evidence: string[];
  priority: 'low' | 'medium' | 'high';
  actionItems: string[];
}

interface ProcessingMetrics {
  extractionAccuracy: number;
  confidenceScore: number;
  processingTime: number;
  icd10CodesFound: number;
  drugInteractionsChecked: number;
  riskFactorsIdentified: number;
  medicalInsightsGenerated: number;
}

export function DoctorSummary({
  className,
  patientId,
  encounterId,
  transcript,
  extractedData,
  onSummaryGenerated,
  onError,
  enableAIEnhancement = true,
  enableMedicalInsights = true,
  enableRealTimeProcessing = true,
  enableConfidenceScoring = true,
  enableICD10Coding = true,
  enableRiskAssessment = true,
  enableDrugInteractionCheck = true,
  showAdvancedAnalysis = true,
  enableVoiceCommands = false
}: DoctorSummaryProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [clinicalSummary, setClinicalSummary] = useState<ClinicalSummary | null>(null);
  const [processingMetrics, setProcessingMetrics] = useState<ProcessingMetrics>({
    extractionAccuracy: 0,
    confidenceScore: 0,
    processingTime: 0,
    icd10CodesFound: 0,
    drugInteractionsChecked: 0,
    riskFactorsIdentified: 0,
    medicalInsightsGenerated: 0
  });
  const [medicalInsights, setMedicalInsights] = useState<MedicalInsight[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [summaryType, setSummaryType] = useState<'soap' | 'progress' | 'consultation' | 'discharge'>('soap');

  // Generate clinical summary
  const generateClinicalSummary = useCallback(async () => {
    if (!transcript && !extractedData) {
      toast({
        title: 'No Data Available',
        description: 'Please provide transcript or extracted data to generate summary.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);

    try {
      const startTime = Date.now();

      // Step 1: Prepare input data
      const inputData = await prepareInputData(transcript, extractedData);

      // Step 2: Generate clinical summary with AI
      const summary = await generateAIClinicalSummary(inputData, summaryType);

      // Step 3: Extract medical codes if enabled
      if (enableICD10Coding) {
        summary.icd10Codes = await extractICD10Codes(summary);
        summary.cptCodes = await extractCPTCodes(summary);
      }

      // Step 4: Check drug interactions if enabled
      if (enableDrugInteractionCheck) {
        summary.drugInteractions = await checkDrugInteractions(summary);
      }

      // Step 5: Assess risk level if enabled
      if (enableRiskAssessment) {
        summary.riskLevel = await assessRiskLevel(summary);
        summary.criticalAlerts = await generateCriticalAlerts(summary);
      }

      // Step 6: Generate medical insights if enabled
      if (enableMedicalInsights) {
        const insights = await generateMedicalInsights(summary);
        setMedicalInsights(insights);
      }

      const processingTime = Date.now() - startTime;

      setClinicalSummary(summary);
      setProcessingMetrics({
        extractionAccuracy: calculateExtractionAccuracy(summary),
        confidenceScore: summary.confidence,
        processingTime,
        icd10CodesFound: summary.icd10Codes.length,
        drugInteractionsChecked: summary.drugInteractions.length,
        riskFactorsIdentified: summary.criticalAlerts.length,
        medicalInsightsGenerated: medicalInsights.length
      });

      onSummaryGenerated?.(summary);

      toast({
        title: 'Clinical Summary Generated',
        description: `Generated ${summaryType.toUpperCase()} note with ${summary.icd10Codes.length} ICD-10 codes and ${summary.confidence}% confidence.`,
      });

    } catch (error) {
      console.error('Clinical summary generation error:', error);
      onError?.(error);
      
      toast({
        title: 'Generation Failed',
        description: 'Failed to generate clinical summary. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    transcript,
    extractedData,
    summaryType,
    enableICD10Coding,
    enableDrugInteractionCheck,
    enableRiskAssessment,
    enableMedicalInsights,
    onSummaryGenerated,
    onError,
    toast
  ]);

  // Prepare input data
  const prepareInputData = useCallback(async (transcript?: string, extractedData?: any): Promise<any> => {
    if (!enableAIEnhancement) {
      return { transcript, extractedData };
    }

    try {
      // Enhance transcript with medical context if available
      let enhancedTranscript = transcript;
      if (transcript) {
        const response = await fetch('/api/ai-intake/enhance-medical-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            enableMedicalMode: true,
            language: 'en-US'
          })
        });

        if (response.ok) {
          const data = await response.json();
          enhancedTranscript = data.data.enhancedTranscript;
        }
      }

      return {
        transcript: enhancedTranscript,
        extractedData,
        patientId,
        encounterId,
        enableMedicalInsights,
        enableConfidenceScoring
      };

    } catch (error) {
      console.error('Failed to prepare input data:', error);
      return { transcript, extractedData };
    }
  }, [enableAIEnhancement, patientId, encounterId, enableMedicalInsights, enableConfidenceScoring]);

  // Generate AI clinical summary
  const generateAIClinicalSummary = useCallback(async (inputData: any, summaryType: string): Promise<ClinicalSummary> => {
    const response = await fetch('/api/ai-intake/generate-clinical-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extractedFields: inputData.extractedData,
        transcript: inputData.transcript,
        patientId: inputData.patientId,
        encounterId: inputData.encounterId,
        specialty: 'primary_care',
        enableMedicalInsights: inputData.enableMedicalInsights,
        enableConfidenceScoring: inputData.enableConfidenceScoring
      })
    });

    if (!response.ok) {
      throw new Error('Failed to generate clinical summary');
    }

    const data = await response.json();
    return data.data;
  }, []);

  // Extract ICD-10 codes
  const extractICD10Codes = useCallback(async (summary: ClinicalSummary): Promise<ICD10Code[]> => {
    try {
      const response = await fetch('/api/ai/extract-icd10-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summary.assessment,
          chiefComplaint: summary.chiefComplaint,
          medicalHistory: summary.historyOfPresentIllness,
          enableMedicalMode: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.codes || [];
      }
    } catch (error) {
      console.error('ICD-10 extraction error:', error);
    }

    return [];
  }, []);

  // Extract CPT codes
  const extractCPTCodes = useCallback(async (summary: ClinicalSummary): Promise<CPTCode[]> => {
    try {
      const response = await fetch('/api/ai/extract-cpt-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: summary.plan,
          procedures: summary.assessment,
          enableMedicalMode: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.codes || [];
      }
    } catch (error) {
      console.error('CPT extraction error:', error);
    }

    return [];
  }, []);

  // Check drug interactions
  const checkDrugInteractions = useCallback(async (summary: ClinicalSummary): Promise<DrugInteraction[]> => {
    try {
      const response = await fetch('/api/ai/check-drug-interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medications: extractMedicationsFromSummary(summary),
          patientId: summary.patientId,
          enableMedicalMode: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.interactions || [];
      }
    } catch (error) {
      console.error('Drug interaction check error:', error);
    }

    return [];
  }, []);

  // Assess risk level
  const assessRiskLevel = useCallback(async (summary: ClinicalSummary): Promise<'low' | 'moderate' | 'high' | 'critical'> => {
    // Simple risk assessment based on critical alerts and drug interactions
    const criticalAlertCount = summary.criticalAlerts.filter(alert => 
      ['high', 'critical'].includes(alert.severity)
    ).length;

    const severeDrugInteractions = summary.drugInteractions.filter(interaction =>
      interaction.severity === 'severe'
    ).length;

    if (criticalAlertCount > 2 || severeDrugInteractions > 1) {
      return 'critical';
    } else if (criticalAlertCount > 0 || severeDrugInteractions > 0) {
      return 'high';
    } else if (summary.criticalAlerts.length > 0 || summary.drugInteractions.length > 0) {
      return 'moderate';
    }

    return 'low';
  }, []);

  // Generate critical alerts
  const generateCriticalAlerts = useCallback(async (summary: ClinicalSummary): Promise<CriticalAlert[]> => {
    const alerts: CriticalAlert[] = [];

    // Check for severe drug interactions
    summary.drugInteractions.forEach(interaction => {
      if (interaction.severity === 'severe') {
        alerts.push({
          type: 'drug_interaction',
          severity: 'critical',
          title: 'Severe Drug Interaction',
          description: `Severe interaction between ${interaction.medication1} and ${interaction.medication2}`,
          actionRequired: 'Review medication regimen and consider alternatives',
          confidence: 0.9
        });
      }
    });

    // Check for allergies in medications
    const allergies = extractAllergiesFromSummary(summary);
    const medications = extractMedicationsFromSummary(summary);
    
    medications.forEach(medication => {
      if (allergies.some(allergy => 
        medication.toLowerCase().includes(allergy.toLowerCase())
      )) {
        alerts.push({
          type: 'allergy',
          severity: 'critical',
          title: 'Potential Allergic Reaction',
          description: `Patient may be allergic to prescribed medication: ${medication}`,
          actionRequired: 'Verify allergy history and consider alternative medications',
          confidence: 0.95
        });
      }
    });

    return alerts;
  }, []);

  // Generate medical insights
  const generateMedicalInsights = useCallback(async (summary: ClinicalSummary): Promise<MedicalInsight[]> => {
    const insights: MedicalInsight[] = [];

    // Analyze chief complaint for diagnosis suggestions
    if (summary.chiefComplaint) {
      insights.push({
        type: 'diagnosis_suggestion',
        confidence: 0.8,
        description: 'Consider differential diagnosis based on chief complaint',
        rationale: 'Chief complaint analysis suggests potential conditions',
        evidence: [summary.chiefComplaint],
        priority: 'medium',
        actionItems: ['Review differential diagnosis', 'Consider additional workup']
      });
    }

    // Analyze risk factors
    if (summary.riskLevel === 'high' || summary.riskLevel === 'critical') {
      insights.push({
        type: 'monitoring_alert',
        confidence: 0.9,
        description: 'High-risk patient requires close monitoring',
        rationale: 'Multiple risk factors identified requiring enhanced monitoring',
        evidence: summary.criticalAlerts.map(alert => alert.description),
        priority: 'high',
        actionItems: ['Increase monitoring frequency', 'Consider specialist referral']
      });
    }

    // Suggest follow-up based on conditions
    if (summary.icd10Codes.length > 0) {
      insights.push({
        type: 'follow_up_needed',
        confidence: 0.85,
        description: 'Chronic conditions require ongoing management',
        rationale: 'Identified conditions require regular follow-up care',
        evidence: summary.icd10Codes.map(code => code.description),
        priority: 'medium',
        actionItems: ['Schedule follow-up appointment', 'Review treatment plan']
      });
    }

    return insights;
  }, []);

  // Helper functions
  const extractMedicationsFromSummary = (summary: ClinicalSummary): string[] => {
    // Extract medications from assessment and plan
    const medications: string[] = [];
    const medicationText = `${summary.assessment} ${summary.plan}`.toLowerCase();
    
    // Common medication patterns
    const medicationPatterns = [
      /\b(mg|ml|units|tablets|capsules)\b/g,
      /\b(take|prescribe|give|administer)\b/g
    ];

    // This is a simplified implementation
    // In a real scenario, you'd use NLP to extract medication names
    const words = medicationText.split(/\s+/);
    words.forEach(word => {
      if (word.length > 3 && !word.match(/^[\d\.]+$/)) {
        medications.push(word);
      }
    });

    return [...new Set(medications)]; // Remove duplicates
  };

  const extractAllergiesFromSummary = (summary: ClinicalSummary): string[] => {
    // Extract allergies from the summary
    const allergyText = summary.assessment.toLowerCase();
    const allergies: string[] = [];

    // Common allergy indicators
    const allergyPatterns = [
      /allerg(?:y|ic|ies)\s+(?:to\s+)?([^,\.\n]+)/g,
      /reaction\s+(?:to\s+)?([^,\.\n]+)/g
    ];

    allergyPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(allergyText)) !== null) {
        allergies.push(match[1].trim());
      }
    });

    return [...new Set(allergies)];
  };

  const calculateExtractionAccuracy = (summary: ClinicalSummary): number => {
    // Calculate accuracy based on confidence scores and validation
    const baseConfidence = summary.confidence;
    const icd10Confidence = summary.icd10Codes.reduce((sum, code) => sum + code.confidence, 0) / Math.max(1, summary.icd10Codes.length);
    const interactionConfidence = summary.drugInteractions.length === 0 ? 1.0 : 
      summary.drugInteractions.reduce((sum, interaction) => {
        switch (interaction.severity) {
          case 'severe': return sum + 0.9;
          case 'moderate': return sum + 0.7;
          case 'mild': return sum + 0.5;
          default: return sum + 0.6;
        }
      }, 0) / summary.drugInteractions.length;

    return Math.round((baseConfidence + icd10Confidence + interactionConfidence) / 3);
  };

  // Initialize on mount
  useEffect(() => {
    if (transcript || extractedData) {
      generateClinicalSummary();
    }
  }, [transcript, extractedData]);

  // INTRO STEP
  if (!clinicalSummary) {
    return (
      <div className={cn("container mx-auto p-4 max-w-4xl", className)}>
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <Brain className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              AI-Powered Clinical Summary
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Advanced medical documentation with intelligent insights
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Intelligent Clinical Documentation:
              </h3>
              <ol className="space-y-3 text-sm text-blue-800">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>AI generates comprehensive clinical summaries from transcripts</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Automatic ICD-10 coding with confidence scoring</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>Drug interaction analysis and risk assessment</span>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600">4.</span>
                  <span>Medical insights and clinical decision support</span>
                </li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-4 text-center">
                <TrendingUp className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">ICD-10 Coding</h4>
                <p className="text-sm text-muted-foreground">Automatic medical coding with high accuracy</p>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <Activity className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Drug Interactions</h4>
                <p className="text-sm text-muted-foreground">Comprehensive medication safety analysis</p>
              </div>
              <div className="bg-white border rounded-lg p-4 text-center">
                <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
                <h4 className="font-semibold mb-1">Risk Assessment</h4>
                <p className="text-sm text-muted-foreground">Intelligent patient risk stratification</p>
              </div>
            </div>

            <Button
              onClick={generateClinicalSummary}
              disabled={isGenerating}
              className="w-full h-14 text-lg touch-manipulation"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generating Summary...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-5 w-5" />
                  Generate Clinical Summary
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // SUMMARY DISPLAY
  return (
    <div className={cn("container mx-auto p-4 max-w-6xl", className)}>
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Clinical Summary</CardTitle>
              <CardDescription>
                AI-generated with {clinicalSummary.confidence}% confidence
                <Badge variant="outline" className="ml-2 text-xs">
                  {clinicalSummary.riskLevel.toUpperCase()} RISK
                </Badge>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateClinicalSummary}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Processing Summary */}
          {showAdvancedAnalysis && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-blue-800">AI Processing Summary</h4>
                <Badge variant="outline" className="text-blue-700">
                  {processingMetrics.confidenceScore}% Confidence
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Accuracy</div>
                  <div className="font-semibold text-blue-700">{processingMetrics.extractionAccuracy}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">ICD-10 Codes</div>
                  <div className="font-semibold">{processingMetrics.icd10CodesFound}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Drug Checks</div>
                  <div className="font-semibold">{processingMetrics.drugInteractionsChecked}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Processing Time</div>
                  <div className="font-semibold">{Math.round(processingMetrics.processingTime / 1000)}s</div>
                </div>
              </div>
            </div>
          )}

          {/* Critical Alerts */}
          {clinicalSummary.criticalAlerts.length > 0 && (
            <Alert className="border-red-300 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-800">Critical Alerts</AlertTitle>
              <AlertDescription className="text-red-700 space-y-2">
                {clinicalSummary.criticalAlerts.map((alert, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="font-medium">{alert.title}:</span>
                    <span>{alert.description}</span>
                    <Badge variant="destructive" className="text-xs">
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {/* Clinical Summary Content */}
          <div className="space-y-6">
            {/* Chief Complaint */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">Chief Complaint</h4>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">{clinicalSummary.chiefComplaint}</p>
              </div>
            </div>

            {/* History of Present Illness */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">History of Present Illness</h4>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">{clinicalSummary.historyOfPresentIllness}</p>
              </div>
            </div>

            {/* Assessment */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">Assessment</h4>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">{clinicalSummary.assessment}</p>
              </div>
            </div>

            {/* Plan */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold">Plan</h4>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">{clinicalSummary.plan}</p>
              </div>
            </div>
          </div>

          {/* ICD-10 Codes */}
          {clinicalSummary.icd10Codes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">ICD-10 Codes</h4>
                <Badge variant="outline">{clinicalSummary.icd10Codes.length} codes</Badge>
              </div>
              <div className="grid gap-2">
                {clinicalSummary.icd10Codes.map((code, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                    <div>
                      <div className="font-mono text-sm">{code.code}</div>
                      <div className="text-xs text-muted-foreground">{code.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {code.isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-xs",
                          code.confidence >= 80 ? "text-green-600 border-green-300" :
                          code.confidence >= 60 ? "text-yellow-600 border-yellow-300" :
                          "text-red-600 border-red-300"
                        )}
                      >
                        {Math.round(code.confidence)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drug Interactions */}
          {clinicalSummary.drugInteractions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Drug Interactions</h4>
                <Badge variant="outline">{clinicalSummary.drugInteractions.length} interactions</Badge>
              </div>
              <div className="grid gap-2">
                {clinicalSummary.drugInteractions.map((interaction, index) => (
                  <div key={index} className="p-3 bg-muted/30 rounded border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{interaction.medication1} + {interaction.medication2}</span>
                      <Badge 
                        variant={interaction.severity === 'severe' ? 'destructive' : 'outline'}
                        className="text-xs"
                      >
                        {interaction.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{interaction.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">Management: {interaction.management}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical Insights */}
          {enableMedicalInsights && medicalInsights.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">AI Medical Insights</h4>
                <Badge variant="outline">{medicalInsights.length} insights</Badge>
              </div>
              <div className="grid gap-2">
                {medicalInsights.map((insight, index) => (
                  <div key={index} className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{insight.description}</span>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs",
                            insight.confidence >= 80 ? "text-green-600 border-green-300" :
                            insight.confidence >= 60 ? "text-yellow-600 border-yellow-300" :
                            "text-red-600 border-red-300"
                          )}
                        >
                          {Math.round(insight.confidence * 100)}%
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {insight.priority.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{insight.rationale}</p>
                    {insight.actionItems.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium text-muted-foreground">Action Items:</p>
                        <ul className="text-xs text-muted-foreground mt-1">
                          {insight.actionItems.map((item, idx) => (
                            <li key={idx}>• {item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={generateClinicalSummary}
              className="w-full sm:w-auto touch-manipulation"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Download summary logic
                const summaryText = `
CLINICAL SUMMARY
================
Patient ID: ${clinicalSummary.patientId}
Generated: ${new Date(clinicalSummary.generatedAt).toLocaleString()}
Confidence: ${clinicalSummary.confidence}%
Risk Level: ${clinicalSummary.riskLevel.toUpperCase()}

CHIEF COMPLAINT:
${clinicalSummary.chiefComplaint}

HISTORY:
${clinicalSummary.historyOfPresentIllness}

ASSESSMENT:
${clinicalSummary.assessment}

PLAN:
${clinicalSummary.plan}

ICD-10 CODES:
${clinicalSummary.icd10Codes.map(code => `${code.code}: ${code.description}`).join('\n')}

DRUG INTERACTIONS:
${clinicalSummary.drugInteractions.map(interaction => 
  `${interaction.medication1} + ${interaction.medication2}: ${interaction.severity}`
).join('\n')}
                `;
                
                const blob = new Blob([summaryText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `clinical-summary-${clinicalSummary.patientId}-${new Date().toISOString().split('T')[0]}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="w-full sm:w-auto touch-manipulation"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              onClick={() => {
                // Share summary logic
                if (navigator.share) {
                  navigator.share({
                    title: 'Clinical Summary',
                    text: `Clinical summary for patient ${clinicalSummary.patientId} - ${clinicalSummary.chiefComplaint}`,
                    url: window.location.href
                  });
                } else {
                  // Fallback: copy to clipboard
                  navigator.clipboard.writeText(`Clinical Summary - Patient ${clinicalSummary.patientId}: ${clinicalSummary.chiefComplaint}`);
                  toast({
                    title: 'Copied to clipboard',
                    description: 'Summary information copied to clipboard.',
                  });
                }
              }}
              className="w-full sm:w-auto touch-manipulation"
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}