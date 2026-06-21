-- Migration: 026_add_layout_to_templates
-- Adds JSONB column to templates table to store template layouts

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'templates' AND column_name = 'layout'
  ) THEN
    ALTER TABLE templates ADD COLUMN layout JSONB;
  END IF;
END $$;
