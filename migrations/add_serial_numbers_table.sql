-- ==========================================
-- Migration: Create Serial Numbers Table
-- ==========================================
-- This migration creates a dedicated table for serial numbers
-- This is the professional approach used in enterprise systems
-- Run this migration AFTER add_serial_number_support.sql

-- Create serial_numbers table
CREATE TABLE IF NOT EXISTS serial_numbers (
  serial_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Serial number value
  serial_no TEXT NOT NULL,
  
  -- Product reference
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  
  -- Invoice reference (one of these will be set)
  cash_invoice_detail_id TEXT REFERENCES cash_invoice_details(detail_id) ON DELETE CASCADE,
  shop_sales_detail_id TEXT REFERENCES shop_sales_details(details_id) ON DELETE CASCADE,
  warehouse_sales_detail_id TEXT REFERENCES warehouse_sales_details(details_id) ON DELETE CASCADE,
  quotation_detail_id TEXT REFERENCES quotation_details(quotation_detail_id) ON DELETE CASCADE,
  
  -- Invoice info (for quick access)
  invoice_type TEXT CHECK (invoice_type IN ('cash', 'shop_sales', 'warehouse_sales', 'quotation')),
  invoice_id TEXT,
  
  -- Customer info (if applicable)
  customer_id TEXT REFERENCES customers(customer_id) ON DELETE SET NULL,
  
  -- Sale date
  sale_date DATE,
  
  -- Status
  status TEXT DEFAULT 'sold' CHECK (status IN ('sold', 'returned', 'warranty', 'damaged')),
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast searching
CREATE INDEX IF NOT EXISTS idx_serial_numbers_serial_no ON serial_numbers(serial_no);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_product_id ON serial_numbers(product_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_customer_id ON serial_numbers(customer_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_invoice_type ON serial_numbers(invoice_type);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_invoice_id ON serial_numbers(invoice_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_sale_date ON serial_numbers(sale_date);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status ON serial_numbers(status);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_serial_numbers_search ON serial_numbers(serial_no, product_id, invoice_type);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_serial_numbers_updated_at ON serial_numbers;
CREATE TRIGGER update_serial_numbers_updated_at BEFORE UPDATE ON serial_numbers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE serial_numbers IS 'Dedicated table for tracking serial numbers - professional approach';
COMMENT ON COLUMN serial_numbers.serial_no IS 'The actual serial number value';
COMMENT ON COLUMN serial_numbers.invoice_type IS 'Type of invoice: cash, shop_sales, warehouse_sales, or quotation';
COMMENT ON COLUMN serial_numbers.status IS 'Status: sold, returned, warranty, or damaged';
