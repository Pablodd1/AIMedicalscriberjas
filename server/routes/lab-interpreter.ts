import { Router } from 'express';
import { storage } from '../storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { z } from 'zod';
import xlsx from 'xlsx';
import { exec } from 'child_process';
import { promisify } from 'util';
// PDF parsing removed - using OpenAI Vision API for better accuracy
import { 
  requireAuth, 
  sendErrorResponse, 
  sendSuccessResponse, 
  asyncHandler,
  AppError,
  handleDatabaseOperation,
  handleOpenAIError
} from '../error-handler';

// Create router
export const labInterpreterRouter = Router();

// Promisify exec for async/await usage
const execAsync = promisify(exec);

// Function to convert PDF to images using ImageMagick
async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  try {
    // Create temporary directory for converted images
    const tempDir = path.join(path.dirname(pdfPath), 'temp_images');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Convert PDF to images using ImageMagick
    const outputPattern = path.join(tempDir, 'page-%d.png');
    const command = `convert -density 300 -quality 100 "${pdfPath}" "${outputPattern}"`;
    
    console.log('Converting PDF to images with command:', command);
    await execAsync(command);
    
    // Find all generated images
    const files = fs.readdirSync(tempDir)
      .filter(file => file.startsWith('page-') && file.endsWith('.png'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/page-(\d+)\.png/)?.[1] || '0');
        const bNum = parseInt(b.match(/page-(\d+)\.png/)?.[1] || '0');
        return aNum - bNum;
      })
      .map(file => path.join(tempDir, file));
    
    console.log(`PDF converted to ${files.length} images`);
    return files;
  } catch (error) {
    console.error('Error converting PDF to images:', error);
    throw new AppError('Failed to convert PDF to images. Please try converting to image format manually.', 500, 'PDF_CONVERSION_FAILED');
  }
}

// Function to clean up temporary image files
function cleanupTempImages(imagePaths: string[]) {
  imagePaths.forEach(imagePath => {
    try {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    } catch (error) {
      console.error('Error cleaning up temp image:', imagePath, error);
    }
  });
  
  // Also clean up the temp directory if it's empty
  if (imagePaths.length > 0) {
    const tempDir = path.dirname(imagePaths[0]);
    try {
      if (fs.existsSync(tempDir)) {
        const remainingFiles = fs.readdirSync(tempDir);
        if (remainingFiles.length === 0) {
          fs.rmdirSync(tempDir);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temp directory:', tempDir, error);
    }
  }
}

// Helper function to get OpenAI client for a user (same as in ai.ts)
async function getOpenAIClient(userId: number): Promise<OpenAI | null> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return null;

    // Check if user should use their own API key
    if (user.useOwnApiKey) {
      const userApiKey = await storage.getUserApiKey(userId);
      if (userApiKey) {
        return new OpenAI({
          apiKey: userApiKey,
        });
      } else {
        // User is set to use own API key but hasn't provided one
        return null;
      }
    } else {
      // User should use global API key
      const globalApiKey = await storage.getSystemSetting('global_openai_api_key');
      if (globalApiKey) {
        return new OpenAI({
          apiKey: globalApiKey,
        });
      }
      
      // Fallback to environment variable for backward compatibility
      if (process.env.OPENAI_API_KEY) {
        return new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting OpenAI client:', error);
    return null;
  }
}

// Configure multer for file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept Excel files, text files, and PDF/images
    if (file.fieldname === 'file' || file.fieldname === 'knowledgeBase') {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/octet-stream' ||
          file.mimetype === 'text/plain' ||
          file.originalname.endsWith('.xlsx') ||
          file.originalname.endsWith('.xls') ||
          file.originalname.endsWith('.txt') ||
          file.originalname.endsWith('.text')) {
        cb(null, true);
      } else {
        cb(null, true); // Allow all files for now to debug
      }
    } else if (file.fieldname === 'labReport') {
      if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only PDF files and images are allowed for lab reports'));
      }
    } else {
      cb(null, false);
    }
  }
});

// Helper function to parse Excel file for knowledge base import
function parseExcelFile(filePath: string) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    
    console.log("Excel Data headers:", Object.keys(data[0] || {}));
    
    // Detect file format
    const isDiseasesFormat = detectDiseasesReferenceFormat(data);
    
    if (isDiseasesFormat) {
      return parseDiseaseProductReference(data);
    } else {
      // Standard lab test format
      return parseStandardLabFormat(data);
    }
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Failed to parse Excel file');
  }
}

// Detect if the Excel format is a Disease-Product cross-reference
function detectDiseasesReferenceFormat(data: any[]) {
  if (!data.length) return false;
  const keys = Object.keys(data[0] || {});
  
  // Look for keywords common in disease-product reference files
  const isDiseaseFormat = keys.some(k => 
    /disease|condition|disorder|organ|system|product|supplement|peptide/i.test(k)
  );
  
  return isDiseaseFormat;
}

