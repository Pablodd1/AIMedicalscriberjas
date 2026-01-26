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
  consultationParticipants,
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
  medicalAlerts,
  patientActivity,
  prescriptions,
  medicalHistoryEntries,
  customNotePrompts,
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
  type ConsultationParticipant,
  type InsertConsultationParticipant,
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
  type InsertSystemSetting,
  type MedicalAlert,
  type InsertMedicalAlert,
  type PatientActivity,
  type InsertPatientActivity,
  type Prescription,
  type InsertPrescription,
  type MedicalHistoryEntry,
  type InsertMedicalHistoryEntry,
  type CustomNotePrompt,
  type InsertCustomNotePrompt
} from "@shared/schema";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, desc, asc, gte, lte, inArray, count } from "drizzle-orm";
import { MockStorage } from "./mock-storage";

import { log, logError } from './logger';

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
  updateUserApiKeySettings(id: number, useOwnApiKey: boolean): Promise<User | undefined>;
  getPatients(doctorId: number): Promise<Patient[]>;
  getClinicPatients(location: string): Promise<Patient[]>;
  getPatient(id: number): Promise<Patient | undefined>;
  getPatientsByIds(ids: number[]): Promise<Patient[]>;
  createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient>;
  createPatients(patients: (InsertPatient & { createdBy: number })[]): Promise<Patient[]>;
  getAppointments(doctorId: number): Promise<Appointment[]>;
  getAppointmentsForDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;
  getAppointment(id: number): Promise<Appointment | undefined>;
  getClinicAppointments(location: string): Promise<Appointment[]>;
  getAppointmentByToken(token: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined>;
  updatePatientConfirmationStatus(id: number, status: string): Promise<Appointment | undefined>;
  clearAppointmentToken(id: number): Promise<void>;
  updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  getMedicalNotes(doctorId: number): Promise<MedicalNote[]>;
  getMedicalNotesByPatient(patientId: number, limit?: number): Promise<MedicalNote[]>;
  getMedicalNotesCountByPatient(patientId: number): Promise<number>;
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
  // Consultation participant methods
  getParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]>;
  getActiveParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]>;
  addParticipant(participant: InsertConsultationParticipant): Promise<ConsultationParticipant>;
  removeParticipant(id: number): Promise<boolean>;
  markParticipantLeft(id: number): Promise<ConsultationParticipant | undefined>;
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
  deleteLabKnowledgeBaseItem(id: number, userId?: number): Promise<boolean>;
  importLabKnowledgeBase(items: InsertLabKnowledgeBase[], userId: number): Promise<number>;
  clearUserLabKnowledgeBase(userId: number): Promise<number>;

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

  // Medical Alerts
  getMedicalAlertsByPatient(patientId: number): Promise<MedicalAlert[]>;
  createMedicalAlert(alert: InsertMedicalAlert): Promise<MedicalAlert>;
  updateMedicalAlert(id: number, alert: Partial<InsertMedicalAlert>): Promise<MedicalAlert | undefined>;
  deleteMedicalAlert(id: number): Promise<void>;

  // Patient Activity
  getPatientActivity(patientId: number): Promise<PatientActivity[]>;
  createPatientActivity(activity: InsertPatientActivity): Promise<PatientActivity>;
  deletePatientActivity(id: number): Promise<void>;

  // Prescriptions
  getPrescriptionsByPatient(patientId: number): Promise<Prescription[]>;
  createPrescription(prescription: InsertPrescription): Promise<Prescription>;
  updatePrescription(id: number, prescription: Partial<InsertPrescription>): Promise<Prescription | undefined>;
  deletePrescription(id: number): Promise<void>;

  // Medical History Entries
  getMedicalHistoryEntriesByPatient(patientId: number): Promise<MedicalHistoryEntry[]>;
  createMedicalHistoryEntry(entry: InsertMedicalHistoryEntry): Promise<MedicalHistoryEntry>;
  updateMedicalHistoryEntry(id: number, entry: Partial<InsertMedicalHistoryEntry>): Promise<MedicalHistoryEntry | undefined>;
  deleteMedicalHistoryEntry(id: number): Promise<void>;

  // System settings methods
  getSystemSetting(key: string): Promise<string | null>;
  setSystemSetting(key: string, value: string | null, description?: string, updatedBy?: number): Promise<void>;

  // Custom note prompts methods
  getCustomNotePrompt(userId: number, noteType: string): Promise<CustomNotePrompt | undefined>;
  getCustomNotePrompts(userId: number): Promise<CustomNotePrompt[]>;
  saveCustomNotePrompt(prompt: InsertCustomNotePrompt): Promise<CustomNotePrompt>;
  deleteCustomNotePrompt(userId: number, noteType: string): Promise<void>;

  // Global prompts methods
  getGlobalPrompts(): Promise<CustomNotePrompt[]>;
  getGlobalPrompt(id: number): Promise<CustomNotePrompt | undefined>;
  createGlobalPrompt(prompt: Partial<InsertCustomNotePrompt> & { userId: number }): Promise<CustomNotePrompt>;
  updateGlobalPrompt(id: number, updates: Partial<CustomNotePrompt>): Promise<CustomNotePrompt | undefined>;
  deleteGlobalPrompt(id: number): Promise<boolean>;

  sessionStore: session.Store;
}

