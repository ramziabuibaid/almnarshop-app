# Supabase Migration Guide

This guide explains how to migrate your database from Google Sheets to Supabase (PostgreSQL).

## 📋 Prerequisites

1. **Supabase Account**: Sign up at [supabase.com](https://supabase.com)
2. **Project Created**: Create a new Supabase project
3. **SQL Editor Access**: You need access to the SQL Editor in your Supabase dashboard

## 🚀 Step-by-Step Migration

### Step 1: Open Supabase SQL Editor

1. Log in to your Supabase dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Schema SQL

1. Open the file `supabase_schema.sql` in this repository
2. Copy the entire contents
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press `Ctrl+Enter` / `Cmd+Enter`)

### Step 3: Verify Tables Created

After running the SQL, verify that all tables were created:

1. Go to **Table Editor** in the left sidebar
2. You should see these tables:
   - `products`
   - `customers`
   - `cash_invoices`
   - `cash_invoice_details`
   - `crm_activities`

### Step 4: Check Indexes

1. In the SQL Editor, run this query to verify indexes:

```sql
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('products', 'customers', 'cash_invoices', 'cash_invoice_details', 'crm_activities')
ORDER BY tablename, indexname;
```

## 📊 Table Structure Summary

### 1. **products**
- **Primary Key**: `product_id` (TEXT)
- **Searchable Fields**: `shamel_no`, `barcode`, `name`, `type`, `brand`
- **Key Features**: Full-text search index on name/brand/type

### 2. **customers**
- **Primary Key**: `customer_id` (TEXT)
- **Searchable Fields**: `email`, `phone`, `name`
- **Key Features**: Full-text search index on name/email/phone

### 3. **cash_invoices**
- **Primary Key**: `invoice_id` (TEXT)
- **Foreign Keys**: None
- **Key Features**: Tracks cash POS invoices with notes and discount

### 4. **cash_invoice_details**
- **Primary Key**: `detail_id` (UUID, auto-generated)
- **Foreign Keys**: 
  - `invoice_id` → `cash_invoices(invoice_id)`
  - `product_id` → `products(product_id)`
- **Key Features**: Line items for each invoice

### 5. **crm_activities**
- **Primary Key**: `activity_id` (TEXT)
- **Foreign Keys**: `customer_id` → `customers(customer_id)`
- **Key Features**: Tracks CRM interactions and PTP (Promise to Pay)

## 🔍 Indexes Created

The schema includes indexes for fast searching on:

- **Products**: `shamel_no`, `barcode`, `name`, `type`, `brand`, full-text search
- **Customers**: `email`, `phone`, `name`, `type`, full-text search
- **Invoices**: `date_time`, `status`
- **Invoice Details**: `invoice_id`, `product_id`, `scanned_barcode`
- **CRM Activities**: `customer_id`, `created_at`, `promise_date`, `ptp_status`, `action_type`

## 🔄 Automatic Timestamps

All tables have:
- `created_at`: Automatically set when a row is created
- `updated_at`: Automatically updated when a row is modified (via trigger)

## 🔐 Row Level Security (RLS)

RLS is **disabled by default**. If you want to enable it:

1. Uncomment the RLS sections in the SQL file
2. Create appropriate policies based on your authentication requirements
3. Re-run the SQL

## 📝 Next Steps

After creating the schema:

1. **Migrate Data**: Export data from Google Sheets and import into Supabase
2. **Update API**: Update your backend code to use Supabase client instead of Google Sheets API
3. **Test**: Verify all CRUD operations work correctly
4. **Deploy**: Deploy your updated application

## 🛠️ Useful Supabase SQL Queries

### Check table row counts:
```sql
SELECT 
  'products' as table_name, COUNT(*) as row_count FROM products
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'cash_invoices', COUNT(*) FROM cash_invoices
UNION ALL
SELECT 'cash_invoice_details', COUNT(*) FROM cash_invoice_details
UNION ALL
SELECT 'crm_activities', COUNT(*) FROM crm_activities;
```

### View all foreign key relationships:
```sql
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';
```

## ⚠️ Important Notes

1. **Primary Keys**: 
   - `products.product_id` and `customers.customer_id` use TEXT (matching your current IDs)
   - `cash_invoices.invoice_id` uses TEXT (format: "Cash-0000-XXX")
   - `cash_invoice_details.detail_id` uses UUID (auto-generated)
   - `crm_activities.activity_id` uses TEXT (format: "ACT-...")

2. **Data Types**:
   - All prices and quantities use `NUMERIC(10, 2)` for precision
   - Dates use `TIMESTAMP WITH TIME ZONE` for proper timezone handling
   - Text fields use `TEXT` (unlimited length)

3. **Cascade Behavior**:
   - Deleting an invoice will automatically delete its details (CASCADE)
   - Deleting a product will prevent deletion if it's referenced in invoices (RESTRICT)
   - Deleting a customer will delete their CRM activities (CASCADE)

## 🆘 Troubleshooting

### Error: "relation already exists"
- The table already exists. Drop it first or use `CREATE TABLE IF NOT EXISTS` (already included)

### Error: "permission denied"
- Make sure you're running the SQL as a project owner/admin
- Check your Supabase project permissions

### Error: "function does not exist"
- Make sure you run the entire SQL file, including the trigger function definition

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Supabase SQL Editor Guide](https://supabase.com/docs/guides/database/overview)

