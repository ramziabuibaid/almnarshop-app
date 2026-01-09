-- Migration: Add created_by column to shop_receipts and shop_payments tables
-- This column stores the ID of the admin user who created the receipt/payment
-- References admin_users.id

-- Add created_by column to shop_receipts if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shop_receipts' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE shop_receipts 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_shop_receipts_created_by ON shop_receipts(created_by);
    END IF;
END $$;

-- Add created_by column to shop_payments if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shop_payments' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE shop_payments 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_shop_payments_created_by ON shop_payments(created_by);
    END IF;
END $$;
