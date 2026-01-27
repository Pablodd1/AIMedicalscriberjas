import { Router } from 'express';
import multer from 'multer';
import { requireAuth, asyncHandler, AppError, handleDatabaseOperation } from '../error-handler';
import { log, logError } from '../logger';
import { storage as dbStorage } from '../storage';
import { PatientImportService, SUPPORTED_PLATFORMS, PatientImportData } from '../patient-import-service';

export const importRouter = Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

const importService = new PatientImportService();

/**
 * Get supported import platforms
 * GET /api/import/platforms
 */
importRouter.get('/platforms', requireAuth, asyncHandler(async (req, res) => {
  const platforms = SUPPORTED_PLATFORMS.map(platform => ({
    name: platform.name,
    type: platform.type,
    authentication: {
      type: platform.authentication.type,
      requiredFields: platform.authentication.requiredFields
    },
    supportedDataTypes: platform.supportedDataTypes,
    rateLimit: platform.rateLimit,
    batchSize: platform.batchSize
  }));

  res.json({
    success: true,
    platforms,
    total: platforms.length
  });
}));

/**
 * Start patient import from external platform
 * POST /api/import/start
 */
importRouter.post('/start', requireAuth, asyncHandler(async (req, res) => {
  const { platform, credentials, options = {} } = req.body;
  const userId = (req.user as any).id;

  if (!platform) {
    throw new AppError('Platform is required', 400, 'MISSING_PLATFORM');
  }

  if (!credentials || typeof credentials !== 'object') {
    throw new AppError('Credentials are required', 400, 'MISSING_CREDENTIALS');
  }

  // Validate platform
  const platformConfig = SUPPORTED_PLATFORMS.find(p => p.name === platform);
  if (!platformConfig) {
    throw new AppError(`Unsupported platform: ${platform}`, 400, 'UNSUPPORTED_PLATFORM');
  }

  // Log import attempt
  await handleDatabaseOperation(
    () => dbStorage.logImportAttempt(userId, platform, 'start', { options }),
    'Failed to log import attempt'
  );

  try {
    const result = await importService.importFromPlatform(platform, credentials, options);

    // Log successful start
    await handleDatabaseOperation(
      () => dbStorage.logImportAttempt(userId, platform, 'started', { 
        importId: result.importId,
        estimatedTime: result.estimatedTime
      }),
      'Failed to log import start'
    );

    res.json({
      success: true,
      importId: result.importId,
      status: result.status,
      estimatedTime: result.estimatedTime,
      message: `Patient import from ${platform} has been queued for processing`
    });

    log(`Started patient import from ${platform} for user ${userId}`);
  } catch (error) {
    logError(`Error starting import from ${platform}:`, error);
    throw new AppError(
      `Failed to start import: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'IMPORT_START_FAILED'
    );
  }
}));

/**
 * Get import status
 * GET /api/import/status/:importId
 */
importRouter.get('/status/:importId', requireAuth, asyncHandler(async (req, res) => {
  const { importId } = req.params;
  const userId = (req.user as any).id;

  if (!importId) {
    throw new AppError('Import ID is required', 400, 'MISSING_IMPORT_ID');
  }

  try {
    const importStatus = importService.getImportStatus(importId);
    
    if (!importStatus) {
      throw new AppError('Import not found', 404, 'IMPORT_NOT_FOUND');
    }

    res.json({
      success: true,
      import: {
        id: importId,
        status: importStatus.status,
        platform: importStatus.platform,
        createdAt: importStatus.createdAt,
        startedAt: importStatus.startedAt,
        completedAt: importStatus.completedAt,
        failedAt: importStatus.failedAt,
        progress: importStatus.progress,
        totalPatients: importStatus.totalPatients,
        processedPatients: importStatus.processedPatients,
        successfulImports: importStatus.successfulImports,
        failedImports: importStatus.failedImports,
        error: importStatus.error
      }
    });
  } catch (error) {
    logError('Error getting import status:', error);
    throw new AppError(
      `Failed to get import status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'STATUS_CHECK_FAILED'
    );
  }
}));

/**
 * Get active imports
 * GET /api/import/active
 */
