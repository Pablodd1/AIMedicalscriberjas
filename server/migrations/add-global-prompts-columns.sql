-- Migration: Add columns for global prompts feature
-- This migration adds the missing columns to the custom_note_prompts table
-- to support the global prompts functionality

-- Add 'name' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_note_prompts' AND column_name = 'name'
    ) THEN
        ALTER TABLE custom_note_prompts ADD COLUMN name TEXT;
    END IF;
END $$;

-- Add 'description' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_note_prompts' AND column_name = 'description'
    ) THEN
        ALTER TABLE custom_note_prompts ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add 'is_global' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_note_prompts' AND column_name = 'is_global'
    ) THEN
        ALTER TABLE custom_note_prompts ADD COLUMN is_global BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add 'is_active' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_note_prompts' AND column_name = 'is_active'
    ) THEN
        ALTER TABLE custom_note_prompts ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add 'version' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'custom_note_prompts' AND column_name = 'version'
    ) THEN
        ALTER TABLE custom_note_prompts ADD COLUMN version TEXT DEFAULT '1.0';
    END IF;
END $$;

-- Create index for global prompts queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_custom_note_prompts_is_global 
ON custom_note_prompts(is_global) WHERE is_global = true;

-- Create index for user prompts queries if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_custom_note_prompts_user_type 
ON custom_note_prompts(user_id, note_type);
