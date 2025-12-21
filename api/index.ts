import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc } from 'drizzle-orm';
import { pgTable, serial, text, boolean, timestamp, varchar, date, integer } from 'drizzle-orm/pg-core';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import jwt from 'jsonwebtoken';

const scryptAsync = promisify(scrypt);

// JWT Secret - MUST be set in Vercel environment variables
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'aims-jwt-secret-2024';
const JWT_EXPIRES_IN = '7d'; // Token valid for 7 days

// ==================== DATABASE SCHEMAS ====================
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  name: text('name'),
  role: varchar('role', { length: 20 }).default('doctor'),
  email: text('email'),
  phone: text('phone'),
  specialty: text('specialty'),
  licenseNumber: text('license_number'),
  avatar: text('avatar'),
  bio: text('bio'),
  isActive: boolean('is_active').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  lastLogin: timestamp('last_login'),
});

const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  dateOfBirth: date('date_of_birth'),
  gender: text('gender'),
  address: text('address'),
  medicalHistory: text('medical_history'),
  insuranceProvider: text('insurance_provider'),
  insurancePolicyNumber: text('insurance_policy_number'),
  emergencyContactName: text('emergency_contact_name'),
  emergencyContactPhone: text('emergency_contact_phone'),
  createdAt: timestamp('created_at').defaultNow(),
});

const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id').notNull(),
  doctorId: integer('doctor_id').notNull(),
  dateTime: timestamp('date_time').notNull(),
  duration: integer('duration').default(30),
  type: text('type'),
  status: varchar('status', { length: 20 }).default('scheduled'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

const medicalNotes = pgTable('medical_notes', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id').notNull(),
  doctorId: integer('doctor_id').notNull(),
  noteType: text('note_type'),
  content: text('content'),
  createdAt: timestamp('created_at').defaultNow(),
});

const consultationNotes = pgTable('consultation_notes', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id').notNull(),
  doctorId: integer('doctor_id').notNull(),
  transcript: text('transcript'),
  soapNotes: text('soap_notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ==================== DATABASE CONNECTION ====================
function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema: { users, patients, appointments, medicalNotes, consultationNotes } });
}

// ==================== EXPRESS APP ====================
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// CORS for Vercel
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// File uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ==================== HELPER FUNCTIONS ====================
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  try {
    const [hashed, salt] = stored.split(".");
    if (!hashed || !salt) return false;
    const hashedBuf = Buffer.from(hashed, "hex");
    const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
    return timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

function generateToken(user: any): string {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ==================== AUTH MIDDLEWARE ====================
interface AuthRequest extends Request {
  user?: any;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.5-jwt',
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured'
  });
});

// ==================== AUTH ENDPOINTS ====================

// Login - Returns JWT token
app.post('/api/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const db = getDb();
    if (!db) {
      return res.status(503).json({ message: 'Database not configured' });
    }

    const result = await db.select().from(users).where(eq(users.username, username));
    const user = result[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const passwordMatch = await comparePasswords(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    if (user.isActive === false) {
      return res.status(401).json({ message: 'Account deactivated. Contact admin.' });
    }

    // Update last login
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    // Generate JWT token
    const token = generateToken(user);

    // Return user data (without password) and token
    const { password: _, ...userWithoutPassword } = user;
    res.json({ ...userWithoutPassword, token });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed' });
  }
});

// Register
app.post('/api/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, name, role = 'doctor' } = req.body;

    if (!username || !password || !email || !name) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const db = getDb();
    if (!db) {
      return res.status(503).json({ message: 'Database not configured' });
    }

    const existing = await db.select().from(users).where(eq(users.username, username));
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await hashPassword(password);
    const result = await db.insert(users).values({
      username,
      password: hashedPassword,
      email,
      name,
      role,
      isActive: false
    }).returning();

    const newUser = result[0];
    const token = generateToken(newUser);
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({ ...userWithoutPassword, token });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// Get current user (from token)
app.get('/api/user', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });

    const result = await db.select().from(users).where(eq(users.id, req.user.id));
    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password, ...userWithoutPassword } = result[0];
    res.json(userWithoutPassword);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to get user' });
  }
});

