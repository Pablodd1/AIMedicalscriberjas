import { log, logError } from './logger';

export interface PatientImportData {
  // Basic demographics
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  
  // Medical information
  allergies?: Array<{
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
  
  medications?: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    prescribedBy?: string;
    startDate?: string;
  }>;
  
  medicalHistory?: {
    conditions: string[];
    surgeries: Array<{
      procedure: string;
      date?: string;
      surgeon?: string;
    }>;
    familyHistory?: string[];
  };
  
  // Insurance information
  insurance?: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    subscriberId?: string;
    copay?: number;
  };
  
  // Emergency contact
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
    email?: string;
  };
  
  // Metadata
  source: string;
  importDate: string;
  externalId?: string;
  lastModified?: string;
}

export interface ImportResult {
  success: boolean;
  patientId?: number;
  errors: string[];
  warnings: string[];
  importedData: Partial<PatientImportData>;
}

export interface ExternalPlatform {
  name: string;
  type: 'emr' | 'crm' | 'insurance' | 'custom';
  authentication: {
    type: 'oauth' | 'api_key' | 'basic_auth' | 'none';
    requiredFields: string[];
  };
  supportedDataTypes: string[];
  rateLimit?: number;
  batchSize?: number;
}

// Known external platforms
export const SUPPORTED_PLATFORMS: ExternalPlatform[] = [
  {
    name: 'Epic MyChart',
    type: 'emr',
    authentication: { type: 'oauth', requiredFields: ['client_id', 'client_secret'] },
    supportedDataTypes: ['demographics', 'medical_history', 'medications', 'allergies'],
    rateLimit: 1000,
    batchSize: 50
  },
  {
    name: 'Cerner PowerChart',
    type: 'emr',
    authentication: { type: 'oauth', requiredFields: ['client_id', 'client_secret'] },
    supportedDataTypes: ['demographics', 'medical_history', 'medications', 'allergies'],
    rateLimit: 800,
    batchSize: 25
  },
  {
    name: 'Allscripts',
    type: 'emr',
    authentication: { type: 'api_key', requiredFields: ['api_key'] },
    supportedDataTypes: ['demographics', 'medical_history', 'medications'],
    rateLimit: 500,
    batchSize: 30
  },
  {
    name: 'Salesforce Health Cloud',
    type: 'crm',
    authentication: { type: 'oauth', requiredFields: ['client_id', 'client_secret'] },
    supportedDataTypes: ['demographics', 'contact_info', 'insurance'],
    rateLimit: 2000,
    batchSize: 100
  },
  {
    name: 'Athenahealth',
    type: 'emr',
    authentication: { type: 'oauth', requiredFields: ['client_id', 'client_secret'] },
    supportedDataTypes: ['demographics', 'medical_history', 'medications', 'insurance'],
    rateLimit: 1200,
    batchSize: 40
  },
  {
    name: 'Greenway Health',
    type: 'emr',
    authentication: { type: 'api_key', requiredFields: ['api_key'] },
    supportedDataTypes: ['demographics', 'medical_history', 'medications'],
    rateLimit: 600,
    batchSize: 20
  },
  {
    name: 'eClinicalWorks',
    type: 'emr',
    authentication: { type: 'api_key', requiredFields: ['api_key'] },
    supportedDataTypes: ['demographics', 'medical_history', 'medications', 'allergies'],
    rateLimit: 900,
    batchSize: 35
  },
  {
    name: 'CSV Upload',
    type: 'custom',
    authentication: { type: 'none', requiredFields: [] },
    supportedDataTypes: ['demographics', 'contact_info'],
    rateLimit: 10000,
    batchSize: 500
  }
];

export class PatientImportService {
  private importQueue: Map<string, any> = new Map();
  private processingLimit = 5; // Max concurrent imports
  private currentProcessing = 0;

