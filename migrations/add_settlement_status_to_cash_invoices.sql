-- Add settlement status field to cash_invoices table
-- This field indicates whether the invoice is settled (مرحلة) or not settled (غير مرحلة)

ALTER TABLE cash_invoices 
ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_cash_invoices_is_settled ON cash_invoices(is_settled);

-- Add comment
COMMENT ON COLUMN cash_invoices.is_settled IS 'Indicates if the invoice is settled (مرحلة) or not settled (غير مرحلة)';

