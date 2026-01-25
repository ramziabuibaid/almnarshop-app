-- ==========================================
-- Migration: Add Serial Number Support
-- ==========================================
-- This migration adds support for serial numbers in products and invoices
-- Run this migration in your Supabase SQL editor

-- 1. Add is_serialized field to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_is_serialized ON products(is_serialized);

-- 2. Add serial_no field to cash_invoice_details (JSON array for multiple serials)
ALTER TABLE cash_invoice_details 
ADD COLUMN IF NOT EXISTS serial_no JSONB DEFAULT '[]'::jsonb;

-- Add index for serial number searches (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_cash_invoice_details_serial_no ON cash_invoice_details USING gin(serial_no);

-- 3. Add serial_no field to shop_sales_details (JSON array for multiple serials)
ALTER TABLE shop_sales_details 
ADD COLUMN IF NOT EXISTS serial_no JSONB DEFAULT '[]'::jsonb;

-- Add index for serial number searches (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_shop_sales_details_serial_no ON shop_sales_details USING gin(serial_no);

-- 4. Add serial_no field to warehouse_sales_details (JSON array for multiple serials)
ALTER TABLE warehouse_sales_details 
ADD COLUMN IF NOT EXISTS serial_no JSONB DEFAULT '[]'::jsonb;

-- Add index for serial number searches (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_warehouse_sales_details_serial_no ON warehouse_sales_details USING gin(serial_no);

-- 5. Add serial_no field to quotation_details (JSON array for multiple serials, optional)
ALTER TABLE quotation_details 
ADD COLUMN IF NOT EXISTS serial_no JSONB DEFAULT '[]'::jsonb;

-- Add index for serial number searches (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_quotation_details_serial_no ON quotation_details USING gin(serial_no);

-- Comments
COMMENT ON COLUMN products.is_serialized IS 'Indicates if the product requires a serial number';
COMMENT ON COLUMN cash_invoice_details.serial_no IS 'Array of serial numbers (JSONB) - one per item quantity';
COMMENT ON COLUMN shop_sales_details.serial_no IS 'Array of serial numbers (JSONB) - one per item quantity';
COMMENT ON COLUMN warehouse_sales_details.serial_no IS 'Array of serial numbers (JSONB) - one per item quantity';
COMMENT ON COLUMN quotation_details.serial_no IS 'Array of serial numbers (JSONB) - one per item quantity (optional)';