importRouter.get('/active', requireAuth, asyncHandler(async (req, res) => {
  const userId = (req.user as any).id;

  try {
    const activeImports = importService.getActiveImports();
    
    res.json({
      success: true,
      imports: activeImports.map(imp => ({
        id: imp.id,
        status: imp.status,
        platform: imp.platform,
        createdAt: imp.createdAt,
        progress: imp.progress
      })),
      total: activeImports.length
    });
  } catch (error) {
    logError('Error getting active imports:', error);
    throw new AppError(
      `Failed to get active imports: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'ACTIVE_IMPORTS_FAILED'
    );
  }
}));

/**
 * Cancel import
 * POST /api/import/cancel
 */
importRouter.post('/cancel', requireAuth, asyncHandler(async (req, res) => {
  const { importId } = req.body;
  const userId = (req.user as any).id;

  if (!importId) {
    throw new AppError('Import ID is required', 400, 'MISSING_IMPORT_ID');
  }

  try {
    const cancelled = importService.cancelImport(importId);
    
    if (!cancelled) {
      throw new AppError('Import cannot be cancelled (may be processing or already completed)', 400, 'CANCEL_NOT_ALLOWED');
    }

    // Log cancellation
    await handleDatabaseOperation(
      () => dbStorage.logImportAttempt(userId, 'unknown', 'cancelled', { importId }),
      'Failed to log import cancellation'
    );

    res.json({
      success: true,
      message: 'Import has been cancelled successfully'
    });

    log(`Cancelled import ${importId} for user ${userId}`);
  } catch (error) {
    logError('Error cancelling import:', error);
    throw new AppError(
      `Failed to cancel import: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'CANCEL_FAILED'
    );
  }
}));

/**
 * Upload CSV file for patient import
 * POST /api/import/upload-csv
 */
importRouter.post('/upload-csv', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  const userId = (req.user as any).id;
  
  if (!req.file) {
    throw new AppError('CSV file is required', 400, 'MISSING_FILE');
  }

  try {
    const csvContent = req.file.buffer.toString('utf-8');
    const filename = req.file.originalname;

    // Parse CSV content
    const patients = await this.parseCSVContent(csvContent);
    
    // Validate data
    const validationResults = await this.validateCSVPatients(patients);
    
    if (validationResults.errors.length > 0) {
      return res.json({
        success: false,
        errors: validationResults.errors,
        warnings: validationResults.warnings,
        totalPatients: patients.length
      });
    }

    // Start import process
    const importResult = await importService.importFromPlatform('CSV Upload', {
      patients: validationResults.validPatients,
      filename
    }, {
      batchSize: 50,
      dryRun: false
    });

    // Log upload
    await handleDatabaseOperation(
      () => dbStorage.logImportAttempt(userId, 'CSV Upload', 'uploaded', { 
        filename,
        patientCount: validationResults.validPatients.length
      }),
      'Failed to log CSV upload'
    );

    res.json({
      success: true,
      importId: importResult.importId,
      status: importResult.status,
      message: `CSV file uploaded successfully. Processing ${validationResults.validPatients.length} patients...`,
      totalPatients: validationResults.validPatients.length
    });

    log(`Uploaded CSV file ${filename} with ${validationResults.validPatients.length} patients for user ${userId}`);
  } catch (error) {
    logError('Error processing CSV upload:', error);
    throw new AppError(
      `Failed to process CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'CSV_PROCESSING_FAILED'
    );
  }
}));

/**
 * Get import history
 * GET /api/import/history
 */
importRouter.get('/history', requireAuth, asyncHandler(async (req, res) => {
  const userId = (req.user as any).id;
  const { limit = 50, offset = 0, status, platform } = req.query;

  try {
    const imports = await handleDatabaseOperation(
      () => dbStorage.getImportHistory(userId, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        status: status as string,
        platform: platform as string
      }),
      'Failed to fetch import history'
    );

    res.json({
      success: true,
      imports: imports.map(imp => ({
        id: imp.id,
        platform: imp.platform,
        status: imp.status,
        createdAt: imp.createdAt,
        completedAt: imp.completedAt,
        totalPatients: imp.totalPatients,
        successfulImports: imp.successfulImports,
        failedImports: imp.failedImports,
        errors: imp.errors
      })),
      total: imports.length,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    logError('Error fetching import history:', error);
    throw new AppError(
      `Failed to fetch import history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'HISTORY_FETCH_FAILED'
    );
  }
}));

