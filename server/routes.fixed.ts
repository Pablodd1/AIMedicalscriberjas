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