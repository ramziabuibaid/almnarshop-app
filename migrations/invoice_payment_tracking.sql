-- ==========================================
-- Migration: Invoice Payment Tracking System
-- إدارة حالة الدفع للفواتير مع ربط سندات القبض والكمبيالات
-- ==========================================

-- =====================================================
-- 1. فواتير المحل - shop_sales_invoices
-- =====================================================

-- أولاً: إزالة القيد القديم
ALTER TABLE shop_sales_invoices
  DROP CONSTRAINT IF EXISTS shop_sales_invoices_status_check;

-- ثانياً: تحويل القيم القديمة قبل إضافة القيد الجديد
UPDATE shop_sales_invoices SET status = 'مجدول بكمبيالة' WHERE status = 'تقسيط شهري';

-- تحويل أي قيمة غير معروفة إلى 'غير مدفوع' (الفواتير القديمة الموجودة)
UPDATE shop_sales_invoices
  SET status = 'غير مدفوع'
  WHERE status NOT IN ('غير مدفوع', 'مجدول بكمبيالة', 'دفعت بالكامل', 'مدفوع جزئي')
     OR status IS NULL;

-- ثالثاً: إضافة القيد الجديد
ALTER TABLE shop_sales_invoices
  ADD CONSTRAINT shop_sales_invoices_status_check
  CHECK (status IN ('غير مدفوع', 'مجدول بكمبيالة', 'دفعت بالكامل', 'مدفوع جزئي'));

-- =====================================================
-- 2. فواتير المخزن - warehouse_sales_invoices
-- =====================================================

-- أولاً: إزالة القيد القديم
ALTER TABLE warehouse_sales_invoices
  DROP CONSTRAINT IF EXISTS warehouse_sales_invoices_status_check;

-- ثانياً: تحويل القيم القديمة قبل إضافة القيد الجديد
UPDATE warehouse_sales_invoices SET status = 'مجدول بكمبيالة' WHERE status = 'تقسيط شهري';

-- تحويل أي قيمة غير معروفة إلى 'غير مدفوع'
UPDATE warehouse_sales_invoices
  SET status = 'غير مدفوع'
  WHERE status NOT IN ('غير مدفوع', 'مجدول بكمبيالة', 'دفعت بالكامل', 'مدفوع جزئي')
     OR status IS NULL;

-- ثالثاً: إضافة القيد الجديد
ALTER TABLE warehouse_sales_invoices
  ADD CONSTRAINT warehouse_sales_invoices_status_check
  CHECK (status IN ('غير مدفوع', 'مجدول بكمبيالة', 'دفعت بالكامل', 'مدفوع جزئي'));

-- =====================================================
-- 3. إضافة أعمدة الربط - shop_receipts
-- =====================================================
ALTER TABLE shop_receipts
  ADD COLUMN IF NOT EXISTS linked_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_invoice_type TEXT,
  ADD COLUMN IF NOT EXISTS linked_installment_id UUID;

-- =====================================================
-- 4. إضافة أعمدة الربط - warehouse_receipts
-- =====================================================
ALTER TABLE warehouse_receipts
  ADD COLUMN IF NOT EXISTS linked_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_invoice_type TEXT,
  ADD COLUMN IF NOT EXISTS linked_installment_id UUID;

-- =====================================================
-- 5. ربط الكمبيالات بالفواتير - promissory_notes
-- =====================================================
ALTER TABLE promissory_notes
  ADD COLUMN IF NOT EXISTS linked_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_invoice_type TEXT;

-- =====================================================
-- 6. تتبع الدفع الجزئي على الأقساط
-- =====================================================
ALTER TABLE promissory_note_installments
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0;

-- =====================================================
-- 7. فهارس للأداء
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_shop_receipts_linked_invoice
  ON shop_receipts(linked_invoice_id, linked_invoice_type);
CREATE INDEX IF NOT EXISTS idx_shop_receipts_linked_installment
  ON shop_receipts(linked_installment_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_linked_invoice
  ON warehouse_receipts(linked_invoice_id, linked_invoice_type);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_linked_installment
  ON warehouse_receipts(linked_installment_id);
CREATE INDEX IF NOT EXISTS idx_promissory_notes_linked_invoice
  ON promissory_notes(linked_invoice_id, linked_invoice_type);
