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
import htmlPdf from 'html-pdf-node';
import htmlDocx from 'html-docx-js';
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

// Function to convert PDF to images using ImageMagick with comprehensive error handling
async function convertPdfToImages(pdfPath: string): Promise<string[]> {
  const tempDir = path.join(path.dirname(pdfPath), 'temp_images');
  
  try {
    // Verify PDF file exists and is readable
    if (!fs.existsSync(pdfPath)) {
      throw new Error('PDF file not found');
    }
    
    const pdfStats = fs.statSync(pdfPath);
    if (pdfStats.size === 0) {
      throw new Error('PDF file is empty');
    }
    
    console.log(`Converting PDF: ${path.basename(pdfPath)} (${Math.round(pdfStats.size / 1024)}KB)`);
    
    // Create temporary directory for converted images
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Clean up any existing files in temp directory
    const existingFiles = fs.readdirSync(tempDir);
    existingFiles.forEach(file => {
      if (file.startsWith('page-')) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    });
    
    // Use faster ImageMagick settings optimized for speed
    const outputPattern = path.join(tempDir, 'page-%d.jpg');
    const command = `convert -limit memory 128MB -limit map 256MB -density 150 -quality 70 -colorspace Gray "${pdfPath}" "${outputPattern}"`;
    
    console.log('Converting PDF to images with optimized command:', command);
    
    // Reduced timeout for faster processing
    const timeoutMs = 3 * 60 * 1000; // 3 minutes timeout
    const conversionPromise = execAsync(command, { 
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    try {
      await conversionPromise;
    } catch (execError: any) {
      console.error('ImageMagick conversion error:', execError);
      
      if (execError.killed && execError.signal === 'SIGTERM') {
        throw new Error('PDF conversion timed out - file too large or corrupted');
      }
      
      if (execError.code === 1 && execError.stderr?.includes('gs: not found')) {
        throw new Error('Ghostscript not installed - required for PDF processing');
      }
      
      if (execError.stderr?.includes('memory')) {
        throw new Error('Not enough memory to process this PDF - try a smaller file');
      }
      
      throw new Error(`ImageMagick error: ${execError.stderr || execError.message}`);
    }
    
    // Find and validate all generated images
    const files = fs.readdirSync(tempDir)
      .filter(file => file.startsWith('page-') && (file.endsWith('.png') || file.endsWith('.jpg')))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/page-(\d+)\.(png|jpg)/)?.[1] || '0');
        const bNum = parseInt(b.match(/page-(\d+)\.(png|jpg)/)?.[1] || '0');
        return aNum - bNum;
      });
    
    if (files.length === 0) {
      throw new Error('No images were generated from the PDF');
    }
    
    // Validate each image file
    const validFiles: string[] = [];
    for (const file of files) {
      const fullPath = path.join(tempDir, file);
      try {
        const imageStats = fs.statSync(fullPath);
        if (imageStats.size > 500) { // Reduced minimum size for faster processing
          validFiles.push(fullPath);
        } else {
          console.warn(`Skipping invalid image: ${file} (${imageStats.size} bytes)`);
          fs.unlinkSync(fullPath); // Clean up invalid file
        }
      } catch (statError) {
        console.warn(`Error checking image file ${file}:`, statError);
      }
    }
    
    if (validFiles.length === 0) {
      throw new Error('No valid images were generated from the PDF');
    }
    
    console.log(`PDF successfully converted to ${validFiles.length} valid images`);
    return validFiles;
    
  } catch (error: any) {
    console.error('Error converting PDF to images:', error);
    
    // Clean up partial conversion on error
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        files.forEach(file => {
          if (file.startsWith('page-')) {
            fs.unlinkSync(path.join(tempDir, file));
          }
        });
      }
    } catch (cleanupError) {
      console.error('Error cleaning up after PDF conversion failure:', cleanupError);
    }
    
    // Provide specific error messages
    if (error.message?.includes('timeout') || error.message?.includes('timed out')) {
      throw new AppError('PDF conversion timed out. The file may be too large. Please try with a smaller PDF or convert to images manually.', 500, 'PDF_CONVERSION_TIMEOUT');
    }
    
    if (error.message?.includes('memory')) {
      throw new AppError('Insufficient memory to process this PDF. Please try with a smaller file.', 500, 'PDF_MEMORY_ERROR');
    }
    
    if (error.message?.includes('Ghostscript')) {
      throw new AppError('PDF processing service unavailable. Please convert your PDF to images manually and upload again.', 500, 'PDF_GHOSTSCRIPT_ERROR');
    }
    
    if (error.message?.includes('not found') || error.message?.includes('empty')) {
      throw new AppError('Invalid PDF file. Please ensure the file is a valid PDF document.', 400, 'INVALID_PDF');
    }
    
    throw new AppError('Failed to convert PDF to images. Please try converting to image format manually or contact support.', 500, 'PDF_CONVERSION_FAILED');
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

