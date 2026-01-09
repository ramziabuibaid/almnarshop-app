-- Migration: Add created_by column to maintenance table
-- This column stores the ID of the admin user who created the maintenance record
-- References admin_users.id (UUID)

-- Add created_by column to maintenance if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'maintenance' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE maintenance 
        ADD COLUMN created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL;
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_maintenance_created_by ON maintenance(created_by);
    END IF;
END $$;
