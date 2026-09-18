-- Migration 067: Create received_cheques table
-- Enables tracking received bank cheques from customers and other parties

CREATE TABLE IF NOT EXISTS "received_cheques" (
  "id" VARCHAR(36) PRIMARY KEY,
  "company_id" VARCHAR(36) NOT NULL REFERENCES "companies"("id") ON DELETE CASCADE,
  "receipt_number" VARCHAR(100),
  "serial_number" VARCHAR(100),
  "cheque_number" VARCHAR(100) NOT NULL,
  "cheque_type" VARCHAR(50) DEFAULT 'customer',
  "customer_id" VARCHAR(36) REFERENCES "customers"("id"),
  "customer_name" VARCHAR(255),
  "payer_name" VARCHAR(255),
  "bank_name" VARCHAR(255),
  "amount" DECIMAL(18, 4) NOT NULL CHECK ("amount" > 0),
  "currency" VARCHAR(10) DEFAULT 'EGP',
  "exchange_rate" DECIMAL(18, 6) DEFAULT 1.0,
  "receive_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "is_crossed" BOOLEAN DEFAULT TRUE,
  "is_not_negotiable" BOOLEAN DEFAULT TRUE,
  "purpose" VARCHAR(255),
  "description" TEXT,
  "notes" TEXT,
  "attachments" JSONB DEFAULT '[]',
  "settlement_details" JSONB DEFAULT '[]',
  "debit_account_id" VARCHAR(36) REFERENCES "accounts"("id"),
  "debit_account_name" VARCHAR(255),
  "credit_account_id" VARCHAR(36) REFERENCES "accounts"("id"),
  "credit_account_name" VARCHAR(255),
  "deposit_account_id" VARCHAR(36) REFERENCES "payment_methods"("id"),
  "collection_date" DATE,
  "return_date" DATE,
  "return_reason" TEXT,
  "old_due_date" DATE,
  "new_due_date" DATE,
  "postponement_reason" TEXT,
  "cancelled_at" TIMESTAMP,
  "cancelled_by" VARCHAR(36),
  "cancel_reason" TEXT,
  "receive_journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id"),
  "collection_journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id"),
  "cancel_journal_entry_id" VARCHAR(36) REFERENCES "journal_entries"("id"),
  "created_by" VARCHAR(36),
  "updated_by" VARCHAR(36),
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_received_cheque_due_date" CHECK ("due_date" >= "receive_date")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_received_cheques_company_status" ON "received_cheques"("company_id", "status");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_due_date" ON "received_cheques"("company_id", "due_date");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_customer" ON "received_cheques"("company_id", "customer_id");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_cheque_number" ON "received_cheques"("company_id", "cheque_number");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_receipt_number" ON "received_cheques"("company_id", "receipt_number");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_serial_number" ON "received_cheques"("company_id", "serial_number");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_type" ON "received_cheques"("company_id", "cheque_type");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_debit_account" ON "received_cheques"("company_id", "debit_account_id");
CREATE INDEX IF NOT EXISTS "idx_received_cheques_credit_account" ON "received_cheques"("company_id", "credit_account_id");
