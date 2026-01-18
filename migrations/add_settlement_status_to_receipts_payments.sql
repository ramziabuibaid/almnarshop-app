-- Migration: Add settlement status field (is_settled) to receipts and payments tables
-- This field indicates whether the receipt/payment is settled (مرحلة) or not settled (غير مرحلة)
-- Applies to: shop_receipts, shop_payments, warehouse_receipts, warehouse_payments

-- Add is_settled column to shop_receipts if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shop_receipts' 
        AND column_name = 'is_settled'
    ) THEN
        ALTER TABLE shop_receipts 
        ADD COLUMN is_settled BOOLEAN DEFAULT false;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_shop_receipts_is_settled ON shop_receipts(is_settled);
        
        -- Add comment
        COMMENT ON COLUMN shop_receipts.is_settled IS 'Indicates if the receipt is settled (مرحلة) or not settled (غير مرحلة)';
    END IF;
END $$;

-- Add is_settled column to shop_payments if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shop_payments' 
        AND column_name = 'is_settled'
    ) THEN
        ALTER TABLE shop_payments 
        ADD COLUMN is_settled BOOLEAN DEFAULT false;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_shop_payments_is_settled ON shop_payments(is_settled);
        
        -- Add comment
        COMMENT ON COLUMN shop_payments.is_settled IS 'Indicates if the payment is settled (مرحلة) or not settled (غير مرحلة)';
    END IF;
END $$;

-- Add is_settled column to warehouse_receipts if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'warehouse_receipts' 
        AND column_name = 'is_settled'
    ) THEN
        ALTER TABLE warehouse_receipts 
        ADD COLUMN is_settled BOOLEAN DEFAULT false;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_is_settled ON warehouse_receipts(is_settled);
        
        -- Add comment
        COMMENT ON COLUMN warehouse_receipts.is_settled IS 'Indicates if the receipt is settled (مرحلة) or not settled (غير مرحلة)';
    END IF;
END $$;

-- Add is_settled column to warehouse_payments if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'warehouse_payments' 
        AND column_name = 'is_settled'
    ) THEN
        ALTER TABLE warehouse_payments 
        ADD COLUMN is_settled BOOLEAN DEFAULT false;
        
        -- Create index for faster queries
        CREATE INDEX IF NOT EXISTS idx_warehouse_payments_is_settled ON warehouse_payments(is_settled);
        
        -- Add comment
        COMMENT ON COLUMN warehouse_payments.is_settled IS 'Indicates if the payment is settled (مرحلة) or not settled (غير مرحلة)';
    END IF;
END $$;
