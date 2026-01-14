
import {
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
import { IStorage } from "./storage";
import session from "express-session";
import memorystore from "memorystore";

const MemoryStore = memorystore(session);

import fs from 'fs';
import path from 'path';

const PERSISTENCE_FILE = path.join(process.cwd(), 'mock-data.json');

export class MockStorage implements IStorage {
    private users: Map<number, User> = new Map();
    // ... other maps ...

    public sessionStore: session.Store;
    private currentId: number = 1;

    constructor() {
        this.sessionStore = new MemoryStore({
            checkPeriod: 86400000
        });

        // Try to load persisted data
        if (this.loadData()) {
            console.log('Loaded persisted mock data');
        } else {
            // Initialize defaults if no persistence found
            this.initializeDefaults();
        }
    }

    private saveData() {
        const data = {
            users: Array.from(this.users.entries()),
            patients: Array.from(this.patients.entries()),
            appointments: Array.from(this.appointments.entries()),
            settings: Array.from(this.settings.entries()),
            systemSettings: Array.from(this.systemSettings.entries()),
            customNotePrompts: Array.from(this.customNotePrompts.entries()),
            medicalNotes: Array.from(this.medicalNotes.entries()),
            consultationNotes: Array.from(this.consultationNotes.entries()),
            invoices: Array.from(this.invoices.entries()),
            emailTemplates: Array.from(this.emailTemplates.entries()),
            intakeForms: Array.from(this.intakeForms.entries()),
            intakeFormResponses: Array.from(this.intakeFormResponses.entries()),
            recordingSessions: Array.from(this.recordingSessions.entries()),
            devices: Array.from(this.devices.entries()),
            bpReadings: Array.from(this.bpReadings.entries()),
            glucoseReadings: Array.from(this.glucoseReadings.entries()),
            alertSettings: Array.from(this.alertSettings.entries()),
            labKnowledgeBase: Array.from(this.labKnowledgeBase.entries()),
            labInterpreterSettings: Array.from(this.labInterpreterSettings.entries()),
            labReports: Array.from(this.labReports.entries()),
            patientDocuments: Array.from(this.patientDocuments.entries()),
            medicalNoteTemplates: Array.from(this.medicalNoteTemplates.entries()),
            medicalAlerts: Array.from(this.medicalAlerts.entries()),
            patientActivity: Array.from(this.patientActivity.entries()),
            prescriptions: Array.from(this.prescriptions.entries()),
            medicalHistoryEntries: Array.from(this.medicalHistoryEntries.entries()),
            currentId: this.currentId
        };
        try {
            fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error('Failed to persist mock data:', err);
        }
    }

    private loadData(): boolean {
        try {
            if (fs.existsSync(PERSISTENCE_FILE)) {
                const raw = fs.readFileSync(PERSISTENCE_FILE, 'utf-8');
                const data = JSON.parse(raw);
                
                this.users = new Map(data.users);
                this.patients = new Map(data.patients);
                this.appointments = new Map(data.appointments);
                this.settings = new Map(data.settings);
                this.systemSettings = new Map(data.systemSettings);
                this.customNotePrompts = new Map(data.customNotePrompts);
                this.medicalNotes = new Map(data.medicalNotes);
                this.consultationNotes = new Map(data.consultationNotes);
                this.invoices = new Map(data.invoices);
                this.emailTemplates = new Map(data.emailTemplates);
                this.intakeForms = new Map(data.intakeForms);
                this.intakeFormResponses = new Map(data.intakeFormResponses);
                this.recordingSessions = new Map(data.recordingSessions);
                this.devices = new Map(data.devices);
                this.bpReadings = new Map(data.bpReadings);
                this.glucoseReadings = new Map(data.glucoseReadings);
                this.alertSettings = new Map(data.alertSettings);
                this.labKnowledgeBase = new Map(data.labKnowledgeBase);
                this.labInterpreterSettings = new Map(data.labInterpreterSettings);
                this.labReports = new Map(data.labReports);
                this.patientDocuments = new Map(data.patientDocuments);
                this.medicalNoteTemplates = new Map(data.medicalNoteTemplates);
                this.medicalAlerts = new Map(data.medicalAlerts);
                this.patientActivity = new Map(data.patientActivity);
                this.prescriptions = new Map(data.prescriptions);
                this.medicalHistoryEntries = new Map(data.medicalHistoryEntries);
                this.currentId = data.currentId;
                return true;
            }
        } catch (err) {
            console.error('Failed to load mock data:', err);
        }
        return false;
    }

    private initializeDefaults() {
        // Create a default admin user
        this.createUser({
            username: "admin",
            password: "7765d034b6e047cb28c78951e4c04c794ec1781713a9bddb6b1fbb2a3fba3e8fb407075297a194ab8cadc5ee6a336bfaa4a95e31661f4d81534c3b1ef468a6ca.031b5a2f420b44c810123e1372db98a5", // Hashed password for "admin123"
            name: "System Administrator",
            role: "administrator",
            email: "admin@aims.medical",
            isActive: true,
            phone: null,
            specialty: null,
            licenseNumber: null,
            avatar: null,
            bio: null,
            openaiApiKey: null,
            useOwnApiKey: false
        });

        // Seed mock patients
        this.createPatient({
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@example.com",
            phone: "555-0101",
            dateOfBirth: "1985-05-15",
            address: "123 Main St",
            medicalHistory: null,
            createdBy: 1
        });

        this.createPatient({
            firstName: "John",
            lastName: "Smith",
            email: "john@example.com",
            phone: "555-0102",
            dateOfBirth: "1970-10-20",
            address: "456 Oak Ave",
            medicalHistory: null,
            createdBy: 1
        });

        // Seed mock appointments
        this.createAppointment({
            patientId: 1,
            doctorId: 1,
            date: new Date(Date.now() + 86400000).toISOString(),
            reason: "Annual Checkup",
            status: "scheduled",
            notes: null,
            confirmationToken: null,
            patientConfirmed: null,
            roomId: null
        });

        this.createAppointment({
            patientId: 2,
            doctorId: 1,
            date: new Date(Date.now() + 172800000).toISOString(),
            reason: "Follow-up",
            status: "scheduled",
            notes: null,
            confirmationToken: null,
            patientConfirmed: null,
            roomId: null
        });
    }

    // Wrap modification methods to trigger save
    private withSave<T>(promise: Promise<T>): Promise<T> {
        return promise.then(result => {
            this.saveData();
            return result;
        });
    }

    async getUser(id: number): Promise<User | undefined> {
        return this.users.get(id);
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        return Array.from(this.users.values()).find(u => u.username === username);
    }

    async getUserByEmail(email: string): Promise<User | undefined> {
        return Array.from(this.users.values()).find(u => u.email === email);
    }

    async getUsers(): Promise<User[]> {
        return Array.from(this.users.values());
    }

    async createUser(user: InsertUser): Promise<User> {
        const id = this.currentId++;
        const newUser: User = { ...user, id, createdAt: new Date(), lastLogin: null, phone: user.phone || null, specialty: user.specialty || null, licenseNumber: user.licenseNumber || null, avatar: user.avatar || null, bio: user.bio || null, isActive: user.isActive ?? true, openaiApiKey: user.openaiApiKey || null, useOwnApiKey: user.useOwnApiKey ?? false };
        this.users.set(id, newUser);
        this.saveData();
        return newUser;
    }

    async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
        const user = this.users.get(id);
        if (!user) return undefined;
        const updatedUser = { ...user, ...updates };
        this.users.set(id, updatedUser);
        this.saveData();
        return updatedUser;
    }
    async updateUserLastLogin(id: number): Promise<void> {
        const user = this.users.get(id);
        if (user) {
            user.lastLogin = new Date();
            this.users.set(id, user);
            this.saveData();
        }
    }
    async deleteUser(id: number): Promise<boolean> {
        const result = this.users.delete(id);
        this.saveData();
        return result;
    }
    async updateUserApiKeySettings(id: number, useOwnApiKey: boolean): Promise<User | undefined> {
        const user = this.users.get(id);
        if (!user) return undefined;
        user.useOwnApiKey = useOwnApiKey;
        this.users.set(id, user);
        this.saveData();
        return user;
    }

    // Patients
    async getPatients(doctorId: number): Promise<Patient[]> {
        return Array.from(this.patients.values()).filter(p => p.createdBy === doctorId);
    }
    async getPatient(id: number): Promise<Patient | undefined> {
        return this.patients.get(id);
    }
    async getPatientsByIds(ids: number[]): Promise<Patient[]> {
        return ids.map(id => this.patients.get(id)).filter((p): p is Patient => !!p);
    }
    async createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient> {
        const id = this.currentId++;
        const newPatient: Patient = { ...patient, id, lastName: patient.lastName || null, phone: patient.phone || null, dateOfBirth: patient.dateOfBirth || null, address: patient.address || null, medicalHistory: patient.medicalHistory || null };
        this.patients.set(id, newPatient);
        this.saveData();
        return newPatient;
    }

    // Appointments
    async getAppointments(doctorId: number): Promise<Appointment[]> {
        return Array.from(this.appointments.values()).filter(a => a.doctorId === doctorId);
    }
    async getAppointment(id: number): Promise<Appointment | undefined> {
        return this.appointments.get(id);
    }
    async getAppointmentByToken(token: string): Promise<Appointment[]> {
        return Array.from(this.appointments.values()).filter(a => a.confirmationToken === token);
    }
    async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
        const id = this.currentId++;
        const newAppointment: Appointment = { ...appointment, id, notes: appointment.notes || null, confirmationToken: appointment.confirmationToken || null, patientConfirmed: appointment.patientConfirmed || null, roomId: appointment.roomId || null, createdAt: new Date(), updatedAt: new Date() };
        this.appointments.set(id, newAppointment);
        this.saveData();
        return newAppointment;
    }
    async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
        return this.updateAppointment(id, { status });
    }
    async updatePatientConfirmationStatus(id: number, status: string): Promise<Appointment | undefined> {
        return this.updateAppointment(id, { patientConfirmed: status });
    }
    async clearAppointmentToken(id: number): Promise<void> {
        const appt = this.appointments.get(id);
        if (appt) {
            appt.confirmationToken = null;
            this.appointments.set(id, appt);
            this.saveData();
        }
    }
    async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
        const appt = this.appointments.get(id);
        if (!appt) return undefined;
        const updated = { ...appt, ...updates, updatedAt: new Date() };
        this.appointments.set(id, updated);
        this.saveData();
        return updated;
    }
    async deleteAppointment(id: number): Promise<boolean> {
        const result = this.appointments.delete(id);
        this.saveData();
        return result;
    }

    // Medical Notes
    async getMedicalNotes(doctorId: number): Promise<MedicalNote[]> {
        return Array.from(this.medicalNotes.values()).filter(n => n.doctorId === doctorId);
    }
    async getMedicalNotesByPatient(patientId: number): Promise<MedicalNote[]> {
        return Array.from(this.medicalNotes.values()).filter(n => n.patientId === patientId);
    }
    async getMedicalNote(id: number): Promise<MedicalNote | undefined> {
        return this.medicalNotes.get(id);
    }
    async createMedicalNote(note: InsertMedicalNote): Promise<MedicalNote> {
        const id = this.currentId++;
        const newNote: MedicalNote = { ...note, id, consultationId: note.consultationId || null, isQuickNote: note.isQuickNote || false, template: note.template || null, signature: note.signature || null, createdAt: new Date(), updatedAt: new Date() };
        this.medicalNotes.set(id, newNote);
        this.saveData();
        return newNote;
    }
    async getQuickNotes(doctorId: number): Promise<MedicalNote[]> {
        return Array.from(this.medicalNotes.values()).filter(n => n.doctorId === doctorId && n.isQuickNote);
    }
    async createQuickNote(note: Omit<InsertMedicalNote, 'patientId'> & { signature?: string }): Promise<MedicalNote> {
        const id = this.currentId++;
        // Create proper Note object filling in missing properties
        const newNote: MedicalNote = {
            id,
            patientId: null,
            consultationId: null,
            doctorId: note.doctorId,
            content: note.content,
            type: note.type,
            title: note.title,
            isQuickNote: true,
            template: note.template || null,
            signature: note.signature || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.medicalNotes.set(id, newNote);
        this.saveData();
        return newNote;
    }
    async createMedicalNoteFromConsultation(note: InsertMedicalNote, consultationId: number): Promise<MedicalNote> {
        return this.createMedicalNote({ ...note, consultationId });
    }

    // Consultation Notes
    async getConsultationNotes(doctorId: number): Promise<ConsultationNote[]> {
        return Array.from(this.consultationNotes.values()).filter(n => n.doctorId === doctorId);
    }
    async getConsultationNotesByPatient(patientId: number): Promise<ConsultationNote[]> {
        return Array.from(this.consultationNotes.values()).filter(n => n.patientId === patientId);
    }
    async getConsultationNote(id: number): Promise<ConsultationNote | undefined> {
        return this.consultationNotes.get(id);
    }
    async createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote> {
        const id = this.currentId++;
        const newNote: ConsultationNote = { ...note, id, createdAt: new Date(), updatedAt: new Date() };
        this.consultationNotes.set(id, newNote);
        this.saveData();
        return newNote;
    }

    // Invoices
    async getInvoices(doctorId: number): Promise<Invoice[]> {
        return Array.from(this.invoices.values()).filter(i => i.doctorId === doctorId);
    }
    async getInvoicesByPatient(patientId: number): Promise<Invoice[]> {
        return Array.from(this.invoices.values()).filter(i => i.patientId === patientId);
    }
    async getInvoice(id: number): Promise<Invoice | undefined> {
        return this.invoices.get(id);
    }
    async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
        const id = this.currentId++;
        const newInvoice: Invoice = { ...invoice, id, description: invoice.description || null, createdAt: new Date(), updatedAt: new Date() };
        this.invoices.set(id, newInvoice);
        this.saveData();
        return newInvoice;
    }
    async updateInvoiceStatus(id: number, status: string): Promise<Invoice | undefined> {
        const invoice = this.invoices.get(id);
        if (!invoice) return undefined;
        invoice.status = status as any;
        this.invoices.set(id, invoice);
        this.saveData();
        return invoice;
    }
    async updateInvoicePayment(id: number, amountPaid: number): Promise<Invoice | undefined> {
        const invoice = this.invoices.get(id);
        if (!invoice) return undefined;
        invoice.amountPaid = amountPaid;
        this.invoices.set(id, invoice);
        this.saveData();
        return invoice;
    }

    // Settings
    async getSetting(key: string): Promise<string | null> {
        return this.settings.get(key) || null;
    }
    async getSettings(keys: string[]): Promise<Record<string, string>> {
        const result: Record<string, string> = {};
        for (const key of keys) {
            const val = this.settings.get(key);
            if (val) result[key] = val;
        }
        return result;
    }
    async saveSetting(key: string, value: string): Promise<Setting> {
        this.settings.set(key, value);
        this.saveData();
        return { id: this.currentId++, key, value, updatedAt: new Date() };
    }

    // Email Templates
    async getEmailTemplate(type: string): Promise<EmailTemplate | undefined> {
        return Array.from(this.emailTemplates.values()).find(t => t.type === type);
    }
    async getEmailTemplates(): Promise<EmailTemplate[]> {
        return Array.from(this.emailTemplates.values());
    }
    async saveEmailTemplate(type: string, content: string): Promise<EmailTemplate> {
        const existing = await this.getEmailTemplate(type);
        if (existing) {
            existing.content = content;
            this.saveData();
            return existing;
        }
        const id = this.currentId++;
        const newTemplate = { id, type, content, updatedAt: new Date() };
        this.emailTemplates.set(id, newTemplate);
        this.saveData();
        return newTemplate;
    }

    // Intake Forms
    async getIntakeForms(doctorId: number): Promise<IntakeForm[]> {
        return Array.from(this.intakeForms.values()).filter(f => f.doctorId === doctorId);
    }
    async getIntakeForm(id: number): Promise<IntakeForm | undefined> {
        return this.intakeForms.get(id);
    }
    async getIntakeFormByLink(uniqueLink: string): Promise<IntakeForm | undefined> {
        return Array.from(this.intakeForms.values()).find(f => f.uniqueLink === uniqueLink);
    }
    async createIntakeForm(form: InsertIntakeForm): Promise<IntakeForm> {
        const id = this.currentId++;
        const newForm: IntakeForm = { ...form, id, description: form.description || null, completedAt: null, createdAt: new Date() };
        this.intakeForms.set(id, newForm);
        this.saveData();
        return newForm;
    }
    async updateIntakeFormStatus(id: number, status: string): Promise<IntakeForm | undefined> {
        const form = this.intakeForms.get(id);
        if (!form) return undefined;
        form.status = status;
        this.intakeForms.set(id, form);
        this.saveData();
        return form;
    }
    async getIntakeFormResponses(formId: number): Promise<IntakeFormResponse[]> {
        return Array.from(this.intakeFormResponses.values()).filter(r => r.formId === formId);
    }
    async createIntakeFormResponse(response: InsertIntakeFormResponse): Promise<IntakeFormResponse> {
        const id = this.currentId++;
        const newResponse: IntakeFormResponse = { ...response, id, submittedAt: new Date() };
        this.intakeFormResponses.set(id, newResponse);
        this.saveData();
        return newResponse;
    }

    // Recording Sessions
    async getRecordingSessions(doctorId: number): Promise<RecordingSession[]> {
        return Array.from(this.recordingSessions.values()).filter(s => s.doctorId === doctorId);
    }
    async getRecordingSessionsByPatient(patientId: number): Promise<RecordingSession[]> {
        return Array.from(this.recordingSessions.values()).filter(s => s.patientId === patientId);
    }
    async getRecordingSession(id: number): Promise<RecordingSession | undefined> {
        return this.recordingSessions.get(id);
    }
    async getRecordingSessionByRoomId(roomId: string): Promise<RecordingSession | undefined> {
        return Array.from(this.recordingSessions.values()).find(s => s.roomId === roomId);
    }
    async createRecordingSession(session: InsertRecordingSession): Promise<RecordingSession> {
        const id = this.currentId++;
        const newSession: RecordingSession = { ...session, id, endTime: null, summary: null, transcript: null, notes: null, createdAt: new Date() };
        this.recordingSessions.set(id, newSession);
        this.saveData();
        return newSession;
    }
    async updateRecordingSession(id: number, updates: Partial<RecordingSession>): Promise<RecordingSession | undefined> {
        const session = this.recordingSessions.get(id);
        if (!session) return undefined;
        const updated = { ...session, ...updates };
        this.recordingSessions.set(id, updated);
        this.saveData();
        return updated;
    }
    async deleteRecordingSession(id: number): Promise<boolean> {
        const result = this.recordingSessions.delete(id);
        this.saveData();
        return result;
    }

    // Consultation Participants
    async getParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]> {
        return []; // Simple mock
    }
    async getActiveParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]> {
        return []; // Simple mock
    }
    async addParticipant(participant: InsertConsultationParticipant): Promise<ConsultationParticipant> {
        return { ...participant, id: this.currentId++, leftAt: null, joinedAt: new Date() };
    }
    async removeParticipant(id: number): Promise<boolean> {
        return true;
    }
    async markParticipantLeft(id: number): Promise<ConsultationParticipant | undefined> {
        return undefined;
    }

    // Device Monitoring
    async getDevices(patientId: number): Promise<Device[]> {
        return Array.from(this.devices.values()).filter(d => d.patientId === patientId);
    }
    async getDevice(id: number): Promise<Device | undefined> {
        return this.devices.get(id);
    }
    async createDevice(device: InsertDevice): Promise<Device> {
        const id = this.currentId++;
        const newDevice: Device = { ...device, id, lastSync: null, batteryLevel: null, status: 'offline', macAddress: device.macAddress || null, serialNumber: device.serialNumber || null, firmwareVersion: device.firmwareVersion || null, settings: device.settings || null, createdAt: new Date(), updatedAt: new Date() };
        this.devices.set(id, newDevice);
        this.saveData();
        return newDevice;
    }
    async updateDevice(id: number, updates: Partial<Device>): Promise<Device | undefined> {
        const device = this.devices.get(id);
        if (!device) return undefined;
        const updated = { ...device, ...updates };
        this.devices.set(id, updated);
        this.saveData();
        return updated;
    }
    async deleteDevice(id: number): Promise<boolean> {
        const result = this.devices.delete(id);
        this.saveData();
        return result;
    }

    // BP Readings
    async getBpReadings(patientId: number, limit?: number): Promise<BpReading[]> {
        return Array.from(this.bpReadings.values()).filter(r => r.patientId === patientId);
    }
    async getBpReadingsByDevice(deviceId: number, limit?: number): Promise<BpReading[]> {
        return Array.from(this.bpReadings.values()).filter(r => r.deviceId === deviceId);
    }
    async createBpReading(reading: InsertBpReading): Promise<BpReading> {
        const id = this.currentId++;
        const newReading: BpReading = { ...reading, id, deviceId: reading.deviceId || null, notes: reading.notes || null, location: reading.location || null, position: reading.position || null, arm: reading.arm || null, irregularHeartbeat: reading.irregularHeartbeat || false, timestamp: new Date() };
        this.bpReadings.set(id, newReading);
        this.saveData();
        return newReading;
    }

    // Glucose Readings
    async getGlucoseReadings(patientId: number, limit?: number): Promise<GlucoseReading[]> {
        return Array.from(this.glucoseReadings.values()).filter(r => r.patientId === patientId);
    }
    async getGlucoseReadingsByDevice(deviceId: number, limit?: number): Promise<GlucoseReading[]> {
        return Array.from(this.glucoseReadings.values()).filter(r => r.deviceId === deviceId);
    }
    async createGlucoseReading(reading: InsertGlucoseReading): Promise<GlucoseReading> {
        const id = this.currentId++;
        const newReading: GlucoseReading = { ...reading, id, deviceId: reading.deviceId || null, notes: reading.notes || null, context: reading.context || null, mealType: reading.mealType || null, timestamp: new Date() };
        this.glucoseReadings.set(id, newReading);
        this.saveData();
        return newReading;
    }

    // Alert Settings
    async getAlertSettings(patientId: number, deviceType: string): Promise<AlertSetting | undefined> {
        return Array.from(this.alertSettings.values()).find(s => s.patientId === patientId && s.deviceType === deviceType);
    }
    async saveAlertSettings(settings: InsertAlertSetting): Promise<AlertSetting> {
        const id = this.currentId++;
        const newSettings: AlertSetting = { ...settings, id, isEnabled: settings.isEnabled ?? true, sysHigh: settings.sysHigh || null, sysLow: settings.sysLow || null, diaHigh: settings.diaHigh || null, diaLow: settings.diaLow || null, glucoseHigh: settings.glucoseHigh || null, glucoseLow: settings.glucoseLow || null, emailNotification: settings.emailNotification ?? false, smsNotification: settings.smsNotification ?? false, createdAt: new Date(), updatedAt: new Date() };
        this.alertSettings.set(id, newSettings);
        this.saveData();
        return newSettings;
    }
    async updateAlertSettings(id: number, updates: Partial<AlertSetting>): Promise<AlertSetting | undefined> {
        const setting = this.alertSettings.get(id);
        if (!setting) return undefined;
        const updated = { ...setting, ...updates };
        this.alertSettings.set(id, updated);
        this.saveData();
        return updated;
    }

    // Lab Interpreter
    async getLabKnowledgeBase(): Promise<LabKnowledgeBase[]> {
        return Array.from(this.labKnowledgeBase.values());
    }
    async getLabKnowledgeBaseItem(id: number): Promise<LabKnowledgeBase | undefined> {
        return this.labKnowledgeBase.get(id);
    }
    async createLabKnowledgeBaseItem(item: InsertLabKnowledgeBase): Promise<LabKnowledgeBase> {
        const id = this.currentId++;
        const newItem: LabKnowledgeBase = { ...item, id, userId: item.userId || 1, normalRangeLow: item.normalRangeLow || null, normalRangeHigh: item.normalRangeHigh || null, unit: item.unit || null, recommendations: item.recommendations || null, confidenceScore: item.confidenceScore || null, source: item.source || null, category: item.category || null, createdAt: new Date() };
        this.labKnowledgeBase.set(id, newItem);
        this.saveData();
        return newItem;
    }
    async updateLabKnowledgeBaseItem(id: number, updates: Partial<LabKnowledgeBase>): Promise<LabKnowledgeBase | undefined> {
        const item = this.labKnowledgeBase.get(id);
        if (!item) return undefined;
        const updated = { ...item, ...updates };
        this.labKnowledgeBase.set(id, updated);
        this.saveData();
        return updated;
    }
    async deleteLabKnowledgeBaseItem(id: number): Promise<boolean> {
        const result = this.labKnowledgeBase.delete(id);
        this.saveData();
        return result;
    }
    async importLabKnowledgeBase(items: InsertLabKnowledgeBase[]): Promise<number> {
        let count = 0;
        for (const item of items) {
            await this.createLabKnowledgeBaseItem(item);
            count++;
        }
        return count;
    }
    async clearUserLabKnowledgeBase(userId: number): Promise<number> {
        let count = 0;
        for (const [id, item] of this.labKnowledgeBase) {
            if (item.userId === userId) {
                this.labKnowledgeBase.delete(id);
                count++;
            }
        }
        this.saveData();
        return count;
    }


    // Lab Interpreter Settings
    async getLabInterpreterSettings(): Promise<LabInterpreterSettings | undefined> {
        return Array.from(this.labInterpreterSettings.values())[0];
    }
    async saveLabInterpreterSettings(settings: InsertLabInterpreterSettings): Promise<LabInterpreterSettings> {
        const id = this.currentId++;
        const newSettings = { ...settings, id, withPatientPrompt: settings.withPatientPrompt || null, withoutPatientPrompt: settings.withoutPatientPrompt || null, reportFormatInstructions: settings.reportFormatInstructions || null, createdAt: new Date() };
        this.labInterpreterSettings.set(id, newSettings);
        this.saveData();
        return newSettings;
    }

    // Lab Reports
    async getLabReports(doctorId: number): Promise<LabReport[]> {
        return Array.from(this.labReports.values()).filter(r => r.doctorId === doctorId);
    }
    async getLabReportsByPatient(patientId: number): Promise<LabReport[]> {
        return Array.from(this.labReports.values()).filter(r => r.patientId === patientId);
    }
    async getLabReport(id: number): Promise<LabReport | undefined> {
        return this.labReports.get(id);
    }
    async createLabReport(report: InsertLabReport): Promise<LabReport> {
        const id = this.currentId++;
        const newReport: LabReport = { ...report, id, patientId: report.patientId || null, analysis: report.analysis || null, findings: report.findings || null, recommendations: report.recommendations || null, rawData: report.rawData || null, metadata: report.metadata || null, createdAt: new Date() };
        this.labReports.set(id, newReport);
        this.saveData();
        return newReport;
    }
    async deleteLabReport(id: number): Promise<boolean> {
        const result = this.labReports.delete(id);
        this.saveData();
        return result;
    }

    // Patient Documents
    async getPatientDocuments(patientId: number): Promise<PatientDocument[]> {
        return Array.from(this.patientDocuments.values()).filter(d => d.patientId === patientId);
    }
    async getPatientDocument(id: number): Promise<PatientDocument | undefined> {
        return this.patientDocuments.get(id);
    }
    async createPatientDocument(doc: InsertPatientDocument): Promise<PatientDocument> {
        const id = this.currentId++;
        const newDoc: PatientDocument = { ...doc, id, description: doc.description || null, tags: doc.tags || null, analyzed: doc.analyzed ?? false, analysisData: doc.analysisData || null, uploadedBy: doc.uploadedBy || 1, createdAt: new Date() };
        this.patientDocuments.set(id, newDoc);
        this.saveData();
        return newDoc;
    }
    async updatePatientDocument(id: number, updates: Partial<PatientDocument>): Promise<PatientDocument | undefined> {
        const doc = this.patientDocuments.get(id);
        if (!doc) return undefined;
        const updated = { ...doc, ...updates };
        this.patientDocuments.set(id, updated);
        this.saveData();
        return updated;
    }
    async deletePatientDocument(id: number): Promise<boolean> {
        const result = this.patientDocuments.delete(id);
        this.saveData();
        return result;
    }

    // Medical Note Templates
    async getMedicalNoteTemplates(): Promise<MedicalNoteTemplate[]> {
        return Array.from(this.medicalNoteTemplates.values());
    }
    async getMedicalNoteTemplate(id: number): Promise<MedicalNoteTemplate | undefined> {
        return this.medicalNoteTemplates.get(id);
    }
    async createMedicalNoteTemplate(template: InsertMedicalNoteTemplate): Promise<MedicalNoteTemplate> {
        const id = this.currentId++;
        const newTemplate: MedicalNoteTemplate = { ...template, id, systemPrompt: template.systemPrompt || null, createdAt: new Date(), updatedAt: new Date() };
        this.medicalNoteTemplates.set(id, newTemplate);
        this.saveData();
        return newTemplate;
    }
    async updateMedicalNoteTemplate(id: number, updates: Partial<MedicalNoteTemplate>): Promise<MedicalNoteTemplate | undefined> {
        const template = this.medicalNoteTemplates.get(id);
        if (!template) return undefined;
        const updated = { ...template, ...updates };
        this.medicalNoteTemplates.set(id, updated);
        this.saveData();
        return updated;
    }
    async deleteMedicalNoteTemplate(id: number): Promise<boolean> {
        const result = this.medicalNoteTemplates.delete(id);
        this.saveData();
        return result;
    }

    // Medical Alerts
    async getMedicalAlertsByPatient(patientId: number): Promise<MedicalAlert[]> {
        return Array.from(this.medicalAlerts.values()).filter(a => a.patientId === patientId);
    }
    async createMedicalAlert(alert: InsertMedicalAlert): Promise<MedicalAlert> {
        const id = this.currentId++;
        const newAlert: MedicalAlert = { ...alert, id, description: alert.description || null, isActive: alert.isActive ?? true, severity: alert.severity || 'medium', createdAt: new Date() };
        this.medicalAlerts.set(id, newAlert);
        this.saveData();
        return newAlert;
    }
    async updateMedicalAlert(id: number, updates: Partial<InsertMedicalAlert>): Promise<MedicalAlert | undefined> {
        const alert = this.medicalAlerts.get(id);
        if (!alert) return undefined;
        const updated = { ...alert, ...updates };
        this.medicalAlerts.set(id, updated as MedicalAlert);
        this.saveData();
        return updated as MedicalAlert;
    }
    async deleteMedicalAlert(id: number): Promise<void> {
        this.medicalAlerts.delete(id);
        this.saveData();
    }

    // Patient Activity
    async getPatientActivity(patientId: number): Promise<PatientActivity[]> {
        return Array.from(this.patientActivity.values()).filter(a => a.patientId === patientId);
    }
    async createPatientActivity(activity: InsertPatientActivity): Promise<PatientActivity> {
        const id = this.currentId++;
        const newActivity: PatientActivity = { ...activity, id, description: activity.description || null, metadata: activity.metadata || null, date: new Date() };
        this.patientActivity.set(id, newActivity);
        this.saveData();
        return newActivity;
    }
    async deletePatientActivity(id: number): Promise<void> {
        this.patientActivity.delete(id);
        this.saveData();
    }

    // Prescriptions
    async getPrescriptionsByPatient(patientId: number): Promise<Prescription[]> {
        return Array.from(this.prescriptions.values()).filter(p => p.patientId === patientId);
    }
    async createPrescription(prescription: InsertPrescription): Promise<Prescription> {
        const id = this.currentId++;
        const newPrescription: Prescription = { ...prescription, id, duration: prescription.duration || null, instructions: prescription.instructions || null, notes: prescription.notes || null, isActive: prescription.isActive ?? true, refills: prescription.refills || 0, prescribedDate: new Date() };
        this.prescriptions.set(id, newPrescription);
        this.saveData();
        return newPrescription;
    }
    async updatePrescription(id: number, updates: Partial<InsertPrescription>): Promise<Prescription | undefined> {
        const prescription = this.prescriptions.get(id);
        if (!prescription) return undefined;
        const updated = { ...prescription, ...updates };
        this.prescriptions.set(id, updated as Prescription);
        this.saveData();
        return updated as Prescription;
    }
    async deletePrescription(id: number): Promise<void> {
        this.prescriptions.delete(id);
        this.saveData();
    }

    // Medical History Entries
    async getMedicalHistoryEntriesByPatient(patientId: number): Promise<MedicalHistoryEntry[]> {
        return Array.from(this.medicalHistoryEntries.values()).filter(h => h.patientId === patientId);
    }
    async createMedicalHistoryEntry(entry: InsertMedicalHistoryEntry): Promise<MedicalHistoryEntry> {
        const id = this.currentId++;
        const newEntry: MedicalHistoryEntry = { ...entry, id, description: entry.description || null, date: entry.date || null, isActive: entry.isActive ?? true, createdAt: new Date() };
        this.medicalHistoryEntries.set(id, newEntry);
        this.saveData();
        return newEntry;
    }
    async updateMedicalHistoryEntry(id: number, updates: Partial<InsertMedicalHistoryEntry>): Promise<MedicalHistoryEntry | undefined> {
        const entry = this.medicalHistoryEntries.get(id);
        if (!entry) return undefined;
        const updated = { ...entry, ...updates };
        this.medicalHistoryEntries.set(id, updated as MedicalHistoryEntry);
        this.saveData();
        return updated as MedicalHistoryEntry;
    }
    async deleteMedicalHistoryEntry(id: number): Promise<void> {
        this.medicalHistoryEntries.delete(id);
        this.saveData();
    }

    // Custom Note Prompts
    async getCustomNotePrompt(userId: number, noteType: string): Promise<CustomNotePrompt | undefined> {
        return Array.from(this.customNotePrompts.values()).find(p => p.userId === userId && p.noteType === noteType);
    }
    async saveCustomNotePrompt(prompt: InsertCustomNotePrompt): Promise<CustomNotePrompt> {
        const existing = await this.getCustomNotePrompt(prompt.userId, prompt.noteType);
        if (existing) {
            existing.systemPrompt = prompt.systemPrompt;
            existing.template = prompt.template;
            this.saveData();
            return existing;
        }
        const id = this.currentId++;
        const newPrompt: CustomNotePrompt = { ...prompt, id, name: prompt.name || "Untitled Prompt", isGlobal: prompt.isGlobal || false, description: prompt.description || null, isActive: prompt.isActive ?? true, version: "1.0", createdAt: new Date(), updatedAt: new Date() };
        this.customNotePrompts.set(id, newPrompt);
        this.saveData();
        return newPrompt;
    }
    async getGlobalPrompts(): Promise<CustomNotePrompt[]> {
        return Array.from(this.customNotePrompts.values()).filter(p => p.isGlobal);
    }
    async getGlobalPrompt(id: number): Promise<CustomNotePrompt | undefined> {
        return this.customNotePrompts.get(id);
    }
    async createGlobalPrompt(prompt: Partial<InsertCustomNotePrompt> & { userId: number }): Promise<CustomNotePrompt> {
        const id = this.currentId++;
        const newPrompt: CustomNotePrompt = {
            id,
            userId: prompt.userId,
            name: prompt.name || "Global Prompt",
            noteType: prompt.noteType || "general",
            systemPrompt: prompt.systemPrompt || "",
            template: prompt.template || "",
            isGlobal: true,
            isActive: true,
            version: "1.0",
            description: prompt.description || null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.customNotePrompts.set(id, newPrompt);
        this.saveData();
        return newPrompt;
    }
    async updateGlobalPrompt(id: number, updates: Partial<CustomNotePrompt>): Promise<CustomNotePrompt | undefined> {
        const prompt = this.customNotePrompts.get(id);
        if (!prompt) return undefined;
        const updated = { ...prompt, ...updates, updatedAt: new Date() };
        this.customNotePrompts.set(id, updated);
        this.saveData();
        return updated;
    }
    async deleteGlobalPrompt(id: number): Promise<boolean> {
        const result = this.customNotePrompts.delete(id);
        this.saveData();
        return result;
    }
}