// Logout (client-side - just remove token)
app.get('/api/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully. Remove token from client.' });
});

// Setup - Create default users
app.post('/api/setup', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const defaultUsers = [
      { username: 'admin', password: 'admin123', name: 'System Administrator', role: 'admin', email: 'admin@aims.medical', specialty: 'Administration', isActive: true },
      { username: 'provider', password: 'provider123', name: 'Dr. John Smith', role: 'doctor', email: 'provider@aims.medical', specialty: 'Internal Medicine', licenseNumber: 'MD-12345', isActive: true },
      { username: 'doctor', password: 'doctor123', name: 'Dr. Sarah Johnson', role: 'doctor', email: 'doctor@aims.medical', specialty: 'Family Medicine', licenseNumber: 'MD-67890', isActive: true },
    ];

    const results = [];
    for (const userData of defaultUsers) {
      try {
        const existing = await db.select().from(users).where(eq(users.username, userData.username));
        if (existing.length === 0) {
          const hashedPassword = await hashPassword(userData.password);
          await db.insert(users).values({ ...userData, password: hashedPassword });
          results.push({ username: userData.username, status: 'created' });
        } else {
          results.push({ username: userData.username, status: 'exists' });
        }
      } catch (e: any) {
        results.push({ username: userData.username, status: 'error', message: e.message });
      }
    }

    res.json({
      success: true,
      users: results,
      credentials: {
        admin: { username: 'admin', password: 'admin123' },
        provider: { username: 'provider', password: 'provider123' },
        doctor: { username: 'doctor', password: 'doctor123' }
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Setup failed', message: error.message });
  }
});

// ==================== PATIENTS ENDPOINTS ====================

app.get('/api/patients', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.select().from(patients).orderBy(desc(patients.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

app.get('/api/patients/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.select().from(patients).where(eq(patients.id, parseInt(req.params.id)));
    if (result.length === 0) return res.status(404).json({ message: 'Patient not found' });
    res.json(result[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch patient' });
  }
});

app.post('/api/patients', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.insert(patients).values(req.body).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create patient' });
  }
});

app.patch('/api/patients/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.update(patients).set(req.body).where(eq(patients.id, parseInt(req.params.id))).returning();
    if (result.length === 0) return res.status(404).json({ message: 'Patient not found' });
    res.json(result[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update patient' });
  }
});

app.delete('/api/patients/:id', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    await db.delete(patients).where(eq(patients.id, parseInt(req.params.id)));
    res.json({ message: 'Patient deleted' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete patient' });
  }
});

// ==================== APPOINTMENTS ====================

app.get('/api/appointments', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.select().from(appointments).orderBy(desc(appointments.dateTime));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

app.post('/api/appointments', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.insert(appointments).values({ ...req.body, doctorId: req.user.id }).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});

// ==================== MEDICAL NOTES ====================

app.get('/api/medical-notes', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : undefined;
    
    if (patientId) {
      const result = await db.select().from(medicalNotes).where(eq(medicalNotes.patientId, patientId)).orderBy(desc(medicalNotes.createdAt));
      return res.json(result);
    }
    const result = await db.select().from(medicalNotes).orderBy(desc(medicalNotes.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch medical notes' });
  }
});

app.post('/api/medical-notes', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.insert(medicalNotes).values({ ...req.body, doctorId: req.user.id }).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create medical note' });
  }
});

// ==================== CONSULTATION NOTES ====================

app.get('/api/consultation-notes', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : undefined;
    
    if (patientId) {
      const result = await db.select().from(consultationNotes).where(eq(consultationNotes.patientId, patientId)).orderBy(desc(consultationNotes.createdAt));
      return res.json(result);
    }
    const result = await db.select().from(consultationNotes).orderBy(desc(consultationNotes.createdAt));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch consultation notes' });
  }
});

app.post('/api/consultation-notes', requireAuth as any, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    const result = await db.insert(consultationNotes).values({ ...req.body, doctorId: req.user.id }).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create consultation note' });
  }
});

