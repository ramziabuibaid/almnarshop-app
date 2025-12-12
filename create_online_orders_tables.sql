-- ==========================================
-- إنشاء جداول الطلبيات الأون لاين
-- Online Orders Tables Creation Script
-- ==========================================
-- هذا السكريبت ينشئ جداول الطلبيات الأون لاين مع نظام الترقيم: Online-XXXX-YYY
-- This script creates online orders tables with numbering format: Online-XXXX-YYY
-- ==========================================

-- ==========================================
-- 1. ONLINE_ORDERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS online_orders (
  order_id TEXT PRIMARY KEY,
  
  -- Customer Info (for guest orders)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  
  -- Order Info
  status TEXT DEFAULT 'Pending', -- Pending, Processing, Completed, Cancelled
  notes TEXT,
  total_amount NUMERIC(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for online_orders
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_created_at ON online_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer_phone ON online_orders(customer_phone);

-- ==========================================
-- 2. ONLINE_ORDER_DETAILS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS online_order_details (
  detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES online_orders(order_id) ON DELETE CASCADE,
  
  -- Product Info
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  
  -- Quantity & Pricing
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for online_order_details
CREATE INDEX IF NOT EXISTS idx_online_order_details_order_id ON online_order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_online_order_details_product_id ON online_order_details(product_id);

-- ==========================================
-- 3. TRIGGERS FOR UPDATED_AT
-- ==========================================
-- Ensure the function exists (if not already created)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for online_orders updated_at
DROP TRIGGER IF EXISTS update_online_orders_updated_at ON online_orders;
CREATE TRIGGER update_online_orders_updated_at 
  BEFORE UPDATE ON online_orders
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for online_order_details updated_at
DROP TRIGGER IF EXISTS update_online_order_details_updated_at ON online_order_details;
CREATE TRIGGER update_online_order_details_updated_at 
  BEFORE UPDATE ON online_order_details
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 4. COMMENTS (Documentation)
-- ==========================================
COMMENT ON TABLE online_orders IS 'Online orders from guest customers (no login required). Order IDs format: Online-XXXX-YYY';
COMMENT ON TABLE online_order_details IS 'Line items for online orders';

-- ==========================================
-- ملاحظات مهمة / Important Notes:
-- ==========================================
-- 1. order_id في online_orders من نوع TEXT (ليس UUID)
--    Order IDs will be generated in format: Online-0001-234, Online-0002-567, etc.
--
-- 2. order_id في online_order_details من نوع TEXT (ليس UUID)
--    This allows foreign key relationship with online_orders
--
-- 3. نظام الترقيم: Online-XXXX-YYY
--    - XXXX: رقم متسلسل (4 أرقام مع padding)
--    - YYY: رقم عشوائي من 3 أرقام (100-999)
--    Example: Online-0001-234, Online-0002-567
--
-- 4. الترقيم يتم توليده تلقائياً في الكود (lib/api.ts)
--    The numbering is generated automatically in the code (lib/api.ts)

