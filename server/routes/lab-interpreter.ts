import { Router } from 'express';
import { storage } from '../storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';
import { z } from 'zod';
import xlsx from 'xlsx';

// Create router
export const labInterpreterRouter = Router();

// Check if OpenAI API key is configured
if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. Lab Interpreter feature will not work properly.");
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    // Accept only Excel files for knowledge base and PDF/images for lab reports
    if (file.fieldname === 'knowledgeBase') {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.mimetype === 'application/vnd.ms-excel' ||
          file.mimetype === 'application/octet-stream') {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files are allowed for knowledge base'));
      }
    } else if (file.fieldname === 'labReport') {
      if (file.mimetype === 'application/pdf' || 
          file.mimetype.startsWith('image/')) {
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
    
    // Transform data to match our database schema
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
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw new Error('Failed to parse Excel file');
  }
}

// Validate the lab knowledge base item
const labKnowledgeBaseItemSchema = z.object({
  test_name: z.string().min(1, 'Test name is required'),
  marker: z.string().min(1, 'Marker is required'),
  normal_range_low: z.number().nullable(),
  normal_range_high: z.number().nullable(),
  unit: z.string().optional(),
  interpretation: z.string().min(1, 'Interpretation is required'),
  recommendations: z.string().optional()
});

// Get knowledge base data
labInterpreterRouter.get('/knowledge-base', async (req, res) => {
  try {
    const items = await storage.getLabKnowledgeBase();
    return res.json(items);
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    return res.status(500).json({ error: 'Failed to fetch knowledge base' });
  }
});

// Get specific knowledge base item
labInterpreterRouter.get('/knowledge-base/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const item = await storage.getLabKnowledgeBaseItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.json(item);
  } catch (error) {
    console.error('Error fetching knowledge base item:', error);
    return res.status(500).json({ error: 'Failed to fetch knowledge base item' });
  }
});

// Create knowledge base item
labInterpreterRouter.post('/knowledge-base', async (req, res) => {
  try {
    // Validate input
    const validatedData = labKnowledgeBaseItemSchema.parse(req.body);
    
    // Create item
    const newItem = await storage.createLabKnowledgeBaseItem(validatedData);
    return res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating knowledge base item:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    return res.status(500).json({ error: 'Failed to create knowledge base item' });
  }
});

// Update knowledge base item
labInterpreterRouter.put('/knowledge-base/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    // Validate input
    const validatedData = labKnowledgeBaseItemSchema.parse(req.body);
    
    // Update item
    const updatedItem = await storage.updateLabKnowledgeBaseItem(id, validatedData);
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.json(updatedItem);
  } catch (error) {
    console.error('Error updating knowledge base item:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: error.errors 
      });
    }
    return res.status(500).json({ error: 'Failed to update knowledge base item' });
  }
});

// Delete knowledge base item
labInterpreterRouter.delete('/knowledge-base/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    const success = await storage.deleteLabKnowledgeBaseItem(id);
    if (!success) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting knowledge base item:', error);
    return res.status(500).json({ error: 'Failed to delete knowledge base item' });
  }
});

// Helper function to parse text format for knowledge base
function parseTextFormat(text: string): any[] {
  // Split the text by double newlines (paragraph breaks)
  const entries = text.split(/\n\s*\n/).filter(entry => entry.trim().length > 0);
  
  return entries.map(entry => {
    const lines = entry.split('\n');
    const result: any = {
      test_name: '',
      marker: '',
      normal_range_low: null,
      normal_range_high: null,
      unit: '',
      interpretation: '',
      recommendations: ''
    };
    
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      
      if (!key || !value) continue;
      
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
      }
    }
    
    return result;
  });
}

