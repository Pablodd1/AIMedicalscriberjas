import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertPatientSchema, insertAppointmentSchema, insertMedicalNoteSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Patients routes
  app.get("/api/patients", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const patients = await storage.getPatients(req.user.id);
    res.json(patients);
  });

  app.get("/api/patients/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const patient = await storage.getPatient(parseInt(req.params.id));
    if (!patient) return res.sendStatus(404);
    if (patient.createdBy !== req.user.id) return res.sendStatus(403);
    res.json(patient);
  });

  app.post("/api/patients", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const validation = insertPatientSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    const patient = await storage.createPatient({
      ...validation.data,
      createdBy: req.user.id,
    });
    res.status(201).json(patient);
  });

  // Appointments routes
  app.get("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const appointments = await storage.getAppointments(req.user.id);
    res.json(appointments);
  });

  app.post("/api/appointments", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const validation = insertAppointmentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    const appointment = await storage.createAppointment({
      ...validation.data,
      doctorId: req.user.id,
    });
    res.status(201).json(appointment);
  });

  // Medical Notes routes
  app.get("/api/medical-notes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const notes = await storage.getMedicalNotes(req.user.id);
    res.json(notes);
  });

  app.get("/api/patients/:patientId/medical-notes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const patientId = parseInt(req.params.patientId);
    const patient = await storage.getPatient(patientId);
    if (!patient) return res.sendStatus(404);
    if (patient.createdBy !== req.user.id) return res.sendStatus(403);
    
    const notes = await storage.getMedicalNotesByPatient(patientId);
    res.json(notes);
  });

  app.get("/api/medical-notes/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const note = await storage.getMedicalNote(parseInt(req.params.id));
    if (!note) return res.sendStatus(404);
    if (note.doctorId !== req.user.id) return res.sendStatus(403);
    res.json(note);
  });

  app.post("/api/medical-notes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const validation = insertMedicalNoteSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    
    // Verify patient exists and belongs to this doctor
    const patient = await storage.getPatient(validation.data.patientId);
    if (!patient || patient.createdBy !== req.user.id) {
      return res.status(403).json({ message: "Patient not found or access denied" });
    }
    
    const note = await storage.createMedicalNote({
      ...validation.data,
      doctorId: req.user.id,
    });
    
    res.status(201).json(note);
  });

  const httpServer = createServer(app);
  return httpServer;
}