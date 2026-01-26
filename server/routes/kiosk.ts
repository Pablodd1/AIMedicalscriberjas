import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { sendSuccessResponse, sendErrorResponse, asyncHandler } from './error-handler';
import { log, logError } from './logger';
import crypto from 'crypto';

// Schema for kiosk patient registration
const kioskRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  insuranceProvider: z.string().optional(),
  insuranceMemberId: z.string().optional(),
  reasonForVisit: z.string().min(1, 'Reason for visit is required'),
  appointmentType: z.string().optional(),
  checkInTime: z.string(),
  kioskId: z.string(),
  signatureData: z.string().optional()
});

// Schema for kiosk status updates
const kioskStatusSchema = z.object({
  patientId: z.number().optional(),
  status: z.enum(['arrived', 'waiting', 'in-consultation', 'completed']),
  estimatedWaitTime: z.number().optional(),
  notes: z.string().optional()
});

// Verify kiosk token middleware
const verifyKioskToken = (req: any, res: any, next: any) => {
  const token = req.headers['x-kiosk-token'];
  const expectedToken = process.env.KIOSK_ACCESS_TOKEN || 'kiosk-access-token';
  
  if (token !== expectedToken) {
    return sendErrorResponse(res, 'Unauthorized kiosk access', 401, 'UNAUTHORIZED_KIOSK');
  }
  
  next();
};

export function createKioskRouter(): Router {
  const router = Router();

  // Get kiosk status and waiting room data
  router.get('/status', asyncHandler(async (req, res) => {
    try {
      const waitingRoom = await storage.getWaitingRoomData();
      
      sendSuccessResponse(res, {
        kioskId: 'main-lobby',
        status: 'online',
        currentTime: new Date().toISOString(),
        clinicStatus: 'open', // Could be dynamic based on hours
        totalPatientsWaiting: waitingRoom.length,
        averageWaitTime: calculateAverageWaitTime(waitingRoom),
        waitingRoom: waitingRoom.map(patient => ({
          id: patient.id,
          name: `${patient.firstName} ${patient.lastName}`,
          checkInTime: patient.checkInTime,
          estimatedWaitTime: patient.estimatedWaitTime,
          status: patient.status
        }))
      });
    } catch (error) {
      logError('Kiosk status error:', error);
      sendErrorResponse(res, 'Failed to get kiosk status', 500);
    }
  }));

  // Register patient from kiosk
  router.post('/register', verifyKioskToken, asyncHandler(async (req, res) => {
    try {
      const validatedData = kioskRegistrationSchema.parse(req.body);
      
      // Check if patient already exists by email or phone
      const existingPatients = await storage.checkExistingPatient(
        validatedData.email, 
        validatedData.phone
      );
      
      if (existingPatients.length > 0) {
        // Update existing patient arrival
        const existingPatient = existingPatients[0];
        await storage.updatePatientCheckIn(existingPatient.id, {
          checkInTime: validatedData.checkInTime,
          kioskId: validatedData.kioskId,
          appointmentType: validatedData.appointmentType,
          reasonForVisit: validatedData.reasonForVisit,
          signatureData: validatedData.signatureData,
          status: 'arrived'
        });
        
        const estimatedWaitTime = await calculateWaitTime(existingPatient.id);
        
        sendSuccessResponse(res, {
          patientId: existingPatient.id,
          message: 'Existing patient checked in successfully',
          estimatedWaitTime,
          isNewPatient: false
        });
      } else {
        // Create new patient record
        const newPatient = await storage.createPatientFromKiosk({
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          email: validatedData.email,
          phone: validatedData.phone,
          dateOfBirth: validatedData.dateOfBirth,
          address: validatedData.address,
          emergencyContact: validatedData.emergencyContact,
          emergencyPhone: validatedData.emergencyPhone,
          checkInTime: validatedData.checkInTime,
          kioskId: validatedData.kioskId,
          appointmentType: validatedData.appointmentType,
          reasonForVisit: validatedData.reasonForVisit,
          signatureData: validatedData.signatureData,
          status: 'arrived'
        });
        
        const estimatedWaitTime = await calculateWaitTime(newPatient.id);
        
        sendSuccessResponse(res, {
          patientId: newPatient.id,
          message: 'New patient registered and checked in successfully',
          estimatedWaitTime,
          isNewPatient: true
        });
      }
      
      log('Kiosk patient registration successful', { 
        patientId: existingPatients.length > 0 ? existingPatients[0].id : 'new',
        kioskId: validatedData.kioskId 
      });
      
    } catch (error) {
      logError('Kiosk registration error:', error);
      if (error instanceof z.ZodError) {
        return sendErrorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      }
      sendErrorResponse(res, 'Failed to register patient', 500);
    }
  }));

  // Update patient status
  router.put('/patient-status/:patientId', verifyKioskToken, asyncHandler(async (req, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const validatedData = kioskStatusSchema.parse(req.body);
      
      await storage.updatePatientStatus(patientId, validatedData);
      
      sendSuccessResponse(res, {
        message: 'Patient status updated successfully',
        patientId,
        status: validatedData.status
      });
      
      log('Kiosk patient status updated', { patientId, status: validatedData.status });
      
    } catch (error) {
      logError('Kiosk status update error:', error);
      if (error instanceof z.ZodError) {
        return sendErrorResponse(res, 'Validation failed', 400, 'VALIDATION_ERROR', error.errors);
      }
      sendErrorResponse(res, 'Failed to update patient status', 500);
    }
  }));

  // Get waiting room list
  router.get('/waiting-room', asyncHandler(async (req, res) => {
    try {
      const waitingRoom = await storage.getWaitingRoomData();
      
      sendSuccessResponse(res, {
        waitingRoom: waitingRoom.map(patient => ({
          id: patient.id,
          name: `${patient.firstName} ${patient.lastName}`,
          checkInTime: patient.checkInTime,
          estimatedWaitTime: patient.estimatedWaitTime,
          status: patient.status,
          appointmentType: patient.appointmentType
        })),
        totalWaiting: waitingRoom.length,
        averageWaitTime: calculateAverageWaitTime(waitingRoom)
      });
      
    } catch (error) {
      logError('Kiosk waiting room error:', error);
      sendErrorResponse(res, 'Failed to get waiting room data', 500);
    }
  }));

  // Generate check-in pass
  router.get('/pass/:patientId', asyncHandler(async (req, res) => {
    try {
      const patientId = parseInt(req.params.patientId);
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return sendErrorResponse(res, 'Patient not found', 404, 'PATIENT_NOT_FOUND');
      }
      
      // Generate printable pass HTML
      const passHtml = generatePatientPass(patient);
      
      res.setHeader('Content-Type', 'text/html');
      res.send(passHtml);
      
    } catch (error) {
      logError('Kiosk pass generation error:', error);
      sendErrorResponse(res, 'Failed to generate check-in pass', 500);
    }
  }));

  // Session cleanup (remove patients who completed consultation)
  router.post('/session-cleanup', verifyKioskToken, asyncHandler(async (req, res) => {
    try {
      const completedPatients = await storage.removeCompletedPatients();
      
      sendSuccessResponse(res, {
        message: 'Session cleanup completed',
        removedPatients: completedPatients.length,
        remainingPatients: await storage.getWaitingRoomCount()
      });
      
      log('Kiosk session cleanup', { removedCount: completedPatients.length });
      
    } catch (error) {
      logError('Kiosk session cleanup error:', error);
      sendErrorResponse(res, 'Failed to cleanup session', 500);
    }
  }));

  return router;
}

