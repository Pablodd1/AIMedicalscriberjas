import { Router, Request, Response } from 'express';
// Demo mode - suppress logging
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';
const log = (...args: any[]) => !DEMO_MODE && console.log(...args);
const logError = (...args: any[]) => !DEMO_MODE && console.error(...args);
import { storage } from '../storage';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export const patientDocumentsRouter = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads', 'patient-documents');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage_config = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    // Generate a unique filename with original extension
    const uniqueFilename = `${randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueFilename);
  }
});

// File filter to allow only specific file types
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow common document and image types
  const allowedTypes = [
    // Documents
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    'image/svg+xml'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Please upload a document or image file.'));
  }
};

const upload = multer({ 
  storage: storage_config,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Get all documents for a patient
patientDocumentsRouter.get('/:patientId', async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    
    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }
    
    // Authentication is handled by the middleware in routes.ts
    const userId = req.user!.id;
    
    // Get documents for this patient
    const documents = await storage.getPatientDocuments(patientId);
    
    return res.json(documents);
  } catch (error) {
    logError('Error getting patient documents:', error);
    return res.status(500).json({ error: 'Failed to get patient documents' });
  }
});

// Upload a new document for a patient
patientDocumentsRouter.post('/:patientId/upload', upload.single('document'), async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const file = req.file;
    const { title, description, tags } = req.body;
    
    if (isNaN(patientId)) {
      return res.status(400).json({ error: 'Invalid patient ID' });
    }
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!title) {
      return res.status(400).json({ error: 'Document title is required' });
    }
    
    // Authentication is handled by the middleware in routes.ts
    const doctorId = req.user!.id;
    
    // Check if the patient exists
    const patient = await storage.getPatient(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Parse tags if they're provided
    let parsedTags: string[] = [];
    if (tags) {
      try {
        parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
      } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim());
      }
    }
    
    // Get file type from the original extension
    const fileType = path.extname(file.originalname).substring(1).toLowerCase();
    
    // Create document record in database
    const document = await storage.createPatientDocument({
      patientId,
      doctorId,
      filename: file.filename,
      originalFilename: file.originalname,
      filePath: path.relative(process.cwd(), file.path),
      fileType,
      fileSize: file.size,
      title,
      description: description || null,
      tags: parsedTags
    });
    
    return res.status(201).json(document);
  } catch (error) {
    logError('Error uploading patient document:', error);
    return res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Download a document
patientDocumentsRouter.get('/:patientId/download/:documentId', async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const documentId = parseInt(req.params.documentId);
    
    if (isNaN(patientId) || isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }
    
    // Check if user is authenticated
    const userId = (req.session as any)?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get the document
    const document = await storage.getPatientDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (document.patientId !== patientId) {
      return res.status(403).json({ error: 'Document does not belong to this patient' });
    }
    
    // Build the absolute file path
    const filePath = path.join(process.cwd(), document.filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    // Send file to client
    res.download(filePath, document.originalFilename);
  } catch (error) {
    logError('Error downloading patient document:', error);
    return res.status(500).json({ error: 'Failed to download document' });
  }
});

// Delete a document
patientDocumentsRouter.delete('/:patientId/documents/:documentId', async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const documentId = parseInt(req.params.documentId);
    
    if (isNaN(patientId) || isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }
    
    // Check if user is authenticated
    const userId = (req.session as any)?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get the document to check ownership and get file path
    const document = await storage.getPatientDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (document.patientId !== patientId) {
      return res.status(403).json({ error: 'Document does not belong to this patient' });
    }
    
    // Delete the file from disk
    try {
      const filePath = path.join(process.cwd(), document.filePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (deleteError) {
      logError('Error deleting file from disk:', deleteError);
      // Continue with database deletion even if file delete fails
    }
    
    // Delete from database
    const deleted = await storage.deletePatientDocument(documentId);
    
    if (deleted) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ error: 'Failed to delete document from database' });
    }
  } catch (error) {
    logError('Error deleting patient document:', error);
    return res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Update document details (title, description, tags)
patientDocumentsRouter.patch('/:patientId/documents/:documentId', async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const documentId = parseInt(req.params.documentId);
    const { title, description, tags } = req.body;
    
    if (isNaN(patientId) || isNaN(documentId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }
    
    // Check if user is authenticated
    const userId = (req.session as any)?.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Get the document to check ownership
    const document = await storage.getPatientDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    if (document.patientId !== patientId) {
      return res.status(403).json({ error: 'Document does not belong to this patient' });
    }
    
    // Prepare updates
    const updates: Partial<typeof document> = {};
    
    if (title !== undefined) {
      updates.title = title;
    }
    
    if (description !== undefined) {
      updates.description = description;
    }
    
    if (tags !== undefined) {
      let parsedTags;
      try {
        parsedTags = Array.isArray(tags) ? tags : JSON.parse(tags);
      } catch (e) {
        parsedTags = tags.split(',').map(tag => tag.trim());
      }
      updates.tags = parsedTags;
    }
    
    // Update the document
    const updated = await storage.updatePatientDocument(documentId, updates);
    
    if (updated) {
      return res.json(updated);
    } else {
      return res.status(500).json({ error: 'Failed to update document' });
    }
  } catch (error) {
    logError('Error updating patient document:', error);
    return res.status(500).json({ error: 'Failed to update document' });
  }
});