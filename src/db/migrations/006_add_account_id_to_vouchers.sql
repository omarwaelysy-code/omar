-- Add account_id to receipt_vouchers and payment_vouchers if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='receipt_vouchers' AND column_name='account_id') THEN
        ALTER TABLE receipt_vouchers ADD COLUMN account_id VARCHAR(36) REFERENCES accounts(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='payment_vouchers' AND column_name='account_id') THEN
        ALTER TABLE payment_vouchers ADD COLUMN account_id VARCHAR(36) REFERENCES accounts(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='entity') THEN
        -- If entity doesn't exist, we might have category from previous versions
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='category') THEN
            ALTER TABLE activity_logs RENAME COLUMN category TO entity;
        ELSE
            ALTER TABLE activity_logs ADD COLUMN entity JSONB;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activity_logs' AND column_name='account_id') THEN
        ALTER TABLE activity_logs ADD COLUMN account_id VARCHAR(36) REFERENCES accounts(id);
    END IF;
END $$;
