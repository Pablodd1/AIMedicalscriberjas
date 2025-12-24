import { Router } from "express";
// Demo mode - suppress logging
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';
const log = (...args: any[]) => !DEMO_MODE && console.log(...args);
const logError = (...args: any[]) => !DEMO_MODE && console.error(...args);
import { storage } from "../storage";
import { requireAuth, sendSuccessResponse, sendErrorResponse, asyncHandler, AppError } from "../error-handler";
import { z } from "zod";
import { settingsCache } from "../settings-cache";

export const notificationSettingsRouter = Router();

// SMS Settings Schema
const smsSettingsSchema = z.object({
  twilio_account_sid: z.string().min(1),
  twilio_auth_token: z.string().min(1),
  twilio_phone_number: z.string().regex(/^\+\d{10,15}$/, "Must be in format +1XXXXXXXXXX")
});

// Email Settings Schema (extended with daily list emails)
const emailSettingsSchema = z.object({
  senderEmail: z.string().email().optional(),
  senderName: z.string().optional(),
  appPassword: z.string().optional(),
  daily_patient_list_email_1: z.string().email().optional().or(z.literal("")),
  daily_patient_list_email_2: z.string().email().optional().or(z.literal("")),
  daily_patient_list_email_3: z.string().email().optional().or(z.literal(""))
});

/**
 * GET /api/settings/email
 * Retrieve email settings including daily patient list recipients
 */
notificationSettingsRouter.get("/email", requireAuth, asyncHandler(async (req, res) => {
  const emailSettings = await storage.getSettings([
    'senderEmail',
    'senderName',
    'appPassword',
    'daily_patient_list_email_1',
    'daily_patient_list_email_2',
    'daily_patient_list_email_3'
  ]);

  // Mask password for security
  if (emailSettings.appPassword) {
    const lastFourChars = emailSettings.appPassword.slice(-4);
    emailSettings.appPassword = `••••••••••••${lastFourChars}`;
  }

  sendSuccessResponse(res, emailSettings);
}));

/**
 * POST /api/settings/email
 * Save email settings
 */
notificationSettingsRouter.post("/email", requireAuth, asyncHandler(async (req, res) => {
  const validation = emailSettingsSchema.safeParse(req.body);

  if (!validation.success) {
    throw new AppError('Invalid email settings', 400, 'VALIDATION_ERROR');
  }

  const settings = validation.data;

  // Save each setting
  const savePromises = Object.entries(settings)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => storage.saveSetting(key, value as string));

  await Promise.all(savePromises);

  sendSuccessResponse(res, { success: true }, 'Email settings saved successfully');
}));

/**
 * GET /api/settings/sms
 * Retrieve SMS (Twilio) settings
 */
notificationSettingsRouter.get("/sms", requireAuth, asyncHandler(async (req, res) => {
  const smsSettings = await storage.getSettings([
    'twilio_account_sid',
    'twilio_auth_token',
    'twilio_phone_number'
  ]);

  // Mask sensitive data
  if (smsSettings.twilio_auth_token) {
    const lastFourChars = smsSettings.twilio_auth_token.slice(-4);
    smsSettings.twilio_auth_token = `••••••••••••${lastFourChars}`;
  }

  sendSuccessResponse(res, smsSettings);
}));

/**
 * POST /api/settings/sms
 * Save SMS (Twilio) settings
 */
notificationSettingsRouter.post("/sms", requireAuth, asyncHandler(async (req, res) => {
  const validation = smsSettingsSchema.safeParse(req.body);

  if (!validation.success) {
    throw new AppError('Invalid SMS settings', 400, 'VALIDATION_ERROR');
  }

  const { twilio_account_sid, twilio_auth_token, twilio_phone_number } = validation.data;

  await Promise.all([
    storage.saveSetting('twilio_account_sid', twilio_account_sid),
    storage.saveSetting('twilio_auth_token', twilio_auth_token),
    storage.saveSetting('twilio_phone_number', twilio_phone_number)
  ]);

  // 🚀 PERFORMANCE: Invalidate settings cache when updated
  settingsCache.invalidate(['twilio_account_sid', 'twilio_auth_token', 'twilio_phone_number']);

  sendSuccessResponse(res, { success: true }, 'SMS settings saved successfully');
}));

/**
 * POST /api/notifications/test-sms
 * Send a test SMS
 */
notificationSettingsRouter.post("/test-sms", requireAuth, asyncHandler(async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    throw new AppError('Phone number is required', 400, 'MISSING_PHONE');
  }

  const { sendSMS } = await import('../notification-scheduler');
  
  const sent = await sendSMS(
    phoneNumber,
    'Test SMS from Medical Platform. Your SMS notifications are working correctly!'
  );

  if (!sent) {
    throw new AppError('Failed to send test SMS. Please check your Twilio configuration.', 500, 'SMS_SEND_FAILED');
  }

  sendSuccessResponse(res, { success: true }, 'Test SMS sent successfully');
}));

/**
 * POST /api/notifications/send-daily-list-now
 * Manually trigger daily patient list email (for testing)
 */
notificationSettingsRouter.post("/send-daily-list-now", requireAuth, asyncHandler(async (req, res) => {
  const { sendDailyPatientList } = await import('../notification-scheduler');
  
  // Run in background
  sendDailyPatientList().then(() => {
    log('✅ Manual daily patient list sent successfully');
  }).catch((error) => {
    logError('❌ Error sending manual daily patient list:', error);
  });

  sendSuccessResponse(res, { success: true }, 'Daily patient list email queued for sending');
}));
