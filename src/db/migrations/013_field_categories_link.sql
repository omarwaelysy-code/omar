-- Link operation fields to multiple categories
-- Supports Many-to-Many relationship

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'field_operation_categories') THEN
        CREATE TABLE field_operation_categories (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            field_id UUID REFERENCES operation_fields(id) ON DELETE CASCADE,
            category_id UUID REFERENCES operation_categories(id) ON DELETE CASCADE,
            company_id VARCHAR(36),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX idx_field_op_cats_field ON field_operation_categories(field_id);
        CREATE INDEX idx_field_op_cats_cat ON field_operation_categories(category_id);
        CREATE INDEX idx_field_op_cats_company ON field_operation_categories(company_id);
    END IF;
END $$;
