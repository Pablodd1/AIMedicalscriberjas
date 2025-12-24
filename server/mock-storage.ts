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

export class MockStorage implements IStorage {
    private users: Map<number, User> = new Map();
    private patients: Map<number, Patient> = new Map();
    private appointments: Map<number, Appointment> = new Map();
    private settings: Map<string, string> = new Map();
    public sessionStore: session.Store;
    private currentId: number = 1;

    constructor() {
        this.sessionStore = new MemoryStore({
            checkPeriod: 86400000
        });

        // Create a default admin user
        this.createUser({
            username: "admin",
            password: "admin123", // In real use it's hashed, but for mock we can handle it
            name: "System Administrator",
            role: "administrator",
            email: "admin@aims.medical",
            isActive: true
        });

        // Seed mock patients
        this.createPatient({
            name: "Jane Doe",
            email: "jane@example.com",
            phone: "555-0101",
            dob: "1985-05-15",
            gender: "female",
            address: "123 Main St",
            createdBy: 1
        });

        this.createPatient({
            name: "John Smith",
            email: "john@example.com",
            phone: "555-0102",
            dob: "1970-10-20",
            gender: "male",
            address: "456 Oak Ave",
            createdBy: 1
        });

        // Seed mock appointments
        this.createAppointment({
            patientId: 1,
            doctorId: 1,
            date: new Date(Date.now() + 86400000).toISOString(),
            reason: "Annual Checkup",
            status: "scheduled"
        });

        this.createAppointment({
            patientId: 2,
            doctorId: 1,
            date: new Date(Date.now() + 172800000).toISOString(),
            reason: "Follow-up",
            status: "scheduled"
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

    async createUser(insertUser: InsertUser): Promise<User> {
        const id = this.currentId++;
        const user: User = {
            ...insertUser,
            id,
            phone: insertUser.phone ?? null,
            specialty: insertUser.specialty ?? null,
            licenseNumber: insertUser.licenseNumber ?? null,
            avatar: insertUser.avatar ?? null,
            bio: insertUser.bio ?? null,
            isActive: insertUser.isActive ?? true,
            lastLogin: null,
            createdAt: new Date()
        } as User;
        this.users.set(id, user);
        return user;
    }

    async updateUser(id: number, updates: Partial<User>): Promise<User | undefined> {
        const user = this.users.get(id);
        if (!user) return undefined;
        const updated = { ...user, ...updates };
        this.users.set(id, updated);
        return updated;
    }

    async updateUserLastLogin(id: number): Promise<void> {
        await this.updateUser(id, { lastLogin: new Date() });
    }

    async deleteUser(id: number): Promise<boolean> {
        return this.users.delete(id);
    }

    async getPatients(doctorId: number): Promise<Patient[]> {
        return Array.from(this.patients.values());
    }

    async getPatient(id: number): Promise<Patient | undefined> {
        return this.patients.get(id);
    }

    async createPatient(patient: InsertPatient & { createdBy: number }): Promise<Patient> {
        const id = this.currentId++;
        const newPatient: Patient = { ...patient, id } as Patient;
        this.patients.set(id, newPatient);
        return newPatient;
    }

    async getAppointments(doctorId: number): Promise<Appointment[]> {
        return Array.from(this.appointments.values());
    }

    async getAppointment(id: number): Promise<Appointment | undefined> {
        return this.appointments.get(id);
    }

    async getAppointmentByToken(token: string): Promise<Appointment[]> {
        return [];
    }

    async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
        const id = this.currentId++;
        const newAppointment: Appointment = { ...appointment, id } as Appointment;
        this.appointments.set(id, newAppointment);
        return newAppointment;
    }

    async updateAppointmentStatus(id: number, status: string): Promise<Appointment | undefined> {
        return undefined;
    }

    async updatePatientConfirmationStatus(id: number, status: string): Promise<Appointment | undefined> {
        return undefined;
    }

    async clearAppointmentToken(id: number): Promise<void> { }

    async updateAppointment(id: number, updates: Partial<Appointment>): Promise<Appointment | undefined> {
        return undefined;
    }

    async deleteAppointment(id: number): Promise<boolean> {
        return this.appointments.delete(id);
    }

    async getMedicalNotes(doctorId: number): Promise<MedicalNote[]> { return []; }
    async getMedicalNotesByPatient(patientId: number): Promise<MedicalNote[]> { return []; }
    async getMedicalNote(id: number): Promise<MedicalNote | undefined> { return undefined; }
    async createMedicalNote(note: InsertMedicalNote): Promise<MedicalNote> { return {} as MedicalNote; }
    async getQuickNotes(doctorId: number): Promise<MedicalNote[]> { return []; }
    async createQuickNote(note: any): Promise<MedicalNote> { return {} as MedicalNote; }
    async getConsultationNotes(doctorId: number): Promise<ConsultationNote[]> { return []; }
    async getConsultationNotesByPatient(patientId: number): Promise<ConsultationNote[]> { return []; }
    async getConsultationNote(id: number): Promise<ConsultationNote | undefined> { return undefined; }
    async createConsultationNote(note: InsertConsultationNote): Promise<ConsultationNote> { return {} as ConsultationNote; }
    async createMedicalNoteFromConsultation(note: InsertMedicalNote, consultationId: number): Promise<MedicalNote> { return {} as MedicalNote; }

    async getInvoices(doctorId: number): Promise<Invoice[]> { return []; }
    async getInvoicesByPatient(patientId: number): Promise<Invoice[]> { return []; }
    async getInvoice(id: number): Promise<Invoice | undefined> { return undefined; }
    async createInvoice(invoice: InsertInvoice): Promise<Invoice> { return {} as Invoice; }
    async updateInvoiceStatus(id: number, status: string): Promise<Invoice | undefined> { return undefined; }
    async updateInvoicePayment(id: number, amountPaid: number): Promise<Invoice | undefined> { return undefined; }

    async getSetting(key: string): Promise<string | null> {
        return this.settings.get(key) || null;
    }

    async getSettings(keys: string[]): Promise<Record<string, string>> {
        const res: Record<string, string> = {};
        keys.forEach(k => {
            const v = this.settings.get(k);
            if (v) res[k] = v;
        });
        return res;
    }

    async saveSetting(key: string, value: string): Promise<Setting> {
        this.settings.set(key, value);
        return { id: 1, key, value, createdAt: new Date(), updatedAt: new Date() };
    }

    async getEmailTemplate(type: string): Promise<EmailTemplate | undefined> { return undefined; }
    async getEmailTemplates(): Promise<EmailTemplate[]> { return []; }
    async saveEmailTemplate(type: string, content: string): Promise<EmailTemplate> { return {} as EmailTemplate; }

    async getIntakeForms(doctorId: number): Promise<IntakeForm[]> { return []; }
    async getIntakeForm(id: number): Promise<IntakeForm | undefined> { return undefined; }
    async getIntakeFormByLink(uniqueLink: string): Promise<IntakeForm | undefined> { return undefined; }
    async createIntakeForm(form: InsertIntakeForm): Promise<IntakeForm> { return {} as IntakeForm; }
    async updateIntakeFormStatus(id: number, status: string): Promise<IntakeForm | undefined> { return undefined; }
    async getIntakeFormResponses(formId: number): Promise<IntakeFormResponse[]> { return []; }
    async createIntakeFormResponse(response: InsertIntakeFormResponse): Promise<IntakeFormResponse> { return {} as IntakeFormResponse; }

    async getRecordingSessions(doctorId: number): Promise<RecordingSession[]> { return []; }
    async getRecordingSessionsByPatient(patientId: number): Promise<RecordingSession[]> { return []; }
    async getRecordingSession(id: number): Promise<RecordingSession | undefined> { return undefined; }
    async getRecordingSessionByRoomId(roomId: string): Promise<RecordingSession | undefined> { return undefined; }
    async createRecordingSession(session: InsertRecordingSession): Promise<RecordingSession> { return {} as RecordingSession; }
    async updateRecordingSession(id: number, updates: Partial<RecordingSession>): Promise<RecordingSession | undefined> { return undefined; }
    async deleteRecordingSession(id: number): Promise<boolean> { return true; }

    async getParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]> { return []; }
    async getActiveParticipantsByRoom(roomId: string): Promise<ConsultationParticipant[]> { return []; }
    async addParticipant(participant: InsertConsultationParticipant): Promise<ConsultationParticipant> { return {} as ConsultationParticipant; }
    async removeParticipant(id: number): Promise<boolean> { return true; }
    async markParticipantLeft(id: number): Promise<ConsultationParticipant | undefined> { return undefined; }

    async getDevices(patientId: number): Promise<Device[]> { return []; }
    async getDevice(id: number): Promise<Device | undefined> { return undefined; }
    async createDevice(device: InsertDevice): Promise<Device> { return {} as Device; }
    async updateDevice(id: number, updates: Partial<Device>): Promise<Device | undefined> { return undefined; }
    async deleteDevice(id: number): Promise<boolean> { return true; }

    async getBpReadings(patientId: number, limit?: number): Promise<BpReading[]> { return []; }
    async getBpReadingsByDevice(deviceId: number, limit?: number): Promise<BpReading[]> { return []; }
    async createBpReading(reading: InsertBpReading): Promise<BpReading> { return {} as BpReading; }

    async getGlucoseReadings(patientId: number, limit?: number): Promise<GlucoseReading[]> { return []; }
    async getGlucoseReadingsByDevice(deviceId: number, limit?: number): Promise<GlucoseReading[]> { return []; }
    async createGlucoseReading(reading: InsertGlucoseReading): Promise<GlucoseReading> { return {} as GlucoseReading; }

    async getAlertSettings(patientId: number, deviceType: string): Promise<AlertSetting | undefined> { return undefined; }
    async saveAlertSettings(settings: InsertAlertSetting): Promise<AlertSetting> { return {} as AlertSetting; }
    async updateAlertSettings(id: number, updates: Partial<AlertSetting>): Promise<AlertSetting | undefined> { return undefined; }

    async getLabKnowledgeBase(): Promise<LabKnowledgeBase[]> { return []; }
    async getLabKnowledgeBaseItem(id: number): Promise<LabKnowledgeBase | undefined> { return undefined; }
    async createLabKnowledgeBaseItem(item: InsertLabKnowledgeBase): Promise<LabKnowledgeBase> { return {} as LabKnowledgeBase; }
    async updateLabKnowledgeBaseItem(id: number, updates: Partial<LabKnowledgeBase>): Promise<LabKnowledgeBase | undefined> { return undefined; }
    async deleteLabKnowledgeBaseItem(id: number): Promise<boolean> { return true; }
    async importLabKnowledgeBase(items: InsertLabKnowledgeBase[]): Promise<number> { return 0; }

    async getLabInterpreterSettings(): Promise<LabInterpreterSettings | undefined> { return undefined; }
    async saveLabInterpreterSettings(settings: InsertLabInterpreterSettings): Promise<LabInterpreterSettings> { return {} as LabInterpreterSettings; }

    async getLabReports(doctorId: number): Promise<LabReport[]> { return []; }
    async getLabReportsByPatient(patientId: number): Promise<LabReport[]> { return []; }
    async getLabReport(id: number): Promise<LabReport | undefined> { return undefined; }
    async createLabReport(report: InsertLabReport): Promise<LabReport> { return {} as LabReport; }
    async updateLabReport(id: number, updates: Partial<LabReport>): Promise<LabReport | undefined> { return undefined; }
    async deleteLabReport(id: number): Promise<boolean> { return true; }

    async getPatientDocuments(patientId: number): Promise<PatientDocument[]> { return []; }
    async getPatientDocument(id: number): Promise<PatientDocument | undefined> { return undefined; }
    async createPatientDocument(document: InsertPatientDocument): Promise<PatientDocument> { return {} as PatientDocument; }
    async updatePatientDocument(id: number, updates: Partial<PatientDocument>): Promise<PatientDocument | undefined> { return undefined; }
    async deletePatientDocument(id: number): Promise<boolean> { return true; }

    async getMedicalAlertsByPatient(patientId: number): Promise<MedicalAlert[]> { return []; }
    async createMedicalAlert(alert: InsertMedicalAlert): Promise<MedicalAlert> { return {} as MedicalAlert; }
    async updateMedicalAlert(id: number, alert: Partial<InsertMedicalAlert>): Promise<MedicalAlert | undefined> { return undefined; }
    async deleteMedicalAlert(id: number): Promise<void> { }

    async getPatientActivity(patientId: number): Promise<PatientActivity[]> { return []; }
    async createPatientActivity(activity: InsertPatientActivity): Promise<PatientActivity> { return {} as PatientActivity; }
    async deletePatientActivity(id: number): Promise<void> { }

    async getPrescriptionsByPatient(patientId: number): Promise<Prescription[]> { return []; }
    async createPrescription(prescription: InsertPrescription): Promise<Prescription> { return {} as Prescription; }
    async updatePrescription(id: number, prescription: Partial<InsertPrescription>): Promise<Prescription | undefined> { return undefined; }
    async deletePrescription(id: number): Promise<void> { }

    async getMedicalHistoryEntriesByPatient(patientId: number): Promise<MedicalHistoryEntry[]> { return []; }
    async createMedicalHistoryEntry(entry: InsertMedicalHistoryEntry): Promise<MedicalHistoryEntry> { return {} as MedicalHistoryEntry; }
    async updateMedicalHistoryEntry(id: number, entry: Partial<InsertMedicalHistoryEntry>): Promise<MedicalHistoryEntry | undefined> { return undefined; }
    async deleteMedicalHistoryEntry(id: number): Promise<void> { }

    async getCustomNotePrompt(userId: number, noteType: string): Promise<CustomNotePrompt | undefined> { return undefined; }
    async getCustomNotePrompts(userId: number): Promise<CustomNotePrompt[]> { return []; }
    async saveCustomNotePrompt(prompt: InsertCustomNotePrompt): Promise<CustomNotePrompt> { return {} as CustomNotePrompt; }
    async deleteCustomNotePrompt(userId: number, noteType: string): Promise<void> { }
}
