-- Add columns for Groom Offers feature
ALTER TABLE quotations 
ADD COLUMN IF NOT EXISTS is_groom_offer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS groom_offer_title TEXT;

-- Index for faster lookup of groom offers
CREATE INDEX IF NOT EXISTS idx_quotations_is_groom_offer ON quotations(is_groom_offer) WHERE is_groom_offer = TRUE;
