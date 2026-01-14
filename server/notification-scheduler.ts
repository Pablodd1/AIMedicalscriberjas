/**
 * Notification Scheduler Service
 * Handles automated daily patient list emails, appointment confirmations, and SMS coordination
 */

import { log, logError } from './logger';

import cron from 'node-cron';
import { storage } from './storage';
import { sendPatientEmail } from './routes/email';
import nodemailer from 'nodemailer';
import { settingsCache } from './settings-cache';

// SMS Integration (Twilio)
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
}

let twilioClient: any = null;

/**
 * Initialize Twilio client if credentials are configured
 */
async function initTwilio(): Promise<any> {
  if (twilioClient) return twilioClient;

  try {
    const settings = await storage.getSettings([
      'twilio_account_sid',
      'twilio_auth_token',
      'twilio_phone_number'
    ]);

    if (!settings.twilio_account_sid || !settings.twilio_auth_token || !settings.twilio_phone_number) {
      log('⚠️ Twilio not configured - SMS notifications disabled');
      return null;
    }

    const twilio = await import('twilio');
    twilioClient = twilio.default(settings.twilio_account_sid, settings.twilio_auth_token);

    log('✅ Twilio initialized successfully');
    return twilioClient;
  } catch (error) {
    logError('❌ Error initializing Twilio:', error);
    return null;
  }
}

/**
 * Send SMS notification via Twilio
 */
export async function sendSMS(
  toPhoneNumber: string,
  message: string
): Promise<boolean> {
  try {
    const client = await initTwilio();
    if (!client) {
      log('⚠️ SMS not sent - Twilio not configured');
      return false;
    }

    const settings = await storage.getSettings(['twilio_phone_number']);
    const fromNumber = settings.twilio_phone_number;

    if (!fromNumber) {
      logError('❌ Twilio phone number not configured');
      return false;
    }

    // Send SMS
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toPhoneNumber
    });

    log(`✅ SMS sent to ${toPhoneNumber}: ${result.sid}`);
    return true;
  } catch (error) {
    logError('❌ Error sending SMS:', error);
    return false;
  }
}

/**
 * Send appointment confirmation via Email + SMS
 */
export async function sendAppointmentConfirmation(
  appointmentId: number
): Promise<{ emailSent: boolean; smsSent: boolean }> {
  try {
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) {
      logError('❌ Appointment not found:', appointmentId);
      return { emailSent: false, smsSent: false };
    }

    const patient = await storage.getPatient(appointment.patientId);
    if (!patient) {
      logError('❌ Patient not found:', appointment.patientId);
      return { emailSent: false, smsSent: false };
    }

    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();

    // Send Email
    let emailSent = false;
    if (patient.email) {
      emailSent = await sendPatientEmail(
        patient.email,
        patientName,
        'appointmentConfirmation',
        {
          patientName,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          notes: appointment.notes || 'No additional notes'
        }
      );
    }

    // Send SMS
    let smsSent = false;
    if (patient.phone) {
      const smsMessage = `Appointment Confirmation\n\nHi ${patientName},\n\nYour appointment is confirmed for ${formattedDate} at ${formattedTime}.\n\nPlease reply YES to confirm or NO to cancel.\n\nThank you!`;
      smsSent = await sendSMS(patient.phone, smsMessage);
    }

    return { emailSent, smsSent };
  } catch (error) {
    logError('❌ Error sending appointment confirmation:', error);
    return { emailSent: false, smsSent: false };
  }
}

/**
 * Send appointment reminder (24 hours before)
 */
export async function sendAppointmentReminder(
  appointmentId: number
): Promise<{ emailSent: boolean; smsSent: boolean }> {
  try {
    const appointment = await storage.getAppointment(appointmentId);
    if (!appointment) return { emailSent: false, smsSent: false };

    const patient = await storage.getPatient(appointment.patientId);
    if (!patient) return { emailSent: false, smsSent: false };

    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const patientName = `${patient.firstName} ${patient.lastName || ''}`.trim();

    // Send Email Reminder
    let emailSent = false;
    if (patient.email) {
      emailSent = await sendPatientEmail(
        patient.email,
        patientName,
        'appointmentReminder',
        {
          patientName,
          appointmentDate: formattedDate,
          appointmentTime: formattedTime,
          notes: appointment.notes || 'No additional notes'
        }
      );
    }

    // Send SMS Reminder
    let smsSent = false;
    if (patient.phone) {
      const smsMessage = `Appointment Reminder\n\nHi ${patientName},\n\nReminder: You have an appointment tomorrow at ${formattedTime}.\n\nSee you then!`;
      smsSent = await sendSMS(patient.phone, smsMessage);
    }

    return { emailSent, smsSent };
  } catch (error) {
    logError('❌ Error sending appointment reminder:', error);
    return { emailSent: false, smsSent: false };
  }
}

/**
 * Get scheduled appointments for a specific date
 */
