-- Migration: 025_add_templates_and_paper_sizes
-- Creates tables for managing printing templates and paper sizes

-- 1. Create paper_sizes table
CREATE TABLE IF NOT EXISTS paper_sizes (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  width DECIMAL(10, 2) NOT NULL,
  height DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'mm',
  is_system BOOLEAN DEFAULT FALSE,
  company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE
);

-- 2. Create templates table
CREATE TABLE IF NOT EXISTS templates (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  paper_size_id VARCHAR(36) REFERENCES paper_sizes(id) ON DELETE SET NULL,
  orientation VARCHAR(20) NOT NULL DEFAULT 'portrait',
  margin_top DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  margin_bottom DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  margin_left DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  margin_right DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seed default system paper sizes
INSERT INTO paper_sizes (id, name, width, height, unit, is_system, company_id) VALUES
('a3', 'A3', 297.00, 420.00, 'mm', TRUE, NULL),
('a4', 'A4', 210.00, 297.00, 'mm', TRUE, NULL),
('a5', 'A5', 148.00, 210.00, 'mm', TRUE, NULL),
('letter', 'Letter', 215.90, 279.40, 'mm', TRUE, NULL),
('legal', 'Legal', 215.90, 355.60, 'mm', TRUE, NULL),
('executive', 'Executive', 184.10, 266.70, 'mm', TRUE, NULL),
('statement', 'Statement', 139.70, 215.90, 'mm', TRUE, NULL),
('thermal_58', 'Thermal 58 mm', 58.00, 297.00, 'mm', TRUE, NULL),
('thermal_76', 'Thermal 76 mm', 76.00, 297.00, 'mm', TRUE, NULL),
('thermal_80', 'Thermal 80 mm', 80.00, 297.00, 'mm', TRUE, NULL),
('thermal_112', 'Thermal 112 mm', 112.00, 297.00, 'mm', TRUE, NULL)
ON CONFLICT (id) DO NOTHING;
