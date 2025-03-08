import { users, type User, type InsertUser, type Patient, type InsertPatient, type Appointment, type InsertAppointment } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getPatients(doctorId: number): Promise<Patient[]>;
  createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient>;
  getAppointments(doctorId: number): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private patients: Map<number, Patient>;
  private appointments: Map<number, Appointment>;
  public sessionStore: session.Store;
  currentId: number;
  currentPatientId: number;
  currentAppointmentId: number;

  constructor() {
    this.users = new Map();
    this.patients = new Map();
    this.appointments = new Map();
    this.currentId = 1;
    this.currentPatientId = 1;
    this.currentAppointmentId = 1;
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

  async createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient> {
    const id = this.currentPatientId++;
    const newPatient: Patient = { ...patient, id };
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
      status: "scheduled" 
    };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }
}

export const storage = new MemStorage();