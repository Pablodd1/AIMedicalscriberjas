import type { VercelRequest, VercelResponse } from '@vercel/node';
import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import multer from 'multer';
import OpenAI from 'openai';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, desc } from 'drizzle-orm';
import { pgTable, serial, text, boolean, timestamp, varchar, date, integer } from 'drizzle-orm/pg-core';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Define schemas for Vercel serverless
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

// Database setup
function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema: { users, patients, appointments, medicalNotes } });
}

// Create Express app
const app = express();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'aims-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    sameSite: 'lax'
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper function to get OpenAI client
function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// Password hashing helpers (same as server/auth.ts)
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

// Passport Local Strategy
passport.use(new LocalStrategy(async (username, password, done) => {
  try {
    const db = getDb();
    if (!db) {
      return done(null, false, { message: 'Database not configured' });
    }

    const result = await db.select().from(users).where(eq(users.username, username));
    const user = result[0];

    if (!user) {
      return done(null, false, { message: 'Invalid username or password' });
    }

    const passwordMatch = await comparePasswords(password, user.password);
    if (!passwordMatch) {
      return done(null, false, { message: 'Invalid username or password' });
    }

    if (user.isActive === false) {
      return done(null, false, { 
        message: 'Your account has been deactivated. Please contact admin.' 
      });
    }

    // Update last login
    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: number, done) => {
  try {
    const db = getDb();
    if (!db) return done(new Error('Database not configured'));
    
    const result = await db.select().from(users).where(eq(users.id, id));
    if (result[0]) {
      done(null, result[0]);
    } else {
      done(new Error('User not found'));
    }
  } catch (error) {
    done(error);
  }
});

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Authentication required' });
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '2.4',
    database: process.env.DATABASE_URL ? 'configured' : 'not configured'
  });
});

// ==================== AUTH ENDPOINTS ====================

// Login
app.post('/api/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: any, info: any) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ message: info?.message || 'Invalid credentials' });
    }
    req.login(user, (err) => {
      if (err) return next(err);
      const { password, ...userWithoutPassword } = user;
      return res.json(userWithoutPassword);
    });
  })(req, res, next);
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
      isActive: false // New users inactive until admin approval
    }).returning();

    const newUser = result[0];
    req.login(newUser, (err) => {
      if (err) return res.status(500).json({ message: 'Login error after registration' });
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Failed to register user' });
  }
});

// Logout
app.get('/api/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ message: 'Logout error' });
    req.session.destroy((err) => {
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });
});

// Get current user
app.get('/api/user', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  const { password, ...userWithoutPassword } = req.user as any;
  res.json(userWithoutPassword);
});

// Setup endpoint - creates default users
app.post('/api/setup', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not configured',
        message: 'Please set DATABASE_URL environment variable'
      });
    }

    const defaultUsers = [
      {
        username: 'admin',
        password: 'admin123',
        name: 'System Administrator',
        role: 'admin',
        email: 'admin@aims.medical',
        specialty: 'Administration',
        isActive: true,
      },
      {
        username: 'provider',
        password: 'provider123',
        name: 'Dr. John Smith',
        role: 'doctor',
        email: 'provider@aims.medical',
        specialty: 'Internal Medicine',
        licenseNumber: 'MD-12345',
        isActive: true,
      },
      {
        username: 'doctor',
        password: 'doctor123',
        name: 'Dr. Sarah Johnson',
        role: 'doctor',
        email: 'doctor@aims.medical',
        specialty: 'Family Medicine',
        licenseNumber: 'MD-67890',
        isActive: true,
      },
    ];

    const results = [];
    
    for (const userData of defaultUsers) {
      try {
        const existingUsers = await db.select().from(users).where(eq(users.username, userData.username));
        
        if (existingUsers.length === 0) {
          const hashedPassword = await hashPassword(userData.password);
          await db.insert(users).values({
            username: userData.username,
            password: hashedPassword,
            name: userData.name,
            role: userData.role,
            email: userData.email,
            specialty: userData.specialty,
            licenseNumber: userData.licenseNumber,
            isActive: userData.isActive,
          });
          results.push({ username: userData.username, status: 'created' });
        } else {
          results.push({ username: userData.username, status: 'exists' });
        }
      } catch (error: any) {
        results.push({ username: userData.username, status: 'error', message: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Setup complete',
      users: results,
      credentials: {
        admin: { username: 'admin', password: 'admin123' },
        provider: { username: 'provider', password: 'provider123' },
        doctor: { username: 'doctor', password: 'doctor123' },
      }
    });
  } catch (error: any) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed', message: error.message });
  }
});

