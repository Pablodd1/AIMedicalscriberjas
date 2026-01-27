import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  FileJson, 
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users,
  Settings,
  Filter,
  Search,
  RefreshCw,
  ExternalLink,
  Database,
  Cloud,
  HardDrive,
  Wifi,
  WifiOff,
  Eye,
  EyeOff,
  HelpCircle,
  Plus,
  Trash2,
  Edit3,
  Save,
  X
} from "lucide-react";

// Supported import platforms and formats
const SUPPORTED_PLATFORMS = [
  {
    id: 'epic',
    name: 'Epic EHR',
    type: 'ehr_system',
    supportedFormats: ['HL7', 'FHIR', 'CSV'],
    description: 'Import patients from Epic electronic health records',
    icon: Database,
    color: 'blue',
    requiresAuth: true
  },
  {
    id: 'cerner',
    name: 'Cerner PowerChart',
    type: 'ehr_system',
    supportedFormats: ['HL7', 'FHIR', 'CSV'],
    description: 'Import patients from Cerner PowerChart system',
    icon: Database,
    color: 'green',
    requiresAuth: true
  },
  {
    id: 'allscripts',
    name: 'Allscripts',
    type: 'ehr_system',
    supportedFormats: ['HL7', 'FHIR', 'CSV'],
    description: 'Import patients from Allscripts EHR',
    icon: Database,
    color: 'purple',
    requiresAuth: true
  },
  {
    id: 'csv',
    name: 'CSV/Excel File',
    type: 'file',
    supportedFormats: ['CSV', 'XLSX'],
    description: 'Import patients from spreadsheet files',
    icon: FileSpreadsheet,
    color: 'orange',
    requiresAuth: false
  },
  {
    id: 'hl7',
    name: 'HL7 Message',
    type: 'file',
    supportedFormats: ['HL7'],
    description: 'Import patients from HL7 messages',
    icon: FileText,
    color: 'red',
    requiresAuth: false
  },
  {
    id: 'fhir',
    name: 'FHIR Bundle',
    type: 'file',
    supportedFormats: ['JSON', 'FHIR'],
    description: 'Import patients from FHIR bundles',
    icon: FileJson,
    color: 'indigo',
    requiresAuth: false
  },
  {
    id: 'athenahealth',
    name: 'athenahealth',
    type: 'ehr_system',
    supportedFormats: ['HL7', 'FHIR', 'API'],
    description: 'Import patients from athenahealth EHR',
    icon: Cloud,
    color: 'teal',
    requiresAuth: true
  },
  {
    id: 'practice_fusion',
    name: 'Practice Fusion',
    type: 'ehr_system',
    supportedFormats: ['HL7', 'FHIR', 'CSV'],
    description: 'Import patients from Practice Fusion',
    icon: Cloud,
    color: 'cyan',
    requiresAuth: true
  }
];

interface PatientImportProps {
  className?: string;
  onImportComplete?: (results: ImportResult) => void;
  onError?: (error: any) => void;
  enableMultiPlatform?: boolean;
  enableValidation?: boolean;
  enableDeduplication?: boolean;
  enableRealTimeProcessing?: boolean;
  enableConflictResolution?: boolean;
  enablePreviewMode?: boolean;
  enableBulkImport?: boolean;
  enableScheduledImport?: boolean;
  enableAPIIntegration?: boolean;
  enableVoiceCommands?: boolean;
}

