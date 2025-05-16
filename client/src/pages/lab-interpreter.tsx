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
import { Loader2, FileUp, Settings2, Database, BookText, RotateCw, BotIcon, UserIcon, Upload, Settings, ChevronRight, DownloadIcon, UploadCloud, FileText, FileSpreadsheet, Clipboard, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiRequest } from '@/lib/queryClient';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
  const [settings, setSettings] = useState<LabInterpreterSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseItem[]>([]);
  const [isLoadingKnowledgeBase, setIsLoadingKnowledgeBase] = useState(false);
  
  // Form values for settings
  const [systemPrompt, setSystemPrompt] = useState('');
  const [withPatientPrompt, setWithPatientPrompt] = useState('');
  const [withoutPatientPrompt, setWithoutPatientPrompt] = useState('');
  
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
        setSystemPrompt(data.systemPrompt);
        setWithPatientPrompt(data.withPatientPrompt);
        setWithoutPatientPrompt(data.withoutPatientPrompt);
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
      const data = await response.json();
      setKnowledgeBase(data);
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
      
      const response = await apiRequest('POST', '/api/lab-interpreter/analyze', {
        reportText: inputText,
        patientId: withPatient ? parseInt(selectedPatientId) : undefined,
        withPatient
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Parse analysis if it's a JSON string
      try {
        setAnalysisResult(typeof data.analysis === 'string' ? JSON.parse(data.analysis) : data.analysis);
      } catch (e) {
        console.error('Error parsing analysis:', e);
        setAnalysisResult({ content: data.analysis });
      }
      
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
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Set the extracted text in the input field
      setInputText(data.extractedText);
      
      // Parse analysis if it's a JSON string
      try {
        setAnalysisResult(typeof data.analysis === 'string' ? JSON.parse(data.analysis) : data.analysis);
      } catch (e) {
        console.error('Error parsing analysis:', e);
        setAnalysisResult({ content: data.analysis });
      }
      
      // Switch to results tab
      setActiveTab('results');
      
      // Close upload dialog
      setIsUploadOpen(false);
      
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
  const [pastedText, setPastedText] = useState('');
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
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
  
  // Handle knowledge base paste text submit
  const handlePastedTextSubmit = async () => {
    if (!pastedText.trim()) {
      toast({
        title: 'Input Required',
        description: 'Please enter knowledge base data to import',
        variant: 'destructive'
      });
      return;
    }
    
    const formData = new FormData();
    formData.append('textContent', pastedText);
    formData.append('importType', 'paste');
    
    await importKnowledgeBase(formData);
    
    // Reset pasted text and close dialog
    setPastedText('');
    setIsImportDialogOpen(false);
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
        withoutPatientPrompt
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
  
  // Render the analysis result in a structured format
  const renderAnalysisResult = () => {
    if (!analysisResult) return null;
    
    // Function to recursively render key-value pairs from the analysis result
    const renderSection = (data: any, level = 0) => {
      if (typeof data !== 'object' || data === null) {
        return <p className="text-sm">{String(data)}</p>;
      }
      
      return (
        <div className={`space-y-2 ${level > 0 ? 'ml-4' : ''}`}>
          {Object.entries(data).map(([key, value]) => {
            if (key === 'content' && level === 0) {
              return (
                <div key={key} className="space-y-2">
                  {String(value).split('\n').map((line, i) => (
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
                  <h4 className="text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {value.map((item, index) => (
                      <li key={index} className="text-sm">
                        {typeof item === 'object' ? renderSection(item, level + 1) : String(item)}
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
                  <h4 className="text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</h4>
                  {renderSection(value, level + 1)}
                </div>
              );
            }
            
            // Handle simple key-value pairs
            return (
              <div key={key} className="space-y-1">
                <h4 className="text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</h4>
                <p className="text-sm">{String(value)}</p>
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
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Knowledge Base Management</DialogTitle>
                <DialogDescription>
                  Manage reference ranges and interpretations for lab tests
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium">Lab Test References</h3>
                  <div className="flex items-center gap-2">
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
                          Import Data
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => knowledgeBaseFileRef.current?.click()}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          <span>Import Excel File</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => textFileInputRef.current?.click()}>
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Import Text File</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsImportDialogOpen(true)}>
                          <Clipboard className="mr-2 h-4 w-4" />
                          <span>Paste Text</span>
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
                
                <ScrollArea className="h-[350px] rounded-md border">
                  {isLoadingKnowledgeBase ? (
                    <div className="flex justify-center items-center h-full">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : knowledgeBase.length === 0 ? (
                    <div className="flex flex-col justify-center items-center h-full p-6 text-center">
                      <Database className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-medium mb-2">No Reference Data</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload an Excel file to import lab test reference ranges and interpretations.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="sticky top-0 bg-background border-b">
                          <th className="text-left p-2 text-sm font-medium">Test Name</th>
                          <th className="text-left p-2 text-sm font-medium">Marker</th>
                          <th className="text-left p-2 text-sm font-medium">Normal Range</th>
                          <th className="text-left p-2 text-sm font-medium">Unit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {knowledgeBase.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="p-2 text-sm">{item.testName}</td>
                            <td className="p-2 text-sm">{item.marker}</td>
                            <td className="p-2 text-sm">
                              {item.normalRangeLow !== null && item.normalRangeHigh !== null 
                                ? `${item.normalRangeLow} - ${item.normalRangeHigh}`
                                : item.normalRangeLow !== null
                                  ? `> ${item.normalRangeLow}`
                                  : item.normalRangeHigh !== null
                                    ? `< ${item.normalRangeHigh}`
                                    : 'N/A'}
                            </td>
                            <td className="p-2 text-sm">{item.unit || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ScrollArea>
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
                    Test: Complete Blood Count<br/>
                    Marker: Hemoglobin<br/>
                    Range: 12.0-15.5 g/dL<br/>
                    Interpretation: Hemoglobin is a protein in red blood cells<br/>
                    Recommendations: Low levels may indicate anemia
                    
                    <br/><br/>
                    
                    Test: Liver Function<br/>
                    Marker: ALT<br/>
                    Range: 7-55 U/L<br/>
                    Interpretation: Liver enzyme used to detect damage<br/>
                    Recommendations: Elevated levels suggest liver injury
                  </pre>
                </div>
                
                <Textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
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
                        Upload a PDF or image of a lab report for analysis
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
                          onChange={handleFileUpload}
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={withPatient && !selectedPatientId}
                        />
                        <div className="flex flex-col items-center justify-center gap-2">
                          <UploadCloud className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm font-medium">Click to upload or drag and drop</p>
                          <p className="text-xs text-muted-foreground">PDF or Image (max 10MB)</p>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
              
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="input">Input</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                </TabsList>
                <TabsContent value="input">
                  <div className="space-y-4 mt-4">
                    <Textarea
                      placeholder="Enter lab report data here..."
                      className="min-h-[350px] font-mono text-sm"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                    />
                    <div className="flex justify-end">
                      <Button 
                        onClick={handleAnalyze} 
                        disabled={isAnalyzing || (withPatient && !selectedPatientId) || !inputText.trim()}
                      >
                        {isAnalyzing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Analyze Report
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="results">
                  <Card className="mt-4">
                    <CardHeader className="pb-3">
                      <CardTitle>Analysis Results</CardTitle>
                      <CardDescription>
                        AI-powered interpretation of lab report data
                      </CardDescription>
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
                        <div className="space-y-4">
                          {renderAnalysisResult()}
                        </div>
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
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}