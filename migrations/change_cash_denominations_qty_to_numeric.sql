-- Migration: Change cash_denominations.qty from INTEGER to NUMERIC
-- This allows decimal values like 4.6 or 4.684

-- Step 1: Alter the column type to NUMERIC
ALTER TABLE cash_denominations 
  ALTER COLUMN qty TYPE NUMERIC(10, 3) USING qty::NUMERIC(10, 3);

-- Step 2: Update the default value if needed (optional, but good practice)
ALTER TABLE cash_denominations 
  ALTER COLUMN qty SET DEFAULT 0;

-- Add comment to document the change
COMMENT ON COLUMN cash_denominations.qty IS 'Quantity can be a decimal number (e.g., 4.6, 4.684)';

