-- Migration: 027_templates_document_type
-- Adds document_type and is_default columns to templates table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'templates' AND column_name = 'document_type'
  ) THEN
    ALTER TABLE templates ADD COLUMN document_type VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'templates' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE templates ADD COLUMN is_default BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