// ==================== PATIENTS ENDPOINTS ====================

app.get('/api/patients', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const result = await db.select().from(patients).orderBy(desc(patients.createdAt));
    res.json(result);
  } catch (error: any) {
    console.error('Get patients error:', error);
    res.status(500).json({ message: 'Failed to fetch patients' });
  }
});

app.get('/api/patients/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const result = await db.select().from(patients).where(eq(patients.id, parseInt(req.params.id)));
    if (result.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(result[0]);
  } catch (error: any) {
    console.error('Get patient error:', error);
    res.status(500).json({ message: 'Failed to fetch patient' });
  }
});

app.post('/api/patients', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const result = await db.insert(patients).values(req.body).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create patient error:', error);
    res.status(500).json({ message: 'Failed to create patient' });
  }
});

app.patch('/api/patients/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const result = await db.update(patients)
      .set(req.body)
      .where(eq(patients.id, parseInt(req.params.id)))
      .returning();
    
    if (result.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(result[0]);
  } catch (error: any) {
    console.error('Update patient error:', error);
    res.status(500).json({ message: 'Failed to update patient' });
  }
});

app.delete('/api/patients/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    await db.delete(patients).where(eq(patients.id, parseInt(req.params.id)));
    res.json({ message: 'Patient deleted' });
  } catch (error: any) {
    console.error('Delete patient error:', error);
    res.status(500).json({ message: 'Failed to delete patient' });
  }
});

// ==================== APPOINTMENTS ENDPOINTS ====================

app.get('/api/appointments', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const result = await db.select().from(appointments).orderBy(desc(appointments.dateTime));
    res.json(result);
  } catch (error: any) {
    console.error('Get appointments error:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

app.post('/api/appointments', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const result = await db.insert(appointments).values(req.body).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create appointment error:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});

// ==================== MEDICAL NOTES ENDPOINTS ====================

app.get('/api/medical-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const patientId = req.query.patientId ? parseInt(req.query.patientId as string) : undefined;
    
    if (patientId) {
      const result = await db.select().from(medicalNotes)
        .where(eq(medicalNotes.patientId, patientId))
        .orderBy(desc(medicalNotes.createdAt));
      return res.json(result);
    }
    
    const result = await db.select().from(medicalNotes).orderBy(desc(medicalNotes.createdAt));
    res.json(result);
  } catch (error: any) {
    console.error('Get medical notes error:', error);
    res.status(500).json({ message: 'Failed to fetch medical notes' });
  }
});

app.post('/api/medical-notes', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.status(503).json({ message: 'Database not configured' });
    
    const user = req.user as any;
    const noteData = {
      ...req.body,
      doctorId: user.id
    };
    
    const result = await db.insert(medicalNotes).values(noteData).returning();
    res.status(201).json(result[0]);
  } catch (error: any) {
    console.error('Create medical note error:', error);
    res.status(500).json({ message: 'Failed to create medical note' });
  }
});

// ==================== AI ENDPOINTS ====================

