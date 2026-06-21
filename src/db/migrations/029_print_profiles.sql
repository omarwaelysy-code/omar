-- Migration: 029_print_profiles
-- Creates print_profiles table and links it to templates

CREATE TABLE IF NOT EXISTS print_profiles (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  paper_size_id VARCHAR(36) REFERENCES paper_sizes(id) ON DELETE SET NULL,
  custom_width DECIMAL(10, 2),
  custom_height DECIMAL(10, 2),
  orientation VARCHAR(20) NOT NULL DEFAULT 'portrait',
  margin_top DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  margin_bottom DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  margin_left DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  margin_right DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  dpi INT NOT NULL DEFAULT 300,
  print_settings JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO paper_sizes (id, name, width, height, unit, is_system, company_id)
VALUES ('a6', 'A6', 105.00, 148.00, 'mm', TRUE, NULL)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'templates' AND column_name = 'print_profile_id'
  ) THEN
    ALTER TABLE templates ADD COLUMN print_profile_id VARCHAR(36) REFERENCES print_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
