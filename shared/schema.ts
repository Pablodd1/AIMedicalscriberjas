import { pgTable, text, serial, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

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

// Define a type enum for notes
export const noteTypeEnum = pgEnum('note_type', ['soap', 'progress', 'procedure', 'consultation']);

// Add a consultation notes table specifically for consultation recordings
export const consultationNotes = pgTable("consultation_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  transcript: text("transcript").notNull(),
  recordingMethod: text("recording_method").notNull(), // 'live-recording', 'upload-recording', or 'text-paste'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title").notNull(),
});

export const medicalNotes = pgTable("medical_notes", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  content: text("content").notNull(),
  type: noteTypeEnum("type").notNull().default('soap'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title").notNull(),
  consultationId: integer("consultation_id"),
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
export type ConsultationNote = typeof consultationNotes.$inferSelect;

// Define insert schema for consultation notes
export const insertConsultationNoteSchema = createInsertSchema(consultationNotes).pick({
  patientId: true,
  doctorId: true,
  transcript: true,
  recordingMethod: true,
  title: true,
});

export type InsertConsultationNote = z.infer<typeof insertConsultationNoteSchema>;

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  patients: many(patients),
  appointments: many(appointments),
  medicalNotes: many(medicalNotes),
  consultationNotes: many(consultationNotes),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  medicalNotes: many(medicalNotes),
  consultationNotes: many(consultationNotes),
}));

export const medicalNotesRelations = relations(medicalNotes, ({ one }) => ({
  patient: one(patients, {
    fields: [medicalNotes.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [medicalNotes.doctorId],
    references: [users.id],
  }),
  consultation: one(consultationNotes, {
    fields: [medicalNotes.consultationId],
    references: [consultationNotes.id],
  }),
}));

export const consultationNotesRelations = relations(consultationNotes, ({ one, many }) => ({
  patient: one(patients, {
    fields: [consultationNotes.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [consultationNotes.doctorId],
    references: [users.id],
  }),
  medicalNotes: many(medicalNotes),
}));
