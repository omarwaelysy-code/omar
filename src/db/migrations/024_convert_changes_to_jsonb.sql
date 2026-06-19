-- Migration: 024_convert_changes_to_jsonb
-- Safely converts the changes column in activity_logs to JSONB

DO $$
BEGIN
  -- Check if the column is NOT jsonb
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activity_logs' 
      AND column_name = 'changes' 
      AND data_type != 'jsonb'
  ) THEN
    -- Update any truncated or invalid JSON values to NULL first to prevent migration failure
    UPDATE activity_logs 
    SET changes = NULL 
    WHERE changes::text IS NOT NULL 
      AND (
        changes::text = '' 
        OR NOT (changes::text LIKE '[%' AND changes::text LIKE '%]')
      );

    -- Alter column type
    ALTER TABLE activity_logs 
      ALTER COLUMN changes TYPE JSONB USING (
        CASE 
          WHEN changes IS NULL THEN NULL
          WHEN changes::text = '' THEN '[]'::jsonb
          ELSE changes::jsonb
        END
      );
  END IF;
END $$;
