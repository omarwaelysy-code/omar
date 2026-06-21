-- Migration: 028_template_versions
-- Creates table for template versions history and rollback support

CREATE TABLE IF NOT EXISTS template_versions (
  id VARCHAR(36) PRIMARY KEY,
  template_id VARCHAR(36) NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  company_id VARCHAR(36) NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  layout JSONB,
  change_notes TEXT,
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id);