// Parse the Disease-Product reference format
function parseDiseaseProductReference(data: any[]) {
  console.log("Processing disease-product reference format");
  
  // Look at first row to understand the structure
  if (data.length > 0) {
    console.log("Sample row keys:", Object.keys(data[0]));
    console.log("Sample row values:", Object.values(data[0]));
  }

  return data.filter(row => {
    // Skip completely empty rows
    const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
    return values.length > 0;
  }).map((row: any) => {
    // Get all column keys from the row
    const keys = Object.keys(row);
    
    // Find organ system and disease columns
    let organSystemKey = '';
    let diseaseStateKey = '';
    
    // First try to find columns with exact expected names
    for (const key of keys) {
      const keyLower = key.toLowerCase();
      if (keyLower.includes('organ') && keyLower.includes('system')) {
        organSystemKey = key;
      } else if (keyLower.includes('disease') && keyLower.includes('state')) {
        diseaseStateKey = key;
      }
    }
    
    // If we didn't find the exact column names, look for similar ones
    if (!organSystemKey) {
      organSystemKey = keys.find(k => /organ|system|category/i.test(k)) || '';
    }
    
    if (!diseaseStateKey) {
      diseaseStateKey = keys.find(k => /disease|condition|state/i.test(k)) || '';
    }
    
    // If we still don't have keys, use the first columns
    if (!organSystemKey && keys.length > 0) organSystemKey = keys[0];
    if (!diseaseStateKey && keys.length > 1) diseaseStateKey = keys[1];
    
    // Extract values for organ system and disease state
    const organSystem = organSystemKey ? String(row[organSystemKey] || '').trim() : 'General';
    const diseaseState = diseaseStateKey ? String(row[diseaseStateKey] || '').trim() : '';
    
    // Collect all peptide data
    let allPeptides = '';
    for (const key of keys) {
      if (/peptide/i.test(key) && row[key]) {
        const peptideName = key.replace(/([A-Z])/g, ' $1').trim();
        allPeptides += `${peptideName}: ${String(row[key]).trim()}\n`;
      }
    }
    
    // Collect all formula data
    let allFormulas = '';
    for (const key of keys) {
      if (/formula/i.test(key) && row[key]) {
        const formulaName = key.replace(/([A-Z])/g, ' $1').trim();
        allFormulas += `${formulaName}: ${String(row[key]).trim()}\n`;
      }
    }
    
    // Build structured recommendations with all data
    let structuredRecommendations = '';
    
    if (allPeptides) {
      structuredRecommendations += "Peptides:\n" + allPeptides;
    }
    
    if (allFormulas) {
      structuredRecommendations += (structuredRecommendations ? "\n" : "") + "Formulas:\n" + allFormulas;
    }
    
    // Include any other columns we haven't specifically handled
    let otherData = '';
    for (const key of keys) {
      if (key !== organSystemKey && 
          key !== diseaseStateKey && 
          !(/peptide|formula/i.test(key)) && 
          row[key]) {
        const colName = key.replace(/([A-Z])/g, ' $1').trim();
        otherData += `${colName}: ${String(row[key]).trim()}\n`;
      }
    }
    
    if (otherData) {
      structuredRecommendations += (structuredRecommendations ? "\n" : "") + "Additional Data:\n" + otherData;
    }
    
    // Return in the format expected by our database schema
    return {
      test_name: organSystem || 'Organ System',
      marker: diseaseState || 'Disease/Condition',
      normal_range_low: null,
      normal_range_high: null,
      unit: '',
      interpretation: `Condition: ${diseaseState || 'Unknown'}`,
      recommendations: structuredRecommendations || 'No specific recommendations'
    };
  });
}

// Parse standard lab test format
function parseStandardLabFormat(data: any[]) {
  return data.filter(row => {
    // Skip completely empty rows
    const values = Object.values(row).filter(Boolean);
    return values.length > 0;
  }).map((row: any) => {
    // Create a valid object from the Excel data
    const keys = Object.keys(row);
    const testNameKey = keys.find(k => /test|name|test.*name/i.test(k)) || 'Test Name';
    const markerKey = keys.find(k => /marker|analyte|param/i.test(k)) || 'Marker';
    const minKey = keys.find(k => /low|min|lower|bottom/i.test(k)) || 'Min';
    const maxKey = keys.find(k => /high|max|upper|top/i.test(k)) || 'Max';
    const unitKey = keys.find(k => /unit/i.test(k)) || 'Unit';
    const interpretKey = keys.find(k => /interpret|desc|mean/i.test(k)) || 'Interpretation';
    const recKey = keys.find(k => /rec|advice|suggest/i.test(k)) || 'Recommendations';
    
    return {
      test_name: String(row[testNameKey] || '').trim(),
      marker: String(row[markerKey] || '').trim(),
      normal_range_low: parseFloat(String(row[minKey] || '0')) || null,
      normal_range_high: parseFloat(String(row[maxKey] || '0')) || null,
      unit: String(row[unitKey] || '').trim(),
      interpretation: String(row[interpretKey] || '').trim(),
      recommendations: String(row[recKey] || '').trim()
    };
  });
}

// Validate the lab knowledge base item
const labKnowledgeBaseItemSchema = z.object({
  test_name: z.string().min(1, 'Test name is required'),
  marker: z.string().min(1, 'Marker is required'),
  normal_range_low: z.number().nullable().optional(),
  normal_range_high: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  interpretation: z.string().min(1, 'Interpretation is required'),
  recommendations: z.string().nullable().optional()
});

// Get knowledge base data
labInterpreterRouter.get('/knowledge-base', requireAuth, asyncHandler(async (req, res) => {
  const items = await handleDatabaseOperation(
    () => storage.getLabKnowledgeBase(req.user.id),
    'Failed to fetch knowledge base'
  );
  sendSuccessResponse(res, items, 'Knowledge base fetched successfully');
}));

// Get specific knowledge base item
labInterpreterRouter.get('/knowledge-base/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    throw new AppError('Invalid ID', 400, 'INVALID_ID');
  }

  const item = await handleDatabaseOperation(
    () => storage.getLabKnowledgeBaseItem(id, req.user.id),
    'Failed to fetch knowledge base item'
  );
  
  if (!item) {
    throw new AppError('Item not found', 404, 'ITEM_NOT_FOUND');
  }
  
  sendSuccessResponse(res, item, 'Knowledge base item fetched successfully');
}));

// Create knowledge base item
labInterpreterRouter.post('/knowledge-base', requireAuth, asyncHandler(async (req, res) => {
  // Validate input and add userId
  const validatedData = labKnowledgeBaseItemSchema.parse({
    ...req.body,
    userId: req.user.id
  });
  
  const newItem = await handleDatabaseOperation(
    () => storage.createLabKnowledgeBaseItem(validatedData),
    'Failed to create knowledge base item'
  );
  
  sendSuccessResponse(res, newItem, 'Knowledge base item created successfully');
}));

