-- ==========================================
-- Migration: Add is_visible to products
-- ==========================================
-- Control visibility of products in the online store
-- Hidden products: visible in admin, hidden from store
-- Run this migration in your Supabase SQL editor

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT TRUE;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_is_visible ON products(is_visible);

COMMENT ON COLUMN products.is_visible IS 'If true, product is shown in the online store. If false, hidden from store but still visible in admin.';
