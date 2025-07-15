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
  recordingSessions,
  devices,
  bpReadings,
  glucoseReadings,
  alertSettings,
  labKnowledgeBase,
  labInterpreterSettings,
  labReports,
  patientDocuments,
  medicalNoteTemplates,
  systemSettings,
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
  type InsertIntakeFormResponse,
  type RecordingSession,
  type InsertRecordingSession,
  type Device,
  type InsertDevice,
  type BpReading,
  type InsertBpReading,
  type GlucoseReading,
  type InsertGlucoseReading,
  type AlertSetting,
  type InsertAlertSetting,
  type LabKnowledgeBase,
  type InsertLabKnowledgeBase,
  type MedicalNoteTemplate,
  type InsertMedicalNoteTemplate,
  type LabInterpreterSettings,
  type InsertLabInterpreterSettings,
  type LabReport,
  type InsertLabReport,
  type PatientDocument,
  type InsertPatientDocument,
  type SystemSetting,
  type InsertSystemSetting
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, desc, asc } from "drizzle-orm";

// Use connect-pg-simple for session storage with PostgreSQL
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User | undefined>;
  updateUserLastLogin(id: number): Promise<void>;
  deleteUser(id: number): Promise<boolean>;
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
  // Recording session methods
  getRecordingSessions(doctorId: number): Promise<RecordingSession[]>;
  getRecordingSessionsByPatient(patientId: number): Promise<RecordingSession[]>;
  getRecordingSession(id: number): Promise<RecordingSession | undefined>;
  getRecordingSessionByRoomId(roomId: string): Promise<RecordingSession | undefined>;
  createRecordingSession(session: InsertRecordingSession): Promise<RecordingSession>;
  updateRecordingSession(id: number, updates: Partial<RecordingSession>): Promise<RecordingSession | undefined>;
  deleteRecordingSession(id: number): Promise<boolean>;
  // Device monitoring methods
  getDevices(patientId: number): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, updates: Partial<Device>): Promise<Device | undefined>;
  deleteDevice(id: number): Promise<boolean>;
  // Blood pressure readings
  getBpReadings(patientId: number, limit?: number): Promise<BpReading[]>;
  getBpReadingsByDevice(deviceId: number, limit?: number): Promise<BpReading[]>;
  createBpReading(reading: InsertBpReading): Promise<BpReading>;
  // Glucose readings
  getGlucoseReadings(patientId: number, limit?: number): Promise<GlucoseReading[]>;
  getGlucoseReadingsByDevice(deviceId: number, limit?: number): Promise<GlucoseReading[]>;
  createGlucoseReading(reading: InsertGlucoseReading): Promise<GlucoseReading>;
  // Alert settings
  getAlertSettings(patientId: number, deviceType: string): Promise<AlertSetting | undefined>;
  saveAlertSettings(settings: InsertAlertSetting): Promise<AlertSetting>;
  updateAlertSettings(id: number, updates: Partial<AlertSetting>): Promise<AlertSetting | undefined>;
  // Lab Interpreter methods
  getLabKnowledgeBase(): Promise<LabKnowledgeBase[]>;
  getLabKnowledgeBaseItem(id: number): Promise<LabKnowledgeBase | undefined>;
  createLabKnowledgeBaseItem(item: InsertLabKnowledgeBase): Promise<LabKnowledgeBase>;
  updateLabKnowledgeBaseItem(id: number, updates: Partial<LabKnowledgeBase>): Promise<LabKnowledgeBase | undefined>;
  deleteLabKnowledgeBaseItem(id: number): Promise<boolean>;
  importLabKnowledgeBase(items: InsertLabKnowledgeBase[]): Promise<number>;
  
  // Lab Interpreter Settings methods
  getLabInterpreterSettings(): Promise<LabInterpreterSettings | undefined>;
  saveLabInterpreterSettings(settings: InsertLabInterpreterSettings): Promise<LabInterpreterSettings>;
  
  // Lab Reports methods
  getLabReports(doctorId: number): Promise<LabReport[]>;
  getLabReportsByPatient(patientId: number): Promise<LabReport[]>;
  getLabReport(id: number): Promise<LabReport | undefined>;
  createLabReport(report: InsertLabReport): Promise<LabReport>;
  updateLabReport(id: number, updates: Partial<LabReport>): Promise<LabReport | undefined>;
  deleteLabReport(id: number): Promise<boolean>;
  
  // Patient Document methods
  getPatientDocuments(patientId: number): Promise<PatientDocument[]>;
  getPatientDocument(id: number): Promise<PatientDocument | undefined>;
  createPatientDocument(document: InsertPatientDocument): Promise<PatientDocument>;
  updatePatientDocument(id: number, updates: Partial<PatientDocument>): Promise<PatientDocument | undefined>;
  deletePatientDocument(id: number): Promise<boolean>;

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
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  
  async getUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(users.createdAt);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...insertUser,
        isActive: true,
        createdAt: new Date(),
      })
      .returning();
    return user;
  }
  
  async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async updateUserLastLogin(id: number): Promise<void> {
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, id));
  }

  async updateUserApiKey(id: number, apiKey: string | null): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ openaiApiKey: apiKey })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async getUserApiKey(id: number): Promise<string | null> {
    const user = await this.getUser(id);
    return user?.openaiApiKey || null;
  }

  async updateUserApiKeySettings(id: number, useOwnApiKey: boolean): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ useOwnApiKey })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // System settings methods
  async getSystemSetting(key: string): Promise<string | null> {
    const [setting] = await db
      .select({ value: systemSettings.settingValue })
      .from(systemSettings)
      .where(eq(systemSettings.settingKey, key));
    return setting?.value || null;
  }

  async setSystemSetting(key: string, value: string | null, description?: string, updatedBy?: number): Promise<void> {
    await db
      .insert(systemSettings)
      .values({
        settingKey: key,
        settingValue: value,
        description,
        updatedBy,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.settingKey,
        set: {
          settingValue: value,
          updatedAt: new Date(),
          updatedBy,
        },
      });
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings).orderBy(systemSettings.settingKey);
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      // First, check if user exists
      const user = await this.getUser(id);
      if (!user) {
        console.log('User not found for deletion:', id);
        return false;
      }
      
      console.log('Attempting to delete user:', { id, username: user.username });
      
      // Delete related records first to handle foreign key constraints
      // Delete patient documents if the user is a patient
      await db.delete(patientDocuments).where(eq(patientDocuments.patientId, id));
      
      // Delete medical notes where user is the doctor
      await db.delete(medicalNotes).where(eq(medicalNotes.doctorId, id));
      
      // Delete consultation notes where user is the doctor
      await db.delete(consultationNotes).where(eq(consultationNotes.doctorId, id));
      
      // Delete appointments where user is patient or doctor
      await db.delete(appointments).where(eq(appointments.patientId, id));
      await db.delete(appointments).where(eq(appointments.doctorId, id));
      
      // Delete intake forms where user is patient or doctor
      await db.delete(intakeForms).where(eq(intakeForms.patientId, id));
      await db.delete(intakeForms).where(eq(intakeForms.doctorId, id));
      
      // Delete invoices where user is patient or doctor
      await db.delete(invoices).where(eq(invoices.patientId, id));
      await db.delete(invoices).where(eq(invoices.doctorId, id));
      
      // Delete monitoring devices and readings
      await db.delete(devices).where(eq(devices.patientId, id));
      await db.delete(bpReadings).where(eq(bpReadings.patientId, id));
      await db.delete(glucoseReadings).where(eq(glucoseReadings.patientId, id));
      
      // Delete recording sessions
      await db.delete(recordingSessions).where(eq(recordingSessions.doctorId, id));
      
      // Now delete the user
      const result = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning({ id: users.id });
      
      const success = result.length > 0;
      console.log('User deletion result:', { id, success });
      
      return success;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
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
    const [updatedForm] = await db
      .update(intakeForms)
      .set({ 
        status, 
        completedAt: status === 'completed' ? new Date() : null 
      })
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
    return db.select().from(invoices).where(eq(invoices.doctorId, doctorId));
  }

  async getInvoicesByPatient(patientId: number): Promise<Invoice[]> {
    return db.select().from(invoices).where(eq(invoices.patientId, patientId));
  }

  async getInvoice(id: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
    const [newInvoice] = await db
      .insert(invoices)
      .values(invoice)
      .returning();
    
    return newInvoice;
  }

  async updateInvoiceStatus(id: number, status: 'paid' | 'partial' | 'unpaid' | 'overdue'): Promise<Invoice | undefined> {
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ status, updatedAt: new Date() })
      .where(eq(invoices.id, id))
      .returning();
    
    return updatedInvoice;
  }

  async updateInvoicePayment(id: number, amountPaid: number): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    
    if (!invoice) {
      return undefined;
    }
    
    // Update payment and status if needed
    const newAmountPaid = amountPaid;
    let status: 'paid' | 'partial' | 'unpaid' | 'overdue' = invoice.status;
    
    // Determine new status based on payment
    if (newAmountPaid === 0) {
      status = 'unpaid';
    } else if (newAmountPaid >= invoice.amount) {
      status = 'paid';
    } else {
      status = 'partial';
    }
    
    // Update invoice
    const [updatedInvoice] = await db
      .update(invoices)
      .set({ 
        amountPaid: newAmountPaid, 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(invoices.id, id))
      .returning();
    
    return updatedInvoice;
  }

  // Recording session methods
  async getRecordingSessions(doctorId: number): Promise<RecordingSession[]> {
    return db.select()
      .from(recordingSessions)
      .where(eq(recordingSessions.doctorId, doctorId))
      .orderBy(desc(recordingSessions.startTime));
  }

  async getRecordingSessionsByPatient(patientId: number): Promise<RecordingSession[]> {
    return db.select()
      .from(recordingSessions)
      .where(eq(recordingSessions.patientId, patientId))
      .orderBy(desc(recordingSessions.startTime));
  }

  async getRecordingSession(id: number): Promise<RecordingSession | undefined> {
    const [session] = await db
      .select()
      .from(recordingSessions)
      .where(eq(recordingSessions.id, id));
    
    return session;
  }

  async getRecordingSessionByRoomId(roomId: string): Promise<RecordingSession | undefined> {
    const [session] = await db
      .select()
      .from(recordingSessions)
      .where(eq(recordingSessions.roomId, roomId));
    
    return session;
  }

  async createRecordingSession(session: InsertRecordingSession): Promise<RecordingSession> {
    const [newSession] = await db
      .insert(recordingSessions)
      .values(session)
      .returning();
    
    return newSession;
  }

  async updateRecordingSession(id: number, updates: Partial<RecordingSession>): Promise<RecordingSession | undefined> {
    const [updatedSession] = await db
      .update(recordingSessions)
      .set(updates)
      .where(eq(recordingSessions.id, id))
      .returning();
    
    return updatedSession;
  }
  
  async deleteRecordingSession(id: number): Promise<boolean> {
    const result = await db
      .delete(recordingSessions)
      .where(eq(recordingSessions.id, id))
      .returning({ id: recordingSessions.id });
    return result.length > 0;
  }
  
  // Device monitoring methods
  async getDevices(patientId: number): Promise<Device[]> {
    return db.select()
      .from(devices)
      .where(eq(devices.patientId, patientId))
      .orderBy(devices.name);
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db
      .select()
      .from(devices)
      .where(eq(devices.id, id));
    return device;
  }

  async createDevice(deviceData: InsertDevice): Promise<Device> {
    const [device] = await db
      .insert(devices)
      .values({
        ...deviceData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return device;
  }

  async updateDevice(id: number, updates: Partial<Device>): Promise<Device | undefined> {
    const [updatedDevice] = await db
      .update(devices)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(devices.id, id))
      .returning();
    return updatedDevice;
  }

  async deleteDevice(id: number): Promise<boolean> {
    const result = await db
      .delete(devices)
      .where(eq(devices.id, id))
      .returning({ id: devices.id });
    return result.length > 0;
  }

  // Blood pressure readings
  async getBpReadings(patientId: number, limit?: number): Promise<BpReading[]> {
    let query = db.select()
      .from(bpReadings)
      .where(eq(bpReadings.patientId, patientId))
      .orderBy(desc(bpReadings.timestamp));
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return query;
  }

  async getBpReadingsByDevice(deviceId: number, limit?: number): Promise<BpReading[]> {
    let query = db.select()
      .from(bpReadings)
      .where(eq(bpReadings.deviceId, deviceId))
      .orderBy(desc(bpReadings.timestamp));
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return query;
  }

  async createBpReading(reading: InsertBpReading): Promise<BpReading> {
    const [newReading] = await db
      .insert(bpReadings)
      .values({
        ...reading,
        timestamp: new Date()
      })
      .returning();
    return newReading;
  }

  // Glucose readings
  async getGlucoseReadings(patientId: number, limit?: number): Promise<GlucoseReading[]> {
    let query = db.select()
      .from(glucoseReadings)
      .where(eq(glucoseReadings.patientId, patientId))
      .orderBy(desc(glucoseReadings.timestamp));
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return query;
  }

  async getGlucoseReadingsByDevice(deviceId: number, limit?: number): Promise<GlucoseReading[]> {
    let query = db.select()
      .from(glucoseReadings)
      .where(eq(glucoseReadings.deviceId, deviceId))
      .orderBy(desc(glucoseReadings.timestamp));
    
    if (limit) {
      query = query.limit(limit);
    }
    
    return query;
  }

  async createGlucoseReading(reading: InsertGlucoseReading): Promise<GlucoseReading> {
    const [newReading] = await db
      .insert(glucoseReadings)
      .values({
        ...reading,
        timestamp: new Date()
      })
      .returning();
    return newReading;
  }

  // Alert settings
  async getAlertSettings(patientId: number, deviceType: string): Promise<AlertSetting | undefined> {
    const [settings] = await db
      .select()
      .from(alertSettings)
      .where(
        and(
          eq(alertSettings.patientId, patientId),
          eq(alertSettings.deviceType, deviceType as any)
        )
      );
    return settings;
  }

  async saveAlertSettings(settingsData: InsertAlertSetting): Promise<AlertSetting> {
    // Check if settings already exist for this patient and device type
    const existing = await this.getAlertSettings(
      settingsData.patientId, 
      settingsData.deviceType as string
    );
    
    if (existing) {
      // Update existing settings
      const [updated] = await db
        .update(alertSettings)
        .set({
          ...settingsData,
          updatedAt: new Date()
        })
        .where(eq(alertSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new settings
      const [newSettings] = await db
        .insert(alertSettings)
        .values({
          ...settingsData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      return newSettings;
    }
  }

  async updateAlertSettings(id: number, updates: Partial<AlertSetting>): Promise<AlertSetting | undefined> {
    const [updatedSettings] = await db
      .update(alertSettings)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(alertSettings.id, id))
      .returning();
    return updatedSettings;
  }

  // Lab Interpreter methods
  async getLabKnowledgeBase(): Promise<LabKnowledgeBase[]> {
    try {
      return await db.select().from(labKnowledgeBase).orderBy(labKnowledgeBase.test_name);
    } catch (error) {
      console.error("Error fetching lab knowledge base:", error);
      return [];
    }
  }

  async getLabKnowledgeBaseItem(id: number): Promise<LabKnowledgeBase | undefined> {
    try {
      const [item] = await db.select().from(labKnowledgeBase).where(eq(labKnowledgeBase.id, id));
      return item;
    } catch (error) {
      console.error("Error fetching lab knowledge base item:", error);
      return undefined;
    }
  }

  async createLabKnowledgeBaseItem(item: InsertLabKnowledgeBase): Promise<LabKnowledgeBase> {
    try {
      const [newItem] = await db.insert(labKnowledgeBase).values(item).returning();
      return newItem;
    } catch (error) {
      console.error("Error creating lab knowledge base item:", error);
      throw error;
    }
  }

  async updateLabKnowledgeBaseItem(id: number, updates: Partial<LabKnowledgeBase>): Promise<LabKnowledgeBase | undefined> {
    try {
      const [updated] = await db
        .update(labKnowledgeBase)
        .set({
          ...updates
        })
        .where(eq(labKnowledgeBase.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating lab knowledge base item:", error);
      return undefined;
    }
  }

  async deleteLabKnowledgeBaseItem(id: number): Promise<boolean> {
    try {
      const result = await db.delete(labKnowledgeBase).where(eq(labKnowledgeBase.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting lab knowledge base item:", error);
      return false;
    }
  }

  async importLabKnowledgeBase(items: InsertLabKnowledgeBase[]): Promise<number> {
    try {
      const result = await db.insert(labKnowledgeBase).values(items).returning();
      return result.length;
    } catch (error) {
      console.error("Error importing lab knowledge base:", error);
      throw error;
    }
  }

  // Lab Interpreter Settings methods
  async getLabInterpreterSettings(): Promise<LabInterpreterSettings | undefined> {
    try {
      const [settings] = await db.select().from(labInterpreterSettings).limit(1);
      return settings;
    } catch (error) {
      console.error("Error fetching lab interpreter settings:", error);
      return undefined;
    }
  }

  async saveLabInterpreterSettings(settings: InsertLabInterpreterSettings): Promise<LabInterpreterSettings> {
    try {
      // Check if settings already exist
      const existingSettings = await this.getLabInterpreterSettings();
      
      if (existingSettings) {
        // Update existing settings
        const [updated] = await db
          .update(labInterpreterSettings)
          .set({
            ...settings,
            updatedAt: new Date()
          })
          .where(eq(labInterpreterSettings.id, existingSettings.id))
          .returning();
        return updated;
      } else {
        // Create new settings
        const [newSettings] = await db.insert(labInterpreterSettings).values(settings).returning();
        return newSettings;
      }
    } catch (error) {
      console.error("Error saving lab interpreter settings:", error);
      throw error;
    }
  }

  // Lab Reports methods
  async getLabReports(doctorId: number): Promise<LabReport[]> {
    try {
      return await db
        .select()
        .from(labReports)
        .where(eq(labReports.doctorId, doctorId))
        .orderBy(desc(labReports.createdAt));
    } catch (error) {
      console.error("Error fetching lab reports:", error);
      return [];
    }
  }

  // Medical Note Templates methods
  async getMedicalNoteTemplates(): Promise<MedicalNoteTemplate[]> {
    try {
      return await db
        .select()
        .from(medicalNoteTemplates)
        .orderBy(asc(medicalNoteTemplates.type));
    } catch (error) {
      console.error("Error fetching medical note templates:", error);
      return [];
    }
  }

  async getMedicalNoteTemplatesByType(type: string): Promise<MedicalNoteTemplate[]> {
    try {
      return await db
        .select()
        .from(medicalNoteTemplates)
        .where(eq(medicalNoteTemplates.type, type))
        .orderBy(asc(medicalNoteTemplates.createdAt));
    } catch (error) {
      console.error("Error fetching medical note templates by type:", error);
      return [];
    }
  }

  async getMedicalNoteTemplate(id: number): Promise<MedicalNoteTemplate | undefined> {
    try {
      const [template] = await db
        .select()
        .from(medicalNoteTemplates)
        .where(eq(medicalNoteTemplates.id, id));
      return template;
    } catch (error) {
      console.error("Error fetching medical note template:", error);
      return undefined;
    }
  }

  async createMedicalNoteTemplate(template: InsertMedicalNoteTemplate): Promise<MedicalNoteTemplate> {
    try {
      const [newTemplate] = await db
        .insert(medicalNoteTemplates)
        .values(template)
        .returning();
      return newTemplate;
    } catch (error) {
      console.error("Error creating medical note template:", error);
      throw error;
    }
  }

  async updateMedicalNoteTemplate(id: number, updates: Partial<MedicalNoteTemplate>): Promise<MedicalNoteTemplate | undefined> {
    try {
      const [updated] = await db
        .update(medicalNoteTemplates)
        .set({
          ...updates,
          updatedAt: new Date()
        })
        .where(eq(medicalNoteTemplates.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating medical note template:", error);
      return undefined;
    }
  }

  async deleteMedicalNoteTemplate(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(medicalNoteTemplates)
        .where(eq(medicalNoteTemplates.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting medical note template:", error);
      return false;
    }
  }

  async getLabReportsByPatient(patientId: number): Promise<LabReport[]> {
    try {
      return await db
        .select()
        .from(labReports)
        .where(eq(labReports.patientId, patientId))
        .orderBy(desc(labReports.createdAt));
    } catch (error) {
      console.error("Error fetching lab reports by patient:", error);
      return [];
    }
  }

  async getLabReport(id: number): Promise<LabReport | undefined> {
    try {
      const [report] = await db.select().from(labReports).where(eq(labReports.id, id));
      return report;
    } catch (error) {
      console.error("Error fetching lab report:", error);
      return undefined;
    }
  }

  async createLabReport(report: InsertLabReport): Promise<LabReport> {
    try {
      const [newReport] = await db.insert(labReports).values(report).returning();
      return newReport;
    } catch (error) {
      console.error("Error creating lab report:", error);
      throw error;
    }
  }

  async updateLabReport(id: number, updates: Partial<LabReport>): Promise<LabReport | undefined> {
    try {
      const [updated] = await db
        .update(labReports)
        .set(updates)
        .where(eq(labReports.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating lab report:", error);
      return undefined;
    }
  }

  async deleteLabReport(id: number): Promise<boolean> {
    try {
      const result = await db.delete(labReports).where(eq(labReports.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting lab report:", error);
      return false;
    }
  }

  // Patient Documents methods
  async getPatientDocuments(patientId: number): Promise<PatientDocument[]> {
    try {
      return db
        .select()
        .from(patientDocuments)
        .where(eq(patientDocuments.patientId, patientId))
        .orderBy(desc(patientDocuments.uploadedAt));
    } catch (error) {
      console.error("Error fetching patient documents:", error);
      return [];
    }
  }
  
  async getPatientDocument(id: number): Promise<PatientDocument | undefined> {
    try {
      const [document] = await db
        .select()
        .from(patientDocuments)
        .where(eq(patientDocuments.id, id));
      return document;
    } catch (error) {
      console.error("Error fetching patient document:", error);
      return undefined;
    }
  }
  
  async createPatientDocument(document: InsertPatientDocument): Promise<PatientDocument> {
    try {
      const [newDocument] = await db
        .insert(patientDocuments)
        .values(document)
        .returning();
      return newDocument;
    } catch (error) {
      console.error("Error creating patient document:", error);
      throw error;
    }
  }
  
  async updatePatientDocument(id: number, updates: Partial<PatientDocument>): Promise<PatientDocument | undefined> {
    try {
      const [updated] = await db
        .update(patientDocuments)
        .set(updates)
        .where(eq(patientDocuments.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error("Error updating patient document:", error);
      return undefined;
    }
  }
  
  async deletePatientDocument(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(patientDocuments)
        .where(eq(patientDocuments.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting patient document:", error);
      return false;
    }
  }
  
  async updatePatientDocument(id: number, updates: Partial<PatientDocument>): Promise<PatientDocument | undefined> {
    try {
      const [updatedDocument] = await db
        .update(patientDocuments)
        .set(updates)
        .where(eq(patientDocuments.id, id))
        .returning();
      return updatedDocument;
    } catch (error) {
      console.error("Error updating patient document:", error);
      return undefined;
    }
  }
}

// Export instance of database storage
export const storage = new DatabaseStorage();