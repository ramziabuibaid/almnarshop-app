-- ==========================================
-- Migration: Add is_gift column to quotation_details
-- ==========================================
-- This migration adds the is_gift boolean column to the quotation_details table
-- to support marking items as gifts in quotations.

-- Add is_gift column to quotation_details table
ALTER TABLE quotation_details 
ADD COLUMN IF NOT EXISTS is_gift BOOLEAN DEFAULT FALSE;

-- Add index for better query performance when filtering by is_gift
CREATE INDEX IF NOT EXISTS idx_quotation_details_is_gift ON quotation_details(is_gift);

-- Add comment to document the column
COMMENT ON COLUMN quotation_details.is_gift IS 'Indicates if this item is a gift (هدية) - used for automatic gift discount calculation';
