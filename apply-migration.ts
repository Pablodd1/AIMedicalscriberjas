import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import { neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

// Database connection
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  try {
    // Add audioFilePath column to recording_sessions table if it doesn't exist
    await db.execute(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'recording_sessions' AND column_name = 'audio_file_path'
        ) THEN
          ALTER TABLE recording_sessions ADD COLUMN audio_file_path TEXT;
        END IF;
      END $$;
    `);
    
    console.log('Added audio_file_path column to recording_sessions table');
    
    // Add durationSeconds column
    await db.execute(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'recording_sessions' AND column_name = 'duration_seconds'
        ) THEN
          ALTER TABLE recording_sessions ADD COLUMN duration_seconds INTEGER;
        END IF;
      END $$;
    `);
    
    console.log('Added duration_seconds column to recording_sessions table');
    
    // Add transcription column
    await db.execute(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'recording_sessions' AND column_name = 'transcription'
        ) THEN
          ALTER TABLE recording_sessions ADD COLUMN transcription TEXT;
        END IF;
      END $$;
    `);
    
    console.log('Added transcription column to recording_sessions table');
    console.log('Database migration complete');
    
  } catch (error) {
    console.error('Error performing migration:', error);
  } finally {
    await pool.end();
  }
}

main();