interface ImportResult {
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  skippedRecords: number;
  duplicatesFound: number;
  conflictsResolved: number;
  processingTime: number;
  importedPatients: any[];
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface ImportError {
  recordId: string;
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion?: string;
}

interface ImportWarning {
  recordId: string;
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  suggestion?: string;
}

interface ImportJob {
  id: string;
  platform: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalRecords: number;
  processedRecords: number;
  startTime: Date;
  endTime?: Date;
  result?: ImportResult;
  error?: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  endpoint: string;
  apiKey?: string;
  username?: string;
  password?: string;
  enabled: boolean;
  lastSync?: Date;
  syncFrequency?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export function PatientImport({
  className,
  onImportComplete,
  onError,
  enableMultiPlatform = true,
  enableValidation = true,
  enableDeduplication = true,
  enableRealTimeProcessing = true,
  enableConflictResolution = true,
  enablePreviewMode = true,
  enableBulkImport = true,
  enableScheduledImport = false,
  enableAPIIntegration = true,
  enableVoiceCommands = false
}: PatientImportProps) {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [platformConfigs, setPlatformConfigs] = useState<PlatformConfig[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Initialize platform configurations
  const initializePlatformConfigs = useCallback(async () => {
    try {
      const configs = await loadPlatformConfigurations();
      setPlatformConfigs(configs);
    } catch (error) {
      console.error('Failed to load platform configurations:', error);
      toast({
        title: 'Configuration Error',
        description: 'Failed to load platform configurations.',
        variant: 'destructive'
      });
    }
  }, [toast]);

  // Handle platform selection
  const handlePlatformSelect = useCallback((platformId: string) => {
    setSelectedPlatform(platformId);
    const platform = SUPPORTED_PLATFORMS.find(p => p.id === platformId);
    
    if (platform?.requiresAuth) {
      // Check if platform is configured
      const config = platformConfigs.find(c => c.id === platformId);
      if (!config?.enabled) {
        toast({
          title: 'Platform Not Configured',
          description: `${platform.name} requires configuration before use.`,
          variant: 'destructive'
        });
        return;
      }
    }

    toast({
      title: 'Platform Selected',
      description: `Selected ${platform?.name} for import.`,
    });
  }, [platformConfigs, toast]);

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    setSelectedFile(file);
    
    try {
      // Validate file format
      const isValid = await validateFileFormat(file);
      if (!isValid) {
        throw new Error('Invalid file format');
      }

      // Parse file content
      const content = await parseFileContent(file);
      
      if (enablePreviewMode) {
        setPreviewData(content.slice(0, 10)); // Show first 10 records
        setShowPreview(true);
      }

      toast({
        title: 'File Uploaded',
        description: `Uploaded ${file.name} with ${content.length} records.`,
      });

    } catch (error) {
      console.error('File upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file.',
        variant: 'destructive'
      });
    }
  }, [enablePreviewMode, toast]);

