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

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Setup multer for file uploads
const upload = multer({ 
  dest: uploadsDir,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  }
});

// For WebSocket server
interface VideoChatRoom {
  id: string;
  participants: { 
    id: string;
    socket: WebSocket;
    name: string;
    isDoctor: boolean;
  }[];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication routes (/api/register, /api/login, /api/logout, /api/user)
  setupAuth(app);
  
  // Mount AI and email routers
  app.use('/api', aiRouter);
  app.use('/api', emailRouter);
  
  // Basic health check
  app.get("/api/healthcheck", (req, res) => {
    res.status(200).json({ status: "healthy" });
  });
  
  // Telemedicine routes for recording sessions
  app.post("/api/telemedicine/recordings", upload.single('audio'), async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    // Only allow doctors to create recordings
    if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Only doctors can create recordings" });
    }
    
    try {
      const { roomId, notes, transcribe } = req.body;
      let audioFilePath = null;
      
      if (req.file) {
        // Convert uploaded WebM to MP3
        try {
          const { convertWebmToMp3 } = await import('./services/transcription');
          const mp3Path = await convertWebmToMp3(req.file.path);
          
          // Remove the original WebM file
          fs.unlinkSync(req.file.path);
          
          // Store relative path to MP3 file
          audioFilePath = path.relative(process.cwd(), mp3Path);
        } catch (error) {
          console.error('Error converting audio:', error);
          return res.status(500).json({ message: "Error converting audio format" });
        }
      }
      
      const session = await storage.createRecordingSession({
        roomId,
        doctorId: req.user.id,
        patientId: null, // Would need to be determined from consultation
        startTime: new Date().toISOString(),
        audioFilePath,
        notes: notes || '',
      });
      
      // Start transcription if requested
      if (transcribe === 'true' && audioFilePath) {
        try {
          const { transcribeAudio } = await import('./services/transcription');
          const fullPath = path.join(process.cwd(), audioFilePath);
          
          // Transcribe in the background
          transcribeAudio(fullPath).then(transcript => {
            storage.updateRecordingSession(session.id, { transcript });
          }).catch(error => {
            console.error('Error in background transcription:', error);
          });
        } catch (error) {
          console.error('Error starting transcription:', error);
          // Continue anyway since this is a background task
        }
      }
      
      res.status(201).json(session);
    } catch (error) {
      console.error('Error creating recording session:', error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  app.get("/api/telemedicine/recordings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { roomId } = req.query;
    
    try {
      if (roomId) {
        // If roomId is provided, get the specific recording session
        const session = await storage.getRecordingSessionByRoomId(roomId as string);
        if (session) {
          return res.json([session]);
        }
        return res.json([]);
      } else {
        // Otherwise get all recording sessions for the doctor
        const sessions = await storage.getRecordingSessions(req.user.id);
        return res.json(sessions);
      }
    } catch (error) {
      console.error('Error getting recording sessions:', error);
      return res.status(500).json({ message: "Server error" });
    }
  });
  
  // Endpoint to download recording audio
  app.get("/api/telemedicine/recordings/:id/download", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const recordingId = parseInt(req.params.id);
      const session = await storage.getRecordingSession(recordingId);
      
      if (!session) {
        return res.status(404).json({ message: "Recording not found" });
      }
      
      // Check if user has access to this recording
      if (req.user.id !== session.doctorId && req.user.id !== session.patientId) {
        return res.status(403).json({ message: "Not authorized to access this recording" });
      }
      
      // Check if file exists
      if (!session.audioFilePath) {
        return res.status(404).json({ message: "Audio file not found" });
      }
      
      const filePath = path.join(process.cwd(), session.audioFilePath);
      
      // Check if file exists on the server
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Audio file not found on server" });
      }
      
      // Send file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename=consultation_recording_${session.id}.mp3`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error downloading recording:', error);
      return res.status(500).json({ message: "Server error" });
    }
  });
  
  // Endpoint to update a recording session (e.g., add transcription)
  app.patch("/api/telemedicine/recordings/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const recordingId = parseInt(req.params.id);
      const session = await storage.getRecordingSession(recordingId);
      
      if (!session) {
        return res.status(404).json({ message: "Recording not found" });
      }
      
      // Only allow doctors to update recordings
      if (req.user.role !== 'doctor' && req.user.role !== 'admin') {
        return res.status(403).json({ message: "Only doctors can update recordings" });
      }
      
      // Handle transcription request
      if (req.body.requestTranscription && session.audioFilePath) {
        // Import dynamically to avoid loading unless needed
        const { transcribeAudio } = await import('./services/transcription');
        
        const audioFilePath = path.join(process.cwd(), session.audioFilePath);
        
        // Check if file exists
        if (!fs.existsSync(audioFilePath)) {
          return res.status(404).json({ message: "Audio file not found" });
        }
        
        try {
          // Transcribe the audio file
          const transcript = await transcribeAudio(audioFilePath);
          
          // Update the session with the transcription
          const updatedSession = await storage.updateRecordingSession(recordingId, {
            transcript
          });
          
          return res.json(updatedSession);
        } catch (error) {
          console.error('Error transcribing audio:', error);
          return res.status(500).json({ message: "Error transcribing audio" });
        }
      }
      
      // Handle normal updates
      const updates: Record<string, any> = {};
      
      if (req.body.notes !== undefined) {
        updates.notes = req.body.notes;
      }
      
      if (req.body.transcript !== undefined) {
        updates.transcript = req.body.transcript;
      }
      
      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        const updatedSession = await storage.updateRecordingSession(recordingId, updates);
        return res.json(updatedSession);
      }
      
      return res.json(session);
    } catch (error) {
      console.error('Error updating recording session:', error);
      return res.status(500).json({ message: "Server error" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Initialize WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws'
  });
  
  // Track active rooms
  const rooms: Map<string, VideoChatRoom> = new Map();
  
  // WebSocket connection handler
  wss.on('connection', (socket) => {
    let roomId: string | null = null;
    let userId: string | null = null;
    
    socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle room joining
        if (data.type === 'join') {
          roomId = data.roomId;
          userId = data.userId;
          const username = data.username || 'Anonymous';
          const isDoctor = data.isDoctor || false;
          
          // Create room if it doesn't exist
          if (!rooms.has(roomId)) {
            rooms.set(roomId, { 
              id: roomId, 
              participants: [] 
            });
          }
          
          // Add user to room
          const room = rooms.get(roomId)!;
          room.participants.push({ 
            id: userId, 
            socket,
            name: username,
            isDoctor 
          });
          
          // Tell everyone about the new user
          room.participants.forEach(participant => {
            if (participant.id !== userId) {
              participant.socket.send(JSON.stringify({
                type: 'user-joined',
                userId,
                username,
                isDoctor
              }));
            }
          });
          
          // Send current participants to the new user
          socket.send(JSON.stringify({
            type: 'room-info',
            participants: room.participants.map(p => ({
              id: p.id,
              name: p.name,
              isDoctor: p.isDoctor
            }))
          }));
        }
        
        // Handle WebRTC signaling
        if (data.type === 'signal' && roomId && userId) {
          const room = rooms.get(roomId);
          if (room) {
            const { targetId, signal } = data;
            const targetParticipant = room.participants.find(p => p.id === targetId);
            
            if (targetParticipant) {
              targetParticipant.socket.send(JSON.stringify({
                type: 'signal',
                fromId: userId,
                signal
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
      }
    });
    
    // Handle disconnection
    socket.on('close', () => {
      if (roomId && userId) {
        const room = rooms.get(roomId);
        if (room) {
          // Remove user from room
          room.participants = room.participants.filter(p => p.id !== userId);
          
          // Notify others about disconnection
          room.participants.forEach(participant => {
            participant.socket.send(JSON.stringify({
              type: 'user-left',
              userId
            }));
          });
          
          // Clean up empty rooms
          if (room.participants.length === 0) {
            rooms.delete(roomId);
          }
        }
      }
    });
  });

  return httpServer;
}