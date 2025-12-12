-- ==========================================
-- Script to Verify and Fix Tables Structure
-- ==========================================
-- This script verifies that all tables exist and have correct structure
-- Run this in Supabase SQL Editor to check everything

-- ==========================================
-- 1. VERIFY TABLES EXIST
-- ==========================================
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'products',
    'customers',
    'cash_invoices',
    'cash_invoice_details',
    'image_cache',
    'crm_activities',
    'online_orders',
    'online_order_details'
  )
ORDER BY table_name;

-- ==========================================
-- 2. VERIFY COLUMN TYPES
-- ==========================================
-- Check online_orders.order_id type (should be TEXT, not UUID)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'online_orders' 
  AND column_name = 'order_id';

-- Check online_order_details.order_id type (should be TEXT, not UUID)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'online_order_details' 
  AND column_name = 'order_id';

-- ==========================================
-- 3. VERIFY FOREIGN KEYS
-- ==========================================
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND (tc.table_name = 'online_orders' OR tc.table_name = 'online_order_details')
ORDER BY tc.table_name, kcu.column_name;

-- ==========================================
-- 4. FIX MISSING FOREIGN KEY (if needed)
-- ==========================================
-- If the foreign key is missing, run this:
DO $$
BEGIN
  -- Check if foreign key exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'online_order_details_order_id_fkey'
    AND table_name = 'online_order_details'
  ) THEN
    -- Add foreign key
    ALTER TABLE online_order_details 
    ADD CONSTRAINT online_order_details_order_id_fkey 
    FOREIGN KEY (order_id) 
    REFERENCES online_orders(order_id) 
    ON DELETE CASCADE;
    
    RAISE NOTICE 'Foreign key added successfully';
  ELSE
    RAISE NOTICE 'Foreign key already exists';
  END IF;
END $$;

-- ==========================================
-- 5. VERIFY TRIGGERS
-- ==========================================
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('online_orders', 'online_order_details')
ORDER BY event_object_table, trigger_name;

-- ==========================================
-- 6. FIX MISSING TRIGGERS (if needed)
-- ==========================================
-- Ensure the function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for online_orders if missing
DROP TRIGGER IF EXISTS update_online_orders_updated_at ON online_orders;
CREATE TRIGGER update_online_orders_updated_at 
  BEFORE UPDATE ON online_orders
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add trigger for online_order_details if missing
DROP TRIGGER IF EXISTS update_online_order_details_updated_at ON online_order_details;
CREATE TRIGGER update_online_order_details_updated_at 
  BEFORE UPDATE ON online_order_details
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 7. VERIFY INDEXES
-- ==========================================
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('online_orders', 'online_order_details')
ORDER BY tablename, indexname;

-- ==========================================
-- 8. FIX MISSING INDEXES (if needed)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_created_at ON online_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer_phone ON online_orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_online_order_details_order_id ON online_order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_online_order_details_product_id ON online_order_details(product_id);

-- ==========================================
-- 9. TEST DATA QUERY
-- ==========================================
-- Check if there are any orders
SELECT COUNT(*) as total_orders FROM online_orders;

-- Check if there are any order details
SELECT COUNT(*) as total_order_details FROM online_order_details;

-- Check a sample order with its details
SELECT 
  o.order_id,
  o.customer_name,
  o.customer_phone,
  o.total_amount,
  COUNT(d.detail_id) as item_count
FROM online_orders o
LEFT JOIN online_order_details d ON o.order_id = d.order_id
GROUP BY o.order_id, o.customer_name, o.customer_phone, o.total_amount
ORDER BY o.created_at DESC
LIMIT 5;

