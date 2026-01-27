import { Router } from 'express';
import { requireAuth, asyncHandler, AppError, handleDatabaseOperation } from '../error-handler';
import { log, logError } from '../logger';
import multer from 'multer';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { Readable } from 'stream';

export const patientImportRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json',
      'text/plain'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

/**
 * Get supported import platforms and configurations
 * GET /api/patient-import/platforms
 */
patientImportRouter.get('/platforms', requireAuth, asyncHandler(async (req, res) => {
  const supportedPlatforms = [
    {
      id: 'epic',
      name: 'Epic EHR',
      type: 'ehr_system',
      supportedFormats: ['HL7', 'FHIR', 'CSV'],
      description: 'Import patients from Epic electronic health records',
      requiresAuth: true,
      configurable: true
    },
    {
      id: 'cerner',
      name: 'Cerner PowerChart',
      type: 'ehr_system',
      supportedFormats: ['HL7', 'FHIR', 'CSV'],
      description: 'Import patients from Cerner PowerChart system',
      requiresAuth: true,
      configurable: true
    },
    {
      id: 'allscripts',
      name: 'Allscripts',
      type: 'ehr_system',
      supportedFormats: ['HL7', 'FHIR', 'CSV'],
      description: 'Import patients from Allscripts EHR',
      requiresAuth: true,
      configurable: true
    },
    {
      id: 'athenahealth',
      name: 'athenahealth',
      type: 'ehr_system',
      supportedFormats: ['HL7', 'FHIR', 'API'],
      description: 'Import patients from athenahealth EHR',
      requiresAuth: true,
      configurable: true
    },
    {
      id: 'practice_fusion',
      name: 'Practice Fusion',
      type: 'ehr_system',
      supportedFormats: ['HL7', 'FHIR', 'CSV'],
      description: 'Import patients from Practice Fusion',
      requiresAuth: true,
      configurable: true
    },
    {
      id: 'csv',
      name: 'CSV/Excel File',
      type: 'file',
      supportedFormats: ['CSV', 'XLSX'],
      description: 'Import patients from spreadsheet files',
      requiresAuth: false,
      configurable: false
    },
    {
      id: 'hl7',
      name: 'HL7 Message',
      type: 'file',
      supportedFormats: ['HL7'],
      description: 'Import patients from HL7 messages',
      requiresAuth: false,
      configurable: false
    },
    {
      id: 'fhir',
      name: 'FHIR Bundle',
      type: 'file',
      supportedFormats: ['JSON', 'FHIR'],
      description: 'Import patients from FHIR bundles',
      requiresAuth: false,
      configurable: false
    }
  ];

  res.json({
    success: true,
    data: {
      platforms: supportedPlatforms,
      totalPlatforms: supportedPlatforms.length
    }
  });
}));

/**
 * Get platform configurations
 * GET /api/patient-import/configurations
 */
patientImportRouter.get('/configurations', requireAuth, asyncHandler(async (req, res) => {
  const userId = (req.user as any).id;

  try {
    const configurations = await handleDatabaseOperation(
      () => dbStorage.getPatientImportConfigurations(userId),
      'Failed to fetch platform configurations'
    );

    res.json({
      success: true,
      data: {
        configurations: configurations.length > 0 ? configurations : getDefaultConfigurations(),
        totalConfigurations: configurations.length
      }
    });

  } catch (error) {
    logError('Platform configurations error:', error);
    // Return default configurations if database fails
    res.json({
      success: true,
      data: {
        configurations: getDefaultConfigurations(),
        totalConfigurations: 0
      }
    });
  }
}));

/**
 * Update platform configuration
 * PUT /api/patient-import/configurations/:platformId
 */
patientImportRouter.put('/configurations/:platformId', requireAuth, asyncHandler(async (req, res) => {
  const platformId = req.params.platformId;
  const userId = (req.user as any).id;
  const { endpoint, apiKey, username, password, enabled, syncFrequency } = req.body;

  try {
    const updatedConfig = await handleDatabaseOperation(
      () => dbStorage.updatePatientImportConfiguration(userId, platformId, {
        endpoint,
        apiKey,
        username,
        password,
        enabled,
        syncFrequency,
        updatedAt: new Date()
      }),
      'Failed to update platform configuration'
    );

    res.json({
      success: true,
      data: updatedConfig
    });

    log(`Platform configuration updated for user ${userId}: ${platformId}`);

  } catch (error) {
    logError('Platform configuration update error:', error);
    throw new AppError('Failed to update platform configuration', 500, 'CONFIG_UPDATE_ERROR');
  }
}));

