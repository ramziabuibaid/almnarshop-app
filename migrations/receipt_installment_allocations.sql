-- ==========================================
-- Migration: Receipt Installment Allocations
-- تتبع تخصيصات سندات القبض على أقساط الكمبيالات
-- ==========================================

CREATE TABLE IF NOT EXISTS receipt_installment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id TEXT NOT NULL,
  receipt_type TEXT NOT NULL CHECK (receipt_type IN ('shop', 'warehouse')),
  installment_id UUID NOT NULL,
  allocated_amount NUMERIC(10,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_receipt_installment_allocations_receipt
  ON receipt_installment_allocations(receipt_id, receipt_type);

CREATE INDEX IF NOT EXISTS idx_receipt_installment_allocations_installment
  ON receipt_installment_allocations(installment_id);
