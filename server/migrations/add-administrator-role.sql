-- Migration: add administrator role to user_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    WHERE e.enumlabel = 'administrator'
      AND e.enumtypid = 'user_role'::regtype
  ) THEN
    EXECUTE 'ALTER TYPE user_role ADD VALUE ''administrator''';
  END IF;
END $$;