// Import knowledge base - supports multiple formats
labInterpreterRouter.post('/knowledge-base/import', upload.single('file'), async (req, res) => {
  try {
    let data: any[] = [];
    const importType = req.body.importType || 'excel';
    
    if (importType === 'excel') {
      // Excel file import
      if (!req.file) {
        return res.status(400).json({ error: 'No Excel file uploaded' });
      }
      
      // Check if it's an Excel file
      if (!req.file.originalname.match(/\.(xlsx|xls)$/i)) {
        return res.status(400).json({ error: 'Uploaded file is not an Excel file' });
      }
      
      data = parseExcelFile(req.file.path);
      
      // Clean up uploaded file when done
      fs.unlinkSync(req.file.path);
    } 
    else if (importType === 'text') {
      // Text file import
      if (!req.file) {
        return res.status(400).json({ error: 'No text file uploaded' });
      }
      
      // Read the text file
      const textContent = fs.readFileSync(req.file.path, 'utf-8');
      data = parseTextFormat(textContent);
      
      // Clean up uploaded file when done
      fs.unlinkSync(req.file.path);
    }
    else if (importType === 'paste') {
      // Text content directly pasted
      if (!req.body.textContent) {
        return res.status(400).json({ error: 'No text content provided' });
      }
      
      data = parseTextFormat(req.body.textContent);
    }
    else {
      return res.status(400).json({ error: 'Invalid import type' });
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
      return res.status(400).json({ error: 'No valid data found in the imported content' });
    }
    
    // Import data
    const itemsImported = await storage.importLabKnowledgeBase(validatedData);
    
    return res.status(201).json({ 
      message: 'Knowledge base imported successfully',
      itemsImported
    });
  } catch (error) {
    console.error('Error importing knowledge base:', error);
    
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ error: 'Failed to import knowledge base' });
  }
});

// Get lab interpreter settings
labInterpreterRouter.get('/settings', async (req, res) => {
  try {
    const settings = await storage.getLabInterpreterSettings();
    if (!settings) {
      // Return default settings if none are found
      return res.json({
        systemPrompt: 'You are a medical lab report interpreter. Your task is to analyze lab test results and provide insights based on medical knowledge and the provided reference ranges. Be factual and evidence-based in your analysis.',
        withPatientPrompt: 'Analyze this lab report for ${patientName} (ID: ${patientId}). Reference this data against the known values in the knowledge base. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.',
        withoutPatientPrompt: 'Analyze this lab report. Reference this data against the known values in the knowledge base. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.'
      });
    }
    return res.json(settings);
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
    
    return res.json(settings);
  } catch (error) {
    console.error('Error saving lab interpreter settings:', error);
    return res.status(500).json({ error: 'Failed to save lab interpreter settings' });
  }
});

