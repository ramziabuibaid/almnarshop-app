-- ==========================================
-- Migration: Receipt Invoice Allocations
-- لدعم سداد أكثر من فاتورة بنفس السند (محل أو مخزن)
-- ==========================================

-- 1. إنشاء الجدول الوسيط للربط المحاسبي (Multi-Invoice Payment Allocation)
CREATE TABLE IF NOT EXISTS receipt_invoice_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('shop', 'warehouse')),
  invoice_id TEXT NOT NULL,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('shop', 'warehouse')),
  allocated_amount NUMERIC(10,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Indexes لتسريع عمليات البحث والمطابقة
CREATE INDEX IF NOT EXISTS idx_receipt_allocations_receipt 
  ON receipt_invoice_allocations(receipt_id, receipt_type);

CREATE INDEX IF NOT EXISTS idx_receipt_allocations_invoice 
  ON receipt_invoice_allocations(invoice_id, invoice_type);

-- 2. إدراج البيانات التاريخية من أعمدة linked_invoice_id قبل إلغائها (اختياري، لحفظ التاريخ)
-- بالنسبة للمحل
INSERT INTO receipt_invoice_allocations (receipt_id, receipt_type, invoice_id, invoice_type, allocated_amount)
SELECT 
  receipt_id, 
  'shop' AS receipt_type, 
  linked_invoice_id, 
  linked_invoice_type,
  -- الافتراض أن السند ارتبط بكامل مبلغه
  (COALESCE(cash_amount, 0) + COALESCE(cheque_amount, 0)) AS allocated_amount
FROM shop_receipts
WHERE linked_invoice_id IS NOT NULL;

-- بالنسبة للمخزن
INSERT INTO receipt_invoice_allocations (receipt_id, receipt_type, invoice_id, invoice_type, allocated_amount)
SELECT 
  receipt_id, 
  'warehouse' AS receipt_type, 
  linked_invoice_id, 
  linked_invoice_type,
  -- الافتراض أن السند ارتبط بكامل مبلغه
  (COALESCE(cash_amount, 0) + COALESCE(check_amount, 0)) AS allocated_amount
FROM warehouse_receipts
WHERE linked_invoice_id IS NOT NULL;
