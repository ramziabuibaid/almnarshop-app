// Migration runner for invoice payment tracking
// Run: node run_invoice_migration.mjs

const SUPABASE_URL = 'https://wqnqgqstulgwmwzrfisw.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxbnFncXN0dWxnd213enJmaXN3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDUyNDYxOSwiZXhwIjoyMDgwMTAwNjE5fQ.NmqTIsF-rMGMcGzE_mnaRi_JJZOPFR1DRNRro09jayQ';

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({ sql_query: sql })
  });
  
  if (!res.ok) {
    const text = await res.text();
    // If function doesn't exist, use the direct approach
    if (text.includes('function') || text.includes('exec_sql')) {
      return { ok: false, error: 'exec_sql not available, use direct approach' };
    }
    return { ok: false, error: text };
  }
  return { ok: true };
}

// Alternative: use pg connection string approach via Supabase Management API
async function runMigrationViaManagementAPI() {
  const projectRef = 'wqnqgqstulgwmwzrfisw';
  
  const statements = [
    // 1. shop_sales_invoices
    `ALTER TABLE shop_sales_invoices DROP CONSTRAINT IF EXISTS shop_sales_invoices_status_check`,
    `ALTER TABLE shop_sales_invoices ADD CONSTRAINT shop_sales_invoices_status_check CHECK (status IN ('غير مدفوع', 'مجدول بكمبيالة', 'دفعت بالكامل', 'مدفوع جزئي'))`,
    `UPDATE shop_sales_invoices SET status = 'مجدول بكمبيالة' WHERE status = 'تقسيط شهري'`,
    
    // 2. warehouse_sales_invoices
    `ALTER TABLE warehouse_sales_invoices DROP CONSTRAINT IF EXISTS warehouse_sales_invoices_status_check`,
    `ALTER TABLE warehouse_sales_invoices ADD CONSTRAINT warehouse_sales_invoices_status_check CHECK (status IN ('غير مدفوع', 'مجدول بكمبيالة', 'دفعت بالكامل', 'مدفوع جزئي'))`,
    `UPDATE warehouse_sales_invoices SET status = 'مجدول بكمبيالة' WHERE status = 'تقسيط شهري'`,
    
    // 3. shop_receipts new columns
    `ALTER TABLE shop_receipts ADD COLUMN IF NOT EXISTS linked_invoice_id TEXT`,
    `ALTER TABLE shop_receipts ADD COLUMN IF NOT EXISTS linked_invoice_type TEXT`,
    `ALTER TABLE shop_receipts ADD COLUMN IF NOT EXISTS linked_installment_id UUID`,
    
    // 4. warehouse_receipts new columns
    `ALTER TABLE warehouse_receipts ADD COLUMN IF NOT EXISTS linked_invoice_id TEXT`,
    `ALTER TABLE warehouse_receipts ADD COLUMN IF NOT EXISTS linked_invoice_type TEXT`,
    `ALTER TABLE warehouse_receipts ADD COLUMN IF NOT EXISTS linked_installment_id UUID`,
    
    // 5. promissory_notes invoice link
    `ALTER TABLE promissory_notes ADD COLUMN IF NOT EXISTS linked_invoice_id TEXT`,
    `ALTER TABLE promissory_notes ADD COLUMN IF NOT EXISTS linked_invoice_type TEXT`,
    
    // 6. installments partial payment tracking
    `ALTER TABLE promissory_note_installments ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0`,
    
    // 7. Indexes
    `CREATE INDEX IF NOT EXISTS idx_shop_receipts_linked_invoice ON shop_receipts(linked_invoice_id, linked_invoice_type)`,
    `CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_linked_invoice ON warehouse_receipts(linked_invoice_id, linked_invoice_type)`,
    `CREATE INDEX IF NOT EXISTS idx_promissory_notes_linked_invoice ON promissory_notes(linked_invoice_id, linked_invoice_type)`,
  ];

  console.log(`\n🚀 Running ${statements.length} SQL statements...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const sql of statements) {
    const result = await runSQL(sql);
    if (result.ok) {
      console.log(`✅ ${sql.substring(0, 70)}...`);
      success++;
    } else {
      // If exec_sql not available, try batch approach
      console.log(`⚠️  exec_sql not available. Please run manually via Supabase Dashboard SQL Editor.`);
      console.log(`   SQL: ${sql}\n`);
      failed++;
    }
  }
  
  console.log(`\n✅ ${success} succeeded, ❌ ${failed} need manual execution`);
}

runMigrationViaManagementAPI().catch(console.error);
