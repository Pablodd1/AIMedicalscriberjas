import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { aiRouter } from "./routes/ai";
import { emailRouter } from "./routes/email";
import { monitoringRouter } from "./routes/monitoring";
import { labInterpreterRouter } from "./routes/lab-interpreter";
import { patientDocumentsRouter } from "./routes/patient-documents-updated";
import { adminRouter } from "./routes/admin";
import { 
  globalErrorHandler, 
  requireAuth, 
  sendErrorResponse, 
  sendSuccessResponse, 
  asyncHandler,
  validateRequestBody,
  handleDatabaseOperation,
  AppError
} from "./error-handler";
import multer from "multer";
import fs from "fs";
import path from "path";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

// Extend the global namespace to include our media storage
declare global {
  var mediaStorage: Map<string, {
    data: Buffer,
    contentType: string,
    filename: string
  }>;
}
import { 
  insertPatientSchema, 
  insertAppointmentSchema, 
  insertMedicalNoteSchema,
  insertConsultationNoteSchema,
  insertInvoiceSchema,
  insertIntakeFormSchema,
  insertIntakeFormResponseSchema,
  insertMedicalNoteTemplateSchema,
  insertWordTemplateSchema,
  type RecordingSession,
  type WordTemplate
} from "@shared/schema";

// Define the interface for telemedicine rooms
interface VideoChatRoom {
  id: string;
  participants: { 
    id: string;
    socket: WebSocket;
    name: string;
    isDoctor: boolean;
  }[];
}

