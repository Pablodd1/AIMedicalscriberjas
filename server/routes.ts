import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import aiRoutes from "./routes/ai";
import { insertPatientSchema, insertAppointmentSchema, insertMedicalNoteSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);
  
  // Register AI routes
  app.use('/api/ai', aiRoutes);

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
    const validation = insertAppointmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    const appointment = await storage.createAppointment({
      ...validation.data,
      doctorId: MOCK_DOCTOR_ID,
    });
    res.status(201).json(appointment);
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
    const patient = await storage.getPatient(validation.data.patientId);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }
    
    const note = await storage.createMedicalNote({
      ...validation.data,
      doctorId: MOCK_DOCTOR_ID,
    });
    
    res.status(201).json(note);
  });

  const httpServer = createServer(app);
  return httpServer;
}