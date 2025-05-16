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
  type InsertAlertSetting
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, desc } from "drizzle-orm";

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
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
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
}

// Export instance of database storage
export const storage = new DatabaseStorage();