-- Migration script to add new fields to customers table
-- Run this script in Supabase SQL Editor if the table already exists

-- Add shamel_no column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'shamel_no'
  ) THEN
    ALTER TABLE customers ADD COLUMN shamel_no TEXT;
  END IF;
END $$;

-- Add postal_code column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'postal_code'
  ) THEN
    ALTER TABLE customers ADD COLUMN postal_code TEXT;
  END IF;
END $$;

-- Add last_pay_date column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'last_pay_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_pay_date DATE;
  END IF;
END $$;

-- Add last_inv_date column (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'customers' AND column_name = 'last_inv_date'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_inv_date DATE;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN customers.shamel_no IS 'رقم الزبون في الشامل';
COMMENT ON COLUMN customers.postal_code IS 'الرمز البريدي';
COMMENT ON COLUMN customers.last_pay_date IS 'تاريخ آخر دفعة';
COMMENT ON COLUMN customers.last_inv_date IS 'تاريخ آخر فاتورة';

