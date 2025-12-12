-- ==========================================
-- Migration Script: Change online_orders.order_id from UUID to TEXT
-- ==========================================
-- This script migrates the online_orders table to use TEXT for order_id
-- instead of UUID, to support the format: Online-XXXX-YYY
--
-- IMPORTANT: Backup your data before running this script!
-- ==========================================

-- Step 1: Drop foreign key constraint from online_order_details
ALTER TABLE online_order_details 
  DROP CONSTRAINT IF EXISTS online_order_details_order_id_fkey;

-- Step 2: Convert order_id in online_orders from UUID to TEXT
-- Note: This will convert existing UUIDs to text format
-- If you want to keep existing orders, they will be converted to text UUIDs
-- If you want to start fresh, delete existing orders first:
-- DELETE FROM online_order_details;
-- DELETE FROM online_orders;
ALTER TABLE online_orders 
  ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT;

-- Step 3: Convert order_id in online_order_details from UUID to TEXT
ALTER TABLE online_order_details 
  ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT;

-- Step 4: Re-add foreign key constraint
ALTER TABLE online_order_details 
  ADD CONSTRAINT online_order_details_order_id_fkey 
  FOREIGN KEY (order_id) 
  REFERENCES online_orders(order_id) 
  ON DELETE CASCADE;

-- Verification: Check the table structure
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'online_orders' AND column_name = 'order_id';
-- 
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'online_order_details' AND column_name = 'order_id';

