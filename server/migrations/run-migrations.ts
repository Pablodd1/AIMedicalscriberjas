/**
 * Database Migration Runner
 * Runs SQL migrations to update the database schema
 */

import { pool } from '../db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  console.log('🔄 Running database migrations...');
  
  const migrationsDir = path.join(__dirname);
  
  try {
    // Get all SQL migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Run in alphabetical order
    
    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`📄 Running migration: ${file}`);
      
      try {
        await pool.query(sql);
        console.log(`✅ Migration completed: ${file}`);
      } catch (error: any) {
        // Don't fail on "already exists" errors
        if (error.code === '42701' || error.message?.includes('already exists')) {
          console.log(`⏭️ Migration skipped (already applied): ${file}`);
        } else {
          console.error(`❌ Migration failed: ${file}`, error.message);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration runner error:', error);
    // Don't throw - allow the app to continue
  }
}

// Export for use in server startup
export default runMigrations;
