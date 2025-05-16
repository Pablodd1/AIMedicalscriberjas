import { 
  pgTable, 
  text, 
  serial, 
  integer, 
  boolean, 
  timestamp, 
  pgEnum,
  varchar,
  date,
  real,
  json
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Define user roles enum
export const userRoleEnum = pgEnum('user_role', ['doctor', 'admin', 'assistant', 'patient']);

// User table with enhanced fields for multi-user support
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull().default('doctor'),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  specialty: text("specialty"),
  licenseNumber: text("license_number"),
  avatar: text("avatar"),
  bio: text("bio"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
});

export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  dateOfBirth: text("date_of_birth"),
  address: text("address"),
  medicalHistory: text("medical_history"),
  createdBy: integer("created_by").notNull(),
});

export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  doctorId: integer("doctor_id").notNull(),
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("scheduled"),
  type: text("type").notNull().default("in-person"),
  reason: text("reason"),
  notes: text("notes"),
});

// Define a type enum for notes
export const noteTypeEnum = pgEnum('note_type', [
  'soap', 
  'progress', 
  'procedure', 
  'consultation', 
  'initial_consultation', 
  'follow_up', 
  'physical_exam', 
  're_evaluation', 
  'psychiatric_evaluation', 
  'discharge_summary'
]);

// Medical Notes Settings and Templates
export const medicalNoteTemplates = pgTable("medical_note_templates", {
  id: serial("id").primaryKey(),
  type: noteTypeEnum("type").notNull(),
  title: text("title").notNull(),
  template: text("template").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Create insert schema for medical note templates
export const insertMedicalNoteTemplateSchema = createInsertSchema(medicalNoteTemplates).pick({
  type: true,
  title: true,
  template: true,
  systemPrompt: true,
});

export type InsertMedicalNoteTemplate = z.infer<typeof insertMedicalNoteTemplateSchema>;
export type MedicalNoteTemplate = typeof medicalNoteTemplates.$inferSelect;

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
  role: true,
  phone: true,
  specialty: true,
  licenseNumber: true,
  avatar: true,
  bio: true,
  isActive: true,
});