// ==================== AI ENDPOINTS ====================

app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be an array' });
    }

    const openai = getOpenAIClient();
    if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    res.json({
      success: true,
      data: { content: response.choices[0]?.message?.content, role: 'assistant' }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.post('/api/ai/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    if (deepgramApiKey) {
      try {
        const { createClient } = await import('@deepgram/sdk');
        const deepgram = createClient(deepgramApiKey);
        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
          req.file.buffer,
          { model: 'nova-2-medical', smart_format: true, punctuate: true, diarize: true, language: 'en-US', mimetype: req.file.mimetype || 'audio/webm' }
        );
        if (!error) {
          return res.json({ 
            transcript: result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '',
            provider: 'deepgram-nova-2-medical'
          });
        }
      } catch (e) { console.error('Deepgram error:', e); }
    }

    const openai = getOpenAIClient();
    if (openai) {
      const file = new File([req.file.buffer], 'audio.webm', { type: req.file.mimetype || 'audio/webm' });
      const transcription = await openai.audio.transcriptions.create({ file, model: 'whisper-1', language: 'en' });
      return res.json({ transcript: transcription, provider: 'openai-whisper' });
    }

    res.status(503).json({ error: 'Transcription service not configured' });
  } catch (error: any) {
    res.status(500).json({ error: 'Transcription failed' });
  }
});

app.post('/api/ai/generate-soap', async (req: Request, res: Response) => {
  try {
    const { transcript, patientInfo, noteType } = req.body;
    if (!transcript) return res.json({ success: false, soap: 'No transcript provided.' });

    const openai = getOpenAIClient();
    if (!openai) return res.json({ success: false, soap: 'OpenAI not configured.' });

    const patientName = patientInfo?.name || `${patientInfo?.firstName || ''} ${patientInfo?.lastName || ''}`.trim() || 'Unknown';

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: `You are AIMS AI Medical Scribe. ZERO HALLUCINATION: Only document what's explicitly stated. Use "[Not documented]" for missing info. Return JSON: {"ehr_payload":{"note_sections":{...},"icd10_codes":[...],"cpt_codes_today":[...]},"human_note":"..."}` },
        { role: 'user', content: `Patient: ${patientName}\nType: ${noteType || 'General'}\n\nTranscript:\n${(transcript || '').slice(0, 4000)}` }
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content?.trim() || '';
    try {
      const parsed = JSON.parse(content);
      return res.json({ success: true, soap: parsed.human_note || '', structuredData: parsed.ehr_payload });
    } catch {
      return res.json({ success: true, soap: content });
    }
  } catch (error: any) {
    res.json({ success: false, soap: 'SOAP generation failed.' });
  }
});

app.post('/api/ai/generate-title', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const openai = getOpenAIClient();
    if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: 'system', content: 'Create 3-5 word title. Return only title.' }, { role: 'user', content: message }],
      temperature: 0.7,
      max_tokens: 15
    });

    res.json({ title: response.choices[0].message.content?.trim() || 'New Conversation' });
  } catch {
    res.status(500).json({ error: 'Title generation failed' });
  }
});

app.post('/api/ai/generate-intake-summary', async (req: Request, res: Response) => {
  try {
    const { formId, responses } = req.body;
    if (!responses?.length) return res.status(400).json({ error: 'Responses required' });

    const openai = getOpenAIClient();
    if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

    const formatted = responses.map((r: any) => `Q: ${r.question}\nA: ${r.answer || '[No response]'}`).join('\n\n');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: 'Create clinical intake summary. Only include explicitly provided info.' },
        { role: 'user', content: `Generate summary:\n\n${formatted}` }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    res.json({ success: true, data: { summary: response.choices[0]?.message?.content?.trim() || '', formId, generatedAt: new Date().toISOString() } });
  } catch {
    res.status(500).json({ error: 'Summary generation failed' });
  }
});

// ==================== CATCH-ALL ====================
app.all('*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found', path: req.path, method: req.method });
});

// ==================== VERCEL HANDLER ====================
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