  /**
   * Import patients from external platform
   */
  async importFromPlatform(
    platform: string,
    credentials: Record<string, string>,
    options: {
      batchSize?: number;
      filters?: Record<string, any>;
      since?: Date;
      until?: Date;
      dryRun?: boolean;
    } = {}
  ): Promise<{ importId: string; status: string; estimatedTime: number }> {
    try {
      log(`Starting patient import from ${platform}`);
      
      const platformConfig = SUPPORTED_PLATFORMS.find(p => p.name === platform);
      if (!platformConfig) {
        throw new Error(`Unsupported platform: ${platform}`);
      }

      // Validate credentials
      this.validateCredentials(platformConfig, credentials);

      const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add to processing queue
      this.importQueue.set(importId, {
        platform,
        credentials,
        options,
        status: 'queued',
        createdAt: new Date(),
        progress: 0
      });

      // Start processing if under limit
      if (this.currentProcessing < this.processingLimit) {
        this.processImport(importId);
      }

      return {
        importId,
        status: 'queued',
        estimatedTime: this.estimateImportTime(platformConfig, options)
      };
    } catch (error) {
      logError('Error starting patient import:', error);
      throw error;
    }
  }

  /**
   * Process individual import
   */
  private async processImport(importId: string): Promise<void> {
    this.currentProcessing++;
    const importJob = this.importQueue.get(importId);
    
    if (!importJob) {
      this.currentProcessing--;
      return;
    }

    try {
      importJob.status = 'processing';
      importJob.startedAt = new Date();

      log(`Processing import ${importId} from ${importJob.platform}`);

      // Get platform-specific importer
      const importer = this.getPlatformImporter(importJob.platform);
      
      // Fetch patients from external platform
      const patients = await importer.fetchPatients(importJob.credentials, importJob.options);
      
      importJob.totalPatients = patients.length;
      importJob.processedPatients = 0;
      importJob.successfulImports = 0;
      importJob.failedImports = 0;

      // Process patients in batches
      const batchSize = importJob.options.batchSize || 25;
      const batches = this.createBatches(patients, batchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Process batch
        const batchResults = await Promise.allSettled(
          batch.map(patient => this.importPatient(patient, importJob.options.dryRun))
        );

        // Update statistics
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success) {
            importJob.successfulImports++;
          } else {
            importJob.failedImports++;
            if (!importJob.errors) importJob.errors = [];
            importJob.errors.push({
              patient: batch[index],
              error: result.status === 'rejected' ? result.reason : result.value.errors[0]
            });
          }
        });

        importJob.processedPatients += batch.length;
        importJob.progress = Math.round((importJob.processedPatients / patients.length) * 100);