// Update knowledge base item
labInterpreterRouter.put('/knowledge-base/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    throw new AppError('Invalid ID', 400, 'INVALID_ID');
  }

  // Validate input
  const validatedData = labKnowledgeBaseItemSchema.parse(req.body);
  
  // Update item (user-specific)
  const updatedItem = await handleDatabaseOperation(
    () => storage.updateLabKnowledgeBaseItem(id, validatedData, req.user.id),
    'Failed to update knowledge base item'
  );
  
  if (!updatedItem) {
    throw new AppError('Item not found or access denied', 404, 'ITEM_NOT_FOUND');
  }
  
  sendSuccessResponse(res, updatedItem, 'Knowledge base item updated successfully');
}));

// Delete knowledge base item
labInterpreterRouter.delete('/knowledge-base/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    throw new AppError('Invalid ID', 400, 'INVALID_ID');
  }

  const success = await handleDatabaseOperation(
    () => storage.deleteLabKnowledgeBaseItem(id, req.user.id),
    'Failed to delete knowledge base item'
  );
  
  if (!success) {
    throw new AppError('Item not found or access denied', 404, 'ITEM_NOT_FOUND');
  }
  
  sendSuccessResponse(res, null, 'Knowledge base item deleted successfully');
}));

// Delete all knowledge base items for current user
labInterpreterRouter.delete('/knowledge-base', requireAuth, asyncHandler(async (req, res) => {
  const deletedCount = await handleDatabaseOperation(
    () => storage.clearUserLabKnowledgeBase(req.user.id),
    'Failed to clear knowledge base'
  );
  
  sendSuccessResponse(res, { deletedCount }, 'Knowledge base cleared successfully');
}));

// Helper function to parse text format for knowledge base
function parseTextFormat(text: string): any[] {
  // Split the text by double newlines (paragraph breaks)
  const entries = text.split(/\n\s*\n/).filter(entry => entry.trim().length > 0);
  
  // If no clear entries are found, try a different approach for disease-product reference format
  if (entries.length === 0 || (entries.length === 1 && !entries[0].includes(':'))) {
    return parseFreeformDiseaseProductText(text);
  }
  
  return entries.map(entry => {
    const lines = entry.split('\n');
    const result: any = {
      test_name: 'Default Test',
      marker: 'Default Marker',
      normal_range_low: null,
      normal_range_high: null,
      unit: '',
      interpretation: 'See recommendations',
      recommendations: ''
    };
    
    // Check if this entry might be a disease-product reference
    const isDiseaseProductFormat = lines.some(line => 
      /disease|condition|organ|system|product|supplement|peptide/i.test(line)
    );
    
    if (isDiseaseProductFormat) {
      let disease = '';
      let product = '';
      let organ = '';
      
      for (const line of lines) {
        if (/disease|condition/i.test(line)) {
          const parts = line.split(':');
          if (parts.length > 1) disease = parts[1].trim();
          else disease = line.trim();
        } else if (/product|supplement|peptide/i.test(line)) {
          const parts = line.split(':');
          if (parts.length > 1) product = parts[1].trim();
          else product = line.trim();
        } else if (/organ|system/i.test(line)) {
          const parts = line.split(':');
          if (parts.length > 1) organ = parts[1].trim();
          else organ = line.trim();
        }
      }
      
      result.test_name = organ || 'Organ System';
      result.marker = disease || 'Disease/Condition';
      result.interpretation = disease ? `Condition: ${disease}` : 'See recommendations';
      result.recommendations = product || '';
      
      return result;
    }
    
    // Standard lab test format processing
    for (const line of lines) {
      const parts = line.split(':');
      const key = parts[0] ? parts[0].trim() : '';
      const value = parts.length > 1 ? parts.slice(1).join(':').trim() : line.trim();
      
      if (!value) continue;
      
      if (/test|name/i.test(key)) {
        result.test_name = value;
      } else if (/marker|analyte|parameter/i.test(key)) {
        result.marker = value;
      } else if (/range|normal/i.test(key)) {
        // Try to parse range values
        const rangeMatch = value.match(/([\d\.]+)\s*-\s*([\d\.]+)\s*(\w+)?/);
        if (rangeMatch) {
          result.normal_range_low = parseFloat(rangeMatch[1]);
          result.normal_range_high = parseFloat(rangeMatch[2]);
          if (rangeMatch[3]) {
            result.unit = rangeMatch[3];
          }
        }
      } else if (/unit/i.test(key)) {
        result.unit = value;
      } else if (/interpret|desc|meaning/i.test(key)) {
        result.interpretation = value;
      } else if (/recommend|advice|suggest/i.test(key)) {
        result.recommendations = value;
      } else if (/min|low/i.test(key)) {
        result.normal_range_low = parseFloat(value);
      } else if (/max|high/i.test(key)) {
        result.normal_range_high = parseFloat(value);
      } else if (/disease|condition/i.test(key)) {
        result.marker = value;
        if (!result.interpretation || result.interpretation === 'See recommendations') {
          result.interpretation = `Condition: ${value}`;
        }
      } else if (/product|supplement|peptide/i.test(key)) {
        result.recommendations = value;
      } else if (/organ|system/i.test(key)) {
        result.test_name = value;
      }
    }
    
    return result;
  });
}

