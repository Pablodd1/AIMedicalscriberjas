import { Router } from "express";
import { IStorage } from "../storage";
import { z } from "zod";

export function createPublicRouter(storage: IStorage) {
  const router = Router();

  router.post("/confirm-appointment", async (req, res) => {
    try {
      const { token } = z.object({
        token: z.string(),
      }).parse(req.body);

      const appointments = await storage.getAppointmentByToken(token);
      
      if (!appointments || appointments.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Invalid or expired confirmation link"
        });
      }

      const appointment = appointments[0];

      if (appointment.patientConfirmationStatus === 'confirmed') {
        return res.json({
          success: true,
          message: "This appointment has already been confirmed",
          alreadyConfirmed: true
        });
      }

      if (appointment.patientConfirmationStatus === 'declined') {
        return res.json({
          success: false,
          message: "This appointment has been declined and cannot be confirmed"
        });
      }

      await storage.updatePatientConfirmationStatus(appointment.id, 'confirmed');
      
      // Clear the confirmation token after use for security
      await storage.clearAppointmentToken(appointment.id);

      res.json({
        success: true,
        message: "Appointment confirmed successfully!",
        appointment: {
          id: appointment.id,
          date: appointment.date,
          reason: appointment.reason
        }
      });
    } catch (error: any) {
      console.error('Confirm appointment error:', error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to confirm appointment"
      });
    }
  });

  router.post("/decline-appointment", async (req, res) => {
    try {
      const { token } = z.object({
        token: z.string(),
      }).parse(req.body);

      const appointments = await storage.getAppointmentByToken(token);
      
      if (!appointments || appointments.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Invalid or expired confirmation link"
        });
      }

      const appointment = appointments[0];

      if (appointment.patientConfirmationStatus === 'declined') {
        return res.json({
          success: true,
          message: "This appointment has already been declined",
          alreadyDeclined: true
        });
      }

      if (appointment.patientConfirmationStatus === 'confirmed') {
        return res.json({
          success: false,
          message: "This appointment has been confirmed. Please contact the office to cancel."
        });
      }

      await storage.updatePatientConfirmationStatus(appointment.id, 'declined');
      
      // Clear the confirmation token after use for security
      await storage.clearAppointmentToken(appointment.id);

      res.json({
        success: true,
        message: "Appointment declined successfully",
        appointment: {
          id: appointment.id,
          date: appointment.date,
          reason: appointment.reason
        }
      });
    } catch (error: any) {
      console.error('Decline appointment error:', error);
      res.status(400).json({
        success: false,
        message: error.message || "Failed to decline appointment"
      });
    }
  });

  return router;
}
