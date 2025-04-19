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
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private patients: Map<number, Patient>;
  private appointments: Map<number, Appointment>;
  private medicalNotes: Map<number, MedicalNote>;
  public sessionStore: session.Store;
  currentId: number;
  currentPatientId: number;
  currentAppointmentId: number;
  currentMedicalNoteId: number;

  constructor() {
    this.users = new Map();
    this.patients = new Map();
    this.appointments = new Map();
    this.medicalNotes = new Map();
    this.currentId = 1;
    this.currentPatientId = 1;
    this.currentAppointmentId = 1;
    this.currentMedicalNoteId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id, role: "doctor" };
    this.users.set(id, user);
    return user;
  }

  async getPatients(doctorId: number): Promise<Patient[]> {
    return Array.from(this.patients.values()).filter(
      (patient) => patient.createdBy === doctorId
    );
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    return this.patients.get(id);
  }

  async createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient> {
    const id = this.currentPatientId++;
    const newPatient: Patient = { 
      ...patient, 
      id,
      medicalHistory: patient.medicalHistory || null 
    };
    this.patients.set(id, newPatient);
    return newPatient;
  }

  async getAppointments(doctorId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      (appointment) => appointment.doctorId === doctorId
    );
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const id = this.currentAppointmentId++;
    const newAppointment: Appointment = { 
      ...appointment, 
      id,
      status: "scheduled",
      notes: appointment.notes || null
    };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }

  async getMedicalNotes(doctorId: number): Promise<MedicalNote[]> {
    return Array.from(this.medicalNotes.values()).filter(
      (note) => note.doctorId === doctorId
    );
  }

  async getMedicalNotesByPatient(patientId: number): Promise<MedicalNote[]> {
    return Array.from(this.medicalNotes.values()).filter(
      (note) => note.patientId === patientId
    );
  }

  async getMedicalNote(id: number): Promise<MedicalNote | undefined> {
    return this.medicalNotes.get(id);
  }

  async createMedicalNote(note: InsertMedicalNote): Promise<MedicalNote> {
    const id = this.currentMedicalNoteId++;
    const newNote: MedicalNote = { 
      ...note, 
      id,
      type: note.type || "soap",
      createdAt: new Date() 
    };
    this.medicalNotes.set(id, newNote);
    return newNote;
  }
}

export const storage = new MemStorage();