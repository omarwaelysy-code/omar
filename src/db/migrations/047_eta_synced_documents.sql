-- 047_eta_synced_documents.sql
-- Persistent storage for synced Egyptian Tax Authority (ETA) e-Invoicing documents

CREATE TABLE IF NOT EXISTS "eta_documents" (
    "id" VARCHAR(255) PRIMARY KEY,
    "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
    "uuid" VARCHAR(255) NOT NULL,
    "submission_uuid" VARCHAR(255),
    "long_id" TEXT,
    "internal_id" VARCHAR(255) DEFAULT '',
    "type_name" VARCHAR(20) DEFAULT 'I',
    "document_type_name" VARCHAR(100) DEFAULT 'فاتورة',
    "document_type_version" VARCHAR(20) DEFAULT '1.0',
    "direction" VARCHAR(20) NOT NULL DEFAULT 'Received',
    "status" VARCHAR(50) DEFAULT 'Valid',
    "date_time_issued" TIMESTAMP WITH TIME ZONE,
    "date_time_received" TIMESTAMP WITH TIME ZONE,
    "issuer_id" VARCHAR(50),
    "issuer_name" TEXT,
    "issuer_type" VARCHAR(20),
    "issuer_address" TEXT,
    "receiver_id" VARCHAR(50),
    "receiver_name" TEXT,
    "receiver_type" VARCHAR(20),
    "receiver_address" TEXT,
    "total_sales_amount" NUMERIC(18, 4) DEFAULT 0,
    "total_discount_amount" NUMERIC(18, 4) DEFAULT 0,
    "net_amount" NUMERIC(18, 4) DEFAULT 0,
    "tax_amount" NUMERIC(18, 4) DEFAULT 0,
    "total_amount" NUMERIC(18, 4) DEFAULT 0,
    "extra_discount_amount" NUMERIC(18, 4) DEFAULT 0,
    "total_items_discount_amount" NUMERIC(18, 4) DEFAULT 0,
    "currency" VARCHAR(10) DEFAULT 'EGP',
    "raw_data" JSONB,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "last_synced_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "uq_eta_documents_company_uuid" UNIQUE ("company_id", "uuid")
);

CREATE INDEX IF NOT EXISTS "idx_eta_documents_company_dir" ON "eta_documents"("company_id", "direction");
CREATE INDEX IF NOT EXISTS "idx_eta_documents_company_issued" ON "eta_documents"("company_id", "date_time_issued" DESC);
CREATE INDEX IF NOT EXISTS "idx_eta_documents_company_status" ON "eta_documents"("company_id", "status");
CREATE INDEX IF NOT EXISTS "idx_eta_documents_company_internal" ON "eta_documents"("company_id", "internal_id");
CREATE INDEX IF NOT EXISTS "idx_eta_documents_uuid" ON "eta_documents"("uuid");
