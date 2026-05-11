-- Migration: Add purchase_return_items table
CREATE TABLE IF NOT EXISTS "purchase_return_items" (
    "id" VARCHAR(36) PRIMARY KEY,
    "return_id" VARCHAR(36) REFERENCES "purchase_returns"("id") ON DELETE CASCADE,
    "product_id" VARCHAR(36),
    "company_id" VARCHAR(36),
    "description" TEXT,
    "quantity" DECIMAL(18, 4) NOT NULL,
    "unit_price" DECIMAL(18, 4) NOT NULL,
    "total" DECIMAL(18, 4) NOT NULL,
    "product_name" VARCHAR(255),
    "product_code" VARCHAR(100),
    "product_image_url" TEXT,
    "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