/**
 * Import patients from file
 * POST /api/patient-import/file
 */
patientImportRouter.post('/file', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  const userId = (req.user as any).id;
  const { 
    enableValidation = true, 
    enableDeduplication = true, 
    enablePreviewMode = true,
    enableBulkImport = true,
    maxRecords = 1000
  } = req.body;

  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'MISSING_FILE');
  }

  const startTime = Date.now();
  const file = req.file;
  const fileExtension = file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase();

  try {
    log(`Processing patient import file: ${file.originalname} (${file.size} bytes)`);

    // Parse file based on type
    let patients: any[] = [];
    
    switch (fileExtension) {
      case '.csv':
        patients = await parseCSVFile(file.buffer);
        break;
      case '.xlsx':
      case '.xls':
        patients = await parseExcelFile(file.buffer);
        break;
      case '.json':
        patients = await parseJSONFile(file.buffer);
        break;
      case '.txt':
        patients = await parseTextFile(file.buffer);
        break;
      default:
        throw new AppError(`Unsupported file type: ${fileExtension}`, 400, 'UNSUPPORTED_FILE_TYPE');
    }

    log(`Parsed ${patients.length} patient records from file`);

    // Limit records if needed
    if (patients.length > maxRecords) {
      patients = patients.slice(0, maxRecords);
      log(`Limited import to ${maxRecords} records`);
    }

    // Process patients through import pipeline
    const result = await processPatientImport(patients, {
      enableValidation,
      enableDeduplication,
      enablePreviewMode,
      enableBulkImport,
      userId
    });

    const processingTime = Date.now() - startTime;

    // Save import job to database
    await handleDatabaseOperation(
      () => dbStorage.savePatientImportJob({
        userId,
        platform: 'file',
        platformId: 'file',
        status: 'completed',
        totalRecords: result.totalRecords,
        successfulImports: result.successfulImports,
        failedImports: result.failedImports,
        processingTime,
        fileName: file.originalname,
        fileSize: file.size,
        importResults: result
      }),
      'Failed to save import job'
    );

    res.json({
      success: true,
      data: {
        ...result,
        processingTime,
        fileName: file.originalname,
        fileSize: file.size
      }
    });

    log(`File import completed for user ${userId}: ${result.successfulImports}/${result.totalRecords} patients imported`);

  } catch (error) {
    logError('File import error:', error);
    
    // Save failed import job
    await handleDatabaseOperation(
      () => dbStorage.savePatientImportJob({
        userId,
        platform: 'file',
        platformId: 'file',
        status: 'failed',
        totalRecords: 0,
        successfulImports: 0,
        failedImports: 0,
        processingTime: Date.now() - startTime,
        fileName: file.originalname,
        fileSize: file.size,
        error: error instanceof Error ? error.message : 'Import failed'
      }),
      'Failed to save failed import job'
    );

    throw new AppError(
      `File import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'FILE_IMPORT_FAILED'
    );
  }
}));

/**
 * Import patients from EHR system
 * POST /api/patient-import/ehr/:platformId
 */
patientImportRouter.post('/ehr/:platformId', requireAuth, asyncHandler(async (req, res) => {
  const platformId = req.params.platformId;
  const userId = (req.user as any).id;
  const { 
    endpoint, 
    apiKey, 
    username, 
    password,
    options = {}
  } = req.body;

  if (!endpoint) {
    throw new AppError('EHR endpoint is required', 400, 'MISSING_ENDPOINT');
  }

  const startTime = Date.now();

  try {
    log(`Starting EHR import for user ${userId}: ${platformId}`);

    // Get platform-specific configuration
    const platformConfig = getEHRPlatformConfig(platformId);
    
    // Authenticate with EHR system
    const authToken = await authenticateWithEHR(platformId, {
      endpoint,
      apiKey,
      username,
      password
    });

    // Fetch patients from EHR
    const patients = await fetchPatientsFromEHR(platformId, endpoint, authToken, options);

    log(`Fetched ${patients.length} patients from ${platformId}`);

    // Process patients through import pipeline
    const result = await processPatientImport(patients, {
      ...options,
      platform: 'ehr',
      platformId,
      userId
    });

    const processingTime = Date.now() - startTime;

    // Save import job to database
    await handleDatabaseOperation(
      () => dbStorage.savePatientImportJob({
        userId,
        platform: 'ehr',
        platformId,
        status: 'completed',
        totalRecords: result.totalRecords,
        successfulImports: result.successfulImports,
        failedImports: result.failedImports,
        processingTime,
        endpoint,
        importResults: result
      }),
      'Failed to save import job'
    );

    res.json({
      success: true,
      data: {
        ...result,
        processingTime,
        platform: platformId,
        endpoint
      }
    });

    log(`EHR import completed for user ${userId}: ${result.successfulImports}/${result.totalRecords} patients imported from ${platformId}`);

  } catch (error) {
    logError('EHR import error:', error);
    
    // Save failed import job
    await handleDatabaseOperation(
      () => dbStorage.savePatientImportJob({
        userId,
        platform: 'ehr',
        platformId,
        status: 'failed',
        totalRecords: 0,
        successfulImports: 0,
        failedImports: 0,
        processingTime: Date.now() - startTime,
        endpoint,
        error: error instanceof Error ? error.message : 'Import failed'
      }),
      'Failed to save failed import job'
    );

    throw new AppError(
      `EHR import failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'EHR_IMPORT_FAILED'
    );
  }
}));