export const insertPatientSchema = createInsertSchema(patients).pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  address: true,
  medicalHistory: true,
}).extend({
  // Add validation: firstName is required, email is required
  firstName: z.string().min(1, { message: "First name is required" }),
  lastName: z.string().optional(),
  email: z.string().email({ message: "Invalid email address" }).min(1, { message: "Email is required" }),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  medicalHistory: z.string().optional(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  patientId: true,
  doctorId: true,
  date: true,
  type: true,
  reason: true,
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
  dueDate: text("due_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  description: text("description").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
});

// Invoice insert schema
export const insertInvoiceSchema = createInsertSchema(invoices, {
  dueDate: z.string().or(z.date()).transform(val => 
    typeof val === 'string' ? val : val.toISOString().split('T')[0])
}).pick({
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

// Recording sessions table for telemedicine
export const recordingSessions = pgTable("recording_sessions", {
  id: serial("id").primaryKey(),
  roomId: text("room_id").notNull(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  doctorId: integer("doctor_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
  startTime: timestamp("start_time").notNull().defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("active"), // active, completed, cancelled
  transcript: text("transcript"),
  notes: text("notes"),
  duration: integer("duration"), // in seconds
  recordingType: text("recording_type").default("audio"), // audio, video, both
  audioUrl: text("audio_url"), // URL or path to stored audio recording
  videoUrl: text("video_url"), // URL or path to stored video recording
  mediaFormat: text("media_format"), // Format of the recording (e.g., webm, mp4)
});

// Recording session insert schema
export const insertRecordingSessionSchema = createInsertSchema(recordingSessions).pick({
  roomId: true,
  patientId: true,
  doctorId: true,
  status: true,
  transcript: true,
  notes: true,
});

export type InsertRecordingSession = z.infer<typeof insertRecordingSessionSchema>;
export type RecordingSession = typeof recordingSessions.$inferSelect;

// Recording session relations
export const recordingSessionRelations = relations(recordingSessions, ({ one }) => ({
  patient: one(patients, {
    fields: [recordingSessions.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [recordingSessions.doctorId],
    references: [users.id],
  }),
}));

// Device monitoring models
export const deviceTypeEnum = pgEnum('device_type', ['bp', 'glucose']);
export const deviceStatusEnum = pgEnum('device_status', ['connected', 'disconnected', 'pairing']);

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: deviceTypeEnum("type").notNull(),
  model: varchar("model", { length: 100 }).notNull(),
  status: deviceStatusEnum("status").default("disconnected").notNull(),
  lastConnected: timestamp("last_connected"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

export const bpReadings = pgTable("bp_readings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  systolic: integer("systolic").notNull(),
  diastolic: integer("diastolic").notNull(),
  pulse: integer("pulse").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  notes: text("notes")
});

export const glucoseReadingTypeEnum = pgEnum('glucose_reading_type', ['fasting', 'pre-meal', 'post-meal', 'random']);

export const glucoseReadings = pgTable("glucose_readings", {
  id: serial("id").primaryKey(),
  deviceId: integer("device_id").references(() => devices.id, { onDelete: "cascade" }),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  value: integer("value").notNull(),
  type: glucoseReadingTypeEnum("type").default("random").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  notes: text("notes")
});

export const alertSettings = pgTable("alert_settings", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }),
  deviceType: deviceTypeEnum("device_type").notNull(),
  thresholds: json("thresholds").notNull(),
  notifyPatient: boolean("notify_patient").default(true).notNull(),
  notifyDoctor: boolean("notify_doctor").default(true).notNull(),
  notifyCaregivers: boolean("notify_caregivers").default(false),
  notifyFamily: boolean("notify_family").default(false),
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Relation definitions
export const deviceRelations = relations(devices, ({ one, many }) => ({
  patient: one(patients, {
    fields: [devices.patientId],
    references: [patients.id],
  }),
  bpReadings: many(bpReadings),
  glucoseReadings: many(glucoseReadings)
}));

export const bpReadingRelations = relations(bpReadings, ({ one }) => ({
  device: one(devices, {
    fields: [bpReadings.deviceId],
    references: [devices.id],
  }),
  patient: one(patients, {
    fields: [bpReadings.patientId],
    references: [patients.id],
  })
}));

export const glucoseReadingRelations = relations(glucoseReadings, ({ one }) => ({
  device: one(devices, {
    fields: [glucoseReadings.deviceId],
    references: [devices.id],
  }),
  patient: one(patients, {
    fields: [glucoseReadings.patientId],
    references: [patients.id],
  })
}));

export const alertSettingRelations = relations(alertSettings, ({ one }) => ({
  patient: one(patients, {
    fields: [alertSettings.patientId],
    references: [patients.id],
  })
}));

// Types and schemas for device monitoring
export const insertDeviceSchema = createInsertSchema(devices).pick({
  patientId: true,
  name: true,
  type: true,
  model: true,
  status: true
});

export const insertBpReadingSchema = createInsertSchema(bpReadings).pick({
  deviceId: true,
  patientId: true,
  systolic: true, 
  diastolic: true,
  pulse: true,
  notes: true
});

export const insertGlucoseReadingSchema = createInsertSchema(glucoseReadings).pick({
  deviceId: true,
  patientId: true,
  value: true,
  type: true,
  notes: true
});

export const insertAlertSettingSchema = createInsertSchema(alertSettings).pick({
  patientId: true,
  deviceType: true,
  thresholds: true,
  notifyPatient: true,
  notifyDoctor: true,
  notifyCaregivers: true,
  notifyFamily: true,
  enabled: true
});

export type Device = typeof devices.$inferSelect;
export type BpReading = typeof bpReadings.$inferSelect;
export type GlucoseReading = typeof glucoseReadings.$inferSelect;
export type AlertSetting = typeof alertSettings.$inferSelect;

export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type InsertBpReading = z.infer<typeof insertBpReadingSchema>;
export type InsertGlucoseReading = z.infer<typeof insertGlucoseReadingSchema>;
export type InsertAlertSetting = z.infer<typeof insertAlertSettingSchema>;

// Lab Interpreter Assistant Knowledge Base tables
export const labKnowledgeBase = pgTable("lab_knowledge_base", {
  id: serial("id").primaryKey(),
  test_name: text("test_name").notNull(),
  marker: text("marker").notNull(),
  normal_range_low: real("normal_range_low"),
  normal_range_high: real("normal_range_high"),
  unit: text("unit"),
  interpretation: text("interpretation").notNull(),
  recommendations: text("recommendations"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const labInterpreterSettings = pgTable("lab_interpreter_settings", {
  id: serial("id").primaryKey(),
  system_prompt: text("system_prompt").notNull(),
  with_patient_prompt: text("with_patient_prompt"),
  without_patient_prompt: text("without_patient_prompt"),
  created_at: timestamp("created_at").notNull().defaultNow(),
});

export const labReports = pgTable("lab_reports", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: 'set null' }),
  doctorId: integer("doctor_id").references(() => users.id, { onDelete: 'set null' }).notNull(),
  reportData: text("report_data").notNull(),
  reportType: text("report_type").notNull().default("text"), // "text", "pdf", "image"
  fileName: text("file_name"),
  filePath: text("file_path"), // Store the path to the file instead of binary data
  analysis: text("analysis"),
  recommendations: text("recommendations"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  title: text("title").notNull().default("Lab Report"),
});

// Insert schemas for lab interpreter
export const insertLabKnowledgeBaseSchema = createInsertSchema(labKnowledgeBase).pick({
  test_name: true,
  marker: true,
  normal_range_low: true,
  normal_range_high: true,
  unit: true,
  interpretation: true,
  recommendations: true,
});

export const insertLabInterpreterSettingsSchema = createInsertSchema(labInterpreterSettings).pick({
  system_prompt: true,
  with_patient_prompt: true,
  without_patient_prompt: true,
});

export const insertLabReportSchema = createInsertSchema(labReports).pick({
  patientId: true,
  doctorId: true,
  reportData: true,
  reportType: true,
  fileName: true,
  filePath: true,
  title: true,
  analysis: true,
  recommendations: true,
});

// Patient documents table
export const patientDocuments = pgTable("patient_documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patients.id, { onDelete: "cascade" }).notNull(),
  doctorId: integer("doctor_id").references(() => users.id).notNull(),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // pdf, docx, jpg, etc.
  fileSize: integer("file_size").notNull(), // in bytes
  title: text("title").notNull(),
  description: text("description"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  tags: text("tags").array(),
});

export const insertPatientDocumentSchema = createInsertSchema(patientDocuments).pick({
  patientId: true,
  doctorId: true,
  filename: true,
  originalFilename: true,
  filePath: true,
  fileType: true,
  fileSize: true,
  title: true,
  description: true,
  tags: true,
});

export type InsertPatientDocument = z.infer<typeof insertPatientDocumentSchema>;
export type PatientDocument = typeof patientDocuments.$inferSelect;

export const patientDocumentRelations = relations(patientDocuments, ({ one }) => ({
  patient: one(patients, {
    fields: [patientDocuments.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [patientDocuments.doctorId],
    references: [users.id],
  }),
}));

// Types for lab interpreter
export type InsertLabKnowledgeBase = z.infer<typeof insertLabKnowledgeBaseSchema>;
export type InsertLabInterpreterSettings = z.infer<typeof insertLabInterpreterSettingsSchema>;
export type InsertLabReport = z.infer<typeof insertLabReportSchema>;
export type LabKnowledgeBase = typeof labKnowledgeBase.$inferSelect;
export type LabInterpreterSettings = typeof labInterpreterSettings.$inferSelect;
export type LabReport = typeof labReports.$inferSelect;

// Relations for lab reports
export const labReportRelations = relations(labReports, ({ one }) => ({
  patient: one(patients, {
    fields: [labReports.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [labReports.doctorId],
    references: [users.id],
  }),
}));