// Parse free-form text that might contain disease-product information
function parseFreeformDiseaseProductText(text: string): any[] {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const results: any[] = [];
  
  // Try to identify different sections or items
  let currentDisease = '';
  let currentOrgan = 'General';
  let currentProduct = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Try to identify if this line is a disease/condition, organ system, or product
    if (/^[A-Z][a-zA-Z\s]+:/.test(line) || /^[A-Z][a-zA-Z\s]+$/.test(line)) {
      // This looks like a header - disease, organ, etc.
      if (currentDisease && (currentProduct || i === lines.length - 1)) {
        // Save the previous entry before starting a new one
        results.push({
          test_name: currentOrgan || 'Organ System',
          marker: currentDisease || 'Disease',
          normal_range_low: null,
          normal_range_high: null,
          unit: '',
          interpretation: currentDisease ? `Condition: ${currentDisease}` : 'See recommendations',
          recommendations: currentProduct || ''
        });
        
        // Reset for new entry
        currentProduct = '';
      }
      
      // Determine what type of header this is
      if (/system|organ|category/i.test(line)) {
        currentOrgan = line.replace(/:/g, '').trim();
      } else {
        currentDisease = line.replace(/:/g, '').trim();
      }
    } else if (currentDisease && !/^[A-Z][a-zA-Z\s]+:/.test(line)) {
      // This is likely a product/recommendation
      currentProduct += (currentProduct ? ', ' : '') + line;
    }
  }
  
  // Add the last entry
  if (currentDisease || currentProduct) {
    results.push({
      test_name: currentOrgan || 'Organ System',
      marker: currentDisease || 'Disease',
      normal_range_low: null,
      normal_range_high: null,
      unit: '',
      interpretation: currentDisease ? `Condition: ${currentDisease}` : 'See recommendations',
      recommendations: currentProduct || ''
    });
  }
  
  return results.length > 0 ? results : [{
    test_name: 'Default Category',
    marker: 'Default Disease',
    normal_range_low: null,
    normal_range_high: null,
    unit: '',
    interpretation: 'Imported from text',
    recommendations: text.trim().substring(0, 200) + (text.length > 200 ? '...' : '')
  }];
}

// Import knowledge base - supports multiple formats
labInterpreterRouter.post('/knowledge-base/import', requireAuth, upload.single('file'), asyncHandler(async (req, res) => {
  let data: any[] = [];
  const importType = req.body.importType || 'excel';
    
    if (importType === 'excel') {
      // Excel file import
      if (!req.file) {
        throw new AppError('No Excel file uploaded', 400, 'NO_FILE_UPLOADED');
      }
      
      // Check if it's an Excel file
      if (!req.file.originalname.match(/\.(xlsx|xls)$/i)) {
        throw new AppError('Uploaded file is not an Excel file', 400, 'INVALID_FILE_TYPE');
      }
      
      data = parseExcelFile(req.file.path);
      
      // Clean up uploaded file when done
      fs.unlinkSync(req.file.path);
    } 
    else if (importType === 'text') {
      // Text file import
      if (!req.file) {
        throw new AppError('No text file uploaded', 400, 'NO_FILE_UPLOADED');
      }
      
      try {
        // Read the text file with better error handling
        console.log("Reading text file:", req.file.path);
        const textContent = fs.readFileSync(req.file.path, 'utf-8');
        console.log("Text file content sample:", textContent.substring(0, 100));
        
        // Parse the text content
        data = parseTextFormat(textContent);
        console.log(`Parsed ${data.length} entries from text file`);
        
        // Clean up uploaded file when done
        fs.unlinkSync(req.file.path);
      } catch (fileError) {
        console.error('Error processing text file:', fileError);
        return res.status(400).json({ 
          error: 'Failed to process text file', 
          details: fileError.message 
        });
      }
    }
    else if (importType === 'paste') {
      // Text content directly pasted
      if (!req.body.textContent) {
        throw new AppError('No text content provided', 400, 'NO_TEXT_CONTENT');
      }
      
      data = parseTextFormat(req.body.textContent);
    }
    else {
      throw new AppError('Invalid import type', 400, 'INVALID_IMPORT_TYPE');
    }
    
    // Validate and clean data
    const validatedData = data.map(item => {
      try {
        return labKnowledgeBaseItemSchema.parse(item);
      } catch (error) {
        console.warn('Skipping invalid item:', item, error);
        return null;
      }
    }).filter(Boolean);
    
  if (validatedData.length === 0) {
    throw new AppError('No valid data found in the imported content', 400, 'NO_VALID_DATA');
  }
    
  // Import data with user ID
  const itemsImported = await handleDatabaseOperation(
    () => storage.importLabKnowledgeBase(validatedData, req.user.id),
    'Failed to import knowledge base'
  );
  
  sendSuccessResponse(res, { itemsImported }, 'Knowledge base imported successfully');
}));

