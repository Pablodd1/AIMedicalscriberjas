import { Router } from "express";
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
const authenticate = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  next();
};

// Get all devices for a patient
monitoringRouter.get("/devices/:patientId", authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const devices = await storage.getDevices(patientId);
    res.json(devices);
  } catch (error) {
    console.error("Error fetching devices:", error);
    res.status(500).json({ message: "Failed to fetch devices" });
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
  } catch (error) {
    console.error("Error fetching device:", error);
    res.status(500).json({ message: "Failed to fetch device" });
  }
});

// Create a new device
monitoringRouter.post("/device", authenticate, async (req, res) => {
  try {
    const validatedData = insertDeviceSchema.parse(req.body);
    const device = await storage.createDevice(validatedData);
    res.status(201).json(device);
  } catch (error) {
    console.error("Error creating device:", error);
    res.status(400).json({ message: "Failed to create device", error: error.message });
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
  } catch (error) {
    console.error("Error updating device:", error);
    res.status(400).json({ message: "Failed to update device", error: error.message });
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
  } catch (error) {
    console.error("Error deleting device:", error);
    res.status(500).json({ message: "Failed to delete device" });
  }
});

// Get BP readings for a patient
monitoringRouter.get("/bp-readings/:patientId", authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getBpReadings(patientId, limit);
    res.json(readings);
  } catch (error) {
    console.error("Error fetching BP readings:", error);
    res.status(500).json({ message: "Failed to fetch BP readings" });
  }
});

// Get BP readings for a specific device
monitoringRouter.get("/bp-readings/device/:deviceId", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getBpReadingsByDevice(deviceId, limit);
    res.json(readings);
  } catch (error) {
    console.error("Error fetching BP readings:", error);
    res.status(500).json({ message: "Failed to fetch BP readings" });
  }
});

// Create a new BP reading
monitoringRouter.post("/bp-reading", authenticate, async (req, res) => {
  try {
    const validatedData = insertBpReadingSchema.parse(req.body);
    const reading = await storage.createBpReading(validatedData);
    res.status(201).json(reading);
  } catch (error) {
    console.error("Error creating BP reading:", error);
    res.status(400).json({ message: "Failed to create BP reading", error: error.message });
  }
});

// Get glucose readings for a patient
monitoringRouter.get("/glucose-readings/:patientId", authenticate, async (req, res) => {
  try {
    const patientId = parseInt(req.params.patientId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getGlucoseReadings(patientId, limit);
    res.json(readings);
  } catch (error) {
    console.error("Error fetching glucose readings:", error);
    res.status(500).json({ message: "Failed to fetch glucose readings" });
  }
});

// Get glucose readings for a specific device
monitoringRouter.get("/glucose-readings/device/:deviceId", authenticate, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.deviceId);
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const readings = await storage.getGlucoseReadingsByDevice(deviceId, limit);
    res.json(readings);
  } catch (error) {
    console.error("Error fetching glucose readings:", error);
    res.status(500).json({ message: "Failed to fetch glucose readings" });
  }
});

// Create a new glucose reading
monitoringRouter.post("/glucose-reading", authenticate, async (req, res) => {
  try {
    const validatedData = insertGlucoseReadingSchema.parse(req.body);
    const reading = await storage.createGlucoseReading(validatedData);
    res.status(201).json(reading);
  } catch (error) {
    console.error("Error creating glucose reading:", error);
    res.status(400).json({ message: "Failed to create glucose reading", error: error.message });
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
  } catch (error) {
    console.error("Error fetching alert settings:", error);
    res.status(500).json({ message: "Failed to fetch alert settings" });
  }
});

// Create or update alert settings
monitoringRouter.post("/alert-settings", authenticate, async (req, res) => {
  try {
    const validatedData = insertAlertSettingSchema.parse(req.body);
    const settings = await storage.saveAlertSettings(validatedData);
    res.status(201).json(settings);
  } catch (error) {
    console.error("Error saving alert settings:", error);
    res.status(400).json({ message: "Failed to save alert settings", error: error.message });
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
  } catch (error) {
    console.error("Error updating alert settings:", error);
    res.status(400).json({ message: "Failed to update alert settings", error: error.message });
  }
});