/**
 * Get import details
 * GET /api/import/details/:importId
 */
importRouter.get('/details/:importId', requireAuth, asyncHandler(async (req, res) => {
  const { importId } = req.params;
  const userId = (req.user as any).id;

  if (!importId) {
    throw new AppError('Import ID is required', 400, 'MISSING_IMPORT_ID');
  }

  try {
    const importDetails = await handleDatabaseOperation(
      () => dbStorage.getImportDetails(importId),
      'Failed to fetch import details'
    );

    if (!importDetails) {
      throw new AppError('Import not found', 404, 'IMPORT_NOT_FOUND');
    }

    res.json({
      success: true,
      import: {
        id: importDetails.id,
        platform: importDetails.platform,
        status: importDetails.status,
        createdAt: importDetails.createdAt,
        startedAt: importDetails.startedAt,
        completedAt: importDetails.completedAt,
        totalPatients: importDetails.totalPatients,
        successfulImports: importDetails.successfulImports,
        failedImports: importDetails.failedImports,
        errors: importDetails.errors,
        warnings: importDetails.warnings,
        importedPatients: importDetails.importedPatients
      }
    });
  } catch (error) {
    logError('Error fetching import details:', error);
    throw new AppError(
      `Failed to fetch import details: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'DETAILS_FETCH_FAILED'
    );
  }
}));

/**
 * Parse CSV content
 */
private async parseCSVContent(content: string): Promise<PatientImportData[]> {
  // Simple CSV parser - could be enhanced with a proper CSV library
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must have header and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const patients: PatientImportData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    
    if (values.length !== headers.length) {
      continue; // Skip malformed rows
    }

    const patientData: any = {
      source: 'CSV Upload',
      importDate: new Date().toISOString()
    };

    headers.forEach((header, index) => {
      const value = values[index] || '';
      
      switch (header.toLowerCase()) {
        case 'first_name':
        case 'firstname':
        case 'first name':
          patientData.firstName = value;
          break;
        case 'last_name':
        case 'lastname':
        case 'last name':
          patientData.lastName = value;
          break;
        case 'date_of_birth':
        case 'dob':
        case 'birthdate':
          patientData.dateOfBirth = value;
          break;
        case 'gender':
        case 'sex':
          patientData.gender = value.toLowerCase() as 'male' | 'female' | 'other';
          break;
        case 'email':
        case 'email_address':
          patientData.email = value;
          break;
        case 'phone':
        case 'phone_number':
        case 'telephone':
          patientData.phone = value;
          break;
        default:
          // Store additional fields
          if (!patientData.additionalFields) patientData.additionalFields = {};
          patientData.additionalFields[header] = value;
      }
    });

    patients.push(patientData as PatientImportData);
  }

  return patients;
}

/**
 * Validate CSV patients
 */
private async validateCSVPatients(patients: PatientImportData[]): Promise<{
  validPatients: PatientImportData[];
  errors: string[];
  warnings: string[];
}> {
  const validPatients: PatientImportData[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  patients.forEach((patient, index) => {
    const rowNumber = index + 2; // +2 because of header row and 0-based index
    
    // Validate required fields
    if (!patient.firstName) {
      errors.push(`Row ${rowNumber}: First name is required`);
    }
    if (!patient.lastName) {
      errors.push(`Row ${rowNumber}: Last name is required`);
    }
    if (!patient.dateOfBirth) {
      errors.push(`Row ${rowNumber}: Date of birth is required`);
    }
    if (!patient.gender) {
      errors.push(`Row ${rowNumber}: Gender is required`);
    }

    // Validate optional fields
    if (patient.email && !this.isValidEmail(patient.email)) {
      warnings.push(`Row ${rowNumber}: Invalid email format for ${patient.email}`);
    }
    if (patient.phone && !this.isValidPhone(patient.phone)) {
      warnings.push(`Row ${rowNumber}: Invalid phone format for ${patient.phone}`);
    }

    // Add to valid patients if no errors
    if (!errors.some(error => error.startsWith(`Row ${rowNumber}:`))) {
      validPatients.push(patient);
    }
  });

  return { validPatients, errors, warnings };
}

/**
 * Email validation
 */
private isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Phone validation
 */
private isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+\d\s\-\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}