// Get lab interpreter settings
labInterpreterRouter.get('/settings', async (req, res) => {
  try {
    const settings = await storage.getLabInterpreterSettings();
    if (!settings) {
      // Return default settings if none are found
      return res.json({
        system_prompt: 'Role: Functional Medicine AI for Blood Panel Analysis & Health Optimization\nYou are an AI-based Functional Medicine Specialist with expertise in analyzing blood panels to identify deficiencies, imbalances, and potential dysfunctions in organ systems. Your goal is to provide actionable health insights, supplement & peptide recommendations, and lifestyle interventions to optimize patient well-being.',
        with_patient_prompt: 'Analyze this blood panel report for ${patientName} (ID: ${patientId}). Use ONLY the knowledge base I provided for your analysis - do not use any other reference sources. Follow these structured steps:\n\n1. EXTRACT & ANALYZE BLOOD BIOMARKERS:\n- Identify each biomarker in the report\n- Compare patient values to optimal functional ranges in the knowledge base\n- Mark all out-of-range values and specify if they are high or low\n- Identify specific nutrient deficiencies, excesses, or metabolic imbalances\n\n2. CORRELATE WITH DISEASE STATES & ORGAN SYSTEMS:\n- Match abnormal findings with potential disease states from the knowledge base\n- Determine which organ systems are affected (liver, kidney, immune, etc.)\n- Identify patterns that suggest specific dysfunctions (e.g., detoxification issues, inflammation)\n- Connect related biomarkers to show systemic impacts\n\n3. MATCH WITH SUPPLEMENTS & PEPTIDES:\n- Recommend specific peptides that address the root causes (list Primary and Secondary)\n- Suggest specific supplement formulas from the knowledge base\n- Indicate dosages when provided in the knowledge base\n- Explain the mechanism of action for each recommendation\n\n4. STRUCTURED REPORT:\n- Create a clear, organized blood panel summary table\n- List each peptide and supplement with detailed rationale\n- Suggest dietary modifications specific to findings\n- Include lifestyle changes that would address identified issues\n- Propose timing and follow-up testing recommendations\n\nFormat your response using headings, bullet points, and tables where appropriate for maximum clarity.',
        without_patient_prompt: 'Analyze this blood panel report. Use ONLY the knowledge base I provided for your analysis - do not use any other reference sources. Follow these structured steps:\n\n1. EXTRACT & ANALYZE BLOOD BIOMARKERS:\n- Identify each biomarker in the report\n- Compare values to optimal functional ranges in the knowledge base\n- Mark all out-of-range values and specify if they are high or low\n- Identify specific nutrient deficiencies, excesses, or metabolic imbalances\n\n2. CORRELATE WITH DISEASE STATES & ORGAN SYSTEMS:\n- Match abnormal findings with potential disease states from the knowledge base\n- Determine which organ systems are affected (liver, kidney, immune, etc.)\n- Identify patterns that suggest specific dysfunctions (e.g., detoxification issues, inflammation)\n- Connect related biomarkers to show systemic impacts\n\n3. MATCH WITH SUPPLEMENTS & PEPTIDES:\n- Recommend specific peptides that address the root causes (list Primary and Secondary)\n- Suggest specific supplement formulas from the knowledge base\n- Indicate dosages when provided in the knowledge base\n- Explain the mechanism of action for each recommendation\n\n4. STRUCTURED REPORT:\n- Create a clear, organized blood panel summary table\n- List each peptide and supplement with detailed rationale\n- Suggest dietary modifications specific to findings\n- Include lifestyle changes that would address identified issues\n- Propose timing and follow-up testing recommendations\n\nFormat your response using headings, bullet points, and tables where appropriate for maximum clarity.',
        // Add client-side field names for compatibility
        systemPrompt: 'Role: Functional Medicine AI for Blood Panel Analysis & Health Optimization\nYou are an AI-based Functional Medicine Specialist with expertise in analyzing blood panels to identify deficiencies, imbalances, and potential dysfunctions in organ systems. Your goal is to provide actionable health insights, supplement & peptide recommendations, and lifestyle interventions to optimize patient well-being.',
        withPatientPrompt: 'Analyze this blood panel report for ${patientName} (ID: ${patientId}). Use ONLY the knowledge base I provided for your analysis - do not use any other reference sources. Follow these structured steps:\n\n1. EXTRACT & ANALYZE BLOOD BIOMARKERS:\n- Identify each biomarker in the report\n- Compare patient values to optimal functional ranges in the knowledge base\n- Mark all out-of-range values and specify if they are high or low\n- Identify specific nutrient deficiencies, excesses, or metabolic imbalances\n\n2. CORRELATE WITH DISEASE STATES & ORGAN SYSTEMS:\n- Match abnormal findings with potential disease states from the knowledge base\n- Determine which organ systems are affected (liver, kidney, immune, etc.)\n- Identify patterns that suggest specific dysfunctions (e.g., detoxification issues, inflammation)\n- Connect related biomarkers to show systemic impacts\n\n3. MATCH WITH SUPPLEMENTS & PEPTIDES:\n- Recommend specific peptides that address the root causes (list Primary and Secondary)\n- Suggest specific supplement formulas from the knowledge base\n- Indicate dosages when provided in the knowledge base\n- Explain the mechanism of action for each recommendation\n\n4. STRUCTURED REPORT:\n- Create a clear, organized blood panel summary table\n- List each peptide and supplement with detailed rationale\n- Suggest dietary modifications specific to findings\n- Include lifestyle changes that would address identified issues\n- Propose timing and follow-up testing recommendations\n\nFormat your response using headings, bullet points, and tables where appropriate for maximum clarity.',
        withoutPatientPrompt: 'Analyze this blood panel report. Use ONLY the knowledge base I provided for your analysis - do not use any other reference sources. Follow these structured steps:\n\n1. EXTRACT & ANALYZE BLOOD BIOMARKERS:\n- Identify each biomarker in the report\n- Compare values to optimal functional ranges in the knowledge base\n- Mark all out-of-range values and specify if they are high or low\n- Identify specific nutrient deficiencies, excesses, or metabolic imbalances\n\n2. CORRELATE WITH DISEASE STATES & ORGAN SYSTEMS:\n- Match abnormal findings with potential disease states from the knowledge base\n- Determine which organ systems are affected (liver, kidney, immune, etc.)\n- Identify patterns that suggest specific dysfunctions (e.g., detoxification issues, inflammation)\n- Connect related biomarkers to show systemic impacts\n\n3. MATCH WITH SUPPLEMENTS & PEPTIDES:\n- Recommend specific peptides that address the root causes (list Primary and Secondary)\n- Suggest specific supplement formulas from the knowledge base\n- Indicate dosages when provided in the knowledge base\n- Explain the mechanism of action for each recommendation\n\n4. STRUCTURED REPORT:\n- Create a clear, organized blood panel summary table\n- List each peptide and supplement with detailed rationale\n- Suggest dietary modifications specific to findings\n- Include lifestyle changes that would address identified issues\n- Propose timing and follow-up testing recommendations\n\nFormat your response using headings, bullet points, and tables where appropriate for maximum clarity.'
      });
    }
    
    // Add client-side field names to make it compatible with the frontend
    const response = {
      ...settings,
      systemPrompt: settings.system_prompt,
      withPatientPrompt: settings.with_patient_prompt,
      withoutPatientPrompt: settings.without_patient_prompt
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error fetching lab interpreter settings:', error);
    return res.status(500).json({ error: 'Failed to fetch lab interpreter settings' });
  }
});

// Save lab interpreter settings
labInterpreterRouter.post('/settings', async (req, res) => {
  try {
    const { systemPrompt, withPatientPrompt, withoutPatientPrompt } = req.body;
    
    if (!systemPrompt || !withPatientPrompt || !withoutPatientPrompt) {
      return res.status(400).json({ error: 'All prompts are required' });
    }
    
    const settings = await storage.saveLabInterpreterSettings({
      system_prompt: systemPrompt,
      with_patient_prompt: withPatientPrompt,
      without_patient_prompt: withoutPatientPrompt
    });
    
    // Add client-side field names to make it compatible with the frontend
    const response = {
      ...settings,
      systemPrompt: settings.system_prompt,
      withPatientPrompt: settings.with_patient_prompt,
      withoutPatientPrompt: settings.without_patient_prompt
    };
    
    return res.json(response);
  } catch (error) {
    console.error('Error saving lab interpreter settings:', error);
    return res.status(500).json({ error: 'Failed to save lab interpreter settings' });
  }
});

// Analyze lab report text
labInterpreterRouter.post('/analyze', requireAuth, asyncHandler(async (req, res) => {
  const { reportText, patientId, withPatient } = req.body;
  
  if (!reportText) {
    throw new AppError('Report text is required', 400, 'REPORT_TEXT_MISSING');
  }
  
  // Get OpenAI client for this user
  const openai = await getOpenAIClient(req.user.id);
  if (!openai) {
    const user = await handleDatabaseOperation(
      () => storage.getUser(req.user.id),
      'Failed to fetch user data'
    );
    
    const errorMessage = user?.useOwnApiKey 
      ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
      : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';
    
    throw new AppError(errorMessage, 503, 'NO_API_KEY');
  }
    
  // Get settings and knowledge base
  const settings = await handleDatabaseOperation(
    () => storage.getLabInterpreterSettings(),
    'Failed to get lab interpreter settings'
  );
  const knowledgeBase = await handleDatabaseOperation(
    () => storage.getLabKnowledgeBase(req.user.id),
    'Failed to get knowledge base'
  );
  
  // Default prompts if settings not found
  const systemPrompt = settings?.system_prompt || settings?.systemPrompt || 'You are a medical lab report interpreter. Your task is to analyze lab test results and provide insights based on medical knowledge and the provided reference ranges. Be factual and evidence-based in your analysis.';
  let userPrompt = settings?.without_patient_prompt || settings?.withoutPatientPrompt || 'Analyze this lab report. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
  
  console.log('Using prompts for analysis:');
  console.log('System Prompt:', systemPrompt.substring(0, 100) + '...');
  console.log('User Prompt:', userPrompt.substring(0, 100) + '...');
  
  let patient = null;
  if (withPatient && patientId) {
    // Get patient info if needed
    patient = await handleDatabaseOperation(
      () => storage.getPatient(patientId),
      'Failed to get patient information'
    );
    if (patient) {
      userPrompt = settings?.with_patient_prompt || settings?.withPatientPrompt || 'Analyze this lab report for the patient. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
      // Replace placeholders with actual patient info
      userPrompt = userPrompt
        .replace('${patientName}', `${patient.firstName} ${patient.lastName}`)
        .replace('${patientId}', patient.id.toString());
      console.log('Using patient-specific prompt for:', `${patient.firstName} ${patient.lastName}`);
    }
  }
    
  // Prepare knowledge base for prompt
  const knowledgeBaseText = knowledgeBase.map(item => 
    `Test: ${item.test_name}\nMarker: ${item.marker}\nNormal Range: ${item.normal_range_low || ''} - ${item.normal_range_high || ''} ${item.unit || ''}\nInterpretation: ${item.interpretation}\nRecommendations: ${item.recommendations || ''}`
  ).join('\n\n');
  
  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  let analysis = '';
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Here is my knowledge base of lab test reference values and interpretations:\n\n${knowledgeBaseText}\n\nNow, ${userPrompt}\n\nLab Report:\n${reportText}\n\nPlease provide your analysis as a JSON object with the following structure: { "summary": "brief overview", "abnormalValues": [], "interpretation": "detailed explanation", "recommendations": [] }`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });
    
    analysis = response.choices[0].message.content || '';
  } catch (error) {
    throw handleOpenAIError(error);
  }
  
  // Save to database if patient is selected
  if (withPatient && patientId && patient) {
    await handleDatabaseOperation(
      () => storage.createLabReport({
        patientId,
        doctorId: req.user.id,
        reportData: reportText,
        reportType: 'text',
        title: `Lab Report Analysis - ${patient.firstName} ${patient.lastName}`,
        analysis: analysis
      }),
      'Failed to save lab report to database'
    );
  }
  
  sendSuccessResponse(res, { analysis }, 'Lab report analyzed successfully');
}));

// Upload and analyze lab report file
labInterpreterRouter.post('/analyze/upload', requireAuth, upload.single('labReport'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED');
  }
  
  const { patientId, withPatient } = req.body;
  
  // Get OpenAI client for this user
  const openai = await getOpenAIClient(req.user.id);
  if (!openai) {
    // Clean up the uploaded file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    const user = await handleDatabaseOperation(
      () => storage.getUser(req.user.id),
      'Failed to fetch user data'
    );
    
    console.log('OpenAI client creation failed for user:', req.user.id, 'useOwnApiKey:', user?.useOwnApiKey);
    
    const errorMessage = user?.useOwnApiKey 
      ? 'No personal OpenAI API key found. Please add your OpenAI API key in Settings to use AI features.'
      : 'No global OpenAI API key configured. Please contact your administrator or add your own API key in Settings.';
    
    throw new AppError(errorMessage, 503, 'NO_API_KEY');
  }
  
  console.log('OpenAI client created successfully for user:', req.user.id);

  let extractedText = '';
  let analysis = '';
  let convertedImages: string[] = [];

  try {
    
    // Extract text from file using OpenAI Vision API for all supported formats
    let imagesToProcess: string[] = [];
    
    if (req.file.mimetype === 'application/pdf') {
      // Convert PDF to images first
      console.log('Converting PDF to images...');
      convertedImages = await convertPdfToImages(req.file.path);
      imagesToProcess = convertedImages;
    } else if (req.file.mimetype.startsWith('image/')) {
      // Use the uploaded image directly
      imagesToProcess = [req.file.path];
    } else {
      throw new AppError('Unsupported file type. Please upload a PDF or image file.', 400, 'UNSUPPORTED_FILE_TYPE');
    }
    
    // Process all images with OpenAI Vision API
    const extractedTexts: string[] = [];
    
    for (let i = 0; i < imagesToProcess.length; i++) {
      const imagePath = imagesToProcess[i];
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      console.log(`Processing image ${i + 1}/${imagesToProcess.length}: ${path.basename(imagePath)}`);
      
      try {
        const textExtractionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: "text",
                  text: `Extract all the text content from this lab report image (page ${i + 1} of ${imagesToProcess.length}). Include all test names, values, reference ranges, and any other relevant information. Format the data in a clean, structured way that preserves the original layout and organization.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        });
        
        const pageText = textExtractionResponse.choices[0].message.content || '';
        if (pageText.trim()) {
          extractedTexts.push(`=== Page ${i + 1} ===\n${pageText}`);
        }
      } catch (error) {
        console.error(`Error processing image ${i + 1}:`, error);
        throw handleOpenAIError(error);
      }
    }
    
    // Combine all extracted text
    extractedText = extractedTexts.join('\n\n');
    
    console.log(`Successfully extracted text from ${extractedTexts.length} pages, total length: ${extractedText.length} characters`);
    
    if (!extractedText.trim()) {
      throw new AppError('No text could be extracted from the uploaded file. Please ensure the file contains readable lab report data.', 400, 'NO_TEXT_EXTRACTED');
    }
    
    // Get settings and knowledge base
    const settings = await handleDatabaseOperation(
      () => storage.getLabInterpreterSettings(),
      'Failed to get lab interpreter settings'
    );
    const knowledgeBase = await handleDatabaseOperation(
      () => storage.getLabKnowledgeBase(req.user.id),
      'Failed to get knowledge base'
    );
    
    // Default prompts if settings not found
    const systemPrompt = settings?.system_prompt || 'You are a medical lab report interpreter. Your task is to analyze lab test results and provide insights based on medical knowledge and the provided reference ranges. Be factual and evidence-based in your analysis.';
    let userPrompt = settings?.without_patient_prompt || 'Analyze this lab report. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
    
    console.log('Using prompts for upload analysis:');
    console.log('System Prompt:', systemPrompt.substring(0, 100) + '...');
    console.log('User Prompt:', userPrompt.substring(0, 100) + '...');
    
    let patient = null;
    if (withPatient === 'true' && patientId) {
      // Get patient info if needed
      patient = await handleDatabaseOperation(
        () => storage.getPatient(parseInt(patientId)),
        'Failed to get patient information'
      );
      if (patient) {
        userPrompt = settings?.with_patient_prompt || 'Analyze this lab report for the patient. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
        // Replace placeholders with actual patient info
        userPrompt = userPrompt
          .replace('${patientName}', `${patient.firstName} ${patient.lastName}`)
          .replace('${patientId}', patient.id.toString());
        console.log('Using patient-specific prompt for upload analysis:', `${patient.firstName} ${patient.lastName}`);
      }
    }
    
    // Prepare knowledge base for prompt
    const knowledgeBaseText = knowledgeBase.map(item => 
      `Test: ${item.test_name}\nMarker: ${item.marker}\nNormal Range: ${item.normal_range_low || ''} - ${item.normal_range_high || ''} ${item.unit || ''}\nInterpretation: ${item.interpretation}\nRecommendations: ${item.recommendations || ''}`
    ).join('\n\n');
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    try {
      const analysisResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: `Here is my knowledge base of lab test reference values and interpretations:\n\n${knowledgeBaseText}\n\nNow, ${userPrompt}\n\nLab Report:\n${extractedText}\n\nPlease provide your analysis as a JSON object with the following structure: { "summary": "brief overview", "abnormalValues": [], "interpretation": "detailed explanation", "recommendations": [] }`
          }
        ],
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });
      
      analysis = analysisResponse.choices[0].message.content || '';
    } catch (error) {
      throw handleOpenAIError(error);
    }
    
    // Save to database if patient is selected
    if (withPatient === 'true' && patientId && patient) {
      await handleDatabaseOperation(
        () => storage.createLabReport({
          patientId: parseInt(patientId),
          doctorId: req.user.id,
          reportData: extractedText,
          reportType: req.file.mimetype.startsWith('image/') ? 'image' : 'pdf',
          fileName: req.file.originalname,
          filePath: req.file.path,
          title: `Lab Report Analysis - ${patient.firstName} ${patient.lastName}`,
          analysis: analysis
        }),
        'Failed to save lab report to database'
      );
    } else {
      // Clean up the uploaded file if not saving to database
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    // Clean up temporary converted images
    if (convertedImages.length > 0) {
      cleanupTempImages(convertedImages);
    }
    
    sendSuccessResponse(res, { 
      extractedText,
      analysis 
    }, 'Lab report analyzed successfully');
    
  } catch (error) {
    // Clean up the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Clean up temporary converted images
    if (convertedImages.length > 0) {
      cleanupTempImages(convertedImages);
    }
    
    // Re-throw the error to be handled by the global error handler
    throw error;
  }
}));