// Store active rooms in memory
const activeRooms = new Map<string, VideoChatRoom>();

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Register AI routes
  app.use('/api/ai', aiRouter);
  
  // Register Email settings routes
  app.use('/api/settings', emailRouter);
  
  // Register Patient Monitoring routes
  app.use('/api/monitoring', monitoringRouter);
  
  // Register Lab Interpreter routes
  app.use('/api/lab-interpreter', labInterpreterRouter);
  
  // Register Patient Documents routes
  app.use('/api/patient-documents', requireAuth, patientDocumentsRouter);
  
  // Register Admin routes
  app.use('/api/admin', adminRouter);

  // Test error handling endpoint for validation
  app.get('/api/test-error', asyncHandler(async (req, res) => {
    throw new AppError('This is a test error', 400, 'TEST_ERROR');
  }));

  // Patients routes
  app.get("/api/patients", requireAuth, asyncHandler(async (req, res) => {
    const patients = await handleDatabaseOperation(
      () => storage.getPatients(req.user.id),
      'Failed to fetch patients'
    );
    sendSuccessResponse(res, patients);
  }));

  app.get("/api/patients/:id", requireAuth, asyncHandler(async (req, res) => {
    const patientId = parseInt(req.params.id);
    if (isNaN(patientId)) {
      throw new AppError('Invalid patient ID', 400, 'INVALID_PATIENT_ID');
    }
    
    const patient = await handleDatabaseOperation(
      () => storage.getPatient(patientId),
      'Failed to fetch patient'
    );
    
    if (!patient) {
      throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
    }
    
    sendSuccessResponse(res, patient);
  }));

  app.post("/api/patients", requireAuth, asyncHandler(async (req, res) => {
    const validation = validateRequestBody(insertPatientSchema, req.body);
    if (!validation.success) {
      throw new AppError(validation.error!, 400, 'VALIDATION_ERROR');
    }
    
    const patient = await handleDatabaseOperation(
      () => storage.createPatient({
        ...validation.data,
        createdBy: req.user.id,
      }),
      'Failed to create patient'
    );
    
    sendSuccessResponse(res, patient, 'Patient created successfully', 201);
  }));

  // Appointments routes
  app.get("/api/appointments", requireAuth, asyncHandler(async (req, res) => {
    const appointments = await handleDatabaseOperation(
      () => storage.getAppointments(req.user.id),
      'Failed to fetch appointments'
    );
    sendSuccessResponse(res, appointments);
  }));

  app.post("/api/appointments", requireAuth, asyncHandler(async (req, res) => {
    // Convert numeric timestamp to Date object for PostgreSQL timestamp
    let appointmentData = req.body;
    if (typeof appointmentData.date === 'number') {
      appointmentData = {
        ...appointmentData,
        date: new Date(appointmentData.date)
      };
    }

    const validation = validateRequestBody(insertAppointmentSchema, appointmentData);
    if (!validation.success) {
      throw new AppError(validation.error!, 400, 'VALIDATION_ERROR');
    }
    
    const appointment = await handleDatabaseOperation(
      () => storage.createAppointment({
        ...validation.data,
        doctorId: req.user.id,
      }),
      'Failed to create appointment'
    );
    
    sendSuccessResponse(res, appointment, 'Appointment created successfully', 201);
  }));

  // Update appointment status
  app.patch("/api/appointments/:id", requireAuth, asyncHandler(async (req, res) => {
    const appointmentId = parseInt(req.params.id);
    if (isNaN(appointmentId)) {
      throw new AppError('Invalid appointment ID', 400, 'INVALID_APPOINTMENT_ID');
    }
    
    const { status } = req.body;
    if (!status) {
      throw new AppError('Status is required', 400, 'STATUS_REQUIRED');
    }
    
    const updatedAppointment = await handleDatabaseOperation(
      () => storage.updateAppointmentStatus(appointmentId, status),
      'Failed to update appointment status'
    );
    
    if (!updatedAppointment) {
      throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
    }
    
    sendSuccessResponse(res, updatedAppointment, 'Appointment status updated successfully');
  }));

  // Medical Notes routes
  app.get("/api/medical-notes", requireAuth, asyncHandler(async (req, res) => {
    const notes = await handleDatabaseOperation(
      () => storage.getMedicalNotes(req.user.id),
      'Failed to fetch medical notes'
    );
    sendSuccessResponse(res, notes);
  }));

  app.get("/api/patients/:patientId/medical-notes", requireAuth, asyncHandler(async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) {
      throw new AppError('Invalid patient ID', 400, 'INVALID_PATIENT_ID');
    }
    
    const notes = await handleDatabaseOperation(
      () => storage.getMedicalNotesByPatient(patientId),
      'Failed to fetch medical notes'
    );
    
    sendSuccessResponse(res, notes);
  }));

  app.get("/api/patients/:patientId/lab-reports", requireAuth, asyncHandler(async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    if (isNaN(patientId)) {
      throw new AppError('Invalid patient ID', 400, 'INVALID_PATIENT_ID');
    }
    
    const labReports = await handleDatabaseOperation(
      () => storage.getLabReportsByPatient(patientId),
      'Failed to fetch lab reports'
    );
    
    sendSuccessResponse(res, labReports);
  }));

  app.get("/api/medical-notes/:id", async (req, res) => {
    const note = await storage.getMedicalNote(parseInt(req.params.id));
    if (!note) return res.sendStatus(404);
    res.json(note);
  });

  // Download medical note as Word document (with template support)
  app.get("/api/medical-notes/:id/download", requireAuth, asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.id);
    if (isNaN(noteId)) {
      throw new AppError('Invalid note ID', 400, 'INVALID_NOTE_ID');
    }

    const note = await handleDatabaseOperation(
      () => storage.getMedicalNote(noteId),
      'Failed to fetch medical note'
    );

    if (!note) {
      throw new AppError('Medical note not found', 404, 'NOTE_NOT_FOUND');
    }

    // Get patient info if available
    let patient = null;
    if (note.patientId) {
      patient = await handleDatabaseOperation(
        () => storage.getPatient(note.patientId!),
        'Failed to fetch patient'
      );
    }

    // Get doctor info
    const doctor = await handleDatabaseOperation(
      () => storage.getUser(note.doctorId),
      'Failed to fetch doctor'
    );

    // Check if user has uploaded a Word template for this note type
    const userTemplate = await handleDatabaseOperation(
      () => storage.getWordTemplateByOwnerAndType(req.user.id, note.type || 'soap'),
      'Failed to fetch word template'
    );

    try {
      let docxBuffer;
      const filename = `medical-note-${note.id}-${new Date().toISOString().split('T')[0]}.docx`;

      if (userTemplate) {
        // Use uploaded template with placeholder replacement

        try {
          // Read the template file
          const templatePath = path.join(process.cwd(), userTemplate.templatePath);
          if (!fs.existsSync(templatePath)) {
            console.warn(`Template file not found: ${templatePath}, falling back to default generation`);
            throw new Error('Template file not found');
          }

          const templateBuffer = fs.readFileSync(templatePath);
          const zip = new PizZip(templateBuffer);
          
          const doc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            errorLogging: false, // Disable error logging to prevent crashes
          });

          // Parse SOAP note content
          const soapSections = {
            SUBJECTIVE: '',
            OBJECTIVE: '',
            ASSESSMENT: '',
            PLAN: ''
          };

          // Extract SOAP sections from note content
          const content = note.content || '';
          const lines = content.split('\n');
          let currentSection = '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.toUpperCase().includes('SUBJECTIVE')) {
              currentSection = 'SUBJECTIVE';
              continue;
            } else if (trimmedLine.toUpperCase().includes('OBJECTIVE')) {
              currentSection = 'OBJECTIVE';
              continue;
            } else if (trimmedLine.toUpperCase().includes('ASSESSMENT')) {
              currentSection = 'ASSESSMENT';
              continue;
            } else if (trimmedLine.toUpperCase().includes('PLAN')) {
              currentSection = 'PLAN';
              continue;
            }

            if (currentSection && trimmedLine && !trimmedLine.startsWith('-')) {
              if (soapSections[currentSection]) {
                soapSections[currentSection] += '\n' + trimmedLine;
              } else {
                soapSections[currentSection] = trimmedLine;
              }
            }
          }

          // Prepare template data
          const patientName = patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : 'Unknown Patient';
          const providerName = doctor ? doctor.name : 'Unknown Provider';
          
          const templateData = {
            NAME: patientName,
            DATE: new Date().toLocaleDateString(),
            PROVIDER: providerName,
            SUBJECTIVE: soapSections.SUBJECTIVE || 'No subjective findings documented.',
            OBJECTIVE: soapSections.OBJECTIVE || 'No objective findings documented.',
            ASSESSMENT: soapSections.ASSESSMENT || 'No assessment documented.',
            PLAN: soapSections.PLAN || 'No plan documented.'
          };

          // Replace placeholders
          doc.render(templateData);
          docxBuffer = doc.getZip().generate({ type: 'nodebuffer' });

        } catch (templateError) {
          console.log('Template processing failed, falling back to default generation. Error:', templateError.message);
          // Don't throw - let it fall through to default generation
          docxBuffer = null;
        }
      }

      // Fallback to default document generation if no template or template processing failed
      if (!docxBuffer) {
        const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
        
        const docSections = [];
        
        // Title
        docSections.push(
          new Paragraph({
            text: note.title || "Medical Note",
            heading: HeadingLevel.TITLE,
          })
        );
        
        // Note type and date info
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${note.type?.toUpperCase() || 'MEDICAL'} Note • Generated ${new Date().toLocaleDateString()}`,
                italics: true,
                size: 20,
              }),
            ],
          })
        );
        
        docSections.push(new Paragraph({ text: "" })); // Empty line
        
        // Patient information if available
        if (patient) {
          docSections.push(
            new Paragraph({
              text: "Patient Information",
              heading: HeadingLevel.HEADING_1,
            })
          );
          
          const patientName = `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
          if (patientName) {
            docSections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "Name: ", bold: true }),
                  new TextRun({ text: patientName }),
                ],
              })
            );
          }
          
          if (patient.email) {
            docSections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "Email: ", bold: true }),
                  new TextRun({ text: patient.email }),
                ],
              })
            );
          }
          
          if (patient.phone) {
            docSections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: "Phone: ", bold: true }),
                  new TextRun({ text: patient.phone }),
                ],
              })
            );
          }
          
          docSections.push(new Paragraph({ text: "" })); // Empty line
        }
        
        // Note content
        docSections.push(
          new Paragraph({
            text: "Medical Note Content",
            heading: HeadingLevel.HEADING_1,
          })
        );
        
        // Split content by lines and create paragraphs
        const contentLines = (note.content || '').split('\n');
        contentLines.forEach(line => {
          docSections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: line,
                  size: 24,
                }),
              ],
            })
          );
        });
        
        // Add timestamp
        docSections.push(new Paragraph({ text: "" })); // Empty line
        docSections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Created: ${note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Unknown'}`,
                italics: true,
                size: 20,
              }),
            ],
          })
        );
        
        // Create the document
        const doc = new Document({
          sections: [{
            properties: {},
            children: docSections,
          }],
        });
        
        // Generate the DOCX buffer
        docxBuffer = await Packer.toBuffer(doc);
      }
      
      // Set headers and send file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(docxBuffer);
      
    } catch (error) {
      console.error('Error generating medical note document:', error);
      throw new AppError('Failed to generate document', 500, 'DOCUMENT_GENERATION_FAILED');
    }
  }));

  app.post("/api/medical-notes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const validation = insertMedicalNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    
    // Verify patient exists
    if (validation.data.patientId) {
      const patient = await storage.getPatient(validation.data.patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
    }
    
    const note = await storage.createMedicalNote({
      ...validation.data,
      doctorId: doctorId,
    });
    
    res.status(201).json(note);
  });
  
  // Quick Notes routes (notes without patient association)
  app.get("/api/quick-notes", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      const notes = await storage.getQuickNotes(doctorId);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching quick notes:", error);
      res.status(500).json({ message: "Failed to fetch quick notes" });
    }
  });
  
  app.post("/api/quick-notes", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      // Create a modified schema for quick notes that doesn't require patientId
      const quickNoteData = {
        ...req.body,
        doctorId: doctorId,
        isQuickNote: true
      };
      
      const note = await storage.createQuickNote(quickNoteData);
      res.status(201).json(note);
    } catch (error: any) {
      console.error("Error creating quick note:", error);
      res.status(400).json({ message: "Failed to create quick note", error: error.message });
    }
  });

  // Consultation Notes routes
  app.get("/api/consultation-notes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const notes = await storage.getConsultationNotes(doctorId);
    res.json(notes);
  });
  
  app.get("/api/patients/:patientId/consultation-notes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const patientId = parseInt(req.params.patientId);
    const patient = await storage.getPatient(patientId);
    if (!patient) return res.sendStatus(404);
    
    const notes = await storage.getConsultationNotesByPatient(patientId);
    res.json(notes);
  });
  
  app.get("/api/consultation-notes/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const noteId = parseInt(req.params.id);
    if (isNaN(noteId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const note = await storage.getConsultationNote(noteId);
    if (!note) return res.sendStatus(404);
    res.json(note);
  });
  
  app.post("/api/consultation-notes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const validation = insertConsultationNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    
    // Verify patient exists
    const patient = await storage.getPatient(validation.data.patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    const note = await storage.createConsultationNote({
      ...validation.data,
      doctorId: doctorId,
    });
    
    res.status(201).json(note);
  });
  
  // Create medical note from consultation
  app.post("/api/medical-notes/from-consultation", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    // Extract required fields from request
    const { consultationId, patientId, content, type, title } = req.body;
    
    // Basic validation
    if (!consultationId || !patientId || !content || !title) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    
    try {
      const consultationIdNum = parseInt(consultationId);
      if (isNaN(consultationIdNum)) {
        return res.status(400).json({ message: "Invalid consultation ID format" });
      }
      
      // Create a medical note linked to the consultation
      const medicalNote = await storage.createMedicalNoteFromConsultation(
        {
          patientId,
          doctorId: doctorId,
          content,
          type: type || 'soap',
          title
        },
        consultationIdNum
      );
      
      res.status(201).json(medicalNote);
    } catch (error: any) {
      console.error("Error creating medical note from consultation:", error);
      res.status(500).json({ message: "Failed to create medical note from consultation" });
    }
  });
  
  // Medical Note Templates routes
  app.get("/api/medical-note-templates", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const templates = await storage.getMedicalNoteTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching medical note templates:", error);
      res.status(500).json({ message: "Failed to fetch medical note templates" });
    }
  });
  
  app.get("/api/medical-note-templates/type/:type", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const type = req.params.type;
      const templates = await storage.getMedicalNoteTemplatesByType(type);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching medical note templates by type:", error);
      res.status(500).json({ message: "Failed to fetch medical note templates" });
    }
  });
  
  app.get("/api/medical-note-templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      const template = await storage.getMedicalNoteTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(template);
    } catch (error) {
      console.error("Error fetching medical note template:", error);
      res.status(500).json({ message: "Failed to fetch medical note template" });
    }
  });
  
  app.post("/api/medical-note-templates", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const validation = insertMedicalNoteTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const template = await storage.createMedicalNoteTemplate(validation.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating medical note template:", error);
      res.status(500).json({ message: "Failed to create medical note template" });
    }
  });
  
  app.put("/api/medical-note-templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      const template = await storage.getMedicalNoteTemplate(id);
      
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      const updatedTemplate = await storage.updateMedicalNoteTemplate(id, req.body);
      res.json(updatedTemplate);
    } catch (error) {
      console.error("Error updating medical note template:", error);
      res.status(500).json({ message: "Failed to update medical note template" });
    }
  });
  
  app.delete("/api/medical-note-templates/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      const result = await storage.deleteMedicalNoteTemplate(id);
      
      if (!result) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.sendStatus(204);
    } catch (error) {
      console.error("Error deleting medical note template:", error);
      res.status(500).json({ message: "Failed to delete medical note template" });
    }
  });

  // Word Templates routes for SOAP note document templates
  const wordTemplateUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit for Word templates
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        cb(null, true);
      } else {
        cb(new Error('Only .docx files are allowed'));
      }
    }
  });

  app.get("/api/word-templates", requireAuth, asyncHandler(async (req, res) => {
    const templates = await handleDatabaseOperation(
      () => storage.getWordTemplates(req.user.id),
      'Failed to fetch word templates'
    );
    sendSuccessResponse(res, templates);
  }));

  app.post("/api/word-templates/upload", requireAuth, asyncHandler(async (req, res) => {
    wordTemplateUpload.single('template')(req, res, async (err) => {
      if (err) {
        throw new AppError(err.message, 400, 'FILE_UPLOAD_ERROR');
      }

      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'NO_FILE_UPLOADED');
      }

      const { type = 'soap' } = req.body;

      // Create unique filename
      const timestamp = Date.now();
      const filename = `template_${req.user.id}_${timestamp}.docx`;
      const templatePath = `uploads/templates/${filename}`;

      // In production, we would save to file system or cloud storage
      // For now, we'll store the file data in a simple way
      try {
        // Create uploads directory if it doesn't exist
        const uploadDir = path.join(process.cwd(), 'uploads', 'templates');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Save file to disk
        fs.writeFileSync(path.join(process.cwd(), templatePath), req.file.buffer);

        // Save template metadata to database
        const templateData = {
          ownerId: req.user.id,
          type: type as any,
          templatePath,
          originalFilename: req.file.originalname,
          mimeType: req.file.mimetype,
          isActive: true
        };

        const template = await handleDatabaseOperation(
          () => storage.createWordTemplate(templateData),
          'Failed to save template'
        );

        sendSuccessResponse(res, template, 'Template uploaded successfully', 201);
      } catch (fileError) {
        console.error('Error saving template file:', fileError);
        throw new AppError('Failed to save template file', 500, 'FILE_SAVE_ERROR');
      }
    });
  }));

  app.get("/api/word-templates/sample", requireAuth, asyncHandler(async (req, res) => {

    try {
      // Create a basic Word document structure
      const zip = new PizZip();
      
      // Add required files for a minimal Word document
      
      // Content Types
      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

      // Main relationships
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

      // Word relationships
      zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

      // Styles
      zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
        <w:sz w:val="24"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:after="300"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="32"/>
    </w:rPr>
  </w:style>
</w:styles>`);

      // Main document with placeholders
      zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="28"/>
        </w:rPr>
        <w:t>Medical Practice SOAP Note</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>Patient: </w:t>
      </w:r>
      <w:r>
        <w:t>{{NAME}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>Date: </w:t>
      </w:r>
      <w:r>
        <w:t>{{DATE}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
        </w:rPr>
        <w:t>Provider: </w:t>
      </w:r>
      <w:r>
        <w:t>{{PROVIDER}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t>SUBJECTIVE:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>{{SUBJECTIVE}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t>OBJECTIVE:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>{{OBJECTIVE}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t>ASSESSMENT:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>{{ASSESSMENT}}</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:p>
    <w:p>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t>PLAN:</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:t>{{PLAN}}</w:t>
      </w:r>
    </w:p>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`);

      // Generate the Word document
      const buffer = zip.generate({ type: 'nodebuffer' });

      // Set headers for file download
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="soap-note-template-sample.docx"');
      res.setHeader('Content-Length', buffer.length);

      // Send the Word document
      res.send(buffer);
    } catch (error) {
      console.error('Error creating sample template:', error);
      throw new AppError('Failed to create sample template', 500, 'SAMPLE_TEMPLATE_ERROR');
    }
  }));

  app.delete("/api/word-templates/:id", requireAuth, asyncHandler(async (req, res) => {
    const templateId = parseInt(req.params.id);
    if (isNaN(templateId)) {
      throw new AppError('Invalid template ID', 400, 'INVALID_TEMPLATE_ID');
    }

    // Get template to check ownership and get file path
    const template = await handleDatabaseOperation(
      () => storage.getWordTemplate(templateId),
      'Failed to fetch template'
    );

    if (!template) {
      throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Check ownership
    if (template.ownerId !== req.user.id) {
      throw new AppError('Unauthorized to delete this template', 403, 'UNAUTHORIZED_DELETE');
    }

    // Delete file from disk
    try {
      const filePath = path.join(process.cwd(), template.templatePath);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fileError) {
      console.warn('Failed to delete template file:', fileError);
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    const result = await handleDatabaseOperation(
      () => storage.deleteWordTemplate(templateId),
      'Failed to delete template'
    );

    if (!result) {
      throw new AppError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    sendSuccessResponse(res, { success: true }, 'Template deleted successfully');
  }));

  // User API Key management routes
  app.get("/api/user/api-key", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only return API key info if user is configured to use their own API key
      if (!user.useOwnApiKey) {
        return res.json({ 
          canUseOwnApiKey: false, 
          useOwnApiKey: false,
          message: "Your account is configured to use the global API key. Contact your administrator to enable personal API key usage." 
        });
      }
      
      const apiKey = await storage.getUserApiKey(userId);
      
      // Return masked key for security (only show first 6 chars)
      const maskedKey = apiKey ? `${apiKey.substring(0, 6)}...` : null;
      res.json({ 
        canUseOwnApiKey: true,
        useOwnApiKey: true,
        hasApiKey: !!apiKey, 
        maskedKey 
      });
    } catch (error) {
      console.error("Error fetching user API key:", error);
      res.status(500).json({ message: "Failed to fetch API key" });
    }
  });

  app.post("/api/user/api-key", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { apiKey } = req.body;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is allowed to use their own API key
      if (!user.useOwnApiKey) {
        return res.status(403).json({ 
          message: "Your account is not configured to use personal API keys. Contact your administrator to enable this feature." 
        });
      }
      
      if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ message: "Valid API key is required" });
      }
      
      // Basic validation for OpenAI API key format
      if (!apiKey.startsWith('sk-') || apiKey.length < 40) {
        return res.status(400).json({ message: "Invalid OpenAI API key format" });
      }
      
      await storage.updateUserApiKey(userId, apiKey);
      res.json({ success: true, message: "API key updated successfully" });
    } catch (error) {
      console.error("Error updating user API key:", error);
      res.status(500).json({ message: "Failed to update API key" });
    }
  });

  // Delete user API key
  app.delete("/api/user/api-key", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is allowed to use their own API key
      if (!user.useOwnApiKey) {
        return res.status(403).json({ 
          message: "Your account is not configured to use personal API keys. Contact your administrator to enable this feature." 
        });
      }
      
      await storage.updateUserApiKey(userId, null);
      res.json({ success: true, message: "API key removed successfully" });
    } catch (error) {
      console.error("Error removing user API key:", error);
      res.status(500).json({ message: "Failed to remove API key" });
    }
  });

  app.delete("/api/user/api-key", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user is allowed to manage their own API key
      if (!user.useOwnApiKey) {
        return res.status(403).json({ 
          message: "Your account is not configured to use personal API keys. Contact your administrator to enable this feature." 
        });
      }
      
      await storage.updateUserApiKey(userId, null);
      res.json({ success: true, message: "API key removed successfully" });
    } catch (error) {
      console.error("Error removing user API key:", error);
      res.status(500).json({ message: "Failed to remove API key" });
    }
  });

  // Telemedicine routes
  
  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      const invoices = await storage.getInvoices(doctorId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/patient/:patientId", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const patientId = parseInt(req.params.patientId);
      const invoices = await storage.getInvoicesByPatient(patientId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching patient invoices:", error);
      res.status(500).json({ message: "Failed to fetch patient invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const invoiceId = parseInt(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      // Create a modified request body to ensure proper types
      let dueDate;
      try {
        // Try to parse the date string in a simpler format
        if (typeof req.body.dueDate === 'string') {
          // If it's a simple YYYY-MM-DD format
          if (req.body.dueDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dueDate = new Date(req.body.dueDate);
          } else {
            // Try to extract just the date part
            const dateParts = req.body.dueDate.split(/[^0-9]/);
            if (dateParts.length >= 3) {
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-based
              const day = parseInt(dateParts[2]);
              dueDate = new Date(year, month, day);
            } else {
              dueDate = new Date(); // Fallback to current date if parsing fails
            }
          }
        } else {
          dueDate = new Date(req.body.dueDate);
        }
      } catch (e) {
        console.error("Error parsing date:", e);
        dueDate = new Date(); // Fallback to current date
      }
      
      const modifiedBody = {
        ...req.body,
        doctorId: doctorId,
        // Set the parsed date
        dueDate: dueDate
      };
      
      const validation = insertInvoiceSchema.safeParse(modifiedBody);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const invoice = await storage.createInvoice(validation.data);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id/status", async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const { status } = req.body;
      
      const invoice = await storage.updateInvoiceStatus(invoiceId, status);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice status:", error);
      res.status(500).json({ message: "Failed to update invoice status" });
    }
  });

  app.patch("/api/invoices/:id/payment", async (req, res) => {
    try {
      const invoiceId = parseInt(req.params.id);
      const { amountPaid } = req.body;
      
      const invoice = await storage.updateInvoicePayment(invoiceId, amountPaid);
      
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice payment:", error);
      res.status(500).json({ message: "Failed to update invoice payment" });
    }
  });

  app.get('/api/telemedicine/rooms', (req, res) => {
    // For development, we're not requiring authentication
    // This would be required in production: if (!req.isAuthenticated()) {
    //  return res.status(401).json({ message: 'Unauthorized' });
    // }
    
    // Convert activeRooms to array of room objects (without socket objects for serialization)
    const rooms = Array.from(activeRooms.entries()).map(([id, room]) => ({
      id,
      participants: room.participants.map(p => ({
        id: p.id,
        name: p.name,
        isDoctor: p.isDoctor
      }))
    }));
    
    res.json(rooms);
  });
  
  // Get recording sessions (history of telemedicine consultations)
  app.get('/api/telemedicine/recordings', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      const recordings = await storage.getRecordingSessions(doctorId);
      
      // Get patient details for each recording
      const recordingsWithPatients = await Promise.all(
        recordings.map(async (recording) => {
          const patient = await storage.getPatient(recording.patientId);
          return {
            ...recording,
            patient: patient || null
          };
        })
      );
      
      res.json(recordingsWithPatients);
    } catch (error) {
      console.error('Error fetching recording sessions:', error);
      res.status(500).json({ message: 'Failed to fetch recording sessions' });
    }
  });
  
  // Get a specific recording session
  app.get('/api/telemedicine/recordings/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      const recording = await storage.getRecordingSession(id);
      if (!recording) {
        return res.status(404).json({ message: 'Recording session not found' });
      }
      
      const patient = await storage.getPatient(recording.patientId);
      
      res.json({
        ...recording,
        patient: patient || { name: 'Unknown Patient' }
      });
    } catch (error) {
      console.error('Error fetching recording session:', error);
      res.status(500).json({ message: 'Failed to fetch recording session' });
    }
  });
  
  // Update transcript or notes for a recording session
  app.patch('/api/telemedicine/recordings/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      const { transcript, notes } = req.body;
      if (!transcript && !notes) {
        return res.status(400).json({ message: 'Must provide transcript or notes to update' });
      }
      
      const updates: Partial<RecordingSession> = {};
      if (transcript) updates.transcript = transcript;
      if (notes) updates.notes = notes;
      
      const updatedRecording = await storage.updateRecordingSession(id, updates);
      if (!updatedRecording) {
        return res.status(404).json({ message: 'Recording session not found' });
      }
      
      res.json(updatedRecording);
    } catch (error) {
      console.error('Error updating recording session:', error);
      res.status(500).json({ message: 'Failed to update recording session' });
    }
  });
  
  // Delete a recording session
  app.delete('/api/telemedicine/recordings/:id', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const doctorId = req.user.id;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      const recording = await storage.getRecordingSession(id);
      
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      // Security check: Only allow the doctor who owns the recording to delete it
      if (recording.doctorId !== doctorId) {
        return res.status(403).json({ message: 'Not authorized to delete this recording' });
      }
      
      // Delete the recording
      const deleted = await storage.deleteRecordingSession(id);
      
      if (!deleted) {
        return res.status(500).json({ message: 'Failed to delete recording' });
      }
      
      res.status(200).json({ message: 'Recording deleted successfully' });
    } catch (error) {
      console.error('Error deleting recording:', error);
      res.status(500).json({ message: 'Failed to delete recording' });
    }
  });
  
  // Upload media (audio or video) for a telemedicine recording
  app.post('/api/telemedicine/recordings/:id/media', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const doctorId = req.user.id;
      const recordingId = parseInt(req.params.id);
      
      if (isNaN(recordingId)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      // Set up multer for file handling
      const multerStorage = multer.memoryStorage();
      const upload = multer({ 
        storage: multerStorage,
        limits: {
          fileSize: 100 * 1024 * 1024, // 100MB limit for video files
        }
      }).single('media');
      
      // Handle the file upload
      upload(req, res, async (err: any) => {
        if (err) {
          console.error('Multer error:', err);
          return res.status(400).json({ message: 'File upload failed', error: err.message });
        }
        
        if (!req.file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }
        
        // Get the recording session
        const recording = await storage.getRecordingSession(recordingId);
        
        if (!recording) {
          return res.status(404).json({ message: 'Recording not found' });
        }
        
        // Security check: Only allow the doctor who owns the recording to upload to it
        if (recording.doctorId !== doctorId) {
          return res.status(403).json({ message: 'You do not have permission to modify this recording' });
        }
        
        const mediaType = req.body.type || 'audio';
        const fileBuffer = req.file.buffer;
        
        // In a production environment, we would store the file in blob storage
        // and update the database with the URL. For now, we'll store the data temporarily.
        
        // Create a simple temporary storage system (this is just for demo purposes)
        if (typeof global.mediaStorage === 'undefined') {
          // Define mediaStorage on global object
          global.mediaStorage = new Map<string, {
            data: Buffer,
            contentType: string,
            filename: string
          }>();
        }
        
        // Store the media file with a unique key based on recording ID and type
        const storageKey = `${recordingId}_${mediaType}`;
        global.mediaStorage.set(storageKey, {
          data: fileBuffer,
          contentType: req.file.mimetype,
          filename: req.file.originalname
        });
        
        // Update the recording session with the appropriate URL
        const updateData: any = {};
        if (mediaType === 'audio') {
          updateData.audioUrl = `/api/telemedicine/recordings/${recordingId}/audio`;
        } else {
          updateData.videoUrl = `/api/telemedicine/recordings/${recordingId}/video`;
        }
        
        // Update the database record
        await storage.updateRecordingSession(recordingId, updateData);
        
        res.status(200).json({ 
          message: `${mediaType} recording uploaded successfully`,
          recordingId
        });
      });
    } catch (error) {
      console.error(`Error uploading recording:`, error);
      res.status(500).json({ message: 'Failed to upload recording' });
    }
  });

  // Retrieve audio recording for a telemedicine session
  app.get('/api/telemedicine/recordings/:id/audio', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const doctorId = req.user.id;
      const recordingId = parseInt(req.params.id);
      
      if (isNaN(recordingId)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      const recording = await storage.getRecordingSession(recordingId);
      
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      // Security check: Only allow the doctor who owns the recording to access it
      if (recording.doctorId !== doctorId) {
        return res.status(403).json({ message: 'You do not have permission to access this recording' });
      }
      
      // Check if the recording exists in our temporary storage
      if (global.mediaStorage && global.mediaStorage.has(`${recordingId}_audio`)) {
        const mediaFile = global.mediaStorage.get(`${recordingId}_audio`);
        if (mediaFile) {
          res.setHeader('Content-Type', mediaFile.contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${mediaFile.filename}"`);
          return res.send(mediaFile.data);
        }
      }
      
      // If not found in our temporary storage, return a not found response
      res.status(404).json({ message: 'Audio recording not available yet' });
    } catch (error) {
      console.error('Error retrieving audio recording:', error);
      res.status(500).json({ message: 'Failed to retrieve audio recording' });
    }
  });
  
  // Retrieve video recording for a telemedicine session
  app.get('/api/telemedicine/recordings/:id/video', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const doctorId = req.user.id;
      const recordingId = parseInt(req.params.id);
      
      if (isNaN(recordingId)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      const recording = await storage.getRecordingSession(recordingId);
      
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      // Security check: Only allow the doctor who owns the recording to access it
      if (recording.doctorId !== doctorId) {
        return res.status(403).json({ message: 'You do not have permission to access this recording' });
      }
      
      // Check if the video exists in our temporary storage
      if (global.mediaStorage && global.mediaStorage.has(`${recordingId}_video`)) {
        const mediaFile = global.mediaStorage.get(`${recordingId}_video`);
        if (mediaFile) {
          res.setHeader('Content-Type', mediaFile.contentType);
          res.setHeader('Content-Disposition', `attachment; filename="${mediaFile.filename}"`);
          return res.send(mediaFile.data);
        }
      }
      
      // If not found in our temporary storage, return a not found response
      res.status(404).json({ message: 'Video recording not available yet' });
    } catch (error) {
      console.error('Error retrieving video recording:', error);
      res.status(500).json({ message: 'Failed to retrieve video recording' });
    }
  });
  
  // Store video recording for a telemedicine session
  app.post('/api/telemedicine/recordings/:id/video', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const doctorId = req.user.id;
      const recordingId = parseInt(req.params.id);
      
      if (isNaN(recordingId)) {
        return res.status(400).json({ message: 'Invalid recording ID format' });
      }
      
      const recording = await storage.getRecordingSession(recordingId);
      
      if (!recording) {
        return res.status(404).json({ message: 'Recording not found' });
      }
      
      // Security check: Only allow the doctor who owns the recording to modify it
      if (recording.doctorId !== doctorId) {
        return res.status(403).json({ message: 'You do not have permission to modify this recording' });
      }
      
      // In a production environment, we would:
      // 1. Get the video file from the request
      // 2. Store it in blob storage
      // 3. Update the recording record with the URL
      
      // For now, update the recording to indicate it has video
      const updatedRecording = await storage.updateRecordingSession(recordingId, {
        recordingType: req.body.hasVideo ? 'both' : 'audio',
        mediaFormat: req.body.mediaFormat || 'webm',
        videoUrl: req.body.videoUrl || null
      });
      
      res.status(200).json(updatedRecording);
    } catch (error) {
      console.error('Error storing video recording:', error);
      res.status(500).json({ message: 'Failed to store video recording' });
    }
  });
  
  app.post('/api/telemedicine/rooms', async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const { patientId, patientName } = req.body;
    
    if (!patientId || !patientName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Generate room ID
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    try {
      // Create new room
      activeRooms.set(roomId, {
        id: roomId,
        participants: []
      });
      
      // Create recording session in database
      const recordingSession = await storage.createRecordingSession({
        roomId,
        patientId,
        doctorId: doctorId,
        status: 'active',
        transcript: null,
        notes: null
      });
      
      res.status(201).json({ roomId, recordingSessionId: recordingSession.id });
    } catch (error) {
      console.error('Error creating telemedicine room:', error);
      res.status(500).json({ message: 'Failed to create telemedicine room' });
    }
  });
  
  const httpServer = createServer(app);
  
  // Create WebSocket server on the same HTTP server but with a distinct path
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws/telemedicine'
  });
  
  wss.on('connection', (socket: any) => {
    console.log('New WebSocket connection established');
    
    // Initialize participant data
    let participantId: string | null = null;
    let roomId: string | null = null;
    
    socket.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'join':
            // User joining a room
            roomId = data.roomId;
            participantId = data.userId;
            const room = activeRooms.get(roomId as string);
            
            if (!room) {
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Room not found'
              }));
              return;
            }
            
            // Add participant to room
            room.participants.push({
              id: data.userId,
              socket,
              name: data.name,
              isDoctor: data.isDoctor
            });
            
            // Notify other participants in the room about the new participant
            room.participants.forEach(participant => {
              if (participant.id !== data.userId) {
                participant.socket.send(JSON.stringify({
                  type: 'user-joined',
                  userId: data.userId,
                  name: data.name,
                  isDoctor: data.isDoctor
                }));
              }
            });
            
            // Send the list of existing participants to the new participant
            socket.send(JSON.stringify({
              type: 'room-users',
              users: room.participants.map(p => ({
                id: p.id,
                name: p.name,
                isDoctor: p.isDoctor
              }))
            }));
            
            break;
            
          case 'offer':
          case 'answer':
          case 'ice-candidate':
          case 'chat-message':
            // Handle WebRTC signaling and chat messages
            
            // Make sure roomId is taken from message if not already set in socket connection
            const messageRoomId = data.roomId || roomId;
            if (!messageRoomId) {
              console.error('No room ID found in message or socket state:', data);
              socket.send(JSON.stringify({
                type: 'error',
                message: 'No room ID provided. Please join a room first.'
              }));
              return;
            }
            
            const targetRoom = activeRooms.get(messageRoomId);
            if (!targetRoom) {
              console.error('Room not found with ID:', messageRoomId);
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Room not found with ID: ' + messageRoomId
              }));
              return;
            }
            
            // For chat messages, broadcast to all participants in the room
            if (data.type === 'chat-message') {
              console.log('Broadcasting chat message in room:', messageRoomId);
              targetRoom.participants.forEach(participant => {
                if (participant.id !== data.sender) {
                  participant.socket.send(JSON.stringify({
                    type: 'chat-message',
                    sender: data.sender,
                    senderName: data.senderName,
                    text: data.text,
                    roomId: messageRoomId
                  }));
                }
              });
              break;
            }
            
            // For WebRTC signals, find the target participant
            const targetParticipant = targetRoom.participants.find(p => p.id === data.target);
            if (targetParticipant) {
              // Forward the WebRTC signaling message with proper formatting
              // Always pass the roomId to ensure proper room tracking
              if (data.type === 'offer') {
                console.log('Server forwarding offer with room ID:', messageRoomId);
                targetParticipant.socket.send(JSON.stringify({
                  type: 'offer',
                  from: data.sender,
                  roomId: messageRoomId,
                  offer: data.data
                }));
              } else if (data.type === 'answer') {
                console.log('Server forwarding answer with room ID:', messageRoomId);
                targetParticipant.socket.send(JSON.stringify({
                  type: 'answer',
                  from: data.sender,
                  roomId: messageRoomId,
                  answer: data.data
                }));
              } else if (data.type === 'ice-candidate') {
                console.log('Server forwarding ICE candidate with room ID:', messageRoomId);
                targetParticipant.socket.send(JSON.stringify({
                  type: 'ice-candidate',
                  from: data.sender,
                  roomId: messageRoomId,
                  candidate: data.data
                }));
              }
            } else {
              console.log('Target participant not found:', data.target);
            }
            break;
            
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    socket.on('close', async () => {
      console.log('WebSocket connection closed');
      
      // Remove participant from room when they disconnect
      if (roomId && participantId) {
        const room = activeRooms.get(roomId as string);
        if (room) {
          // Remove participant
          room.participants = room.participants.filter(p => p.id !== participantId);
          
          // Notify other participants
          room.participants.forEach(participant => {
            participant.socket.send(JSON.stringify({
              type: 'user-left',
              userId: participantId
            }));
          });
          
          // If room is empty, delete it and update recording session
          if (room.participants.length === 0) {
            activeRooms.delete(roomId);
            
            try {
              // Get recording session by room ID
              const session = await storage.getRecordingSessionByRoomId(roomId);
              if (session) {
                // Update session with end time and status
                const endTime = new Date();
                const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000); // in seconds
                
                await storage.updateRecordingSession(session.id, {
                  endTime,
                  duration,
                  status: 'completed'
                });
              }
            } catch (error) {
              console.error('Error updating recording session on room close:', error);
            }
          }
        }
      }
    });
  });

  // Patient intake form routes
  app.get("/api/intake-forms", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      const forms = await storage.getIntakeForms(doctorId);
      res.json(forms);
    } catch (error: any) {
      console.error("Error fetching intake forms:", error);
      res.status(500).json({ message: "Failed to fetch intake forms" });
    }
  });
  
  app.get("/api/intake-forms/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const formId = parseInt(req.params.id);
      if (isNaN(formId)) {
        return res.status(400).json({ message: "Invalid ID format" });
      }
      
      const form = await storage.getIntakeForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Intake form not found" });
      }
      
      // Get responses for this form
      const responses = await storage.getIntakeFormResponses(formId);
      
      res.json({
        ...form,
        responses
      });
    } catch (error: any) {
      console.error("Error fetching intake form:", error);
      res.status(500).json({ message: "Failed to fetch intake form" });
    }
  });
  
  app.post("/api/intake-forms", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      console.log("Creating intake form with data:", req.body);

      // Set the authenticated doctor ID
      req.body.doctorId = doctorId;

      if (!req.body.uniqueLink) {
        // Generate a unique link for the form if not provided
        req.body.uniqueLink = `intake_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }

      if (!req.body.status) {
        req.body.status = "pending"; // Set default status
      }

      // One week expiration by default if not set
      if (!req.body.expiresAt) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        req.body.expiresAt = expiresAt;
      }
      
      const validation = insertIntakeFormSchema.safeParse(req.body);
      if (!validation.success) {
        console.error("Validation error:", validation.error.format());
        return res.status(400).json({
          message: "Invalid form data",
          issues: validation.error.format()
        });
      }
      
      const intakeForm = await storage.createIntakeForm(validation.data);
      
      res.status(201).json(intakeForm);
    } catch (error: any) {
      console.error("Error creating intake form:", error);
      res.status(500).json({ message: "Failed to create intake form: " + (error.message || "Unknown error") });
    }
  });
  
  // Public endpoint to access the intake form by its unique link
  app.get("/api/public/intake-form/:uniqueLink", async (req, res) => {
    try {
      const { uniqueLink } = req.params;
      
      const form = await storage.getIntakeFormByLink(uniqueLink);
      if (!form) {
        return res.status(404).json({ message: "Intake form not found" });
      }
      
      // Check if form is expired
      if (form.status === "expired" || (form.expiresAt && new Date(form.expiresAt) < new Date())) {
        return res.status(403).json({ message: "This intake form has expired" });
      }
      
      // Check if form is already completed
      if (form.status === "completed") {
        return res.status(403).json({ message: "This intake form has already been completed" });
      }
      
      // Get existing responses for this form
      const responses = await storage.getIntakeFormResponses(form.id);
      
      res.json({
        ...form,
        responses
      });
    } catch (error: any) {
      console.error("Error fetching public intake form:", error);
      res.status(500).json({ message: "Failed to fetch intake form" });
    }
  });
  
  // Submit response for a specific intake form
  app.post("/api/public/intake-form/:formId/responses", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      
      if (isNaN(formId)) {
        return res.status(400).json({ message: "Invalid form ID" });
      }
      
      // Make sure the form exists and is valid for submission
      const form = await storage.getIntakeForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Intake form not found" });
      }
      
      // Check if form is expired or completed
      if (form.status === "expired" || form.status === "completed") {
        return res.status(403).json({ message: "This intake form cannot accept responses" });
      }
      
      // Validate the response data
      const responseData = {
        ...req.body,
        formId
      };
      
      const validation = insertIntakeFormResponseSchema.safeParse(responseData);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      // Save the response
      const response = await storage.createIntakeFormResponse(validation.data);
      
      res.status(201).json(response);
    } catch (error: any) {
      console.error("Error saving intake form response:", error);
      res.status(500).json({ message: "Failed to save response" });
    }
  });
  
  // Complete an intake form
  app.post("/api/public/intake-form/:formId/complete", async (req, res) => {
    try {
      const formId = parseInt(req.params.formId);
      
      if (isNaN(formId)) {
        return res.status(400).json({ message: "Invalid form ID" });
      }
      
      // Make sure the form exists
      const form = await storage.getIntakeForm(formId);
      if (!form) {
        return res.status(404).json({ message: "Intake form not found" });
      }
      
      // Update the form status to completed
      const updatedForm = await storage.updateIntakeFormStatus(formId, "completed");
      
      res.json(updatedForm);
    } catch (error: any) {
      console.error("Error completing intake form:", error);
      res.status(500).json({ message: "Failed to complete intake form" });
    }
  });

  // Medical Alerts routes
  app.get('/api/patients/:patientId/medical-alerts', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const alerts = await handleDatabaseOperation(() => 
      storage.getMedicalAlertsByPatient(patientId)
    );
    sendSuccessResponse(res, alerts);
  }));

  app.post('/api/patients/:patientId/medical-alerts', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const user = req.user!;
    const alertData = {
      ...req.body,
      patientId,
      createdBy: user.id
    };
    const alert = await handleDatabaseOperation(() => 
      storage.createMedicalAlert(alertData)
    );
    sendSuccessResponse(res, alert);
  }));

  app.put('/api/medical-alerts/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const alert = await handleDatabaseOperation(() => 
      storage.updateMedicalAlert(id, req.body)
    );
    sendSuccessResponse(res, alert);
  }));

  app.delete('/api/medical-alerts/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await handleDatabaseOperation(() => 
      storage.deleteMedicalAlert(id)
    );
    sendSuccessResponse(res, { success: true });
  }));

  // Patient Activity routes
  app.get('/api/patients/:patientId/activity', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const activities = await handleDatabaseOperation(() => 
      storage.getPatientActivity(patientId)
    );
    sendSuccessResponse(res, activities);
  }));

  app.post('/api/patients/:patientId/activity', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const user = req.user!;
    const activityData = {
      ...req.body,
      patientId,
      createdBy: user.id
    };
    const activity = await handleDatabaseOperation(() => 
      storage.createPatientActivity(activityData)
    );
    sendSuccessResponse(res, activity);
  }));

  app.delete('/api/patient-activity/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await handleDatabaseOperation(() => 
      storage.deletePatientActivity(id)
    );
    sendSuccessResponse(res, { success: true });
  }));

  // Prescriptions routes
  app.get('/api/patients/:patientId/prescriptions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const prescriptions = await handleDatabaseOperation(() => 
      storage.getPrescriptionsByPatient(patientId)
    );
    sendSuccessResponse(res, prescriptions);
  }));

  app.post('/api/patients/:patientId/prescriptions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const user = req.user!;
    const prescriptionData = {
      ...req.body,
      patientId,
      prescribedBy: user.id
    };
    const prescription = await handleDatabaseOperation(() => 
      storage.createPrescription(prescriptionData)
    );
    sendSuccessResponse(res, prescription);
  }));

  app.put('/api/prescriptions/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const prescription = await handleDatabaseOperation(() => 
      storage.updatePrescription(id, req.body)
    );
    sendSuccessResponse(res, prescription);
  }));

  app.delete('/api/prescriptions/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await handleDatabaseOperation(() => 
      storage.deletePrescription(id)
    );
    sendSuccessResponse(res, { success: true });
  }));

  // Medical History Entries routes
  app.get('/api/patients/:patientId/medical-history', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const entries = await handleDatabaseOperation(() => 
      storage.getMedicalHistoryEntriesByPatient(patientId)
    );
    sendSuccessResponse(res, entries);
  }));

  app.post('/api/patients/:patientId/medical-history', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const patientId = parseInt(req.params.patientId);
    const user = req.user!;
    const entryData = {
      ...req.body,
      patientId,
      createdBy: user.id
    };
    const entry = await handleDatabaseOperation(() => 
      storage.createMedicalHistoryEntry(entryData)
    );
    sendSuccessResponse(res, entry);
  }));

  app.put('/api/medical-history/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const entry = await handleDatabaseOperation(() => 
      storage.updateMedicalHistoryEntry(id, req.body)
    );
    sendSuccessResponse(res, entry);
  }));

  app.delete('/api/medical-history/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    await handleDatabaseOperation(() => 
      storage.deleteMedicalHistoryEntry(id)
    );
    sendSuccessResponse(res, { success: true });
  }));

  return httpServer;
}