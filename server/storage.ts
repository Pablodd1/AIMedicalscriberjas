import { 
  users, 
  patients, 
  appointments, 
  medicalNotes,
  consultationNotes,
  settings,
  emailTemplates,
  invoices,
  intakeForms,
  intakeFormResponses,
  type User, 
  type InsertUser, 
  type Patient, 
  type InsertPatient, 
  type Appointment, 
  type InsertAppointment,
  type MedicalNote,
  type InsertMedicalNote,
  type ConsultationNote,
  type InsertConsultationNote,
  type Invoice,
  type InsertInvoice,
  type Setting,
  type EmailTemplate,
  type IntakeForm,
  type InsertIntakeForm,
  type IntakeFormResponse,
  type InsertIntakeFormResponse
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and } from "drizzle-orm";

// Use connect-pg-simple for session storage with PostgreSQL
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPatients(doctorId: number): Promise<Patient[]>;
  getPatient(id: number): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient>;
  getAppointments(doctorId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  getMedicalNotes(doctorId: number): Promise<MedicalNote[]>;
  getMedicalNotesByPatient(patientId: number): Promise<MedicalNote[]>;
  getMedicalNote(id: number): Promise<MedicalNote | undefined>;
  createMedicalNote(note: InsertMedicalNote): Promise<MedicalNote>;
  getQuickNotes(doctorId: number): Promise<MedicalNote[]>;
  createQuickNote(note: Omit<InsertMedicalNote, 'patientId'> & { signature?: string }): Promise<MedicalNote>;
  getConsultationNotes(doctorId: number): Promise<ConsultationNote[]>;
  getConsultationNotesByPatient(patientId: number): Promise<ConsultationNote[]>;
  getConsultationNote(id: number): Promise<ConsultationNote | undefined>;
  createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote>;
  createMedicalNoteFromConsultation(note: InsertMedicalNote, consultationId: number): Promise<MedicalNote>;
  // Invoice methods
  getInvoices(doctorId: number): Promise<Invoice[]>;
  getInvoicesByPatient(patientId: number): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoiceStatus(id: number, status: string): Promise<Invoice | undefined>;
  updateInvoicePayment(id: number, amountPaid: number): Promise<Invoice | undefined>;
  // Settings methods
  getSetting(key: string): Promise<string | null>;
  getSettings(keys: string[]): Promise<Record<string, string>>;
  saveSetting(key: string, value: string): Promise<Setting>;
  // Email template methods
  getEmailTemplate(type: string): Promise<EmailTemplate | undefined>;
  getEmailTemplates(): Promise<EmailTemplate[]>;
  saveEmailTemplate(type: string, content: string): Promise<EmailTemplate>;
  // Patient intake form methods
  getIntakeForms(doctorId: number): Promise<IntakeForm[]>;
  getIntakeForm(id: number): Promise<IntakeForm | undefined>;
  getIntakeFormByLink(uniqueLink: string): Promise<IntakeForm | undefined>;
  createIntakeForm(form: InsertIntakeForm): Promise<IntakeForm>;
  updateIntakeFormStatus(id: number, status: string): Promise<IntakeForm | undefined>;
  getIntakeFormResponses(formId: number): Promise<IntakeFormResponse[]>;
  createIntakeFormResponse(response: InsertIntakeFormResponse): Promise<IntakeFormResponse>;
  sessionStore: session.Store;
}

