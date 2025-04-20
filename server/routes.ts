import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { aiRouter } from "./routes/ai";
import { emailRouter } from "./routes/email";
import { 
  insertPatientSchema, 
  insertAppointmentSchema, 
  insertMedicalNoteSchema,
  insertConsultationNoteSchema,
  insertInvoiceSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Register AI routes
  app.use('/api/ai', aiRouter);
  
  // Register Email settings routes
  app.use('/api/settings', emailRouter);

  // For development purposes, we're using a fixed doctorId of 1
  const MOCK_DOCTOR_ID = 1;

  // Patients routes
  app.get("/api/patients", async (req, res) => {
    const patients = await storage.getPatients(MOCK_DOCTOR_ID);
    res.json(patients);
  });

  app.get("/api/patients/:id", async (req, res) => {
    const patient = await storage.getPatient(parseInt(req.params.id));
    if (!patient) return res.sendStatus(404);
    res.json(patient);
  });

  app.post("/api/patients", async (req, res) => {
    const validation = insertPatientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    const patient = await storage.createPatient({
      ...validation.data,
      createdBy: MOCK_DOCTOR_ID,
    });
    res.status(201).json(patient);
  });

  // Appointments routes
  app.get("/api/appointments", async (req, res) => {
    const appointments = await storage.getAppointments(MOCK_DOCTOR_ID);
    res.json(appointments);
  });

  app.post("/api/appointments", async (req, res) => {
    try {
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
        doctorId: MOCK_DOCTOR_ID,
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
    const notes = await storage.getMedicalNotes(MOCK_DOCTOR_ID);
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
      doctorId: MOCK_DOCTOR_ID,
    });
    
    res.status(201).json(note);
  });
  
  // Quick Notes routes (notes without patient association)
  app.get("/api/quick-notes", async (req, res) => {
    try {
      const notes = await storage.getQuickNotes(MOCK_DOCTOR_ID);
      res.json(notes);
    } catch (error) {
      console.error("Error fetching quick notes:", error);
      res.status(500).json({ message: "Failed to fetch quick notes" });
    }
  });
  
  app.post("/api/quick-notes", async (req, res) => {
    try {
      // Create a modified schema for quick notes that doesn't require patientId
      const quickNoteData = {
        ...req.body,
        doctorId: MOCK_DOCTOR_ID,
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
    const notes = await storage.getConsultationNotes(MOCK_DOCTOR_ID);
    res.json(notes);
  });
  
  app.get("/api/patients/:patientId/consultation-notes", async (req, res) => {
    const patientId = parseInt(req.params.patientId);
    const patient = await storage.getPatient(patientId);
    if (!patient) return res.sendStatus(404);
    
    const notes = await storage.getConsultationNotesByPatient(patientId);
    res.json(notes);
  });
  
  app.get("/api/consultation-notes/:id", async (req, res) => {
    const noteId = parseInt(req.params.id);
    if (isNaN(noteId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const note = await storage.getConsultationNote(noteId);
    if (!note) return res.sendStatus(404);
    res.json(note);
  });
  
  app.post("/api/consultation-notes", async (req, res) => {
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
      doctorId: MOCK_DOCTOR_ID,
    });
    
    res.status(201).json(note);
  });
  
  // Create medical note from consultation
  app.post("/api/medical-notes/from-consultation", async (req, res) => {
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
          doctorId: MOCK_DOCTOR_ID,
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
  // Store active video consultation rooms
  interface VideoChatRoom {
    id: string;
    participants: { 
      id: string;
      socket: WebSocket;
      name: string;
      isDoctor: boolean;
    }[];
  }
  
  const activeRooms: Map<string, VideoChatRoom> = new Map();
  
  // Invoice routes
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices(MOCK_DOCTOR_ID);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/patient/:patientId", async (req, res) => {
    try {
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
      const validation = insertInvoiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json(validation.error);
      }
      
      const invoice = await storage.createInvoice({
        ...validation.data,
        doctorId: MOCK_DOCTOR_ID,
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
  
  app.post('/api/telemedicine/rooms', (req, res) => {
    // For development, we're not requiring authentication
    // This would be required in production: if (!req.isAuthenticated()) {
    //  return res.status(401).json({ message: 'Unauthorized' });
    // }
    
    const { patientId, patientName } = req.body;
    
    if (!patientId || !patientName) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Generate room ID
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create new room
    activeRooms.set(roomId, {
      id: roomId,
      participants: []
    });
    
    res.status(201).json({ roomId });
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
            // Handle WebRTC signaling
            if (!roomId) {
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Not joined to any room'
              }));
              return;
            }
            
            const targetRoom = activeRooms.get(roomId as string);
            if (!targetRoom) {
              socket.send(JSON.stringify({
                type: 'error',
                message: 'Room not found'
              }));
              return;
            }
            
            // Find the target participant
            const targetParticipant = targetRoom.participants.find(p => p.id === data.target);
            if (targetParticipant) {
              // Forward the WebRTC signaling message
              targetParticipant.socket.send(JSON.stringify({
                type: data.type,
                sender: data.sender,
                data: data.data
              }));
            }
            break;
            
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    socket.on('close', () => {
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
          
          // If room is empty, delete it
          if (room.participants.length === 0) {
            activeRooms.delete(roomId);
          }
        }
      }
    });
  });

  return httpServer;
}