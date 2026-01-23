-- ==========================================
-- Supabase PostgreSQL Schema
-- Migration from Google Sheets to Supabase
-- ==========================================

-- ==========================================
-- 1. PRODUCTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  shamel_no TEXT,
  barcode TEXT,
  
  -- Basic Info
  name TEXT,
  type TEXT,
  brand TEXT,
  origin TEXT,
  warranty TEXT,
  
  -- Specs
  size TEXT,
  color TEXT,
  dimention TEXT,
  
  -- Stock
  cs_war NUMERIC(10, 2) DEFAULT 0, -- Warehouse Quantity
  cs_shop NUMERIC(10, 2) DEFAULT 0, -- Shop Quantity
  
  -- Pricing
  cost_price NUMERIC(10, 2) DEFAULT 0,
  sale_price NUMERIC(10, 2) DEFAULT 0,
  t1_price NUMERIC(10, 2) DEFAULT 0,
  t2_price NUMERIC(10, 2) DEFAULT 0,
  
  -- Images
  image TEXT,
  image_2 TEXT,
  image_3 TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for products (for fast searching)
CREATE INDEX IF NOT EXISTS idx_products_shamel_no ON products(shamel_no);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(type);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(brand, '') || ' ' || coalesce(type, '') || ' ' || coalesce(product_id, '')));

-- ==========================================
-- 2. CUSTOMERS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  
  -- Basic Info
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type TEXT, -- Customer, Merchant, Supplier, Accounting
  balance NUMERIC(10, 2) DEFAULT 0,
  address TEXT,
  photo TEXT,
  shamel_no TEXT, -- رقم الزبون في الشامل
  postal_code TEXT, -- الرمز البريدي
  last_pay_date DATE, -- تاريخ آخر دفعة
  last_inv_date DATE, -- تاريخ آخر فاتورة
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for customers
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);
CREATE INDEX IF NOT EXISTS idx_customers_search ON customers USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')));

