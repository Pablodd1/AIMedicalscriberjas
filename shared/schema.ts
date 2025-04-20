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
  patientId: integer("patient_id"),  // Making this optional for quick notes
  doctorId: integer("doctor_id").notNull(),
  content: text("content").notNull(),
  type: noteTypeEnum("type").notNull().default('soap'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title").notNull(),
  consultationId: integer("consultation_id"),
  isQuickNote: boolean("is_quick_note").default(false),
  template: text("template"),
  signature: text("signature"),
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
  isQuickNote: true,
  template: true,
  signature: true,
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
export type Setting = typeof settings.$inferSelect;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  patients: many(patients),
  appointments: many(appointments),
  medicalNotes: many(medicalNotes),
  consultationNotes: many(consultationNotes),
  invoices: many(invoices),
}));

export const patientsRelations = relations(patients, ({ many }) => ({
  appointments: many(appointments),
  medicalNotes: many(medicalNotes),
  consultationNotes: many(consultationNotes),
  invoices: many(invoices),
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

// Define the payment status as an enum
export const paymentStatusEnum = pgEnum('payment_status', ['paid', 'partial', 'unpaid', 'overdue']);

// Settings table for application configuration
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Email templates table
export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Define the invoices table
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  doctorId: integer("doctor_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  amount: integer("amount").notNull(), // Stored in cents (e.g. $10.00 = 1000)
  amountPaid: integer("amount_paid").default(0).notNull(), // Stored in cents
  status: paymentStatusEnum("status").default('unpaid').notNull(),
  dueDate: timestamp("due_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  description: text("description").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
});

// Invoice insert schema
export const insertInvoiceSchema = createInsertSchema(invoices).pick({
  patientId: true,
  doctorId: true,
  amount: true,
  amountPaid: true,
  status: true,
  dueDate: true,
  description: true,
  invoiceNumber: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

// Invoice relations
export const invoiceRelations = relations(invoices, ({ one }) => ({
  patient: one(patients, {
    fields: [invoices.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [invoices.doctorId],
    references: [users.id],
  }),
}));

// Patient intake form schema
export const intakeForms = pgTable("intake_forms", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id).notNull(),
  doctorId: integer("doctor_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, completed, expired
  uniqueLink: text("unique_link").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
  completedAt: timestamp("completed_at"),
});

export const intakeFormResponses = pgTable("intake_form_responses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").references(() => intakeForms.id).notNull(),
  questionId: integer("question_id").notNull(),
  question: text("question").notNull(),
  answer: text("answer"),
  answerType: text("answer_type").default("text"), // text, voice
  audioUrl: text("audio_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Intake form insert schemas
export const insertIntakeFormSchema = createInsertSchema(intakeForms).pick({
  patientId: true,
  doctorId: true,
  status: true,
  uniqueLink: true,
  email: true,
  phone: true,
  name: true,
  expiresAt: true,
});

export const insertIntakeFormResponseSchema = createInsertSchema(intakeFormResponses).pick({
  formId: true,
  questionId: true,
  question: true,
  answer: true,
  answerType: true,
  audioUrl: true,
});

export type InsertIntakeForm = z.infer<typeof insertIntakeFormSchema>;
export type InsertIntakeFormResponse = z.infer<typeof insertIntakeFormResponseSchema>;
export type IntakeForm = typeof intakeForms.$inferSelect;
export type IntakeFormResponse = typeof intakeFormResponses.$inferSelect;

// Intake form relations
export const intakeFormRelations = relations(intakeForms, ({ one, many }) => ({
  patient: one(patients, {
    fields: [intakeForms.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [intakeForms.doctorId],
    references: [users.id],
  }),
  responses: many(intakeFormResponses),
}));

export const intakeFormResponseRelations = relations(intakeFormResponses, ({ one }) => ({
  form: one(intakeForms, {
    fields: [intakeFormResponses.formId],
    references: [intakeForms.id],
  }),
}));