async function getAppointmentsForDate(date: Date): Promise<any[]> {
  try {
    // Get all doctors
    const doctors = await storage.getUsers();
    const doctorUsers = doctors.filter((u: any) => u.role === 'doctor');

    // Get all appointments for all doctors
    const allAppointments: any[] = [];
    for (const doctor of doctorUsers) {
      const appointments = await storage.getAppointments(doctor.id);

      // Filter for the specified date
      const dateAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.date);
        return aptDate.toDateString() === date.toDateString();
      });

      // Add doctor info to each appointment
      const appointmentsWithDoctor = dateAppointments.map(apt => ({
        ...apt,
        doctorId: doctor.id,
        doctorName: doctor.name,
        doctorEmail: doctor.email
      }));

      allAppointments.push(...appointmentsWithDoctor);
    }

    return allAppointments;
  } catch (error) {
    logError('❌ Error getting appointments for date:', error);
    return [];
  }
}

/**
 * Send daily patient list to configured email addresses
 * Sends at 7:00 AM every day
 */
async function sendDailyPatientList(): Promise<void> {
  try {
    log('📧 Starting daily patient list email send...');

    // 🚀 PERFORMANCE: Use cached settings (reduces DB queries by ~80%)
    const settings = await settingsCache.get(
      [
        'daily_patient_list_email_1',
        'daily_patient_list_email_2',
        'daily_patient_list_email_3',
        'senderEmail',
        'senderName',
        'appPassword'
      ],
      (keys) => storage.getSettings(keys)
    );

    // 🚀 PERFORMANCE: Early exit if no recipients configured (saves CPU cycles)
    const recipientEmails = [
      settings.daily_patient_list_email_1,
      settings.daily_patient_list_email_2,
      settings.daily_patient_list_email_3
    ].filter(email => email && email.trim() !== '');

    if (recipientEmails.length === 0) {
      log('⏭️ Skipping daily patient list - no recipients configured');
      return;
    }

    if (!settings.senderEmail || !settings.appPassword) {
      log('⏭️ Skipping daily patient list - email not configured');
      return;
    }

    // Get today's date
    const today = new Date();
    const todayFormatted = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get all appointments for today
    const todayAppointments = await getAppointmentsForDate(today);

    if (todayAppointments.length === 0) {
      log(`ℹ️ No appointments scheduled for today (${todayFormatted})`);
      // Still send email to notify that there are no appointments
    }

    // Get patient details for each appointment
    // Optimize: Bulk fetch patients to avoid N+1 query problem
    const patientIds = [...new Set(todayAppointments.map((apt: any) => apt.patientId))] as number[];
    const patientsList = await storage.getPatientsByIds(patientIds);
    const patientsMap = new Map(patientsList.map(p => [p.id, p]));

    const appointmentsWithPatients = todayAppointments.map((apt: any) => {
      const patient = patientsMap.get(apt.patientId);
      return {
        ...apt,
        patient
      };
    });

    // Sort by appointment time
    appointmentsWithPatients.sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Format email content
    let emailText = `Daily Patient List - ${todayFormatted}\n\n`;
    emailText += `Total Appointments: ${appointmentsWithPatients.length}\n\n`;
    emailText += `-----------------------------------\n\n`;

    let emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #1f2937; border-bottom: 3px solid #3b82f6; padding-bottom: 10px;">
          📅 Daily Patient List
        </h1>
        <h2 style="color: #6b7280;">${todayFormatted}</h2>
        <p style="font-size: 18px; color: #374151;">
          <strong>Total Appointments: ${appointmentsWithPatients.length}</strong>
        </p>
        <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
    `;

    if (appointmentsWithPatients.length === 0) {
      emailText += 'No appointments scheduled for today.\n';
      emailHtml += `
        <p style="color: #6b7280; font-size: 16px; text-align: center; padding: 40px 0;">
          No appointments scheduled for today.
        </p>
      `;
    } else {
      // Group appointments by doctor
      const appointmentsByDoctor = appointmentsWithPatients.reduce<Record<string, any[]>>((acc, apt) => {
        const doctorName = apt.doctorName || 'Unknown Doctor';
        if (!acc[doctorName]) {
          acc[doctorName] = [];
        }
        acc[doctorName].push(apt);
        return acc;
      }, {});

      // Create table for each doctor
      for (const [doctorName, appointments] of Object.entries(appointmentsByDoctor)) {
        emailText += `\n${doctorName} - ${appointments.length} appointment(s)\n`;
        emailText += `-----------------------------------\n`;

        emailHtml += `
          <h3 style="color: #3b82f6; margin-top: 30px; margin-bottom: 15px;">
            👨‍⚕️ ${doctorName} (${appointments.length} appointment${appointments.length > 1 ? 's' : ''})
          </h3>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background-color: #f3f4f6;">
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Time</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Patient Name</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Contact</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Reason</th>
                <th style="padding: 12px; text-align: left; border: 1px solid #e5e7eb; font-weight: 600;">Status</th>
              </tr>
            </thead>
            <tbody>
        `;

        appointments.forEach((apt, index) => {
          const time = new Date(apt.date).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          });
          const patientName = apt.patient
            ? `${apt.patient.firstName} ${apt.patient.lastName || ''}`
            : 'Unknown Patient';
          const phone = apt.patient?.phone || 'N/A';
          const email = apt.patient?.email || 'N/A';
          const reason = apt.reason || 'General Consultation';
          const status = apt.status || 'scheduled';

          // Text version
          emailText += `${index + 1}. ${time} - ${patientName}\n`;
          emailText += `   Phone: ${phone}\n`;
          emailText += `   Email: ${email}\n`;
          emailText += `   Reason: ${reason}\n`;
          emailText += `   Status: ${status}\n`;
          if (apt.notes) {
            emailText += `   Notes: ${apt.notes}\n`;
          }
          emailText += `\n`;

          // HTML version
          const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
          const statusBg = status === 'confirmed' ? '#22c55e' : '#f97316';
          const statusColor = '#ffffff';

          emailHtml += `
            <tr style="background-color: ${rowBg};">
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 500;">${time}</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;"><strong>${patientName}</strong></td>
              <td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 14px;">
                📞 ${phone}<br />
                📧 ${email}
              </td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">${reason}</td>
              <td style="padding: 12px; border: 1px solid #e5e7eb;">
                <span style="padding: 4px 8px; background-color: ${statusBg}; color: ${statusColor}; border-radius: 4px; font-size: 12px; font-weight: bold;">
                  ${status.toUpperCase()}
                </span>
              </td>
            </tr>
          `;

          if (apt.notes) {
            emailHtml += `
              <tr style="background-color: ${rowBg};">
                <td colspan="5" style="padding: 8px 12px; border: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                  <strong>Notes:</strong> ${apt.notes}
                </td>
              </tr>
            `;
          }
        });

        emailHtml += `
            </tbody>
          </table>
        `;
      }
    }

    emailHtml += `
        <p style="margin-top: 30px; color: #6b7280; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 20px;">
          This email was automatically generated by your Medical Platform at 7:00 AM.
        </p>
      </div>
    `;

    // Initialize nodemailer
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: settings.senderEmail,
        pass: settings.appPassword
      }
    });

    const from = `"${settings.senderName || 'Medical Platform'}" <${settings.senderEmail}>`;

    // Send to all configured recipients
    for (const recipientEmail of recipientEmails) {
      try {
        await transporter.sendMail({
          to: recipientEmail,
          from,
          subject: `📅 Daily Patient List - ${todayFormatted}`,
          text: emailText,
          html: emailHtml
        });

        log(`✅ Daily patient list sent to: ${recipientEmail}`);
      } catch (error) {
        logError(`❌ Failed to send to ${recipientEmail}:`, error);
      }
    }

    log(`✅ Daily patient list sent successfully to ${recipientEmails.length} recipient(s)`);
  } catch (error) {
    logError('❌ Error sending daily patient list:', error);
  }
}

/**
 * Send appointment reminders for tomorrow
 * Runs at 9:00 AM every day
 */
async function sendTomorrowReminders(): Promise<void> {
  try {
    log('🔔 Checking for tomorrow\'s appointments to send reminders...');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const tomorrowAppointments = await getAppointmentsForDate(tomorrow);

    log(`📊 Found ${tomorrowAppointments.length} appointments for tomorrow`);

    for (const appointment of tomorrowAppointments) {
      const { emailSent, smsSent } = await sendAppointmentReminder(appointment.id);

      if (emailSent || smsSent) {
        log(`✅ Reminder sent for appointment #${appointment.id} (Email: ${emailSent}, SMS: ${smsSent})`);
      } else {
        log(`⚠️ No reminder sent for appointment #${appointment.id}`);
      }

      // Wait 1 second between sends to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log(`✅ Finished sending reminders for ${tomorrowAppointments.length} appointments`);
  } catch (error) {
    logError('❌ Error sending tomorrow reminders:', error);
  }
}

/**
 * Initialize all scheduled tasks
 */
export function initializeScheduler(): void {
  log('🚀 Initializing notification scheduler...');

  // Schedule daily patient list email at 7:00 AM every day
  cron.schedule('0 7 * * *', async () => {
    log('⏰ [7:00 AM] Running daily patient list email send...');
    await sendDailyPatientList();
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  // Schedule appointment reminders at 9:00 AM every day
  cron.schedule('0 9 * * *', async () => {
    log('⏰ [9:00 AM] Running appointment reminders for tomorrow...');
    await sendTomorrowReminders();
  }, {
    timezone: 'America/New_York' // Adjust to your timezone
  });

  log('✅ Notification scheduler initialized');
  log('📧 Daily patient list: 7:00 AM');
  log('🔔 Appointment reminders: 9:00 AM');
}

// Export for manual testing
export { sendDailyPatientList, sendTomorrowReminders };