// Database Storage implementation
export class DatabaseStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    try {
      this.sessionStore = new PostgresSessionStore({
        pool,
        createTableIfMissing: true,
        errorLog: console.error.bind(console)
      });
    } catch (error) {
      logError('Error initializing session store:', error);
      // Use memory store as fallback
      const MemoryStore = require('memorystore')(session);
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      });
      log('Using memory store as fallback for sessions');
    }
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
        username: insertUser.username,
        password: insertUser.password,
        name: insertUser.name,
        email: insertUser.email,
        role: insertUser.role,
        phone: insertUser.phone ?? null,
        specialty: insertUser.specialty ?? null,
        licenseNumber: insertUser.licenseNumber ?? null,
        avatar: insertUser.avatar ?? null,
        bio: insertUser.bio ?? null,
        isActive: insertUser.isActive ?? true,
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
        log('User not found for deletion:', { id });
        return false;
      }

      log('Attempting to delete user:', { id, username: user.username });

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
      log('User deletion result:', { id, success });

      return success;
    } catch (error) {
      logError('Error deleting user:', error, { id });
      return false;
    }
  }

  async getPatients(doctorId: number): Promise<Patient[]> {
    return db.select().from(patients).where(eq(patients.createdBy, doctorId));
  }

  async getClinicPatients(location: string): Promise<Patient[]> {
    const results = await db
      .select({
        patient: patients
      })
      .from(patients)
      .innerJoin(users, eq(patients.createdBy, users.id))
      .where(eq(users.clinicLocation, location));
    return results.map(r => r.patient);
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient;
  }

  async getPatientsByIds(ids: number[]): Promise<Patient[]> {
    if (ids.length === 0) return [];
    const result = await db.select().from(patients).where(inArray(patients.id, ids));
    return result;
  }

  async createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient> {
    const [newPatient] = await db
      .insert(patients)
      .values(patient)
      .returning();
    return newPatient;
  }

  async createPatients(patientsData: (InsertPatient & { createdBy: number })[]): Promise<Patient[]> {
    if (patientsData.length === 0) {
      return [];
    }
    const newPatients = await db
      .insert(patients)
      .values(patientsData)
      .returning();
    return newPatients;
  }

  async getAppointments(doctorId: number): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.doctorId, doctorId));
  }

  async getAppointmentsForDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return db.select()
      .from(appointments)
      .where(
        and(
          gte(appointments.date, startDate),
          lte(appointments.date, endDate)
        )
      );
  }

  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async getClinicAppointments(location: string): Promise<Appointment[]> {
    const results = await db
      .select({
        appointment: appointments
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .where(eq(users.clinicLocation, location));
    return results.map(r => r.appointment);
  }

  async getAppointmentByToken(token: string): Promise<Appointment[]> {
    return db.select().from(appointments).where(eq(appointments.confirmationToken, token));
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db
      .insert(appointments)
      .values(appointment)
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

  async updatePatientConfirmationStatus(id: number, status: string): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ patientConfirmationStatus: status })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async clearAppointmentToken(id: number): Promise<void> {
    await db
      .update(appointments)
      .set({ confirmationToken: null })
      .where(eq(appointments.id, id));
  }

  async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set(updates)
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    try {
      const result = await db.delete(appointments).where(eq(appointments.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      logError('Error deleting appointment:', error);
      return false;
    }
  }

  async getMedicalNotes(doctorId: number): Promise<MedicalNote[]> {
    return db.select().from(medicalNotes).where(eq(medicalNotes.doctorId, doctorId));
  }

  async getMedicalNotesByPatient(patientId: number, limit?: number): Promise<MedicalNote[]> {
    if (limit) {
      return db.select().from(medicalNotes).where(eq(medicalNotes.patientId, patientId)).orderBy(desc(medicalNotes.createdAt)).limit(limit);
    }
    return db.select().from(medicalNotes).where(eq(medicalNotes.patientId, patientId)).orderBy(desc(medicalNotes.createdAt));
  }

  async getMedicalNotesCountByPatient(patientId: number): Promise<number> {
    const [result] = await db.select({ value: count() }).from(medicalNotes).where(eq(medicalNotes.patientId, patientId));
    return result.value;
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

  // Consultation participant methods
  async getParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]> {
    return db.select()
      .from(consultationParticipants)
      .where(eq(consultationParticipants.roomId, roomId))
      .orderBy(asc(consultationParticipants.joinedAt));
  }

  async getActiveParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]> {
    return db.select()
      .from(consultationParticipants)
      .where(and(
        eq(consultationParticipants.roomId, roomId),
        eq(consultationParticipants.isActive, true)
      ))
      .orderBy(asc(consultationParticipants.joinedAt));
  }

  async addParticipant(participant: InsertConsultationParticipant): Promise<ConsultationParticipant> {
    const [newParticipant] = await db
      .insert(consultationParticipants)
      .values(participant)
      .returning();

    return newParticipant;
  }

  async removeParticipant(id: number): Promise<boolean> {
    const result = await db
      .delete(consultationParticipants)
      .where(eq(consultationParticipants.id, id))
      .returning({ id: consultationParticipants.id });
    return result.length > 0;
  }

  async markParticipantLeft(id: number): Promise<ConsultationParticipant | undefined> {
    const [updatedParticipant] = await db
      .update(consultationParticipants)
      .set({
        leftAt: new Date(),
        isActive: false
      })
      .where(eq(consultationParticipants.id, id))
      .returning();

    return updatedParticipant;
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
    const query = db.select()
      .from(bpReadings)
      .where(eq(bpReadings.patientId, patientId))
      .orderBy(desc(bpReadings.timestamp));

    if (limit) {
      return query.limit(limit);
    }

    return query;
  }

  async getBpReadingsByDevice(deviceId: number, limit?: number): Promise<BpReading[]> {
    const query = db.select()
      .from(bpReadings)
      .where(eq(bpReadings.deviceId, deviceId))
      .orderBy(desc(bpReadings.timestamp));

    if (limit) {
      return query.limit(limit);
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
    const query = db.select()
      .from(glucoseReadings)
      .where(eq(glucoseReadings.patientId, patientId))
      .orderBy(desc(glucoseReadings.timestamp));

    if (limit) {
      return query.limit(limit);
    }

    return query;
  }

  async getGlucoseReadingsByDevice(deviceId: number, limit?: number): Promise<GlucoseReading[]> {
    const query = db.select()
      .from(glucoseReadings)
      .where(eq(glucoseReadings.deviceId, deviceId))
      .orderBy(desc(glucoseReadings.timestamp));

    if (limit) {
      return query.limit(limit);
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
      settingsData.patientId as number,
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
  async getLabKnowledgeBase(userId?: number): Promise<LabKnowledgeBase[]> {
    try {
      if (userId) {
        return await db.select().from(labKnowledgeBase)
          .where(eq(labKnowledgeBase.userId, userId))
          .orderBy(labKnowledgeBase.test_name);
      } else {
        // For backward compatibility, return all if no userId provided
        return await db.select().from(labKnowledgeBase).orderBy(labKnowledgeBase.test_name);
      }
    } catch (error) {
      logError("Error fetching lab knowledge base:", error);
      return [];
    }
  }

  async getLabKnowledgeBaseItem(id: number, userId?: number): Promise<LabKnowledgeBase | undefined> {
    try {
      const conditions = [eq(labKnowledgeBase.id, id)];
      if (userId) {
        conditions.push(eq(labKnowledgeBase.userId, userId));
      }

      const [item] = await db.select().from(labKnowledgeBase).where(and(...conditions));
      return item;
    } catch (error) {
      logError("Error fetching lab knowledge base item:", error);
      return undefined;
    }
  }

  async createLabKnowledgeBaseItem(item: InsertLabKnowledgeBase): Promise<LabKnowledgeBase> {
    try {
      const [newItem] = await db.insert(labKnowledgeBase).values(item).returning();
      return newItem;
    } catch (error) {
      logError("Error creating lab knowledge base item:", error);
      throw error;
    }
  }

  async updateLabKnowledgeBaseItem(id: number, updates: Partial<LabKnowledgeBase>, userId?: number): Promise<LabKnowledgeBase | undefined> {
    try {
      const conditions = [eq(labKnowledgeBase.id, id)];
      if (userId) {
        conditions.push(eq(labKnowledgeBase.userId, userId));
      }

      const [updated] = await db
        .update(labKnowledgeBase)
        .set({
          ...updates
        })
        .where(and(...conditions))
        .returning();
      return updated;
    } catch (error) {
      logError("Error updating lab knowledge base item:", error);
      return undefined;
    }
  }

  async deleteLabKnowledgeBaseItem(id: number, userId?: number): Promise<boolean> {
    try {
      const conditions = [eq(labKnowledgeBase.id, id)];
      if (userId) {
        conditions.push(eq(labKnowledgeBase.userId, userId));
      }

      const result = await db.delete(labKnowledgeBase).where(and(...conditions));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logError("Error deleting lab knowledge base item:", error);
      return false;
    }
  }

  async importLabKnowledgeBase(items: InsertLabKnowledgeBase[], userId: number): Promise<number> {
    try {
      // Ensure all items have the userId set
      const itemsWithUserId = items.map(item => ({
        ...item,
        userId
      }));

      const result = await db.insert(labKnowledgeBase).values(itemsWithUserId as any).returning();
      return result.length;
    } catch (error) {
      logError("Error importing lab knowledge base:", error);
      throw error;
    }
  }

  async clearUserLabKnowledgeBase(userId: number): Promise<number> {
    try {
      const result = await db.delete(labKnowledgeBase).where(eq(labKnowledgeBase.userId, userId));
      return result.rowCount || 0;
    } catch (error) {
      logError("Error clearing user lab knowledge base:", error);
      throw error;
    }
  }

  // Lab Interpreter Settings methods
  async getLabInterpreterSettings(): Promise<LabInterpreterSettings | undefined> {
    try {
      const [settings] = await db.select().from(labInterpreterSettings).limit(1);
      return settings;
    } catch (error) {
      logError("Error fetching lab interpreter settings:", error);
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
          ...settings
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
      logError("Error saving lab interpreter settings:", error);
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
      logError("Error fetching lab reports:", error);
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
      logError("Error fetching medical note templates:", error);
      return [];
    }
  }

  async getMedicalNoteTemplatesByType(type: string): Promise<MedicalNoteTemplate[]> {
    try {
      return await db
        .select()
        .from(medicalNoteTemplates)
        .where(eq(medicalNoteTemplates.type, type as any))
        .orderBy(asc(medicalNoteTemplates.createdAt));
    } catch (error) {
      logError("Error fetching medical note templates by type:", error);
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
      logError("Error fetching medical note template:", error);
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
      logError("Error creating medical note template:", error);
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
      logError("Error updating medical note template:", error);
      return undefined;
    }
  }

  async deleteMedicalNoteTemplate(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(medicalNoteTemplates)
        .where(eq(medicalNoteTemplates.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logError("Error deleting medical note template:", error);
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
      logError("Error fetching lab reports by patient:", error);
      return [];
    }
  }

  async getLabReport(id: number): Promise<LabReport | undefined> {
    try {
      const [report] = await db.select().from(labReports).where(eq(labReports.id, id));
      return report;
    } catch (error) {
      logError("Error fetching lab report:", error);
      return undefined;
    }
  }

  async createLabReport(report: InsertLabReport): Promise<LabReport> {
    try {
      const [newReport] = await db.insert(labReports).values(report).returning();
      return newReport;
    } catch (error) {
      logError("Error creating lab report:", error);
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
      logError("Error updating lab report:", error);
      return undefined;
    }
  }

  async deleteLabReport(id: number): Promise<boolean> {
    try {
      const result = await db.delete(labReports).where(eq(labReports.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logError("Error deleting lab report:", error);
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
      logError("Error fetching patient documents:", error);
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
      logError("Error fetching patient document:", error);
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
      logError("Error creating patient document:", error);
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
      logError("Error updating patient document:", error);
      return undefined;
    }
  }

async deletePatientDocument(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(patientDocuments)
        .where(eq(patientDocuments.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      logError("Error deleting patient document:", error);
      return false;
    }
  }

  // Kiosk-specific methods
  async checkExistingPatient(email: string, phone: string): Promise<Patient[]> {
    try {
      const existingPatients = await db
        .select()
        .from(patients)
        .where(
          or(
            eq(patients.email, email),
            eq(patients.phone, phone)
          )
        );
      
      return existingPatients || [];
    } catch (error) {
      logError("Error checking existing patient:", error);
      return [];
    }
  }

  async createPatientFromKiosk(patientData: any): Promise<Patient> {
    try {
      const [newPatient] = await db
        .insert(patients)
        .values({
          firstName: patientData.firstName,
          lastName: patientData.lastName || '',
          email: patientData.email,
          phone: patientData.phone,
          dateOfBirth: patientData.dateOfBirth,
          address: patientData.address || '',
          medicalHistory: '',
          createdBy: 1 // System user ID for kiosk registrations
        })
        .returning();
      
      return newPatient;
    } catch (error) {
      logError("Error creating kiosk patient:", error);
      throw error;
    }
  }

  async updatePatientCheckIn(patientId: number, checkInData: any): Promise<Patient> {
    try {
      // First, create activity record
      await this.createPatientActivity({
        patientId,
        activityType: 'appointment',
        title: 'Patient Checked In',
        description: `Checked in via kiosk: ${checkInData.kioskId}`,
        metadata: {
          checkInTime: checkInData.checkInTime,
          appointmentType: checkInData.appointmentType,
          reasonForVisit: checkInData.reasonForVisit,
          signatureData: checkInData.signatureData
        }
      });

      // Then update patient with check-in info
      const [updatedPatient] = await db
        .update(patients)
        .set({
          updatedAt: new Date()
        })
        .where(eq(patients.id, patientId))
        .returning();

      return updatedPatient;
    } catch (error) {
      logError("Error updating patient check-in:", error);
      throw error;
    }
  }

  async updatePatientStatus(patientId: number, statusData: any): Promise<Patient> {
    try {
      const [updatedPatient] = await db
        .update(patients)
        .set({
          updatedAt: new Date()
        })
        .where(eq(patients.id, patientId))
        .returning();

      return updatedPatient;
    } catch (error) {
      logError("Error updating patient status:", error);
      throw error;
    }
  }

  async getWaitingRoomData(): Promise<any[]> {
    try {
      const waitingPatients = await db
        .select({
          id: patients.id,
          firstName: patients.firstName,
          lastName: patients.lastName,
          checkInTime: sql<string>`patients.updated_at`.as('checkInTime'),
          appointmentType: sql<string>`(SELECT metadata->>'appointmentType' FROM patient_activity WHERE patient_id = ${patientId} ORDER BY created_at DESC LIMIT 1)`.as('appointmentType'),
          estimatedWaitTime: sql<number>`15 + (EXTRACT(EPOCH FROM (NOW() - patients.updated_at)) / 60)`.as('estimatedWaitTime'),
          status: sql<string>`'waiting'`.as('status')
        })
        .from(patients)
        .where(
          and(
            sql`patients.updated_at >= CURRENT_DATE - INTERVAL '1 hour'`, // Patients who checked in within last hour
            sql`patients.metadata->>'status' = 'waiting'`
          )
        )
        .orderBy(asc(patients.updatedAt));

      return waitingPatients || [];
    } catch (error) {
      logError("Error getting waiting room data:", error);
      return [];
    }
  }

  async getWaitingRoomCount(): Promise<number> {
    try {
      const [count] = await db
        .select({ count: sql<number>`count(*)`.as('count') })
        .from(patients)
        .where(sql`patients.metadata->>'status' = 'waiting'`);
      
      return count?.count || 0;
    } catch (error) {
      logError("Error getting waiting room count:", error);
      return 0;
    }
  }

  async getTodayAppointments(): Promise<any[]> {
    try {
      const today = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format
      
      const appointments = await db
        .select({
          id: appointments.id,
          patientId: appointments.patientId,
          date: appointments.date,
          reason: appointments.reason
        })
        .from(appointments)
        .where(sql`DATE(${appointments.date}) = DATE('${today}')`)
        .orderBy(asc(appointments.date));

      return appointments || [];
    } catch (error) {
      logError("Error getting today's appointments:", error);
      return [];
    }
  }

  async removeCompletedPatients(): Promise<Patient[]> {
    try {
      const completedPatients = await db
        .select()
        .from(patients)
        .where(sql`patients.metadata->>'status' = 'completed'`)
        .orderBy(desc(patients.updatedAt));

      // Update these patients to remove them from waiting room
      for (const patient of completedPatients) {
        await this.createPatientActivity({
          patientId: patient.id,
          activityType: 'appointment',
          title: 'Consultation Completed',
          description: 'Patient consultation completed',
          metadata: {
            completionTime: new Date().toISOString(),
            status: 'completed'
          }
        });
      }

      return completedPatients || [];
    } catch (error) {
      logError("Error removing completed patients:", error);
      return [];
    }
  }

  async getPatient(patientId: number): Promise<Patient | null> {
    try {
      const [patient] = await db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId));
      
      return patient || null;
    } catch (error) {
      logError("Error getting patient:", error);
      return null;
    }
  }

  // Medical Alerts methods
  async getMedicalAlertsByPatient(patientId: number): Promise<MedicalAlert[]> {
    return db.select().from(medicalAlerts)
      .where(and(eq(medicalAlerts.patientId, patientId), eq(medicalAlerts.isActive, true)))
      .orderBy(desc(medicalAlerts.createdAt));
  }

  async createMedicalAlert(alert: InsertMedicalAlert): Promise<MedicalAlert> {
    const [newAlert] = await db
      .insert(medicalAlerts)
      .values(alert)
      .returning();
    return newAlert;
  }

  async updateMedicalAlert(id: number, alert: Partial<InsertMedicalAlert>): Promise<MedicalAlert | undefined> {
    const [updatedAlert] = await db
      .update(medicalAlerts)
      .set(alert)
      .where(eq(medicalAlerts.id, id))
      .returning();
    return updatedAlert;
  }

  async deleteMedicalAlert(id: number): Promise<void> {
    await db.delete(medicalAlerts).where(eq(medicalAlerts.id, id));
  }

  // Patient Activity methods
  async getPatientActivity(patientId: number): Promise<PatientActivity[]> {
    return db.select().from(patientActivity)
      .where(eq(patientActivity.patientId, patientId))
      .orderBy(desc(patientActivity.date));
  }

  async createPatientActivity(activity: InsertPatientActivity): Promise<PatientActivity> {
    const [newActivity] = await db
      .insert(patientActivity)
      .values(activity)
      .returning();
    return newActivity;
  }

  async deletePatientActivity(id: number): Promise<void> {
    await db.delete(patientActivity).where(eq(patientActivity.id, id));
  }

  // Prescriptions methods
  async getPrescriptionsByPatient(patientId: number): Promise<Prescription[]> {
    return db.select().from(prescriptions)
      .where(and(eq(prescriptions.patientId, patientId), eq(prescriptions.isActive, true)))
      .orderBy(desc(prescriptions.prescribedDate));
  }

  async createPrescription(prescription: InsertPrescription): Promise<Prescription> {
    const [newPrescription] = await db
      .insert(prescriptions)
      .values(prescription)
      .returning();
    return newPrescription;
  }

  async updatePrescription(id: number, prescription: Partial<InsertPrescription>): Promise<Prescription | undefined> {
    const [updatedPrescription] = await db
      .update(prescriptions)
      .set(prescription)
      .where(eq(prescriptions.id, id))
      .returning();
    return updatedPrescription;
  }

  async deletePrescription(id: number): Promise<void> {
    await db.delete(prescriptions).where(eq(prescriptions.id, id));
  }

  // Medical History Entries methods
  async getMedicalHistoryEntriesByPatient(patientId: number): Promise<MedicalHistoryEntry[]> {
    return db.select().from(medicalHistoryEntries)
      .where(and(eq(medicalHistoryEntries.patientId, patientId), eq(medicalHistoryEntries.isActive, true)))
      .orderBy(desc(medicalHistoryEntries.createdAt));
  }

  async createMedicalHistoryEntry(entry: InsertMedicalHistoryEntry): Promise<MedicalHistoryEntry> {
    const [newEntry] = await db
      .insert(medicalHistoryEntries)
      .values(entry)
      .returning();
    return newEntry;
  }

  async updateMedicalHistoryEntry(id: number, entry: Partial<InsertMedicalHistoryEntry>): Promise<MedicalHistoryEntry | undefined> {
    const [updatedEntry] = await db
      .update(medicalHistoryEntries)
      .set(entry)
      .where(eq(medicalHistoryEntries.id, id))
      .returning();
    return updatedEntry;
  }

  async deleteMedicalHistoryEntry(id: number): Promise<void> {
    await db.delete(medicalHistoryEntries).where(eq(medicalHistoryEntries.id, id));
  }

  // Custom note prompts methods
  async getCustomNotePrompt(userId: number, noteType: string): Promise<CustomNotePrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(customNotePrompts)
      .where(and(
        eq(customNotePrompts.userId, userId),
        eq(customNotePrompts.noteType, noteType)
      ));
    return prompt;
  }

  async getCustomNotePrompts(userId: number): Promise<CustomNotePrompt[]> {
    return await db
      .select()
      .from(customNotePrompts)
      .where(eq(customNotePrompts.userId, userId));
  }

  async saveCustomNotePrompt(prompt: InsertCustomNotePrompt): Promise<CustomNotePrompt> {
    // Check if a prompt already exists for this user and note type
    const existing = await this.getCustomNotePrompt(prompt.userId, prompt.noteType);

    if (existing) {
      // Update existing prompt
      const [updated] = await db
        .update(customNotePrompts)
        .set({
          systemPrompt: prompt.systemPrompt,
          templateContent: prompt.templateContent,
          updatedAt: new Date(),
        })
        .where(and(
          eq(customNotePrompts.userId, prompt.userId),
          eq(customNotePrompts.noteType, prompt.noteType)
        ))
        .returning();
      return updated;
    } else {
      // Create new prompt
      const [created] = await db
        .insert(customNotePrompts)
        .values(prompt)
        .returning();
      return created;
    }
  }

  async deleteCustomNotePrompt(userId: number, noteType: string): Promise<void> {
    await db
      .delete(customNotePrompts)
      .where(and(
        eq(customNotePrompts.userId, userId),
        eq(customNotePrompts.noteType, noteType)
      ));
  }

  // Global prompt methods
  async getGlobalPrompts(): Promise<CustomNotePrompt[]> {
    return await db
      .select()
      .from(customNotePrompts)
      .where(eq(customNotePrompts.isGlobal, true))
      .orderBy(asc(customNotePrompts.noteType));
  }

  async getGlobalPrompt(id: number): Promise<CustomNotePrompt | undefined> {
    const [prompt] = await db
      .select()
      .from(customNotePrompts)
      .where(and(eq(customNotePrompts.id, id), eq(customNotePrompts.isGlobal, true)));
    return prompt;
  }

  async createGlobalPrompt(prompt: Partial<InsertCustomNotePrompt> & { userId: number }): Promise<CustomNotePrompt> {
    const [created] = await db
      .insert(customNotePrompts)
      .values({
        ...prompt,
        isGlobal: true,
        isActive: true,
        version: "1.0",
      } as any)
      .returning();
    return created;
  }

  async updateGlobalPrompt(id: number, updates: Partial<CustomNotePrompt>): Promise<CustomNotePrompt | undefined> {
    const [updated] = await db
      .update(customNotePrompts)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(customNotePrompts.id, id), eq(customNotePrompts.isGlobal, true)))
      .returning();
    return updated;
  }

  async deleteGlobalPrompt(id: number): Promise<boolean> {
    const result = await db
      .delete(customNotePrompts)
      .where(and(eq(customNotePrompts.id, id), eq(customNotePrompts.isGlobal, true)));
    return !!result;
  }
}