// AI Chat endpoint
app.post('/api/ai/chat', async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be provided as an array' });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      temperature: 0.7,
      max_tokens: 1000
    });

    const assistantMessage = response.choices[0]?.message;
    res.json({
      success: true,
      data: {
        content: assistantMessage?.content,
        role: 'assistant'
      }
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

// Audio transcription endpoint
app.post('/api/ai/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    
    if (deepgramApiKey) {
      try {
        const { createClient } = await import('@deepgram/sdk');
        const deepgram = createClient(deepgramApiKey);

        const audioBuffer = req.file.buffer;
        const mimetype = req.file.mimetype || 'audio/webm';

        const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
          audioBuffer,
          {
            model: 'nova-2-medical',
            smart_format: true,
            punctuate: true,
            paragraphs: true,
            diarize: true,
            language: 'en-US',
            mimetype: mimetype
          }
        );

        if (error) throw error;

        const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
        
        return res.json({ 
          transcript,
          provider: 'deepgram-nova-2-medical',
          metadata: {
            confidence: result?.results?.channels?.[0]?.alternatives?.[0]?.confidence,
            duration: result?.metadata?.duration
          }
        });
      } catch (deepgramError) {
        console.error('Deepgram failed:', deepgramError);
      }
    }

    const openai = getOpenAIClient();
    if (openai) {
      try {
        const file = new File([req.file.buffer], req.file.originalname || 'audio.webm', {
          type: req.file.mimetype || 'audio/webm'
        });
        
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1',
          language: 'en',
          response_format: 'text'
        });
        
        return res.json({ 
          transcript: transcription,
          provider: 'openai-whisper'
        });
      } catch (whisperError) {
        console.error('OpenAI Whisper error:', whisperError);
      }
    }

    return res.status(503).json({ 
      error: 'Transcription service not configured.',
      fallbackAvailable: true
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

// SOAP note generation endpoint
app.post('/api/ai/generate-soap', async (req: Request, res: Response) => {
  try {
    const { transcript, patientInfo, noteType } = req.body;

    if (!transcript) {
      return res.json({ 
        success: false,
        soap: 'No transcript provided.'
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.json({
        success: false,
        soap: 'OpenAI API key not configured.'
      });
    }

    const sanitizedTranscript = (transcript || '').toString().slice(0, 4000);
    const patientName = patientInfo?.name || 
                        `${patientInfo?.firstName || ''} ${patientInfo?.lastName || ''}`.trim() || 
                        'Unknown';

    const systemPrompt = `You are **AIMS AI Medical Scribe** — a HIPAA-compliant clinical documentation assistant.

#############################################
# CRITICAL: ZERO HALLUCINATION PROTOCOL
#############################################
⚠️ ABSOLUTE RULES:
1. ONLY document information EXPLICITLY stated in the transcript
2. If NOT mentioned, use "[Not documented in this encounter]"
3. NEVER fabricate, assume, or infer
4. Mark uncertain info as "[Needs clarification]"
5. Quote patient directly for subjective complaints

SOURCE MARKERS:
- [Patient reported]: Direct patient statement
- [Per provider]: Info from healthcare provider
- [Not documented]: Not provided in this encounter
- [Needs clarification]: Unclear or incomplete

Return ONE JSON object:
{
  "ehr_payload": {
    "note_sections": {
      "ChiefComplaint": "...",
      "HPI": "...",
      "ROS": "...",
      "Medications": "...",
      "Allergies": "...",
      "PMH": "...",
      "Vitals": "...",
      "PhysicalExam": "...",
      "Assessment": "...",
      "Plan": "...",
      "FollowUp": "..."
    },
    "icd10_codes": [
      { "code": "...", "description": "...", "rationale": "...", "confidence": "high|medium|low" }
    ],
    "cpt_codes_today": [
      { "code": "...", "description": "...", "rationale": "...", "confidence": "high|medium|low" }
    ],
    "verification_report": {
      "documented_items": 0,
      "missing_items": [],
      "needs_clarification": []
    }
  },
  "human_note": "FULL NOTE IN PARAGRAPH FORM"
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Generate documentation for:\nPATIENT: ${patientName}\nNOTE TYPE: ${noteType || 'General'}\n\nTRANSCRIPT:\n${sanitizedTranscript}`
        }
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const responseContent = response.choices[0]?.message?.content?.trim() || '';
    
    try {
      const aimsResponse = JSON.parse(responseContent);
      return res.json({ 
        success: true,
        soap: aimsResponse.human_note || '',
        structuredData: aimsResponse.ehr_payload
      });
    } catch {
      return res.json({ success: true, soap: responseContent });
    }
  } catch (error: any) {
    console.error('SOAP generation error:', error);
    return res.json({ success: false, soap: 'Error generating SOAP notes.' });
  }
});

// Generate title
app.post('/api/ai/generate-title', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    const openai = getOpenAIClient();
    if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: 'Create a 3-5 word title. Return only the title.' },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 15
    });

    res.json({ title: response.choices[0].message.content?.trim() || 'New Conversation' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate title' });
  }
});

// Intake summary
app.post('/api/ai/generate-intake-summary', async (req: Request, res: Response) => {
  try {
    const { formId, responses } = req.body;
    if (!responses || !Array.isArray(responses)) {
      return res.status(400).json({ error: 'Responses must be an array' });
    }

    const openai = getOpenAIClient();
    if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

    const formattedResponses = responses.map((r: any) => 
      `Q: ${r.question}\nA: ${r.answer || '[No response]'}`
    ).join('\n\n');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: 'system', content: 'Create a clinical intake summary. Only include explicitly provided info.' },
        { role: 'user', content: `Generate intake summary:\n\n${formattedResponses}` }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    res.json({
      success: true,
      data: {
        summary: response.choices[0]?.message?.content?.trim() || '',
        formId,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to generate intake summary' });
  }
});

// Catch-all for unhandled routes
app.all('*', (req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Export for Vercel
export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