// NEW SEQUENTIAL PDF PROCESSING WORKFLOW
async function processPdfSequentially(pdfPath: string, openai: OpenAI): Promise<string> {
  console.log('=== Starting Sequential PDF Processing ===');
  
  // Step 1: Convert PDF to images
  const tempDir = path.join(path.dirname(pdfPath), 'temp_images');
  const convertedImages = await convertPdfToImagesSequential(pdfPath, tempDir);
  
  if (convertedImages.length === 0) {
    throw new AppError('No pages could be converted from the PDF', 400, 'PDF_CONVERSION_FAILED');
  }
  
  console.log(`Successfully converted PDF to ${convertedImages.length} images`);
  
  // Step 2: Process each image sequentially and collect text
  const allExtractedTexts: string[] = [];
  
  for (let i = 0; i < convertedImages.length; i++) {
    const imagePath = convertedImages[i];
    const pageNumber = i + 1;
    
    try {
      console.log(`Processing page ${pageNumber}/${convertedImages.length}: ${path.basename(imagePath)}`);
      
      const pageText = await processImageFile(imagePath, openai, pageNumber, convertedImages.length);
      
      if (pageText && pageText.trim()) {
        allExtractedTexts.push(pageText);
        console.log(`✓ Page ${pageNumber} processed successfully (${pageText.length} characters)`);
      } else {
        console.log(`⚠ Page ${pageNumber} appears to be blank or unreadable`);
      }
      
      // Small delay between pages to avoid rate limiting
      if (i < convertedImages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error: any) {
      console.error(`✗ Failed to process page ${pageNumber}:`, error.message);
      // Continue with other pages instead of failing completely
      allExtractedTexts.push(`=== Page ${pageNumber} ===\n[Error: Could not extract text from this page: ${error.message}]`);
    }
  }
  
  // Step 3: Clean up temporary images
  cleanupTempImages(convertedImages);
  
  // Step 4: Combine all extracted text
  const finalText = allExtractedTexts.join('\n\n');
  
  console.log(`=== PDF Processing Complete ===`);
  console.log(`Successfully processed ${allExtractedTexts.length}/${convertedImages.length} pages`);
  console.log(`Total extracted text: ${finalText.length} characters`);
  
  if (!finalText.trim()) {
    throw new AppError('No text could be extracted from any page of the PDF. Please ensure the PDF contains readable content.', 400, 'NO_TEXT_EXTRACTED');
  }
  
  return finalText;
}

// Process a single image file with OpenAI Vision API
async function processImageFile(imagePath: string, openai: OpenAI, pageNumber: number, totalPages: number): Promise<string> {
  // Validate image file
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Image file not found: ${imagePath}`);
  }
  
  const imageStats = fs.statSync(imagePath);
  if (imageStats.size === 0) {
    throw new Error('Image file is empty');
  }
  
  // Read and encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  
  // Check image size limits
  if (base64Image.length > 20 * 1024 * 1024) {
    throw new Error(`Image too large: ${Math.round(base64Image.length / 1024 / 1024)}MB (max 20MB)`);
  }
  
  console.log(`  → [FAST MODE] Sending page ${pageNumber} to OpenAI (${Math.round(imageStats.size / 1024)}KB)`);
  
  // Extract text using OpenAI Vision API with optimized settings for speed
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: 'user',
        content: [
          {
            type: "text",
            text: `Quickly extract text from this lab report page ${pageNumber}/${totalPages}. Include test names, values, and reference ranges. Be concise. If blank, respond "BLANK_PAGE".`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${base64Image}`,
              detail: "low" // Use low detail for 3x faster processing
            }
          }
        ]
      }
    ],
    max_tokens: 2000, // Reduced for faster processing
    temperature: 0.0 // Most deterministic for text extraction
  });
  
  const extractedText = response.choices[0].message.content || '';
  
  if (extractedText.includes('BLANK_PAGE')) {
    return '';
  }
  
  return `=== Page ${pageNumber} ===\n${extractedText}`;
}