  // Start import process
  const startImport = useCallback(async (platformId: string, options: any = {}) => {
    const platform = SUPPORTED_PLATFORMS.find(p => p.id === platformId);
    if (!platform) {
      toast({
        title: 'Invalid Platform',
        description: 'Selected platform is not supported.',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    
    const job: ImportJob = {
      id: `import_${Date.now()}`,
      platform: platformId,
      status: 'processing',
      progress: 0,
      totalRecords: 0,
      processedRecords: 0,
      startTime: new Date()
    };

    setCurrentJob(job);
    setImportJobs(prev => [...prev, job]);

    try {
      let result: ImportResult;

      switch (platform.type) {
        case 'ehr_system':
          result = await importFromEHR(platformId, options);
          break;
        case 'file':
          if (!selectedFile) {
            throw new Error('No file selected for import');
          }
          result = await importFromFile(selectedFile, options);
          break;
        default:
          throw new Error(`Unsupported platform type: ${platform.type}`);
      }

      // Update job with results
      const updatedJob: ImportJob = {
        ...job,
        status: 'completed',
        progress: 100,
        endTime: new Date(),
        result
      };

      setCurrentJob(updatedJob);
      setImportJobs(prev => prev.map(j => j.id === job.id ? updatedJob : j));

      onImportComplete?.(result);

      toast({
        title: 'Import Complete',
        description: `Successfully imported ${result.successfulImports} of ${result.totalRecords} patients.`,
      });

    } catch (error) {
      console.error('Import error:', error);
      
      const failedJob: ImportJob = {
        ...job,
        status: 'failed',
        endTime: new Date(),
        error: error instanceof Error ? error.message : 'Import failed'
      };

      setCurrentJob(failedJob);
      setImportJobs(prev => prev.map(j => j.id === job.id ? failedJob : j));

      onError?.(error);

      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Import process failed.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
      setCurrentJob(null);
    }
  }, [selectedFile, onImportComplete, onError, toast]);

  // Import from EHR system
  const importFromEHR = useCallback(async (platformId: string, options: any): Promise<ImportResult> => {
    const config = platformConfigs.find(c => c.id === platformId);
    if (!config?.enabled) {
      throw new Error(`${platformId} is not configured`);
    }

    try {
      const response = await fetch(`/api/patient-import/ehr/${platformId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          username: config.username,
          password: config.password,
          options: {
            enableValidation,
            enableDeduplication,
            enableConflictResolution,
            ...options
          }
        })
      });

      if (!response.ok) {
        throw new Error(`EHR import failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('EHR import error:', error);
      throw error;
    }
  }, [platformConfigs, enableValidation, enableDeduplication, enableConflictResolution]);

  // Import from file
  const importFromFile = useCallback(async (file: File, options: any): Promise<ImportResult> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('options', JSON.stringify({
        enableValidation,
        enableDeduplication,
        enablePreviewMode,
        enableBulkImport,
        ...options
      }));

      const response = await fetch('/api/patient-import/file', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`File import failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;

    } catch (error) {
      console.error('File import error:', error);
      throw error;
    }
  }, [enableValidation, enableDeduplication, enablePreviewMode, enableBulkImport]);

  // Helper functions
  const validateFileFormat = async (file: File): Promise<boolean> => {
    const validExtensions = ['.csv', '.xlsx', '.xls', '.json', '.hl7', '.txt'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    return validExtensions.includes(extension);
  };

  const parseFileContent = async (file: File): Promise<any[]> => {
    // Implementation would depend on file type
    // This is a placeholder for the actual parsing logic
    return [];
  };

  const loadPlatformConfigurations = async (): Promise<PlatformConfig[]> => {
    try {
      const response = await fetch('/api/patient-import/configurations');
      if (!response.ok) {
        throw new Error('Failed to load configurations');
      }
      const data = await response.json();
      return data.configurations;
    } catch (error) {
      // Return default configurations if API fails
      return SUPPORTED_PLATFORMS.map(platform => ({
        id: platform.id,
        name: platform.name,
        endpoint: '',
        enabled: false,
        syncFrequency: 'daily'
      }));
    }
  };

  // Initialize on mount
  useEffect(() => {
    initializePlatformConfigs();
  }, [initializePlatformConfigs]);

  // PLATFORM SELECTION STEP
  if (!selectedPlatform) {
    return (
      <div className={cn("container mx-auto p-4 max-w-6xl", className)}>
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
              <Database className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Patient Import System
            </CardTitle>
            <CardDescription className="text-base sm:text-lg">
              Import patients from multiple platforms and formats
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Supported Import Sources:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SUPPORTED_PLATFORMS.map((platform) => {
                  const Icon = platform.icon;
                  const config = platformConfigs.find(c => c.id === platform.id);
                  const isConfigured = config?.enabled || !platform.requiresAuth;
                  
                  return (
                    <div
                      key={platform.id}
                      className={cn(
                        "p-4 rounded-lg border cursor-pointer transition-all",
                        isConfigured 
                          ? "bg-white hover:bg-gray-50 border-gray-200 hover:border-blue-300" 
                          : "bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed"
                      )}
                      onClick={() => isConfigured && handlePlatformSelect(platform.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            `bg-${platform.color}-100`
                          )}>
                            <Icon className={cn("h-5 w-5", `text-${platform.color}-600`)} />
                          </div>
                          <div>
                            <h4 className="font-semibold">{platform.name}</h4>
                            <p className="text-xs text-muted-foreground">{platform.description}</p>
                          </div>
                        </div>
                        {!isConfigured && (
                          <Badge variant="secondary" className="text-xs">
                            Not Configured
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {platform.supportedFormats.map((format) => (
                            <Badge key={format} variant="outline" className="text-xs">
                              {format}
                            </Badge>
                          ))}
                        </div>
                        <Badge 
                          variant={platform.type === 'ehr_system' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {platform.type === 'ehr_system' ? 'EHR' : 'File'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowSettings(true)}
                className="touch-manipulation"
              >
                <Settings className="mr-2 h-4 w-4" />
                Configure Platforms
              </Button>
              <Button
                onClick={() => document.getElementById('file-upload')?.click()}
                className="touch-manipulation"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.xlsx,.xls,.json,.hl7,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                className="hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* Import Jobs */}
        {importJobs.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>Recent patient import operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-3 h-3 rounded-full",
                        job.status === 'completed' ? "bg-green-500" :
                        job.status === 'failed' ? "bg-red-500" :
                        job.status === 'processing' ? "bg-blue-500 animate-pulse" :
                        "bg-gray-400"
                      )} />
                      <div>
                        <div className="font-medium">{SUPPORTED_PLATFORMS.find(p => p.id === job.platform)?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {job.status === 'processing' ? 'Processing...' :
                           job.status === 'completed' ? `Completed: ${job.result?.successfulImports}/${job.result?.totalRecords} imported` :
                           job.status === 'failed' ? 'Failed' :
                           'Pending'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.status === 'processing' && job.progress > 0 && (
                        <div className="w-24">
                          <Progress value={job.progress} className="h-2" />
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {job.startTime.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // PLATFORM-SPECIFIC IMPORT
  if (selectedPlatform) {
    const platform = SUPPORTED_PLATFORMS.find(p => p.id === selectedPlatform);
    if (!platform) return null;

    return (
      <div className={cn("container mx-auto p-4 max-w-4xl", className)}>
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{platform.name} Import</CardTitle>
                <CardDescription>{platform.description}</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPlatform(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Platform-specific import interface */}
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Import Configuration</h4>
                <p className="text-sm text-blue-800">
                  Configure your import settings for {platform.name}
                </p>
              </div>

              {platform.type === 'ehr_system' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Endpoint URL</label>
                      <input
                        type="url"
                        placeholder="https://your-ehr-system.com/api"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">API Key</label>
                      <input
                        type="password"
                        placeholder="Your API key"
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="enable-validation" defaultChecked />
                      <label htmlFor="enable-validation" className="text-sm">Enable validation</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="enable-deduplication" defaultChecked />
                      <label htmlFor="enable-deduplication" className="text-sm">Enable deduplication</label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-sm text-gray-600 mb-2">Drop your file here or click to browse</p>
                    <p className="text-xs text-gray-500">Supported formats: {platform.supportedFormats.join(', ')}</p>
                    <input
                      type="file"
                      accept={platform.supportedFormats.map(format => `.${format.toLowerCase()}`).join(',')}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      className="hidden"
                      id="platform-file-upload"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('platform-file-upload')?.click()}
                      className="mt-4"
                    >
                      Choose File
                    </Button>
                  </div>

                  {selectedFile && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">{selectedFile.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFile(null)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setSelectedPlatform(null)}
                className="w-full sm:w-auto touch-manipulation"
              >
                Cancel
              </Button>
              <Button
                onClick={() => startImport(selectedPlatform)}
                disabled={isProcessing || (platform.type === 'file' && !selectedFile)}
                className="w-full sm:flex-1 touch-manipulation"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Start Import
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        {isProcessing && currentJob && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Processing Import</CardTitle>
              <CardDescription>Importing patients from {platform.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progress</span>
                  <span className="text-sm text-muted-foreground">{currentJob.processedRecords} / {currentJob.totalRecords || '...'}</span>
                </div>
                <Progress value={currentJob.progress} className="w-full" />
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Processing...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}

// Helper functions
async function validateFileFormat(file: File): Promise<boolean> {
  const validExtensions = ['.csv', '.xlsx', '.xls', '.json', '.hl7', '.txt'];
  const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  return validExtensions.includes(extension);
}

async function parseFileContent(file: File): Promise<any[]> {
  // Implementation would depend on file type
  // This is a placeholder for the actual parsing logic
  return [];
}

async function loadPlatformConfigurations(): Promise<PlatformConfig[]> {
  try {
    const response = await fetch('/api/patient-import/configurations');
    if (!response.ok) {
      throw new Error('Failed to load configurations');
    }
    const data = await response.json();
    return data.configurations;
  } catch (error) {
    // Return default configurations if API fails
    return SUPPORTED_PLATFORMS.map(platform => ({
      id: platform.id,
      name: platform.name,
      endpoint: '',
      enabled: false,
      syncFrequency: 'daily'
    }));
  }
}