// Get lab reports
labInterpreterRouter.get('/reports', async (req, res) => {
  try {
    const doctorId = req.session.userId;
    const reports = await storage.getLabReports(doctorId);
    return res.json(reports);
  } catch (error) {
    console.error('Error fetching lab reports:', error);
    return res.status(500).json({ error: 'Failed to fetch lab reports' });
  }
});

// Get lab reports by patient
labInterpreterRouter.get('/reports/patient/:patientId', async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }
    
    const reports = await storage.getLabReportsByPatient(patientId);
    return res.json(reports);
  } catch (error) {
    console.error('Error fetching lab reports for patient:', error);
    return res.status(500).json({ error: 'Failed to fetch lab reports for patient' });
  }
});

// Get specific lab report
labInterpreterRouter.get('/reports/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    
    const report = await storage.getLabReport(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    return res.json(report);
  } catch (error) {
    console.error('Error fetching lab report:', error);
    return res.status(500).json({ error: 'Failed to fetch lab report' });
  }
});

// Delete lab report
labInterpreterRouter.delete('/reports/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    
    // Get the report first to check for file path
    const report = await storage.getLabReport(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Delete the file if it exists
    if (report.filePath && fs.existsSync(report.filePath)) {
      fs.unlinkSync(report.filePath);
    }
    
    // Delete the report from the database
    const success = await storage.deleteLabReport(id);
    if (!success) {
      return res.status(500).json({ error: 'Failed to delete report' });
    }
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting lab report:', error);
    return res.status(500).json({ error: 'Failed to delete lab report' });
  }
});

