-- Migration 034: Purchase Workflow Mode and Goods Receipts
ALTER TABLE companies ADD COLUMN IF NOT EXISTS purchase_workflow_mode VARCHAR(50) DEFAULT 'Simple';

-- Create Goods Receipts Table
CREATE TABLE IF NOT EXISTS goods_receipts (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36),
  receipt_number VARCHAR(100) NOT NULL,
  supplier_id VARCHAR(36),
  supplier_name VARCHAR(255),
  warehouse_id VARCHAR(36),
  warehouse_name VARCHAR(255),
  date DATE NOT NULL,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft, posted, cancelled
  document_origin VARCHAR(50) DEFAULT 'Manual', -- Manual, Purchase Request, Purchase Order, Purchase Invoice (Auto Generated)
  created_automatically BOOLEAN DEFAULT FALSE,
  source_document_type VARCHAR(50),
  source_document_id VARCHAR(36),
  source_document_number VARCHAR(100),
  created_by VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Goods Receipt Items Table
CREATE TABLE IF NOT EXISTS goods_receipt_items (
  id VARCHAR(36) PRIMARY KEY,
  goods_receipt_id VARCHAR(36) REFERENCES goods_receipts(id) ON DELETE CASCADE,
  company_id VARCHAR(36),
  product_id VARCHAR(36),
  product_name VARCHAR(255),
  product_code VARCHAR(100),
  unit VARCHAR(50),
  quantity DECIMAL(15, 4) NOT NULL,
  unit_cost DECIMAL(15, 4) NOT NULL,
  total_cost DECIMAL(15, 4) NOT NULL,
  batch_id VARCHAR(36),
  serial_number VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create many-to-many link table between Purchase Invoices and Goods Receipts
CREATE TABLE IF NOT EXISTS purchase_invoice_goods_receipts (
  id VARCHAR(36) PRIMARY KEY,
  purchase_invoice_id VARCHAR(36),
  goods_receipt_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add tracking columns for partial receipt and billing on Purchase Orders
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(18, 4) DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS invoiced_quantity DECIMAL(18, 4) DEFAULT 0;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS receipt_status VARCHAR(20) DEFAULT 'pending'; -- pending, partial, received
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS billing_status VARCHAR(20) DEFAULT 'pending'; -- pending, partial, invoiced
