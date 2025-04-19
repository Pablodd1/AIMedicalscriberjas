import { Router } from "express";
import { db } from "../db";
import { storage } from "../storage";
import { settings, emailTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import nodemailer from 'nodemailer';

// Email settings schema for SMTP
const emailSettingsSchema = z.object({
  senderEmail: z.string().email(),
  senderName: z.string().min(2),
  appPassword: z.string().min(1),
});

// Email templates schema
const emailTemplatesSchema = z.object({
  appointmentConfirmation: z.string().min(10),
  appointmentReminder: z.string().min(10),
  appointmentCancellation: z.string().min(10),
  appointmentRescheduled: z.string().min(10),
});

// Initialize Nodemailer with stored SMTP settings
async function initNodemailer() {
  const settings = await storage.getSettings([
    'senderEmail', 
    'senderName', 
    'appPassword'
  ]);

  if (!settings.senderEmail || !settings.appPassword) {
    throw new Error("Email settings not configured properly");
  }

  // Create reusable transporter object using Gmail SMTP
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: settings.senderEmail,
      pass: settings.appPassword,
    },
  });
  
  const from = `"${settings.senderName || 'Medical Platform'}" <${settings.senderEmail}>`;
  
  return { transporter, from };
}

export const emailRouter = Router();

// Get email settings
emailRouter.get("/email", async (req, res) => {
  try {
    // Get the email settings from database
    const emailSettings = await storage.getSettings([
      'senderEmail', 
      'senderName', 
      'appPassword'
    ]);
    
    // Return masked password for security
    if (emailSettings.appPassword) {
      const lastFourChars = emailSettings.appPassword.slice(-4);
      emailSettings.appPassword = `••••••••••••${lastFourChars}`;
    }
    
    res.json(emailSettings);
  } catch (error) {
    console.error("Error retrieving email settings:", error);
    res.status(500).json({ message: "Failed to retrieve email settings" });
  }
});

// Save email settings
emailRouter.post("/email", async (req, res) => {
  try {
    const validation = emailSettingsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    
    const { 
      senderEmail, 
      senderName, 
      appPassword
    } = validation.data;
    
    // Save each setting individually
    await Promise.all([
      storage.saveSetting('senderEmail', senderEmail),
      storage.saveSetting('senderName', senderName),
      storage.saveSetting('appPassword', appPassword),
    ]);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving email settings:", error);
    res.status(500).json({ message: "Failed to save email settings" });
  }
});

// Get email templates
emailRouter.get("/email-templates", async (req, res) => {
  try {
    // Get all templates from database
    const storedTemplates = await storage.getEmailTemplates();
    
    if (!storedTemplates || storedTemplates.length === 0) {
      return res.status(404).json({ message: "Email templates not found" });
    }
    
    // Convert array of template records to object
    const templates = storedTemplates.reduce<Record<string, string>>((acc, template) => {
      acc[template.type] = template.content;
      return acc;
    }, {});
    
    res.json(templates);
  } catch (error) {
    console.error("Error retrieving email templates:", error);
    res.status(500).json({ message: "Failed to retrieve email templates" });
  }
});

// Save email templates
emailRouter.post("/email-templates", async (req, res) => {
  try {
    const validation = emailTemplatesSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json(validation.error);
    }
    
    const templates = validation.data;
    
    // For each template in the request
    for (const [type, content] of Object.entries(templates)) {
      // Save template
      await storage.saveEmailTemplate(type, content);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving email templates:", error);
    res.status(500).json({ message: "Failed to save email templates" });
  }
});

// Helper function to replace template placeholders with actual values
const replacePlaceholders = (template: string, data: Record<string, string>) => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
};

// Send test email
emailRouter.post("/test-email", async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ message: "Test email address is required" });
    }
    
    const { transporter, from } = await initNodemailer();
    
    await transporter.sendMail({
      to: testEmail,
      from,
      subject: "Test Email from Medical Platform",
      text: "This is a test email to verify your email configuration. If you're receiving this, your email settings are working correctly.",
      html: "<p>This is a test email to verify your email configuration.</p><p>If you're receiving this, your email settings are working correctly.</p>",
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error sending test email:", error);
    res.status(500).json({ message: "Failed to send test email: " + (error.message || 'Unknown error') });
  }
});

// Send patient email - used by the appointment routes
export const sendPatientEmail = async (
  patientEmail: string, 
  patientName: string,
  templateType: string, 
  data: Record<string, string>
) => {
  try {
    // Initialize Nodemailer
    const { transporter, from } = await initNodemailer();
    
    // Get template
    const template = await storage.getEmailTemplate(templateType);
    
    if (!template || !template.content) {
      throw new Error(`Email template for '${templateType}' not found`);
    }
    
    // Replace placeholders in template
    const emailContent = replacePlaceholders(template.content, data);
    
    // Determine subject based on template type
    let subject = "Your Appointment";
    switch (templateType) {
      case "appointmentConfirmation":
        subject = "Appointment Confirmation";
        break;
      case "appointmentReminder":
        subject = "Appointment Reminder";
        break;
      case "appointmentCancellation":
        subject = "Appointment Cancellation";
        break;
      case "appointmentRescheduled":
        subject = "Appointment Rescheduled";
        break;
    }
    
    // Send email
    await transporter.sendMail({
      to: {
        name: patientName,
        address: patientEmail
      },
      from,
      subject,
      text: emailContent,
      html: emailContent.replace(/\n/g, "<br />"),
    });
    
    return true;
  } catch (error) {
    console.error(`Error sending ${templateType} email:`, error);
    return false;
  }
};