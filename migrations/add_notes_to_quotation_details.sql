-- Add notes column to quotation_details table
ALTER TABLE quotation_details 
ADD COLUMN IF NOT EXISTS notes TEXT;
