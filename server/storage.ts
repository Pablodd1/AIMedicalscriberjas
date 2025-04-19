import { 
  users, 
  patients, 
  appointments, 
  medicalNotes,
  consultationNotes,
  type User, 
  type InsertUser, 
  type Patient, 
  type InsertPatient, 
  type Appointment, 
  type InsertAppointment,
  type MedicalNote,
  type InsertMedicalNote,
  type ConsultationNote,
  type InsertConsultationNote
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
  getConsultationNotes(doctorId: number): Promise<ConsultationNote[]>;
  getConsultationNotesByPatient(patientId: number): Promise<ConsultationNote[]>;
  getConsultationNote(id: number): Promise<ConsultationNote | undefined>;
  createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote>;
  createMedicalNoteFromConsultation(note: InsertMedicalNote, consultationId: number): Promise<MedicalNote>;
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
        consultationId: null 
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
}

// Export instance of database storage
export const storage = new DatabaseStorage();