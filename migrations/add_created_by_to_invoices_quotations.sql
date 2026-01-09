-- Migration: Add created_by column to invoices and quotations tables
-- This column stores the ID of the admin user who created the invoice/quotation
-- References admin_users.id (UUID)

-- Add created_by column to cash_invoices if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'cash_invoices' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE cash_invoices 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_cash_invoices_created_by ON cash_invoices(created_by);
    END IF;
END $$;

-- Add created_by column to shop_sales_invoices if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shop_sales_invoices' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE shop_sales_invoices 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_shop_sales_invoices_created_by ON shop_sales_invoices(created_by);
    END IF;
END $$;

-- Add created_by column to warehouse_sales_invoices if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'warehouse_sales_invoices' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE warehouse_sales_invoices 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_warehouse_sales_invoices_created_by ON warehouse_sales_invoices(created_by);
    END IF;
END $$;

-- Add created_by column to quotations if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'quotations' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE quotations 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_quotations_created_by ON quotations(created_by);
    END IF;
END $$;
