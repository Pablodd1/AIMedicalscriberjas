import { Router } from "express";
import { z } from "zod";
import { MailService } from "@sendgrid/mail";
import { db } from "../db";
import { settings, emailTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";

export const emailRouter = Router();

// Define validation schemas for email settings
const emailSettingsSchema = z.object({
  senderEmail: z.string().email(),
  senderName: z.string().min(2),
  apiKey: z.string().min(5),
});

// Define validation schema for email templates
const emailTemplatesSchema = z.object({
  appointmentConfirmation: z.string().min(10),
  appointmentReminder: z.string().min(10),
  appointmentCancellation: z.string().min(10),
  appointmentRescheduled: z.string().min(10),
});

// Helper function to initialize SendGrid with API key
const initSendGrid = async () => {
  try {
    // Get API key from database
    const [storedSettings] = await db.select().from(settings).where(eq(settings.key, 'email'));
    
    if (!storedSettings || !storedSettings.value) {
      throw new Error("SendGrid API key not configured");
    }
    
    const emailSettings = JSON.parse(storedSettings.value);
    
    if (!emailSettings.apiKey) {
      throw new Error("SendGrid API key not found in settings");
    }
    
    const mailService = new MailService();
    mailService.setApiKey(emailSettings.apiKey);
    
    return { 
      mailService, 
      from: {
        email: emailSettings.senderEmail,
        name: emailSettings.senderName
      }
    };
  } catch (error) {
    console.error("Failed to initialize SendGrid:", error);
    throw error;
  }
};

// Get email settings
emailRouter.get("/email", async (req, res) => {
  try {
    const [storedSettings] = await db.select().from(settings).where(eq(settings.key, 'email'));
    
    if (!storedSettings || !storedSettings.value) {
      return res.status(404).json({ message: "Email settings not found" });
    }
    
    const emailSettings = JSON.parse(storedSettings.value);
    
    // Don't return full API key for security reasons
    if (emailSettings.apiKey) {
      const lastFour = emailSettings.apiKey.slice(-4);
      emailSettings.apiKey = `*****************${lastFour}`;
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
    
    const emailSettings = validation.data;
    
    // Check if settings already exist
    const [existingSettings] = await db.select().from(settings).where(eq(settings.key, 'email'));
    
    if (existingSettings) {
      // Update existing settings
      await db
        .update(settings)
        .set({ value: JSON.stringify(emailSettings) })
        .where(eq(settings.key, 'email'));
    } else {
      // Create new settings
      await db
        .insert(settings)
        .values({ 
          key: 'email',
          value: JSON.stringify(emailSettings)
        });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving email settings:", error);
    res.status(500).json({ message: "Failed to save email settings" });
  }
});

// Get email templates
emailRouter.get("/email-templates", async (req, res) => {
  try {
    const storedTemplates = await db.select().from(emailTemplates);
    
    if (!storedTemplates || storedTemplates.length === 0) {
      return res.status(404).json({ message: "Email templates not found" });
    }
    
    // Convert array of template records to object
    const templates = storedTemplates.reduce((acc, template) => {
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
      // Check if template already exists
      const [existingTemplate] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.type, type));
      
      if (existingTemplate) {
        // Update existing template
        await db
          .update(emailTemplates)
          .set({ content })
          .where(eq(emailTemplates.type, type));
      } else {
        // Create new template
        await db
          .insert(emailTemplates)
          .values({ type, content });
      }
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
    
    const { mailService, from } = await initSendGrid();
    
    await mailService.send({
      to: testEmail,
      from,
      subject: "Test Email from Medical Platform",
      text: "This is a test email to verify your email configuration. If you're receiving this, your email settings are working correctly.",
      html: "<p>This is a test email to verify your email configuration.</p><p>If you're receiving this, your email settings are working correctly.</p>",
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ message: "Failed to send test email: " + error.message });
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
    // Initialize SendGrid
    const { mailService, from } = await initSendGrid();
    
    // Get template
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.type, templateType));
    
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
    await mailService.send({
      to: {
        email: patientEmail,
        name: patientName
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