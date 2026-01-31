-- ==========================================
-- Migration: Add last_restocked_at to products
-- ==========================================
-- Track when product stock was last increased (new stock received)
-- Works for: admin edits, Google Sheets sync, or any update source
-- Run this migration in your Supabase SQL editor

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_restocked_at TIMESTAMP WITH TIME ZONE;

-- For existing products: set last_restocked_at = created_at
UPDATE products 
SET last_restocked_at = created_at 
WHERE last_restocked_at IS NULL;

-- Add index for sorting store products (recently restocked first)
CREATE INDEX IF NOT EXISTS idx_products_last_restocked_at ON products(last_restocked_at DESC NULLS LAST);

COMMENT ON COLUMN products.last_restocked_at IS 'When stock (cs_war + cs_shop) was last increased. Used for "جديد" badge and store sorting.';

-- ==========================================
-- TRIGGER: Auto-update last_restocked_at when stock increases
-- ==========================================
-- Works for ANY update source: admin panel, Google Sheets sync, API, etc.

CREATE OR REPLACE FUNCTION products_update_last_restocked_at()
RETURNS TRIGGER AS $$
DECLARE
  old_total NUMERIC;
  new_total NUMERIC;
BEGIN
  -- On INSERT: set last_restocked_at for new products
  IF TG_OP = 'INSERT' THEN
    NEW.last_restocked_at := NOW();
    RETURN NEW;
  END IF;

  -- On UPDATE: only set if stock (cs_war + cs_shop) increased
  IF TG_OP = 'UPDATE' THEN
    old_total := COALESCE(OLD.cs_war, 0) + COALESCE(OLD.cs_shop, 0);
    new_total := COALESCE(NEW.cs_war, 0) + COALESCE(NEW.cs_shop, 0);
    
    IF new_total > old_total THEN
      NEW.last_restocked_at := NOW();
    ELSE
      NEW.last_restocked_at := OLD.last_restocked_at;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_last_restocked_at_trigger ON products;
CREATE TRIGGER products_last_restocked_at_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_update_last_restocked_at();
