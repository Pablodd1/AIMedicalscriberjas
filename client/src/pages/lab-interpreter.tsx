import { useState, useRef, useEffect } from 'react';
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, FileUp, Settings2, Database, BookText, RotateCw, BotIcon, UserIcon, Upload, Settings, ChevronRight, DownloadIcon, UploadCloud, FileText, FileSpreadsheet, Clipboard, ChevronDown, Maximize, Minimize, Mic, MicOff, Save, Edit, Brain } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';
import RichTextEditor from '@/components/RichTextEditor';

interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface KnowledgeBaseItem {
  id: number;
  testName: string;
  marker: string;
  normalRangeLow: number | null;
  normalRangeHigh: number | null;
  unit: string | null;
  interpretation: string;
  recommendations: string | null;
}

interface LabInterpreterSettings {
  id: number;
  systemPrompt: string;
  withPatientPrompt: string;
  withoutPatientPrompt: string;
  reportFormatInstructions: string;
}

export default function LabInterpreter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('input');
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [withPatient, setWithPatient] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [settings, setSettings] = useState<LabInterpreterSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [isLoadingKnowledgeBase, setIsLoadingKnowledgeBase] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [showGuidelines, setShowGuidelines] = useState(false);

  // Rich text editor states
  const [editableContent, setEditableContent] = useState('');
  const [isEditorMode, setIsEditorMode] = useState(false);

  // Voice recording and transcription states
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  // Debug mode states
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isTestingSimpleAnalysis, setIsTestingSimpleAnalysis] = useState(false);

  // Report saving states (declared later in file)

  // Form values for settings
  const [systemPrompt, setSystemPrompt] = useState('');
  const [withPatientPrompt, setWithPatientPrompt] = useState('');
  const [withoutPatientPrompt, setWithoutPatientPrompt] = useState('');
  const [reportFormatInstructions, setReportFormatInstructions] = useState('');

  // Refs for file uploads
  const fileInputRef = useRef<HTMLInputElement>(null);
  const knowledgeBaseFileRef = useRef<HTMLInputElement>(null);

  // Load patients data
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setIsLoadingPatients(true);
        const response = await apiRequest('GET', '/api/patients');
        const data = await response.json();
        setPatients(data);
      } catch (error) {
        console.error('Error fetching patients:', error);
        toast({
          title: 'Error',
          description: 'Failed to load patients',
          variant: 'destructive'
        });
      } finally {
        setIsLoadingPatients(false);
      }
    };

    if (withPatient) {
      fetchPatients();
    }
  }, [withPatient, toast]);

  // Load settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setIsLoadingSettings(true);
        const response = await apiRequest('GET', '/api/lab-interpreter/settings');
        const data = await response.json();
        setSettings(data);

        // Map the database field names to our client field names
        setSystemPrompt(data.system_prompt || data.systemPrompt || '');
        setWithPatientPrompt(data.with_patient_prompt || data.withPatientPrompt || '');
        setWithoutPatientPrompt(data.without_patient_prompt || data.withoutPatientPrompt || '');
        setReportFormatInstructions(data.report_format_instructions || data.reportFormatInstructions || '');
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load interpreter settings',
          variant: 'destructive'
        });
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [toast]);

  // Load knowledge base
  const loadKnowledgeBase = async () => {
    try {
      setIsLoadingKnowledgeBase(true);
      const response = await apiRequest('GET', '/api/lab-interpreter/knowledge-base');
      const result = await response.json();

      console.log('Knowledge base response:', result);

      // Handle both direct array and wrapped response
      const data = result.data || result;
      setKnowledgeBase(Array.isArray(data) ? data : []);

      console.log('Knowledge base loaded:', Array.isArray(data) ? data.length : 0, 'items');
    } catch (error) {
      console.error('Error fetching knowledge base:', error);
      toast({
        title: 'Error',
        description: 'Failed to load knowledge base',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingKnowledgeBase(false);
    }
  };

  // Speech recognition and recording functions
  const startRecording = () => {
    try {
      // Add TypeScript declarations for the Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition ||
        (window as any).mozSpeechRecognition ||
        (window as any).msSpeechRecognition;

      if (!SpeechRecognition) {
        toast({
          title: 'Not Supported',
          description: 'Speech recognition is not supported in your browser. Try using Chrome.',
          variant: 'destructive'
        });
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscript(prevTranscript => {
          const newTranscript = prevTranscript + finalTranscript;
          return newTranscript;
        });
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          toast({
            title: 'Permission Denied',
            description: 'Microphone access is needed for recording. Please allow microphone access.',
            variant: 'destructive'
          });
          stopRecording();
        }
      };

      recognitionRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({
        title: 'Recording Started',
        description: 'Your voice is now being recorded and transcribed.'
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording Failed',
        description: 'There was an error starting the voice recording.',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      clearInterval(timerRef.current);
      setIsRecording(false);

      toast({
        title: 'Recording Stopped',
        description: 'Your recording has been transcribed.'
      });
    }
  };

  const saveTranscriptToPatient = async () => {
    if (!withPatient || !selectedPatientId || !transcript.trim()) {
      toast({
        title: 'Cannot Save',
        description: withPatient
          ? 'There is no transcript to save.'
          : 'You need to select a patient to save this transcript.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSavingTranscript(true);

      const response = await apiRequest('POST', '/api/lab-interpreter/save-transcript', {
        patientId: parseInt(selectedPatientId),
        transcript,
        reportId: analysisResult?.reportId || null,
      });

      if (!response.ok) {
        throw new Error('Failed to save transcript');
      }

      toast({
        title: 'Transcript Saved',
        description: 'The recorded transcript has been saved to the patient record.'
      });

      // Clear transcript after saving
      setTranscript('');
    } catch (error) {
      console.error('Error saving transcript:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save the transcript to patient record.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingTranscript(false);
    }
  };

  // Load knowledge base on component mount
  useEffect(() => {
    loadKnowledgeBase();
  }, []);

  useEffect(() => {
    // Load knowledge base data when the dialog is opened
    if (isKnowledgeBaseOpen) {
      loadKnowledgeBase();
    }
  }, [isKnowledgeBaseOpen, toast]);

  // Handle analyze button click
  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter lab report data to analyze',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);
      setReportSavedToPatient(false); // Reset saved state for new analysis

      const response = await fetch('/api/lab-interpreter/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          reportText: inputText,
          patientId: withPatient ? parseInt(selectedPatientId) : undefined,
          withPatient
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.message || 'Analysis failed');
      }

      if (!result.success) {
        throw new Error(result.error || 'Analysis failed');
      }

      const data = result.data;

      // Analysis is now in natural language format (not JSON)
      const analysisContent = data.analysis;
      const parsedResult = { content: analysisContent };
      setAnalysisResult(parsedResult);

      // Store debug info if available
      if (data.debug) {
        setDebugInfo(data.debug);
        console.log('Analysis Debug Info:', data.debug);
      }

      // Initialize editable content for the editor
      initializeEditableContent(parsedResult);

      // Switch to results tab
      setActiveTab('results');

      toast({
        title: 'Analysis Complete',
        description: 'Lab report analysis has been completed successfully',
      });
    } catch (error) {
      console.error('Error analyzing lab report:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze lab report',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Close dialog immediately when file is selected
    setIsUploadOpen(false);

    const formData = new FormData();
    formData.append('labReport', file);
    formData.append('withPatient', withPatient.toString());
    if (withPatient && selectedPatientId) {
      formData.append('patientId', selectedPatientId);
    }

    try {
      setIsAnalyzing(true);
      setAnalysisResult(null);

      const response = await fetch('/api/lab-interpreter/analyze/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      const data = result.data;

      // Set the extracted text in the input field
      setInputText(data.extractedText);

      // Analysis is now in natural language format (not JSON)
      const analysisContent = data.analysis;
      const parsedResult = { content: analysisContent };
      setAnalysisResult(parsedResult);

      // Store debug info if available
      if (data.debug) {
        setDebugInfo(data.debug);
        console.log('Upload Analysis Debug Info:', data.debug);
      }

      // Initialize editable content for the editor
      initializeEditableContent(parsedResult);

      // Switch to results tab
      setActiveTab('results');

      toast({
        title: 'Analysis Complete',
        description: 'Lab report has been uploaded and analyzed successfully',
      });
    } catch (error) {
      console.error('Error uploading and analyzing file:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload and analyze lab report',
        variant: 'destructive'
      });
    } finally {
      setIsAnalyzing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle knowledge base upload
  // State for the knowledge base import dialog
  const [importMode, setImportMode] = useState<'excel' | 'text' | 'paste'>('excel');
  const textFileInputRef = useRef<HTMLInputElement>(null);

  // Handle knowledge base upload - Excel file
  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', 'excel');

    await importKnowledgeBase(formData);

    // Reset file input
    if (knowledgeBaseFileRef.current) {
      knowledgeBaseFileRef.current.value = '';
    }
  };

  // Handle knowledge base upload - Text file
  const handleTextFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('importType', 'text');

    await importKnowledgeBase(formData);

    // Reset file input
    if (textFileInputRef.current) {
      textFileInputRef.current.value = '';
    }
  };

  // Download Excel template
  const downloadExcelTemplate = () => {
    // Create sample data for Excel template
    const templateData = [
      ['Test Name', 'Marker', 'Normal Range Low', 'Normal Range High', 'Unit', 'Interpretation', 'Recommendations'],
      ['Complete Blood Count', 'Hemoglobin', '12.0', '16.0', 'g/dL', 'Protein in red blood cells that carries oxygen', 'Low levels may indicate anemia, high levels may suggest dehydration'],
      ['Complete Blood Count', 'Hematocrit', '36.0', '46.0', '%', 'Percentage of blood volume occupied by red blood cells', 'Low values may indicate anemia or blood loss'],
      ['Lipid Panel', 'Total Cholesterol', '', '200', 'mg/dL', 'Total amount of cholesterol in blood', 'Levels above 200 mg/dL may increase cardiovascular risk'],
      ['Lipid Panel', 'HDL Cholesterol', '40', '', 'mg/dL', 'Good cholesterol that helps remove other cholesterol', 'Higher levels are protective against heart disease'],
      ['Liver Function', 'ALT', '7', '55', 'U/L', 'Liver enzyme indicating liver cell damage', 'Elevated levels may suggest liver injury or disease'],
      ['Kidney Function', 'Creatinine', '0.6', '1.2', 'mg/dL', 'Waste product filtered by kidneys', 'High levels may indicate kidney dysfunction'],
      ['Thyroid Function', 'TSH', '0.4', '4.0', 'mIU/L', 'Hormone that stimulates thyroid gland', 'Abnormal levels indicate thyroid dysfunction'],
      ['', '', '', '', '', '', ''],
      ['Disease-Product Format Example:', '', '', '', '', '', ''],
      ['Organ System', 'Disease State', 'Primary Peptide', 'Secondary Peptide', 'Primary Formula', 'Secondary Formula', 'Support Formula 2'],
      ['Cardiovascular', 'Hypertension', 'BPC-157', 'Thymosin Beta-4', 'CoQ10 Complex', 'Magnesium Plus', 'Omega-3 Advanced'],
      ['Endocrine', 'Diabetes Type 2', 'GLP-1', 'Insulin Peptide', 'Berberine Complex', 'Chromium GTF', 'Alpha Lipoic Acid'],
      ['Immune', 'Autoimmune', 'Thymosin Alpha-1', 'LL-37', 'Vitamin D3', 'Curcumin', 'Zinc Complex']
    ];

    // Convert to CSV format
    const csvContent = templateData.map(row =>
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lab_knowledge_base_template.csv';
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Template Downloaded',
      description: 'Excel template downloaded successfully. Open in Excel or Google Sheets to edit.',
    });
  };

  // Handle knowledge base paste text submit
  const handlePastedTextSubmit = async () => {
    if (!pasteContent.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter knowledge base data to import',
        variant: 'destructive'
      });
      return;
    }

    const formData = new FormData();
    formData.append('textContent', pasteContent);
    formData.append('importType', 'paste');

    await importKnowledgeBase(formData);

    // Reset pasted text and close dialog
    setPasteContent('');
    setIsImportDialogOpen(false);
  };

  // Test simple analysis function
  const testSimpleAnalysis = async () => {
    if (!inputText.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter some test lab data first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsTestingSimpleAnalysis(true);

      const response = await fetch('/api/lab-interpreter/test/simple-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          testData: inputText
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Test failed');
      }

      console.log('Simple Test Result:', result.data);
      toast({
        title: 'Test Complete',
        description: 'Simple analysis test completed. Check console for details.',
      });

    } catch (error) {
      console.error('Error testing simple analysis:', error);
      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Test failed',
        variant: 'destructive'
      });
    } finally {
      setIsTestingSimpleAnalysis(false);
    }
  };

  // Format recording time (mm:ss)
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Common import knowledge base function
  const importKnowledgeBase = async (formData: FormData) => {
    try {
      setIsLoadingKnowledgeBase(true);

      const response = await fetch('/api/lab-interpreter/knowledge-base/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Reload knowledge base
      loadKnowledgeBase();

      toast({
        title: 'Knowledge Base Imported',
        description: `Successfully imported ${data.itemsImported} items to the knowledge base`,
      });

      // Close import dialog if open
      setIsImportDialogOpen(false);
    } catch (error) {
      console.error('Error importing knowledge base:', error);
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import knowledge base',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingKnowledgeBase(false);
    }
  };

  // Handle save settings
  const handleSaveSettings = async () => {
    try {
      setIsLoadingSettings(true);

      const response = await apiRequest('POST', '/api/lab-interpreter/settings', {
        systemPrompt,
        withPatientPrompt,
        withoutPatientPrompt,
        reportFormatInstructions
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSettings(data);
      setIsSettingsOpen(false);

      toast({
        title: 'Settings Saved',
        description: 'Lab interpreter settings have been saved successfully',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Utility function to convert any value to readable text
  const convertToReadableText = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';

    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return value.map(item => convertToReadableText(item)).join(', ');
      }

      // Handle objects by extracting meaningful properties
      const keys = Object.keys(value);
      if (keys.length === 0) return 'No data';

      return keys.map(key => {
        const val = value[key];
        if (val === null || val === undefined) return '';
        return `${key}: ${convertToReadableText(val)}`;
      }).filter(Boolean).join(', ');
    }

    return value.toString();
  };

  // Handle download report - Generate Word document with complete analysis
  const handleDownloadReport = async () => {
    if (!analysisResult) return;

    try {
      // Dynamic import for better performance
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');

      // Get patient info if available
      const patient = withPatient && selectedPatientId
        ? patients.find(p => p.id === parseInt(selectedPatientId))
        : null;

      // Debug: Log the analysis result to see what we're working with
      console.log('Analysis result for download:', analysisResult);

      // Create document sections
      const docSections = [];

      // Title
      docSections.push(
        new Paragraph({
          text: "Lab Report Analysis",
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
        })
      );

      // Date
      docSections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated on: ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
              italics: true,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
        })
      );

      // Patient Information
      if (patient) {
        docSections.push(
          new Paragraph({
            text: "Patient Information",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Name: ", bold: true }),
              new TextRun({ text: `${patient.firstName} ${patient.lastName}` }),
            ],
            spacing: { after: 100 },
          })
        );

        docSections.push(
          new Paragraph({
            children: [
              new TextRun({ text: "Patient ID: ", bold: true }),
              new TextRun({ text: patient.id.toString() }),
            ],
            spacing: { after: 100 },
          })
        );
      }

      // Original Lab Data
      if (inputText) {
        docSections.push(
          new Paragraph({
            text: "Original Lab Data",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        // Split input text into paragraphs for better formatting
        const labDataLines = inputText.split('\n').filter(line => line.trim());
        labDataLines.forEach(line => {
          docSections.push(
            new Paragraph({
              text: line,
              spacing: { after: 100 },
            })
          );
        });
      }

      // Add complete analysis result - render all available data
      if (analysisResult) {
        docSections.push(
          new Paragraph({
            text: "Complete Analysis Results",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        // Function to recursively add all analysis data
        const addAnalysisData = (data: any, level: number = 0) => {
          if (!data || typeof data !== 'object') {
            docSections.push(
              new Paragraph({
                text: convertToReadableText(data),
                spacing: { after: 100 },
              })
            );
            return;
          }

          Object.entries(data).forEach(([key, value]) => {
            if (value === null || value === undefined) return;

            // Add heading for each section
            docSections.push(
              new Paragraph({
                text: (key || '').charAt(0).toUpperCase() + (key || '').slice(1).replace(/([A-Z])/g, ' $1'),
                heading: level === 0 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 100 },
              })
            );

            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                docSections.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `${index + 1}. `, bold: true }),
                      new TextRun({ text: convertToReadableText(item) }),
                    ],
                    spacing: { after: 100 },
                  })
                );
              });
            } else if (typeof value === 'object') {
              addAnalysisData(value, level + 1);
            } else {
              docSections.push(
                new Paragraph({
                  text: convertToReadableText(value),
                  spacing: { after: 100 },
                })
              );
            }
          });
        };

        addAnalysisData(analysisResult);
      }

      // Analysis Summary
      if (analysisResult.summary) {
        docSections.push(
          new Paragraph({
            text: "Analysis Summary",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        docSections.push(
          new Paragraph({
            text: analysisResult.summary,
            spacing: { after: 200 },
          })
        );
      }

      // Abnormal Values
      if (analysisResult.abnormalValues && Array.isArray(analysisResult.abnormalValues) && analysisResult.abnormalValues.length > 0) {
        docSections.push(
          new Paragraph({
            text: "Abnormal Values",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        analysisResult.abnormalValues.forEach((value: any) => {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: "• ", bold: true }),
                new TextRun({ text: convertToReadableText(value) }),
              ],
              spacing: { after: 100 },
            })
          );
        });
      }

      // Detailed Interpretation
      if (analysisResult.interpretation) {
        docSections.push(
          new Paragraph({
            text: "Detailed Interpretation",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        docSections.push(
          new Paragraph({
            text: analysisResult.interpretation,
            spacing: { after: 200 },
          })
        );
      }

      // Recommendations
      if (analysisResult.recommendations && Array.isArray(analysisResult.recommendations) && analysisResult.recommendations.length > 0) {
        docSections.push(
          new Paragraph({
            text: "Recommendations",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        analysisResult.recommendations.forEach((rec: any) => {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({ text: "• ", bold: true }),
                new TextRun({ text: convertToReadableText(rec) }),
              ],
              spacing: { after: 100 },
            })
          );
        });
      }

      // Voice Notes
      if (transcript && transcript.trim()) {
        docSections.push(
          new Paragraph({
            text: "Voice Notes",
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 },
          })
        );

        docSections.push(
          new Paragraph({
            text: transcript,
            spacing: { after: 200 },
          })
        );
      }

      // Create the document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: docSections,
          },
        ],
      });

      // Generate and download
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lab-report-analysis-${patient ? `${patient.firstName}-${patient.lastName}-` : ''}${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Report Downloaded',
        description: 'Complete lab report analysis has been downloaded as a Word document.'
      });
    } catch (error) {
      console.error('Error generating document:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate the report document. Please try again.',
        variant: 'destructive'
      });
    }
  };



  // Simple PDF generation for backup
  const generateSimplePDF = async () => {
    if (!analysisResult) return;

    try {
      // Dynamic import for better performance
      const { jsPDF } = await import('jspdf');

      // Get patient info if available
      const patient = withPatient && selectedPatientId
        ? patients.find(p => p.id === parseInt(selectedPatientId))
        : null;

      // Create PDF document
      const doc = new jsPDF();
      let yPosition = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number = 12, isBold: boolean = false) => {
        doc.setFontSize(fontSize);
        if (isBold) doc.setFont('helvetica', 'bold');
        else doc.setFont('helvetica', 'normal');

        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, margin, yPosition);
          yPosition += fontSize * 0.6;
        });
        yPosition += 5;
      };

      // Add title
      addText("Lab Report Analysis", 20, true);
      yPosition += 5;

      // Add date
      addText(`Generated on: ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`, 10);
      yPosition += 10;

      // Add patient info if available
      if (patient) {
        addText("Patient Information", 16, true);
        addText(`Name: ${patient.firstName} ${patient.lastName}`, 12);
        addText(`Patient ID: ${patient.id}`, 12);
        yPosition += 5;
      }

      // Add original lab data
      if (inputText) {
        addText("Original Lab Data", 16, true);
        addText(inputText, 10);
        yPosition += 5;
      }

      // Add complete analysis result - render all available data
      if (analysisResult) {
        addText("Complete Analysis Results", 16, true);

        // Function to recursively add all analysis data
        const addAnalysisData = (data: any, level: number = 0) => {
          if (!data || typeof data !== 'object') {
            addText(convertToReadableText(data), 12);
            return;
          }

          Object.entries(data).forEach(([key, value]) => {
            if (value === null || value === undefined) return;

            // Add heading for each section
            const heading = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
            addText(heading, level === 0 ? 14 : 12, true);

            if (Array.isArray(value)) {
              value.forEach((item, index) => {
                addText(`${index + 1}. ${convertToReadableText(item)}`, 12);
              });
            } else if (typeof value === 'object') {
              addAnalysisData(value, level + 1);
            } else {
              addText(convertToReadableText(value), 12);
            }
          });
        };

        addAnalysisData(analysisResult);
        yPosition += 5;
      }

      // Add analysis summary
      if (analysisResult.summary) {
        addText("Analysis Summary", 16, true);
        addText(analysisResult.summary, 12);
        yPosition += 5;
      }

      // Add abnormal values
      if (analysisResult.abnormalValues && Array.isArray(analysisResult.abnormalValues) && analysisResult.abnormalValues.length > 0) {
        addText("Abnormal Values", 16, true);
        analysisResult.abnormalValues.forEach((value: any) => {
          addText(`• ${convertToReadableText(value)}`, 12);
        });
        yPosition += 5;
      }

      // Add interpretation
      if (analysisResult.interpretation) {
        addText("Detailed Interpretation", 16, true);
        addText(analysisResult.interpretation, 12);
        yPosition += 5;
      }

      // Add recommendations
      if (analysisResult.recommendations && Array.isArray(analysisResult.recommendations) && analysisResult.recommendations.length > 0) {
        addText("Recommendations", 16, true);
        analysisResult.recommendations.forEach((rec: any) => {
          addText(`• ${convertToReadableText(rec)}`, 12);
        });
        yPosition += 5;
      }

      // Add voice notes
      if (transcript && transcript.trim()) {
        addText("Voice Notes", 16, true);
        addText(transcript, 12);
      }

      // Save the PDF
      const fileName = `lab-report-analysis-${patient ? `${patient.firstName}-${patient.lastName}-` : ''}${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

      toast({
        title: 'Report Downloaded',
        description: 'Complete lab report analysis has been downloaded as a PDF document.'
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate the PDF report. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Initialize editable content when analysis is complete - now handles natural language format
  const initializeEditableContent = (analysisData: any) => {
    if (!analysisData) return;

    // Helper function to convert natural language text to HTML with proper formatting
    const formatTextToHTML = (text: string): string => {
      if (!text) return '';

      // Convert line breaks to proper HTML formatting
      let formatted = text
        .replace(/\n\n/g, '</p><p>')  // Double line breaks become new paragraphs
        .replace(/\n/g, '<br>')       // Single line breaks become <br>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
        .replace(/\*(.*?)\*/g, '<em>$1</em>'); // Italic text

      // Wrap in paragraph tags if not already
      if (!formatted.startsWith('<p>')) {
        formatted = '<p>' + formatted + '</p>';
      }

      return formatted;
    };

    // Convert natural language analysis to clean HTML format for the rich text editor
    let htmlContent = '<h1>Lab Report Analysis</h1>';

    // Add patient info if available
    if (withPatient && selectedPatientId) {
      const patient = patients.find(p => p.id.toString() === selectedPatientId);
      if (patient) {
        htmlContent += `<h2>Patient Information</h2>`;
        htmlContent += `<p><strong>Name:</strong> ${patient.firstName} ${patient.lastName}</p>`;
        htmlContent += `<p><strong>Patient ID:</strong> ${patient.id}</p>`;
      }
    }

    // For natural language format, just use the content directly with proper formatting
    if (analysisData.content) {
      htmlContent += `<h2>Analysis Results</h2>`;
      htmlContent += formatTextToHTML(analysisData.content);
    }

    // Add voice notes if available
    if (transcript && transcript.trim()) {
      htmlContent += `<h2>Voice Notes</h2>`;
      htmlContent += formatTextToHTML(transcript);
    }

    setEditableContent(htmlContent);
  };

  // Handle styled report downloads
  const handleDownloadStyledReport = async () => {
    if (!editableContent) {
      toast({
        title: 'No Content',
        description: 'Please edit the report content first.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Convert HTML to plain text for DOCX (with basic formatting)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = editableContent;
      const textContent = tempDiv.textContent || tempDiv.innerText || '';

      // Create styled DOCX content
      const response = await fetch('/api/lab-interpreter/download-styled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: editableContent,
          format: 'docx',
          patientId: withPatient ? selectedPatientId : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate styled document');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const patient = patients.find(p => p.id.toString() === selectedPatientId);
      link.download = `styled-lab-report-${patient ? `${patient.firstName}-${patient.lastName}-` : ''}${new Date().toISOString().split('T')[0]}.docx`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Styled Report Downloaded',
        description: 'Your customized lab report has been downloaded as a Word document.'
      });
    } catch (error) {
      console.error('Error downloading styled report:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate the styled report. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleDownloadStyledReportPDF = async () => {
    if (!editableContent) {
      toast({
        title: 'No Content',
        description: 'Please edit the report content first.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('/api/lab-interpreter/download-styled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: editableContent,
          format: 'pdf',
          patientId: withPatient ? selectedPatientId : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate styled PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const patient = patients.find(p => p.id.toString() === selectedPatientId);
      link.download = `styled-lab-report-${patient ? `${patient.firstName}-${patient.lastName}-` : ''}${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Styled PDF Downloaded',
        description: 'Your customized lab report has been downloaded as a PDF.'
      });
    } catch (error) {
      console.error('Error downloading styled PDF:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate the styled PDF. Please try again.',
        variant: 'destructive'
      });
    }
  };

  // Handle saving report to patient
  const handleSaveReportToPatient = async () => {
    if (!withPatient || !selectedPatientId || !analysisResult) {
      toast({
        title: 'Cannot Save',
        description: 'Please select a patient and ensure analysis results are available.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsSavingReport(true);

      const response = await apiRequest('POST', '/api/lab-interpreter/save-report', {
        patientId: parseInt(selectedPatientId),
        reportData: inputText,
        analysis: JSON.stringify(analysisResult),
        title: `Lab Report Analysis - ${new Date().toLocaleDateString('en-US')}`
      });

      const result = await response.json();

      setReportSavedToPatient(true);

      toast({
        title: 'Report Saved Successfully',
        description: 'The lab report analysis has been saved to the patient\'s medical record.'
      });
    } catch (error) {
      console.error('Error saving report to patient:', error);
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save report to patient record.',
        variant: 'destructive'
      });
    } finally {
      setIsSavingReport(false);
    }
  };

  // Handle follow-up question
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [reportSavedToPatient, setReportSavedToPatient] = useState(false);

  const handleAskFollowUp = async () => {
    if (!followUpQuestion.trim() || !analysisResult) {
      toast({
        title: 'Question Required',
        description: 'Please enter a follow-up question about the lab report analysis.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsAskingFollowUp(true);
      setFollowUpAnswer('');

      // Get patient info if available
      let patientInfo = '';
      if (withPatient && selectedPatientId) {
        const patient = patients.find(p => p.id === parseInt(selectedPatientId));
        if (patient) {
          patientInfo = `Patient: ${patient.firstName} ${patient.lastName} (ID: ${patient.id})`;
        }
      }

      const response = await apiRequest('POST', '/api/lab-interpreter/follow-up', {
        question: followUpQuestion,
        analysisResult: JSON.stringify(analysisResult),
        patientInfo,
        patientId: withPatient ? parseInt(selectedPatientId) : undefined
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setFollowUpAnswer(data.answer);

      toast({
        title: 'Question Answered',
        description: 'Your follow-up question has been processed.'
      });
    } catch (error) {
      console.error('Error asking follow-up question:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to process your follow-up question',
        variant: 'destructive'
      });
    } finally {
      setIsAskingFollowUp(false);
    }
  };

  // Render the analysis result in a structured format
  const renderAnalysisResult = () => {
    if (!analysisResult) return null;

    // Function to safely render any value as a string
    const safeRender = (value: any): string => {
      return convertToReadableText(value);
    };

    // Function to recursively render key-value pairs from the analysis result
    const renderSection = (data: any, level = 0): JSX.Element => {
      if (typeof data !== 'object' || data === null) {
        return <p className="text-sm">{safeRender(data)}</p>;
      }

      return (
        <div className={`space-y-2 ${level > 0 ? 'ml-4' : ''}`}>
          {Object.entries(data).map(([key, value]) => {
            if (key === 'content' && level === 0) {
              return (
                <div key={key} className="space-y-2">
                  {safeRender(value).split('\n').map((line, i) => (
                    <p key={i} className="text-sm">{line}</p>
                  ))}
                </div>
              );
            }

            // Skip rendering if value is undefined or null
            if (value === undefined || value === null) return null;

            // Handle arrays
            if (Array.isArray(value)) {
              return (
                <div key={key} className="space-y-1">
                  <h4 className="text-sm font-medium">{(key || '').charAt(0).toUpperCase() + (key || '').slice(1)}:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {value.map((item, index) => (
                      <li key={index} className="text-sm">
                        {typeof item === 'object' ? (
                          <div className="ml-2 mt-1">
                            {renderSection(item, level + 1)}
                          </div>
                        ) : (
                          safeRender(item)
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            // Handle nested objects
            if (typeof value === 'object') {
              return (
                <div key={key} className="space-y-1">
                  <h4 className="text-sm font-medium">{(key || '').charAt(0).toUpperCase() + (key || '').slice(1)}:</h4>
                  {renderSection(value, level + 1)}
                </div>
              );
            }

            // Handle simple key-value pairs
            return (
              <div key={key} className="space-y-1">
                <h4 className="text-sm font-medium">{(key || '').charAt(0).toUpperCase() + (key || '').slice(1)}:</h4>
                <p className="text-sm">{safeRender(value)}</p>
              </div>
            );
          })}
        </div>
      );
    };

    return renderSection(analysisResult);
  };

  return (
    <div className="container max-w-7xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lab Interpreter Assistant</h1>
          <p className="text-muted-foreground">
            Analyze lab reports using AI with knowledge-based interpretation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]">
              <DialogHeader>
                <DialogTitle>Lab Interpreter Settings</DialogTitle>
                <DialogDescription>
                  Configure prompts used for lab report analysis
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="systemPrompt">System Prompt</Label>
                  <Textarea
                    id="systemPrompt"
                    rows={4}
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    placeholder="Enter system prompt for the AI..."
                  />
                  <p className="text-sm text-muted-foreground">
                    This is the main instruction for the AI assistant.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="withPatientPrompt">With Patient Prompt</Label>
                  <Textarea
                    id="withPatientPrompt"
                    rows={3}
                    value={withPatientPrompt}
                    onChange={(e) => setWithPatientPrompt(e.target.value)}
                    placeholder="Enter prompt for analysis with patient context..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Use ${'{patientName}'} and ${'{patientId}'} as placeholders for patient information.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="withoutPatientPrompt">Without Patient Prompt</Label>
                  <Textarea
                    id="withoutPatientPrompt"
                    rows={3}
                    value={withoutPatientPrompt}
                    onChange={(e) => setWithoutPatientPrompt(e.target.value)}
                    placeholder="Enter prompt for general analysis without patient context..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reportFormatInstructions">Report Format Instructions</Label>
                  <Textarea
                    id="reportFormatInstructions"
                    rows={4}
                    value={reportFormatInstructions}
                    onChange={(e) => setReportFormatInstructions(e.target.value)}
                    placeholder="Specify the desired report format, including headings, spacing, paragraph structure, etc..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Provide detailed instructions for how the AI should format the analysis report, including specific headings, paragraph structure, spacing, and overall layout preferences.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSettings}
                  disabled={isLoadingSettings}
                >
                  {isLoadingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isKnowledgeBaseOpen} onOpenChange={setIsKnowledgeBaseOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon">
                <Database className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className={isFullScreenMode ? "max-w-[95vw] h-[95vh] max-h-[95vh]" : "max-w-5xl max-h-[90vh]"}>
              <DialogHeader>
                <DialogTitle>Personal Knowledge Base Management</DialogTitle>
                <DialogDescription>
                  Manage your personal lab test reference values and interpretations. Each account has its own separate knowledge base.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 overflow-y-auto">
                {/* Template Guidelines Section - Collapsible */}
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setShowGuidelines(!showGuidelines)}
                  >
                    <h3 className="text-lg font-semibold text-blue-900">📋 Template Guidelines</h3>
                    <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                      {showGuidelines ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </Button>
                  </div>
                  {showGuidelines && (
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">📊 Standard Lab Format (Excel)</h4>
                        <div className="space-y-1 text-blue-700">
                          <p><strong>Required columns:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Test Name / Test</li>
                            <li>Marker / Analyte / Parameter</li>
                            <li>Normal Range Low / Min / Lower</li>
                            <li>Normal Range High / Max / Upper</li>
                            <li>Unit</li>
                            <li>Interpretation / Description</li>
                            <li>Recommendations / Advice</li>
                          </ul>
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                            <p className="font-medium text-green-800">💡 Download our Excel template to get started with the correct format!</p>
                            <p className="text-green-700 mt-1">Includes sample data for CBC, Lipid Panel, Liver Function, and Disease-Product formats</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">🏥 Disease-Product Format (Excel)</h4>
                        <div className="space-y-1 text-blue-700">
                          <p><strong>Supported columns:</strong></p>
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li>Organ System / Category</li>
                            <li>Disease State / Condition</li>
                            <li>Product / Supplement columns</li>
                            <li>Peptide columns</li>
                            <li>Formula columns</li>
                          </ul>
                          <p className="mt-2 text-xs"><em>Perfect for supplement/peptide recommendations</em></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">📝 Text Format</h4>
                        <div className="space-y-1 text-blue-700">
                          <p><strong>Format each entry as:</strong></p>
                          <div className="bg-white p-2 rounded border text-xs font-mono">
                            Test: Complete Blood Count<br />
                            Marker: Hemoglobin<br />
                            Range: 12.0-16.0 g/dL<br />
                            Interpretation: Normal oxygen transport<br />
                            Recommendations: Continue monitoring
                          </div>
                          <p className="text-xs mt-1"><em>Separate entries with blank lines</em></p>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium text-blue-800 mb-2">🔒 Privacy & Account Separation</h4>
                        <div className="space-y-1 text-blue-700">
                          <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>Personal Knowledge Base:</strong> Each account has separate data</li>
                            <li><strong>Secure Upload:</strong> Your data stays with your account only</li>
                            <li><strong>Custom Analysis:</strong> AI uses your specific reference ranges</li>
                            <li><strong>Data Control:</strong> You can clear/update your data anytime</li>
                          </ul>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <h4 className="font-medium text-blue-800 mb-2">📥 Quick Start Guide</h4>
                        <div className="space-y-2 text-blue-700 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">1</span>
                            <span>Click "Download Excel Template" to get started</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">2</span>
                            <span>Edit the template with your lab reference values</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">3</span>
                            <span>Save as .xlsx or .csv file and import here</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono">4</span>
                            <span>Your custom data will be used in all lab analyses</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Your Lab Test References ({knowledgeBase.length} items)</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullScreenMode(!isFullScreenMode)}
                    >
                      {isFullScreenMode ? (
                        <>
                          <Minimize className="mr-2 h-4 w-4" />
                          <span className="hidden sm:inline">Exit Fullscreen</span>
                        </>
                      ) : (
                        <>
                          <Maximize className="mr-2 h-4 w-4" />
                          <span className="hidden sm:inline">Fullscreen</span>
                        </>
                      )}
                    </Button>

                    {knowledgeBase.length > 0 && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete all knowledge base items? This action cannot be undone.')) {
                            fetch('/api/lab-interpreter/knowledge-base', {
                              method: 'DELETE',
                            })
                              .then(response => {
                                if (response.ok) {
                                  loadKnowledgeBase();
                                  toast({
                                    title: 'Knowledge Base Cleared',
                                    description: 'All items have been deleted',
                                  });
                                } else {
                                  throw new Error('Failed to clear knowledge base');
                                }
                              })
                              .catch(error => {
                                console.error('Error clearing knowledge base:', error);
                                toast({
                                  title: 'Error',
                                  description: 'Failed to clear knowledge base',
                                  variant: 'destructive'
                                });
                              });
                          }
                        }}
                      >
                        Clear All
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {isLoadingKnowledgeBase ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-2 h-4 w-4" />
                          )}
                          <span className="hidden sm:inline">Import Data</span>
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => knowledgeBaseFileRef.current?.click()}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          <span>Import Excel File (.xlsx, .xls)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={downloadExcelTemplate}>
                          <DownloadIcon className="mr-2 h-4 w-4" />
                          <span>Download Excel Template</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => textFileInputRef.current?.click()}>
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Import Text File (.txt)</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                          <Clipboard className="mr-2 h-4 w-4" />
                          <span>Paste Text Content</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      ref={knowledgeBaseFileRef}
                      onChange={handleExcelFileUpload}
                      className="hidden"
                    />
                    <input
                      type="file"
                      accept=".txt,.text"
                      ref={textFileInputRef}
                      onChange={handleTextFileUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className={isFullScreenMode ? "flex-1 rounded-md border" : "h-[350px] rounded-md border flex flex-col"}>
                  {isLoadingKnowledgeBase ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : knowledgeBase.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-full p-6 text-center">
                      <Database className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No Reference Data</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Your personal knowledge base is empty. Upload an Excel file or paste text to import lab test reference ranges and interpretations.
                      </p>
                      <div className="text-left max-w-md space-y-2">
                        <h4 className="font-medium text-sm">Excel Template Format:</h4>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p><strong>Standard Lab Format:</strong> Test Name, Marker, Normal Range Low, Normal Range High, Unit, Interpretation, Recommendations</p>
                          <p><strong>Disease-Product Format:</strong> Organ System, Disease State, Product columns (supplements/peptides)</p>
                        </div>
                        <h4 className="font-medium text-sm mt-3">Text Format:</h4>
                        <div className="text-xs text-muted-foreground">
                          <p>Each entry separated by blank lines with Test:, Marker:, Range:, Interpretation: format</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-auto h-full">
                      <div className="inline-block min-w-full align-middle">
                        <table className="min-w-full border-collapse text-xs table-fixed w-full">
                          <thead>
                            <tr className="sticky top-0 bg-background border-b z-10">
                              <th className="p-1 px-2 text-left font-medium bg-blue-100/50 w-[80px] md:w-[100px]">Organ System</th>
                              <th className="p-1 px-2 text-left font-medium bg-blue-100/50 w-[80px] md:w-[100px]">Disease</th>
                              <th className="p-1 px-2 text-left font-medium bg-green-100/50 w-[80px] md:w-[100px]">Primary Peptide</th>
                              <th className="p-1 px-2 text-left font-medium bg-green-100/50 w-[80px] md:w-[100px]">Secondary Peptide</th>
                              <th className="p-1 px-2 text-left font-medium bg-green-100/50 w-[80px] md:w-[100px]">Tertiary Peptide</th>
                              <th className="p-1 px-2 text-left font-medium bg-orange-100/50 w-[80px] md:w-[100px]">Primary Formula</th>
                              <th className="p-1 px-2 text-left font-medium bg-orange-100/50 w-[80px] md:w-[100px]">Secondary Formula</th>
                              <th className="p-1 px-2 text-left font-medium bg-purple-100/50 w-[80px] md:w-[100px]">Support Formula 2</th>
                              <th className="p-1 px-2 text-left font-medium bg-purple-100/50 w-[80px] md:w-[100px]">Support Formula 3</th>
                              <th className="p-1 px-2 text-left font-medium bg-yellow-100/50 w-[80px] md:w-[100px]">How to take</th>
                              <th className="p-1 px-2 text-left font-medium bg-yellow-100/50 w-[80px] md:w-[100px]">How to take_1</th>
                              <th className="p-1 px-2 text-left font-medium bg-pink-100/50 w-[80px] md:w-[100px]">View All Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {knowledgeBase.map((item) => {
                              // Parse the recommendations to extract the individual column data
                              const columnData: Record<string, string> = {
                                'Primary Peptide': '',
                                'Secondary Peptide': '',
                                'Tertiary Peptide': '',
                                'Primary Formula': '',
                                'Secondary Formula': '',
                                'Support Formula 2': '',
                                'Support Formula 3': '',
                                'Support Formula 4': '',
                                'How to take': '',
                                'How to take_1': '',
                                'How to take_2': ''
                              };

                              if (item.recommendations) {
                                // Parse the enhanced structured format with correct section headers
                                const peptidesSectionMatch = item.recommendations.match(/PEPTIDES:\s*\n([\s\S]*?)(?=\n\s*SUPPLEMENTS|\n\s*DOSAGE|\n\s*ADDITIONAL|$)/i);
                                const formulasSectionMatch = item.recommendations.match(/SUPPLEMENTS & FORMULAS:\s*\n([\s\S]*?)(?=\n\s*DOSAGE|\n\s*ADDITIONAL|$)/i);

                                if (peptidesSectionMatch) {
                                  const peptideLines = peptidesSectionMatch[1].trim().split('\n');
                                  peptideLines.forEach(line => {
                                    const match = line.match(/^([^:]+):\s*(.+)$/);
                                    if (match) {
                                      const [, key, value] = match;
                                      const keyNormalized = key.trim().toLowerCase();
                                      if (keyNormalized.includes('primary') && keyNormalized.includes('peptide')) {
                                        columnData['Primary Peptide'] = value.trim();
                                      } else if (keyNormalized.includes('secondary') && keyNormalized.includes('peptide')) {
                                        columnData['Secondary Peptide'] = value.trim();
                                      } else if (keyNormalized.includes('tertiary') && keyNormalized.includes('peptide')) {
                                        columnData['Tertiary Peptide'] = value.trim();
                                      }
                                    }
                                  });
                                }

                                if (formulasSectionMatch) {
                                  const formulaLines = formulasSectionMatch[1].trim().split('\n');
                                  formulaLines.forEach(line => {
                                    const match = line.match(/^([^:]+):\s*(.+)$/);
                                    if (match) {
                                      const [, key, value] = match;
                                      const keyNormalized = key.trim().toLowerCase();
                                      if (keyNormalized.includes('primary') && keyNormalized.includes('formula')) {
                                        columnData['Primary Formula'] = value.trim();
                                      } else if (keyNormalized.includes('secondary') && keyNormalized.includes('formula')) {
                                        columnData['Secondary Formula'] = value.trim();
                                      } else if (keyNormalized.includes('support') && keyNormalized.includes('formula') && keyNormalized.includes('2')) {
                                        columnData['Support Formula 2'] = value.trim();
                                      } else if (keyNormalized.includes('support') && keyNormalized.includes('formula') && keyNormalized.includes('3')) {
                                        columnData['Support Formula 3'] = value.trim();
                                      } else if (keyNormalized.includes('support') && keyNormalized.includes('formula') && keyNormalized.includes('4')) {
                                        columnData['Support Formula 4'] = value.trim();
                                      }
                                    }
                                  });
                                }

                                // Parse dosage instructions
                                const dosageSectionMatch = item.recommendations.match(/DOSAGE INSTRUCTIONS:\s*\n([\s\S]*?)(?=\n\s*ADDITIONAL|$)/i);
                                if (dosageSectionMatch) {
                                  const dosageLines = dosageSectionMatch[1].trim().split('\n');
                                  dosageLines.forEach(line => {
                                    const match = line.match(/^([^:]+):\s*(.+)$/);
                                    if (match) {
                                      const [, key, value] = match;
                                      const keyNormalized = key.trim().toLowerCase();
                                      if (keyNormalized === 'how to take') {
                                        columnData['How to take'] = value.trim();
                                      } else if (keyNormalized === 'how to take_1') {
                                        columnData['How to take_1'] = value.trim();
                                      } else if (keyNormalized === 'how to take_2') {
                                        columnData['How to take_2'] = value.trim();
                                      }
                                    }
                                  });
                                }

                                // Enhanced fallback parsing to catch any missed data
                                if (!Object.values(columnData).some(v => v)) {
                                  const lines = item.recommendations.split('\n');
                                  lines.forEach(line => {
                                    const match = line.match(/^([^:]+):\s*(.+)$/);
                                    if (match) {
                                      const [, key, value] = match;
                                      const keyNormalized = key.trim().toLowerCase();

                                      // Direct column name matching
                                      Object.keys(columnData).forEach(targetKey => {
                                        const targetNormalized = targetKey.toLowerCase();
                                        if (keyNormalized.includes(targetNormalized.replace(/\s+/g, '')) ||
                                          key.trim() === targetKey) {
                                          columnData[targetKey] = value.trim();
                                        }
                                      });
                                    }
                                  });
                                }
                              }

                              return (
                                <tr key={item.id} className="border-b hover:bg-muted/50">
                                  <td className="p-1 px-2 font-medium bg-blue-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={item.testName}>{item.testName}</td>
                                  <td className="p-1 px-2 bg-blue-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={item.marker}>{item.marker}</td>
                                  <td className="p-1 px-2 bg-green-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Primary Peptide']}>{columnData['Primary Peptide']}</td>
                                  <td className="p-1 px-2 bg-green-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Secondary Peptide']}>{columnData['Secondary Peptide']}</td>
                                  <td className="p-1 px-2 bg-green-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Tertiary Peptide']}>{columnData['Tertiary Peptide']}</td>
                                  <td className="p-1 px-2 bg-orange-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Primary Formula']}>{columnData['Primary Formula']}</td>
                                  <td className="p-1 px-2 bg-orange-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Secondary Formula']}>{columnData['Secondary Formula']}</td>
                                  <td className="p-1 px-2 bg-purple-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Support Formula 2']}>{columnData['Support Formula 2']}</td>
                                  <td className="p-1 px-2 bg-purple-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['Support Formula 3']}>{columnData['Support Formula 3']}</td>
                                  <td className="p-1 px-2 bg-yellow-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['How to take']}>{columnData['How to take']}</td>
                                  <td className="p-1 px-2 bg-yellow-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate" title={columnData['How to take_1']}>{columnData['How to take_1']}</td>
                                  <td className="p-1 px-2 bg-pink-50/50 whitespace-normal text-xs max-w-[80px] md:max-w-[100px] truncate">
                                    <button
                                      className="text-blue-600 hover:text-blue-800 underline text-xs"
                                      onClick={() => {
                                        alert(`Full Data for ${item.testName} - ${item.marker}:\n\n${item.recommendations}`);
                                      }}
                                    >
                                      View All
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Text Paste Import Dialog */}
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Import Knowledge Base via Text</DialogTitle>
                <DialogDescription>
                  Paste lab test reference data in the following format:
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                <div className="mb-4 p-3 bg-muted rounded-md">
                  <pre className="text-xs text-muted-foreground">
                    Test: Complete Blood Count<br />
                    Marker: Hemoglobin<br />
                    Range: 12.0-15.5 g/dL<br />
                    Interpretation: Hemoglobin is a protein in red blood cells<br />
                    Recommendations: Low levels may indicate anemia

                    <br /><br />

                    Test: Liver Function<br />
                    Marker: ALT<br />
                    Range: 7-55 U/L<br />
                    Interpretation: Liver enzyme used to detect damage<br />
                    Recommendations: Elevated levels suggest liver injury
                  </pre>
                </div>

                <Textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste your lab test reference data here..."
                  className="h-[200px]"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePastedTextSubmit} disabled={isLoadingKnowledgeBase}>
                  {isLoadingKnowledgeBase ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import Data
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-12">
        <Card className="md:col-span-12">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="with-patient"
                    checked={withPatient}
                    onCheckedChange={setWithPatient}
                  />
                  <Label htmlFor="with-patient">With Patient</Label>
                </div>

                {withPatient && (
                  <div className="flex-1 max-w-xs">
                    <Select
                      value={selectedPatientId}
                      onValueChange={setSelectedPatientId}
                      disabled={isLoadingPatients}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingPatients ? (
                          <div className="flex justify-center p-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : patients.length === 0 ? (
                          <div className="p-2 text-center text-muted-foreground">
                            No patients found
                          </div>
                        ) : (
                          patients.map((patient) => (
                            <SelectItem key={patient.id} value={patient.id.toString()}>
                              {patient.firstName} {patient.lastName}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <FileUp className="mr-2 h-4 w-4" />
                      Upload Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Lab Report</DialogTitle>
                      <DialogDescription>
                        Upload a PDF or image of your lab report. The system will extract all text and display it for review before analysis.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {withPatient && !selectedPatientId && (
                        <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm">
                          Please select a patient before uploading a lab report.
                        </div>
                      )}
                      <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            try {
                              setIsProcessingUpload(true);
                              setUploadProgress(0);
                              setIsUploadOpen(false);

                              const formData = new FormData();
                              formData.append('file', file);

                              // Create progress tracking
                              const progressInterval = setInterval(() => {
                                setUploadProgress(prev => Math.min(prev + 5, 90));
                              }, 500);

                              // Extract text only (no analysis)
                              const response = await fetch('/api/lab-interpreter/extract-text', {
                                method: 'POST',
                                body: formData,
                                credentials: 'include'
                              });

                              clearInterval(progressInterval);
                              setUploadProgress(100);

                              if (!response.ok) {
                                const errorData = await response.json();
                                throw new Error(errorData.message || 'Text extraction failed');
                              }

                              const result = await response.json();
                              console.log('Extract text response:', result);

                              if (result.success && result.data && result.data.extractedText) {
                                // Show extracted text in input field for review
                                setInputText(result.data.extractedText);
                                setActiveTab('input');

                                toast({
                                  title: 'Text Extracted Successfully',
                                  description: `Extracted ${result.data.extractedText.length} characters. Review and edit the text below, then click "Analyze Report".`
                                });
                              } else if (result.success && result.extractedText) {
                                // Fallback for different response format
                                setInputText(result.extractedText);
                                setActiveTab('input');

                                toast({
                                  title: 'Text Extracted Successfully',
                                  description: `Extracted ${result.extractedText.length} characters. Review and edit the text below, then click "Analyze Report".`
                                });
                              } else {
                                console.error('Unexpected response format:', result);
                                throw new Error('No extracted text found in response');
                              }
                            } catch (error) {
                              console.error('Upload error:', error);
                              toast({
                                title: 'Upload Failed',
                                description: error instanceof Error ? error.message : 'Failed to process uploaded file.',
                                variant: 'destructive'
                              });
                            } finally {
                              setIsProcessingUpload(false);
                              setUploadProgress(0);
                              // Reset input
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }
                          }}
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={withPatient && !selectedPatientId}
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UploadCloud className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground">PDF or Image files (max 10MB)</p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="input">Input</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                  <TabsTrigger value="editor" disabled={!analysisResult}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit & Style
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="input">
                  <div className="space-y-4 mt-4">
                    {/* Show processing indicator when extracting text */}
                    {isProcessingUpload && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Extracting text from your lab report...</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <p className="text-xs text-blue-600">Please wait while we process your PDF/image and extract all lab data.</p>
                      </div>
                    )}

                    {/* Header for extracted data */}
                    {inputText && !isProcessingUpload && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Extracted Lab Data</span>
                          <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                            {inputText.length} characters extracted
                          </span>
                        </div>
                        <p className="text-xs text-green-600">
                          Review the extracted data below. You can edit it if needed, then click "Analyze This Data" to get medical insights.
                        </p>
                      </div>
                    )}

                    <Textarea
                      placeholder="Enter lab report data here or upload a PDF/image above to automatically extract the data..."
                      className="min-h-[350px] font-mono text-sm"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDebugMode(!debugMode)}
                          className="text-xs"
                        >
                          {debugMode ? '🔍 Debug ON' : '🔍 Debug OFF'}
                        </Button>
                        {debugMode && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={testSimpleAnalysis}
                            disabled={isTestingSimpleAnalysis || !inputText.trim()}
                            className="text-xs"
                          >
                            {isTestingSimpleAnalysis && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                            Test Analysis
                          </Button>
                        )}
                      </div>

                      {/* Enhanced Analysis Button */}
                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || (withPatient && !selectedPatientId) || !inputText.trim()}
                        size="lg"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 text-sm font-medium"
                      >
                        {isAnalyzing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing Lab Data...
                          </>
                        ) : (
                          <>
                            <Brain className="mr-2 h-4 w-4" />
                            Now Analyze This Data
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="results">
                  {!analysisResult ? (
                    <div className="mt-4 text-center py-12">
                      <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-muted-foreground mb-2">No Analysis Yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload a lab report or enter lab data, then click "Now Analyze This Data" to get medical insights.
                      </p>
                      <Button
                        onClick={() => setActiveTab('input')}
                        variant="outline"
                        className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                      >
                        <FileUp className="h-4 w-4 mr-2" />
                        Go to Input Tab
                      </Button>
                    </div>
                  ) : (
                    <Card className="mt-4">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Brain className="h-5 w-5 text-blue-600" />
                              Medical Analysis Report
                            </CardTitle>
                            <CardDescription>
                              AI-powered interpretation with clinical insights and recommendations
                            </CardDescription>
                          </div>
                          {analysisResult && (
                            <div className="flex items-center gap-2">
                              {debugMode && debugInfo && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => console.log('Debug Info:', debugInfo)}
                                  className="text-xs text-muted-foreground"
                                >
                                  📊 Debug Info
                                </Button>
                              )}
                              {withPatient && selectedPatientId && (
                                <Button
                                  variant={reportSavedToPatient ? "secondary" : "default"}
                                  size="sm"
                                  onClick={handleSaveReportToPatient}
                                  disabled={isSavingReport || reportSavedToPatient}
                                >
                                  {isSavingReport ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                      Saving...
                                    </>
                                  ) : reportSavedToPatient ? (
                                    <>
                                      <Save className="h-4 w-4 mr-1" />
                                      Saved ✓
                                    </>
                                  ) : (
                                    <>
                                      <Save className="h-4 w-4 mr-1" />
                                      Save to Patient
                                    </>
                                  )}
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                                <DownloadIcon className="h-4 w-4 mr-1" />
                                Download Report
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {isAnalyzing ? (
                          <div className="flex justify-center items-center py-12">
                            <div className="flex flex-col items-center gap-2">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <p className="text-sm text-muted-foreground">Analyzing lab report...</p>
                            </div>
                          </div>
                        ) : analysisResult ? (
                          <ScrollArea className="h-[500px] pr-4">
                            <div className="space-y-4">
                              {renderAnalysisResult()}
                            </div>
                          </ScrollArea>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <BookText className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No Analysis Results</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-md">
                              Enter lab report data and click "Analyze Report" to get an AI-powered interpretation.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Voice Recording and Follow-up Questions Side-by-Side */}
                  {analysisResult && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {/* Voice Recording Section - Left Side */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between">
                            <span>Voice Notes</span>
                            <div className="space-x-2">
                              <Button
                                variant={isRecording ? "destructive" : "default"}
                                size="sm"
                                onClick={isRecording ? stopRecording : startRecording}
                              >
                                {isRecording ? (
                                  <>
                                    <MicOff className="h-4 w-4 mr-1" />
                                    Stop ({formatTime(recordingTime)})
                                  </>
                                ) : (
                                  <>
                                    <Mic className="h-4 w-4 mr-1" />
                                    Record
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardTitle>
                          <CardDescription>
                            Record voice notes about this lab report
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {transcript ? (
                            <>
                              <ScrollArea className="h-[200px] w-full rounded-md border p-4 mb-2">
                                {transcript}
                              </ScrollArea>
                              <div className="flex gap-2 mt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => {
                                    navigator.clipboard.writeText(transcript);
                                    toast({
                                      title: 'Copied',
                                      description: 'Transcript copied to clipboard'
                                    });
                                  }}
                                >
                                  <Clipboard className="h-4 w-4 mr-1" />
                                  Copy
                                </Button>
                                {withPatient && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={saveTranscriptToPatient}
                                    disabled={isSavingTranscript}
                                  >
                                    {isSavingTranscript ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-1" />
                                    )}
                                    Save to Patient
                                  </Button>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="h-[200px] w-full rounded-md border flex items-center justify-center text-muted-foreground">
                              {isRecording ? 'Listening... Speak now.' : 'No recorded transcript yet. Click "Record" to begin.'}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Follow-up Questions Section - Right Side */}
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle>Follow-up Questions</CardTitle>
                          <CardDescription>
                            Ask for specific information about the results
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex gap-2">
                              <Input
                                placeholder="Ask about supplements, peptides, or recommendations..."
                                value={followUpQuestion}
                                onChange={(e) => setFollowUpQuestion(e.target.value)}
                                className="flex-1"
                              />
                              <Button
                                onClick={handleAskFollowUp}
                                disabled={isAskingFollowUp || !followUpQuestion.trim()}
                              >
                                {isAskingFollowUp ? (
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 mr-1" />
                                )}
                                Ask
                              </Button>
                            </div>

                            {followUpAnswer ? (
                              <ScrollArea className="h-[200px] pr-4">
                                <Card className="bg-muted/50">
                                  <CardContent className="pt-4">
                                    <div className="flex gap-2 items-start">
                                      <BotIcon className="h-5 w-5 mt-0.5 text-primary" />
                                      <div className="space-y-1">
                                        <p className="font-medium text-sm">Your question:</p>
                                        <p className="text-sm">{followUpQuestion}</p>
                                        <Separator className="my-2" />
                                        <p className="text-sm whitespace-pre-wrap">{followUpAnswer}</p>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </ScrollArea>
                            ) : (
                              <div className="text-sm text-muted-foreground space-y-2">
                                <p>Example questions:</p>
                                <ul className="list-disc list-inside mt-1 space-y-1">
                                  <li>What supplements would you recommend?</li>
                                  <li>Any peptides for these abnormal values?</li>
                                  <li>What dietary changes should I make?</li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="editor">
                  <Card className="mt-4">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Edit & Style Analysis</CardTitle>
                          <CardDescription>
                            Customize formatting, colors, fonts, and layout for your report
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <DownloadIcon className="h-4 w-4 mr-2" />
                                Download Styled
                                <ChevronDown className="h-4 w-4 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={handleDownloadStyledReport}>
                                <FileText className="h-4 w-4 mr-2" />
                                Download as Styled Word (.docx)
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={handleDownloadStyledReportPDF}>
                                <FileText className="h-4 w-4 mr-2" />
                                Download as Styled PDF
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {analysisResult ? (
                        <div className="space-y-4">
                          <RichTextEditor
                            content={editableContent}
                            onChange={setEditableContent}
                            className="w-full"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <Edit className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="text-lg font-medium mb-2">No Analysis to Edit</h3>
                          <p className="text-sm text-muted-foreground mb-6 max-w-md">
                            Analyze a lab report first, then use this editor to customize the styling and formatting.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}