        // Rate limiting
        if (i < batches.length - 1) {
          await this.delay(this.getPlatformRateLimit(importJob.platform));
        }
      }

      importJob.status = 'completed';
      importJob.completedAt = new Date();
      
      log(`Import ${importId} completed: ${importJob.successfulImports} successful, ${importJob.failedImports} failed`);
    } catch (error) {
      logError(`Error processing import ${importId}:`, error);
      importJob.status = 'failed';
      importJob.error = error instanceof Error ? error.message : 'Unknown error';
      importJob.failedAt = new Date();
    } finally {
      this.currentProcessing--;
      
      // Process next import in queue
      this.processNextImport();
    }
  }

  /**
   * Import individual patient
   */
  private async importPatient(patientData: PatientImportData, dryRun = false): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      errors: [],
      warnings: [],
      importedData: {}
    };

    try {
      // Validate patient data
      const validation = this.validatePatientData(patientData);
      if (!validation.isValid) {
        result.errors.push(...validation.errors);
        return result;
      }

      // Check for duplicates
      const duplicateCheck = await this.checkForDuplicates(patientData);
      if (duplicateCheck.isDuplicate) {
        result.warnings.push(`Potential duplicate found: ${duplicateCheck.message}`);
      }

      if (dryRun) {
        result.success = true;
        result.importedData = patientData;
        return result;
      }

      // Create patient in database
      const patient = await this.createPatientInDatabase(patientData);
      
      result.success = true;
      result.patientId = patient.id;
      result.importedData = patientData;
      
      log(`Successfully imported patient: ${patientData.firstName} ${patientData.lastName}`);
    } catch (error) {
      logError('Error importing patient:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error during import');
    }

    return result;
  }

  /**
   * Get platform-specific importer
   */
  private getPlatformImporter(platform: string): any {
    switch (platform) {
      case 'Epic MyChart':
        return new EpicImporter();
      case 'Cerner PowerChart':
        return new CernerImporter();
      case 'Athenahealth':
        return new AthenaImporter();
      case 'CSV Upload':
        return new CSVImporter();
      default:
        throw new Error(`Importer not implemented for platform: ${platform}`);
    }
  }

  /**
   * Validate patient data
   */
  private validatePatientData(data: PatientImportData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!data.firstName?.trim()) errors.push('First name is required');
    if (!data.lastName?.trim()) errors.push('Last name is required');
    if (!data.dateOfBirth) errors.push('Date of birth is required');
    if (!data.gender) errors.push('Gender is required');

    // Validate date of birth
    if (data.dateOfBirth) {
      const dob = new Date(data.dateOfBirth);
      if (isNaN(dob.getTime())) {
        errors.push('Invalid date of birth format');
      } else {
        const age = this.calculateAge(dob);
        if (age < 0 || age > 150) errors.push('Invalid age calculated from date of birth');
      }
    }

    // Validate email if provided
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Invalid email format');
    }

    // Validate phone if provided
    if (data.phone && !this.isValidPhone(data.phone)) {
      errors.push('Invalid phone format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check for duplicate patients
   */
  private async checkForDuplicates(data: PatientImportData): Promise<{ isDuplicate: boolean; message: string }> {
    // This would typically query the database for existing patients
    // For now, return false (no duplicates)
    return {
      isDuplicate: false,
      message: ''
    };
  }

  /**
   * Create patient in database
   */
  private async createPatientInDatabase(data: PatientImportData): Promise<any> {
    // This would typically call the database storage layer
    // For now, return a mock patient object
    return {
      id: Math.floor(Math.random() * 1000000),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  // Helper methods
  private validateCredentials(platform: ExternalPlatform, credentials: Record<string, string>): void {
    const requiredFields = platform.authentication.requiredFields;
    const missingFields = requiredFields.filter(field => !credentials[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required credentials: ${missingFields.join(', ')}`);
    }
  }

  private estimateImportTime(platform: ExternalPlatform, options: any): number {
    const baseTime = 30; // 30 seconds base
    const batchTime = (options.batchSize || platform.batchSize) / platform.rateLimit * 60;
    return Math.max(baseTime, batchTime);
  }

  private getPlatformRateLimit(platform: string): number {
    const config = SUPPORTED_PLATFORMS.find(p => p.name === platform);
    return config?.rateLimit || 1000;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private processNextImport(): void {
    if (this.currentProcessing >= this.processingLimit) return;
    
    const nextImport = Array.from(this.importQueue.entries())
      .find(([_, job]) => job.status === 'queued');
    
    if (nextImport) {
      this.processImport(nextImport[0]);
    }
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\+\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  // Get import status
  getImportStatus(importId: string): any {
    return this.importQueue.get(importId);
  }

  // Get all active imports
  getActiveImports(): any[] {
    return Array.from(this.importQueue.entries())
      .map(([id, job]) => ({ id, ...job }))
      .filter(job => ['queued', 'processing'].includes(job.status));
  }

  // Cancel import
  cancelImport(importId: string): boolean {
    const importJob = this.importQueue.get(importId);
    if (importJob && importJob.status === 'queued') {
      importJob.status = 'cancelled';
      importJob.cancelledAt = new Date();
      return true;
    }
    return false;
  }
}

// Platform-specific importers (stubs for now)
class EpicImporter {
  async fetchPatients(credentials: Record<string, string>, options: any): Promise<PatientImportData[]> {
    // Implementation would integrate with Epic FHIR API
    log('Fetching patients from Epic MyChart');
    return []; // Placeholder
  }
}

class CernerImporter {
  async fetchPatients(credentials: Record<string, string>, options: any): Promise<PatientImportData[]> {
    // Implementation would integrate with Cerner PowerChart API
    log('Fetching patients from Cerner PowerChart');
    return []; // Placeholder
  }
}

class AthenaImporter {
  async fetchPatients(credentials: Record<string, string>, options: any): Promise<PatientImportData[]> {
    // Implementation would integrate with Athenahealth API
    log('Fetching patients from Athenahealth');
    return []; // Placeholder
  }
}

class CSVImporter {
  async fetchPatients(credentials: Record<string, string>, options: any): Promise<PatientImportData[]> {
    // Implementation would parse CSV files
    log('Parsing patients from CSV upload');
    return []; // Placeholder
  }
}