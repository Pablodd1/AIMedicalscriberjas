import { Pool } from 'pg';
// Demo mode - suppress logging
const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'demo';
const log = (...args: any[]) => !DEMO_MODE && console.log(...args);
const logError = (...args: any[]) => !DEMO_MODE && console.error(...args);
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Use standard PostgreSQL connection instead of Neon serverless to avoid WebSocket issues
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Add pool error handling
pool.on('error', (err) => {
  logError('Pool error:', err);
});

export const db = drizzle(pool, { schema });