// Analyze lab report text
labInterpreterRouter.post('/analyze', async (req, res) => {
  try {
    const { reportText, patientId, withPatient } = req.body;
    
    if (!reportText) {
      return res.status(400).json({ error: 'Report text is required' });
    }
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Get settings and knowledge base
    const settings = await storage.getLabInterpreterSettings();
    const knowledgeBase = await storage.getLabKnowledgeBase();
    
    // Default prompts if settings not found
    const systemPrompt = settings?.systemPrompt || 'You are a medical lab report interpreter. Your task is to analyze lab test results and provide insights based on medical knowledge and the provided reference ranges. Be factual and evidence-based in your analysis.';
    let userPrompt = settings?.withoutPatientPrompt || 'Analyze this lab report. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
    
    let patient = null;
    if (withPatient && patientId) {
      // Get patient info if needed
      patient = await storage.getPatient(patientId);
      if (patient) {
        userPrompt = settings?.withPatientPrompt || 'Analyze this lab report for the patient. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
        // Replace placeholders with actual patient info
        userPrompt = userPrompt
          .replace('${patientName}', `${patient.firstName} ${patient.lastName}`)
          .replace('${patientId}', patient.id.toString());
      }
    }
    
    // Prepare knowledge base for prompt
    const knowledgeBaseText = knowledgeBase.map(item => 
      `Test: ${item.test_name}\nMarker: ${item.marker}\nNormal Range: ${item.normal_range_low || ''} - ${item.normal_range_high || ''} ${item.unit || ''}\nInterpretation: ${item.interpretation}\nRecommendations: ${item.recommendations || ''}`
    ).join('\n\n');
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Here is my knowledge base of lab test reference values and interpretations:\n\n${knowledgeBaseText}\n\nNow, ${userPrompt}\n\nLab Report:\n${reportText}`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });
    
    const analysis = response.choices[0].message.content;
    
    // Save to database if patient is selected
    if (withPatient && patientId && patient) {
      const doctorId = req.user?.id;
      if (doctorId) {
        await storage.createLabReport({
          patientId,
          doctorId,
          reportData: reportText,
          reportType: 'text',
          title: `Lab Report Analysis - ${patient.firstName} ${patient.lastName}`,
          analysis: analysis
        });
      }
    }
    
    return res.json({ analysis });
  } catch (error) {
    console.error('Error analyzing lab report:', error);
    return res.status(500).json({ error: 'Failed to analyze lab report' });
  }
});

// Upload and analyze lab report file
labInterpreterRouter.post('/analyze/upload', upload.single('labReport'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { patientId, withPatient } = req.body;
    
    // Check if OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      // Clean up the uploaded file
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }
    
    // Extract text from file using OpenAI's Vision API
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64File = fileBuffer.toString('base64');
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const textExtractionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: 'user',
          content: [
            {
              type: "text",
              text: "Extract all the text content from this lab report. Include all test names, values, reference ranges, and any other relevant information. Format the data in a clean, structured way."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${req.file.mimetype};base64,${base64File}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000
    });
    
    const extractedText = textExtractionResponse.choices[0].message.content;
    
    // Get settings and knowledge base
    const settings = await storage.getLabInterpreterSettings();
    const knowledgeBase = await storage.getLabKnowledgeBase();
    
    // Default prompts if settings not found
    const systemPrompt = settings?.systemPrompt || 'You are a medical lab report interpreter. Your task is to analyze lab test results and provide insights based on medical knowledge and the provided reference ranges. Be factual and evidence-based in your analysis.';
    let userPrompt = settings?.withoutPatientPrompt || 'Analyze this lab report. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
    
    let patient = null;
    if (withPatient === 'true' && patientId) {
      // Get patient info if needed
      patient = await storage.getPatient(parseInt(patientId));
      if (patient) {
        userPrompt = settings?.withPatientPrompt || 'Analyze this lab report for the patient. Provide a detailed interpretation of abnormal values, possible implications, and recommendations.';
        // Replace placeholders with actual patient info
        userPrompt = userPrompt
          .replace('${patientName}', `${patient.firstName} ${patient.lastName}`)
          .replace('${patientId}', patient.id.toString());
      }
    }
    
    // Prepare knowledge base for prompt
    const knowledgeBaseText = knowledgeBase.map(item => 
      `Test: ${item.test_name}\nMarker: ${item.marker}\nNormal Range: ${item.normal_range_low || ''} - ${item.normal_range_high || ''} ${item.unit || ''}\nInterpretation: ${item.interpretation}\nRecommendations: ${item.recommendations || ''}`
    ).join('\n\n');
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { 
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Here is my knowledge base of lab test reference values and interpretations:\n\n${knowledgeBaseText}\n\nNow, ${userPrompt}\n\nLab Report:\n${extractedText}`
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });
    
    const analysis = analysisResponse.choices[0].message.content;
    
    // Save to database if patient is selected
    if (withPatient === 'true' && patientId && patient) {
      const doctorId = req.user?.id;
      if (doctorId) {
        await storage.createLabReport({
          patientId: parseInt(patientId),
          doctorId,
          reportData: extractedText,
          reportType: req.file.mimetype.startsWith('image/') ? 'image' : 'pdf',
          fileName: req.file.originalname,
          filePath: req.file.path,
          title: `Lab Report Analysis - ${patient.firstName} ${patient.lastName}`,
          analysis: analysis
        });
      }
    } else {
      // Clean up the uploaded file if not saving to database
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
    
    return res.json({ 
      extractedText,
      analysis 
    });
  } catch (error) {
    console.error('Error analyzing lab report file:', error);
    
    // Clean up the uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ error: 'Failed to analyze lab report file' });
  }
});

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