-- ==========================================
-- 3. CHECKS TABLE (الشيكات الراجعة)
-- ==========================================
CREATE TABLE IF NOT EXISTS checks (
  check_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  image_front TEXT,
  image_back TEXT,
  return_date DATE,
  status TEXT CHECK (status IN ('مع الشركة','في البنك','في المحل','في المخزن','سلم للزبون ولم يدفع','سلم للزبون وتم تسديد القيمة')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checks_customer_id ON checks(customer_id);
CREATE INDEX IF NOT EXISTS idx_checks_status ON checks(status);

-- ==========================================
-- 4. CASH_INVOICES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS cash_invoices (
  invoice_id TEXT PRIMARY KEY,
  date_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'Finalized',
  notes TEXT,
  discount NUMERIC(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for cash_invoices
CREATE INDEX IF NOT EXISTS idx_cash_invoices_date_time ON cash_invoices(date_time);
CREATE INDEX IF NOT EXISTS idx_cash_invoices_status ON cash_invoices(status);

-- ==========================================
-- 4. CASH_INVOICE_DETAILS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS cash_invoice_details (
  detail_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES cash_invoices(invoice_id) ON DELETE CASCADE,
  
  -- Product Info
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  mode TEXT DEFAULT 'Pick', -- 'Pick' or 'Scan'
  scanned_barcode TEXT,
  
  -- Filter Info (for product selection)
  filter_type TEXT,
  filter_brand TEXT,
  filter_size TEXT,
  filter_color TEXT,
  
  -- Quantity & Pricing
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for cash_invoice_details
CREATE INDEX IF NOT EXISTS idx_cash_invoice_details_invoice_id ON cash_invoice_details(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cash_invoice_details_product_id ON cash_invoice_details(product_id);
CREATE INDEX IF NOT EXISTS idx_cash_invoice_details_scanned_barcode ON cash_invoice_details(scanned_barcode);

-- ==========================================
-- 5. IMAGE_CACHE TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS image_cache (
  file_name TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for image_cache
CREATE INDEX IF NOT EXISTS idx_image_cache_file_name ON image_cache(file_name);
CREATE INDEX IF NOT EXISTS idx_image_cache_file_id ON image_cache(file_id);

-- ==========================================
-- 6. CRM_ACTIVITIES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS crm_activities (
  activity_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  
  -- Activity Info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  action_type TEXT DEFAULT 'Call', -- Call, Visit, Message, etc.
  outcome TEXT, -- Answered, No Answer, Busy, etc.
  
  -- Promise to Pay (PTP)
  promise_date DATE,
  promise_amount NUMERIC(10, 2) DEFAULT 0,
  ptp_status TEXT DEFAULT 'Closed', -- 'Active' or 'Closed'
  
  -- Additional Info
  notes TEXT,
  created_by TEXT DEFAULT 'Admin',
  
  -- Timestamps
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for crm_activities
CREATE INDEX IF NOT EXISTS idx_crm_activities_customer_id ON crm_activities(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at ON crm_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_activities_promise_date ON crm_activities(promise_date);
CREATE INDEX IF NOT EXISTS idx_crm_activities_ptp_status ON crm_activities(ptp_status);
CREATE INDEX IF NOT EXISTS idx_crm_activities_action_type ON crm_activities(action_type);

-- ==========================================
-- 6. TRIGGERS FOR UPDATED_AT
-- ==========================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables (drop existing triggers first to avoid errors)
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_invoices_updated_at ON cash_invoices;
CREATE TRIGGER update_cash_invoices_updated_at BEFORE UPDATE ON cash_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cash_invoice_details_updated_at ON cash_invoice_details;
CREATE TRIGGER update_cash_invoice_details_updated_at BEFORE UPDATE ON cash_invoice_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_crm_activities_updated_at ON crm_activities;
CREATE TRIGGER update_crm_activities_updated_at BEFORE UPDATE ON crm_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_image_cache_updated_at ON image_cache;
CREATE TRIGGER update_image_cache_updated_at BEFORE UPDATE ON image_cache
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_online_orders_updated_at ON online_orders;
CREATE TRIGGER update_online_orders_updated_at BEFORE UPDATE ON online_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_online_order_details_updated_at ON online_order_details;
CREATE TRIGGER update_online_order_details_updated_at BEFORE UPDATE ON online_order_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 8. SHOP_RECEIPTS TABLE (سندات قبض المحل)
-- ==========================================
CREATE TABLE IF NOT EXISTS shop_receipts (
  receipt_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  cash_amount NUMERIC(10, 2) DEFAULT 0,
  cheque_amount NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for shop_receipts
CREATE INDEX IF NOT EXISTS idx_shop_receipts_customer_id ON shop_receipts(customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_receipts_date ON shop_receipts(date);

-- Trigger for shop_receipts
DROP TRIGGER IF EXISTS update_shop_receipts_updated_at ON shop_receipts;
CREATE TRIGGER update_shop_receipts_updated_at BEFORE UPDATE ON shop_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 9. SHOP_PAYMENTS TABLE (سندات دفع المحل)
-- ==========================================
CREATE TABLE IF NOT EXISTS shop_payments (
  pay_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  cash_amount NUMERIC(10, 2) DEFAULT 0,
  cheque_amount NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for shop_payments
CREATE INDEX IF NOT EXISTS idx_shop_payments_customer_id ON shop_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_payments_date ON shop_payments(date);

-- Trigger for shop_payments
DROP TRIGGER IF EXISTS update_shop_payments_updated_at ON shop_payments;
CREATE TRIGGER update_shop_payments_updated_at BEFORE UPDATE ON shop_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 7. ROW LEVEL SECURITY (RLS) - Optional
-- ==========================================
-- Enable RLS if needed (uncomment if you want to use Supabase Auth)
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cash_invoices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cash_invoice_details ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE crm_activities ENABLE ROW LEVEL SECURITY;

-- Example policy (adjust based on your auth requirements):
-- CREATE POLICY "Allow all operations for authenticated users" ON products
--   FOR ALL USING (auth.role() = 'authenticated');

-- ==========================================
-- 8. COMMENTS (Documentation)
-- ==========================================
-- ==========================================
-- 7. ONLINE_ORDERS TABLE
-- ==========================================
-- Drop table if exists to recreate with TEXT order_id (if needed for migration)
-- WARNING: This will delete all existing data! Only run if you want to start fresh.
-- DROP TABLE IF EXISTS online_order_details;
-- DROP TABLE IF EXISTS online_orders;

CREATE TABLE IF NOT EXISTS online_orders (
  order_id TEXT PRIMARY KEY,
  
  -- Customer Info (for guest orders)
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  
  -- Order Info
  status TEXT DEFAULT 'Pending', -- Pending, Processing, Completed, Cancelled
  notes TEXT,
  discount NUMERIC(10, 2) DEFAULT 0,
  total_amount NUMERIC(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration script: If table already exists with UUID, run these commands:
-- ALTER TABLE online_order_details DROP CONSTRAINT IF EXISTS online_order_details_order_id_fkey;
-- ALTER TABLE online_orders ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT;
-- ALTER TABLE online_order_details ALTER COLUMN order_id TYPE TEXT USING order_id::TEXT;
-- ALTER TABLE online_order_details ADD CONSTRAINT online_order_details_order_id_fkey 
--   FOREIGN KEY (order_id) REFERENCES online_orders(order_id) ON DELETE CASCADE;

-- Indexes for online_orders
CREATE INDEX IF NOT EXISTS idx_online_orders_status ON online_orders(status);
CREATE INDEX IF NOT EXISTS idx_online_orders_created_at ON online_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_online_orders_customer_phone ON online_orders(customer_phone);

-- ==========================================
-- 8. ONLINE_ORDER_DETAILS TABLE
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

-- Trigger for online_orders updated_at
DROP TRIGGER IF EXISTS update_online_orders_updated_at ON online_orders;
CREATE TRIGGER update_online_orders_updated_at BEFORE UPDATE ON online_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for online_order_details updated_at
DROP TRIGGER IF EXISTS update_online_order_details_updated_at ON online_order_details;
CREATE TRIGGER update_online_order_details_updated_at BEFORE UPDATE ON online_order_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE products IS 'Product catalog with inventory and pricing';
COMMENT ON TABLE customers IS 'Customer information and account balances';
COMMENT ON TABLE cash_invoices IS 'Cash POS invoices';
COMMENT ON TABLE cash_invoice_details IS 'Line items for cash invoices';
COMMENT ON TABLE crm_activities IS 'CRM interactions and follow-ups';
COMMENT ON TABLE image_cache IS 'Google Drive image cache: maps file names to file IDs for direct image URLs';
COMMENT ON TABLE online_orders IS 'Online orders from guest customers (no login required)';
COMMENT ON TABLE online_order_details IS 'Line items for online orders';
COMMENT ON TABLE shop_receipts IS 'Shop receipts (سندات قبض المحل) - Customer payment receipts';
COMMENT ON TABLE shop_payments IS 'Shop payments (سندات دفع المحل) - Customer payment vouchers';

-- ==========================================
-- 10. SHOP_SALES_INVOICES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS shop_sales_invoices (
  invoice_id TEXT PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  accountant_sign TEXT DEFAULT 'غير مرحلة' CHECK (accountant_sign IN ('مرحلة', 'غير مرحلة')),
  notes TEXT,
  discount NUMERIC(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'غير مدفوع' CHECK (status IN ('غير مدفوع', 'تقسيط شهري', 'دفعت بالكامل', 'مدفوع جزئي')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_sales_invoices_customer_id ON shop_sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_shop_sales_invoices_date ON shop_sales_invoices(date);
CREATE INDEX IF NOT EXISTS idx_shop_sales_invoices_status ON shop_sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_shop_sales_invoices_accountant_sign ON shop_sales_invoices(accountant_sign);

DROP TRIGGER IF EXISTS update_shop_sales_invoices_updated_at ON shop_sales_invoices;
CREATE TRIGGER update_shop_sales_invoices_updated_at BEFORE UPDATE ON shop_sales_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 11. SHOP_SALES_DETAILS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS shop_sales_details (
  details_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES shop_sales_invoices(invoice_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shop_sales_details_invoice_id ON shop_sales_details(invoice_id);
CREATE INDEX IF NOT EXISTS idx_shop_sales_details_product_id ON shop_sales_details(product_id);

DROP TRIGGER IF EXISTS update_shop_sales_details_updated_at ON shop_sales_details;
CREATE TRIGGER update_shop_sales_details_updated_at BEFORE UPDATE ON shop_sales_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 12. WAREHOUSE_SALES_INVOICES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS warehouse_sales_invoices (
  invoice_id TEXT PRIMARY KEY,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  accountant_sign TEXT DEFAULT 'غير مرحلة' CHECK (accountant_sign IN ('مرحلة', 'غير مرحلة')),
  notes TEXT,
  discount NUMERIC(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'غير مدفوع' CHECK (status IN ('غير مدفوع', 'تقسيط شهري', 'دفعت بالكامل', 'مدفوع جزئي')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_sales_invoices_customer_id ON warehouse_sales_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_sales_invoices_date ON warehouse_sales_invoices(date);
CREATE INDEX IF NOT EXISTS idx_warehouse_sales_invoices_status ON warehouse_sales_invoices(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_sales_invoices_accountant_sign ON warehouse_sales_invoices(accountant_sign);

DROP TRIGGER IF EXISTS update_warehouse_sales_invoices_updated_at ON warehouse_sales_invoices;
CREATE TRIGGER update_warehouse_sales_invoices_updated_at BEFORE UPDATE ON warehouse_sales_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 13. WAREHOUSE_SALES_DETAILS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS warehouse_sales_details (
  details_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id TEXT NOT NULL REFERENCES warehouse_sales_invoices(invoice_id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warehouse_sales_details_invoice_id ON warehouse_sales_details(invoice_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_sales_details_product_id ON warehouse_sales_details(product_id);

DROP TRIGGER IF EXISTS update_warehouse_sales_details_updated_at ON warehouse_sales_details;
CREATE TRIGGER update_warehouse_sales_details_updated_at BEFORE UPDATE ON warehouse_sales_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE shop_sales_invoices IS 'Shop sales invoices (فواتير مبيعات المحل)';
COMMENT ON TABLE shop_sales_details IS 'Line items for shop sales invoices';
COMMENT ON TABLE warehouse_sales_invoices IS 'Warehouse sales invoices (فواتير مبيعات المخزن)';
COMMENT ON TABLE warehouse_sales_details IS 'Line items for warehouse sales invoices';

-- ==========================================
-- 14. MAINTENANCE TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS maintenance (
  maint_no TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  location TEXT CHECK (location IN ('المحل', 'المخزن')),
  company TEXT CHECK (company IN (
    'ADC',
    'ضبان',
    'مسلماني',
    'الادم',
    'ستلايت المنار',
    'ترست',
    'حسام الشريف',
    'الحاج صبحي',
    'ميجا',
    'برستيج',
    'سبيتاني',
    'المنار للاجهزة الكهربائية',
    'عمار الاغبر',
    'حلاوة نابلس',
    'JR',
    'شركة يافا',
    'هوم بلس'
  )),
  date_of_purchase DATE,
  date_of_receive DATE NOT NULL,
  problem TEXT,
  image_of_item TEXT,
  image_of_problem TEXT,
  image_of_warranty TEXT,
  status TEXT NOT NULL DEFAULT 'موجودة في المحل وجاهزة للتسليم' CHECK (status IN (
    'موجودة في المحل وجاهزة للتسليم',
    'موجودة في المخزن وجاهزة للتسليم',
    'موجودة في الشركة',
    'جاهزة للتسليم للزبون من المحل',
    'جاهزة للتسليم للزبون من المخزن',
    'سلمت للزبون',
    'تم ارجاعها للشركة وخصمها للزبون'
  )),
  serial_no TEXT,
  under_warranty TEXT DEFAULT 'NO' CHECK (under_warranty IN ('YES', 'NO')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_customer_id ON maintenance(customer_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_location ON maintenance(location);
CREATE INDEX IF NOT EXISTS idx_maintenance_date_of_receive ON maintenance(date_of_receive);

DROP TRIGGER IF EXISTS update_maintenance_updated_at ON maintenance;
CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE maintenance IS 'Maintenance records (سجلات الصيانة)';

-- ==========================================
-- 15. CASH_SESSIONS TABLE (جلسات الصندوق اليومي)
-- ==========================================
CREATE TABLE IF NOT EXISTS cash_sessions (
  cash_session_id TEXT PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_float NUMERIC(10, 2) DEFAULT 0,
  closing_float_target NUMERIC(10, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_date ON cash_sessions(date);

DROP TRIGGER IF EXISTS update_cash_sessions_updated_at ON cash_sessions;
CREATE TRIGGER update_cash_sessions_updated_at BEFORE UPDATE ON cash_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE cash_sessions IS 'Daily cash register sessions (جلسات الصندوق اليومي)';

-- ==========================================
-- 16. CASH_DENOMINATIONS TABLE (عد الفئات النقدية)
-- ==========================================
CREATE TABLE IF NOT EXISTS cash_denominations (
  denom_id TEXT PRIMARY KEY,
  cash_session_id TEXT NOT NULL REFERENCES cash_sessions(cash_session_id) ON DELETE CASCADE,
  currency TEXT NOT NULL CHECK (currency IN ('شيكل', 'دينار أردني', 'دولار', 'يورو')),
  denomination NUMERIC(10, 2) NOT NULL,
  qty NUMERIC(10, 3) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_denominations_session_id ON cash_denominations(cash_session_id);
CREATE INDEX IF NOT EXISTS idx_cash_denominations_currency ON cash_denominations(currency);

DROP TRIGGER IF EXISTS update_cash_denominations_updated_at ON cash_denominations;
CREATE TRIGGER update_cash_denominations_updated_at BEFORE UPDATE ON cash_denominations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE cash_denominations IS 'Cash denominations count (عد الفئات النقدية)';

-- ==========================================
-- 17. ADMIN_USERS TABLE (حسابات المسئولين مع صلاحيات مفصلة)
-- ==========================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_super_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE admin_users IS 'Login accounts for administrators with per-feature permissions';
COMMENT ON COLUMN admin_users.permissions IS 'JSON object of per-feature permissions (boolean flags)';

-- ==========================================
-- QUOTATIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS quotations (
  quotation_id TEXT PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'مسودة',
  special_discount_amount NUMERIC(10, 2) DEFAULT 0,
  gift_discount_amount NUMERIC(10, 2) DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign key
  CONSTRAINT fk_quotations_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL
);

-- Indexes for quotations
CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_date ON quotations(date);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- ==========================================
-- QUOTATION_DETAILS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS quotation_details (
  quotation_detail_id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  is_gift BOOLEAN DEFAULT FALSE,
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Foreign keys
  CONSTRAINT fk_quotation_details_quotation FOREIGN KEY (quotation_id) REFERENCES quotations(quotation_id) ON DELETE CASCADE,
  CONSTRAINT fk_quotation_details_product FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- Indexes for quotation_details
CREATE INDEX IF NOT EXISTS idx_quotation_details_quotation_id ON quotation_details(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_details_product_id ON quotation_details(product_id);
CREATE INDEX IF NOT EXISTS idx_quotation_details_is_gift ON quotation_details(is_gift);

-- Trigger to update updated_at for quotations
DROP TRIGGER IF EXISTS update_quotations_updated_at ON quotations;
CREATE TRIGGER update_quotations_updated_at BEFORE UPDATE ON quotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at for quotation_details
DROP TRIGGER IF EXISTS update_quotation_details_updated_at ON quotation_details;
CREATE TRIGGER update_quotation_details_updated_at BEFORE UPDATE ON quotation_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

