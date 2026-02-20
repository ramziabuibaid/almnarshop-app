-- Migration: Add fields for legacy promissory notes

ALTER TABLE promissory_notes
ADD COLUMN is_legacy BOOLEAN DEFAULT false,
ADD COLUMN paid_amount DECIMAL(12, 2) DEFAULT 0.00,
ADD COLUMN remaining_amount DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED;

-- Add a comment explaining the purpose of these fields
COMMENT ON COLUMN promissory_notes.is_legacy IS 'Indicates if this note was entered from a past manual record';
COMMENT ON COLUMN promissory_notes.paid_amount IS 'Amount already paid before entering into the system';
COMMENT ON COLUMN promissory_notes.remaining_amount IS 'Amount left to be paid. This is the amount divided into future installments.';
