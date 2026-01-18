import { Router, Request, Response, NextFunction } from "express";
import { log, logError } from '../logger';
import { storage } from "../storage";
import { db } from "../db";
import { 
  insertDeviceSchema, 
  insertBpReadingSchema, 
  insertGlucoseReadingSchema,
  insertAlertSettingSchema
} from "@shared/schema";

export const monitoringRouter = Router();

// Authentication middleware
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Get all devices for a patient
monitoringRouter.get("/devices/:patientId", authenticate, async (req: Request, res: Response) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const devices = await storage.getDevices(patientId);
    res.json(devices);
  } catch (error: unknown) {
    logError("Error fetching devices:", error);
    res.status(500).json({ message: "Failed to fetch devices", error: (error as Error).message });
  }
});

// Get a specific device
monitoringRouter.get("/device/:id", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const device = await storage.getDevice(deviceId);
    
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }
    
    res.json(device);
  } catch (error: unknown) {
    logError("Error fetching device:", error);
    res.status(500).json({ message: "Failed to fetch device", error: (error as Error).message });
  }
});

// Create a new device
monitoringRouter.post("/device", authenticate, async (req, res) => {
  try {
    const validatedData = insertDeviceSchema.parse(req.body);
    const device = await storage.createDevice(validatedData);
    res.status(201).json(device);
  } catch (error: unknown) {
    logError("Error creating device:", error);
    res.status(500).json({ message: "Failed to create device", error: (error as Error).message });
  }
});

// Update a device
monitoringRouter.patch("/device/:id", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const device = await storage.updateDevice(deviceId, req.body);
    
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }
    
    res.json(device);
  } catch (error: unknown) {
    logError("Error updating device:", error);
    res.status(400).json({ message: "Failed to update device", error: (error as Error).message });
  }
});

// Delete a device
monitoringRouter.delete("/device/:id", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const success = await storage.deleteDevice(deviceId);
    
    if (!success) {
      return res.status(404).json({ message: "Device not found" });
    }
    
    res.json({ message: "Device deleted successfully" });
  } catch (error: unknown) {
    logError("Error deleting device:", error);
    res.status(500).json({ message: "Failed to delete device", error: (error as Error).message });
  }
});

// Get BP readings for a patient
monitoringRouter.get("/bp-readings/:patientId", authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getBpReadings(patientId, limit);
    res.json(readings);
  } catch (error: unknown) {
    logError("Error fetching BP readings:", error);
    res.status(500).json({ message: "Failed to fetch BP readings", error: (error as Error).message });
  }
});

// Get BP readings for a specific device
monitoringRouter.get("/bp-readings/device/:deviceId", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getBpReadingsByDevice(deviceId, limit);
    res.json(readings);
  } catch (error: unknown) {
    logError("Error fetching BP readings:", error);
    res.status(500).json({ message: "Failed to fetch BP readings", error: (error as Error).message });
  }
});

// Create a new BP reading
monitoringRouter.post("/bp-reading", authenticate, async (req, res) => {
  try {
    const validatedData = insertBpReadingSchema.parse(req.body);
    const reading = await storage.createBpReading(validatedData);
    res.status(201).json(reading);
  } catch (error: unknown) {
    logError("Error creating BP reading:", error);
    res.status(500).json({ message: "Failed to create reading", error: (error as Error).message });
  }
});

// Get glucose readings for a patient
monitoringRouter.get("/glucose-readings/:patientId", authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getGlucoseReadings(patientId, limit);
    res.json(readings);
  } catch (error: unknown) {
    logError("Error fetching glucose readings:", error);
    res.status(500).json({ message: "Failed to fetch glucose readings", error: (error as Error).message });
  }
});

// Get glucose readings for a specific device
monitoringRouter.get("/glucose-readings/device/:deviceId", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getGlucoseReadingsByDevice(deviceId, limit);
    res.json(readings);
  } catch (error: unknown) {
    logError("Error fetching glucose readings:", error);
    res.status(500).json({ message: "Failed to fetch glucose readings", error: (error as Error).message });
  }
});

// Create a new glucose reading
monitoringRouter.post("/glucose-reading", authenticate, async (req, res) => {
  try {
    const validatedData = insertGlucoseReadingSchema.parse(req.body);
    const reading = await storage.createGlucoseReading(validatedData);
    res.status(201).json(reading);
  } catch (error: unknown) {
    logError("Error creating glucose reading:", error);
    res.status(500).json({ message: "Failed to create reading", error: (error as Error).message });
  }
});

// Get alert settings
monitoringRouter.get("/alert-settings/:patientId/:deviceType", authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const deviceType = req.params.deviceType;
    const settings = await storage.getAlertSettings(patientId, deviceType);
    
    if (!settings) {
      return res.status(404).json({ message: "Alert settings not found" });
    }
    
    res.json(settings);
  } catch (error: unknown) {
    logError("Error fetching alert settings:", error);
    res.status(500).json({ message: "Failed to fetch alert settings", error: (error as Error).message });
  }
});

// Create or update alert settings
monitoringRouter.post("/alert-settings", authenticate, async (req, res) => {
  try {
    const validatedData = insertAlertSettingSchema.parse(req.body);
    const settings = await storage.saveAlertSettings(validatedData);
    res.status(201).json(settings);
  } catch (error: unknown) {
    logError("Error saving alert settings:", error);
    res.status(500).json({ message: "Failed to create settings", error: (error as Error).message });
  }
});

// Update alert settings
monitoringRouter.patch("/alert-settings/:id", authenticate, async (req, res) => {
  try {
    const settingsId = parseInt(req.params.id);
    const settings = await storage.updateAlertSettings(settingsId, req.body);
    
    if (!settings) {
      return res.status(404).json({ message: "Alert settings not found" });
    }
    
    res.json(settings);
  } catch (error: unknown) {
    logError("Error updating alert settings:", error);
    res.status(500).json({ message: "Failed to update settings", error: (error as Error).message });
  }
});