// Helper functions
async function calculateWaitTime(patientId: number): Promise<number> {
  try {
    // Get appointments ahead of this patient
    const appointments = await storage.getTodayAppointments();
    const patientIndex = appointments.findIndex(apt => apt.patientId === patientId);
    
    if (patientIndex === -1) {
      return 15; // Default wait time
    }
    
    // Calculate based on average appointment duration and position in queue
    const averageAppointmentDuration = 20; // minutes
    const estimatedWaitTime = patientIndex * averageAppointmentDuration;
    
    return Math.max(5, Math.min(60, estimatedWaitTime)); // Between 5 and 60 minutes
  } catch (error) {
    logError('Wait time calculation error:', error);
    return 15; // Default fallback
  }
}

function calculateAverageWaitTime(waitingRoom: any[]): number {
  if (waitingRoom.length === 0) return 0;
  
  const totalWaitTime = waitingRoom.reduce((sum, patient) => {
    return sum + (patient.estimatedWaitTime || 15);
  }, 0);
  
  return Math.round(totalWaitTime / waitingRoom.length);
}

function generatePatientPass(patient: any): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Patient Check-In Pass</title>
      <style>
        @media print {
          body { margin: 0; }
          .pass { 
            width: 4in; 
            height: 6in; 
            border: 2px solid #333; 
            margin: 0.5in; 
            page-break-after: always;
          }
        }
        .pass {
          font-family: Arial, sans-serif;
          padding: 20px;
          border: 2px solid #333;
          width: 350px;
          height: 550px;
          margin: 20px auto;
          position: relative;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 15px;
          margin-bottom: 15px;
        }
        .clinic-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .pass-title {
          font-size: 18px;
          font-weight: bold;
          color: #e74c3c;
        }
        .content {
          margin: 20px 0;
        }
        .patient-info {
          margin-bottom: 20px;
        }
        .info-row {
          margin-bottom: 10px;
          display: flex;
        }
        .label {
          font-weight: bold;
          width: 100px;
          flex-shrink: 0;
        }
        .value {
          font-size: 16px;
        }
        .status {
          text-align: center;
          padding: 15px;
          background: #e3f2fd;
          border-radius: 5px;
          margin-top: 20px;
        }
        .status-text {
          font-size: 18px;
          font-weight: bold;
          color: #1976d2;
        }
        .footer {
          position: absolute;
          bottom: 10px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .qr-code {
          width: 80px;
          height: 80px;
          border: 1px solid #333;
          margin: 10px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="pass">
        <div class="header">
          <div class="clinic-name">Medical Clinic</div>
          <div class="pass-title">CHECK-IN PASS</div>
        </div>
        
        <div class="content">
          <div class="patient-info">
            <div class="info-row">
              <span class="label">Name:</span>
              <span class="value">${patient.firstName} ${patient.lastName}</span>
            </div>
            <div class="info-row">
              <span class="label">Time:</span>
              <span class="value">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="info-row">
              <span class="label">Date:</span>
              <span class="value">${new Date().toLocaleDateString()}</span>
            </div>
            ${patient.appointmentType ? `
            <div class="info-row">
              <span class="label">Visit Type:</span>
              <span class="value">${patient.appointmentType}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="status">
            <div class="status-text">IN WAITING ROOM</div>
          </div>
          
          <div class="qr-code">
            PATIENT ID: ${patient.id}
          </div>
        </div>
        
        <div class="footer">
          Please present this pass to the reception staff
        </div>
      </div>
    </body>
    </html>
  `;
}