// Convert PDF to images with better error handling
async function convertPdfToImagesSequential(pdfPath: string, tempDir: string): Promise<string[]> {
  try {
    // Create and clean temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    } else {
      // Clean existing files
      const existingFiles = fs.readdirSync(tempDir);
      existingFiles.forEach(file => {
        if (file.startsWith('page-')) {
          fs.unlinkSync(path.join(tempDir, file));
        }
      });
    }
    
    // Check PDF file
    const pdfStats = fs.statSync(pdfPath);
    console.log(`Converting PDF: ${path.basename(pdfPath)} (${Math.round(pdfStats.size / 1024)}KB)`);
    
    // Use optimized ImageMagick command
    const outputPattern = path.join(tempDir, 'page-%d.png');
    const command = `convert -limit memory 512MB -limit map 1GB -density 150 -quality 90 -colorspace RGB -background white -alpha remove "${pdfPath}" "${outputPattern}"`;
    
    console.log('Running conversion command...');
    console.log(command);
    
    // Execute with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 15 * 60 * 1000, // 15 minutes
      maxBuffer: 50 * 1024 * 1024 // 50MB buffer
    });
    
    if (stderr && !stderr.includes('Warning')) {
      console.warn('ImageMagick warnings:', stderr);
    }
    
    // Find generated images
    const imageFiles = fs.readdirSync(tempDir)
      .filter(file => file.startsWith('page-') && file.endsWith('.png'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/page-(\d+)\.png/)?.[1] || '0');
        const bNum = parseInt(b.match(/page-(\d+)\.png/)?.[1] || '0');
        return aNum - bNum;
      })
      .map(file => path.join(tempDir, file));
    
    // Validate generated images
    const validImages = imageFiles.filter(imagePath => {
      try {
        const stats = fs.statSync(imagePath);
        return stats.size > 1000; // At least 1KB
      } catch {
        return false;
      }
    });
    
    console.log(`Generated ${validImages.length} valid images from PDF`);
    return validImages;
    
  } catch (error: any) {
    console.error('PDF conversion error:', error);
    
    if (error.code === 'ETIMEDOUT') {
      throw new AppError('PDF conversion timed out. The file is too large or complex. Please try with a smaller PDF.', 500, 'PDF_TIMEOUT');
    }
    
    if (error.message?.includes('memory')) {
      throw new AppError('Insufficient memory to process this PDF. Please try with a smaller file.', 500, 'PDF_MEMORY_ERROR');
    }
    
    throw new AppError('Failed to convert PDF to images. Please ensure the PDF is valid and not corrupted.', 500, 'PDF_CONVERSION_ERROR');
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
  limits: { 
    fileSize: 25 * 1024 * 1024, // Increased to 25MB for larger PDFs
    files: 1
  },
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
      // Validate PDF and image files more strictly
      if (file.mimetype === 'application/pdf') {
        cb(null, true);
      } else if (file.mimetype.startsWith('image/')) {
        // Accept common image formats
        const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
        if (allowedImageTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Unsupported image format. Please use JPG, PNG, GIF, BMP, or WebP'));
        }
      } else {
        cb(new Error('Only PDF files and images (JPG, PNG, GIF, BMP, WebP) are allowed for lab reports'));
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
  const hasOrganSystem = keys.some(k => /organ|system|category/i.test(k));
  const hasDiseaseState = keys.some(k => /disease|state|condition|disorder/i.test(k));
  const hasProductColumns = keys.some(k => /product|supplement|peptide|formula|support|take|dosage|recommendation/i.test(k));
  
  // More flexible detection - if we have any combination of these, try disease-product format first
  // This allows for various Excel file structures
  const productColumnCount = keys.filter(k => /product|supplement|peptide|formula|support|take|dosage/i.test(k)).length;
  
  console.log('Format detection:', {
    hasOrganSystem,
    hasDiseaseState,
    hasProductColumns,
    productColumnCount,
    totalColumns: keys.length,
    columns: keys
  });
  
  // If we have organ/disease columns OR multiple product columns OR more than 5 columns, try disease-product format
  return (hasOrganSystem || hasDiseaseState) || productColumnCount >= 1 || keys.length > 5;
}

// Parse the Disease-Product reference format
function parseDiseaseProductReference(data: any[]) {
  console.log("Processing disease-product reference format - ENHANCED AI CAPTURE");
  
  // Enhanced analysis of file structure
  if (data.length > 0) {
    const allKeys = Object.keys(data[0]);
    console.log("Total columns detected:", allKeys.length);
    console.log("All column headers:", allKeys);
    
    // Advanced pattern detection for your Excel structure
    const peptideColumns = allKeys.filter(k => /peptide/i.test(k));
    const formulaColumns = allKeys.filter(k => /formula|supplement|product|support|guard/i.test(k));
    const dosageColumns = allKeys.filter(k => /take|dose|dosage|instruction|how.*to/i.test(k));
    const systemColumns = allKeys.filter(k => /organ|system/i.test(k));
    const diseaseColumns = allKeys.filter(k => /disease|state|condition/i.test(k));
    
    console.log("Enhanced column analysis:", {
      systemColumns,
      diseaseColumns,
      peptideColumns,
      formulaColumns,
      dosageColumns,
      totalColumns: allKeys.length
    });
  }

  return data.filter(row => {
    // Skip completely empty rows
    const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
    return values.length > 0;
  }).map((row: any) => {
    // Get ALL column keys from the row
    const allKeys = Object.keys(row);
    console.log(`Processing row with ${allKeys.length} columns`);
    
    // Smart detection of organ system and disease columns
    let organSystemKey = '';
    let diseaseStateKey = '';
    
    // Enhanced pattern matching for your specific Excel structure
    for (const key of allKeys) {
      const keyLower = key.toLowerCase();
      
      // Look for organ system columns (first priority)
      if (!organSystemKey && /organ.*system|system/i.test(key)) {
        organSystemKey = key;
      }
      
      // Look for disease/condition columns
      if (!diseaseStateKey && /disease.*state|disease|condition|state/i.test(key)) {
        diseaseStateKey = key;
      }
    }
    
    // Fallback to first two columns if specific patterns not found
    if (!organSystemKey && allKeys.length > 0) organSystemKey = allKeys[0];
    if (!diseaseStateKey && allKeys.length > 1) diseaseStateKey = allKeys[1];
    
    // Extract organ system and disease values
    const organSystem = organSystemKey ? String(row[organSystemKey] || '').trim() : 'General';
    const diseaseState = diseaseStateKey ? String(row[diseaseStateKey] || '').trim() : '';
    
    console.log(`Organ: ${organSystem}, Disease: ${diseaseState}`);
    
    // ENHANCED: Capture EVERY single column with intelligent categorization
    const categoryData: { [category: string]: { [key: string]: string } } = {
      peptides: {},
      formulas: {},
      dosages: {},
      additional: {}
    };
    
    // Process EVERY column systematically
    allKeys.forEach((key, index) => {
      const value = String(row[key] || '').trim();
      
      // Skip empty values and the main identification columns
      if (!value || value === '' || value.toLowerCase() === 'null' || 
          key === organSystemKey || key === diseaseStateKey) {
        return;
      }
      
      const keyLower = key.toLowerCase();
      const cleanKeyName = key.replace(/([A-Z])/g, ' $1').trim();
      
      console.log(`Processing column ${index + 1}: "${key}" = "${value}"`);
      
      // Smart categorization with comprehensive pattern matching
      if (/peptide/i.test(key)) {
        categoryData.peptides[cleanKeyName] = value;
        console.log(`  → Categorized as PEPTIDE: ${cleanKeyName}`);
      } else if (/formula|supplement|product|support.*formula|guard.*formula|guard$|cleanse|wash/i.test(key)) {
        categoryData.formulas[cleanKeyName] = value;
        console.log(`  → Categorized as FORMULA: ${cleanKeyName}`);
      } else if (/take|dosage|dose|instruction|how.*to|daily|units|mg|ml|tsp|cap|admin/i.test(key) || /take|daily|units|mg|ml/i.test(value)) {
        categoryData.dosages[cleanKeyName] = value;
        console.log(`  → Categorized as DOSAGE: ${cleanKeyName}`);
      } else {
        // Capture EVERYTHING else - no data left behind
        categoryData.additional[cleanKeyName] = value;
        console.log(`  → Categorized as ADDITIONAL: ${cleanKeyName}`);
      }
    });
    
    // Build ultra-comprehensive recommendations preserving ALL data
    let fullRecommendations = '';
    
    // Peptides section
    if (Object.keys(categoryData.peptides).length > 0) {
      fullRecommendations += 'PEPTIDES:\n';
      Object.entries(categoryData.peptides).forEach(([key, value]) => {
        fullRecommendations += `${key}: ${value}\n`;
      });
      fullRecommendations += '\n';
    }
    
    // Supplements and formulas section
    if (Object.keys(categoryData.formulas).length > 0) {
      fullRecommendations += 'SUPPLEMENTS & FORMULAS:\n';
      Object.entries(categoryData.formulas).forEach(([key, value]) => {
        fullRecommendations += `${key}: ${value}\n`;
      });
      fullRecommendations += '\n';
    }
    
    // Dosage instructions section
    if (Object.keys(categoryData.dosages).length > 0) {
      fullRecommendations += 'DOSAGE INSTRUCTIONS:\n';
      Object.entries(categoryData.dosages).forEach(([key, value]) => {
        fullRecommendations += `${key}: ${value}\n`;
      });
      fullRecommendations += '\n';
    }
    
    // Additional data section - captures everything else
    if (Object.keys(categoryData.additional).length > 0) {
      fullRecommendations += 'ADDITIONAL DATA:\n';
      Object.entries(categoryData.additional).forEach(([key, value]) => {
        fullRecommendations += `${key}: ${value}\n`;
      });
      fullRecommendations += '\n';
    }
    
    // Emergency fallback - if categorization missed something, capture raw
    if (fullRecommendations.trim().length < 50) {
      fullRecommendations = 'RAW DATA CAPTURE (ALL COLUMNS):\n';
      allKeys.forEach(key => {
        const value = String(row[key] || '').trim();
        if (value && value !== '' && value.toLowerCase() !== 'null') {
          const cleanKey = key.replace(/([A-Z])/g, ' $1').trim();
          fullRecommendations += `${cleanKey}: ${value}\n`;
        }
      });
    }
    
    console.log(`Final recommendations length: ${fullRecommendations.length} characters`);
    
    return {
      test_name: organSystem || 'Organ System',
      marker: diseaseState || 'Disease/Condition',
      normal_range_low: null,
      normal_range_high: null,
      unit: '',
      interpretation: `Condition: ${diseaseState || 'Unknown'}`,
      recommendations: fullRecommendations.trim() || 'No data captured'
    };
  });
}

// Parse any Excel file format flexibly
function parseStandardLabFormat(data: any[]) {
  return data.filter(row => {
    // Skip completely empty rows
    const values = Object.values(row).filter(v => v !== null && v !== undefined && v !== '');
    return values.length > 0;
  }).map((row: any) => {
    const keys = Object.keys(row);
    
    // Try to find the best matching columns, or use defaults
    const testNameKey = keys.find(k => /test|name|category|group/i.test(k)) || keys[0] || 'Column1';
    const markerKey = keys.find(k => /marker|analyte|param|item|biomarker/i.test(k)) || keys[1] || 'Column2';
    const minKey = keys.find(k => /low|min|lower|bottom/i.test(k));
    const maxKey = keys.find(k => /high|max|upper|top/i.test(k));
    const unitKey = keys.find(k => /unit|units/i.test(k));
    const interpretKey = keys.find(k => /interpret|desc|mean|description|info/i.test(k));
    const recKey = keys.find(k => /rec|advice|suggest|recommendation|treatment/i.test(k));
    
    // If we can't find specific columns, collect all data as recommendations
    let allData = '';
    if (!interpretKey && !recKey && keys.length > 2) {
      // Collect all non-test/marker columns as general information
      for (let i = 2; i < keys.length; i++) {
        const key = keys[i];
        const value = String(row[key] || '').trim();
        if (value && value !== '' && value.toLowerCase() !== 'null') {
          const cleanKey = key.replace(/([A-Z])/g, ' $1').trim();
          allData += `${cleanKey}: ${value}\n`;
        }
      }
    }
    
    return {
      test_name: String(row[testNameKey] || 'Unknown Category').trim(),
      marker: String(row[markerKey] || 'Unknown Item').trim(),
      normal_range_low: minKey ? (parseFloat(String(row[minKey] || '0')) || null) : null,
      normal_range_high: maxKey ? (parseFloat(String(row[maxKey] || '0')) || null) : null,
      unit: unitKey ? String(row[unitKey] || '').trim() : '',
      interpretation: interpretKey ? String(row[interpretKey] || '').trim() : (allData || 'Imported data'),
      recommendations: recKey ? String(row[recKey] || '').trim() : (allData || 'See interpretation')
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
    
  // Prepare enhanced knowledge base for prompt with company product focus
  const knowledgeBaseText = knowledgeBase.map(item => {
    // Extract product information from recommendations for easy access
    const recommendations = item.recommendations || '';
    let productSummary = '';
    
    // Parse peptides
    const peptideMatch = recommendations.match(/PEPTIDES:\s*\n([\s\S]*?)(?=\n\s*SUPPLEMENTS|\n\s*DOSAGE|\n\s*ADDITIONAL|$)/i);
    if (peptideMatch) {
      const peptides = peptideMatch[1].split('\n').filter(line => line.trim() && line.includes(':')).map(line => line.trim()).join(', ');
      productSummary += `Peptides: ${peptides}; `;
    }
    
    // Parse supplements/formulas
    const formulaMatch = recommendations.match(/SUPPLEMENTS & FORMULAS:\s*\n([\s\S]*?)(?=\n\s*DOSAGE|\n\s*ADDITIONAL|$)/i);
    if (formulaMatch) {
      const formulas = formulaMatch[1].split('\n').filter(line => line.trim() && line.includes(':')).map(line => line.trim()).join(', ');
      productSummary += `Formulas: ${formulas}; `;
    }
    
    // Parse dosages
    const dosageMatch = recommendations.match(/DOSAGE INSTRUCTIONS:\s*\n([\s\S]*?)(?=\n\s*ADDITIONAL|$)/i);
    if (dosageMatch) {
      const dosages = dosageMatch[1].split('\n').filter(line => line.trim() && line.includes(':')).map(line => line.trim()).join(', ');
      productSummary += `Dosages: ${dosages}`;
    }
    
    return `Organ System: ${item.test_name}
Disease/Condition: ${item.marker}
Available Products: ${productSummary || 'See full recommendations'}
Complete Recommendations:
${recommendations}
---`;
  }).join('\n\n');
  
  console.log(`Using ${knowledgeBase.length} knowledge base entries for analysis`);
  if (knowledgeBase.length > 0) {
    console.log('Sample KB entry:', knowledgeBase[0].test_name, '-', knowledgeBase[0].marker);
  }
  
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
          content: `COMPANY PRODUCT INVENTORY - ONLY RECOMMEND FROM THIS LIST:

${knowledgeBaseText}

${knowledgeBase.length === 0 ? 
  'Note: No company product inventory found. Provide general health advice without specific product recommendations.' : 
  `IMPORTANT: This company sells ${knowledgeBase.length} specific medical products. You must ONLY recommend products from the above inventory. Do not suggest any products not listed above.`
}

ANALYSIS REQUEST: ${userPrompt}

LAB REPORT DATA:
${reportText}

RESPONSE REQUIREMENTS:
1. Analyze the lab values using functional medicine principles
2. ONLY recommend peptides, formulas, and supplements from the company inventory above
3. Use the exact product names and dosage instructions provided
4. If a condition needs treatment but no matching product exists in inventory, provide general health advice without product recommendations
5. Always reference the specific "How to take" instructions from the knowledge base

Please provide your analysis as a JSON object with this structure: 
{ 
  "summary": "brief overview", 
  "abnormalValues": [], 
  "interpretation": "detailed explanation", 
  "recommendations": [{"product": "exact name from inventory", "dosage": "from knowledge base", "reason": "why recommended"}], 
  "knowledgeBaseUsed": ${knowledgeBase.length},
  "complianceNote": "All recommendations are from company product inventory only"
}`
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

// Upload and analyze lab report file with sequential PDF processing
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
    console.log(`Processing uploaded file: ${req.file.originalname} (${Math.round(req.file.size / 1024)}KB)`);
    
    // NEW SEQUENTIAL WORKFLOW: Process PDF and images
    if (req.file.mimetype === 'application/pdf') {
      console.log('Starting PDF processing workflow...');
      extractedText = await processPdfSequentially(req.file.path, openai);
    } else if (req.file.mimetype.startsWith('image/')) {
      console.log('Processing single image...');
      extractedText = await processImageFile(req.file.path, openai, 1, 1);
    } else {
      throw new AppError('Unsupported file type. Please upload a PDF or image file.', 400, 'UNSUPPORTED_FILE_TYPE');
    }
    
    console.log(`Text extraction completed. Total length: ${extractedText.length} characters`);
    
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
    
    // Prepare enhanced knowledge base for prompt with company product focus
    const knowledgeBaseText = knowledgeBase.map(item => {
      // Extract product information from recommendations for easy access
      const recommendations = item.recommendations || '';
      let productSummary = '';
      
      // Parse peptides
      const peptideMatch = recommendations.match(/PEPTIDES:\s*\n([\s\S]*?)(?=\n\s*SUPPLEMENTS|\n\s*DOSAGE|\n\s*ADDITIONAL|$)/i);
      if (peptideMatch) {
        const peptides = peptideMatch[1].split('\n').filter(line => line.trim() && line.includes(':')).map(line => line.trim()).join(', ');
        productSummary += `Peptides: ${peptides}; `;
      }
      
      // Parse supplements/formulas
      const formulaMatch = recommendations.match(/SUPPLEMENTS & FORMULAS:\s*\n([\s\S]*?)(?=\n\s*DOSAGE|\n\s*ADDITIONAL|$)/i);
      if (formulaMatch) {
        const formulas = formulaMatch[1].split('\n').filter(line => line.trim() && line.includes(':')).map(line => line.trim()).join(', ');
        productSummary += `Formulas: ${formulas}; `;
      }
      
      // Parse dosages
      const dosageMatch = recommendations.match(/DOSAGE INSTRUCTIONS:\s*\n([\s\S]*?)(?=\n\s*ADDITIONAL|$)/i);
      if (dosageMatch) {
        const dosages = dosageMatch[1].split('\n').filter(line => line.trim() && line.includes(':')).map(line => line.trim()).join(', ');
        productSummary += `Dosages: ${dosages}`;
      }
      
      return `Organ System: ${item.test_name}
Disease/Condition: ${item.marker}
Available Products: ${productSummary || 'See full recommendations'}
Complete Recommendations:
${recommendations}
---`;
    }).join('\n\n');
    
    console.log(`Using ${knowledgeBase.length} knowledge base entries for upload analysis`);
    if (knowledgeBase.length > 0) {
      console.log('Sample KB entry:', knowledgeBase[0].test_name, '-', knowledgeBase[0].marker);
    }
    
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
            content: `COMPANY PRODUCT INVENTORY - ONLY RECOMMEND FROM THIS LIST:

${knowledgeBaseText}

${knowledgeBase.length === 0 ? 
  'Note: No company product inventory found. Provide general health advice without specific product recommendations.' : 
  `IMPORTANT: This company sells ${knowledgeBase.length} specific medical products. You must ONLY recommend products from the above inventory. Do not suggest any products not listed above.`
}

ANALYSIS REQUEST: ${userPrompt}

LAB REPORT DATA:
${extractedText}

RESPONSE REQUIREMENTS:
1. Analyze the lab values using functional medicine principles
2. ONLY recommend peptides, formulas, and supplements from the company inventory above
3. Use the exact product names and dosage instructions provided
4. If a condition needs treatment but no matching product exists in inventory, provide general health advice without product recommendations
5. Always reference the specific "How to take" instructions from the knowledge base

Please provide your analysis as a JSON object with this structure: 
{ 
  "summary": "brief overview", 
  "abnormalValues": [], 
  "interpretation": "detailed explanation", 
  "recommendations": [{"product": "exact name from inventory", "dosage": "from knowledge base", "reason": "why recommended"}], 
  "knowledgeBaseUsed": ${knowledgeBase.length},
  "complianceNote": "All recommendations are from company product inventory only"
}`
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
    
    // Note: Temporary images are cleaned up automatically in processPdfSequentially
    
    sendSuccessResponse(res, { 
      extractedText,
      analysis 
    }, 'Lab report analyzed successfully');
    
  } catch (error) {
    // Clean up the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Note: Temporary images are cleaned up automatically in processPdfSequentially
    
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

// Handle styled document downloads
labInterpreterRouter.post('/download-styled', requireAuth, asyncHandler(async (req, res) => {
  const { content, format, patientId } = req.body;
  
  if (!content || !format) {
    throw new AppError('Content and format are required', 400, 'MISSING_FIELDS');
  }
  
  if (!['pdf', 'docx'].includes(format)) {
    throw new AppError('Invalid format. Must be pdf or docx', 400, 'INVALID_FORMAT');
  }
  
  try {
    // Get patient info if provided
    let patient = null;
    if (patientId) {
      patient = await handleDatabaseOperation(
        () => storage.getPatient(parseInt(patientId)),
        'Failed to get patient information'
      );
    }
    
    // Create styled HTML with CSS
    const styledHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Styled Lab Report Analysis</title>
        <style>
          body {
            font-family: 'Times New Roman', Times, serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
            color: #333;
          }
          h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            font-size: 28px;
          }
          h2 {
            color: #34495e;
            margin-top: 30px;
            margin-bottom: 15px;
            font-size: 22px;
          }
          h3 {
            color: #7f8c8d;
            margin-top: 20px;
            margin-bottom: 10px;
            font-size: 18px;
          }
          p {
            margin-bottom: 15px;
            text-align: justify;
          }
          ul, ol {
            margin-bottom: 15px;
          }
          li {
            margin-bottom: 8px;
          }
          strong {
            color: #2c3e50;
          }
          em {
            color: #7f8c8d;
            font-style: italic;
          }
          .patient-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .analysis-section {
            margin-bottom: 25px;
          }
          .recommendations {
            background-color: #e8f6f3;
            padding: 15px;
            border-left: 4px solid #27ae60;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #bdc3c7;
            text-align: center;
            font-size: 12px;
            color: #7f8c8d;
          }
        </style>
      </head>
      <body>
        ${content}
        <div class="footer">
          Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
          ${patient ? ` | Patient: ${patient.firstName} ${patient.lastName}` : ''}
        </div>
      </body>
      </html>
    `;
    
    if (format === 'pdf') {
      // Generate PDF using jsPDF (lighter alternative)
      const { jsPDF } = await import('jspdf');
      
      // Convert HTML to plain text for PDF
      const tempDiv = { innerHTML: content };
      const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      const doc = new jsPDF();
      let yPosition = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - 2 * margin;
      
      // Add title
      doc.setFontSize(16);
      doc.setFont(undefined, 'bold');
      doc.text('Styled Lab Report Analysis', margin, yPosition);
      yPosition += 15;
      
      // Add content
      doc.setFontSize(12);
      doc.setFont(undefined, 'normal');
      const lines = doc.splitTextToSize(textContent, maxWidth);
      
      for (let i = 0; i < lines.length; i++) {
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(lines[i], margin, yPosition);
        yPosition += 6;
      }
      
      // Add footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(
          `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${totalPages}`,
          margin,
          doc.internal.pageSize.getHeight() - 10
        );
      }
      
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="styled-lab-report.pdf"');
      res.send(pdfBuffer);
      
    } else if (format === 'docx') {
      // Generate DOCX using proper server-side library
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
      
      // Convert HTML content to plain text and create document
      const textContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "Styled Lab Report Analysis",
              heading: HeadingLevel.TITLE,
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
                  italics: true,
                  size: 20,
                }),
              ],
            }),
            new Paragraph({
              text: "", // Empty line
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: textContent,
                  size: 24,
                }),
              ],
            }),
            ...(patient ? [
              new Paragraph({
                text: "", // Empty line
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Patient: ${patient.firstName} ${patient.lastName}`,
                    bold: true,
                    size: 22,
                  }),
                ],
              }),
            ] : []),
          ],
        }],
      });
      
      const docxBuffer = await Packer.toBuffer(doc);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="styled-lab-report.docx"');
      res.send(docxBuffer);
    }
    
  } catch (error) {
    console.error('Error generating styled document:', error);
    throw new AppError('Failed to generate styled document', 500, 'DOCUMENT_GENERATION_ERROR');
  }
}));