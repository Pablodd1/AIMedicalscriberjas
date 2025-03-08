import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertPatientSchema, insertAppointmentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Patients routes
  app.get("/api/patients", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const patients = await storage.getPatients(req.user.id);
    res.json(patients);
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

  const httpServer = createServer(app);
  return httpServer;
}