/**
 * Get import job status
 * GET /api/patient-import/job/:jobId
 */
patientImportRouter.get('/job/:jobId', requireAuth, asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const userId = (req.user as any).id;

  try {
    const job = await handleDatabaseOperation(
      () => dbStorage.getPatientImportJob(jobId, userId),
      'Failed to fetch import job'
    );

    if (!job) {
      throw new AppError('Import job not found', 404, 'JOB_NOT_FOUND');
    }

    res.json({
      success: true,
      data: job
    });

  } catch (error) {
    logError('Import job retrieval error:', error);
    throw new AppError('Failed to retrieve import job', 500, 'JOB_RETRIEVAL_ERROR');
  }
}));

/**
 * Get import jobs for user
 * GET /api/patient-import/jobs
 */
patientImportRouter.get('/jobs', requireAuth, asyncHandler(async (req, res) => {
  const userId = (req.user as any).id;
  const { limit = 50, offset = 0, status } = req.query;

  try {
    const jobs = await handleDatabaseOperation(
      () => dbStorage.getPatientImportJobs(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        status: status as string
      }),
      'Failed to fetch import jobs'
    );

    res.json({
      success: true,
      data: {
        jobs,
        total: jobs.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    logError('Import jobs retrieval error:', error);
    throw new AppError('Failed to retrieve import jobs', 500, 'JOBS_RETRIEVAL_ERROR');
  }
}));

/**
 * Cancel import job
 * POST /api/patient-import/cancel/:jobId
 */
patientImportRouter.post('/cancel/:jobId', requireAuth, asyncHandler(async (req, res) => {
  const jobId = req.params.jobId;
  const userId = (req.user as any).id;

  try {
    const result = await handleDatabaseOperation(
      () => dbStorage.cancelPatientImportJob(jobId, userId),
      'Failed to cancel import job'
    );

    if (!result) {
      throw new AppError('Import job not found or cannot be cancelled', 404, 'JOB_NOT_FOUND');
    }

    res.json({
      success: true,
      message: 'Import job cancelled successfully'
    });

    log(`Import job cancelled for user ${userId}: ${jobId}`);

  } catch (error) {
    logError('Import job cancellation error:', error);
    throw new AppError('Failed to cancel import job', 500, 'JOB_CANCELLATION_ERROR');
  }
}));

/**
 * Validate import data
 * POST /api/patient-import/validate
 */
patientImportRouter.post('/validate', requireAuth, asyncHandler(async (req, res) => {
  const { patients, options = {} } = req.body;
  const userId = (req.user as any).id;

  if (!patients || !Array.isArray(patients)) {
    throw new AppError('Patients array is required', 400, 'MISSING_PATIENTS');
  }

  try {
    const validationResult = await validatePatientData(patients, options);

    res.json({
      success: true,
      data: validationResult
    });

    log(`Patient data validation completed for user ${userId}: ${patients.length} records`);

  } catch (error) {
    logError('Patient validation error:', error);
    throw new AppError('Failed to validate patient data', 500, 'VALIDATION_ERROR');
  }
}));

/**
 * Preview import data
 * POST /api/patient-import/preview
 */
patientImportRouter.post('/preview', requireAuth, asyncHandler(async (req, res) => {
  const { patients, options = {} } = req.body;
  const userId = (req.user as any).id;

  if (!patients || !Array.isArray(patients)) {
    throw new AppError('Patients array is required', 400, 'MISSING_PATIENTS');
  }

  try {
    const previewResult = await generateImportPreview(patients, options);

    res.json({
      success: true,
      data: previewResult
    });

    log(`Import preview generated for user ${userId}: ${patients.length} records`);

  } catch (error) {
    logError('Import preview error:', error);
    throw new AppError('Failed to generate import preview', 500, 'PREVIEW_ERROR');
  }
}));

// Helper functions

function getDefaultConfigurations(): any[] {
  return [
    {
      id: 'epic',
      name: 'Epic EHR',
      endpoint: '',
      enabled: false,
      syncFrequency: 'daily'
    },
    {
      id: 'cerner',
      name: 'Cerner PowerChart',
      endpoint: '',
      enabled: false,
      syncFrequency: 'daily'
    }
  ];
}

async function parseCSVFile(buffer: Buffer): Promise<any[]> {
  const results: any[] = [];
  const stream = Readable.from(buffer);
  
  return new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function parseExcelFile(buffer: Buffer): Promise<any[]> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

async function parseJSONFile(buffer: Buffer): Promise<any[]> {
  const content = buffer.toString('utf-8');
  return JSON.parse(content);
}

async function parseTextFile(buffer: Buffer): Promise<any[]> {
  const content = buffer.toString('utf-8');
  // Parse HL7 or other text formats
  if (content.startsWith('MSH')) {
    // HL7 parsing logic would go here
    return [];
  }
  return [];
}

async function processPatientImport(patients: any[], options: any): Promise<any> {
  const {
    enableValidation = true,
    enableDeduplication = true,
    enablePreviewMode = false,
    userId
  } = options;

  const startTime = Date.now();
  const results = {
    totalRecords: patients.length,
    successfulImports: 0,
    failedImports: 0,
    skippedRecords: 0,
    duplicatesFound: 0,
    conflictsResolved: 0,
    processingTime: 0,
    importedPatients: [] as any[],
    errors: [] as any[],
    warnings: [] as any[]
  };

  // Process each patient
  for (const patient of patients) {
    try {
      // Validate patient data
      if (enableValidation) {
        const validationResult = await validatePatientData([patient]);
        if (!validationResult.isValid) {
          results.failedImports++;
          results.errors.push({
            recordId: patient.id || 'unknown',
            message: 'Validation failed',
            errors: validationResult.errors
          });
          continue;
        }
      }

      // Check for duplicates
      if (enableDeduplication) {
        const isDuplicate = await checkForDuplicates(patient, userId);
        if (isDuplicate) {
          results.duplicatesFound++;
          results.skippedRecords++;
          results.warnings.push({
            recordId: patient.id || 'unknown',
            message: 'Duplicate patient found'
          });
          continue;
        }
      }

      // Import patient
      const importedPatient = await importPatient(patient, userId);
      if (importedPatient) {
        results.successfulImports++;
        results.importedPatients.push(importedPatient);
      } else {
        results.failedImports++;
      }

    } catch (error) {
      results.failedImports++;
      results.errors.push({
        recordId: patient.id || 'unknown',
        message: error instanceof Error ? error.message : 'Import failed'
      });
    }
  }

  results.processingTime = Date.now() - startTime;
  return results;
}

async function validatePatientData(patients: any[], options: any = {}): Promise<any> {
  const errors: any[] = [];
  const warnings: any[] = [];
  let isValid = true;

  for (const patient of patients) {
    // Required field validation
    const requiredFields = ['firstName', 'lastName', 'dateOfBirth'];
    for (const field of requiredFields) {
      if (!patient[field]) {
        isValid = false;
        errors.push({
          recordId: patient.id || 'unknown',
          field,
          message: `${field} is required`,
          severity: 'high'
        });
      }
    }

    // Date validation
    if (patient.dateOfBirth) {
      const dob = new Date(patient.dateOfBirth);
      if (isNaN(dob.getTime())) {
        warnings.push({
          recordId: patient.id || 'unknown',
          field: 'dateOfBirth',
          message: 'Invalid date format',
          severity: 'medium'
        });
      }
    }

    // Email validation
    if (patient.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patient.email)) {
      warnings.push({
        recordId: patient.id || 'unknown',
        field: 'email',
        message: 'Invalid email format',
        severity: 'low'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalRecords: patients.length
  };
}

async function checkForDuplicates(patient: any, userId: number): Promise<boolean> {
  // Check for existing patient with same name and DOB
  const existingPatient = await dbStorage.findPatientByNameAndDOB(
    userId,
    patient.firstName,
    patient.lastName,
    patient.dateOfBirth
  );
  
  return !!existingPatient;
}

async function importPatient(patient: any, userId: number): Promise<any> {
  try {
    // Create patient record
    const newPatient = await dbStorage.createPatient({
      ...patient,
      createdBy: userId,
      createdAt: new Date()
    });

    return newPatient;
  } catch (error) {
    logError('Patient import error:', error);
    return null;
  }
}

async function generateImportPreview(patients: any[], options: any): Promise<any> {
  const preview = {
    totalRecords: patients.length,
    sampleRecords: patients.slice(0, 5),
    fieldMapping: {},
    validationSummary: {},
    estimatedImportTime: patients.length * 0.5 // seconds per record
  };

  // Analyze field mapping
  if (patients.length > 0) {
    const sampleRecord = patients[0];
    const fields = Object.keys(sampleRecord);
    
    fields.forEach(field => {
      preview.fieldMapping[field] = {
        type: typeof sampleRecord[field],
        isRequired: ['firstName', 'lastName', 'dateOfBirth'].includes(field),
        hasData: patients.some(p => p[field])
      };
    });
  }

  // Generate validation summary
  const validationResult = await validatePatientData(patients);
  preview.validationSummary = {
    validRecords: validationResult.isValid ? patients.length : patients.length - validationResult.errors.length,
    invalidRecords: validationResult.errors.length,
    warningRecords: validationResult.warnings.length
  };

  return preview;
}

function getEHRPlatformConfig(platformId: string): any {
  const configs: Record<string, any> = {
    epic: {
      endpoint: '/api/FHIR/R4/',
      authType: 'oauth2',
      patientEndpoint: '/Patient'
    },
    cerner: {
      endpoint: '/fhir/R4/',
      authType: 'oauth2',
      patientEndpoint: '/Patient'
    },
    allscripts: {
      endpoint: '/api/patients',
      authType: 'basic',
      patientEndpoint: '/patients'
    }
  };
  
  return configs[platformId] || null;
}

async function authenticateWithEHR(platformId: string, credentials: any): Promise<string> {
  // Mock authentication - in real implementation, this would authenticate with the EHR system
  log(`Authenticating with ${platformId} EHR system`);
  
  // Simulate authentication delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return 'mock-auth-token';
}

async function fetchPatientsFromEHR(platformId: string, endpoint: string, authToken: string, options: any): Promise<any[]> {
  // Mock patient data fetch - in real implementation, this would fetch from EHR API
  log(`Fetching patients from ${platformId} EHR system`);
  
  // Simulate API call delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return mock patient data
  return generateMockPatients(50);
}

function generateMockPatients(count: number): any[] {
  const patients = [];
  const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'Robert', 'Lisa', 'James', 'Mary'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
  
  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const dob = new Date(1950 + Math.random() * 50, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1);
    
    patients.push({
      id: `patient_${i + 1}`,
      firstName,
      lastName,
      dateOfBirth: dob.toISOString().split('T')[0],
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
      phone: `555-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
      address: `${Math.floor(Math.random() * 9999) + 1} Main St, City, State 12345`
    });
  }
  
  return patients;
}