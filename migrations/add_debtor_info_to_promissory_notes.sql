-- Add debtor_id_number and debtor_address to promissory_notes table
ALTER TABLE promissory_notes 
ADD COLUMN IF NOT EXISTS debtor_id_number TEXT,
ADD COLUMN IF NOT EXISTS debtor_address TEXT;