// Database Storage implementation
export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, role: "doctor" })
      .returning();
    return user;
  }

  async getPatients(doctorId: number): Promise<Patient[]> {
    return db.select().from(patients).where(eq(patients.createdBy, doctorId));
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient> {
    const [newPatient] = await db
      .insert(patients)
      .values(patient)
      .returning();
    return newPatient;
  }

  async getAppointments(doctorId: number): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.doctorId, doctorId));
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db
      .insert(appointments)
      .values({ ...appointment, status: "scheduled" })
      .returning();
    return newAppointment;
  }

  async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ status })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async getMedicalNotes(doctorId: number): Promise<MedicalNote[]> {
    return db.select().from(medicalNotes).where(eq(medicalNotes.doctorId, doctorId));
  }

  async getMedicalNotesByPatient(patientId: number): Promise<MedicalNote[]> {
    return db.select().from(medicalNotes).where(eq(medicalNotes.patientId, patientId));
  }

  async getMedicalNote(id: number): Promise<MedicalNote | undefined> {
    const [note] = await db.select().from(medicalNotes).where(eq(medicalNotes.id, id));
    return note;
  }

  async createMedicalNote(note: InsertMedicalNote): Promise<MedicalNote> {
    const [newNote] = await db
      .insert(medicalNotes)
      .values({ 
        ...note, 
        consultationId: null,
        isQuickNote: false
      })
      .returning();
    return newNote;
  }
  
  async getQuickNotes(doctorId: number): Promise<MedicalNote[]> {
    return db.select()
      .from(medicalNotes)
      .where(and(
        eq(medicalNotes.doctorId, doctorId),
        eq(medicalNotes.isQuickNote, true)
      ));
  }
  
  async createQuickNote(note: Omit<InsertMedicalNote, 'patientId'> & { signature?: string }): Promise<MedicalNote> {
    const [newNote] = await db
      .insert(medicalNotes)
      .values({ 
        ...note, 
        patientId: null,
        consultationId: null,
        isQuickNote: true
      })
      .returning();
    return newNote;
  }

  async getConsultationNotes(doctorId: number): Promise<ConsultationNote[]> {
    return db.select().from(consultationNotes).where(eq(consultationNotes.doctorId, doctorId));
  }

  async getConsultationNotesByPatient(patientId: number): Promise<ConsultationNote[]> {
    return db.select().from(consultationNotes).where(eq(consultationNotes.patientId, patientId));
  }

  async getConsultationNote(id: number): Promise<ConsultationNote | undefined> {
    const [note] = await db.select().from(consultationNotes).where(eq(consultationNotes.id, id));
    return note;
  }

  async createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote> {
    const [newNote] = await db
      .insert(consultationNotes)
      .values(note)
      .returning();
    return newNote;
  }

  async createMedicalNoteFromConsultation(note: InsertMedicalNote, consultationId: number): Promise<MedicalNote> {
    // First check if consultation exists
    const [consultation] = await db
      .select()
      .from(consultationNotes)
      .where(eq(consultationNotes.id, consultationId));
    
    if (!consultation) {
      throw new Error("Consultation not found");
    }
    
    // Create medical note linked to consultation
    const [newNote] = await db
      .insert(medicalNotes)
      .values({ 
        ...note, 
        consultationId 
      })
      .returning();
    
    return newNote;
  }

  // Settings methods
  async getSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    
    return setting ? setting.value : null;
  }

  async getSettings(keys: string[]): Promise<Record<string, string>> {
    // If we have specific keys, fetch them individually
    if (keys.length > 0) {
      const result: Record<string, string> = {};
      for (const key of keys) {
        const value = await this.getSetting(key);
        if (value !== null) {
          result[key] = value;
        }
      }
      return result;
    }
    
    // Otherwise fetch all settings
    const settingsList = await db.select().from(settings);
    
    return settingsList.reduce<Record<string, string>>((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
  }

  async saveSetting(key: string, value: string): Promise<Setting> {
    // Check if setting already exists
    const [existingSetting] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    
    if (existingSetting) {
      // Update existing setting
      const [updatedSetting] = await db
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.id, existingSetting.id))
        .returning();
      
      return updatedSetting;
    } else {
      // Create new setting
      const [newSetting] = await db
        .insert(settings)
        .values({ key, value })
        .returning();
      
      return newSetting;
    }
  }

  // Email template methods
  async getEmailTemplate(type: string): Promise<EmailTemplate | undefined> {
    const [template] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.type, type));
    
    return template;
  }

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates);
  }

  async saveEmailTemplate(type: string, content: string): Promise<EmailTemplate> {
    // Check if template already exists
    const [existingTemplate] = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.type, type));
    
    if (existingTemplate) {
      // Update existing template
      const [updatedTemplate] = await db
        .update(emailTemplates)
        .set({ content, updatedAt: new Date() })
        .where(eq(emailTemplates.id, existingTemplate.id))
        .returning();
      
      return updatedTemplate;
    } else {
      // Create new template
      const [newTemplate] = await db
        .insert(emailTemplates)
        .values({ type, content })
        .returning();
      
      return newTemplate;
    }
  }
  
  // Patient intake form methods
  async getIntakeForms(doctorId: number): Promise<IntakeForm[]> {
    return db.select().from(intakeForms).where(eq(intakeForms.doctorId, doctorId));
  }

  async getIntakeForm(id: number): Promise<IntakeForm | undefined> {
    const [form] = await db.select().from(intakeForms).where(eq(intakeForms.id, id));
    return form;
  }

  async getIntakeFormByLink(uniqueLink: string): Promise<IntakeForm | undefined> {
    const [form] = await db
      .select()
      .from(intakeForms)
      .where(eq(intakeForms.uniqueLink, uniqueLink));
    
    return form;
  }

  async createIntakeForm(form: InsertIntakeForm): Promise<IntakeForm> {
    const [newForm] = await db
      .insert(intakeForms)
      .values(form)
      .returning();
    
    return newForm;
  }

  async updateIntakeFormStatus(id: number, status: string): Promise<IntakeForm | undefined> {
    // Update status and set completedAt if the status is 'completed'
    const updateData: Record<string, any> = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }
    
    const [updatedForm] = await db
      .update(intakeForms)
      .set(updateData)
      .where(eq(intakeForms.id, id))
      .returning();
    
    return updatedForm;
  }

  async getIntakeFormResponses(formId: number): Promise<IntakeFormResponse[]> {
    return db
      .select()
      .from(intakeFormResponses)
      .where(eq(intakeFormResponses.formId, formId));
  }

  async createIntakeFormResponse(response: InsertIntakeFormResponse): Promise<IntakeFormResponse> {
    const [newResponse] = await db
      .insert(intakeFormResponses)
      .values(response)
      .returning();
    
    return newResponse;
  }

  // Invoice methods
  async getInvoices(doctorId: number): Promise<Invoice[]> {
    return db.select({
      invoice: invoices,
      patient: {
        id: patients.id,
        name: patients.name,
        email: patients.email
      }
    })
    .from(invoices)
    .where(eq(invoices.doctorId, doctorId))
    .innerJoin(patients, eq(invoices.patientId, patients.id))
    .then(results => results.map(({ invoice, patient }) => ({
      ...invoice,
      patient
    })));
  }

  async getInvoicesByPatient(patientId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.patientId, patientId));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    // Generate invoice number if not provided
    const invoiceData = { ...invoice };
    if (!invoiceData.invoiceNumber) {
      // Format: INV-{YYYYMMDD}-{RANDOM4DIGITS}
      const now = new Date();
      const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
      invoiceData.invoiceNumber = `INV-${datePart}-${randomPart}`;
    }

    const [newInvoice] = await db
      .insert(invoices)
      .values(invoiceData)
      .returning();
    return newInvoice;
  }

  async updateInvoiceStatus(id: number, status: string): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ 
        status: status as any, // Cast to satisfy TypeScript
        updatedAt: new Date() 
      })
      .where(eq(invoices.id, id))
      .returning();
    return updatedInvoice;
  }

  async updateInvoicePayment(id: number, amountPaid: number): Promise<Invoice | undefined> {
    // Get the current invoice
    const [currentInvoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, id));
    
    if (!currentInvoice) return undefined;
    
    // Calculate the new status based on the amount paid
    let newStatus = currentInvoice.status;
    if (amountPaid >= currentInvoice.amount) {
      newStatus = 'paid';
    } else if (amountPaid > 0) {
      newStatus = 'partial';
    } else {
      newStatus = 'unpaid';
    }
    
    // Update the invoice
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ 
        amountPaid, 
        status: newStatus as any, // Cast to satisfy TypeScript
        updatedAt: new Date() 
      })
      .where(eq(invoices.id, id))
      .returning();
    
    return updatedInvoice;
  }
}

// Export instance of database storage
export const storage = new DatabaseStorage();