// Route for saving lab report analysis to patient records
labInterpreterRouter.post('/save-report', requireAuth, asyncHandler(async (req, res) => {
  const { patientId, reportData, analysis, title } = req.body;
  
  if (!patientId || !reportData || !analysis) {
    throw new AppError('Missing required fields: patientId, reportData, and analysis are required', 400, 'MISSING_FIELDS');
  }
  
  // Verify that patient exists
  const patient = await handleDatabaseOperation(
    () => storage.getPatient(patientId),
    'Failed to verify patient existence'
  );
  
  if (!patient) {
    throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
  }
  
  // Create a new lab report record
  const report = await handleDatabaseOperation(
    () => storage.createLabReport({
      patientId,
      doctorId: req.user.id,
      reportData,
      reportType: "text",
      analysis: analysis,
      title: title || "Lab Report Analysis"
    }),
    'Failed to save lab report'
  );
  
  sendSuccessResponse(res, { 
    reportId: report.id,
    title: report.title,
    createdAt: report.createdAt
  }, 'Lab report saved successfully');
}));

// Route for handling follow-up questions about lab reports
labInterpreterRouter.post('/follow-up', async (req, res) => {
  try {
    const { question, analysisResult, patientInfo, patientId } = req.body;
    
    if (!question || !analysisResult) {
      return res.status(400).json({ error: 'Question and analysis result are required' });
    }
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Create OpenAI client
    const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Create prompt for follow-up question
    let prompt = `Given the following lab report analysis:\n\n${analysisResult}\n\n`;
    
    // Add patient info if available
    if (patientInfo) {
      prompt += `For ${patientInfo}.\n\n`;
    }
    
    prompt += `Please answer this follow-up question: ${question}\n\n`;
    prompt += `Focus your answer specifically on the lab report information provided. If the question asks about supplements, peptides, or lifestyle recommendations, provide detailed and specific information based on the lab findings. Be concise but thorough.`;
    
    // Call OpenAI
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'system',
          content: 'You are a medical assistant specializing in lab report interpretation. Provide accurate, evidence-based answers to follow-up questions about lab reports. Focus on giving actionable advice and specific recommendations when asked. Keep responses concise and direct.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });
    
    const answer = response.choices[0].message.content;
    
    // Save the question and answer to patient record if patientId is provided
    if (patientId) {
      try {
        const doctorId = (req.session as any)?.user?.id;
        if (doctorId) {
          await storage.createMedicalNote({
            patientId,
            doctorId,
            title: 'Lab Report Follow-Up',
            content: `Q: ${question}\n\nA: ${answer}`,
            type: 'progress'
          });
        }
      } catch (saveError) {
        console.error('Error saving follow-up to patient record:', saveError);
        // Continue even if saving fails
      }
    }
    
    return res.json({ answer });
  } catch (error) {
    console.error('Error processing follow-up question:', error);
    return res.status(500).json({ error: 'Failed to process follow-up question' });
  }
});

// Route for saving voice recording transcript to patient records
labInterpreterRouter.post('/save-transcript', async (req, res) => {
  try {
    // Check if user is authenticated
    const doctorId = (req.session as any)?.user?.id;
    if (!doctorId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { patientId, transcript, reportId } = req.body;
    
    if (!patientId || !transcript) {
      return res.status(400).json({ error: 'Patient ID and transcript are required' });
    }
    
    // Validate patient exists
    const patient = await storage.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Save as a medical note
    const note = await storage.createMedicalNote({
      patientId,
      doctorId,
      title: 'Lab Interpreter Voice Notes',
      content: transcript,
      type: 'progress' // Using a supported note type
    });
    
    return res.json({ success: true, noteId: note.id });
  } catch (error) {
    console.error('Error saving transcript:', error);
    return res.status(500).json({ error: 'Failed to save transcript' });
  }
});