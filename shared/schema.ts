import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("doctor"),
  email: text("email").notNull(),
});

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  address: text("address").notNull(),
  medicalHistory: text("medical_history"),
  createdBy: integer("created_by").notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
});

export const medicalNotes = pgTable("medical_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("soap"), // soap, progress, procedure, etc.
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  email: true,
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  name: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  address: true,
  medicalHistory: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  patientId: true,
  doctorId: true,
  date: true,
  notes: true,
});

export const insertMedicalNoteSchema = createInsertSchema(medicalNotes).pick({
  patientId: true,
  doctorId: true,
  content: true,
  type: true,
  title: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type InsertMedicalNote = z.infer<typeof insertMedicalNoteSchema>;
export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type MedicalNote = typeof medicalNotes.$inferSelect;
