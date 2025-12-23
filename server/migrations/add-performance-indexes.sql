-- Migration: Add performance indexes
-- These indexes optimize common query patterns

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active) WHERE is_active = true;

-- Patients table indexes
CREATE INDEX IF NOT EXISTS idx_patients_created_by ON patients(created_by);
CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email);

-- Appointments table indexes
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation_token ON appointments(confirmation_token) WHERE confirmation_token IS NOT NULL;

-- Medical notes table indexes
CREATE INDEX IF NOT EXISTS idx_medical_notes_doctor_id ON medical_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_medical_notes_patient_id ON medical_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_notes_consultation_id ON medical_notes(consultation_id);
CREATE INDEX IF NOT EXISTS idx_medical_notes_created_at ON medical_notes(created_at DESC);

-- Consultation notes table indexes
CREATE INDEX IF NOT EXISTS idx_consultation_notes_doctor_id ON consultation_notes(doctor_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_patient_id ON consultation_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultation_notes_created_at ON consultation_notes(created_at DESC);

-- Invoices table indexes
CREATE INDEX IF NOT EXISTS idx_invoices_doctor_id ON invoices(doctor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient_id ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Intake forms table indexes
CREATE INDEX IF NOT EXISTS idx_intake_forms_doctor_id ON intake_forms(doctor_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_patient_id ON intake_forms(patient_id);
CREATE INDEX IF NOT EXISTS idx_intake_forms_unique_link ON intake_forms(unique_link);
CREATE INDEX IF NOT EXISTS idx_intake_forms_status ON intake_forms(status);

-- Recording sessions table indexes
CREATE INDEX IF NOT EXISTS idx_recording_sessions_doctor_id ON recording_sessions(doctor_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_patient_id ON recording_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_room_id ON recording_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_recording_sessions_start_time ON recording_sessions(start_time DESC);

-- Lab reports table indexes
CREATE INDEX IF NOT EXISTS idx_lab_reports_doctor_id ON lab_reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_patient_id ON lab_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_lab_reports_created_at ON lab_reports(created_at DESC);

-- Patient documents table indexes
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_doctor_id ON patient_documents(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_uploaded_at ON patient_documents(uploaded_at DESC);

-- Medical alerts table indexes
CREATE INDEX IF NOT EXISTS idx_medical_alerts_patient_id ON medical_alerts(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_alerts_is_active ON medical_alerts(is_active) WHERE is_active = true;

-- Prescriptions table indexes
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_is_active ON prescriptions(is_active) WHERE is_active = true;

-- Patient activity table indexes
CREATE INDEX IF NOT EXISTS idx_patient_activity_patient_id ON patient_activity(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_activity_date ON patient_activity(date DESC);

-- Settings and email templates indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);

-- System settings index
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
