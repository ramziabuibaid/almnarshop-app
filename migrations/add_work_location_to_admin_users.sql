-- Migration: Add work_location column to admin_users table
-- This column stores the work location of admin users (المحل or المخزن)
-- Default value is 'المحل' for existing users

-- Add work_location column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'admin_users' 
        AND column_name = 'work_location'
    ) THEN
        ALTER TABLE admin_users 
        ADD COLUMN work_location TEXT DEFAULT 'المحل' 
        CHECK (work_location IN ('المحل', 'المخزن'));
        
        -- Update existing users to have default value
        UPDATE admin_users 
        SET work_location = 'المحل' 
        WHERE work_location IS NULL;
    END IF;
END $$;

