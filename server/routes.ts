import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import multer from 'multer';
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { aiRouter } from "./routes/ai";
import { emailRouter } from "./routes/email";
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { 
  insertPatientSchema, 
  insertAppointmentSchema, 
  insertMedicalNoteSchema,
  insertConsultationNoteSchema,
  insertInvoiceSchema,
  insertIntakeFormSchema,
  insertIntakeFormResponseSchema,
  type RecordingSession
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
  // Create the uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  // Set up storage for multer
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
      // Use original file name and add timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + '-' + file.originalname);
    }
  });
  
  const upload = multer({ storage: storage });
  
  setupAuth(app);
  
  // Register AI routes
  app.use('/api/ai', aiRouter);
  
  // Register Email settings routes
  app.use('/api/settings', emailRouter);

  // Patients routes
  app.get("/api/patients", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    const patients = await storage.getPatients(doctorId);
    res.json(patients);
  });

  app.get("/api/patients/:id", async (req, res) => {
    const patient = await storage.getPatient(parseInt(req.params.id));
    if (!patient) return res.sendStatus(404);
    res.json(patient);
  });

  app.post("/api/patients", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const validation = insertPatientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    const patient = await storage.createPatient({
      ...validation.data,
      createdBy: doctorId,
    });
    res.status(201).json(patient);
  });

  // Appointments routes
  app.get("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const appointments = await storage.getAppointments(doctorId);
    res.json(appointments);
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const doctorId = req.user.id;
      
      // Convert numeric timestamp to Date object for PostgreSQL timestamp
      let appointmentData = req.body;
      if (typeof appointmentData.date === 'number') {
        appointmentData = {
          ...appointmentData,
          date: new Date(appointmentData.date)
        };
      }

      const validation = insertAppointmentSchema.safeParse(appointmentData);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const appointment = await storage.createAppointment({
        ...validation.data,
        doctorId: doctorId,
      });
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  // Update appointment status
  app.patch("/api/appointments/:id", async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedAppointment = await storage.updateAppointmentStatus(appointmentId, status);
      
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      res.json(updatedAppointment);
    } catch (error) {
      console.error("Error updating appointment status:", error);
      res.status(500).json({ message: "Failed to update appointment status" });
    }
  });

  // Medical Notes routes
  app.get("/api/medical-notes", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const doctorId = req.user.id;
    
    const notes = await storage.getMedicalNotes(doctorId);
    res.json(notes);
  });

  app.get("/api/patients/:patientId/medical-notes", async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    const patient = await storage.getPatient(patientId);
    if (!patient) return res.sendStatus(404);
    
    const notes = await storage.getMedicalNotesByPatient(patientId);
    res.json(notes);
  });

  app.get("/api/medical-notes/:id", async (req, res) => {
    const note = await storage.getMedicalNote(parseInt(req.params.id));
    if (!note) return res.sendStatus(404);
    res.json(note);
  });

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

  // Telemedicine routes
  
  // API to convert WebM to MP3 format
  app.post('/api/telemedicine/convert-to-mp3', upload.single('audio'), async (req, res) => {
    try {
      console.log('MP3 conversion requested');
      
      if (!req.file) {
        return res.status(400).json({ message: 'No audio file provided' });
      }
      
      console.log('File received:', req.file.path);
      
      // Input file path (WebM file)
      const inputPath = req.file.path;
      
      // Output file path (MP3 file)
      const outputPath = inputPath.replace(/\.[^/.]+$/, '.mp3');
      
      // Create a timestamp-based unique name for the recording
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const uniqueFilename = `recording_${timestamp}.mp3`;
      
      // Use ffmpeg to convert WebM to MP3
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-vn', // No video
        '-ar', '44100', // Audio sampling rate
        '-ac', '2', // Stereo
        '-b:a', '128k', // Bitrate
        outputPath
      ]);
      
      // Handle ffmpeg process completion
      await new Promise<void>((resolve, reject) => {
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg process exited with code ${code}`));
          }
        });
        
        ffmpeg.stderr.on('data', (data) => {
          console.log(`ffmpeg: ${data}`);
        });
      });
      
      // Return the MP3 file
      res.sendFile(outputPath, { headers: { 'Content-Type': 'audio/mp3' } });
      
      // Clean up temporary files after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(inputPath);
          // Keep the MP3 file for potential reuse
        } catch (error) {
          console.error('Error cleaning up temporary files:', error);
        }
      }, 5000);
      
    } catch (error) {
      console.error('Error converting audio to MP3:', error);
      res.status(500).json({ message: 'Failed to convert audio to MP3' });
    }
  });
  
  // Serve MP3 conversion test page
  app.get('/mp3-test', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../mp3-conversion-test.html'));
  });
  
  // API to save recording to database
  app.post('/api/telemedicine/recordings', upload.single('audio'), async (req, res) => {
    try {
      const { roomId, patientId } = req.body;
      let doctorId = 1; // Default for testing
      
      // Check if authenticated, if so use real doctor ID, otherwise use test ID for the MP3 test page
      if (req.isAuthenticated()) {
        doctorId = req.user.id;
      } else {
        // For testing, we'll allow unauthenticated requests but log them
        console.log('Notice: Unauthenticated recording upload - likely from test page');
      }
      
      if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
      }
      
      // Get the file path if it exists
      const audioFilePath = req.file ? req.file.path : null;
      
      // Look up patient by room ID or use provided patient ID
      let patientIdNum = patientId ? parseInt(patientId) : 0;
      
      if (!patientIdNum && roomId) {
        // Try to get patient from existing session
        const existingSession = await storage.getRecordingSessionByRoomId(roomId);
        if (existingSession) {
          patientIdNum = existingSession.patientId;
        }
      }
      
      // For testing without authentication, use a default patient ID if none provided
      if (!patientIdNum) {
        if (req.isAuthenticated()) {
          return res.status(400).json({ message: 'Patient ID is required' });
        } else {
          console.log('Notice: Using default patient ID for testing');
          patientIdNum = 1; // Default for testing
        }
      }
      
      // Create recording session
      const recordingSession = await storage.createRecordingSession({
        roomId,
        doctorId,
        patientId: patientIdNum,
        audioFilePath: audioFilePath || '',
        status: 'completed',
        durationSeconds: 0, // Will be updated after processing
        transcription: ''
      });
      
      res.status(201).json(recordingSession);
      
    } catch (error) {
      console.error('Error saving recording:', error);
      res.status(500).json({ message: 'Failed to save recording' });
    }
  });
  
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
      
      const validation = insertInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const invoice = await storage.createInvoice({
        ...validation.data,
        doctorId: doctorId,
      });
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
            patient: patient || { name: 'Unknown Patient' }
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

  return httpServer;
}